/*
# 상품 후기 리뷰 테이블 생성

1. New Tables
- `product_reviews`
  - id (uuid PK)
  - product_id (uuid, references products, NOT NULL)
  - user_id (uuid, references auth.users, nullable — admin 가짜 후기는 null)
  - author_email (text, NOT NULL — 작성자 이메일, 가짜 후기는 관리자 입력값)
  - order_item_id (uuid, references order_items, nullable — 실제 구매 후기인 경우 연결)
  - rating (int, NOT NULL, 1~5)
  - content (text, NOT NULL, 최대 150자)
  - images (text[], nullable — 최대 3장 URL)
  - is_admin_created (boolean, default false — 관리자가 작성한 가짜 후기 여부)
  - created_at (timestamptz, default now())

2. Security
- RLS enabled
- SELECT: anon + authenticated 모두 읽기 가능 (후기는 공개 정보)
- INSERT: authenticated 사용자가 본인 후기 작성 가능 (user_id = auth.uid())
- INSERT (admin): admin 권한은 adminSupabase(service role)으로 bypass
- UPDATE/DELETE: 본인 후기만 수정/삭제 가능
*/

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_email text NOT NULL,
  order_item_id uuid REFERENCES order_items(id) ON DELETE SET NULL,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content text NOT NULL CHECK (char_length(content) <= 150),
  images text[] DEFAULT '{}',
  is_admin_created boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reviews" ON product_reviews;
CREATE POLICY "anon_select_reviews"
ON product_reviews FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "users_insert_own_reviews" ON product_reviews;
CREATE POLICY "users_insert_own_reviews"
ON product_reviews FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_update_own_reviews" ON product_reviews;
CREATE POLICY "users_update_own_reviews"
ON product_reviews FOR UPDATE
TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users_delete_own_reviews" ON product_reviews;
CREATE POLICY "users_delete_own_reviews"
ON product_reviews FOR DELETE
TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id ON product_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order_item_id ON product_reviews(order_item_id);
