use super::*;
use credit_protocol::{AssetLifecycle, RegistryAssetRecord, RegistryAssetTerms, RegistryError};
use soroban_sdk::{
    contract, contractimpl,
    testutils::{Address as _, EnvTestConfig, Ledger as _},
    token::StellarAssetClient,
    Address, Env,
};

const TARGET: i128 = 1_000;

#[contract]
struct TestRegistry;

#[contracttype]
#[derive(Clone)]
enum TestRegistryKey {
    Record,
}

#[contractimpl]
impl TestRegistry {
    pub fn __constructor(env: Env, record: RegistryAssetRecord) {
        env.storage()
            .instance()
            .set(&TestRegistryKey::Record, &record);
    }

    pub fn get_asset(env: Env, _asset_id: BytesN<32>) -> RegistryAssetRecord {
        env.storage()
            .instance()
            .get(&TestRegistryKey::Record)
            .unwrap()
    }

    pub fn bind_pool(env: Env, pool: Address) {
        let mut record: RegistryAssetRecord = env
            .storage()
            .instance()
            .get(&TestRegistryKey::Record)
            .unwrap();
        record.funding_pool = Some(pool);
        env.storage()
            .instance()
            .set(&TestRegistryKey::Record, &record);
    }

    pub fn mark_settled(
        env: Env,
        _asset_id: BytesN<32>,
        pool: Address,
    ) -> Result<(), RegistryError> {
        pool.require_auth();
        let mut record: RegistryAssetRecord = env
            .storage()
            .instance()
            .get(&TestRegistryKey::Record)
            .unwrap();
        if record.funding_pool.as_ref() != Some(&pool) {
            return Err(RegistryError::WrongPool);
        }
        record.lifecycle = AssetLifecycle::Settled;
        env.storage()
            .instance()
            .set(&TestRegistryKey::Record, &record);
        Ok(())
    }

    pub fn mark_cancelled(
        env: Env,
        _asset_id: BytesN<32>,
        pool: Address,
    ) -> Result<(), RegistryError> {
        pool.require_auth();
        let mut record: RegistryAssetRecord = env
            .storage()
            .instance()
            .get(&TestRegistryKey::Record)
            .unwrap();
        if record.funding_pool.as_ref() != Some(&pool) {
            return Err(RegistryError::WrongPool);
        }
        record.lifecycle = AssetLifecycle::Cancelled;
        env.storage()
            .instance()
            .set(&TestRegistryKey::Record, &record);
        Ok(())
    }
}

struct Fixture {
    env: Env,
    asset: Address,
    asset_id: BytesN<32>,
    registry: Address,
    pool: Address,
    investor_a: Address,
    investor_b: Address,
    supplier: Address,
    fee_recipient: Address,
    excess_recipient: Address,
}

fn fixture(balance_a: i128, balance_b: i128) -> Fixture {
    fixture_with_target(balance_a, balance_b, TARGET)
}

fn fixture_with_target(balance_a: i128, balance_b: i128, target: i128) -> Fixture {
    let env = Env::new_with_config(EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    env.ledger().set_timestamp(100);
    let issuer = Address::generate(&env);
    let investor_a = Address::generate(&env);
    let investor_b = Address::generate(&env);
    let supplier = Address::generate(&env);
    let fee_recipient = Address::generate(&env);
    let excess_recipient = Address::generate(&env);
    let asset = env
        .register_stellar_asset_contract_v2(issuer.clone())
        .address();
    let token_admin = StellarAssetClient::new(&env, &asset);
    env.mock_all_auths();
    token_admin.mint(&investor_a, &balance_a);
    token_admin.mint(&investor_b, &balance_b);

    let asset_id = BytesN::from_array(&env, &[7; 32]);
    let terms = RegistryAssetTerms {
        token: asset.clone(),
        token_decimals: 7,
        target_principal: target,
        supplier: supplier.clone(),
        fee_recipient: fee_recipient.clone(),
        excess_recipient: excess_recipient.clone(),
        funding_fee_bps: 100,
        fee_policy_version: 1,
        deadline: 200,
        deal_hash: BytesN::from_array(&env, &[4; 32]),
        snapshot_hash: BytesN::from_array(&env, &[5; 32]),
        document_root: BytesN::from_array(&env, &[6; 32]),
    };
    let record = RegistryAssetRecord {
        asset_id: asset_id.clone(),
        terms,
        lifecycle: AssetLifecycle::Open,
        funding_pool: None,
    };
    let registry = env.register(TestRegistry, (record,));
    let pool = env.register(CreditFunding, (&registry, &asset_id));
    TestRegistryClient::new(&env, &registry).bind_pool(&pool);

    Fixture {
        env,
        asset,
        asset_id,
        registry,
        pool,
        investor_a,
        investor_b,
        supplier,
        fee_recipient,
        excess_recipient,
    }
}

fn client(fixture: &Fixture) -> CreditFundingClient<'_> {
    CreditFundingClient::new(&fixture.env, &fixture.pool)
}

fn nonce_ref(env: &Env, nonce: u8) -> BytesN<32> {
    BytesN::from_array(env, &[nonce; 32])
}

