Legacy SQL files were migrated into `supabase/migrations/` so Supabase CLI is now the only supported schema workflow.

Archived mapping:

- `001_create_profiles.sql` -> `supabase/migrations/20260427000100_create_profiles.sql`
- `002_create_deals.sql` -> `supabase/migrations/20260427000200_create_deals.sql`
- `003_create_milestones.sql` -> `supabase/migrations/20260427000300_create_milestones.sql`
- `004_profile_trigger.sql` -> `supabase/migrations/20260427000400_profile_trigger.sql`
- `005_add_supplier_fields.sql` -> `supabase/migrations/20260427000500_add_supplier_fields.sql`
- `006_add_escrow_fields.sql` -> `supabase/migrations/20260427000600_add_escrow_fields.sql`
- `007_add_full_name.sql` -> `supabase/migrations/20260427000700_add_full_name.sql`
- `008_add_admin_user_type.sql` -> `supabase/migrations/20260427000800_add_admin_user_type.sql`
- `009_deals_allow_investor_fund_update.sql` -> `supabase/migrations/20260427000900_deals_allow_investor_fund_update.sql`
- `010_milestones_allow_admin_update.sql` -> `supabase/migrations/20260427001000_milestones_allow_admin_update.sql`
- `011_latam_supplier_fields.sql` -> `supabase/migrations/20260427001100_latam_supplier_fields.sql`
- `012_supplier_companies_multi_company.sql` -> `supabase/migrations/20260427001200_supplier_companies_multi_company.sql`
- `013_supplier_products_select_public.sql` -> `supabase/migrations/20260427001300_supplier_products_select_public.sql`
- `014_create_notifications.sql` -> `supabase/migrations/20260427001400_create_notifications.sql`
- `015_add_yield_bonus_apr.sql` -> `supabase/migrations/20260427001500_add_yield_bonus_apr.sql`
- `016_add_deal_funding_window.sql` -> `supabase/migrations/20260427001600_add_deal_funding_window.sql`
- `017_add_profile_stake_signal.sql` is already captured by `supabase/migrations/20260519000100_add_profile_stake_signal.sql`
- `017_supplier_product_inventory.sql` is already captured by `supabase/migrations/20260603100000_supplier_product_inventory.sql`
- `018_create_reputations.sql` -> `supabase/migrations/20260427001700_create_reputations.sql`
- `seed_reputations.sql` was a one-off seed helper and was removed from the supported migration workflow
