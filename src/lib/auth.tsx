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
  signUp: (input: { email: string; password: string; full_name: string; referral_code: string }) => Promise<void>;
  signIn: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  validateReferralCode: (code: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BOOTSTRAP_CODE = 'HYPER-ROOT';

function genReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'HYPER-' + s;
}

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
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (!data.session) {
        setState({ profile: null, loading: false, error: null });
        return;
      }
      const profile = await loadProfile(data.session.user.id);
      if (!mounted) return;
      setState({ profile, loading: false, error: null });
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        if (!session) {
          setState({ profile: null, loading: false, error: null });
          return;
        }
        const profile = await loadProfile(session.user.id);
        setState({ profile, loading: false, error: null });
      })();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signUp = useCallback(
    async (input: { email: string; password: string; full_name: string; referral_code: string }) => {
      setState((s) => ({ ...s, error: null }));
      try {
        if (!isSupabaseConfigured || !supabase) {
          const { profile } = await mockBackend.signUp(input);
          setState({ profile, loading: false, error: null });
          return;
        }
        // Validate referral code against profiles table.
        // HYPER-ROOT is the always-valid bootstrap code so the first member can join.
        const isBootstrap = input.referral_code.toUpperCase() === BOOTSTRAP_CODE;
        if (!isBootstrap) {
          const { data: referrer, error: refErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('my_referral_code', input.referral_code)
            .maybeSingle();
          if (refErr) throw new Error('초대 코드 검증 중 오류가 발생했습니다.');
          if (!referrer) throw new Error('유효하지 않은 초대 코드입니다. 기존 회원의 코드가 필요합니다.');
        }

        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
        });
        if (error) throw error;
        if (!data.user) throw new Error('가입에 실패했습니다.');

        let code = genReferralCode();
        // ensure uniqueness (best-effort)
        for (let i = 0; i < 5; i++) {
          const { data: existing } = await supabase
            .from('profiles')
            .select('id')
            .eq('my_referral_code', code)
            .maybeSingle();
          if (!existing) break;
          code = genReferralCode();
        }

        const newProfile: Partial<Profile> = {
          id: data.user.id,
          email: input.email,
          full_name: input.full_name,
          role: 'member',
          my_referral_code: code,
          referred_by_code: input.referral_code,
        };
        const { error: insertErr } = await supabase.from('profiles').insert(newProfile);
        if (insertErr) throw insertErr;

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
    await supabase.auth.signOut();
    setState({ profile: null, loading: false, error: null });
  }, []);

  const validateReferralCode = useCallback(async (code: string): Promise<boolean> => {
    if (code.toUpperCase() === BOOTSTRAP_CODE) return true;
    if (!isSupabaseConfigured || !supabase) {
      return mockBackend.validateReferralCode(code);
    }
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('my_referral_code', code)
      .maybeSingle();
    return Boolean(data);
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, signUp, signIn, signOut, refresh, validateReferralCode }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
