/*
# Add product detail images

1. New Columns
- `products.detail_images` (jsonb, nullable): ordered public image URLs for a product's long-form detail page. Each image is intended to be prepared at 800px wide; height is unrestricted.

2. Modified Tables
- `products`: adds the optional `detail_images` field without changing or removing any existing product information.

3. Security
- No new table or policy is introduced. Existing `products` access rules continue to govern this field.

4. Important Notes
- Existing products remain valid because the new field is nullable.
- Existing cover and gallery images are preserved separately from the new detail-page images.
*/

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS detail_images jsonb;