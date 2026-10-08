/*
# Fix review image upload RLS policy

## Problem
The previous policy used `storage.foldername(name)[1] = 'reviews'` which may not match correctly
for the upload path format `reviews/timestamp-random.ext`. Users get
"new row violates row-level security policy" when uploading review photos.

## Fix
- Drop the old `product_images_upload_reviews` INSERT policy and replace with one using
  a simple `name LIKE 'reviews/%'` path check — more reliable than the foldername function.
- Same fix applied to the DELETE policy.
*/

DROP POLICY IF EXISTS "product_images_upload_reviews" ON storage.objects;
CREATE POLICY "product_images_upload_reviews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND name LIKE 'reviews/%'
);

DROP POLICY IF EXISTS "product_images_delete_reviews_own" ON storage.objects;
CREATE POLICY "product_images_delete_reviews_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND name LIKE 'reviews/%'
  AND owner = auth.uid()
);
