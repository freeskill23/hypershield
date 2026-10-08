import { useState, useCallback, useEffect } from 'react';
import { LogOut, User, ShoppingCart } from 'lucide-react';
import { AuthProvider, useAuth } from './lib/auth';
import {
  useProducts, useCategories, useOrders, useUserOrderItems, useProfiles, usePosts,
  useSubscriptionPlans, useCart, useAddresses, useSettings, useInquiries, useReviews,
} from './lib/data';
import { Profile, Post, Setting, Product, SelectedOption, Inquiry } from './lib/types';
import Gatekeeper from './components/Gatekeeper';
import LandingPage from './components/LandingPage';
import BoardList from './components/BoardList';
import BoardDetail from './components/BoardDetail';
import ShopMain from './components/ShopMain';
import ProductDetail from './components/ProductDetail';
import Cart from './components/Cart';
import Checkout from './components/Checkout';
import MyPage from './components/MyPage';
import AdminApp from './components/AdminApp';
import ErrorBoundary from './components/ErrorBoundary';

type Route =
  | { name: 'landing' }
  | { name: 'board' }
  | { name: 'post'; postId: string }
  | { name: 'shop' }
  | { name: 'product'; productId: string }
  | { name: 'cart' }
  | { name: 'checkout' }
  | { name: 'mypage' };

function routeToHash(r: Route): string {
  switch (r.name) {
    case 'landing': return '';
    case 'board': return '#board';
    case 'post': return `#post/${r.postId}`;
    case 'shop': return '#shop';
    case 'product': return `#product/${r.productId}`;
    case 'cart': return '#cart';
    case 'checkout': return '#checkout';
    case 'mypage': return '#mypage';
  }
}

function hashToRoute(hash: string): Route {
  const h = hash.replace('#', '');
  if (h === 'board') return { name: 'board' };
  if (h.startsWith('post/')) return { name: 'post', postId: h.slice(5) };
  if (h === 'shop') return { name: 'shop' };
  if (h.startsWith('product/')) return { name: 'product', productId: h.slice(8) };
  if (h === 'cart') return { name: 'cart' };
  if (h === 'checkout') return { name: 'checkout' };
  if (h === 'mypage') return { name: 'mypage' };
  return { name: 'landing' };
}

