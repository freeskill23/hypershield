import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase anon key is public-safe (protected by RLS).
// We embed fallback values so deployed builds work even when .env
// (which is gitignored) is not present at build time.
const FALLBACK_URL = 'https://cnrpkymyermkibkbityz.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucnBreW15ZXJta2lia2JpdHl6Iiwicm9sIjoiYW5vbiIsImlhdCI6MTc4NDU5OTczNiwiZXhwIjoyMTAwMTc1NzM2fQ.6VcHiWvQMNkRF9C2dfIOv-dLSm5UTmsQv1siIXxuiBU';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url as string, anonKey as string)
  : null;
