use super::*;
use credit_protocol::CreditRegistryClient;
use soroban_sdk::testutils::{Address as _, EnvTestConfig, Ledger as _};

fn terms(env: &Env, token: &Address, supplier: &Address) -> RegistryAssetTerms {
    RegistryAssetTerms {
        token: token.clone(),
        token_decimals: 7,
        target_principal: 1_000,
        supplier: supplier.clone(),
        fee_recipient: Address::generate(env),
        excess_recipient: Address::generate(env),
        funding_fee_bps: 100,
        fee_policy_version: 1,
        deadline: env.ledger().timestamp() + 100,
        deal_hash: BytesN::from_array(env, &[4; 32]),
        snapshot_hash: BytesN::from_array(env, &[5; 32]),
        document_root: BytesN::from_array(env, &[6; 32]),
    }
}

#[test]
fn registry_freezes_only_configured_usdc_sac_and_exposes_bounded_asset_reads() {
    let env = Env::new_with_config(EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    env.ledger().set_timestamp(100);
    let admin = Address::generate(&env);
    let supplier = Address::generate(&env);
    let issuer = Address::generate(&env);
    let usdc_sac = env.register_stellar_asset_contract_v2(issuer).address();
    let other_sac = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let registry = env.register(
        CreditRegistry,
        (
            admin.clone(),
            BytesN::from_array(&env, &[9; 32]),
            usdc_sac.clone(),
        ),
    );
    let client = CreditRegistryClient::new(&env, &registry);
    let asset_id = BytesN::from_array(&env, &[1; 32]);

    assert!(client
        .try_register_asset(&asset_id, &terms(&env, &usdc_sac, &supplier))
        .is_err());

    env.mock_all_auths();
    client.register_asset(&asset_id, &terms(&env, &usdc_sac, &supplier));
    assert_eq!(client.get_asset(&asset_id).terms.token, usdc_sac);
    assert!(client
        .try_register_asset(
            &BytesN::from_array(&env, &[2; 32]),
            &terms(&env, &other_sac, &supplier)
        )
        .is_err());
    assert!(client.try_assets(&0, &26).is_err());
    assert_eq!(client.assets(&0, &1).len(), 1);
}

#[test]
fn registry_rejects_terms_with_wrong_token_precision() {
    let env = Env::new_with_config(EnvTestConfig {
        capture_snapshot_at_drop: false,
    });
    env.ledger().set_timestamp(100);
    let admin = Address::generate(&env);
    let usdc_sac = env
        .register_stellar_asset_contract_v2(Address::generate(&env))
        .address();
    let supplier = Address::generate(&env);
    let registry = env.register(
        CreditRegistry,
        (admin, BytesN::from_array(&env, &[9; 32]), usdc_sac.clone()),
    );
    env.mock_all_auths();
    let mut invalid_terms = terms(&env, &usdc_sac, &supplier);
    invalid_terms.token_decimals = 6;

    assert!(CreditRegistryClient::new(&env, &registry)
        .try_register_asset(&BytesN::from_array(&env, &[3; 32]), &invalid_terms)
        .is_err());
}
