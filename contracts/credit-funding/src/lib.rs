#![no_std]

use credit_protocol::{
    AssetLifecycle as RegistryLifecycle, CreditRegistryClient, RegistryAssetRecord,
    RegistryAssetTerms,
};
use soroban_sdk::{
    auth::{ContractContext, InvokerContractAuthEntry, SubContractInvocation},
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    token::Client as TokenClient,
    vec, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};

const INSTANCE_TTL_THRESHOLD: u32 = 100_000;
const INSTANCE_TTL_EXTEND_TO: u32 = 500_000;
const PERSISTENT_TTL_THRESHOLD: u32 = 100_000;
const PERSISTENT_TTL_EXTEND_TO: u32 = 500_000;
const MAX_POSITION_READ: u32 = 25;
const MAX_REFUND_BATCH: u32 = 20;
const BASIS_POINTS: i128 = 10_000;

#[contract]
pub struct CreditFunding;

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Lifecycle {
    Open,
    ReadyToSettle,
    Settled,
    Cancelled,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum FundingError {
    InvalidConfiguration = 1,
    NotInitialized = 2,
    NotFound = 3,
    InvalidAmount = 4,
    InvalidNonce = 5,
    WrongLifecycle = 6,
    FundingExpired = 7,
    FundingNotExpired = 8,
    TargetNotReached = 9,
    TargetExceeded = 10,
    ArithmeticOverflow = 11,
    InvalidRange = 12,
    InvalidFeePolicy = 13,
    RefundAlreadyClaimed = 14,
    NoExcess = 15,
    InsufficientExcess = 16,
    Insolvent = 17,
    WrongTokenDecimals = 18,
    TargetReached = 19,
    NotRegistered = 20,
    RegistryTransitionFailed = 21,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PositionStatus {
    Open,
    Settled,
    Refunded,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolState {
    pub lifecycle: Lifecycle,
    pub funded_principal: i128,
    pub funding_fees: i128,
    pub outstanding_principal: i128,
    pub outstanding_fees: i128,
    pub position_count: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PoolSnapshot {
    pub registry: Address,
    pub asset_id: BytesN<32>,
    pub terms: RegistryAssetTerms,
    pub state: PoolState,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub position_id: u32,
    pub registry_asset_id: BytesN<32>,
    pub investor: Address,
    pub principal_units: i128,
    pub ownership_units: i128,
    pub funding_fee_units: i128,
    pub contribution_count: u32,
    pub last_nonce: u64,
    pub last_contribution_ref: BytesN<32>,
    pub status: PositionStatus,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Registry,
    AssetId,
    State,
    Position(u32),
    PositionForInvestor(Address),
}

#[contractevent(topics = ["contrib_v1"])]
struct ContributionEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[topic]
    position_id: u32,
    #[topic]
    investor: Address,
    #[data]
    nonce: u64,
    #[data]
    reference: BytesN<32>,
    #[data]
    principal_units: i128,
    #[data]
    funding_fee_units: i128,
    #[data]
    ownership_units: i128,
}

#[contractevent(topics = ["position_v1"])]
struct PositionEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[topic]
    position_id: u32,
    #[topic]
    investor: Address,
    #[data]
    status: PositionStatus,
    #[data]
    principal_units: i128,
    #[data]
    ownership_units: i128,
}

#[contractevent(topics = ["settle_v1"])]
struct SettlementEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    supplier: Address,
    #[data]
    principal_units: i128,
    #[data]
    fee_recipient: Address,
    #[data]
    funding_fee_units: i128,
    #[data]
    fee_policy_version: u32,
}

#[contractevent(topics = ["cancel_v1"])]
struct CancellationEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    funded_principal: i128,
    #[data]
    position_count: u32,
}

#[contractevent(topics = ["refund_v1"])]
struct RefundEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[topic]
    position_id: u32,
    #[topic]
    investor: Address,
    #[data]
    principal_units: i128,
    #[data]
    funding_fee_units: i128,
}

#[contractevent(topics = ["excess_v1"])]
struct ExcessRecoveryEvent {
    #[topic]
    asset_id: BytesN<32>,
    #[data]
    recipient: Address,
    #[data]
    amount: i128,
}

