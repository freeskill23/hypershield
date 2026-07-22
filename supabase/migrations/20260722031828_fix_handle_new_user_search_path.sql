/*
# Fix signup trigger: gen_random_bytes not found

## Problem
The `handle_new_user()` trigger function calls `gen_random_bytes(4)`,
which lives in the `extensions` schema. The function's `search_path`
was set to only `public`, so the unqualified call failed at signup time
with "Database error saving new user".

## Fix
Schema-qualify the call as `extensions.gen_random_bytes(4)` so the
function resolves regardless of search_path. Also add `extensions` to
the function's search_path as a belt-and-suspenders measure.

## Security
No RLS or policy changes. The function remains SECURITY DEFINER owned
by postgres, scoped to the public schema.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $$
DECLARE
  new_code TEXT;
  ref_code TEXT;
  full_name TEXT;
BEGIN
  -- Pull metadata that the client may have attached at signUp time.
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '신규 회원');
  ref_code := COALESCE(NEW.raw_user_meta_data->>'referral_code', '');

  -- Generate a unique HYPER-XXXX code (best-effort loop).
  new_code := 'HYPER-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4);
  FOR i IN 1..5 LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE my_referral_code = new_code);
    new_code := 'HYPER-' || substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4);
  END LOOP;

  INSERT INTO public.profiles (id, email, full_name, role, my_referral_code, referred_by_code)
  VALUES (
    NEW.id,
    NEW.email,
    full_name,
    'member',
    upper(new_code),
    NULLIF(upper(ref_code), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger already exists; drop and recreate to bind to the updated function.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