fn balance(env: &Env, asset: &Address, owner: &Address) -> i128 {
    TokenClient::new(env, asset).balance(owner)
}

fn assert_call_fails<T, DecodeError, ContractError, InvokeError>(
    result: Result<Result<T, DecodeError>, Result<ContractError, InvokeError>>,
) {
    assert!(matches!(result, Err(_) | Ok(Err(_))));
}

#[test]
fn two_investors_settle_exact_principal_once_and_retain_individual_positions() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    let pool_before = balance(&f.env, &f.asset, &f.pool);

    let a_position = funding.contribute(&f.investor_a, &600, &1, &nonce_ref(&f.env, 1));
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), 0);
    let b_position = funding.contribute(&f.investor_b, &400, &1, &nonce_ref(&f.env, 2));
    assert_eq!(a_position, 0);
    assert_eq!(b_position, 1);
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), 0);
    assert_eq!(balance(&f.env, &f.asset, &f.pool) - pool_before, 1_010);

    let positions = funding.positions(&0, &25);
    assert_eq!(positions.len(), 2);
    assert_eq!(positions.get(0).unwrap().investor, f.investor_a);
    assert_eq!(positions.get(0).unwrap().principal_units, 600);
    assert_eq!(positions.get(0).unwrap().ownership_units, 600);
    assert_eq!(positions.get(1).unwrap().investor, f.investor_b);
    assert_eq!(positions.get(1).unwrap().principal_units, 400);
    assert_eq!(positions.get(1).unwrap().ownership_units, 400);
    assert_eq!(funding.pool().state.lifecycle, Lifecycle::ReadyToSettle);

    funding.settle();
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), TARGET);
    assert_eq!(balance(&f.env, &f.asset, &f.fee_recipient), 10);
    assert_eq!(
        funding.position(&a_position).status,
        PositionStatus::Settled
    );
    assert_eq!(
        TestRegistryClient::new(&f.env, &f.registry)
            .get_asset(&f.asset_id)
            .lifecycle,
        AssetLifecycle::Settled
    );
    assert_call_fails(funding.try_settle());
}

#[test]
fn settlement_authorizes_the_registry_transition_as_the_funding_pool() {
    let f = fixture(2_000, 1_000);
    let funding = client(&f);
    funding.contribute(&f.investor_a, &TARGET, &1, &nonce_ref(&f.env, 1));

    f.env.mock_auths(&[]);
    client(&f).settle();

    assert_eq!(
        TestRegistryClient::new(&f.env, &f.registry)
            .get_asset(&f.asset_id)
            .lifecycle,
        AssetLifecycle::Settled
    );
}

#[test]
fn fee_rounding_is_independent_of_contribution_splitting() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    funding.contribute(&f.investor_a, &50, &1, &nonce_ref(&f.env, 1));
    funding.contribute(&f.investor_b, &50, &1, &nonce_ref(&f.env, 2));
    assert_eq!(funding.pool().state.funding_fees, 1);

    let split = fixture(1_000, 0);
    let split_funding = client(&split);
    for nonce in 1..=4 {
        split_funding.contribute(
            &split.investor_a,
            &25,
            &u64::from(nonce),
            &nonce_ref(&split.env, nonce),
        );
    }
    assert_eq!(split_funding.pool().state.funding_fees, 1);
    assert_eq!(split_funding.position(&0).funding_fee_units, 1);
}

#[test]
fn full_target_wins_the_deadline_race_and_can_only_be_settled() {
    let f = fixture(2_000, 0);
    let funding = client(&f);
    funding.contribute(&f.investor_a, &TARGET, &1, &nonce_ref(&f.env, 1));
    f.env.ledger().set_timestamp(200);

    assert_call_fails(funding.try_cancel());
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), 0);
    funding.settle();
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), TARGET);
    assert_call_fails(funding.try_cancel());
}

#[test]
fn unauthenticated_contribution_does_not_move_funds_or_create_a_position() {
    let f = fixture(1_000, 0);
    f.env.mock_auths(&[]);

    assert_call_fails(client(&f).try_contribute(&f.investor_a, &100, &1, &nonce_ref(&f.env, 1)));
    assert_eq!(client(&f).pool().state.funded_principal, 0);
    assert_eq!(client(&f).pool().state.position_count, 0);
    assert!(client(&f).position_for_investor(&f.investor_a).is_none());
}

#[test]
fn topups_require_monotone_nonces_and_duplicate_or_excess_contributions_do_not_move_tokens() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    let before = balance(&f.env, &f.asset, &f.investor_a);
    funding.contribute(&f.investor_a, &200, &1, &nonce_ref(&f.env, 1));
    assert_call_fails(funding.try_contribute(&f.investor_a, &100, &1, &nonce_ref(&f.env, 3)));
    assert_call_fails(funding.try_contribute(&f.investor_a, &801, &2, &nonce_ref(&f.env, 4)));
    let topup_id = funding.contribute(&f.investor_a, &300, &2, &nonce_ref(&f.env, 5));
    let position = funding.position(&topup_id);
    assert_eq!(position.principal_units, 500);
    assert_eq!(position.contribution_count, 2);
    assert_eq!(balance(&f.env, &f.asset, &f.investor_a), before - 505);
    assert_eq!(funding.pool().state.funded_principal, 500);
}

