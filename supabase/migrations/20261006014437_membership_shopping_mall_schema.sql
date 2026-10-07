/*
# Hypershield Membership Shopping Mall Schema

## Overview
Replaces the group buying platform with a membership-based shopping mall.
Core concept: "Online Ad Boycott" — members pay a monthly subscription fee
to access products at 50%+ off regular prices. The subscription fee funds
better product development instead of ad spending.

## New Tables
### subscription_plans — membership tiers with monthly fee and discount rate
### posts — "하이퍼쉴드의 생각" board with public/members visibility
### cart_items — shopping cart scoped per user

## Modified Tables
### profiles — subscription columns added
### products — category_id, is_active, sort_order, sub_images, sku added
### categories, orders, order_items, addresses — RLS policies updated

## Security
- subscription_plans: anon+authenticated SELECT; admin writes
- posts: public posts visible to anon+authenticated; members posts to authenticated; admin writes
- products: authenticated-only SELECT; admin writes
- categories: anon+authenticated SELECT; admin writes
- cart_items: own user CRUD
- orders: own SELECT/INSERT; admin UPDATE/DELETE
- order_items: SELECT through own orders; admin writes
- addresses: own user CRUD
*/

-- ============================================================
-- 1. subscription_plans table (MUST come before profiles FK)
-- ============================================================

CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price integer NOT NULL DEFAULT 0,
  tier text UNIQUE NOT NULL,
  discount_rate integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_subscription_plans" ON subscription_plans;
CREATE POLICY "select_subscription_plans" ON subscription_plans FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_subscription_plans_admin" ON subscription_plans;
CREATE POLICY "insert_subscription_plans_admin" ON subscription_plans FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_subscription_plans_admin" ON subscription_plans;
CREATE POLICY "update_subscription_plans_admin" ON subscription_plans FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_subscription_plans_admin" ON subscription_plans;
CREATE POLICY "delete_subscription_plans_admin" ON subscription_plans FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 2. Add subscription columns to profiles
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_plan_id') THEN
    ALTER TABLE profiles ADD COLUMN subscription_plan_id uuid REFERENCES subscription_plans(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_tier') THEN
    ALTER TABLE profiles ADD COLUMN subscription_tier text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_status') THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text NOT NULL DEFAULT 'none';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_expires_at') THEN
    ALTER TABLE profiles ADD COLUMN subscription_expires_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'subscription_started_at') THEN
    ALTER TABLE profiles ADD COLUMN subscription_started_at timestamptz;
  END IF;
END $$;

-- ============================================================
-- 3. Add columns to products
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'category_id') THEN
    ALTER TABLE products ADD COLUMN category_id uuid REFERENCES categories(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_active') THEN
    ALTER TABLE products ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sort_order') THEN
    ALTER TABLE products ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sub_images') THEN
    ALTER TABLE products ADD COLUMN sub_images text[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'sku') THEN
    ALTER TABLE products ADD COLUMN sku text;
  END IF;
END $$;

-- ============================================================
-- 4. posts table (하이퍼쉴드의 생각)
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  excerpt text,
  category text,
  visibility text NOT NULL DEFAULT 'members',
  is_pinned boolean NOT NULL DEFAULT false,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_public_posts" ON posts;
CREATE POLICY "select_public_posts" ON posts FOR SELECT
  TO anon, authenticated USING (visibility = 'public');

DROP POLICY IF EXISTS "select_members_posts" ON posts;
CREATE POLICY "select_members_posts" ON posts FOR SELECT
  TO authenticated USING (visibility = 'members');

DROP POLICY IF EXISTS "insert_posts_admin" ON posts;
CREATE POLICY "insert_posts_admin" ON posts FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_posts_admin" ON posts;
CREATE POLICY "update_posts_admin" ON posts FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_posts_admin" ON posts;
CREATE POLICY "delete_posts_admin" ON posts FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 5. cart_items table
-- ============================================================

CREATE TABLE IF NOT EXISTS cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_cart" ON cart_items;
CREATE POLICY "select_own_cart" ON cart_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cart" ON cart_items;
CREATE POLICY "insert_own_cart" ON cart_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cart" ON cart_items;
CREATE POLICY "update_own_cart" ON cart_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cart" ON cart_items;
CREATE POLICY "delete_own_cart" ON cart_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 6. Products RLS (authenticated-only SELECT, admin writes)
-- ============================================================

DROP POLICY IF EXISTS "select_products" ON products;
DROP POLICY IF EXISTS "select_products_authenticated" ON products;

DROP POLICY IF EXISTS "select_products_members" ON products;
CREATE POLICY "select_products_members" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_products_admin" ON products;
CREATE POLICY "insert_products_admin" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_products_admin" ON products;
CREATE POLICY "update_products_admin" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_products_admin" ON products;
CREATE POLICY "delete_products_admin" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 7. Categories RLS
-- ============================================================

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_categories" ON categories;
CREATE POLICY "select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_categories_admin" ON categories;
CREATE POLICY "insert_categories_admin" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_categories_admin" ON categories;
CREATE POLICY "update_categories_admin" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_categories_admin" ON categories;
CREATE POLICY "delete_categories_admin" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 8. Orders RLS
-- ============================================================

DROP POLICY IF EXISTS "select_own_orders" ON orders;
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
DROP POLICY IF EXISTS "update_orders_admin" ON orders;
DROP POLICY IF EXISTS "delete_orders_admin" ON orders;

DROP POLICY IF EXISTS "select_own_orders_v2" ON orders;
CREATE POLICY "select_own_orders_v2" ON orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders_v2" ON orders;
CREATE POLICY "insert_own_orders_v2" ON orders FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_orders_admin_v2" ON orders;
CREATE POLICY "update_orders_admin_v2" ON orders FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_orders_admin_v2" ON orders;
CREATE POLICY "delete_orders_admin_v2" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 9. Order items RLS
-- ============================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_order_items_admin" ON order_items;
CREATE POLICY "insert_order_items_admin" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_order_items_admin" ON order_items;
CREATE POLICY "update_order_items_admin" ON order_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_order_items_admin" ON order_items;
CREATE POLICY "delete_order_items_admin" ON order_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- 10. Addresses RLS
-- ============================================================

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_addresses" ON addresses;
CREATE POLICY "select_own_addresses" ON addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_addresses" ON addresses;
CREATE POLICY "insert_own_addresses" ON addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_addresses" ON addresses;
CREATE POLICY "update_own_addresses" ON addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_addresses" ON addresses;
CREATE POLICY "delete_own_addresses" ON addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 11. Update handle_new_user trigger
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member',
    'none'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
SET search_path = public;

-- ============================================================
-- 12. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_posts_visibility ON posts(visibility);
CREATE INDEX IF NOT EXISTS idx_posts_pinned ON posts(is_pinned);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sort ON products(sort_order);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

-- ============================================================
-- 13. Seed default subscription plans
-- ============================================================

INSERT INTO subscription_plans (name, description, monthly_price, tier, discount_rate, sort_order)
SELECT '스탠다드', '기본 멤버십 — 모든 제품 50% 할인', 9900, 'standard', 50, 0
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE tier = 'standard');

INSERT INTO subscription_plans (name, description, monthly_price, tier, discount_rate, sort_order)
SELECT '프리미엄', '프리미엄 멤버십 — 모든 제품 60% 할인 + 우선 배송', 19900, 'premium', 60, 1
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE tier = 'premium');
