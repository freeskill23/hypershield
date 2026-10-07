/*
# Add admin UPDATE policy on profiles table

## Problem
The profiles table only had `profiles_update_own` which checks `auth.uid() = id`.
Admins could not update other members' profiles (subscription status, role, phone, etc.)
because RLS blocked the update silently.

## Changes
1. Adds `profiles_update_admin` UPDATE policy — allows authenticated users with
   `role = 'admin'` to UPDATE any profile row.
   - USING: admin can see and update any row
   - WITH CHECK: admin can update any row
2. The existing `profiles_update_own` policy remains for self-updates.

## Security
- Only authenticated users whose own profile has `role = 'admin'` can use this policy.
- The check uses a subquery on profiles, consistent with `profiles_delete_admin`.
*/

DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);
