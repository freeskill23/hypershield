-- Auto-create a profile row whenever a new auth.users row is inserted.
-- This makes signup robust: the client no longer needs to insert the profile
-- (which fails when email confirmation is on, since there is no session yet).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  new_code := 'HYPER-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 4);
  FOR i IN 1..5 LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE my_referral_code = new_code);
    new_code := 'HYPER-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 4);
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
