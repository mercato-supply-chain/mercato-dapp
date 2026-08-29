-- Add currency_code column to supplier_products and related financial tables with default 'USD' for legacy compatibility
ALTER TABLE supplier_products ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE financing_opportunities ADD COLUMN IF NOT EXISTS commercial_currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE financing_opportunities ADD COLUMN IF NOT EXISTS settlement_currency VARCHAR(3) NOT NULL DEFAULT 'USDC';
ALTER TABLE financing_opportunities ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 6);
ALTER TABLE financing_opportunities ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(64);
ALTER TABLE financing_opportunities ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ;

-- Backfill legacy records explicitly
UPDATE supplier_products SET currency_code = 'USD' WHERE currency_code IS NULL;
UPDATE purchase_orders SET currency_code = 'USD' WHERE currency_code IS NULL;
