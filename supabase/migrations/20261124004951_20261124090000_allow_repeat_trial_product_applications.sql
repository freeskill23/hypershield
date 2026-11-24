/*
# Allow repeat trial applications for the same product

1. Purpose
- Allow a member to apply for the same trial product again in a different month.
- Keep the existing monthly and annual eligibility limits enforced by get_trial_eligibility.
- Keep the existing requirement that earlier trial applications must be completed before a new month can be used.

2. Modified Tables
- `trial_applications`
  - Remove the `trial_unique_user_product` UNIQUE constraint on `(user_id, product_id)`.
  - No rows, columns, statuses, or existing application records are deleted or changed.

3. Security
- No RLS policies are changed.
- Existing authenticated-user ownership and administrator policies remain in place.

4. Important Notes
- Duplicate applications are now allowed at the database level so the application can support repeat monthly participation.
- The application-level monthly limit remains one application per month.
- The annual limit remains twelve applications per annual subscription period.
*/

ALTER TABLE public.trial_applications
  DROP CONSTRAINT IF EXISTS trial_unique_user_product;