/*
# Fix: Allow admin to insert product reviews with user_id = null

## Problem
The only INSERT policy on `product_reviews` is `users_insert_own_reviews`
which requires `auth.uid() = user_id`. Admin-created (fake) reviews insert
with `user_id = null`, so `auth.uid() = null` is always false — the insert
fails with "new row violates row-level security policy".

## Fix
- Add `admin_insert_reviews` INSERT policy: allows authenticated users with
  `role = 'admin'` in profiles to insert rows where `is_admin_created = true`
  and `user_id IS NULL`.
- Add `admin_delete_reviews` DELETE policy: allows admin to delete any review.
- The existing `users_insert_own_reviews` policy still handles buyer reviews.
*/

DROP POLICY IF EXISTS "admin_insert_reviews" ON product_reviews;
CREATE POLICY "admin_insert_reviews"
ON product_reviews FOR INSERT
TO authenticated
WITH CHECK (
  is_admin_created = true
  AND user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "admin_delete_reviews" ON product_reviews;
CREATE POLICY "admin_delete_reviews"
ON product_reviews FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