function Shell() {
  const { profile, loading, signOut } = useAuth();
  const [route, setRoute] = useState<Route>(() => hashToRoute(window.location.hash));
  const [showAuth, setShowAuth] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<{ product: Product; quantity: number; selected_options?: SelectedOption[] } | null>(null);

  const authReady = !loading && !!profile;

  const productsHook = useProducts(authReady);
  const categoriesHook = useCategories(authReady);
  const ordersHook = useOrders(authReady);
  const orderItemsHook = useUserOrderItems(profile?.id, authReady);
  const profilesHook = useProfiles(authReady && profile?.role === 'admin');
  const postsHook = usePosts(true);
  const plansHook = useSubscriptionPlans(true);
  const settingsHook = useSettings(true);
  const cartHook = useCart(profile?.id);
  const addressesHook = useAddresses(profile?.id);
  const inquiriesHook = useInquiries(profile?.id, authReady);
  const reviewsHook = useReviews(true);

  const refreshAll = useCallback(() => {
    productsHook.refresh();
    categoriesHook.refresh();
    ordersHook.refresh();
    orderItemsHook.refresh();
    profilesHook.refresh();
    postsHook.refresh();
    plansHook.refresh();
    settingsHook.refresh();
    cartHook.refresh();
    addressesHook.refresh();
    inquiriesHook.refresh();
    reviewsHook.refresh();
  }, [productsHook, categoriesHook, ordersHook, orderItemsHook, profilesHook, postsHook, plansHook, settingsHook, cartHook, addressesHook, inquiriesHook, reviewsHook]);

  const navigate = useCallback((r: Route) => {
    setRoute(r);
    setShowAuth(false);
    const hash = routeToHash(r);
    if (window.location.hash !== hash) {
      window.history.pushState({}, '', hash || '#');
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(hashToRoute(window.location.hash));
      setShowAuth(false);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (profile) return;
    if (showAuth) return;
    const hash = window.location.hash.replace('#', '');
    if (hash === 'board') setRoute({ name: 'board' });
    else if (hash.startsWith('post/')) setRoute({ name: 'post', postId: hash.slice(5) });
    else setRoute({ name: 'landing' });
  }, [profile, showAuth, loading]);

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

  if (showAuth && !profile) {
    return <Gatekeeper />;
  }

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

  return (
    <ErrorBoundary>
      <ShellContent
        profile={profile}
        route={route}
        navigate={navigate}
        signOut={signOut}
        refreshAll={refreshAll}
        products={productsHook.items}
        categories={categoriesHook.items}
        orders={ordersHook.items}
        orderItems={orderItemsHook.items}
        profiles={profilesHook.items}
        posts={postsHook.items}
        plans={plansHook.items}
        settings={settingsHook.items}
        cartItems={cartHook.items}
        addresses={addressesHook.items}
        inquiries={inquiriesHook.items}
        reviews={reviewsHook.items}
        onRefreshCart={cartHook.refresh}
        cartCount={cartHook.items.length}
        buyNowItem={buyNowItem}
        onBuyNow={(item) => { setBuyNowItem(item); navigate({ name: 'checkout' }); }}
      />
    </ErrorBoundary>
  );
}

function ShellContent({
  profile, route, navigate, signOut, refreshAll,
  products, categories, orders, orderItems, profiles, posts, plans, settings,
  cartItems, addresses, inquiries, reviews, onRefreshCart, cartCount,
  buyNowItem, onBuyNow,
}: {
  profile: Profile;
  route: Route;
  navigate: (r: Route) => void;
  signOut: () => Promise<void>;
  refreshAll: () => void;
  products: any[];
  categories: any[];
  orders: any[];
  orderItems: any[];
  profiles: any[];
  posts: Post[];
  plans: any[];
  settings: Setting[];
  cartItems: any[];
  addresses: any[];
  inquiries: Inquiry[];
  reviews: any[];
  onRefreshCart: () => void;
  cartCount: number;
  buyNowItem: { product: Product; quantity: number; selected_options?: SelectedOption[] } | null;
  onBuyNow: (item: { product: Product; quantity: number; selected_options?: SelectedOption[] }) => void;
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 md:px-8">
          <button
            onClick={() => navigate({ name: 'shop' })}
            className="text-left transition hover:text-cyan"
          >
            <div className="text-[9px] font-medium uppercase tracking-[0.3em] text-slate-500">HYPERSHIELD</div>
            <div className="font-gothic text-base font-bold tracking-tight text-slate-800">하이퍼쉴드 멤버쉽</div>
          </button>

          <div className="flex items-center gap-3">
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
            <div className="grid h-9 w-9 place-items-center rounded-full bg-cyan-sheen text-sm font-bold text-white">
              {profile.full_name.slice(0, 1)}
            </div>
            <button onClick={async () => { await signOut(); }} className="btn-ghost px-3 py-2" title="로그아웃">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-6 md:px-8 md:py-8">
        {route.name === 'board' ? (
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
            settings={settings}
            reviews={reviews.filter((r: any) => r.product_id === route.productId)}
            onBack={() => navigate({ name: 'shop' })}
            onGoCart={() => { onRefreshCart(); navigate({ name: 'cart' }); }}
            onBuyNow={onBuyNow}
            onAddedToCart={onRefreshCart}
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
            buyNowItem={buyNowItem}
            addresses={addresses}
            userId={profile.id}
            settings={settings}
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
            orderItems={orderItems}
            addresses={addresses}
            plans={plans}
            inquiries={inquiries}
            reviews={reviews}
            products={products}
            onRefresh={refreshAll}
          />
        ) : (
          <ShopMain
            products={products}
            categories={categories}
            userTier={profile.subscription_tier}
            onSelectProduct={(id) => navigate({ name: 'product', productId: id })}
            onSelectCategory={setSelectedCategoryId}
            selectedCategoryId={selectedCategoryId}
            onGoBoard={() => navigate({ name: 'board' })}
          />
        )}
      </main>

      <footer className="border-t border-navy-700 px-5 py-6 text-center text-xs text-slate-600 md:px-8">
        <div className="mx-auto max-w-3xl space-y-2 leading-relaxed">
          <p>제이피지 대표자 : 김진수</p>
          <p>사업자등록번호 : 132-18-80228</p>
          <p>주소 : 경기도 포천시 내촌면 금강로 2480-47</p>
          <p>연락처 : 031-535-1799</p>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
          <span>© {new Date().getFullYear()} Hypershield · 하이퍼쉴드 멤버쉽</span>
          <a href="#admin" className="text-slate-500 transition hover:text-slate-400">관리자</a>
        </div>
      </footer>
    </div>
  );
}

function AppRouter() {
  const [isAdminRoute, setIsAdminRoute] = useState(
    () => window.location.hash.replace('#', '').startsWith('admin'),
  );

  useEffect(() => {
    const onHashChange = () => {
      setIsAdminRoute(window.location.hash.replace('#', '').startsWith('admin'));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (isAdminRoute) {
    return <AdminApp onBackToSite={() => { window.location.replace(window.location.pathname + window.location.search); }} />;
  }
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

export default function App() {
  return <AppRouter />;
}