#[contractimpl]
impl CreditFunding {
    pub fn __constructor(env: Env, registry: Address, asset_id: BytesN<32>) {
        let record = CreditRegistryClient::new(&env, &registry).get_asset(&asset_id);
        if record.lifecycle != RegistryLifecycle::Open || record.funding_pool.is_some() {
            panic_with_error!(&env, FundingError::InvalidConfiguration);
        }
        validate_terms(&env, &record.terms);

        let state = PoolState {
            lifecycle: Lifecycle::Open,
            funded_principal: 0,
            funding_fees: 0,
            outstanding_principal: 0,
            outstanding_fees: 0,
            position_count: 0,
        };
        env.storage().instance().set(&DataKey::Registry, &registry);
        env.storage().instance().set(&DataKey::AssetId, &asset_id);
        env.storage().instance().set(&DataKey::State, &state);
        extend_instance_ttl(&env);
    }

    /// Atomic investor transfer and position update. Contribution identity is
    /// (asset ID, position ID, investor address, monotonically increasing nonce).
    pub fn contribute(
        env: Env,
        investor: Address,
        principal_units: i128,
        nonce: u64,
        contribution_ref: BytesN<32>,
    ) -> Result<u32, FundingError> {
        investor.require_auth();
        let record = require_registered_open(&env)?;
        let config = record.terms.clone();
        let mut state = read_state(&env)?;

        if state.lifecycle != Lifecycle::Open {
            return Err(FundingError::WrongLifecycle);
        }
        if env.ledger().timestamp() >= config.deadline {
            return Err(FundingError::FundingExpired);
        }
        if principal_units <= 0 {
            return Err(FundingError::InvalidAmount);
        }

        let remaining = config
            .target_principal
            .checked_sub(state.funded_principal)
            .ok_or(FundingError::ArithmeticOverflow)?;
        if principal_units > remaining {
            return Err(FundingError::TargetExceeded);
        }

        let position_key = DataKey::PositionForInvestor(investor.clone());
        let existing_id: Option<u32> = env.storage().persistent().get(&position_key);
        let (position_id, mut position) = if let Some(id) = existing_id {
            let position = read_position(&env, id)?;
            if position.status != PositionStatus::Open || nonce <= position.last_nonce {
                return Err(FundingError::InvalidNonce);
            }
            (id, position)
        } else {
            if nonce == 0 {
                return Err(FundingError::InvalidNonce);
            }
            let id = state.position_count;
            state.position_count = state
                .position_count
                .checked_add(1)
                .ok_or(FundingError::ArithmeticOverflow)?;
            (
                id,
                Position {
                    position_id: id,
                    registry_asset_id: record.asset_id.clone(),
                    investor: investor.clone(),
                    principal_units: 0,
                    ownership_units: 0,
                    funding_fee_units: 0,
                    contribution_count: 0,
                    last_nonce: 0,
                    last_contribution_ref: contribution_ref.clone(),
                    status: PositionStatus::Open,
                },
            )
        };

        let next_principal = state
            .funded_principal
            .checked_add(principal_units)
            .ok_or(FundingError::ArithmeticOverflow)?;
        let next_fee_total = calculate_fee(next_principal, config.funding_fee_bps)?;
        let funding_fee_units = next_fee_total
            .checked_sub(state.funding_fees)
            .ok_or(FundingError::ArithmeticOverflow)?;
        let transfer_units = principal_units
            .checked_add(funding_fee_units)
            .ok_or(FundingError::ArithmeticOverflow)?;
        next_principal
            .checked_add(next_fee_total)
            .ok_or(FundingError::ArithmeticOverflow)?;

        position.principal_units = position
            .principal_units
            .checked_add(principal_units)
            .ok_or(FundingError::ArithmeticOverflow)?;
        position.ownership_units = position
            .ownership_units
            .checked_add(principal_units)
            .ok_or(FundingError::ArithmeticOverflow)?;
        position.funding_fee_units = position
            .funding_fee_units
            .checked_add(funding_fee_units)
            .ok_or(FundingError::ArithmeticOverflow)?;
        position.contribution_count = position
            .contribution_count
            .checked_add(1)
            .ok_or(FundingError::ArithmeticOverflow)?;
        position.last_nonce = nonce;
        position.last_contribution_ref = contribution_ref.clone();

        let next_lifecycle = if next_principal == config.target_principal {
            Lifecycle::ReadyToSettle
        } else {
            Lifecycle::Open
        };
        state.funded_principal = next_principal;
        state.funding_fees = next_fee_total;
        state.outstanding_principal = next_principal;
        state.outstanding_fees = next_fee_total;
        state.lifecycle = next_lifecycle;

        // The SAC transfer and all following storage writes are one Soroban
        // transaction: a failed token call cannot create a position or units.
        TokenClient::new(&env, &config.token).transfer(
            &investor,
            env.current_contract_address(),
            &transfer_units,
        );

        env.storage()
            .persistent()
            .set(&DataKey::Position(position_id), &position);
        env.storage().persistent().set(&position_key, &position_id);
        extend_persistent_ttl(&env, &DataKey::Position(position_id));
        extend_persistent_ttl(&env, &position_key);
        env.storage().instance().set(&DataKey::State, &state);
        extend_instance_ttl(&env);

        ContributionEvent {
            asset_id: record.asset_id,
            position_id,
            investor,
            nonce,
            reference: contribution_ref,
            principal_units,
            funding_fee_units,
            ownership_units: principal_units,
        }
        .publish(&env);
        PositionEvent {
            asset_id: position.registry_asset_id,
            position_id,
            investor: position.investor.clone(),
            status: position.status,
            principal_units: position.principal_units,
            ownership_units: position.ownership_units,
        }
        .publish(&env);

        Ok(position_id)
    }

