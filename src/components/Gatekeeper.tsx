import { useState } from 'react';
import { Shield, Lock, Crown, Mail, KeyRound, User, ArrowRight, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface Props {
  onAuthed: () => void;
}

export default function Gatekeeper({ onAuthed }: Props) {
  const { signIn, signUp, error, validateReferralCode } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<null | boolean>(null);

  // login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // signup form
  const [fullName, setFullName] = useState('');
  const [referral, setReferral] = useState('');

  const shownError = localError || error;

  async function handleCheckReferral(code: string) {
    setReferral(code);
    setReferralValid(null);
    if (code.trim().length < 8) return;
    try {
      const ok = await validateReferralCode(code.trim().toUpperCase());
      setReferralValid(ok);
    } catch {
      setReferralValid(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({ email: email.trim(), password });
      onAuthed();
    } catch (err: any) {
      setLocalError(err.message || '로그인 실패');
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
    if (referralValid === false) {
      setLocalError('유효하지 않은 초대 코드입니다.');
      setBusy(false);
      return;
    }
    try {
      await signUp({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
        referral_code: referral.trim().toUpperCase(),
      });
      onAuthed();
    } catch (err: any) {
      setLocalError(err.message || '가입 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-cyan/5 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-6 md:px-12">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-sheen text-navy-950 shadow-glow">
              <Shield className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display text-lg font-semibold tracking-wide text-slate-100">
                HYPERSHIELD
              </div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-cyan/80">
                Private Club
              </div>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <Lock className="h-3.5 w-3.5 text-cyan" />
            <span>초대 전용 · 폐쇄형 멤버십</span>
          </div>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 md:px-12">
          <div className="w-full max-w-md animate-fadeIn">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold-light">
                <Crown className="h-3.5 w-3.5" />
                Private 50% Club
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight text-slate-50 md:text-4xl">
                초대 코드가 있어야만
                <br />
                <span className="text-shimmer">입장 가능한 클럽</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                광고비·유통 거품 0%. 기존 회원의 초대 코드로만 가입할 수 있는
                <br className="hidden md:block" />
                폐쇄형 상시 최고수준 할인 클럽입니다.
              </p>
            </div>

            {/* Auth Card */}
            <div className="card-surface p-6 shadow-card">
              {/* Tab switch */}
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-navy-950/60 p-1">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setLocalError(null); }}
                  className={`rounded-md py-2 text-sm font-medium transition ${
                    mode === 'login'
                      ? 'bg-cyan text-navy-950 shadow-glow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setLocalError(null); }}
                  className={`rounded-md py-2 text-sm font-medium transition ${
                    mode === 'signup'
                      ? 'bg-gold text-navy-950 shadow-gold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  초대 코드 가입
                </button>
              </div>

              {shownError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{shownError}</span>
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">이메일</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hypershield.club"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">비밀번호</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary w-full">
                    {busy ? '로그인 중...' : <>입장하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">이름</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="홍길동"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">이메일</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@hypershield.club"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">비밀번호</label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="6자 이상"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">
                      추천인 초대 코드 <span className="text-gold">*필수</span>
                    </label>
                    <div className="relative">
                      <Sparkles className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        required
                        value={referral}
                        onChange={(e) => handleCheckReferral(e.target.value)}
                        placeholder="HYPER-XXXX"
                        className="input-field pl-10 pr-10 uppercase"
                      />
                      {referralValid === true && (
                        <CheckCircle2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-400" />
                      )}
                      {referralValid === false && (
                        <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-400" />
                      )}
                    </div>
                    {referralValid === false && (
                      <p className="mt-1.5 text-xs text-red-400">유효하지 않은 초대 코드입니다.</p>
                    )}
                    {referralValid === true && (
                      <p className="mt-1.5 text-xs text-emerald-400">유효한 초대 코드가 확인되었습니다.</p>
                    )}
                  </div>
                  <button type="submit" disabled={busy} className="btn-gold w-full">
                    {busy ? '가입 중...' : <>클럽 가입하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              )}
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              기존 회원의 초대 코드가 있어야만 가입 가능합니다.
            </p>
          </div>
        </main>

        <footer className="px-6 pb-6 text-center text-xs text-slate-600 md:px-12">
          © {new Date().getFullYear()} Hypershield Private Club · 회원 전용 서비스
        </footer>
      </div>
    </div>
  );
}
