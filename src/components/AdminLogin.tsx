import { useState } from 'react';
import { Lock, Mail, KeyRound, ArrowRight, Shield, ArrowLeft } from 'lucide-react';
import { useAdminAuth } from '../lib/adminAuth';

export default function AdminLogin({ onBackToSite }: { onBackToSite: () => void }) {
  const { signIn, error } = useAdminAuth();
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="relative flex items-center justify-between px-6 py-6 md:px-12">
          <div className="text-center">
            <div className="font-gothic text-xs font-medium uppercase tracking-[0.3em] text-slate-500">HYPERSHIELD</div>
            <div className="font-gothic text-lg font-bold tracking-tight text-white">관리자 페이지</div>
          </div>
          <button
            onClick={onBackToSite}
            className="flex items-center gap-1.5 text-xs text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> 쇼핑몰로
          </button>
        </header>

        <main className="flex flex-1 flex-col items-center justify-center px-6 pb-16 md:px-12">
          <div className="w-full max-w-md animate-fadeIn">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-4 py-1.5 text-xs font-medium text-gold-light">
                <Shield className="h-3.5 w-3.5" />
                관리자 전용
              </div>
              <h1 className="font-gothic text-2xl font-bold leading-snug text-white">
                관리자 로그인
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                관리자 계정으로만 로그인할 수 있습니다.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 p-6 backdrop-blur-md">
              {shownError && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-2.5 text-xs text-red-400">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{shownError}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">이메일</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="admin@example.com" className="w-full rounded-lg border border-slate-600 bg-slate-900/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30" />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">비밀번호</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••" className="w-full rounded-lg border border-slate-600 bg-slate-900/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-slate-600 focus:border-gold focus:outline-none focus:ring-1 focus:ring-gold/30" />
                  </div>
                </div>
                <button type="submit" disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-gold-light disabled:opacity-50">
                  {busy ? '로그인 중...' : <>관리자 로그인 <ArrowRight className="h-4 w-4" /></>}
                </button>
              </form>
            </div>

            <p className="mt-5 text-center text-xs text-slate-500">
              관리자 세션은 일반 쇼핑몰과 분리됩니다.
            </p>
          </div>
        </main>

        <footer className="px-6 pb-6 text-center text-xs text-slate-600 md:px-12">
          © {new Date().getFullYear()} Hypershield · 관리자
        </footer>
      </div>
    </div>
  );
}
