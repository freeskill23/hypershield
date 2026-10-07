import { useState, useCallback, useEffect } from 'react';
import { LogOut, Home, User, Shield, ShoppingCart, Megaphone } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth';
import {
  useProducts, useCategories, useOrders, useProfiles, usePosts,
  useSubscriptionPlans, useCart, useAddresses, useSettings,
} from './lib/data';
import { Profile, Post, Setting } from './lib/types';
import Gatekeeper from './components/Gatekeeper';
import LandingPage from './components/LandingPage';
import BoardList from './components/BoardList';
import BoardDetail from './components/BoardDetail';
import ShopMain from './components/ShopMain';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import MyPage from './components/MyPage';
import AdminDashboard from './components/AdminDashboard';
import ErrorBoundary from './components/ErrorBoundary';

type Route =
  | { name: 'landing' }
  | { name: 'board' }
  | { name: 'post'; postId: string }
  | { name: 'shop' }
  | { name: 'product'; productId: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'mypage' }
  | { name: 'admin' };

function Shell() {
  const { profile, loading, signOut } = useAuth();
  const [route, setRoute] = useState<Route>({ name: 'landing' });
  const [showAuth, setShowAuth] = useState(false);

  const authReady = !loading && !!profile;
  const isAdmin = profile?.role === 'admin';

  const productsHook = useProducts(authReady);
  const categoriesHook = useCategories(authReady);
  const ordersHook = useOrders(authReady);
  const profilesHook = useProfiles(authReady && isAdmin);
  const postsHook = usePosts(true);
  const plansHook = useSubscriptionPlans(true);
  const settingsHook = useSettings(true);
  const cartHook = useCart(profile?.id);
  const addressesHook = useAddresses(profile?.id);

  const refreshAll = useCallback(() => {
    productsHook.refresh();
    categoriesHook.refresh();
    ordersHook.refresh();
    profilesHook.refresh();
    postsHook.refresh();
    plansHook.refresh();
    settingsHook.refresh();
    cartHook.refresh();
    addressesHook.refresh();
  }, [productsHook, categoriesHook, ordersHook, profilesHook, postsHook, plansHook, settingsHook, cartHook, addressesHook]);

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    setShowAuth(false);
    if (r.name === 'landing') window.history.pushState({}, '', '#');
    else if (r.name === 'board') window.history.pushState({}, '', '#board');
    else if (r.name === 'post') window.history.pushState({}, '', `#post/${r.postId}`);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (!profile && !showAuth) {
      if (hash === 'board') setRoute({ name: 'board' });
      else if (hash.startsWith('post/')) setRoute({ name: 'post', postId: hash.slice(5) });
      else setRoute({ name: 'landing' });
    }
  }, [profile, showAuth]);

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

  // Show auth gatekeeper (login/signup overlay)
  if (showAuth && !profile) {
    return <Gatekeeper />;
  }

  // Not logged in — show landing / board / post
  if (!profile) {
    if (route.name === 'board') {
      return (
        <BoardList
          posts={postsHook.items}
          onSelectPost={(id) => navigate({ name: 'post', postId: id })}
          onBack={() => navigate({ name: 'landing' })}
          isAuthenticated={false}
        />
      );
    }
    if (route.name === 'post') {
      const post = postsHook.items.find((p) => p.id === route.postId) ?? null;
      return (
        <BoardDetail
          post={post}
          onBack={() => navigate({ name: 'board' })}
          onEnter={() => setShowAuth(true)}
          isAuthenticated={false}
        />
      );
    }
    return (
      <LandingPage
        onEnter={() => setShowAuth(true)}
        onViewBoard={() => navigate({ name: 'board' })}
        onViewPost={(id) => navigate({ name: 'post', postId: id })}
      />
    );
  }

  // Logged in — enter directly (payment integration will be added later)
  return (
    <ErrorBoundary>
      <ShellContent
        profile={profile}
        isAdmin={!!isAdmin}
        route={route}
        navigate={navigate}
        signOut={signOut}
        refreshAll={refreshAll}
        products={productsHook.items}
        categories={categoriesHook.items}
        orders={ordersHook.items}
        profiles={profilesHook.items}
        posts={postsHook.items}
        plans={plansHook.items}
        settings={settingsHook.items}
        cartItems={cartHook.items}
        addresses={addressesHook.items}
        onRefreshCart={cartHook.refresh}
        cartCount={cartHook.items.length}
      />
    </ErrorBoundary>
  );
}

