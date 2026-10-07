/*
# Add shipping settings and product shipping columns

1. Changes
- Adds `use_default_shipping` (boolean, default true) to `products` — whether the product uses the global default shipping settings.
- Adds `shipping_fee` (integer, nullable) to `products` — custom shipping fee when use_default_shipping is false.
- Adds `shipping_type` (text, default 'prepaid') to `products` — 'prepaid' (선불) or 'collect' (착불) or 'default'.
- Inserts default shipping settings into `settings` table:
  - `shipping_default_fee`: default shipping fee (3000)
  - `shipping_free_threshold`: order amount above which shipping is free (50000)
  - `shipping_jeju_fee`: surcharge for Jeju (3000)
  - `shipping_island_fee`: surcharge for island/mountain areas (5000)
  - `shipping_default_carrier`: default carrier name (CJ대한통운)
  - `shipping_default_type`: default shipping payment type (prepaid)
2. Security
- No RLS changes needed; existing policies on products and settings already govern access.
3. Notes
- All new columns are nullable or have defaults so existing products remain valid.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS use_default_shipping boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_fee integer;
ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping_type text NOT NULL DEFAULT 'default';

INSERT INTO settings (key, value, updated_at) VALUES
  ('shipping_default_fee', '3000', now()),
  ('shipping_free_threshold', '50000', now()),
  ('shipping_jeju_fee', '3000', now()),
  ('shipping_island_fee', '5000', now()),
  ('shipping_default_carrier', 'CJ대한통운', now()),
  ('shipping_default_type', 'prepaid', now())
ON CONFLICT (key) DO NOTHING;
