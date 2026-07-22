/*
# Referral Points System

## Overview
Adds a points-based referral reward system. When a new member (referred by an
existing member's code) makes their FIRST purchase, the referrer earns 10% of
the purchase amount as spendable points. Points can be used at checkout to
reduce the order total (1 point = 1 KRW).

## Modified Tables
- `profiles`: added `points` column (INT, default 0) — spendable points balance
- `orders`: added `points_used` (INT, default 0) — points deducted by buyer on this order
- `orders`: added `points_earned` (INT, default 0) — points awarded to referrer from this order (audit)

## New RPCs
- `process_order_referral_reward(order_id)`: Checks if the order is the buyer's
  first non-cancelled order, finds the referrer via referred_by_code, and awards
  10% of the order total_amount as points to the referrer. Returns the points
  awarded (0 if no reward). SECURITY DEFINER so the buyer can trigger a write
  to the referrer's profile (which RLS would otherwise block).

## Security
- No new tables → no new RLS policies needed.
- `profiles` already has update_own policy; buyers deduct their own points client-side.
- The RPC is SECURITY DEFINER so it can update the referrer's points.

## Important Notes
1. Points are awarded only on the buyer's FIRST non-cancelled order.
2. 1 point = 1 KRW. Points_used reduces the order total_amount.
3. The referrer reward is 10% of total_amount (the final amount after points deduction).
4. The RPC is idempotent — if points_earned is already > 0, it returns 0 (no double reward).
*/

-- ============================================================
-- 1. Add points column to profiles
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'points') THEN
    ALTER TABLE profiles ADD COLUMN points INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 2. Add points_used and points_earned to orders
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'points_used') THEN
    ALTER TABLE orders ADD COLUMN points_used INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'points_earned') THEN
    ALTER TABLE orders ADD COLUMN points_earned INT NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 3. process_order_referral_reward RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.process_order_referral_reward(p_order_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  ord RECORD;
  buyer_code TEXT;
  referrer_id UUID;
  prev_count INT;
  reward INT;
BEGIN
  -- Get the order (must not be cancelled, must not already have a reward recorded)
  SELECT * INTO ord FROM orders WHERE id = p_order_id AND status != 'cancelled';
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Already rewarded — idempotent
  IF ord.points_earned > 0 THEN RETURN 0; END IF;

  -- Get buyer's referrer code
  SELECT referred_by_code INTO buyer_code FROM profiles WHERE id = ord.user_id;
  IF buyer_code IS NULL OR buyer_code = '' THEN RETURN 0; END IF;

  -- Find referrer by their my_referral_code
  SELECT id INTO referrer_id FROM profiles WHERE my_referral_code = buyer_code;
  IF referrer_id IS NULL THEN RETURN 0; END IF;

  -- Check this is the buyer's first non-cancelled order
  SELECT COUNT(*) INTO prev_count
  FROM orders
  WHERE user_id = ord.user_id AND status != 'cancelled' AND id != p_order_id;
  IF prev_count > 0 THEN RETURN 0; END IF;

  -- 10% of total_amount (after points deduction)
  reward := ROUND(ord.total_amount * 0.10);
  IF reward <= 0 THEN RETURN 0; END IF;

  -- Award points to referrer
  UPDATE profiles SET points = points + reward WHERE id = referrer_id;

  -- Record on order for audit
  UPDATE orders SET points_earned = reward WHERE id = p_order_id;

  RETURN reward;
END;
$$;