import { useCallback } from 'react';
import { LogOut, Shield } from 'lucide-react';
import { AdminAuthProvider, useAdminAuth } from '../lib/adminAuth';
import {
  useAdminProducts, useAdminCategories, useAdminOrders, useAdminOrderItems, useAdminProfiles,
  useAdminPosts, useAdminPlans, useAdminSettings, useAdminInquiries, useAdminReviews,
} from '../lib/adminData';
import AdminDashboard from './AdminDashboard';
import AdminLogin from './AdminLogin';

function AdminAppInner({ onBackToSite }: { onBackToSite: () => void }) {
  const { profile, loading, signOut } = useAdminAuth();

  const productsHook = useAdminProducts(!!profile);
  const categoriesHook = useAdminCategories(!!profile);
  const ordersHook = useAdminOrders(!!profile);
  const orderItemsHook = useAdminOrderItems(!!profile);
  const profilesHook = useAdminProfiles(!!profile);
  const postsHook = useAdminPosts(!!profile);
  const plansHook = useAdminPlans(!!profile);
  const settingsHook = useAdminSettings(!!profile);
  const inquiriesHook = useAdminInquiries(!!profile);
  const reviewsHook = useAdminReviews(!!profile);

  const refreshAll = useCallback(() => {
    productsHook.refresh();
    categoriesHook.refresh();
    ordersHook.refresh();
    orderItemsHook.refresh();
    profilesHook.refresh();
    postsHook.refresh();
    plansHook.refresh();
    settingsHook.refresh();
    inquiriesHook.refresh();
    reviewsHook.refresh();
  }, [productsHook, categoriesHook, ordersHook, orderItemsHook, profilesHook, postsHook, plansHook, settingsHook, inquiriesHook, reviewsHook]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-900">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="text-sm">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <AdminLogin onBackToSite={onBackToSite} />;
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-700 bg-slate-900 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <div className="flex items-center gap-3">
            <div className="text-left">
              <div className="text-[9px] font-medium uppercase tracking-[0.3em] text-slate-500">HYPERSHIELD</div>
              <div className="font-gothic text-base font-bold tracking-tight text-white">관리자 대시보드</div>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-light">
              <Shield className="h-3.5 w-3.5" /> ADMIN
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold-sheen text-sm font-bold text-white">
              {profile.full_name.slice(0, 1)}
            </div>
            <button onClick={async () => { await signOut(); }} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:text-white" title="로그아웃">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        <AdminDashboard
          profile={profile}
          products={productsHook.items}
          categories={categoriesHook.items}
          orders={ordersHook.items}
          orderItems={orderItemsHook.items}
          profiles={profilesHook.items}
          posts={postsHook.items}
          plans={plansHook.items}
          settings={settingsHook.items}
          inquiries={inquiriesHook.items}
          reviews={reviewsHook.items}
          refresh={refreshAll}
        />
      </main>
    </div>
  );
}

export default function AdminApp({ onBackToSite }: { onBackToSite: () => void }) {
  return (
    <AdminAuthProvider>
      <AdminAppInner onBackToSite={onBackToSite} />
    </AdminAuthProvider>
  );
}
