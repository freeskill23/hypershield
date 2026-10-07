/*
# Add visible_grades column to categories table

## Changes
1. Adds `visible_grades` (text[], nullable) to the `categories` table.
   - Stores an array of subscription tier strings (e.g. ['standard', 'premium', 'vip']).
   - When NULL, the category is visible to all members regardless of grade.
   - When set, only members whose `subscription_tier` is in the array can see the category.

## Notes
- No RLS changes needed — the column inherits existing policies.
- Existing categories will have NULL, meaning they remain visible to everyone (backward compatible).
- The admin UI will show a multi-checkbox selector for the three grades.
*/

ALTER TABLE categories ADD COLUMN IF NOT EXISTS visible_grades text[];
