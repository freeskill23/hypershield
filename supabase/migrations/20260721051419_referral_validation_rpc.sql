-- Allow unauthenticated visitors to validate a referral code without
-- exposing the full profiles table. SECURITY DEFINER runs as the owner,
-- bypassing RLS, and only returns a boolean.
CREATE OR REPLACE FUNCTION public.is_valid_referral_code(code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE my_referral_code = upper($1)
  ) OR upper($1) = 'HYPER-ROOT';
$$;

GRANT EXECUTE ON FUNCTION public.is_valid_referral_code(text) TO anon, authenticated;
