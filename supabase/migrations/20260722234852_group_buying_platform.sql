/*
# Group Buying Platform Schema

## Overview
Replaces the private club referral system with an open-signup group buying platform.
Users can freely sign up (no referral code needed). Admins create group buy campaigns
with a target participant count and deadline. Users join group buys, and when the
deadline passes, the result is shown on the main page with bank account info for
account-transfer payment. Users then submit their shipping address.

## New Tables

### group_buys
- id (uuid, PK)
- title (text) — product/campaign name
- description (text, nullable) — product details
- image_url (text, nullable) — product image
- original_price (integer) — regular retail price
- group_price (integer) — group buy discounted price
- target_count (integer) — minimum participants needed
- current_count (integer, default 0) — joined participants (denormalized)
- deadline (timestamptz) — when the group buy ends
- status (text, default 'recruiting') — recruiting | succeeded | failed | cancelled
- bank_account (text, nullable) — bank account number for deposit
- bank_holder (text, nullable) — bank account holder name
- created_at (timestamptz)

### participants
- id (uuid, PK)
- group_buy_id (uuid, FK → group_buys)
- user_id (uuid, FK → auth.users)
- status (text, default 'joined') — joined | deposited | address_submitted | shipped | cancelled
- recipient_name, recipient_phone, address, address_detail (text, nullable) — shipping info
- deposit_confirmed_at (timestamptz, nullable)
- created_at (timestamptz)

## Security
- group_buys: SELECT for all authenticated; INSERT/UPDATE/DELETE admin-only
- participants: SELECT for all authenticated; INSERT self-only; UPDATE self-or-admin; DELETE admin-only
- profiles: phone column added for contact info

## Important Notes
1. Profiles table already exists — we only add a phone column
2. handle_new_user trigger remains but referral_code metadata is now optional
3. current_count on group_buys is maintained via trigger on participants insert/delete
*/

-- Add phone column to profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;

-- ============================================================
-- group_buys table
-- ============================================================

CREATE TABLE IF NOT EXISTS group_buys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  original_price integer NOT NULL DEFAULT 0,
  group_price integer NOT NULL DEFAULT 0,
  target_count integer NOT NULL DEFAULT 1,
  current_count integer NOT NULL DEFAULT 0,
  deadline timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'recruiting',
  bank_account text,
  bank_holder text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE group_buys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_group_buys" ON group_buys;
CREATE POLICY "select_group_buys" ON group_buys FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_group_buys_admin" ON group_buys;
CREATE POLICY "insert_group_buys_admin" ON group_buys FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_group_buys_admin" ON group_buys;
CREATE POLICY "update_group_buys_admin" ON group_buys FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_group_buys_admin" ON group_buys;
CREATE POLICY "delete_group_buys_admin" ON group_buys FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- participants table
-- ============================================================

CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_buy_id uuid NOT NULL REFERENCES group_buys(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'joined',
  recipient_name text,
  recipient_phone text,
  address text,
  address_detail text,
  deposit_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_buy_id, user_id)
);

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_participants" ON participants;
CREATE POLICY "select_participants" ON participants FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_participant" ON participants;
CREATE POLICY "insert_own_participant" ON participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_participants" ON participants;
CREATE POLICY "update_participants" ON participants FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_participants_admin" ON participants;
CREATE POLICY "delete_participants_admin" ON participants FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- Trigger: auto-update current_count on group_buys
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_group_buy_count()
RETURNS TRIGGER AS $$
DECLARE
  gid uuid;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    gid := NEW.group_buy_id;
  ELSIF (TG_OP = 'DELETE') THEN
    gid := OLD.group_buy_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    gid := NEW.group_buy_id;
  END IF;
  
  UPDATE group_buys 
  SET current_count = (
    SELECT count(*) FROM participants 
    WHERE group_buy_id = gid AND status != 'cancelled'
  )
  WHERE id = gid;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_update_group_buy_count ON participants;
CREATE TRIGGER trg_update_group_buy_count
  AFTER INSERT OR DELETE OR UPDATE ON participants
  FOR EACH ROW EXECUTE FUNCTION public.update_group_buy_count();

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_participants_group_buy_id ON participants(group_buy_id);
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);
CREATE INDEX IF NOT EXISTS idx_group_buys_status ON group_buys(status);
CREATE INDEX IF NOT EXISTS idx_group_buys_deadline ON group_buys(deadline);
