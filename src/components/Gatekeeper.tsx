import { useState, useEffect } from 'react';
import { Megaphone, Mail, KeyRound, User, ArrowRight, Shield, TrendingDown, Sparkles, Check, MessageCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { translateAuthError } from '../lib/format';
import type { CafeMembership } from '../lib/types';

const CAFE_MEMBERSHIP_OPTIONS: { value: CafeMembership; label: string }[] = [
  { value: 'none', label: '회원 아님' },
  { value: 'sprout', label: '카페회원 (새싹)' },
  { value: 'general', label: '카페회원 (일반)' },
  { value: 'faithful', label: '카페회원 (성실)' },
  { value: 'special', label: '특별회원' },
];

export default function Gatekeeper() {
  const { signIn, signUp, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [cafeNickname, setCafeNickname] = useState('');
  const [cafeMembership, setCafeMembership] = useState<CafeMembership>('none');
  const [saveEmail, setSaveEmail] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('hypershield_saved_email');
    const savedPassword = localStorage.getItem('hypershield_saved_password');
    if (savedEmail) {
      setEmail(savedEmail);
      setSaveEmail(true);
    }
    if (savedPassword) {
      setPassword(savedPassword);
      setSavePassword(true);
    }
  }, []);

  function handleSaveEmailChange(checked: boolean) {
    setSaveEmail(checked);
    if (checked) {
      localStorage.setItem('hypershield_saved_email', email.trim());
    } else {
      localStorage.removeItem('hypershield_saved_email');
    }
  }

  function handleSavePasswordChange(checked: boolean) {
    setSavePassword(checked);
    if (checked) {
      localStorage.setItem('hypershield_saved_password', password);
    } else {
      localStorage.removeItem('hypershield_saved_password');
    }
  }

  const shownError = localError || error;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({ email: email.trim(), password });
      if (saveEmail) {
        localStorage.setItem('hypershield_saved_email', email.trim());
      } else {
        localStorage.removeItem('hypershield_saved_email');
      }
      if (savePassword) {
        localStorage.setItem('hypershield_saved_password', password);
      } else {
        localStorage.removeItem('hypershield_saved_password');
      }
    } catch (err: any) {
      setLocalError(translateAuthError(err.message) || '로그인 실패');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    if (!fullName.trim()) {
      setLocalError('이름을 입력해주세요.');
      setBusy(false);
      return;
    }
    if (password !== passwordConfirm) {
      setLocalError('비밀번호가 일치하지 않습니다.');
      setBusy(false);
      return;
    }
    try {
      await signUp({ email: email.trim(), password, full_name: fullName.trim(), cafe_nickname: cafeNickname.trim(), cafe_membership: cafeMembership });
    } catch (err: any) {
      setLocalError(translateAuthError(err.message) || '가입 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="relative flex items-center justify-center px-6 py-6 md:px-12">
          <div className="text-center">
            <div className="font-gothic text-xs font-medium uppercase tracking-[0.3em] text-slate-400">HYPERSHIELD</div>
            <div className="font-gothic text-lg font-bold tracking-tight text-slate-800">하이퍼쉴드 멤버쉽</div>
          </div>
          <div className="absolute right-6 hidden items-center gap-2 text-xs text-slate-500 md:flex md:right-12">
            <Shield className="h-3.5 w-3.5 text-cyan" />
            <span>온라인 광고 보이콧</span>
          </div>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 md:px-12">
          <div className="w-full max-w-md animate-fadeIn">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-4 py-1.5 text-xs font-medium text-cyan">
                <Megaphone className="h-3.5 w-3.5" />
                온라인 광고 보이콧 선언!
              </div>
              <h1 className="font-gothic text-2xl font-bold leading-snug text-slate-800">
                제품에 광고비와 마진을 뺐습니다
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">
                멤버쉽 회원은 기본 50% 할인 혜택
              </p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-600">
                  <TrendingDown className="h-3 w-3 text-cyan" /> 최소 50% 할인
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] text-slate-600">
                  <Sparkles className="h-3 w-3 text-gold" /> 회원제 쇼핑몰
                </div>
              </div>
            </div>

            <div className="card-surface p-6">
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setLocalError(null); }}
                  className={`rounded-md py-2 text-sm font-medium transition ${
                    mode === 'login' ? 'bg-cyan text-white shadow-glow' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setLocalError(null); }}
                  className={`rounded-md py-2 text-sm font-medium transition ${
                    mode === 'signup' ? 'bg-gold text-white shadow-gold' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  회원가입
                </button>
              </div>

              {shownError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{shownError}</span>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">이메일</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com" className="input-field pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">비밀번호</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" className="input-field pl-10" />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={saveEmail}
                        onChange={(e) => handleSaveEmailChange(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-cyan focus:ring-cyan"
                      />
                      이메일 저장
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={savePassword}
                        onChange={(e) => handleSavePasswordChange(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-cyan focus:ring-cyan"
                      />
                      비밀번호 저장
                    </label>
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary w-full">
                    {busy ? '로그인 중...' : <>입장하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setForgotPassword(true); setLocalError(null); }}
                    className="w-full text-center text-xs text-slate-400 underline hover:text-slate-600"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">이름</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input required value={fullName} onChange={(e) => setFullName(e.target.value)}
                        placeholder="홍길동" className="input-field pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">하이퍼쉴드 카페 닉네임</label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input value={cafeNickname} onChange={(e) => setCafeNickname(e.target.value)}
                        placeholder="카페 닉네임 (선택)" className="input-field pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">하이퍼쉴드 카페 회원인가요?</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {CAFE_MEMBERSHIP_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                            cafeMembership === opt.value
                              ? 'border-cyan bg-cyan/5 text-slate-800 font-medium'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition ${cafeMembership === opt.value ? 'border-cyan bg-cyan' : 'border-slate-300'}`}>
                            {cafeMembership === opt.value && <Check className="h-2.5 w-2.5 text-white" />}
                          </span>
                          <input
                            type="radio"
                            name="cafe_membership"
                            value={opt.value}
                            checked={cafeMembership === opt.value}
                            onChange={() => setCafeMembership(opt.value)}
                            className="sr-only"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">이메일</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com" className="input-field pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">비밀번호</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="6자 이상" className="input-field pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">비밀번호 확인</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input type="password" required minLength={6} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
                        placeholder="비밀번호 재입력" className="input-field pl-10" />
                    </div>
                    {passwordConfirm.length > 0 && password !== passwordConfirm && (
                      <p className="mt-1 text-xs text-red-500">비밀번호가 일치하지 않습니다.</p>
                    )}
                    {passwordConfirm.length > 0 && password === passwordConfirm && (
                      <p className="mt-1 text-xs text-green-500">비밀번호가 일치합니다.</p>
                    )}
                  </div>
                  <button type="submit" disabled={busy} className="btn-gold w-full">
                    {busy ? '가입 중...' : <>가입하고 시작하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              )}
            </div>

            {forgotPassword && (
              <div className="card-surface mt-4 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-gothic text-base font-semibold text-slate-800">비밀번호 찾기</h3>
                  <button onClick={() => { setForgotPassword(false); setForgotSent(false); }} className="text-slate-400 hover:text-slate-600 text-sm">
                    닫기
                  </button>
                </div>
                {forgotSent ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일함(스팸함 포함)을 확인해 주세요.
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!email.trim()) return;
                    setForgotBusy(true);
                    setLocalError(null);
                    try {
                      const { supabase } = await import('../lib/supabase');
                      if (!supabase) throw new Error('서비스를 사용할 수 없습니다.');
                      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
                        redirectTo: window.location.origin + window.location.pathname,
                      });
                      if (error) throw error;
                      setForgotSent(true);
                    } catch (err: any) {
                      setLocalError(translateAuthError(err.message) || '이메일 발송에 실패했습니다.');
                    } finally {
                      setForgotBusy(false);
                    }
                  }} className="space-y-4">
                    <p className="text-sm text-slate-500">가입하신 이메일을 입력하면 비밀번호 재설정 링크를 보내드립니다.</p>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">이메일</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com" className="input-field pl-10" />
                      </div>
                    </div>
                    <button type="submit" disabled={forgotBusy} className="btn-primary w-full">
                      {forgotBusy ? '발송 중...' : <>재설정 링크 발송 <ArrowRight className="h-4 w-4" /></>}
                    </button>
                  </form>
                )}
              </div>
            )}

            <p className="mt-5 text-center text-xs text-slate-400">
              가입 후 구독 결제 시 쇼핑몰 이용 가능
            </p>
          </div>
        </main>

        <footer className="px-6 pb-6 text-center text-xs text-slate-400 md:px-12">
          © {new Date().getFullYear()} Hypershield · 하이퍼쉴드 멤버쉽
        </footer>
      </div>
    </div>
  );
}
