/*
# Add product options column to products table

1. Changes
- Adds `options` column (JSONB, nullable) to `products` table.
- Stores an array of option objects, each with:
  - `name`: option name (e.g. "색상", "사이즈")
  - `values`: array of { label, price_addition } objects
    - `label`: the option value label (e.g. "블랙", "L")
    - `price_addition`: additional price in KRW for this option value (integer, can be 0 or negative)
- Example: [{"name": "색상", "values": [{"label": "블랙", "price_addition": 0}, {"label": "화이트", "price_addition": 2000}]}, {"name": "사이즈", "values": [{"label": "M", "price_addition": 0}, {"label": "L", "price_addition": 3000}]}]
2. Security
- No RLS changes needed; existing policies on products already govern access.
3. Notes
- The column is nullable so existing products without options remain valid.
- Default value is NULL (no options).
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS options JSONB;
