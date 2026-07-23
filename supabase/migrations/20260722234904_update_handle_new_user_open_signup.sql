/*
# Update handle_new_user trigger for open signup

The existing handle_new_user trigger requires referral_code metadata to set
referred_by_code on the profile. Now that the app is open signup (no referral
required), we update the trigger to handle missing referral_code gracefully.
referred_by_code and my_referral_code remain on the profiles table for backward
compatibility but are no longer used by the new group buying flow.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'member'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
SET search_path = public;
