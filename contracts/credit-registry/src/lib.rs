#![no_std]

use credit_protocol::{AssetLifecycle, RegistryAssetRecord, RegistryAssetTerms, RegistryError};
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, token::Client as TokenClient, Address,
    BytesN, ContractExecutable, Env, Vec,
};

const INSTANCE_TTL_THRESHOLD: u32 = 100_000;
const INSTANCE_TTL_EXTEND_TO: u32 = 500_000;
const PERSISTENT_TTL_THRESHOLD: u32 = 100_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 500_000;
const MAX_ASSET_READ: u32 = 25;
const BASIS_POINTS: u32 = 10_000;

#[contract]
pub struct CreditRegistry;

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    FundingWasmHash,
    UsdcSac,
    AssetCount,
    AssetId(u32),
    Asset(BytesN<32>),
}

#[contractevent(topics = ["asset_v1"])]
struct AssetRegisteredEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    token: Address,
    #[data]
    target_principal: i128,
    #[data]
    deadline: u64,
    #[data]
    deal_hash: BytesN<32>,
    #[data]
    snapshot_hash: BytesN<32>,
}

#[contractevent(topics = ["pool_v1"])]
struct FundingPoolCreatedEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    pool: Address,
}

#[contractevent(topics = ["asset_settled_v1"])]
struct AssetSettledEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    pool: Address,
}

#[contractevent(topics = ["asset_cancelled_v1"])]
struct AssetCancelledEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    pool: Address,
}

#[contractimpl]
impl CreditRegistry {
    pub fn __constructor(
        env: Env,
        admin: Address,
        funding_wasm_hash: BytesN<32>,
        usdc_sac: Address,
    ) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::FundingWasmHash, &funding_wasm_hash);
        env.storage().instance().set(&DataKey::UsdcSac, &usdc_sac);
        env.storage().instance().set(&DataKey::AssetCount, &0_u32);
        extend_instance_ttl(&env);
    }

    /// Freeze asset terms before a funding pool can be created.
    pub fn register_asset(
        env: Env,
        asset_id: BytesN<32>,
        terms: RegistryAssetTerms,
    ) -> Result<(), RegistryError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        let usdc_sac = read_usdc_sac(&env)?;
        if terms.token != usdc_sac {
            return Err(RegistryError::UnsupportedToken);
        }
        validate_terms(&env, &terms)?;
        if TokenClient::new(&env, &usdc_sac).decimals() != terms.token_decimals {
            return Err(RegistryError::InvalidTerms);
        }

        let key = DataKey::Asset(asset_id.clone());
        if env.storage().persistent().has(&key) {
            return Err(RegistryError::AlreadyRegistered);
        }

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AssetCount)
            .ok_or(RegistryError::NotInitialized)?;
        let next_count = count
            .checked_add(1)
            .ok_or(RegistryError::ArithmeticOverflow)?;
        let record = RegistryAssetRecord {
            asset_id: asset_id.clone(),
            terms: terms.clone(),
            lifecycle: AssetLifecycle::Open,
            funding_pool: None,
        };

        env.storage().persistent().set(&key, &record);
        extend_persistent_ttl(&env, &key);
        env.storage()
            .persistent()
            .set(&DataKey::AssetId(count), &asset_id);
        extend_persistent_ttl(&env, &DataKey::AssetId(count));
        count = next_count;
        env.storage().instance().set(&DataKey::AssetCount, &count);
        extend_instance_ttl(&env);
        AssetRegisteredEvent {
            asset_id,
            token: terms.token,
            target_principal: terms.target_principal,
            deadline: terms.deadline,
            deal_hash: terms.deal_hash.clone(),
            snapshot_hash: terms.snapshot_hash.clone(),
        }
        .publish(&env);
        Ok(())
    }

    /// Factory operation: deploy the pool from its frozen registry terms and
    /// bind the resulting contract before any contribution can be accepted.
    pub fn create_funding_pool(env: Env, asset_id: BytesN<32>) -> Result<Address, RegistryError> {
        let admin = read_admin(&env)?;
        admin.require_auth();
        let key = DataKey::Asset(asset_id.clone());
        let record: RegistryAssetRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;
        extend_persistent_ttl(&env, &key);
        if record.lifecycle != AssetLifecycle::Open {
            return Err(RegistryError::WrongLifecycle);
        }
        if record.funding_pool.is_some() {
            return Err(RegistryError::PoolAlreadyCreated);
        }

        let wasm_hash: BytesN<32> = env
            .storage()
            .instance()
            .get(&DataKey::FundingWasmHash)
            .ok_or(RegistryError::NotInitialized)?;
        let registry = env.current_contract_address();
        let pool = env
            .deployer()
            .with_current_contract(asset_id.clone())
            .deploy_contract(ContractExecutable::Wasm(wasm_hash), (&registry, &asset_id));

        let mut updated = record;
        updated.funding_pool = Some(pool.clone());
        env.storage().persistent().set(&key, &updated);
        extend_persistent_ttl(&env, &key);
        extend_instance_ttl(&env);
        FundingPoolCreatedEvent {
            asset_id,
            pool: pool.clone(),
        }
        .publish(&env);
        Ok(pool)
    }

    pub fn get_asset(env: Env, asset_id: BytesN<32>) -> Result<RegistryAssetRecord, RegistryError> {
        let key = DataKey::Asset(asset_id);
        let record: RegistryAssetRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;
        extend_persistent_ttl(&env, &key);
        Ok(record)
    }

    pub fn mark_settled(
        env: Env,
        asset_id: BytesN<32>,
        pool: Address,
    ) -> Result<(), RegistryError> {
        pool.require_auth();
        let key = DataKey::Asset(asset_id.clone());
        let mut record: RegistryAssetRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;
        if record.funding_pool.as_ref() != Some(&pool) {
            return Err(RegistryError::WrongPool);
        }
        if record.lifecycle != AssetLifecycle::Open {
            return Err(RegistryError::WrongLifecycle);
        }

        record.lifecycle = AssetLifecycle::Settled;
        env.storage().persistent().set(&key, &record);
        extend_persistent_ttl(&env, &key);
        extend_instance_ttl(&env);
        AssetSettledEvent { asset_id, pool }.publish(&env);
        Ok(())
    }

    pub fn mark_cancelled(
        env: Env,
        asset_id: BytesN<32>,
        pool: Address,
    ) -> Result<(), RegistryError> {
        pool.require_auth();
        let key = DataKey::Asset(asset_id.clone());
        let mut record: RegistryAssetRecord = env
            .storage()
            .persistent()
            .get(&key)
            .ok_or(RegistryError::NotFound)?;
        if record.funding_pool.as_ref() != Some(&pool) {
            return Err(RegistryError::WrongPool);
        }
        if record.lifecycle != AssetLifecycle::Open {
            return Err(RegistryError::WrongLifecycle);
        }

        record.lifecycle = AssetLifecycle::Cancelled;
        env.storage().persistent().set(&key, &record);
        extend_persistent_ttl(&env, &key);
        extend_instance_ttl(&env);
        AssetCancelledEvent { asset_id, pool }.publish(&env);
        Ok(())
    }

    pub fn assets(
        env: Env,
        start: u32,
        limit: u32,
    ) -> Result<Vec<RegistryAssetRecord>, RegistryError> {
        if limit == 0 || limit > MAX_ASSET_READ {
            return Err(RegistryError::InvalidRange);
        }
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::AssetCount)
            .ok_or(RegistryError::NotInitialized)?;
        let end = start.saturating_add(limit).min(count);
        let mut records = Vec::new(&env);
        let mut index = start;
        while index < end {
            let asset_id: BytesN<32> = env
                .storage()
                .persistent()
                .get(&DataKey::AssetId(index))
                .ok_or(RegistryError::NotFound)?;
            extend_persistent_ttl(&env, &DataKey::AssetId(index));
            records.push_back(Self::get_asset(env.clone(), asset_id)?);
            index += 1;
        }
        extend_instance_ttl(&env);
        Ok(records)
    }
}

