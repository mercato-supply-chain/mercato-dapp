DO $$ BEGIN
    CREATE TYPE product_status AS ENUM ('active', 'paused', 'discontinued');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.supplier_products
ADD COLUMN IF NOT EXISTS status product_status NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS supplier_products_supplier_id_status_category_idx 
ON public.supplier_products(supplier_id, status, category);
