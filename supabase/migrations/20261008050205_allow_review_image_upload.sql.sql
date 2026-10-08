/*
# Allow authenticated users to upload review images

## Problem
The `product-images` storage bucket only has an INSERT policy for admin users (`product_images_upload_admin`).
Regular authenticated buyers cannot upload photos when writing product reviews, so the review image upload fails.

## Changes
- Adds a new INSERT policy `product_images_upload_reviews` on `storage.objects` that allows any authenticated user
  to upload files ONLY to the `reviews/` folder within the `product-images` bucket.
- This does NOT change the existing admin-only upload policy for other folders — non-admin users still cannot
  upload product images outside the `reviews/` path.
- The existing `product_images_read` SELECT policy already allows all authenticated users to read from the bucket,
  so review photos will be visible to all logged-in users.
- Also adds a DELETE policy so users can remove their own review images if needed.

## Security
- INSERT: scoped to `bucket_id = 'product-images'` AND path starts with `reviews/` — buyers can only upload review photos, not product images.
- DELETE: scoped to `bucket_id = 'product-images'` AND path starts with `reviews/` AND owner matches `auth.uid()`.
*/

-- Allow any authenticated user to upload to reviews/ folder in product-images bucket
DROP POLICY IF EXISTS "product_images_upload_reviews" ON storage.objects;
CREATE POLICY "product_images_upload_reviews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'reviews'
);

-- Allow users to delete their own review images
DROP POLICY IF EXISTS "product_images_delete_reviews_own" ON storage.objects;
CREATE POLICY "product_images_delete_reviews_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = 'reviews'
  AND owner = auth.uid()
);