fn validate_terms(env: &Env, terms: &RegistryAssetTerms) -> Result<(), RegistryError> {
    if terms.target_principal <= 0
        || terms.token_decimals > 18
        || terms.fee_policy_version == 0
        || terms.deadline <= env.ledger().timestamp()
        || terms.fee_recipient == terms.supplier
        || terms.funding_fee_bps >= BASIS_POINTS
        || is_zero_hash(&terms.deal_hash)
        || is_zero_hash(&terms.snapshot_hash)
        || is_zero_hash(&terms.document_root)
    {
        return Err(RegistryError::InvalidTerms);
    }
    Ok(())
}

fn is_zero_hash(value: &BytesN<32>) -> bool {
    value.to_array().iter().all(|byte| *byte == 0)
}

fn read_admin(env: &Env) -> Result<Address, RegistryError> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(RegistryError::NotInitialized)
}

fn read_usdc_sac(env: &Env) -> Result<Address, RegistryError> {
    env.storage()
        .instance()
        .get(&DataKey::UsdcSac)
        .ok_or(RegistryError::NotInitialized)
}

fn extend_instance_ttl(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(INSTANCE_TTL_THRESHOLD, INSTANCE_TTL_EXTEND_TO);
}

fn extend_persistent_ttl<K>(env: &Env, key: &K)
where
    K: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.storage()
        .persistent()
        .extend_ttl(key, PERSISTENT_TTL_THRESHOLD, PERSISTENT_TTL_EXTEND_TO);
}

#[cfg(test)]
mod test;
