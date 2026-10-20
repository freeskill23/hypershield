/*
# Add bank transfer (무통장 입금) support for subscriptions

1. Purpose
- Allow members to subscribe via bank transfer (무통장 입금) in addition to card payments.
- Admin can configure bank account details (bank name, account number, account holder) in the admin settings.
- Admin can manually confirm bank transfer payments and activate subscriptions.

2. Modified tables
- `subscription_payments`:
  - `portone_payment_id` is now nullable (bank transfer payments don't have a PortOne payment ID).
  - New column `payment_method` (text, default 'card') — 'card' or 'bank_transfer'.
  - New column `depositor_name` (text, nullable) — the depositor name entered by the member for bank transfer.
  - New column `billing_period` (text, nullable) — 'monthly' or 'annual', to know the period when admin confirms.
  - New column `confirmed_at` (timestamptz, nullable) — when admin confirmed the bank transfer.
  - New column `confirmed_by` (uuid, nullable) — admin user id who confirmed.

3. Security
- RLS already enabled on subscription_payments. Existing policies allow users to SELECT/INSERT their own rows.
- Added UPDATE policy so authenticated users can update their own rows (needed for status transitions done via edge functions using service role — but kept for completeness).
- Admin (service role) bypasses RLS, so no additional admin policies needed.

4. Important notes
- Existing rows keep 'card' as default payment_method.
- No data is lost — portone_payment_id is made nullable but existing values remain.
- The admin settings (bank name, account number, holder) are stored in the existing `settings` table with keys: `bank_transfer_bank`, `bank_transfer_account`, `bank_transfer_holder`.
*/

ALTER TABLE subscription_payments ALTER COLUMN portone_payment_id DROP NOT NULL;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_payments' AND column_name = 'payment_method') THEN
    ALTER TABLE subscription_payments ADD COLUMN payment_method text NOT NULL DEFAULT 'card';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_payments' AND column_name = 'depositor_name') THEN
    ALTER TABLE subscription_payments ADD COLUMN depositor_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_payments' AND column_name = 'billing_period') THEN
    ALTER TABLE subscription_payments ADD COLUMN billing_period text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_payments' AND column_name = 'confirmed_at') THEN
    ALTER TABLE subscription_payments ADD COLUMN confirmed_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscription_payments' AND column_name = 'confirmed_by') THEN
    ALTER TABLE subscription_payments ADD COLUMN confirmed_by uuid;
  END IF;
END $$;

DROP POLICY IF EXISTS "update_own_sub_payments" ON subscription_payments;
CREATE POLICY "update_own_sub_payments" ON subscription_payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);