import { createClient, SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://cnrpkymyermkibkbityz.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNucnBreW15ZXJta2lia2JpdHl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1OTk3MzYsImV4cCI6MjEwMDE3NTczNn0.6VcHiWvQMNkRF9C2dfIOv-dLSm5UTmsQv1siIXxuiBU';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || FALLBACK_ANON_KEY;

export const isAdminSupabaseConfigured = Boolean(url && anonKey);

export const adminSupabase: SupabaseClient | null = isAdminSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        storageKey: 'admin-hypershield-auth',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