    /// Permissionless target-gated settlement to destinations frozen at deploy.
    pub fn settle(env: Env) -> Result<(), FundingError> {
        let record = require_registered_open(&env)?;
        let config = record.terms;
        let mut state = read_state(&env)?;
        if state.lifecycle != Lifecycle::ReadyToSettle
            || state.funded_principal != config.target_principal
        {
            return Err(FundingError::TargetNotReached);
        }

        let registry = read_registry(&env)?;
        let pool = env.current_contract_address();
        authorize_registry_transition(&env, &registry, "mark_settled", &record.asset_id);
        CreditRegistryClient::new(&env, &registry).mark_settled(&record.asset_id, &pool);

        state.lifecycle = Lifecycle::Settled;
        state.outstanding_principal = 0;
        state.outstanding_fees = 0;
        env.storage().instance().set(&DataKey::State, &state);
        extend_instance_ttl(&env);

        let token = TokenClient::new(&env, &config.token);
        token.transfer(&pool, &config.supplier, &config.target_principal);
        if state.funding_fees > 0 {
            token.transfer(&pool, &config.fee_recipient, &state.funding_fees);
        }

        SettlementEvent {
            asset_id: record.asset_id,
            supplier: config.supplier,
            principal_units: config.target_principal,
            fee_recipient: config.fee_recipient,
            funding_fee_units: state.funding_fees,
            fee_policy_version: config.fee_policy_version,
        }
        .publish(&env);
        Ok(())
    }

    /// Anyone can deterministically close partial funding at/after the deadline.
    pub fn cancel(env: Env) -> Result<(), FundingError> {
        let record = require_registered_open(&env)?;
        let config = record.terms;
        let mut state = read_state(&env)?;
        if state.lifecycle == Lifecycle::ReadyToSettle
            || state.funded_principal == config.target_principal
        {
            return Err(FundingError::TargetReached);
        }
        if state.lifecycle != Lifecycle::Open {
            return Err(FundingError::WrongLifecycle);
        }
        if env.ledger().timestamp() < config.deadline {
            return Err(FundingError::FundingNotExpired);
        }

        let registry = read_registry(&env)?;
        let pool = env.current_contract_address();
        authorize_registry_transition(&env, &registry, "mark_cancelled", &record.asset_id);
        CreditRegistryClient::new(&env, &registry).mark_cancelled(&record.asset_id, &pool);

        state.lifecycle = Lifecycle::Cancelled;
        env.storage().instance().set(&DataKey::State, &state);
        extend_instance_ttl(&env);
        CancellationEvent {
            asset_id: record.asset_id,
            funded_principal: state.funded_principal,
            position_count: state.position_count,
        }
        .publish(&env);
        Ok(())
    }

    /// Investor-authorized refund; the receiver is always the recorded wallet.
    pub fn refund(env: Env, investor: Address, position_id: u32) -> Result<i128, FundingError> {
        investor.require_auth();
        refund_position(&env, investor, position_id)
    }

    /// Permissionless liveness path. It cannot redirect the recorded refund.
    pub fn refund_to_recorded_wallet(env: Env, position_id: u32) -> Result<i128, FundingError> {
        let position = read_position(&env, position_id)?;
        refund_position(&env, position.investor, position_id)
    }

    /// Bounded keeper-friendly refund scan; every payout is fixed to its owner.
    pub fn refund_batch(
        env: Env,
        start_position_id: u32,
        limit: u32,
    ) -> Result<i128, FundingError> {
        if limit == 0 || limit > MAX_REFUND_BATCH {
            return Err(FundingError::InvalidRange);
        }
        let state = read_state(&env)?;
        if state.lifecycle != Lifecycle::Cancelled {
            return Err(FundingError::WrongLifecycle);
        }

        let end = start_position_id
            .saturating_add(limit)
            .min(state.position_count);
        let mut refunded_total = 0i128;
        let mut position_id = start_position_id;
        while position_id < end {
            let position = read_position(&env, position_id)?;
            if position.status == PositionStatus::Open {
                let amount = refund_position(&env, position.investor, position_id)?;
                refunded_total = refunded_total
                    .checked_add(amount)
                    .ok_or(FundingError::ArithmeticOverflow)?;
            }
            position_id += 1;
        }
        Ok(refunded_total)
    }

