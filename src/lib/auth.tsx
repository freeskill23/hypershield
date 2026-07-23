import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { mockBackend, ensureMockSeed } from './mockBackend';
import { Profile } from './types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  signUp: (input: { email: string; password: string; full_name: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ profile: null, loading: true, error: null });

  const loadProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('profile load error', error);
      return null;
    }
    return data as Profile | null;
  }, []);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      const s = mockBackend.getSession();
      setState({ profile: s?.profile ?? null, loading: false, error: null });
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      setState({ profile: null, loading: false, error: null });
      return;
    }
    const profile = await loadProfile(data.session.user.id);
    setState({ profile, loading: false, error: null });
  }, [loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      ensureMockSeed();
      const s = mockBackend.getSession();
      setState({ profile: s?.profile ?? null, loading: false, error: null });
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (!data.session) {
          setState({ profile: null, loading: false, error: null });
          return;
        }
        const profile = await loadProfile(data.session.user.id);
        if (!mounted) return;
        setState({ profile, loading: false, error: null });
      } catch (e) {
        console.error('auth init error', e);
        if (mounted) setState({ profile: null, loading: false, error: null });
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        try {
          if (!session) {
            setState({ profile: null, loading: false, error: null });
            return;
          }
          const profile = await loadProfile(session.user.id);
          setState({ profile, loading: false, error: null });
        } catch (e) {
          console.error('auth state change error', e);
          setState({ profile: null, loading: false, error: null });
        }
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(
    async (input: { email: string; password: string; full_name: string }) => {
      setState((s) => ({ ...s, error: null }));
      try {
        if (!isSupabaseConfigured || !supabase) {
          const { profile } = await mockBackend.signUp(input);
          setState({ profile, loading: false, error: null });
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: {
            data: { full_name: input.full_name },
          },
        });
        if (error) throw error;
        if (!data.user) throw new Error('가입에 실패했습니다.');

        if (!data.session) {
          setState({ profile: null, loading: false, error: null });
          throw new Error(
            '가입이 완료되었습니다. 이메일함(스팸함 포함)에서 인증 메일을 확인한 후 로그인해 주세요.',
          );
        }

        const profile = await loadProfile(data.user.id);
        setState({ profile, loading: false, error: null });
      } catch (e: any) {
        setState({ profile: null, loading: false, error: e.message || '가입 실패' });
        throw e;
      }
    },
    [loadProfile],
  );

  const signIn = useCallback(
    async (input: { email: string; password: string }) => {
      setState((s) => ({ ...s, error: null }));
      try {
        if (!isSupabaseConfigured || !supabase) {
          const { profile } = await mockBackend.signIn(input);
          setState({ profile, loading: false, error: null });
          return;
        }
        const { data, error } = await supabase.auth.signInWithPassword(input);
        if (error) throw error;
        const profile = await loadProfile(data.user.id);
        setState({ profile, loading: false, error: null });
      } catch (e: any) {
        setState({ profile: null, loading: false, error: e.message || '로그인 실패' });
        throw e;
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      await mockBackend.signOut();
      setState({ profile: null, loading: false, error: null });
      return;
    }
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('signOut error', e);
    } finally {
      setState({ profile: null, loading: false, error: null });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signUp, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
