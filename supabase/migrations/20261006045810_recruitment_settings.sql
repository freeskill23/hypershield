/*
# Recruitment Settings Table

## Overview
Adds a key-value settings table so admins can control recruitment status
(1st batch: 500 members limit) from the admin dashboard.

## New Table
### settings
- key (text, PK) — setting key
- value (text, not null) — setting value (stored as text, parsed by app)
- updated_at (timestamptz)

## Seeded Settings
- recruitment_open = 'true' — whether 1st batch recruitment is open
- recruitment_limit = '500' — max members for 1st batch
- recruitment_batch = '1' — current batch number

## Security
- SELECT: anon + authenticated (landing page needs to read status)
- INSERT/UPDATE/DELETE: admin only
*/

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_settings" ON settings;
CREATE POLICY "select_settings" ON settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "upsert_settings_admin" ON settings;
CREATE POLICY "upsert_settings_admin" ON settings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "update_settings_admin" ON settings;
CREATE POLICY "update_settings_admin" ON settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "delete_settings_admin" ON settings;
CREATE POLICY "delete_settings_admin" ON settings FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Seed defaults
INSERT INTO settings (key, value)
SELECT 'recruitment_open', 'true'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'recruitment_open');

INSERT INTO settings (key, value)
SELECT 'recruitment_limit', '500'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'recruitment_limit');

INSERT INTO settings (key, value)
SELECT 'recruitment_batch', '1'
WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key = 'recruitment_batch');
