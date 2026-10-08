/*
# Add selected_options column to cart_items

1. Modified Tables
- `cart_items`: add `selected_options` (jsonb, nullable) to store the buyer's option choices
  - Format: array of { name: string, value: string, price_addition: number } objects
  - NULL means the product has no options or no options were selected
2. Schema Changes
- Drop the UNIQUE(user_id, product_id) constraint so the same product can be in the cart
  with different option combinations as separate rows
3. Security
- No RLS policy changes; existing cart ownership policies already cover the new column
*/

ALTER TABLE cart_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb;

ALTER TABLE cart_items
  DROP CONSTRAINT IF EXISTS cart_items_user_id_product_id_key;
