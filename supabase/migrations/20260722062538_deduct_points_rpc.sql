/*
# Deduct Points RPC

## Overview
Adds an RPC to atomically deduct points from the buyer's profile when placing an order.
This avoids race conditions where concurrent reads + writes could cause incorrect balances.

## New RPCs
- `deduct_user_points(p_user_id UUID, p_amount INT)`: Atomically subtracts p_amount
  from the user's points (floor at 0). Returns the new balance. SECURITY DEFINER
  so it can write to the user's own profile from an RPC call context.
*/

CREATE OR REPLACE FUNCTION public.deduct_user_points(p_user_id UUID, p_amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  new_balance INT;
BEGIN
  IF p_amount <= 0 THEN
    SELECT points INTO new_balance FROM profiles WHERE id = p_user_id;
    RETURN COALESCE(new_balance, 0);
  END IF;

  UPDATE profiles
    SET points = GREATEST(0, points - p_amount)
    WHERE id = p_user_id
    RETURNING points INTO new_balance;

  RETURN COALESCE(new_balance, 0);
END;
$$;