-- Add logo_url column to supplier_companies
ALTER TABLE supplier_companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
