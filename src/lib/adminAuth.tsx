import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { adminSupabase, isAdminSupabaseConfigured } from './adminSupabase';
import { Profile } from './types';

interface AdminAuthState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

interface AdminAuthContextValue extends AdminAuthState {
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({ profile: null, loading: true, error: null });

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isAdminSupabaseConfigured || !adminSupabase) return null;
    const { data, error } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('admin profile load error', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const refresh = useCallback(async () => {
    if (!isAdminSupabaseConfigured || !adminSupabase) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    const { data } = await adminSupabase.auth.getSession();
    if (!data.session) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    const profile = await loadProfile(data.session.user.id);
    if (profile && profile.role !== 'admin') {
      await adminSupabase.auth.signOut({ scope: 'local' });
      setState({ profile: null, loading: false, error: '관리자 권한이 필요합니다.' });
      return;
    }
    setState({ profile, loading: false, error: null });
  }, [loadProfile]);

  useEffect(() => {
    if (!isAdminSupabaseConfigured || !adminSupabase) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await adminSupabase.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          setState({ profile: null, loading: false, error: null });
          return;
        }
        const profile = await loadProfile(data.session.user.id);
        if (!mounted) return;
        if (profile && profile.role !== 'admin') {
          await adminSupabase.auth.signOut({ scope: 'local' });
          setState({ profile: null, loading: false, error: '관리자 권한이 필요합니다.' });
          return;
        }
        setState({ profile, loading: false, error: null });
      } catch (e) {
        console.error('admin auth init error', e);
        if (mounted) setState({ profile: null, loading: false, error: null });
      }
    })();
    const { data: sub } = adminSupabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!adminSupabase) return;
        try {
          if (!session) {
            setState({ profile: null, loading: false, error: null });
            return;
          }
          const profile = await loadProfile(session.user.id);
          if (profile && profile.role !== 'admin') {
            await adminSupabase.auth.signOut({ scope: 'local' });
            setState({ profile: null, loading: false, error: '관리자 권한이 필요합니다.' });
            return;
          }
          setState({ profile, loading: false, error: null });
        } catch (e) {
          console.error('admin auth state change error', e);
          setState({ profile: null, loading: false, error: null });
        }
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setState((s) => ({ ...s, error: null }));
      try {
        if (!isAdminSupabaseConfigured || !adminSupabase) throw new Error('Supabase가 설정되지 않았습니다.');
        const { data, error } = await adminSupabase.auth.signInWithPassword(input);
        if (error) throw error;
        const profile = await loadProfile(data.user.id);
        if (!profile || profile.role !== 'admin') {
          await adminSupabase.auth.signOut({ scope: 'local' });
          throw new Error('관리자 권한이 필요합니다.');
        }
        setState({ profile, loading: false, error: null });
      } catch (e: any) {
        setState({ profile: null, loading: false, error: e.message || '로그인 실패' });
        throw e;
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    if (!isAdminSupabaseConfigured || !adminSupabase) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    try {
      await adminSupabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('admin signOut error', e);
    } finally {
      setState({ profile: null, loading: false, error: null });
    }
  }, []);

  return (
    <AdminAuthContext.Provider value={{ ...state, signIn, signOut, refresh }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}
