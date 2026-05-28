-- Alter supplier_products table if it exists
ALTER TABLE IF EXISTS public.supplier_products
  ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- Create products bucket in Supabase storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public select access to the products bucket
CREATE POLICY "Public Read Access"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'products' );

-- Allow suppliers to insert files under their own folder segment: products/{user_id}/...
CREATE POLICY "Insert own product images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'products'
    AND (auth.uid())::text = split_part(name, '/', 1)
  );

-- Allow suppliers to update files under their own folder segment
CREATE POLICY "Update own product images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'products'
    AND (auth.uid())::text = split_part(name, '/', 1)
  );

-- Allow suppliers to delete files under their own folder segment
CREATE POLICY "Delete own product images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'products'
    AND (auth.uid())::text = split_part(name, '/', 1)
  );
