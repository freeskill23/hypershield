import { useState, useCallback } from 'react';
import { LogOut, Store, Users, Crown } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth';
import { useProducts, useOrders, useProfiles } from './lib/data';
import Gatekeeper from './components/Gatekeeper';
import MembershipCard from './components/MembershipCard';
import PrivateStore from './components/PrivateStore';
import ReferralNetwork from './components/ReferralNetwork';
import AdminDashboard from './components/AdminDashboard';

type MemberTab = 'store' | 'network';

function Shell() {
  const { profile, loading, signOut } = useAuth();
  const [authed, setAuthed] = useState(false);
  const [memberTab, setMemberTab] = useState<MemberTab>('store');

  // Data hooks (only used when authenticated)
  const productsHook = useProducts();
  const ordersHook = useOrders();
  const profilesHook = useProfiles();

  const refreshAll = useCallback(() => {
    productsHook.refresh();
    ordersHook.refresh();
    profilesHook.refresh();
  }, [productsHook, ordersHook, profilesHook]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="text-sm">클럽 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!profile || !authed) {
    return <Gatekeeper onAuthed={() => setAuthed(true)} />;
  }

  const isAdmin = profile.role === 'admin';

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center">
            <div className="font-gothic text-xl font-bold tracking-tight text-slate-100">
              하이퍼쉴드 프라이빗 클럽
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium text-slate-100">{profile.full_name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {isAdmin ? 'Administrator' : 'VIP Member'} · {profile.my_referral_code}
              </div>
            </div>
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-navy-950 ${isAdmin ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
              {profile.full_name.slice(0, 1)}
            </div>
            <button
              onClick={async () => { await signOut(); setAuthed(false); }}
              className="btn-ghost px-3 py-2"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">로그아웃</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        {isAdmin ? (
          <AdminDashboard
            profiles={profilesHook.profiles}
            orders={ordersHook.orders}
            products={productsHook.products}
            refresh={refreshAll}
          />
        ) : (
          <div className="space-y-6">
            {/* Hero row: membership card + greeting */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto,1fr]">
              <MembershipCard profile={profile} />
              <div className="flex flex-col justify-center">
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs text-gold-light">
                  <Crown className="h-3 w-3" /> Private Club
                </div>
                <h1 className="mt-3 font-display text-2xl font-bold text-slate-50 md:text-3xl">
                  환영합니다, <span className="text-shimmer">{profile.full_name}</span>님
                </h1>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">
                  시중가에서 거품을 완전히 제거한 클럽 공급가로 모든 상품을 만나보세요.
                  내 전용 초대 코드를 공유해 지인을 클럽에 초대할 수 있습니다.
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
              <button
                onClick={() => setMemberTab('store')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'store' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Store className="h-4 w-4" /> 프라이빗 스토어
              </button>
              <button
                onClick={() => setMemberTab('network')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'network' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" /> 내 초대 현황
              </button>
            </div>

            {memberTab === 'store' ? (
              <PrivateStore products={productsHook.products} onOrdered={ordersHook.refresh} />
            ) : (
              <ReferralNetwork profiles={profilesHook.profiles} me={profile} />
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-navy-700 px-5 py-5 text-center text-xs text-slate-600 md:px-8">
        © {new Date().getFullYear()} Hypershield Private Club · 회원 전용 서비스 · 광고비·유통 거품 0%
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
