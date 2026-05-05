# MERCATO Setup

Use this file as the single setup checklist for local testing.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create `.env.local`

Copy the sample file:

```bash
cp env.sample .env.local
```

Fill in the values below.

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

These come from your Supabase project dashboard.

### Trustless Work

- `NEXT_PUBLIC_TRUSTLESS_WORK_API_KEY`
- `NEXT_PUBLIC_TRUSTLESS_NETWORK=testnet`
- `NEXT_PUBLIC_MERCATO_PLATFORM_ADDRESS`
- `NEXT_PUBLIC_TRUSTLESSLINE_ADDRESS`

### Pollar

- `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY`
- `POLLAR_SECRET_KEY`
- `POLLAR_WEBHOOK_SECRET=` can stay blank for now
- `NEXT_PUBLIC_POLLAR_NETWORK=testnet`

### Optional

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- **DeFindex (Mercato vault)** — `DEFINDEX_API_KEY` (server), `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS` (vault `C…` contract), optional `DEFINDEX_API_URL`, `NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS` (default `7`)
- `ETHERFUSE_API_KEY`
- `ETHERFUSE_BASE_URL`
- `ALFREDPAY_API_KEY`
- `ALFREDPAY_API_SECRET`
- `ALFREDPAY_BASE_URL`
- `BLINDPAY_API_KEY`
- `BLINDPAY_INSTANCE_ID`
- `BLINDPAY_BASE_URL`

## 3. Bootstrap Supabase schema

If your Supabase project is empty, run the SQL files in this exact order.

### Local CLI path

Use this if you want everything local instead of the Supabase dashboard:

If `supabase` is not installed globally, use `npx supabase` for every command below.
That path requires Node.js 20 or later.

```bash
npx supabase login
npx supabase start
npx supabase status
```

Copy the local `DB URL` from `supabase status`, then run the files one by one:

```bash
export DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:54322/postgres'
```

Replace the value above with the real local DB URL from `supabase status`.

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/001_create_profiles.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/002_create_deals.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/003_create_milestones.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/004_profile_trigger.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/005_add_supplier_fields.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/006_add_escrow_fields.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/007_add_full_name.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/008_add_admin_user_type.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/009_deals_allow_investor_fund_update.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/010_milestones_allow_admin_update.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/011_latam_supplier_fields.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/012_supplier_companies_multi_company.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/013_supplier_products_select_public.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/014_create_notifications.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/015_add_yield_bonus_apr.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/016_add_deal_funding_window.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/017_add_profile_stake_signal.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260428000100_add_pollar_wallet_metadata.sql
```

### Dashboard path

If you prefer the browser:

1. Open your project.
2. Click `SQL Editor`.
3. Click `New query`.
4. Paste one file at a time.
5. Run each file in sequence.

If you run `012_supplier_companies_multi_company.sql` by itself, it can fail because it expects the earlier tables from `001`, `002`, `003`, `004`, `005`, `006`, `007`, `008`, `009`, `010`, and `011` to already exist.

If the schema already exists in a real project, only apply the last migration if needed.

## 4. Start the app

```bash
pnpm dev
```

Open `http://localhost:3000`.

## 5. Test the wallet flows

### Existing Stellar Wallets Kit path

1. Open the app.
2. Connect Freighter or Albedo from the nav.
3. Confirm the wallet address appears in the dashboard/settings wallet card.
4. Try the normal deal or escrow flow.
5. Success means the wallet address matches the connected wallet and no Pollar UI is shown.

### Pollar path

1. Choose `Continue with Pollar Embedded Wallet`.
2. Sign in with Pollar.
3. Confirm the wallet address appears.
4. Confirm the wallet metadata saves to Supabase.
5. Confirm balances and wallet status render in the wallet card.
6. Success means the wallet provider shows as `pollar` and the wallet status is `pending` or `active`.

### Activation path

If the Pollar wallet is `pending`:

1. Use the `Activate embedded wallet` action if shown.
2. Or call `POST /api/pollar/activate` with the wallet ID from the session.
3. Success means the wallet status changes to `active` and the balance card updates after refresh.

## 6. What to verify

- Navbar wallet state works.
- Dashboard wallet state works.
- Settings wallet state works.
- External wallet signing still works.
- Pollar onboarding works.
- Pollar metadata is stored in Supabase.
- Trustless Work escrow signing still uses the external wallet path.
- If you use a Pollar wallet in a Trustless Work flow, the app should show the limitation message instead of trying to sign with the embedded wallet.

## 7. Common problems

- `relation "public.profiles" does not exist`
  - The base schema has not been applied yet. Run the SQL files starting with `scripts/001_create_profiles.sql`.
- Blank wallet buttons
  - Check the required env vars in `.env.local`.
- Pollar activation fails
  - Confirm `POLLAR_SECRET_KEY` is set server-side only.

