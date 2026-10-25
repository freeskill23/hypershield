/*
# Visitor Logs Table for Analytics

1. New Tables
- `visitor_logs`
  - `id` (uuid, primary key)
  - `session_id` (text, identifies a unique browser session via localStorage)
  - `path` (text, the page path visited, e.g. "/", "/shop", "/product/xxx")
  - `referrer` (text, the referring URL or null if direct)
  - `search_keyword` (text, search query extracted from referrer URL if from a search engine, else null)
  - `user_agent` (text, browser user agent string)
  - `is_mobile` (boolean, whether the visitor is on a mobile device)
  - `created_at` (timestamptz, when the visit occurred)

2. Security
- Enable RLS on `visitor_logs`.
- Grant INSERT to `anon, authenticated` so any visitor can log a page view.
- Grant SELECT to `authenticated` so only logged-in admins can read analytics.
- No UPDATE or DELETE needed from the client side.

3. Indexes
- Index on `created_at` for time-based queries.
- Index on `path` for path-based aggregation.
- Index on `referrer` for referrer aggregation.
- Index on `search_keyword` for keyword aggregation.
*/

CREATE TABLE IF NOT EXISTS visitor_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  path text NOT NULL,
  referrer text,
  search_keyword text,
  user_agent text,
  is_mobile boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

GRANT INSERT ON visitor_logs TO anon, authenticated;
GRANT SELECT ON visitor_logs TO authenticated;

DROP POLICY IF EXISTS "anon_insert_visitor_logs" ON visitor_logs;
CREATE POLICY "anon_insert_visitor_logs" ON visitor_logs FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_select_visitor_logs" ON visitor_logs;
CREATE POLICY "authenticated_select_visitor_logs" ON visitor_logs FOR SELECT
TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_visitor_logs_created_at ON visitor_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_path ON visitor_logs (path);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_referrer ON visitor_logs (referrer);
CREATE INDEX IF NOT EXISTS idx_visitor_logs_search_keyword ON visitor_logs (search_keyword);
