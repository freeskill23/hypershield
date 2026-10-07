/*
# Add cafe_nickname column to profiles

## Overview
Adds a `cafe_nickname` column to the `profiles` table so users can enter their
Hypershield cafe nickname during signup. Admins use this to verify and
manually assign the "특별회원" grade.

## Changes
### profiles table
- New column: `cafe_nickname` (text, nullable) — the user's cafe nickname

## Security
No security changes — existing RLS policies on profiles are unchanged.
The new column is readable by the owner and admins through existing policies.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'cafe_nickname'
  ) THEN
    ALTER TABLE profiles ADD COLUMN cafe_nickname text;
  END IF;
END $$;