function ShellContent({
  profile, isAdmin, route, navigate, signOut, refreshAll,
  products, categories, orders, profiles, posts, plans, settings,
  cartItems, addresses, onRefreshCart, cartCount,
}: {
  profile: Profile;
  isAdmin: boolean;
  route: Route;
  navigate: (r: Route) => void;
  signOut: () => Promise<void>;
  refreshAll: () => void;
  products: any[];
  categories: any[];
  orders: any[];
  profiles: any[];
  posts: Post[];
  plans: any[];
  settings: Setting[];
  cartItems: any[];
  addresses: any[];
  onRefreshCart: () => void;
  cartCount: number;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <button
            onClick={() => navigate(isAdmin ? { name: 'admin' } : { name: 'shop' })}
            className="text-left transition hover:text-cyan"
          >
            <div className="text-[9px] font-medium uppercase tracking-[0.3em] text-slate-500">HYPERSHIELD</div>
            <div className="font-gothic text-base font-bold tracking-tight text-slate-800">노애드 세차클럽</div>
          </button>

          <div className="flex items-center gap-3">
            {!isAdmin && (
              <>
                <button
                  onClick={() => navigate({ name: 'board' })}
                  className="hidden items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-slate-700 md:flex"
                >
                  <Megaphone className="h-4 w-4" /> 하이퍼쉴드의 생각
                </button>
                <button
                  onClick={() => navigate({ name: 'shop' })}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                    route.name === 'shop' || route.name === 'product' ? 'text-cyan' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Home className="h-4 w-4" /> 쇼핑몰
                </button>
                <button
                  onClick={() => navigate({ name: 'cart' })}
                  className={`relative flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                    route.name === 'cart' || route.name === 'checkout' ? 'text-cyan' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <ShoppingCart className="h-4 w-4" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-cyan px-1 text-[10px] font-bold text-white">
                      {cartCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => navigate({ name: 'mypage' })}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition ${
                    route.name === 'mypage' ? 'text-cyan' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <User className="h-4 w-4" /> 마이
                </button>
              </>
            )}
            {isAdmin && (
              <span className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-light">
                <Shield className="h-3.5 w-3.5" /> ADMIN
              </span>
            )}
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${isAdmin ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
              {profile.full_name.slice(0, 1)}
            </div>
            <button onClick={async () => { await signOut(); }} className="btn-ghost px-3 py-2" title="로그아웃">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        {isAdmin ? (
          <AdminDashboard
            profile={profile}
            products={products}
            categories={categories}
            orders={orders}
            profiles={profiles}
            posts={posts}
            plans={plans}
            settings={settings}
            refresh={refreshAll}
          />
        ) : route.name === 'board' ? (
          <BoardList
            posts={posts}
            onSelectPost={(id) => navigate({ name: 'post', postId: id })}
            onBack={() => navigate({ name: 'shop' })}
            isAuthenticated={true}
          />
        ) : route.name === 'post' ? (
          <BoardDetail
            post={posts.find((p) => p.id === route.postId) ?? null}
            onBack={() => navigate({ name: 'board' })}
            isAuthenticated={true}
          />
        ) : route.name === 'product' ? (
          <ProductDetail
            product={products.find((p) => p.id === route.productId) ?? null}
            onBack={() => navigate({ name: 'shop' })}
            onGoCart={() => navigate({ name: 'cart' })}
          />
        ) : route.name === 'cart' ? (
          <Cart
            cartItems={cartItems}
            onBack={() => navigate({ name: 'shop' })}
            onCheckout={() => navigate({ name: 'checkout' })}
            onRefresh={onRefreshCart}
          />
        ) : route.name === 'checkout' ? (
          <Checkout
            cartItems={cartItems}
            addresses={addresses}
            userId={profile.id}
            onBack={() => navigate({ name: 'cart' })}
            onComplete={() => {
              refreshAll();
              navigate({ name: 'mypage' });
            }}
          />
        ) : route.name === 'mypage' ? (
          <MyPage
            profile={profile}
            orders={orders}
            addresses={addresses}
            plans={plans}
            onRefresh={refreshAll}
          />
        ) : (
          <ShopMain
            products={products}
            categories={categories}
            onSelectProduct={(id) => navigate({ name: 'product', productId: id })}
            onSelectCategory={setSelectedCategoryId}
            selectedCategoryId={selectedCategoryId}
          />
        )}
      </main>

      <footer className="border-t border-navy-700 px-5 py-5 text-center text-xs text-slate-600 md:px-8">
        © {new Date().getFullYear()} Hypershield · 노애드 세차클럽
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