#[test]
fn failed_sac_transfer_creates_no_position_or_units() {
    let f = fixture(1, 0);
    let funding = client(&f);
    let balance_before = balance(&f.env, &f.asset, &f.investor_a);
    assert_call_fails(funding.try_contribute(&f.investor_a, &TARGET, &1, &nonce_ref(&f.env, 9)));
    assert_eq!(balance(&f.env, &f.asset, &f.investor_a), balance_before);
    assert_eq!(funding.pool().state.funded_principal, 0);
    assert_eq!(funding.pool().state.position_count, 0);
    assert!(funding.position_for_investor(&f.investor_a).is_none());
}

#[test]
fn zero_negative_and_overflowing_contributions_leave_no_funds_or_units() {
    let f = fixture_with_target(1, 0, i128::MAX);
    let funding = client(&f);
    let balance_before = balance(&f.env, &f.asset, &f.investor_a);

    assert_call_fails(funding.try_contribute(&f.investor_a, &0, &1, &nonce_ref(&f.env, 1)));
    assert_call_fails(funding.try_contribute(&f.investor_a, &-1, &2, &nonce_ref(&f.env, 2)));
    assert_call_fails(funding.try_contribute(&f.investor_a, &i128::MAX, &3, &nonce_ref(&f.env, 3)));

    assert_eq!(balance(&f.env, &f.asset, &f.investor_a), balance_before);
    assert_eq!(funding.pool().state.funded_principal, 0);
    assert_eq!(funding.pool().state.position_count, 0);
    assert!(funding.position_for_investor(&f.investor_a).is_none());
}

#[test]
fn expiry_cancels_partial_pool_and_permissionless_refunds_return_only_to_funding_wallet() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    funding.contribute(&f.investor_a, &600, &1, &nonce_ref(&f.env, 1));
    funding.contribute(&f.investor_b, &200, &1, &nonce_ref(&f.env, 2));

    assert_call_fails(funding.try_cancel());
    f.env.ledger().set_timestamp(200);
    funding.cancel();
    assert_eq!(
        TestRegistryClient::new(&f.env, &f.registry)
            .get_asset(&f.asset_id)
            .lifecycle,
        AssetLifecycle::Cancelled
    );
    assert_eq!(balance(&f.env, &f.asset, &f.supplier), 0);

    let a_before = balance(&f.env, &f.asset, &f.investor_a);
    let b_before = balance(&f.env, &f.asset, &f.investor_b);
    assert_eq!(funding.refund_to_recorded_wallet(&0), 606);
    assert_eq!(funding.refund(&f.investor_b, &1), 202);
    assert_eq!(balance(&f.env, &f.asset, &f.investor_a), a_before + 606);
    assert_eq!(balance(&f.env, &f.asset, &f.investor_b), b_before + 202);
    assert_eq!(funding.pool().state.outstanding_principal, 0);
    assert_eq!(funding.pool().state.outstanding_fees, 0);
    assert_call_fails(funding.try_refund_to_recorded_wallet(&0));
    assert_call_fails(funding.try_settle());
}

#[test]
fn refund_batches_are_bounded_and_replay_does_not_pay_twice() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    funding.contribute(&f.investor_a, &600, &1, &nonce_ref(&f.env, 1));
    funding.contribute(&f.investor_b, &200, &1, &nonce_ref(&f.env, 2));
    f.env.ledger().set_timestamp(200);
    funding.cancel();

    assert_call_fails(funding.try_refund_batch(&0, &21));
    assert_eq!(funding.refund_batch(&0, &2), 808);
    assert_eq!(funding.refund_batch(&0, &2), 0);
    assert_eq!(funding.pool().state.outstanding_principal, 0);
}

#[test]
fn unsolicited_sac_transfers_are_excess_and_never_create_positions_or_bypass_target() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    let pool_balance_before = balance(&f.env, &f.asset, &f.pool);
    TokenClient::new(&f.env, &f.asset).transfer(&f.investor_a, &f.pool, &77);
    assert_eq!(funding.pool().state.position_count, 0);
    assert_eq!(funding.pool().state.funded_principal, 0);
    assert_call_fails(funding.try_settle());
    funding.recover_excess(&77);
    assert_eq!(balance(&f.env, &f.asset, &f.excess_recipient), 77);
    assert_eq!(balance(&f.env, &f.asset, &f.pool), pool_balance_before);
}

#[test]
fn contribution_after_deadline_is_rejected_without_changing_funding_state() {
    let f = fixture(1_000, 1_000);
    let funding = client(&f);
    f.env.ledger().set_timestamp(200);
    assert_call_fails(funding.try_contribute(&f.investor_a, &100, &1, &nonce_ref(&f.env, 1)));
    assert_eq!(funding.pool().state.position_count, 0);
    assert_eq!(funding.pool().state.funded_principal, 0);
}
