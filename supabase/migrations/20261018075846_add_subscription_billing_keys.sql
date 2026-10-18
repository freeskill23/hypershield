CREATE TABLE IF NOT EXISTS subscription_billing_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  portone_billing_key text NOT NULL,
  portone_issue_id text,
  plan_id uuid REFERENCES subscription_plans(id),
  card_company text,
  card_number_masked text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_billing_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_billing_keys" ON subscription_billing_keys FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_billing_keys" ON subscription_billing_keys FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "update_own_billing_keys" ON subscription_billing_keys FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_billing_keys" ON subscription_billing_keys FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_subscription_billing_keys_user ON subscription_billing_keys(user_id);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES subscription_plans(id),
  portone_payment_id text NOT NULL UNIQUE,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  billing_cycle_date date NOT NULL DEFAULT CURRENT_DATE,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_sub_payments" ON subscription_payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "insert_own_sub_payments" ON subscription_payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_subscription_payments_user ON subscription_payments(user_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS portone_payment_id text;