    /// Recover only balance above the pool's accounted investor liabilities.
    pub fn recover_excess(env: Env, amount: i128) -> Result<(), FundingError> {
        if amount <= 0 {
            return Err(FundingError::InvalidAmount);
        }
        let config = read_terms(&env)?;
        let state = read_state(&env)?;
        config.excess_recipient.require_auth();

        let accounted = state
            .outstanding_principal
            .checked_add(state.outstanding_fees)
            .ok_or(FundingError::ArithmeticOverflow)?;
        let actual = TokenClient::new(&env, &config.token).balance(&env.current_contract_address());
        let excess = actual
            .checked_sub(accounted)
            .ok_or(FundingError::Insolvent)?;
        if excess == 0 {
            return Err(FundingError::NoExcess);
        }
        if amount > excess {
            return Err(FundingError::InsufficientExcess);
        }

        TokenClient::new(&env, &config.token).transfer(
            &env.current_contract_address(),
            &config.excess_recipient,
            &amount,
        );
        ExcessRecoveryEvent {
            asset_id: read_asset_id(&env)?,
            recipient: config.excess_recipient,
            amount,
        }
        .publish(&env);
        Ok(())
    }

    pub fn pool(env: Env) -> Result<PoolSnapshot, FundingError> {
        let record = read_asset_record(&env)?;
        let state = read_state(&env)?;
        Ok(PoolSnapshot {
            registry: read_registry(&env)?,
            asset_id: record.asset_id,
            terms: record.terms,
            state,
        })
    }

    pub fn position(env: Env, position_id: u32) -> Result<Position, FundingError> {
        let mut position = read_position(&env, position_id)?;
        let state = read_state(&env)?;
        position.status = match state.lifecycle {
            Lifecycle::Settled => PositionStatus::Settled,
            Lifecycle::Cancelled => position.status,
            Lifecycle::Open | Lifecycle::ReadyToSettle => position.status,
        };
        Ok(position)
    }

    pub fn position_for_investor(
        env: Env,
        investor: Address,
    ) -> Result<Option<Position>, FundingError> {
        let key = DataKey::PositionForInvestor(investor);
        let id: Option<u32> = env.storage().persistent().get(&key);
        if let Some(position_id) = id {
            extend_persistent_ttl(&env, &key);
            Self::position(env, position_id).map(Some)
        } else {
            Ok(None)
        }
    }

    /// Reads a bounded, ascending range of non-transferable positions.
    pub fn positions(
        env: Env,
        start_position_id: u32,
        limit: u32,
    ) -> Result<Vec<Position>, FundingError> {
        if limit == 0 || limit > MAX_POSITION_READ {
            return Err(FundingError::InvalidRange);
        }
        let state = read_state(&env)?;
        let end = start_position_id
            .saturating_add(limit)
            .min(state.position_count);
        let mut result = Vec::new(&env);
        let mut position_id = start_position_id;
        while position_id < end {
            result.push_back(Self::position(env.clone(), position_id)?);
            position_id += 1;
        }
        Ok(result)
    }
}

fn refund_position(env: &Env, investor: Address, position_id: u32) -> Result<i128, FundingError> {
    let config = read_terms(env)?;
    let mut state = read_state(env)?;
    if state.lifecycle != Lifecycle::Cancelled {
        return Err(FundingError::WrongLifecycle);
    }
    let mut position = read_position(env, position_id)?;
    if position.investor != investor {
        return Err(FundingError::NotFound);
    }
    if position.status == PositionStatus::Refunded {
        return Err(FundingError::RefundAlreadyClaimed);
    }

    let refund_amount = position
        .principal_units
        .checked_add(position.funding_fee_units)
        .ok_or(FundingError::ArithmeticOverflow)?;
    state.outstanding_principal = state
        .outstanding_principal
        .checked_sub(position.principal_units)
        .ok_or(FundingError::Insolvent)?;
    state.outstanding_fees = state
        .outstanding_fees
        .checked_sub(position.funding_fee_units)
        .ok_or(FundingError::Insolvent)?;
    position.status = PositionStatus::Refunded;

    env.storage()
        .persistent()
        .set(&DataKey::Position(position_id), &position);
    env.storage().instance().set(&DataKey::State, &state);
    extend_persistent_ttl(env, &DataKey::Position(position_id));
    extend_instance_ttl(env);
    TokenClient::new(env, &config.token).transfer(
        &env.current_contract_address(),
        &position.investor,
        &refund_amount,
    );

    RefundEvent {
        asset_id: read_asset_id(env)?,
        position_id,
        investor: position.investor.clone(),
        principal_units: position.principal_units,
        funding_fee_units: position.funding_fee_units,
    }
    .publish(env);
    PositionEvent {
        asset_id: position.registry_asset_id,
        position_id,
        investor: position.investor,
        status: PositionStatus::Refunded,
        principal_units: position.principal_units,
        ownership_units: position.ownership_units,
    }
    .publish(env);
    Ok(refund_amount)
}

