/*
# Update handle_new_user to save cafe_nickname

## Overview
Updates the handle_new_user trigger function to also save the cafe_nickname
from signup metadata into the profiles table.

## Changes
- Modified function: handle_new_user() now reads cafe_nickname from
  raw_user_meta_data and inserts it into profiles.cafe_nickname

## Security
No security changes — same SECURITY DEFINER, same search_path.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, cafe_nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member',
    NEW.raw_user_meta_data->>'cafe_nickname'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
SET search_path = public;
