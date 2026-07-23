import { useState, useCallback, useEffect } from 'react';
import { LogOut, Home, User, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth';
import { useGroupBuys, useProfiles, useParticipants, useMyParticipations } from './lib/data';
import { Profile, GroupBuy, Participant } from './lib/types';
import Gatekeeper from './components/Gatekeeper';
import GroupBuyList from './components/GroupBuyList';
import GroupBuyDetail from './components/GroupBuyDetail';
import MyPage from './components/MyPage';
import AdminDashboard from './components/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';

type MemberTab = 'home' | 'mypage';
type View =
  | { kind: 'list' }
  | { kind: 'detail'; groupBuyId: string }
  | { kind: 'admin' }
  | { kind: 'mypage' };

function Shell() {
  const { profile, loading, signOut, refresh: refreshProfile } = useAuth();
  const [memberTab, setMemberTab] = useState<MemberTab>('home');
  const [selectedGroupBuyId, setSelectedGroupBuyId] = useState<string | null>(null);

  const authReady = !loading && !!profile;

  const groupBuysHook = useGroupBuys(authReady);
  const profilesHook = useProfiles(authReady);
  const participantsHook = useParticipants(authReady);
  const myParticipationsHook = useMyParticipations(profile?.id);

  const refreshAll = useCallback(() => {
    groupBuysHook.refresh();
    profilesHook.refresh();
    participantsHook.refresh();
    myParticipationsHook.refresh();
    refreshProfile();
  }, [groupBuysHook, profilesHook, participantsHook, myParticipationsHook, refreshProfile]);

  const switchMemberTab = useCallback((tab: MemberTab) => {
    setMemberTab(tab);
    setSelectedGroupBuyId(null);
    window.history.pushState({ view: 'member', tab }, '', `#${tab}`);
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.view === 'member') {
        const t = e.state.tab;
        if (t === 'home' || t === 'mypage') {
          setMemberTab(t);
          setSelectedGroupBuyId(null);
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (profile) {
      const hash = window.location.hash.replace('#', '');
      const valid: MemberTab[] = ['home', 'mypage'];
      if (valid.includes(hash as MemberTab)) {
        setMemberTab(hash as MemberTab);
      }
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-navy-950">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
          <p className="text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <Gatekeeper />;
  }

  const isAdmin = profile.role === 'admin';

  return (
    <ErrorBoundary>
      <ShellContent
        profile={profile}
        isAdmin={isAdmin}
        memberTab={memberTab}
        switchMemberTab={switchMemberTab}
        signOut={signOut}
        selectedGroupBuyId={selectedGroupBuyId}
        setSelectedGroupBuyId={setSelectedGroupBuyId}
        groupBuys={groupBuysHook.items}
        participants={participantsHook.items}
        myParticipations={myParticipationsHook.items}
        profiles={profilesHook.items}
        refreshAll={refreshAll}
      />
    </ErrorBoundary>
  );
}

function ShellContent({
  profile,
  isAdmin,
  memberTab,
  switchMemberTab,
  signOut,
  selectedGroupBuyId,
  setSelectedGroupBuyId,
  groupBuys,
  participants,
  myParticipations,
  profiles,
  refreshAll,
}: {
  profile: Profile;
  isAdmin: boolean;
  memberTab: MemberTab;
  switchMemberTab: (tab: MemberTab) => void;
  signOut: () => Promise<void>;
  selectedGroupBuyId: string | null;
  setSelectedGroupBuyId: (id: string | null) => void;
  groupBuys: GroupBuy[];
  participants: Participant[];
  myParticipations: Participant[];
  profiles: Profile[];
  refreshAll: () => void;
}) {
  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <button
            onClick={() => {
              if (isAdmin) {
                // admin stays in admin view
              } else {
                switchMemberTab('home');
              }
            }}
            className="font-gothic text-xl font-bold tracking-tight text-slate-100 transition hover:text-cyan"
          >
            하이퍼쉴드 공동구매
          </button>
          <div className="flex items-center gap-3">
            <div className="hidden text-right md:block">
              <div className="text-sm font-medium text-slate-100">{profile.full_name}</div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">
                {isAdmin ? 'Administrator' : 'Member'}
              </div>
            </div>
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-navy-950 ${isAdmin ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
              {profile.full_name.slice(0, 1)}
            </div>
            <button onClick={async () => { await signOut(); }} className="btn-ghost px-3 py-2" title="로그아웃">
              <LogOut className="h-4 w-4" />
              <span className="hidden md:inline">로그아웃</span>
            </button>
          </div>
        </div>

        {/* Sub nav for members */}
        {!isAdmin && (
          <div className="mx-auto max-w-7xl px-5 md:px-8">
            <div className="flex gap-1 pb-2">
              <button
                onClick={() => switchMemberTab('home')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'home' ? 'text-cyan' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Home className="h-4 w-4" /> 공동구매
              </button>
              <button
                onClick={() => switchMemberTab('mypage')}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                  memberTab === 'mypage' ? 'text-cyan' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <User className="h-4 w-4" /> 마이페이지
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        {isAdmin ? (
          <AdminDashboard
            profile={profile}
            groupBuys={groupBuys}
            participants={participants}
            profiles={profiles}
            refresh={refreshAll}
          />
        ) : memberTab === 'mypage' ? (
          <MyPage
            profile={profile}
            myParticipations={myParticipations}
            groupBuys={groupBuys}
            onRefresh={refreshAll}
          />
        ) : selectedGroupBuyId ? (
          <GroupBuyDetail
            groupBuy={groupBuys.find((g) => g.id === selectedGroupBuyId) ?? null}
            myParticipation={myParticipations.find((p) => p.group_buy_id === selectedGroupBuyId) ?? null}
            onBack={() => setSelectedGroupBuyId(null)}
            onRefresh={refreshAll}
            currentUserId={profile.id}
          />
        ) : (
          <GroupBuyList
            groupBuys={groupBuys}
            participants={participants}
            myParticipations={myParticipations}
            onSelectGroupBuy={(id) => setSelectedGroupBuyId(id)}
          />
        )}
      </main>

      <footer className="border-t border-navy-700 px-5 py-5 text-center text-xs text-slate-600 md:px-8">
        © {new Date().getFullYear()} Hypershield Group Buy · 베타 서비스 · 계좌이체 결제
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
