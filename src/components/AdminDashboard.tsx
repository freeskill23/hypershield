import { useState, useMemo } from 'react';
import {
  Plus, Package, Users, ShoppingBag, TrendingUp, Clock, CheckCircle2,
  XCircle, Trash2, Edit2, Banknote, Truck, MapPin, Calendar, Tag,
  AlertCircle, Building2, Crown, Megaphone, Eye, Lock, Pin, Link2,
  Loader2, Search, User as UserIcon, Flame,
} from 'lucide-react';
import {
  Profile, Product, Category, Order, Post, SubscriptionPlan, OrderStatus, Setting,
} from '../lib/types';
import { formatKRW, formatDate, formatDateTime, calcDiscountRate } from '../lib/format';
import {
  createProduct, updateProduct, deleteProduct,
  createCategory, updateCategory, deleteCategory,
  createPost, updatePost, deletePost,
  createPlan, updatePlan, deletePlan,
  updateOrderStatus, setProfileRole, deleteProfile,
  activateSubscription, deactivateSubscription, fetchProductInfo,
  updateSetting, getSettingValue,
} from '../lib/adminData';

type Tab = 'overview' | 'products' | 'orders' | 'members' | 'posts' | 'plans';

interface Props {
  profile: Profile; products: Product[]; categories: Category[]; orders: Order[];
  profiles: Profile[]; posts: Post[]; plans: SubscriptionPlan[]; settings: Setting[]; refresh: () => void;
}

interface ProductForm { name: string; category_id: string; original_price: string; club_price: string; description: string; image_url: string; sub_images: string; sku: string; stock: string; is_active: boolean; sort_order: string; }
const emptyProductForm: ProductForm = { name: '', category_id: '', original_price: '', club_price: '', description: '', image_url: '', sub_images: '', sku: '', stock: '100', is_active: true, sort_order: '0' };

interface PostForm { title: string; content: string; excerpt: string; category: string; visibility: 'public' | 'members'; is_pinned: boolean; }
const emptyPostForm: PostForm = { title: '', content: '', excerpt: '', category: '', visibility: 'public', is_pinned: false };

interface PlanForm { name: string; tier: string; monthly_price: string; discount_rate: string; description: string; is_active: boolean; sort_order: string; }
const emptyPlanForm: PlanForm = { name: '', tier: '', monthly_price: '', discount_rate: '', description: '', is_active: true, sort_order: '0' };

const orderStatusConfig: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: '결제 대기', cls: 'border-gold/40 text-gold-light bg-gold/5' },
  paid: { label: '결제 완료', cls: 'border-cyan/40 text-cyan bg-cyan/5' },
  preparing: { label: '배송 준비', cls: 'border-cyan/40 text-cyan bg-cyan/5' },
  shipped: { label: '배송 중', cls: 'border-cyan/40 text-cyan bg-cyan/5' },
  delivered: { label: '배송 완료', cls: 'border-green-500/40 text-green-400 bg-green-500/5' },
  cancelled: { label: '주문 취소', cls: 'border-slate-600 text-slate-500 bg-slate-700/20' },
};

const fallbackOrderStatus = { label: '상태 확인 필요', cls: 'border-slate-600 text-slate-500 bg-slate-700/20' };

const subStatusConfig: Record<string, { label: string; cls: string }> = {
  none: { label: '미가입', cls: 'border-slate-600 text-slate-400' },
  active: { label: '활성', cls: 'border-green-500/40 text-green-400 bg-green-500/5' },
  past_due: { label: '연체', cls: 'border-red-500/40 text-red-400 bg-red-500/5' },
  cancelled: { label: '취소', cls: 'border-slate-600 text-slate-500' },
  expired: { label: '만료', cls: 'border-slate-600 text-slate-500' },
};

const IconBtn = ({ onClick, title, icon: Icon, hover }: any) => (
  <button onClick={onClick} title={title}
    className={`grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 ${hover}`}>
    <Icon className="h-3.5 w-3.5" />
  </button>
);

