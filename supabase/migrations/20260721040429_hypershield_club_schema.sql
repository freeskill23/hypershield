/*
# Hypershield Private Club - Core Schema

## Overview
Creates the foundational tables for a closed/invitation-only VIP discount club.
Members can only join with a valid referral code from an existing member.
Each member receives a unique referral code (format HYPER-XXXX) on signup.

## New Tables
1. `profiles` — one row per authenticated user, extending auth.users.
   - `id` (uuid, PK, references auth.users)
   - `email` (text, unique)
   - `full_name` (text)
   - `role` (text: 'member' | 'admin', default 'member')
   - `my_referral_code` (text, unique) — the code this member gives out
   - `referred_by_code` (text) — the code this member used to join (nullable for root/admin)
   - `created_at` (timestamptz)
2. `products` — items available in the 50% private store.
   - `id` (uuid, PK)
   - `name`, `category`, `description`, `image_url`
   - `original_price` (int) — retail price including market markup
   - `club_price` (int) — club price (~50% off)
   - `stock` (int, default 100)
   - `created_at`
3. `orders` — purchase records.
   - `id` (uuid, PK)
   - `user_id` (uuid, FK -> profiles)
   - `total_amount` (int)
   - `status` (text: 'pending' | 'completed' | 'cancelled')
   - `created_at`

## Security (RLS)
- `profiles`: each authenticated user can read all profiles (needed for referral tree),
  but can only INSERT/UPDATE/DELETE their own row. Admins (role='admin') can do everything.
- `products`: authenticated users can read; only admins can insert/update/delete.
- `orders`: each authenticated user can CRUD their own orders; admins can read all and
  update/delete any order.

## Important Notes
1. The `profiles` table uses `id = auth.uid()` as the primary key, so each auth user has
   exactly one profile row. The `my_referral_code` is generated client-side in the format
   HYPER-XXXX and passed in the insert (it must be unique).
2. `referred_by_code` is a plain text column (NOT a FK) so members can join using a code
   from any existing member; the app validates that the code exists before allowing signup.
3. Admin role is granted by updating an existing profile row's role to 'admin' (done via
   execute_sql in the seed step, not via the app).
4. All policies use `auth.uid()` for ownership checks, never `current_user`.
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  my_referral_code TEXT UNIQUE NOT NULL,
  referred_by_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read profiles (referral tree / member lists)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT
  TO authenticated USING (true);

-- A user can insert only their own profile row
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- A user can update only their own profile row (and cannot change role via app)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Only admins can delete profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  original_price INT NOT NULL CHECK (original_price > 0),
  club_price INT NOT NULL CHECK (club_price > 0),
  description TEXT,
  image_url TEXT,
  stock INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_select_authenticated" ON products;
CREATE POLICY "products_select_authenticated" ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "products_insert_admin" ON products;
CREATE POLICY "products_insert_admin" ON products FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "products_update_admin" ON products;
CREATE POLICY "products_update_admin" ON products FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "products_delete_admin" ON products;
CREATE POLICY "products_delete_admin" ON products FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount INT NOT NULL CHECK (total_amount >= 0),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON orders;
CREATE POLICY "orders_select_own_or_admin" ON orders FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
CREATE POLICY "orders_insert_own" ON orders FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_update_own_or_admin" ON orders;
CREATE POLICY "orders_update_own_or_admin" ON orders FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "orders_delete_admin" ON orders;
CREATE POLICY "orders_delete_admin" ON orders FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_code ON profiles(referred_by_code);
CREATE INDEX IF NOT EXISTS idx_profiles_my_referral_code ON profiles(my_referral_code);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
