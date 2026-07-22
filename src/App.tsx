import { useState, useCallback, useEffect } from 'react';
import { LogOut, Store, Users, Crown, Package, Sparkles, ArrowRight } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth';
import { useReferralRequests } from './lib/data';
import { useProducts, useOrders, useProfiles, useCategories } from './lib/data';
import Gatekeeper from './components/Gatekeeper';
import PrivateStore from './components/PrivateStore';
import ReferralNetwork from './components/ReferralNetwork';
import AdminDashboard from './components/AdminDashboard';
import MyPage from './components/MyPage';
import ErrorBoundary from './components/ErrorBoundary';

type MemberTab = 'store' | 'mypage' | 'network';

function Shell() {
  const { profile, loading, signOut, refresh: refreshProfile } = useAuth();
  const [memberTab, setMemberTab] = useState<MemberTab>('store');

  const authReady = !loading && !!profile;
  const myRequests = useReferralRequests(profile?.id);

  const productsHook = useProducts(authReady);
  const ordersHook = useOrders(authReady);
  const profilesHook = useProfiles(authReady);
  const categoriesHook = useCategories(authReady);

  const refreshAll = useCallback(() => {
    productsHook.refresh();
    ordersHook.refresh();
    profilesHook.refresh();
    categoriesHook.refresh();
    refreshProfile();
  }, [productsHook, ordersHook, profilesHook, categoriesHook, refreshProfile]);

  const switchMemberTab = useCallback((tab: MemberTab) => {
    setMemberTab(tab);
    window.history.pushState({ view: 'member', tab }, '', `#${tab}`);
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.view === 'member') {
        const t = e.state.tab;
        if (t === 'store' || t === 'mypage' || t === 'network') setMemberTab(t);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      const hash = window.location.hash.replace('#', '');
      const valid: MemberTab[] = ['store', 'mypage', 'network'];
      const initialTab: MemberTab = valid.includes(hash as MemberTab) ? (hash as MemberTab) : 'store';
      if (initialTab !== memberTab) setMemberTab(initialTab);
      window.history.replaceState({ view: 'member', tab: initialTab }, '', `#${initialTab}`);
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (!profile) {
    return <Gatekeeper />;
  }

  return (
    <ErrorBoundary>
      <ShellContent
        profile={profile}
        memberTab={memberTab}
        switchMemberTab={switchMemberTab}
        signOut={signOut}
        productsHook={productsHook}
        ordersHook={ordersHook}
        profilesHook={profilesHook}
        categoriesHook={categoriesHook}
        refreshAll={refreshAll}
        hasPendingCodeRequest={myRequests.requests.some((r) => r.status === 'pending')}
      />
    </ErrorBoundary>
  );
}

function ShellContent({
  profile,
  memberTab,
  switchMemberTab,
  signOut,
  productsHook,
  ordersHook,
  profilesHook,
  categoriesHook,
  refreshAll,
  hasPendingCodeRequest,
}: {
  profile: NonNullable<ReturnType<typeof useAuth>['profile']>;
  memberTab: MemberTab;
  switchMemberTab: (tab: MemberTab) => void;
  signOut: () => Promise<void>;
  productsHook: ReturnType<typeof useProducts>;
  ordersHook: ReturnType<typeof useOrders>;
  profilesHook: ReturnType<typeof useProfiles>;
  categoriesHook: ReturnType<typeof useCategories>;
  refreshAll: () => void;
  hasPendingCodeRequest: boolean;
}) {
  const isAdmin = profile.role === 'admin';

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center">
            <button
              onClick={() => switchMemberTab('store')}
              className="font-gothic text-xl font-bold tracking-tight text-slate-100 transition hover:text-cyan"
              title="메인으로"
            >
              하이퍼쉴드 프라이빗 클럽
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium text-slate-100">{profile.full_name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {isAdmin ? 'Administrator' : 'Member'}
                {profile.my_referral_code ? ` · ${profile.my_referral_code}` : ''}
              </div>
            </div>
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-navy-950 ${isAdmin ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
              {profile.full_name.slice(0, 1)}
            </div>
            <button
              onClick={async () => { await signOut(); }}
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
            profiles={profilesHook.items}
            orders={ordersHook.items}
            products={productsHook.items}
            categories={categoriesHook.items}
            refresh={refreshAll}
          />
        ) : (
          <div className="space-y-6">
            {/* Greeting */}
            <div className="flex flex-col">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3 py-1 text-xs text-gold-light">
                <Crown className="h-3 w-3" /> Private Club
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold text-slate-50 md:text-3xl">
                환영합니다, <span className="text-shimmer">{profile.full_name}</span>님
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-slate-400">
                프라이빗 클럽은 시중가에서 광고비, 유통비 등을 완전히 제거한 클럽 공급가로 하이퍼쉴드 상품을 만나보세요. 내 전용 초대 코드를 공유해 지인을 클럽에 초대할 수 있습니다.
              </p>
            </div>

            {/* Referral code prompt for members without one */}
            {!profile.my_referral_code && (
              <div
                className={`flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  hasPendingCodeRequest
                    ? 'border-cyan/30 bg-cyan/5'
                    : 'border-gold/30 bg-gold/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${hasPendingCodeRequest ? 'bg-cyan/15 text-cyan' : 'bg-gold/15 text-gold'}`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      {hasPendingCodeRequest ? '초대 코드 승인 대기 중' : '아직 초대 코드가 없습니다'}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {hasPendingCodeRequest
                        ? '관리자가 신청을 검토하고 있습니다. 승인되면 코드가 발급됩니다.'
                        : '지인을 클럽에 초대하려면 관리자에게 초대 코드를 신청하세요.'}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => switchMemberTab('network')}
                  className={`btn-ghost shrink-0 text-xs ${hasPendingCodeRequest ? '' : 'btn-gold'}`}
                >
                  {hasPendingCodeRequest ? '신청 확인하기' : '초대 코드 신청하기'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
              <button
                onClick={() => switchMemberTab('store')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'store' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Store className="h-4 w-4" /> 프라이빗 스토어
              </button>
              <button
                onClick={() => switchMemberTab('mypage')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'mypage' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Package className="h-4 w-4" /> 마이페이지
              </button>
              <button
                onClick={() => switchMemberTab('network')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'network' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="h-4 w-4" /> 내 초대 현황
              </button>
            </div>

            {memberTab === 'store' ? (
              <PrivateStore
                products={productsHook.items}
                categories={categoriesHook.items}
                profile={profile}
                onOrdered={refreshAll}
              />
            ) : memberTab === 'mypage' ? (
              <MyPage profile={profile} />
            ) : (
              <ReferralNetwork profiles={profilesHook.items} me={profile} />
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