export default function AdminDashboard({ profile, products, categories, orders, profiles, posts, plans, settings, refresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);

  const recruitmentOpen = getSettingValue(settings, 'recruitment_open') !== 'false';
  const recruitmentLimit = parseInt(getSettingValue(settings, 'recruitment_limit') ?? '500', 10);
  const recruitmentBatch = getSettingValue(settings, 'recruitment_batch') ?? '1';
  const activeSubs = profiles.filter(p => p.subscription_status === 'active').length;

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pf, setPf] = useState<ProductForm>(emptyProductForm);
  const [productUrl, setProductUrl] = useState('');
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [fetchStore, setFetchStore] = useState<string | null>(null);

  const [newCat, setNewCat] = useState('');
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  const [showPostForm, setShowPostForm] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [postF, setPostF] = useState<PostForm>(emptyPostForm);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [planF, setPlanF] = useState<PlanForm>(emptyPlanForm);

  const [tracking, setTracking] = useState<Record<string, { carrier: string; number: string }>>({});
  const [actMemberId, setActMemberId] = useState<string | null>(null);
  const [actPlanId, setActPlanId] = useState('');

  const stats = useMemo(() => ({
    totalMembers: profiles.length,
    activeSubs: profiles.filter(p => p.subscription_status === 'active').length,
    totalOrders: orders.length,
    confirmedRevenue: orders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0),
  }), [profiles, orders]);

  // ── Product ──
  function openCreateProduct() { setEditProduct(null); setPf(emptyProductForm); setProductUrl(''); setFetchErr(null); setFetchStore(null); setShowProductForm(true); }
  function openEditProduct(p: Product) {
    setEditProduct(p);
    setPf({ name: p.name, category_id: p.category_id ?? '', original_price: String(p.original_price), club_price: String(p.club_price), description: p.description ?? '', image_url: p.image_url ?? '', sub_images: (p.sub_images ?? []).join('\n'), sku: p.sku ?? '', stock: String(p.stock), is_active: p.is_active, sort_order: String(p.sort_order) });
    setShowProductForm(true);
  }
  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const cat = categories.find(c => c.id === pf.category_id);
      const sub = pf.sub_images.trim() ? pf.sub_images.split('\n').map(s => s.trim()).filter(Boolean) : null;
      const common = {
        name: pf.name.trim(), category: cat?.name ?? '', category_id: pf.category_id || null,
        original_price: Number(pf.original_price) || 0, club_price: Number(pf.club_price) || 0,
        image_url: pf.image_url.trim() || null, sub_images: sub, sku: pf.sku.trim() || null,
        stock: Number(pf.stock) || 0, sort_order: Number(pf.sort_order) || 0,
      };
      if (editProduct) await updateProduct(editProduct.id, { ...common, description: pf.description.trim() || null, is_active: pf.is_active });
      else await createProduct({ ...common, description: pf.description.trim() || undefined });
      setShowProductForm(false); refresh();
    } finally { setBusy(false); }
  }
  async function handleFetchProduct() {
    if (!productUrl.trim()) return;
    setFetching(true); setFetchErr(null);
    try {
      const info = await fetchProductInfo(productUrl.trim());
      setPf(prev => ({
        ...prev,
        name: prev.name || info.title || '',
        description: prev.description || info.description || '',
        image_url: prev.image_url || info.image_url || '',
        original_price: prev.original_price || (info.original_price ? String(info.original_price) : ''),
      }));
      setFetchStore(info.store_name ?? null);
    } catch (e: any) { setFetchErr(e.message || '상품 정보를 가져오지 못했습니다.'); }
    finally { setFetching(false); }
  }
  async function handleDeleteProduct(p: Product) { if (confirm(`'${p.name}' 상품을 삭제하시겠습니까?`)) { await deleteProduct(p.id); refresh(); } }
  async function handleToggleActive(p: Product) { await updateProduct(p.id, { is_active: !p.is_active }); refresh(); }

  // ── Category ──
  async function handleAddCategory() { if (newCat.trim()) { await createCategory(newCat.trim(), categories.length); setNewCat(''); refresh(); } }
  async function handleDeleteCategory(c: Category) { if (confirm(`'${c.name}' 카테고리를 삭제하시겠습니까?`)) { await deleteCategory(c.id); refresh(); } }
  async function handleRenameCategory(c: Category) { if (editCatName.trim()) { await updateCategory(c.id, { name: editCatName.trim() }); setEditCatId(null); setEditCatName(''); refresh(); } }

  // ── Order ──
  async function handleOrderStatus(o: Order, status: OrderStatus, extra?: Partial<Order>) { await updateOrderStatus(o.id, status, extra); refresh(); }
  async function handleShipOrder(o: Order) {
    const ti = tracking[o.id];
    await updateOrderStatus(o.id, 'shipped', { tracking_number: ti?.number || o.tracking_number || null, carrier: ti?.carrier || o.carrier || null });
    setTracking(prev => { const n = { ...prev }; delete n[o.id]; return n; }); refresh();
  }

  // ── Member ──
  async function handleToggleRole(p: Profile) { await setProfileRole(p.id, p.role === 'admin' ? 'member' : 'admin'); refresh(); }
  async function handleDeleteProfileAction(p: Profile) { if (confirm(`${p.full_name} 회원을 삭제하시겠습니까?`)) { await deleteProfile(p.id); refresh(); } }
  async function handleActivateSub(p: Profile) {
    const plan = plans.find(pl => pl.id === actPlanId); if (!plan) return;
    await activateSubscription(p.id, plan.id, plan.tier, 1); setActMemberId(null); setActPlanId(''); refresh();
  }
  async function handleDeactivateSub(p: Profile) { if (confirm(`${p.full_name}의 구독을 비활성화하시겠습니까?`)) { await deactivateSubscription(p.id); refresh(); } }

  // ── Post ──
  function openCreatePost() { setEditPost(null); setPostF(emptyPostForm); setShowPostForm(true); }
  function openEditPost(p: Post) { setEditPost(p); setPostF({ title: p.title, content: p.content, excerpt: p.excerpt ?? '', category: p.category ?? '', visibility: p.visibility, is_pinned: p.is_pinned }); setShowPostForm(true); }
  async function handlePostSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const data = { title: postF.title.trim(), content: postF.content.trim(), excerpt: postF.excerpt.trim() || null, category: postF.category.trim() || null, visibility: postF.visibility, is_pinned: postF.is_pinned };
      if (editPost) await updatePost(editPost.id, data);
      else await createPost({ ...data, excerpt: data.excerpt ?? undefined, category: data.category ?? undefined });
      setShowPostForm(false); refresh();
    } finally { setBusy(false); }
  }
  async function handleDeletePost(p: Post) { if (confirm(`'${p.title}' 게시글을 삭제하시겠습니까?`)) { await deletePost(p.id); refresh(); } }

  // ── Plan ──
  function openCreatePlan() { setEditPlan(null); setPlanF(emptyPlanForm); setShowPlanForm(true); }
  function openEditPlan(p: SubscriptionPlan) { setEditPlan(p); setPlanF({ name: p.name, tier: p.tier, monthly_price: String(p.monthly_price), discount_rate: String(p.discount_rate), description: p.description ?? '', is_active: p.is_active, sort_order: String(p.sort_order) }); setShowPlanForm(true); }
  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const input = { name: planF.name.trim(), description: planF.description.trim() || null, monthly_price: Number(planF.monthly_price) || 0, tier: planF.tier.trim(), discount_rate: Number(planF.discount_rate) || 0, is_active: planF.is_active, sort_order: Number(planF.sort_order) || 0 };
      if (editPlan) await updatePlan(editPlan.id, input); else await createPlan(input);
      setShowPlanForm(false); refresh();
    } finally { setBusy(false); }
  }
  async function handleDeletePlan(p: SubscriptionPlan) { if (confirm(`'${p.name}' 등급을 삭제하시겠습니까?`)) { await deletePlan(p.id); refresh(); } }

  // ── Recruitment ──
  async function handleToggleRecruitment() { await updateSetting('recruitment_open', recruitmentOpen ? 'false' : 'true'); refresh(); }
  async function handleRecruitmentLimit(e: React.FormEvent) {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).elements.namedItem('limit') as HTMLInputElement;
    const val = parseInt(input.value, 10);
    if (val > 0) { await updateSetting('recruitment_limit', String(val)); refresh(); }
  }
  async function handleNewBatch() {
    if (!confirm('새 모집 차수를 시작하시겠습니까? 모집 상태가 열림으로 변경됩니다.')) return;
    const next = String(parseInt(recruitmentBatch, 10) + 1);
    await updateSetting('recruitment_batch', next);
    await updateSetting('recruitment_open', 'true');
    refresh();
  }

  const tabs: [Tab, string][] = [['overview', '대시보드'], ['products', '상품 관리'], ['orders', '주문 관리'], ['members', '회원 관리'], ['posts', '게시판 관리'], ['plans', '회원 등급']];

  const Field = ({ label, children }: any) => (
    <div><label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>{children}</div>
  );

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users} label="총 회원" value={String(stats.totalMembers)} accent="cyan" />
        <KpiCard icon={Crown} label="활성 구독" value={String(stats.activeSubs)} accent="gold" />
        <KpiCard icon={ShoppingBag} label="총 주문" value={String(stats.totalOrders)} accent="cyan" />
        <KpiCard icon={TrendingUp} label="확정 매출" value={formatKRW(stats.confirmedRevenue)} accent="gold" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === k ? 'bg-cyan text-white shadow-glow' : 'text-slate-400 hover:text-slate-700'}`}>{label}</button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Recruitment status */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                <Flame className="h-4 w-4 text-gold" /> 구독자 모집 설정
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${recruitmentOpen ? 'border-green-500/40 text-green-400 bg-green-500/5' : 'border-red-500/40 text-red-400 bg-red-500/5'}`}>
                {recruitmentOpen ? <><CheckCircle2 className="h-3 w-3" /> 모집 중</> : <><XCircle className="h-3 w-3" /> 모집 마감</>}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-navy-700 bg-slate-50 p-4 text-center">
                <div className="text-xs text-slate-500">현재 차수</div>
                <div className="font-gothic text-2xl font-bold text-slate-800">{recruitmentBatch}차</div>
              </div>
              <div className="rounded-lg border border-navy-700 bg-slate-50 p-4 text-center">
                <div className="text-xs text-slate-500">모집 정원</div>
                <div className="font-gothic text-2xl font-bold text-slate-800">{recruitmentLimit}명</div>
              </div>
              <div className="rounded-lg border border-navy-700 bg-slate-50 p-4 text-center">
                <div className="text-xs text-slate-500">현재 구독자</div>
                <div className="font-gothic text-2xl font-bold text-cyan">{activeSubs}명</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-navy-700 pt-4">
              <button onClick={handleToggleRecruitment} className={recruitmentOpen ? 'btn-ghost px-4 py-2 text-sm hover:text-red-400' : 'btn-primary px-4 py-2 text-sm'}>
                {recruitmentOpen ? <><XCircle className="h-4 w-4" /> 모집 마감</> : <><CheckCircle2 className="h-4 w-4" /> 모집 재개</>}
              </button>
              <form onSubmit={handleRecruitmentLimit} className="flex items-center gap-2">
                <input name="limit" type="number" min={1} defaultValue={recruitmentLimit} className="input-field h-9 w-24 px-2 py-1 text-sm" />
                <button type="submit" className="btn-ghost h-9 px-3 py-2 text-sm">정원 변경</button>
              </form>
              <button onClick={handleNewBatch} className="btn-gold px-4 py-2 text-sm">
                <Plus className="h-4 w-4" /> 다음 차수 시작
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              모집 마감 시 랜딩 페이지에 마감 표시가 나타납니다. 다음 차수 시작 시 차수 번호가 1 증가하고 모집이 자동으로 열립니다.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800"><ShoppingBag className="h-4 w-4 text-cyan" /> 최근 주문</div>
            <div className="space-y-2">
              {orders.slice(0, 6).map(o => {
                const sc = orderStatusConfig[o.status] ?? fallbackOrderStatus;
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-slate-50 px-3 py-2.5">
                    <div><div className="text-sm font-medium text-slate-800">{o.recipient_name ?? '알 수 없음'}</div><div className="text-xs text-slate-500">{formatKRW(o.total_amount)} · {formatDate(o.created_at)}</div></div>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${sc.cls}`}>{o.status === 'pending' && <Clock className="h-3 w-3" />}{sc.label}</span>
                  </div>
                );
              })}
              {orders.length === 0 && <div className="py-8 text-center text-sm text-slate-500">주문이 없습니다.</div>}
            </div>
          </div>
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800"><Users className="h-4 w-4 text-gold" /> 최근 가입 회원</div>
            <div className="space-y-2">
              {profiles.slice(0, 6).map(p => {
                const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                      <div><div className="text-sm font-medium text-slate-800">{p.full_name}</div><div className="text-xs text-slate-500">{p.email}</div></div>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                  </div>
                );
              })}
              {profiles.length === 0 && <div className="py-8 text-center text-sm text-slate-500">회원이 없습니다.</div>}
            </div>
          </div>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === 'products' && (
        <div className="space-y-4">
          {/* Categories */}
          <div className="card-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-gothic text-sm font-semibold text-slate-700"><Tag className="h-4 w-4 text-cyan" /> 카테고리 관리</div>
            <div className="flex flex-wrap items-center gap-2">
              {categories.map(c => (
                <div key={c.id} className="flex items-center gap-1">
                  {editCatId === c.id ? (
                    <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(c); if (e.key === 'Escape') { setEditCatId(null); setEditCatName(''); } }}
                      onBlur={() => { if (editCatId === c.id) handleRenameCategory(c); }} autoFocus className="input-field h-7 w-28 px-2 py-1 text-xs" />
                  ) : (
                    <span onClick={() => { setEditCatId(c.id); setEditCatName(c.name); }} className="chip cursor-pointer hover:border-cyan hover:text-cyan">{c.name}</span>
                  )}
                  <button onClick={() => handleDeleteCategory(c)} className="text-slate-600 hover:text-red-400"><XCircle className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              {categories.length === 0 && <span className="text-xs text-slate-600">카테고리가 없습니다.</span>}
            </div>
            <div className="mt-3 flex gap-2">
              <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }} placeholder="새 카테고리 이름" className="input-field h-9 w-48 py-2 text-sm" />
              <button onClick={handleAddCategory} disabled={!newCat.trim()} className="btn-ghost h-9 px-3 py-2 text-sm"><Plus className="h-4 w-4" /> 추가</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">상품 관리</h2>
            <button onClick={openCreateProduct} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 상품 등록</button>
          </div>

          {showProductForm && (
            <form onSubmit={handleProductSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-800">{editProduct ? '상품 수정' : '새 상품 등록'}</h3>
                <button type="button" onClick={() => setShowProductForm(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
              </div>

              {/* Smart store URL fetch */}
              {!editProduct && (
                <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4">
                  <label className="mb-1.5 block text-xs font-medium text-cyan">스마트스토어 URL에서 가져오기</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input value={productUrl} onChange={e => setProductUrl(e.target.value)} placeholder="https://smartstore.naver.com/..." className="input-field pl-9 text-sm" onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleFetchProduct(); } }} />
                    </div>
                    <button type="button" onClick={handleFetchProduct} disabled={fetching || !productUrl.trim()} className="btn-primary px-4 py-2.5 text-sm whitespace-nowrap">
                      {fetching ? <><Loader2 className="h-4 w-4 animate-spin" /> 가져오는 중...</> : <><Search className="h-4 w-4" /> 가져오기</>}
                    </button>
                  </div>
                  {fetchErr && <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{fetchErr}</span></div>}
                  {fetchStore && <div className="mt-2 flex items-center gap-2 text-xs text-green-400"><Building2 className="h-3.5 w-3.5" /> 스토어: {fetchStore}</div>}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Field label="상품명"><input required value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} className="input-field" /></Field></div>
                <Field label="카테고리">
                  <select value={pf.category_id} onChange={e => setPf({ ...pf, category_id: e.target.value })} className="input-field"><option value="">카테고리 선택</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </Field>
                <Field label="SKU"><input value={pf.sku} onChange={e => setPf({ ...pf, sku: e.target.value })} placeholder="SKU-001" className="input-field" /></Field>
                <Field label="정상가 (원)"><input required type="number" value={pf.original_price} onChange={e => setPf({ ...pf, original_price: e.target.value })} placeholder="89000" className="input-field" /></Field>
                <Field label="회원가 (원)"><input required type="number" value={pf.club_price} onChange={e => setPf({ ...pf, club_price: e.target.value })} placeholder="69000" className="input-field" /></Field>
                <div className="md:col-span-2"><Field label="상품 설명"><textarea value={pf.description} onChange={e => setPf({ ...pf, description: e.target.value })} rows={3} className="input-field resize-none" /></Field></div>
                <div className="md:col-span-2"><Field label="대표 이미지 URL"><input value={pf.image_url} onChange={e => setPf({ ...pf, image_url: e.target.value })} placeholder="https://..." className="input-field" /></Field></div>
                <div className="md:col-span-2"><Field label="서브 이미지 URL (한 줄에 하나씩)"><textarea value={pf.sub_images} onChange={e => setPf({ ...pf, sub_images: e.target.value })} rows={3} className="input-field resize-none" /></Field></div>
                <Field label="재고"><input type="number" value={pf.stock} onChange={e => setPf({ ...pf, stock: e.target.value })} className="input-field" /></Field>
                <Field label="정렬 순서"><input type="number" value={pf.sort_order} onChange={e => setPf({ ...pf, sort_order: e.target.value })} className="input-field" /></Field>
                {editProduct && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pf.is_active} onChange={e => setPf({ ...pf, is_active: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /> 판매 중</label>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">{busy ? '저장 중...' : editProduct ? '수정하기' : '등록하기'}</button>
                <button type="button" onClick={() => setShowProductForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}

          {/* Product list */}
          <div className="space-y-3">
            {products.map(p => {
              const discount = calcDiscountRate(p.original_price, p.club_price);
              return (
                <div key={p.id} className="card-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {p.image_url ? <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-lg bg-navy-800"><Package className="h-5 w-5 text-slate-600" /></div>}
                      <div>
                        <h3 className="font-gothic text-base font-semibold text-slate-800">{p.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {p.category || '미분류'}</span>
                          <span className="text-cyan">{formatKRW(p.club_price)}</span>
                          {discount > 0 && <span className="text-red-400">{discount}%</span>}
                          <span>재고 {p.stock}</span>
                          {!p.is_active && <span className="text-red-400">판매 중단</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IconBtn onClick={() => handleToggleActive(p)} title={p.is_active ? '판매 중단' : '판매 시작'} icon={p.is_active ? CheckCircle2 : XCircle} hover="hover:border-cyan hover:text-cyan" />
                      <IconBtn onClick={() => openEditProduct(p)} title="수정" icon={Edit2} hover="hover:border-cyan hover:text-cyan" />
                      <IconBtn onClick={() => handleDeleteProduct(p)} title="삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />
                    </div>
                  </div>
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="card-surface grid place-items-center py-16 text-center">
                <Package className="mb-3 h-10 w-10 text-slate-700" />
                <p className="text-sm text-slate-500">등록된 상품이 없습니다.</p>
                <button onClick={openCreateProduct} className="btn-primary mt-4 px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 첫 상품 등록</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Orders ── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">주문 관리</h2>
          {orders.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center"><ShoppingBag className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">주문이 없습니다。</p></div>
          ) : (
            <div className="space-y-3">
              {orders.map(o => {
                const sc = orderStatusConfig[o.status] ?? fallbackOrderStatus;
                const ti = tracking[o.id];
                return (
                  <div key={o.id} className="card-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-gothic text-base font-semibold text-slate-800">{o.recipient_name ?? '알 수 없음'}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{o.status === 'pending' && <Clock className="h-3 w-3" />}{sc.label}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(o.created_at)}</span>
                          <span className="flex items-center gap-1 text-cyan"><Banknote className="h-3 w-3" /> {formatKRW(o.total_amount)}</span>
                          {o.points_used > 0 && <span>포인트 사용 {formatKRW(o.points_used)}</span>}
                        </div>
                        {o.address && <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span>{o.address} {o.address_detail} · {o.recipient_phone}</span></div>}
                        {o.tracking_number && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Truck className="h-3 w-3" /><span>{o.carrier} {o.tracking_number}</span></div>}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                      {o.status === 'pending' && (<>
                        <button onClick={() => handleOrderStatus(o, 'paid')} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 결제 확인</button>
                        <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400"><XCircle className="h-3.5 w-3.5" /> 주문 취소</button>
                      </>)}
                      {o.status === 'paid' && (<>
                        <button onClick={() => handleOrderStatus(o, 'preparing')} className="btn-primary px-3 py-1.5 text-xs"><Package className="h-3.5 w-3.5" /> 배송 준비</button>
                        <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400"><XCircle className="h-3.5 w-3.5" /> 주문 취소</button>
                      </>)}
                      {o.status === 'preparing' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <input value={ti?.carrier ?? ''} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: e.target.value, number: ti?.number ?? '' } }))} placeholder="택배사" className="input-field h-8 w-24 px-2 py-1 text-xs" />
                          <input value={ti?.number ?? ''} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: ti?.carrier ?? '', number: e.target.value } }))} placeholder="운송장 번호" className="input-field h-8 w-40 px-2 py-1 text-xs" />
                          <button onClick={() => handleShipOrder(o)} className="btn-primary px-3 py-1.5 text-xs"><Truck className="h-3.5 w-3.5" /> 배송 시작</button>
                          <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400"><XCircle className="h-3.5 w-3.5" /> 취소</button>
                        </div>
                      )}
                      {o.status === 'shipped' && <button onClick={() => handleOrderStatus(o, 'delivered')} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 배송 완료</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Members ── */}
      {tab === 'members' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">회원 관리</h2>
          {profiles.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center"><Users className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">가입한 회원이 없습니다.</p></div>
          ) : (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-3 font-medium">회원</th><th className="px-5 py-3 font-medium">카페 닉네임</th><th className="px-5 py-3 font-medium">구독 상태</th><th className="px-5 py-3 font-medium">등급</th><th className="px-5 py-3 font-medium">역할</th><th className="px-5 py-3 font-medium text-right">관리</th></tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {profiles.map(p => {
                    const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                    const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                    const isActive = p.subscription_status === 'active';
                    return (
                      <tr key={p.id} className="transition hover:bg-slate-100">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                            <div><div className="font-medium text-slate-800">{p.full_name}</div><div className="text-xs text-slate-400">{p.email}</div></div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {p.cafe_nickname ? (
                            <span className="text-sm font-medium text-gold-deep">{p.cafe_nickname}</span>
                          ) : (
                            <span className="text-xs text-slate-400">미입력</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                          {p.subscription_expires_at && <div className="mt-0.5 text-[10px] text-slate-600">만료: {formatDate(p.subscription_expires_at)}</div>}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{plan?.name ?? '—'}</td>
                        <td className="px-5 py-3">{p.role === 'admin' ? <span className="chip border-gold/40 text-gold-light"><Crown className="h-3 w-3" /> ADMIN</span> : <span className="chip">MEMBER</span>}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <IconBtn onClick={() => handleToggleRole(p)} title={p.role === 'admin' ? '정회원으로 강등' : '관리자로 승격'} icon={p.role === 'admin' ? UserIcon : Crown} hover="hover:border-gold hover:text-gold" />
                            {isActive ? (
                              <button onClick={() => handleDeactivateSub(p)} className="btn-ghost h-7 px-2 py-1 text-xs hover:text-red-400">비활성화</button>
                            ) : actMemberId === p.id ? (
                              <div className="flex items-center gap-1">
                                <select value={actPlanId} onChange={e => setActPlanId(e.target.value)} className="input-field h-7 w-24 px-1 py-0.5 text-xs"><option value="">등급 선택</option>{plans.filter(pl => pl.is_active).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}</select>
                                <button onClick={() => handleActivateSub(p)} disabled={!actPlanId} className="btn-primary h-7 px-2 py-1 text-xs">활성화</button>
                                <button onClick={() => { setActMemberId(null); setActPlanId(''); }} className="text-slate-500 hover:text-slate-600"><XCircle className="h-3.5 w-3.5" /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setActMemberId(p.id); setActPlanId(p.subscription_plan_id ?? plans.find(pl => pl.is_active)?.id ?? ''); }} className="btn-ghost h-7 px-2 py-1 text-xs">등급 부여</button>
                            )}
                            {p.id !== profile.id && <IconBtn onClick={() => handleDeleteProfileAction(p)} title="회원 삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Posts ── */}
      {tab === 'posts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">게시판 관리</h2>
            <button onClick={openCreatePost} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 게시글 등록</button>
          </div>
          {showPostForm && (
            <form onSubmit={handlePostSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-800">{editPost ? '게시글 수정' : '새 게시글 등록'}</h3>
                <button type="button" onClick={() => setShowPostForm(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Field label="제목"><input required value={postF.title} onChange={e => setPostF({ ...postF, title: e.target.value })} className="input-field" /></Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="카테고리"><input value={postF.category} onChange={e => setPostF({ ...postF, category: e.target.value })} className="input-field" placeholder="공지사항, 이벤트 등" /></Field>
                  <Field label="요약"><input value={postF.excerpt} onChange={e => setPostF({ ...postF, excerpt: e.target.value })} className="input-field" placeholder="한 줄 요약" /></Field>
                </div>
                <Field label="내용"><textarea required value={postF.content} onChange={e => setPostF({ ...postF, content: e.target.value })} rows={6} className="input-field resize-none" /></Field>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">공개 범위</label>
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer"><input type="radio" checked={postF.visibility === 'public'} onChange={() => setPostF({ ...postF, visibility: 'public' })} className="h-4 w-4" /><Eye className="h-3.5 w-3.5" /> 전체 공개</label>
                      <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer"><input type="radio" checked={postF.visibility === 'members'} onChange={() => setPostF({ ...postF, visibility: 'members' })} className="h-4 w-4" /><Lock className="h-3.5 w-3.5" /> 회원 전용</label>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-400">고정</label>
                    <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer"><input type="checkbox" checked={postF.is_pinned} onChange={e => setPostF({ ...postF, is_pinned: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /><Pin className="h-3.5 w-3.5" /> 상단 고정</label>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">{busy ? '저장 중...' : editPost ? '수정하기' : '등록하기'}</button>
                <button type="button" onClick={() => setShowPostForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}
          <div className="space-y-3">
            {posts.map(p => (
              <div key={p.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-navy-800"><Megaphone className="h-5 w-5 text-slate-600" /></div>
                    <div>
                      <div className="flex items-center gap-2">{p.is_pinned && <Pin className="h-3.5 w-3.5 text-gold" />}<h3 className="font-gothic text-base font-semibold text-slate-800">{p.title}</h3></div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {p.category && <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {p.category}</span>}
                        <span className="flex items-center gap-1">{p.visibility === 'public' ? <><Eye className="h-3 w-3" /> 전체 공개</> : <><Lock className="h-3 w-3" /> 회원 전용</>}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(p.created_at)}</span>
                        <span>조회 {p.view_count}</span>
                      </div>
                      {p.excerpt && <p className="mt-1.5 text-sm text-slate-400 line-clamp-2">{p.excerpt}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn onClick={() => openEditPost(p)} title="수정" icon={Edit2} hover="hover:border-cyan hover:text-cyan" />
                    <IconBtn onClick={() => handleDeletePost(p)} title="삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />
                  </div>
                </div>
              </div>
            ))}
            {posts.length === 0 && (
              <div className="card-surface grid place-items-center py-16 text-center"><Megaphone className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">등록된 게시글이 없습니다.</p><button onClick={openCreatePost} className="btn-primary mt-4 px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 첫 게시글 등록</button></div>
            )}
          </div>
        </div>
      )}

      {/* ── Plans ── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">회원 등급 관리</h2>
            <button onClick={openCreatePlan} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 등급 추가</button>
          </div>
          {showPlanForm && (
            <form onSubmit={handlePlanSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-800">{editPlan ? '회원 등급 수정' : '새 회원 등급 추가'}</h3>
                <button type="button" onClick={() => setShowPlanForm(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="등급 이름"><input required value={planF.name} onChange={e => setPlanF({ ...planF, name: e.target.value })} placeholder="예: 일반회원, 특별회원, VIP회원" className="input-field" /></Field>
                <Field label="티어 (영문 키)"><input required value={planF.tier} onChange={e => setPlanF({ ...planF, tier: e.target.value })} placeholder="basic, premium, vip" className="input-field" /></Field>
                <Field label="월 구독료 (원)"><input required type="number" value={planF.monthly_price} onChange={e => setPlanF({ ...planF, monthly_price: e.target.value })} placeholder="9900" className="input-field" /></Field>
                <Field label="할인율 (%)"><input required type="number" value={planF.discount_rate} onChange={e => setPlanF({ ...planF, discount_rate: e.target.value })} placeholder="15" className="input-field" /></Field>
                <div className="md:col-span-2"><Field label="설명"><textarea value={planF.description} onChange={e => setPlanF({ ...planF, description: e.target.value })} rows={2} className="input-field resize-none" /></Field></div>
                <Field label="정렬 순서"><input type="number" value={planF.sort_order} onChange={e => setPlanF({ ...planF, sort_order: e.target.value })} className="input-field" /></Field>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">상태</label>
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={planF.is_active} onChange={e => setPlanF({ ...planF, is_active: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /> 활성</label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">{busy ? '저장 중...' : editPlan ? '수정하기' : '등록하기'}</button>
                <button type="button" onClick={() => setShowPlanForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}
          <div className="space-y-3">
            {plans.map(p => (
              <div key={p.id} className="card-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-lg ${p.is_active ? 'bg-gold-sheen' : 'bg-navy-800'}`}><Crown className={`h-5 w-5 ${p.is_active ? 'text-white' : 'text-slate-600'}`} /></div>
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-gothic text-base font-semibold text-slate-800">{p.name}</h3>{!p.is_active && <span className="chip border-slate-600 text-slate-500">비활성</span>}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="text-gold-light">{formatKRW(p.monthly_price)}/월</span><span>할인 {p.discount_rate}%</span></div>
                      {p.description && <p className="mt-1.5 text-sm text-slate-400">{p.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <IconBtn onClick={() => openEditPlan(p)} title="수정" icon={Edit2} hover="hover:border-cyan hover:text-cyan" />
                    <IconBtn onClick={() => handleDeletePlan(p)} title="삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />
                  </div>
                </div>
              </div>
            ))}
            {plans.length === 0 && (
              <div className="card-surface grid place-items-center py-16 text-center"><Crown className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">등록된 회원 등급이 없습니다.</p><button onClick={openCreatePlan} className="btn-primary mt-4 px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 첫 등급 추가</button></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: 'cyan' | 'gold' }) {
  const color = accent === 'cyan' ? 'text-cyan' : 'text-gold';
  const bg = accent === 'cyan' ? 'bg-cyan/10' : 'bg-gold/10';
  return (
    <div className="card-surface p-4">
      <div className={`mb-2 inline-grid h-9 w-9 place-items-center rounded-lg ${bg}`}><Icon className={`h-4 w-4 ${color}`} /></div>
      <div className="font-gothic text-xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
