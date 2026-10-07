/*
# Add detail_link column to products table

## Changes
1. Adds `detail_link` (text, nullable) to the `products` table.
   - Stores an external URL (e.g. Naver Smart Store product page) where customers
     can view the original product listing, reviews, and more details.
2. No RLS changes needed — the column inherits existing policies.

## Notes
- Nullable: existing products will have NULL, which is fine (no link shown).
- The admin form will set this when creating/editing products.
- The product detail page will show a "상품 정보 자세히 보기" button that opens in a new tab.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS detail_link text;
