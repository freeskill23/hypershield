/*
# Add category_ids array column to products table

## Changes
1. Adds `category_ids` (uuid[], nullable) to the `products` table.
   - Stores an array of category UUIDs so a product can belong to multiple categories.
   - The existing `category_id` (single uuid) and `category` (text name) columns are kept for backward compatibility — they will be set to the first selected category.

## Notes
- No RLS changes needed — the column inherits existing policies.
- Existing products will have NULL category_ids, meaning they use the old single category_id field.
- The admin UI and shop filtering will check category_ids first, falling back to category_id.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS category_ids uuid[];
