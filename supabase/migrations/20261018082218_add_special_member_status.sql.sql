/*
# Add special-member request & approval fields to profiles

## Overview
Replaces the free-text "cafe nickname" signup field with a structured
"하이퍼쉴드 카페 회원 여부" selection so the admin can see, at a glance,
which members requested special-member status and approve them.

## New columns on `profiles`
- `cafe_membership` text — one of:
    'none' (회원 아님), 'sprout' (카페회원 새싹),
    'general' (카페회원 일반), 'faithful' (카페회원 성실),
    'special' (특별회원 신청).
  Defaults to 'none'. Stored on signup from the user-selected checkbox.
- `special_member_status` text — admin-controlled approval state:
    'requested' (특별회원미승인 목록), 'approved' (특별회원승인 목록),
    or NULL (해당 없음).
  Defaults to NULL. When a user picks 'special' at signup, it is set to
  'requested'. Admin can flip it to 'approved' (or back to 'requested').

## Migration safety
- Both columns are nullable with safe defaults, so existing rows backfill
  automatically. No data is lost.
- `cafe_nickname` column is left intact for backward compatibility
  (existing UIs still read it) but is no longer the primary signal.

## Security
- No new RLS policies needed: the existing `profiles_update_admin` policy
  already lets admins UPDATE any profile row, so admins can set
  `special_member_status`. Self-updates remain governed by
  `profiles_update_own`, which is not used for these admin-only fields.
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cafe_membership text NOT NULL DEFAULT 'none';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS special_member_status text;

-- Backfill: any existing row with a cafe_nickname is treated as a prior
-- cafe member so the admin can still find them; no special status set.
UPDATE profiles
  SET cafe_membership = 'general'
  WHERE cafe_membership = 'none'
    AND cafe_nickname IS NOT NULL
    AND cafe_nickname <> '';

-- Update handle_new_user to persist cafe_membership + special request
-- from signup metadata (chosen via the new checkbox UI).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, role, cafe_nickname, cafe_membership, special_member_status
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member',
    NEW.raw_user_meta_data->>'cafe_nickname',
    COALESCE(NEW.raw_user_meta_data->>'cafe_membership', 'none'),
    CASE
      WHEN NEW.raw_user_meta_data->>'cafe_membership' = 'special'
        THEN 'requested'
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
SET search_path = public;
