/*
# Hypershield Club — E-Commerce & Referral Workflow Overhaul

## Overview
Transforms the club from a simple demo store into a full e-commerce flow with:
- Admin-managed product categories
- Referral code request/approval workflow (codes no longer auto-generated)
- Saved delivery addresses (multiple per user)
- Order items (line items per order)
- Full order lifecycle: pending → shipping_ready → shipping → delivered
- Carrier + tracking number management on orders
- Product image storage bucket

## New Tables
1. `categories` — admin-managed product categories (name, sort_order)
2. `referral_requests` — members apply for a referral code with a reason; admin approves
3. `addresses` — saved delivery addresses per user (label, recipient, phone, address)
4. `order_items` — line items for each order (product snapshot, qty, unit price)

## Modified Tables
- `profiles`: `my_referral_code` is now nullable (NULL until admin approves a request)
- `orders`: added address snapshot, carrier, tracking_number, shipped_at columns;
  status enum expanded to pending/shipping_ready/shipping/delivered/cancelled;
  default changed from 'completed' to 'pending'
- `handle_new_user()` trigger: no longer auto-generates a referral code

## New RPCs
- `approve_referral_request(request_id)`: generates a unique HYPER-XXXX code, assigns it
  to the requesting member, and marks the request as approved. Admin-only.

## Security (RLS)
- `categories`: all authenticated can read; admin-only insert/update/delete
- `referral_requests`: users can read/insert their own; admin can read all and update any
- `addresses`: users can CRUD their own addresses; admin can read all
- `order_items`: users can read their own (via order ownership); admin can read all
- `storage.objects` in `product-images` bucket: authenticated can read; admin can upload

## Important Notes
1. `my_referral_code` becoming nullable means new members have NO referral code
   until they request one and an admin approves. The existing member keeps their code.
2. The signup flow still requires a valid referral code (from an existing approved member
   or the HYPER-ROOT bootstrap code) — that validation is unchanged.
3. Existing orders with status 'completed' are migrated to 'pending'.
4. Product images are stored in the `product-images` Supabase Storage bucket (public read).
*/

-- ============================================================
-- 1. categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_authenticated" ON categories;
CREATE POLICY "categories_select_authenticated" ON categories FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 2. referral_requests
-- ============================================================
CREATE TABLE IF NOT EXISTS referral_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  assigned_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

ALTER TABLE referral_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "refreq_select_own_or_admin" ON referral_requests;
CREATE POLICY "refreq_select_own_or_admin" ON referral_requests FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "refreq_insert_own" ON referral_requests;
CREATE POLICY "refreq_insert_own" ON referral_requests FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "refreq_update_admin" ON referral_requests;
CREATE POLICY "refreq_update_admin" ON referral_requests FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 3. addresses
-- ============================================================
CREATE TABLE IF NOT EXISTS addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '기본 배송지',
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  address_detail TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addr_select_own_or_admin" ON addresses;
CREATE POLICY "addr_select_own_or_admin" ON addresses FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "addr_insert_own" ON addresses;
CREATE POLICY "addr_insert_own" ON addresses FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "addr_update_own" ON addresses;
CREATE POLICY "addr_update_own" ON addresses FOR UPDATE
  TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "addr_delete_own" ON addresses;
CREATE POLICY "addr_delete_own" ON addresses FOR DELETE
  TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- 4. order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price INT NOT NULL CHECK (unit_price >= 0),
  original_price INT NOT NULL CHECK (original_price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON order_items;
CREATE POLICY "order_items_select_own_or_admin" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;
CREATE POLICY "order_items_insert_own" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

-- ============================================================
-- 5. Alter profiles: make my_referral_code nullable
-- ============================================================
ALTER TABLE profiles ALTER COLUMN my_referral_code DROP NOT NULL;

-- ============================================================
-- 6. Update handle_new_user: no longer auto-generates referral code
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  full_name TEXT;
  ref_code TEXT;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '신규 회원');
  ref_code := COALESCE(NEW.raw_user_meta_data->>'referral_code', '');

  INSERT INTO public.profiles (id, email, full_name, role, my_referral_code, referred_by_code)
  VALUES (
    NEW.id,
    NEW.email,
    full_name,
    'member',
    NULL,
    NULLIF(upper(ref_code), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- ============================================================
-- 7. approve_referral_request RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_referral_request(request_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  req RECORD;
  new_code TEXT;
  requester_id UUID;
BEGIN
  -- Verify caller is admin
  SELECT id INTO requester_id FROM profiles WHERE id = auth.uid() AND role = 'admin';
  IF NOT FOUND THEN
    RAISE EXCEPTION '관리자 권한이 필요합니다.';
  END IF;

  SELECT * INTO req FROM referral_requests WHERE id = request_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION '신청 건을 찾을 수 없거나 이미 처리되었습니다.';
  END IF;

  -- Generate unique HYPER-XXXX code
  new_code := 'HYPER-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4);
  FOR i IN 1..10 LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE my_referral_code = new_code);
    new_code := 'HYPER-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4);
  END LOOP;

  -- Assign code to the member's profile
  UPDATE profiles SET my_referral_code = upper(new_code) WHERE id = req.user_id;

  -- Mark request as approved
  UPDATE referral_requests
    SET status = 'approved', assigned_code = upper(new_code), approved_at = NOW()
    WHERE id = request_id;

  RETURN upper(new_code);
END;
$$;

-- ============================================================
-- 8. Alter orders: new columns + expanded status
-- ============================================================
DO $$
BEGIN
  -- Add address snapshot columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'recipient_name') THEN
    ALTER TABLE orders ADD COLUMN recipient_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'recipient_phone') THEN
    ALTER TABLE orders ADD COLUMN recipient_phone TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'address') THEN
    ALTER TABLE orders ADD COLUMN address TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'address_detail') THEN
    ALTER TABLE orders ADD COLUMN address_detail TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'carrier') THEN
    ALTER TABLE orders ADD COLUMN carrier TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
    ALTER TABLE orders ADD COLUMN tracking_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_at') THEN
    ALTER TABLE orders ADD COLUMN shipped_at TIMESTAMPTZ;
  END IF;
END $$;

-- Drop old status check and add expanded one
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_check' AND conrelid = 'orders'::regclass) THEN
    ALTER TABLE orders DROP CONSTRAINT orders_status_check;
  END IF;
END $$;

ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'shipping_ready', 'shipping', 'delivered', 'cancelled'));

ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'pending';

-- Migrate old 'completed' orders to 'pending'
UPDATE orders SET status = 'pending' WHERE status = 'completed';

-- ============================================================
-- 9. Storage bucket for product images
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product_images_read" ON storage.objects;
CREATE POLICY "product_images_read" ON storage.objects FOR SELECT
  TO authenticated USING (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product_images_upload_admin" ON storage.objects;
CREATE POLICY "product_images_upload_admin" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "product_images_update_admin" ON storage.objects;
CREATE POLICY "product_images_update_admin" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "product_images_delete_admin" ON storage.objects;
CREATE POLICY "product_images_delete_admin" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'product-images'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 10. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_referral_requests_user_id ON referral_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_requests_status ON referral_requests(status);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);

-- ============================================================
-- 11. Seed default categories
-- ============================================================
INSERT INTO categories (name, sort_order) VALUES
  ('케미컬', 1),
  ('타월', 2),
  ('코팅', 3),
  ('소모품', 4)
ON CONFLICT (name) DO NOTHING;
