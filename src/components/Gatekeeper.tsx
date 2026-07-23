import { useState } from 'react';
import { Lock, Mail, KeyRound, User, ArrowRight, Users, TrendingDown, Clock } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function Gatekeeper() {
  const { signIn, signUp, error } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  const shownError = localError || error;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLocalError(null);
    try {
      await signIn({ email: email.trim(), password });
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
    try {
      await signUp({
        email: email.trim(),
        password,
        full_name: fullName.trim(),
      });
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
        <header className="relative flex items-center justify-center px-6 py-6 md:px-12">
          <div className="font-gothic text-xl font-bold tracking-tight text-slate-100">
            하이퍼쉴드 공동구매
          </div>
          <div className="absolute right-6 hidden items-center gap-2 text-xs text-slate-400 md:flex md:right-12">
            <Lock className="h-3.5 w-3.5 text-cyan" />
            <span>베타 서비스 · 계좌이체 결제</span>
          </div>
        </header>

        {/* Hero */}
        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 md:px-12">
          <div className="w-full max-w-md animate-fadeIn">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-4 py-1.5 text-xs font-medium text-cyan">
                <Users className="h-3.5 w-3.5" />
                Group Buy Beta
              </div>
              <h1 className="font-gothic text-base font-medium leading-snug text-slate-300 md:text-lg">
                함께 모이면 더 저렴하게
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                목표 인원이 모이면 공동구매 가격으로 구매할 수 있는
                <br className="hidden md:block" />
                베타 서비스입니다. 누구나 자유롭게 가입 가능합니다.
              </p>

              {/* Feature pills */}
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-[11px] text-slate-400">
                  <TrendingDown className="h-3 w-3 text-cyan" /> 공동구매 할인가
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-[11px] text-slate-400">
                  <Clock className="h-3 w-3 text-gold" /> 기한 내 인원 달성
                </div>
                <div className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-900/60 px-3 py-1 text-[11px] text-slate-400">
                  <Lock className="h-3 w-3 text-slate-500" /> 계좌이체 결제
                </div>
              </div>
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
                  회원가입
                </button>
              </div>

              {shownError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
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
                        placeholder="you@example.com"
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
                        placeholder="you@example.com"
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
                  <button type="submit" disabled={busy} className="btn-gold w-full">
                    {busy ? '가입 중...' : <>가입하고 시작하기 <ArrowRight className="h-4 w-4" /></>}
                  </button>
                </form>
              )}
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              누구나 자유롭게 가입할 수 있습니다.
            </p>
          </div>
        </main>

        <footer className="px-6 pb-6 text-center text-xs text-slate-600 md:px-12">
          © {new Date().getFullYear()} Hypershield Group Buy · 베타 서비스
        </footer>
      </div>
    </div>
  );
}
