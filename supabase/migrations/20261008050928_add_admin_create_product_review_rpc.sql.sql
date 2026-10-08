/*
# Secure admin product review creation

## Purpose
Move administrator-created review insertion into a server-enforced function.

## Changes
- Adds `admin_create_product_review`, which creates a review only when the
  authenticated caller's profile has role `admin`.
- The function always writes `is_admin_created = true` and `user_id = NULL`.
- Validates the product, email, rating, content length, and image count.
- Grants execution only to authenticated users and denies anonymous callers.

## Security
The browser cannot choose the author identity or bypass the administrator
check because those values are controlled inside the SECURITY DEFINER function.
*/

CREATE OR REPLACE FUNCTION public.admin_create_product_review(
  p_product_id uuid,
  p_author_email text,
  p_rating integer,
  p_content text,
  p_images text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_review_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id) THEN
    RAISE EXCEPTION 'Invalid product';
  END IF;

  IF p_author_email IS NULL OR btrim(p_author_email) = '' THEN
    RAISE EXCEPTION 'Invalid author email';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' OR char_length(p_content) > 150 THEN
    RAISE EXCEPTION 'Invalid review content';
  END IF;

  IF coalesce(cardinality(p_images), 0) > 3 THEN
    RAISE EXCEPTION 'Too many review images';
  END IF;

  INSERT INTO public.product_reviews (
    product_id,
    user_id,
    author_email,
    order_item_id,
    rating,
    content,
    images,
    is_admin_created
  ) VALUES (
    p_product_id,
    NULL,
    btrim(p_author_email),
    NULL,
    p_rating,
    btrim(p_content),
    coalesce(p_images, '{}'),
    true
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_product_review(uuid, text, integer, text, text[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_product_review(uuid, text, integer, text, text[]) TO authenticated;
