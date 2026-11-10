#![no_std]

use soroban_sdk::{contractclient, contracterror, contracttype, Address, BytesN, Env, Vec};

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AssetLifecycle {
    Open,
    Settled,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryAssetTerms {
    pub token: Address,
    pub token_decimals: u32,
    pub target_principal: i128,
    pub supplier: Address,
    pub fee_recipient: Address,
    pub excess_recipient: Address,
    pub funding_fee_bps: u32,
    pub fee_policy_version: u32,
    pub deadline: u64,
    /// SHA-256 of the commercial deal id. Binds this registry record to one deal.
    pub deal_hash: BytesN<32>,
    /// SHA-256 of the frozen financial snapshot. Maturity stays off-chain.
    pub snapshot_hash: BytesN<32>,
    /// SHA-256 root of the document commitment hashes.
    pub document_root: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegistryAssetRecord {
    pub asset_id: BytesN<32>,
    pub terms: RegistryAssetTerms,
    pub lifecycle: AssetLifecycle,
    pub funding_pool: Option<Address>,
}

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum RegistryError {
    NotInitialized = 1,
    AlreadyRegistered = 2,
    NotFound = 3,
    InvalidTerms = 4,
    PoolAlreadyCreated = 5,
    PoolNotCreated = 6,
    WrongPool = 7,
    WrongLifecycle = 8,
    InvalidRange = 9,
    ArithmeticOverflow = 10,
    UnsupportedToken = 11,
}

#[contractclient(name = "CreditRegistryClient")]
pub trait CreditRegistryInterface {
    fn register_asset(
        env: Env,
        asset_id: BytesN<32>,
        terms: RegistryAssetTerms,
    ) -> Result<(), RegistryError>;
    fn create_funding_pool(env: Env, asset_id: BytesN<32>) -> Result<Address, RegistryError>;
    fn get_asset(env: Env, asset_id: BytesN<32>) -> Result<RegistryAssetRecord, RegistryError>;
    fn assets(env: Env, start: u32, limit: u32) -> Result<Vec<RegistryAssetRecord>, RegistryError>;
    fn mark_settled(env: Env, asset_id: BytesN<32>, pool: Address) -> Result<(), RegistryError>;
    fn mark_cancelled(env: Env, asset_id: BytesN<32>, pool: Address) -> Result<(), RegistryError>;
}