fn calculate_fee(principal_units: i128, fee_bps: u32) -> Result<i128, FundingError> {
    let rate = i128::from(fee_bps);
    let whole = (principal_units / BASIS_POINTS)
        .checked_mul(rate)
        .ok_or(FundingError::ArithmeticOverflow)?;
    let remainder = (principal_units % BASIS_POINTS)
        .checked_mul(rate)
        .ok_or(FundingError::ArithmeticOverflow)?
        / BASIS_POINTS;
    whole
        .checked_add(remainder)
        .ok_or(FundingError::ArithmeticOverflow)
}

fn read_state(env: &Env) -> Result<PoolState, FundingError> {
    let state = env
        .storage()
        .instance()
        .get(&DataKey::State)
        .ok_or(FundingError::NotInitialized)?;
    extend_instance_ttl(env);
    Ok(state)
}

fn read_registry(env: &Env) -> Result<Address, FundingError> {
    env.storage()
        .instance()
        .get(&DataKey::Registry)
        .ok_or(FundingError::NotInitialized)
}

fn read_asset_id(env: &Env) -> Result<BytesN<32>, FundingError> {
    env.storage()
        .instance()
        .get(&DataKey::AssetId)
        .ok_or(FundingError::NotInitialized)
}

fn read_asset_record(env: &Env) -> Result<RegistryAssetRecord, FundingError> {
    let registry = read_registry(env)?;
    let asset_id = read_asset_id(env)?;
    Ok(CreditRegistryClient::new(env, &registry).get_asset(&asset_id))
}

fn read_terms(env: &Env) -> Result<RegistryAssetTerms, FundingError> {
    Ok(read_asset_record(env)?.terms)
}

fn require_registered_open(env: &Env) -> Result<RegistryAssetRecord, FundingError> {
    let record = read_asset_record(env)?;
    if record.lifecycle != RegistryLifecycle::Open
        || record.funding_pool.as_ref() != Some(&env.current_contract_address())
    {
        return Err(FundingError::NotRegistered);
    }
    Ok(record)
}

fn validate_terms(env: &Env, terms: &RegistryAssetTerms) {
    if terms.target_principal <= 0
        || terms.deadline <= env.ledger().timestamp()
        || terms.fee_policy_version == 0
        || terms.token_decimals > 18
        || terms.supplier == env.current_contract_address()
        || terms.fee_recipient == terms.supplier
        || terms.fee_recipient == env.current_contract_address()
        || terms.excess_recipient == env.current_contract_address()
    {
        panic_with_error!(env, FundingError::InvalidConfiguration);
    }
    if terms.funding_fee_bps >= BASIS_POINTS as u32 {
        panic_with_error!(env, FundingError::InvalidFeePolicy);
    }
    if TokenClient::new(env, &terms.token).decimals() != terms.token_decimals {
        panic_with_error!(env, FundingError::WrongTokenDecimals);
    }
}

fn authorize_registry_transition(
    env: &Env,
    registry: &Address,
    function: &str,
    asset_id: &BytesN<32>,
) {
    let pool = env.current_contract_address();
    let args: Vec<Val> = vec![env, asset_id.into_val(env), pool.into_val(env)];
    let invoke = InvokerContractAuthEntry::Contract(SubContractInvocation {
        context: ContractContext {
            contract: registry.clone(),
            fn_name: Symbol::new(env, function),
            args,
        },
        sub_invocations: Vec::new(env),
    });
    env.authorize_as_current_contract(vec![env, invoke]);
}

fn read_position(env: &Env, position_id: u32) -> Result<Position, FundingError> {
    let key = DataKey::Position(position_id);
    let position = env
        .storage()
        .persistent()
        .get(&key)
        .ok_or(FundingError::NotFound)?;
    extend_persistent_ttl(env, &key);
    Ok(position)
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
