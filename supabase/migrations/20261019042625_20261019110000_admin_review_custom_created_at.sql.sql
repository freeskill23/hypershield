/*
# 관리자 후기 작성 시 작성일 임의 지정 기능

## 목적
관리자가 상품 후기를 작성할 때 날짜를 임의로 지정할 수 있도록 기존
`admin_create_product_review` 함수에 선택적 `p_created_at` 매개변수를 추가.

## 변경 사항
- `admin_create_product_review` 함수의 시그니처에
  `p_created_at timestamptz DEFAULT NULL` 매개변수 추가.
- 값이 전달되면 해당 날짜로 `created_at`을 저장, 전달되지 않으면 기본값(now()) 사용.
- 보안: caller 가 admin 인지 확인하는 로직은 그대로 유지.
- 기존 호출 코드(매개변수 5개)와의 호환성을 위해 DROP FUNCTION 후 재생성.

## 보안
- 기존과 동일하게 admin 프로필을 가진 인증 사용자만 호출 가능.
- anon 역할은 실행 권한 없음.
*/

DROP FUNCTION IF EXISTS public.admin_create_product_review(uuid, text, integer, text, text[]);

CREATE OR REPLACE FUNCTION public.admin_create_product_review(
  p_product_id uuid,
  p_author_email text,
  p_rating integer,
  p_content text,
  p_images text[] DEFAULT '{}',
  p_created_at timestamptz DEFAULT NULL
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
    is_admin_created,
    created_at
  ) VALUES (
    p_product_id,
    NULL,
    btrim(p_author_email),
    NULL,
    p_rating,
    btrim(p_content),
    coalesce(p_images, '{}'),
    true,
    coalesce(p_created_at, now())
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_product_review(uuid, text, integer, text, text[], timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_create_product_review(uuid, text, integer, text, text[], timestamptz) TO authenticated;
