import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Package, Users, ShoppingBag, TrendingUp, Clock, CheckCircle2,
  XCircle, Trash2, Edit2, Banknote, Truck, MapPin, Calendar, Tag,
  Crown, Megaphone, Eye, Lock, Pin, ExternalLink,
  Loader2, User as UserIcon, Flame, KeyRound, GripVertical, ArrowUp, ArrowDown, Copy,
  MessageSquare, Star, Upload, X, Gift, Search,
  Power, ShieldCheck, Building2, Receipt,
} from 'lucide-react';
import {
  Profile, Product, ProductOption, Category, Order, OrderItem, Post, SubscriptionPlan, OrderStatus, Setting, Inquiry, Review, TrialApplication, TrialStatus, CafeMembership, SpecialMemberStatus,
} from '../lib/types';
import { formatKRW, formatDate, formatDateTime, calcDiscountRate, formatPhoneNumber, getRemainingDays } from '../lib/format';
import {
  createProduct, updateProduct, deleteProduct,
  createCategory, updateCategory, deleteCategory,
  createPost, updatePost, deletePost,
  createPlan, updatePlan, deletePlan,
  updateOrderStatus, batchUpdateOrderStatus, deleteOrder, batchDeleteOrders, setProfileRole, deleteProfile, setSpecialMemberStatus, batchSetSpecialMemberStatus,
  changeMemberGrade, batchChangeMemberGrade, manuallyActivateSubscription, deactivateSubscription,
  updateSetting, getSettingValue,
  resetMemberPassword,
  answerInquiry, updateInquiryAnswer, deleteInquiry,
  createAdminReview, deleteAdminReview,
  approveTrialApplication, rejectTrialApplication, shipTrialApplication, completeTrialApplication, deleteTrialApplication,
  fetchPendingBankTransfers, confirmBankTransferPayment, rejectBankTransferPayment,
  fetchVisitorLogs, analyzeVisitorLogs,
} from '../lib/adminData';
import ImageUpload from './ImageUpload';
import RichTextEditor from './RichTextEditor';

type Tab = 'overview' | 'products' | 'orders' | 'members' | 'posts' | 'plans' | 'inquiries' | 'reviews' | 'trials' | 'bank_transfers' | 'analytics';
type OrderSubTab = 'all' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'past_delivered' | 'cancelled' | 'cancel_request';

const orderSubTabs: [OrderSubTab, string, OrderStatus[]][] = [
  ['all', '전체', ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']],
  ['pending', '주문', ['pending']],
  ['paid', '결제완료', ['paid', 'preparing']],
  ['shipped', '배송중', ['shipped']],
  ['delivered', '배송완료', ['delivered']],
  ['past_delivered', '지난주문', ['delivered']],
  ['cancel_request', '취소요청', ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']],
  ['cancelled', '취소', ['cancelled']],
];

function isSameMonth(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

const NEW_TABS: Tab[] = ['orders', 'inquiries', 'reviews', 'bank_transfers', 'trials', 'members'];

function getLastSeen(tab: Tab): number {
  try { return parseInt(localStorage.getItem(`admin_lastseen_${tab}`) ?? '0', 10) || 0; } catch { return 0; }
}
function saveLastSeen(tab: Tab) {
  try { localStorage.setItem(`admin_lastseen_${tab}`, String(Date.now())); } catch {}
}
function isNewer(iso: string | null, ts: number): boolean {
  if (!iso) return false;
  return new Date(iso).getTime() > ts;
}

interface Props {
  profile: Profile; products: Product[]; categories: Category[]; orders: Order[]; orderItems: OrderItem[];
  profiles: Profile[]; posts: Post[]; plans: SubscriptionPlan[]; settings: Setting[]; inquiries: Inquiry[]; reviews: Review[]; trials: TrialApplication[]; refresh: () => void;
}

interface OptionFormRow { name: string; values: { label: string; price_addition: string }[]; }
interface ProductForm { name: string; category_ids: string[]; original_price: string; club_price: string; description: string; image_url: string; sub_images: string[]; detail_images: string[]; detail_link: string; sku: string; stock: string; is_active: boolean; is_trial_available: boolean; sort_order: string; options: OptionFormRow[]; youtube_urls: string[]; use_default_shipping: boolean; shipping_fee: string; shipping_type: string; }
const emptyProductForm: ProductForm = { name: '', category_ids: [], original_price: '', club_price: '', description: '', image_url: '', sub_images: [], detail_images: [], detail_link: '', sku: '', stock: '100', is_active: true, is_trial_available: false, sort_order: '0', options: [], youtube_urls: [], use_default_shipping: true, shipping_fee: '', shipping_type: 'default' }; 

interface PostForm { title: string; content: string; excerpt: string; category: string; visibility: 'public' | 'members'; is_pinned: boolean; }
const emptyPostForm: PostForm = { title: '', content: '', excerpt: '', category: '', visibility: 'public', is_pinned: false };

interface PlanForm { name: string; tier: string; monthly_price: string; annual_price: string; discount_rate: string; description: string; is_active: boolean; sort_order: string; }
const emptyPlanForm: PlanForm = { name: '', tier: '', monthly_price: '', annual_price: '', discount_rate: '', description: '', is_active: true, sort_order: '0' };

interface ReviewForm { product_id: string; author_email: string; rating: number; content: string; images: string[]; created_at: string; }
const emptyReviewForm: ReviewForm = { product_id: '', author_email: '', rating: 5, content: '', images: [], created_at: '' };

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

const CARRIERS = [
  'CJ대한통운', '롯데택배', '로젠택배', '한진택배', '우체국택배',
  'CU편의점택배', 'GS편의점택배', '대신택배', '경동택배', '천일택배',
];

const ShippingField = ({ label, value, onSave, type = 'text', hint }: { label: string; value: string; onSave: (v: string) => void; type?: string; hint?: string }) => {
  const [v, setV] = useState(value);
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <div className="flex gap-2">
        <input type={type} value={v} onChange={e => setV(e.target.value)} onBlur={() => { if (v !== value) onSave(v); }} className="input-field h-9 text-sm" />
      </div>
      {hint && <p className="mt-1 text-[10px] text-slate-400">{hint}</p>}
    </div>
  );
};

export default function AdminDashboard({ profile, products, categories, orders, orderItems, profiles, posts, plans, settings, inquiries, reviews, trials, refresh }: Props) {
  const initialTab = (() => {
    const h = window.location.hash.replace('#admin', '').replace('/', '');
    const valid: Tab[] = ['overview', 'products', 'orders', 'members', 'posts', 'plans', 'inquiries', 'reviews', 'trials', 'analytics'];
    return (valid as string[]).includes(h) ? (h as Tab) : 'overview';
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [orderSubTab, setOrderSubTab] = useState<OrderSubTab>('paid');

  useEffect(() => {
    const onPopState = () => {
      const h = window.location.hash.replace('#admin', '').replace('/', '');
      const valid: Tab[] = ['overview', 'products', 'orders', 'members', 'posts', 'plans', 'inquiries', 'reviews', 'trials', 'analytics'];
      setTab((valid as string[]).includes(h) ? (h as Tab) : 'overview');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [busy, setBusy] = useState(false);

  const recruitmentOpen = getSettingValue(settings, 'recruitment_open') !== 'false';
  const recruitmentLimit = parseInt(getSettingValue(settings, 'recruitment_limit') ?? '500', 10);
  const recruitmentBatch = getSettingValue(settings, 'recruitment_batch') ?? '1';
  const activeSubs = profiles.filter(p => p.subscription_status === 'active').length;

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pf, setPf] = useState<ProductForm>(emptyProductForm);
  const [productSearch, setProductSearch] = useState('');
  const [productSelectedIds, setProductSelectedIds] = useState<Set<string>>(new Set());


  const [newCat, setNewCat] = useState('');
  const [newCatGrades, setNewCatGrades] = useState<Set<string>>(new Set());
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatGrades, setEditCatGrades] = useState<Set<string>>(new Set());

  const [showPostForm, setShowPostForm] = useState(false);
  const [editPost, setEditPost] = useState<Post | null>(null);
  const [postF, setPostF] = useState<PostForm>(emptyPostForm);

  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editPlan, setEditPlan] = useState<SubscriptionPlan | null>(null);
  const [planF, setPlanF] = useState<PlanForm>(emptyPlanForm);

  const [tracking, setTracking] = useState<Record<string, { carrier: string; number: string }>>({});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [orderSelectedIds, setOrderSelectedIds] = useState<Set<string>>(new Set());
  const [batchPlanId, setBatchPlanId] = useState('');
  const [memberFilter, setMemberFilter] = useState<'all' | 'special_requested' | 'special_approved'>('all');
  const [memberSearch, setMemberSearch] = useState('');
  const [pwModalId, setPwModalId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [inquiryReplyId, setInquiryReplyId] = useState<string | null>(null);
  const [inquiryReplyText, setInquiryReplyText] = useState('');
  const [inquiryBusy, setInquiryBusy] = useState(false);

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewF, setReviewF] = useState<ReviewForm>(emptyReviewForm);
  const [reviewBusy, setReviewBusy] = useState(false);

  const [actModalId, setActModalId] = useState<string | null>(null);
  const [actPlanId, setActPlanId] = useState('');
  const [actDate, setActDate] = useState('');
  const [actPeriod, setActPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [actBusy, setActBusy] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);

  const [showTodaySubsModal, setShowTodaySubsModal] = useState(false);
  const [showTodayMembersModal, setShowTodayMembersModal] = useState(false);
  const [memberGroupModal, setMemberGroupModal] = useState<{ title: string; members: Profile[] } | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<any[]>([]);
  const [transferLoading, setTransferLoading] = useState(false);
  const [bankNameVal, setBankNameVal] = useState('');
  const [bankAccountVal, setBankAccountVal] = useState('');
  const [bankHolderVal, setBankHolderVal] = useState('');
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<ReturnType<typeof analyzeVisitorLogs> | null>(null);
  const [lastSeen, setLastSeenState] = useState<Record<string, number>>(() => {
    const m: Record<string, number> = {};
    NEW_TABS.forEach(t => { m[t] = getLastSeen(t); });
    return m;
  });

  useEffect(() => {
    const overdueOrders = orders.filter(o => o.status === 'shipped' && o.shipped_at && Date.now() - new Date(o.shipped_at).getTime() >= 2 * 86400000);
    if (overdueOrders.length > 0) {
      Promise.all(overdueOrders.map(o => updateOrderStatus(o.id, 'delivered'))).then(refresh);
    }
  }, [orders, refresh]);

  useEffect(() => {
    setBankNameVal(getSettingValue(settings, 'bank_transfer_bank') ?? '');
    setBankAccountVal(getSettingValue(settings, 'bank_transfer_account') ?? '');
    setBankHolderVal(getSettingValue(settings, 'bank_transfer_holder') ?? '');
  }, [settings]);

  useEffect(() => {
    if (tab === 'bank_transfers') loadPendingTransfers();
  }, [tab]);
  useEffect(() => { loadPendingTransfers(); }, []);

  useEffect(() => {
    if (tab === 'analytics') loadAnalytics();
  }, [tab]);
  useEffect(() => { loadAnalytics(); }, []);
  useEffect(() => { if (tab === 'analytics') loadAnalytics(); }, [analyticsDays]);

  const stats = useMemo(() => ({
    totalMembers: profiles.length,
    activeSubs: profiles.filter(p => p.subscription_status === 'active').length,
    totalOrders: orders.length,
    confirmedRevenue: orders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0),
  }), [profiles, orders]);

  const todayStats = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = (iso: string | null) => !!iso && iso.slice(0, 10) === todayStr;

    const activeSubs = profiles.filter(p => p.subscription_status === 'active');
    const generalMembers = activeSubs.filter(p => p.special_member_status !== 'approved');
    const specialMembers = activeSubs.filter(p => p.special_member_status === 'approved');
    const generalMonthlyList = generalMembers.filter(p => p.subscription_billing_period === 'monthly').sort((a, b) => (b.subscription_started_at ?? '').localeCompare(a.subscription_started_at ?? ''));
    const generalAnnualList = generalMembers.filter(p => p.subscription_billing_period === 'annual').sort((a, b) => (b.subscription_started_at ?? '').localeCompare(a.subscription_started_at ?? ''));
    const specialMonthlyList = specialMembers.filter(p => p.subscription_billing_period === 'monthly').sort((a, b) => (b.subscription_started_at ?? '').localeCompare(a.subscription_started_at ?? ''));
    const specialAnnualList = specialMembers.filter(p => p.subscription_billing_period === 'annual').sort((a, b) => (b.subscription_started_at ?? '').localeCompare(a.subscription_started_at ?? ''));
    const generalMonthly = generalMonthlyList.length;
    const generalAnnual = generalAnnualList.length;
    const specialMonthly = specialMonthlyList.length;
    const specialAnnual = specialAnnualList.length;

    const subscriptionRevenue = activeSubs.reduce((sum, p) => {
      const plan = plans.find(pl => pl.id === p.subscription_plan_id);
      if (!plan) return sum;
      if (p.subscription_billing_period === 'annual' && plan.annual_price != null) return sum + plan.annual_price;
      return sum + plan.monthly_price;
    }, 0);

    const todayOrders = orders.filter(o => isToday(o.created_at));
    const todayRevenue = todayOrders
      .filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status))
      .reduce((s, o) => s + o.total_amount, 0);

    const todayNewMembersList = profiles
      .filter(p => isToday(p.created_at))
      .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    const todayNewMembers = todayNewMembersList.length;
    const todayNewSubsList = profiles
      .filter(p => isToday(p.subscription_started_at))
      .sort((a, b) => (b.subscription_started_at ?? '').localeCompare(a.subscription_started_at ?? ''));
    const todayNewSubs = todayNewSubsList.length;

    return {
      generalMonthly, generalAnnual, specialMonthly, specialAnnual,
      totalActiveSubs: activeSubs.length,
      subscriptionRevenue,
      todayOrderCount: todayOrders.length,
      todayRevenue,
      todayNewMembers,
      todayNewMembersList,
      generalMonthlyList,
      generalAnnualList,
      specialMonthlyList,
      specialAnnualList,
      todayNewSubs,
      todayNewSubsList,
    };
  }, [profiles, orders, plans]);

  const orderSubTabConfig = orderSubTabs.find(t => t[0] === orderSubTab) ?? orderSubTabs[0];
  const filteredOrders = useMemo(() => {
    if (orderSubTab === 'cancel_request') {
      return orders.filter(o => o.cancel_requested_at && o.status !== 'cancelled');
    }
    if (orderSubTab === 'delivered') {
      return orders.filter(o => o.status === 'delivered' && isSameMonth(o.delivered_at));
    }
    if (orderSubTab === 'past_delivered') {
      return orders.filter(o => o.status === 'delivered' && !isSameMonth(o.delivered_at));
    }
    return orders.filter(o => orderSubTabConfig[2].includes(o.status));
  }, [orders, orderSubTabConfig, orderSubTab]);

  const newCounts = useMemo(() => {
    const c: Record<string, number> = {};
    c.orders = orders.filter(o => isNewer(o.created_at, lastSeen.orders ?? 0)).length;
    c.inquiries = inquiries.filter(i => isNewer(i.created_at, lastSeen.inquiries ?? 0)).length;
    c.reviews = reviews.filter(r => isNewer(r.created_at, lastSeen.reviews ?? 0)).length;
    c.bank_transfers = pendingTransfers.filter(t => isNewer(t.created_at, lastSeen.bank_transfers ?? 0)).length;
    c.trials = trials.filter(t =>
      isNewer(t.created_at, lastSeen.trials ?? 0) ||
      isNewer(t.review_url_submitted_at, lastSeen.trials ?? 0)
    ).length;
    c.members = profiles.filter(p => isNewer(p.created_at, lastSeen.members ?? 0)).length;
    return c;
  }, [orders, inquiries, reviews, pendingTransfers, trials, profiles, lastSeen]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase().trim();
    return products.filter(p => {
      const catIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
      const catNames = catIds.map(id => categories.find(c => c.id === id)?.name ?? '').join(' ');
      return p.name.toLowerCase().includes(q)
        || (p.sku ?? '').toLowerCase().includes(q)
        || (p.description ?? '').toLowerCase().includes(q)
        || catNames.toLowerCase().includes(q);
    });
  }, [products, productSearch, categories]);

  // ── Product ──
  function openCreateProduct() { setEditProduct(null); setPf(emptyProductForm); setShowProductForm(true); }
  function openEditProduct(p: Product) {
    setEditProduct(p);
    const catIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
    const opts: OptionFormRow[] = (p.options ?? []).map(o => ({ name: o.name, values: o.values.map(v => ({ label: v.label, price_addition: String(v.price_addition) })) }));
    setPf({ name: p.name, category_ids: catIds, original_price: String(p.original_price), club_price: String(p.club_price), description: p.description ?? '', image_url: p.image_url ?? '', sub_images: p.sub_images ?? [], detail_images: p.detail_images ?? [], detail_link: p.detail_link ?? '', sku: p.sku ?? '', stock: String(p.stock), is_active: p.is_active, is_trial_available: p.is_trial_available ?? false, sort_order: String(p.sort_order), options: opts, youtube_urls: p.youtube_urls ?? [], use_default_shipping: p.use_default_shipping ?? true, shipping_fee: p.shipping_fee != null ? String(p.shipping_fee) : '', shipping_type: p.shipping_type ?? 'default' });
    setShowProductForm(true);
  }
  function toggleProductCategory(catId: string) {
    setPf(prev => {
      const has = prev.category_ids.includes(catId);
      return { ...prev, category_ids: has ? prev.category_ids.filter(id => id !== catId) : [...prev.category_ids, catId] };
    });
  }
  function addOptionRow() {
    setPf(prev => ({ ...prev, options: [...prev.options, { name: '', values: [{ label: '', price_addition: '0' }] }] }));
  }
  function removeOptionRow(idx: number) {
    setPf(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx) }));
  }
  function setOptionName(idx: number, name: string) {
    setPf(prev => ({ ...prev, options: prev.options.map((o, i) => i === idx ? { ...o, name } : o) }));
  }
  function addOptionValue(idx: number) {
    setPf(prev => ({ ...prev, options: prev.options.map((o, i) => i === idx ? { ...o, values: [...o.values, { label: '', price_addition: '0' }] } : o) }));
  }
  function removeOptionValue(idx: number, vIdx: number) {
    setPf(prev => ({ ...prev, options: prev.options.map((o, i) => i === idx ? { ...o, values: o.values.filter((_, j) => j !== vIdx) } : o) }));
  }
  function setOptionValue(idx: number, vIdx: number, field: 'label' | 'price_addition', val: string) {
    setPf(prev => ({ ...prev, options: prev.options.map((o, i) => i === idx ? { ...o, values: o.values.map((v, j) => j === vIdx ? { ...v, [field]: val } : v) } : o) }));
  }
  async function handleProductSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const selectedCats = categories.filter(c => pf.category_ids.includes(c.id));
      const primaryCat = selectedCats[0];
      const sub = pf.sub_images.filter(s => s.trim());
      const subVal = sub.length > 0 ? sub : null;
      const detail = pf.detail_images.filter(s => s.trim());
      const detailVal = detail.length > 0 ? detail : null;
      const catIdsVal = pf.category_ids.length > 0 ? pf.category_ids : null;
      const cleanOptions: ProductOption[] | null = (() => {
        const opts = pf.options
          .filter(o => o.name.trim())
          .map(o => ({
            name: o.name.trim(),
            values: o.values.filter(v => v.label.trim()).map(v => ({ label: v.label.trim(), price_addition: Number(v.price_addition) || 0 })),
          }))
          .filter(o => o.values.length > 0);
        return opts.length > 0 ? opts : null;
      })();
      const cleanYt = pf.youtube_urls.filter(u => u.trim());
      const ytVal = cleanYt.length > 0 ? cleanYt : null;
      const shipFee = pf.use_default_shipping ? null : (Number(pf.shipping_fee) || 0);
      const common = {
        name: pf.name.trim(), category: primaryCat?.name ?? '', category_id: primaryCat?.id ?? null,
        category_ids: catIdsVal,
        original_price: Number(pf.original_price) || 0, club_price: Number(pf.club_price) || 0,
        image_url: pf.image_url.trim() || null, sub_images: subVal, detail_images: detailVal, sku: pf.sku.trim() || null,
        stock: Number(pf.stock) || 0, sort_order: Number(pf.sort_order) || 0,
        detail_link: pf.detail_link.trim() || null,
        options: cleanOptions,
        youtube_urls: ytVal,
        use_default_shipping: pf.use_default_shipping,
        shipping_fee: shipFee,
        shipping_type: pf.shipping_type,
      };
      if (editProduct) await updateProduct(editProduct.id, { ...common, description: pf.description.trim() || null, is_active: pf.is_active, is_trial_available: pf.is_trial_available });
      else await createProduct({ ...common, description: pf.description.trim() || undefined, is_trial_available: pf.is_trial_available });
      setShowProductForm(false); refresh();
    } finally { setBusy(false); }
  }
  async function handleDeleteProduct(p: Product) { if (confirm(`'${p.name}' 상품을 삭제하시겠습니까?`)) { await deleteProduct(p.id); refresh(); } }
  async function handleCopyProduct(p: Product) {
    if (!confirm(`'${p.name}' 상품을 복사하시겠습니까?`)) return;
    const catIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
    const primaryCat = catIds.length > 0 ? categories.find(c => c.id === catIds[0]) : undefined;
    await createProduct({
      name: `${p.name} (복사)`, category: primaryCat?.name ?? '', category_id: primaryCat?.id ?? null,
      category_ids: catIds.length > 0 ? catIds : null,
      original_price: p.original_price, club_price: p.club_price,
      description: p.description ?? undefined,
      image_url: p.image_url, sub_images: p.sub_images ?? undefined, detail_images: p.detail_images ?? undefined,
      sku: p.sku ?? undefined, stock: p.stock, sort_order: products.length,
      detail_link: p.detail_link ?? undefined,
      options: p.options ?? null,
      youtube_urls: p.youtube_urls ?? undefined,
      use_default_shipping: p.use_default_shipping ?? true,
      shipping_fee: p.shipping_fee ?? null,
      shipping_type: p.shipping_type ?? 'default',
      is_trial_available: p.is_trial_available ?? false,
    });
    refresh();
  }
  async function handleToggleActive(p: Product) { await updateProduct(p.id, { is_active: !p.is_active }); refresh(); }
  async function handleBatchTrialToggle(enable: boolean) {
    const ids = [...productSelectedIds];
    if (ids.length === 0) return;
    if (!confirm(`선택한 상품 ${ids.length}개의 체험단 신청을 ${enable ? '가능' : '불가능'}으로 변경하시겠습니까?`)) return;
    setBusy(true);
    try {
      await Promise.all(ids.map(id => updateProduct(id, { is_trial_available: enable })));
      setProductSelectedIds(new Set());
      refresh();
    } finally { setBusy(false); }
  }
  async function handleMoveProduct(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= products.length) return;
    const reordered = [...products];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }));
    await Promise.all(updates.map(u => updateProduct(u.id, { sort_order: u.sort_order })));
    refresh();
  }

  // ── Category ──
  const activePlans = plans.filter(pl => pl.is_active);
  function toggleNewCatGrade(tier: string) {
    setNewCatGrades(prev => { const n = new Set(prev); if (n.has(tier)) n.delete(tier); else n.add(tier); return n; });
  }
  function toggleEditCatGrade(tier: string) {
    setEditCatGrades(prev => { const n = new Set(prev); if (n.has(tier)) n.delete(tier); else n.add(tier); return n; });
  }
  async function handleAddCategory() {
    if (newCat.trim()) {
      const grades = newCatGrades.size > 0 ? [...newCatGrades] : null;
      await createCategory(newCat.trim(), categories.length, grades);
      setNewCat(''); setNewCatGrades(new Set()); refresh();
    }
  }
  async function handleDeleteCategory(c: Category) { if (confirm(`'${c.name}' 카테고리를 삭제하시겠습니까?`)) { await deleteCategory(c.id); refresh(); } }
  async function handleMoveCategory(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= categories.length) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const updates = reordered.map((c, i) => ({ id: c.id, sort_order: i }));
    await Promise.all(updates.map(u => updateCategory(u.id, { sort_order: u.sort_order })));
    refresh();
  }
  async function handleRenameCategory(c: Category) {
    if (editCatName.trim()) {
      const grades = editCatGrades.size > 0 ? [...editCatGrades] : null;
      await updateCategory(c.id, { name: editCatName.trim(), visible_grades: grades });
      setEditCatId(null); setEditCatName(''); setEditCatGrades(new Set()); refresh();
    }
  }
  function openEditCategory(c: Category) {
    setEditCatId(c.id); setEditCatName(c.name);
    setEditCatGrades(new Set(c.visible_grades ?? []));
  }

  // ── Order ──
  async function handleOrderStatus(o: Order, status: OrderStatus, extra?: Partial<Order>) {
    await updateOrderStatus(o.id, status, extra);
    setOrderSubTab(status === 'paid' ? 'paid' : status === 'shipped' ? 'shipped' : status === 'delivered' ? 'delivered' : status === 'cancelled' ? 'cancelled' : orderSubTab);
    refresh();
  }
  async function handleShipOrder(o: Order) {
    const ti = tracking[o.id];
    if (!ti?.number.trim() || !(ti.carrier || o.carrier)) return;
    await updateOrderStatus(o.id, 'shipped', { tracking_number: ti.number.trim(), carrier: ti.carrier || o.carrier });
    setTracking(prev => { const n = { ...prev }; delete n[o.id]; return n; }); refresh();
  }
  async function handleBatchOrderStatus(status: OrderStatus) {
    const eligibleIds = orders.filter(o => orderSelectedIds.has(o.id) && o.status === 'pending').map(o => o.id);
    if (eligibleIds.length === 0) return;
    setBusy(true);
    try {
      await batchUpdateOrderStatus(eligibleIds, status);
      setOrderSelectedIds(new Set());
      setOrderSubTab(status === 'paid' ? 'paid' : status === 'shipped' ? 'shipped' : status === 'delivered' ? 'delivered' : orderSubTab);
      refresh();
    } finally { setBusy(false); }
  }
  async function handleBatchDeleteOrders() {
    const eligibleIds = orders.filter(o => orderSelectedIds.has(o.id) && o.status === 'cancelled').map(o => o.id);
    if (eligibleIds.length === 0) return;
    if (!confirm(`선택한 주문 ${eligibleIds.length}건을 삭제하시겠습니까? 삭제된 주문은 복구할 수 없습니다.`)) return;
    setBusy(true);
    try {
      await batchDeleteOrders(eligibleIds);
      setOrderSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      alert(e.message || '주문 삭제에 실패했습니다.');
    } finally { setBusy(false); }
  }
  async function handleBatchDeleteOrdersAll() {
    const eligibleIds = orders.filter(o => orderSelectedIds.has(o.id)).map(o => o.id);
    if (eligibleIds.length === 0) return;
    const hasActive = orders.some(o => orderSelectedIds.has(o.id) && ['pending', 'paid', 'preparing', 'shipped'].includes(o.status));
    const msg = hasActive
      ? `선택한 주문 ${eligibleIds.length}건을 삭제하시겠습니까?\n\n주의: 진행 중인 주문(결제 대기/완료/배송 중)이 포함되어 있습니다. 삭제 후 복구할 수 없으며, 회원에게 별도로 안내해야 합니다.`
      : `선택한 주문 ${eligibleIds.length}건을 삭제하시겠습니까? 삭제된 주문은 복구할 수 없습니다.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await batchDeleteOrders(eligibleIds);
      setOrderSelectedIds(new Set());
      refresh();
    } catch (e: any) {
      alert(e.message || '주문 삭제에 실패했습니다.');
    } finally { setBusy(false); }
  }
  async function handleBatchShipOrders() {
    const eligibleOrders = orders.filter(o => orderSelectedIds.has(o.id) && (o.status === 'paid' || o.status === 'preparing'));
    if (eligibleOrders.length === 0) return;
    const missing: string[] = [];
    for (const o of eligibleOrders) {
      const ti = tracking[o.id];
      const num = ti?.number.trim() || o.tracking_number?.trim() || '';
      if (!num) missing.push(o.recipient_name ?? o.id.slice(0, 8));
    }
    if (missing.length > 0) {
      alert(`운송장 번호가 입력되지 않은 주문이 있습니다:\n${missing.join('\n')}`);
      return;
    }
    setBusy(true);
    try {
      await Promise.all(eligibleOrders.map(o => {
        const ti = tracking[o.id];
        const num = ti?.number.trim() || o.tracking_number!.trim();
        const carrier = ti?.carrier || o.carrier || shipDefaultCarrier;
        return updateOrderStatus(o.id, 'shipped', { tracking_number: num, carrier });
      }));
      setOrderSelectedIds(new Set());
      setTracking(prev => { const n = { ...prev }; for (const o of eligibleOrders) delete n[o.id]; return n; });
      setOrderSubTab('shipped');
      refresh();
    } finally { setBusy(false); }
  }
  function downloadOrdersAsExcel() {
    const selectedOrders = orders.filter(o => orderSelectedIds.has(o.id));
    if (selectedOrders.length === 0) return;
    const escapeCell = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = selectedOrders.flatMap((o, orderIdx) => {
      const items = orderItems.filter(i => i.order_id === o.id);
      const list = items.length > 0 ? items : [{ product_name: '주문 상품 정보 없음', quantity: 0, unit_price: 0 } as any];
      const bg = orderIdx % 2 === 0 ? ' style="background:#ffffff"' : ' style="background:#f3f4f6"';
      return list.map(item =>
        `<tr${bg}><td>${escapeCell(formatDateTime(o.created_at))}</td><td>${escapeCell(o.id.slice(0, 8))}</td><td>${escapeCell(o.recipient_name ?? '')}</td><td>${escapeCell(`${o.address ?? ''} ${o.address_detail ?? ''}`)}</td><td style="mso-number-format:'\\@'">${escapeCell(formatPhoneNumber(o.recipient_phone ?? ''))}</td><td>${escapeCell(item.product_name)}</td><td>${item.quantity}</td><td>${formatKRW(item.unit_price)}</td><td>${formatKRW(item.unit_price * item.quantity)}</td><td>${escapeCell(o.shipping_message ?? '')}</td></tr>`
      ).join('');
    }).join('');
    const html = `<table border="1"><thead><tr style="background:#e2e8f0;font-weight:bold"><th>날짜</th><th>주문번호</th><th>주문자명</th><th>주소</th><th>연락처</th><th>주문상품</th><th>수량</th><th>단가</th><th>금액</th><th>배송메세지</th></tr></thead><tbody>${rows}</tbody></table>`;
    const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `주문목록-${new Date().toISOString().slice(0, 10)}.xls`; link.click(); URL.revokeObjectURL(url);
  }

  // ── Member ──
  async function handleToggleRole(p: Profile) { await setProfileRole(p.id, p.role === 'admin' ? 'member' : 'admin'); refresh(); }
  async function handleApproveSpecial(p: Profile) { await setSpecialMemberStatus(p.id, 'approved'); refresh(); }
  async function handleUnapproveSpecial(p: Profile) { await setSpecialMemberStatus(p.id, 'requested'); refresh(); }
  async function handleClearSpecial(p: Profile) { await setSpecialMemberStatus(p.id, null); refresh(); }
  const cafeMembershipLabel: Record<CafeMembership, string> = {
    none: '회원 아님', sprout: '카페회원 (새싹)', general: '카페회원 (일반)', faithful: '카페회원 (성실)', special: '특별회원',
  };
  const filteredProfiles = useMemo(() => {
    let list = profiles;
    if (memberFilter === 'special_requested') list = list.filter(p => p.special_member_status === 'requested');
    if (memberFilter === 'special_approved') list = list.filter(p => p.special_member_status === 'approved');
    const q = memberSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone ?? '').includes(q) ||
        (p.cafe_nickname ?? '').toLowerCase().includes(q) ||
        (p.my_referral_code ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, memberFilter, memberSearch]);
  async function handleDeleteProfileAction(p: Profile) {
    if (p.role === 'admin') { alert('관리자 계정은 삭제할 수 없습니다.'); return; }
    if (!confirm(`${p.full_name} 회원을 정말 삭제하시겠습니까?\n\n로그인 계정이 완전히 삭제되며, 주문·문의·체험단 신청 등 연관 데이터도 함께 사라집니다. 이 작업은 되돌릴 수 없습니다.`)) return;
    setBusy(true);
    try {
      const result = await deleteProfile(p.id, profile.id);
      if (!result.ok) { alert(result.error || '회원 삭제에 실패했습니다.'); return; }
      refresh();
    } catch (e: any) {
      alert(e.message || '회원 삭제에 실패했습니다.');
    } finally { setBusy(false); }
  }
  async function handleChangeGrade(p: Profile, planId: string) {
    const plan = plans.find(pl => pl.id === planId); if (!plan) return;
    await changeMemberGrade(p.id, plan.id, plan.tier); refresh();
  }
  function openActivateModal(p: Profile) {
    setActModalId(p.id);
    setActPlanId(p.subscription_plan_id ?? plans.find(pl => pl.is_active)?.id ?? '');
    const def = new Date(); def.setDate(def.getDate() + 30);
    setActDate(p.subscription_expires_at ? p.subscription_expires_at.slice(0, 10) : def.toISOString().slice(0, 10));
    setActPeriod(p.subscription_billing_period ?? 'monthly');
    setActErr(null);
  }
  async function handleActivateSubmit() {
    if (!actModalId) return;
    if (!actPlanId) { setActErr('회원 등급을 선택해주세요.'); return; }
    if (!actDate) { setActErr('만료일을 선택해주세요.'); return; }
    const plan = plans.find(pl => pl.id === actPlanId);
    if (!plan) { setActErr('등급을 찾을 수 없습니다.'); return; }
    setActBusy(true); setActErr(null);
    try {
      const expiresAt = new Date(actDate + 'T23:59:59').toISOString();
      await manuallyActivateSubscription(actModalId, {
        planId: plan.id, tier: plan.tier, expiresAt, billingPeriod: actPeriod,
      });
      setActModalId(null); refresh();
    } catch (e: any) { setActErr(e.message || '구독 활성화에 실패했습니다.'); }
    finally { setActBusy(false); }
  }
  async function handleDeactivate(p: Profile) {
    if (!confirm(`${p.full_name} 회원의 구독을 해제하시겠습니까?`)) return;
    try { await deactivateSubscription(p.id); refresh(); }
    catch (e: any) { alert(e.message || '구독 해제에 실패했습니다.'); }
  }

  async function loadPendingTransfers() {
    setTransferLoading(true);
    try {
      const data = await fetchPendingBankTransfers();
      setPendingTransfers(data as any[]);
    } finally { setTransferLoading(false); }
  }
  async function loadAnalytics() {
    setAnalyticsLoading(true);
    try {
      const logs = await fetchVisitorLogs(analyticsDays);
      setAnalyticsData(analyzeVisitorLogs(logs));
    } finally { setAnalyticsLoading(false); }
  }
  async function handleConfirmTransfer(t: any) {
    const plan = plans.find(pl => pl.id === t.plan_id);
    if (!plan) { alert('결제된 등급을 찾을 수 없습니다.'); return; }
    if (!confirm(`${t.depositor_name} 님의 무통장 입금(${formatKRW(t.amount)})을 확인하고 구독을 활성화하시겠습니까?`)) return;
    setBusy(true);
    try {
      const period = (t.billing_period === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual';
      const result = await confirmBankTransferPayment(t.id, t.user_id, plan.id, plan.tier, period, profile.id);
      if (!result.ok) { alert(result.error || '입금 확인에 실패했습니다.'); return; }
      loadPendingTransfers();
      refresh();
    } finally { setBusy(false); }
  }
  async function handleRejectTransfer(t: any) {
    if (!confirm(`${t.depositor_name} 님의 무통장 입금 신청을 거절하시겠습니까?`)) return;
    setBusy(true);
    try {
      await rejectBankTransferPayment(t.id);
      loadPendingTransfers();
    } finally { setBusy(false); }
  }
  async function handleSaveBankAccount() {
    await updateSetting('bank_transfer_bank', bankNameVal);
    await updateSetting('bank_transfer_account', bankAccountVal);
    await updateSetting('bank_transfer_holder', bankHolderVal);
    refresh();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === filteredProfiles.length ? new Set() : new Set(filteredProfiles.map(p => p.id)));
  }
  async function handleBatchChangeGrade() {
    if (!batchPlanId || selectedIds.size === 0) return;
    const plan = plans.find(pl => pl.id === batchPlanId); if (!plan) return;
    setBusy(true);
    try {
      await batchChangeMemberGrade([...selectedIds], plan.id, plan.tier);
      setSelectedIds(new Set()); setBatchPlanId(''); refresh();
    } finally { setBusy(false); }
  }
  async function handleBatchApproveSpecial() {
    if (selectedIds.size === 0) return;
    const targets = profiles.filter(p => selectedIds.has(p.id) && p.special_member_status === 'requested');
    if (targets.length === 0) { alert('선택한 회원 중 특별회원 승인 대상(미승인 상태)이 없습니다.'); return; }
    if (!confirm(`선택한 회원 ${targets.length}명을 특별회원으로 승인하시겠습니까?`)) return;
    setBusy(true);
    try {
      await batchSetSpecialMemberStatus(targets.map(p => p.id), 'approved');
      setSelectedIds(new Set()); refresh();
    } finally { setBusy(false); }
  }
  async function handleResetPassword() {
    if (!pwModalId || pwValue.length < 6) { setPwErr('비밀번호는 최소 6자 이상이어야 합니다.'); return; }
    setPwBusy(true); setPwErr(null); setPwSuccess(false);
    try {
      await resetMemberPassword(pwModalId, pwValue, profile.id);
      setPwSuccess(true);
      setTimeout(() => { setPwModalId(null); setPwValue(''); setPwSuccess(false); }, 1500);
    } catch (e: any) { setPwErr(e.message || '비밀번호 변경에 실패했습니다.'); }
    finally { setPwBusy(false); }
  }

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
  function openEditPlan(p: SubscriptionPlan) { setEditPlan(p); setPlanF({ name: p.name, tier: p.tier, monthly_price: String(p.monthly_price), annual_price: p.annual_price ? String(p.annual_price) : '', discount_rate: String(p.discount_rate), description: p.description ?? '', is_active: p.is_active, sort_order: String(p.sort_order) }); setShowPlanForm(true); }
  async function handlePlanSubmit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const input = { name: planF.name.trim(), description: planF.description.trim() || null, monthly_price: Number(planF.monthly_price) || 0, annual_price: planF.annual_price.trim() ? Number(planF.annual_price) || null : null, tier: planF.tier.trim(), discount_rate: Number(planF.discount_rate) || 0, is_active: planF.is_active, sort_order: Number(planF.sort_order) || 0 };
      if (editPlan) await updatePlan(editPlan.id, input); else await createPlan(input);
      setShowPlanForm(false); refresh();
    } finally { setBusy(false); }
  }
  async function handleDeletePlan(p: SubscriptionPlan) { if (confirm(`'${p.name}' 등급을 삭제하시겠습니까?`)) { await deletePlan(p.id); refresh(); } }

  // ── Review ──
  async function handleReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reviewF.product_id) { alert('상품을 선택해주세요.'); return; }
    if (!reviewF.author_email.trim()) { alert('이메일을 입력해주세요.'); return; }
    if (!reviewF.content.trim()) { alert('후기 내용을 입력해주세요.'); return; }
    if (reviewF.content.length > 150) { alert('후기는 150자 이하로 작성해주세요.'); return; }
    setReviewBusy(true);
    try {
      const ok = await createAdminReview({
        product_id: reviewF.product_id,
        author_email: reviewF.author_email.trim(),
        rating: reviewF.rating,
        content: reviewF.content.trim(),
        images: reviewF.images,
        created_at: reviewF.created_at ? new Date(reviewF.created_at).toISOString() : undefined,
      });
      if (ok) { setShowReviewForm(false); setReviewF(emptyReviewForm); refresh(); }
      else { alert('후기 작성 중 오류가 발생했습니다.'); }
    } finally { setReviewBusy(false); }
  }
  async function handleDeleteReview(r: Review) { if (confirm('이 후기를 삭제하시겠습니까?')) { await deleteAdminReview(r.id); refresh(); } }

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

  // ── Shipping ──
  const shipDefaultFee = getSettingValue(settings, 'shipping_default_fee') ?? '3000';
  const shipFreeThreshold = getSettingValue(settings, 'shipping_free_threshold') ?? '50000';
  const shipJejuFee = getSettingValue(settings, 'shipping_jeju_fee') ?? '3000';
  const shipIslandFee = getSettingValue(settings, 'shipping_island_fee') ?? '5000';
  const shipDefaultCarrier = getSettingValue(settings, 'shipping_default_carrier') ?? 'CJ대한통운';
  const shipDefaultType = getSettingValue(settings, 'shipping_default_type') ?? 'prepaid';
  async function handleSaveShipping(key: string, value: string) { await updateSetting(key, value); refresh(); }

  function setTabAndReset(t: Tab) {
    if (t !== tab) window.history.pushState({}, '', `#admin/${t}`);
    if (NEW_TABS.includes(t)) {
      const now = Date.now();
      setLastSeenState(prev => ({ ...prev, [t]: now }));
      saveLastSeen(t);
    }
    setTab(t);
    setShowProductForm(false); setEditProduct(null); setPf(emptyProductForm);
    setShowPostForm(false); setEditPost(null); setPostF(emptyPostForm);
    setShowPlanForm(false); setEditPlan(null); setPlanF(emptyPlanForm);
    setEditCatId(null); setEditCatName(''); setEditCatGrades(new Set());
    setNewCat(''); setNewCatGrades(new Set());
    setSelectedIds(new Set()); setBatchPlanId('');
    setOrderSelectedIds(new Set());
    setProductSelectedIds(new Set());
    setOrderSubTab('paid');
    setMemberFilter('all');
    setMemberSearch('');
    setTracking({});
    setPwModalId(null);
    setInquiryReplyId(null);
    setInquiryReplyText('');
    setShowReviewForm(false);
    setReviewF(emptyReviewForm);
  }

  const tabs: [Tab, string][] = [['overview', '대시보드'], ['products', '상품 관리'], ['orders', '주문 관리'], ['members', '회원 관리'], ['bank_transfers', '입금확인'], ['posts', '게시판 관리'], ['plans', '회원 등급'], ['inquiries', '1:1 문의'], ['reviews', '후기 관리'], ['trials', '체험단'], ['analytics', '로그 분석']];

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
        {tabs.map(([k, label]) => {
          const isNew = NEW_TABS.includes(k) && tab !== k && (newCounts[k] ?? 0) > 0;
          return (
            <button key={k} onClick={() => setTabAndReset(k)} className={`relative rounded-md px-4 py-2 text-sm font-medium transition ${tab === k ? 'bg-cyan text-white shadow-glow' : 'text-slate-400 hover:text-slate-700'}`}>
              {label}
              {isNew && <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white animate-pulse">NEW</span>}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          {/* Today statistics */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <TrendingUp className="h-4 w-4 text-cyan" /> 오늘 통계
              <span className="text-xs font-normal text-slate-500">{formatDate(new Date().toISOString())}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <button onClick={() => setShowTodayMembersModal(true)} className="rounded-lg border border-cyan/30 bg-cyan/5 p-4 text-left transition hover:border-cyan/60 hover:bg-cyan/10 cursor-pointer">
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Users className="h-3.5 w-3.5 text-cyan" /> 오늘 신규 회원</div>
                <div className="mt-1 font-gothic text-2xl font-bold text-slate-800">{todayStats.todayNewMembers}<span className="ml-1 text-sm font-normal text-slate-500">명</span></div>
              </button>
              <button onClick={() => setShowTodaySubsModal(true)} className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-left transition hover:border-gold/60 hover:bg-gold/10 cursor-pointer">
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Crown className="h-3.5 w-3.5 text-gold" /> 오늘 신규 구독</div>
                <div className="mt-1 font-gothic text-2xl font-bold text-slate-800">{todayStats.todayNewSubs}<span className="ml-1 text-sm font-normal text-slate-500">명</span></div>
              </button>
              <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><ShoppingBag className="h-3.5 w-3.5 text-cyan" /> 오늘 주문</div>
                <div className="mt-1 font-gothic text-2xl font-bold text-slate-800">{todayStats.todayOrderCount}<span className="ml-1 text-sm font-normal text-slate-500">건</span></div>
              </div>
              <div className="rounded-lg border border-gold/30 bg-gold/5 p-4">
                <div className="flex items-center gap-1.5 text-xs text-slate-500"><Banknote className="h-3.5 w-3.5 text-gold" /> 오늘 매출</div>
                <div className="mt-1 font-gothic text-2xl font-bold text-slate-800">{formatKRW(todayStats.todayRevenue)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-navy-700 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><UserIcon className="h-4 w-4 text-cyan" /> 일반 구독 회원 <span className="ml-auto text-xs font-normal text-slate-500">총 {todayStats.generalMonthly + todayStats.generalAnnual}명</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMemberGroupModal({ title: '일반 구독 회원 - 월 회원', members: todayStats.generalMonthlyList })} className="rounded-lg border border-cyan/30 bg-white p-3 text-center transition hover:border-cyan/60 hover:bg-cyan/5 cursor-pointer">
                    <div className="text-xs text-slate-500">월 회원</div>
                    <div className="font-gothic text-xl font-bold text-cyan">{todayStats.generalMonthly}명</div>
                  </button>
                  <button onClick={() => setMemberGroupModal({ title: '일반 구독 회원 - 연 회원', members: todayStats.generalAnnualList })} className="rounded-lg border border-cyan/30 bg-white p-3 text-center transition hover:border-cyan/60 hover:bg-cyan/5 cursor-pointer">
                    <div className="text-xs text-slate-500">연 회원</div>
                    <div className="font-gothic text-xl font-bold text-cyan">{todayStats.generalAnnual}명</div>
                  </button>
                </div>
              </div>
              <div className="rounded-lg border border-navy-700 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700"><Star className="h-4 w-4 text-gold" /> 특별회원 <span className="ml-auto text-xs font-normal text-slate-500">총 {todayStats.specialMonthly + todayStats.specialAnnual}명</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setMemberGroupModal({ title: '특별회원 - 월 회원', members: todayStats.specialMonthlyList })} className="rounded-lg border border-gold/30 bg-white p-3 text-center transition hover:border-gold/60 hover:bg-gold/5 cursor-pointer">
                    <div className="text-xs text-slate-500">월 회원</div>
                    <div className="font-gothic text-xl font-bold text-gold-deep">{todayStats.specialMonthly}명</div>
                  </button>
                  <button onClick={() => setMemberGroupModal({ title: '특별회원 - 연 회원', members: todayStats.specialAnnualList })} className="rounded-lg border border-gold/30 bg-white p-3 text-center transition hover:border-gold/60 hover:bg-gold/5 cursor-pointer">
                    <div className="text-xs text-slate-500">연 회원</div>
                    <div className="font-gothic text-xl font-bold text-gold-deep">{todayStats.specialAnnual}명</div>
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-navy-700 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-gold" />
                <span className="text-sm text-slate-600">활성 구독자</span>
                <span className="font-gothic text-lg font-bold text-slate-800">{todayStats.totalActiveSubs}명</span>
              </div>
              <div className="h-4 w-px bg-navy-700" />
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-cyan" />
                <span className="text-sm text-slate-600">예상 구독료</span>
                <span className="font-gothic text-lg font-bold text-cyan">{formatKRW(todayStats.subscriptionRevenue)}</span>
              </div>
            </div>
          </div>

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

          {/* Shipping settings */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800"><Truck className="h-4 w-4 text-cyan" /> 배송료 설정</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <ShippingField label="기본 배송료 (원)" value={shipDefaultFee} onSave={v => handleSaveShipping('shipping_default_fee', v)} type="number" />
              <ShippingField label="무료배송 기준금액 (원)" value={shipFreeThreshold} onSave={v => handleSaveShipping('shipping_free_threshold', v)} type="number" hint="이 금액 이상 주문 시 무료배송" />
              <ShippingField label="제주도 추가배송료 (원)" value={shipJejuFee} onSave={v => handleSaveShipping('shipping_jeju_fee', v)} type="number" />
              <ShippingField label="도서산간 추가배송료 (원)" value={shipIslandFee} onSave={v => handleSaveShipping('shipping_island_fee', v)} type="number" />
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">기본 배송업체</label>
                <select value={shipDefaultCarrier} onChange={e => handleSaveShipping('shipping_default_carrier', e.target.value)} className="input-field h-9 text-sm">
                  {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">기본 배송비 결제 방식</label>
                <select value={shipDefaultType} onChange={e => handleSaveShipping('shipping_default_type', e.target.value)} className="input-field h-9 text-sm">
                  <option value="prepaid">선불 (주문금액에 합산)</option>
                  <option value="collect">착불 (수령 시 기사에게 결제)</option>
                </select>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">상품별로 기본 배송료 설정을 따를지 개별 설정할 수 있습니다. 무료배송 기준금액은 상품 합계금액 기준입니다.</p>
          </div>

          {/* Bank transfer settings */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800"><Building2 className="h-4 w-4 text-cyan" /> 무통장 입금 계좌 설정</div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">은행명</label>
                <input value={bankNameVal} onChange={e => setBankNameVal(e.target.value)} placeholder="예: 농협은행" className="input-field h-9 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">계좌번호</label>
                <input value={bankAccountVal} onChange={e => setBankAccountVal(e.target.value)} placeholder="예: 123-4567-8901" className="input-field h-9 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">예금주</label>
                <input value={bankHolderVal} onChange={e => setBankHolderVal(e.target.value)} placeholder="예: 홍길동" className="input-field h-9 text-sm" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleSaveBankAccount} disabled={!bankNameVal.trim() || !bankAccountVal.trim() || !bankHolderVal.trim()} className="btn-primary px-4 py-2 text-sm">
                <Building2 className="h-4 w-4" /> 계좌 저장
              </button>
              {bankNameVal && bankAccountVal && bankHolderVal ? (
                <span className="text-xs text-green-400">설정됨: {bankNameVal} {bankAccountVal} ({bankHolderVal})</span>
              ) : (
                <span className="text-xs text-amber-600">무통장 입금을 사용하려면 계좌 정보를 입력하고 저장해주세요.</span>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-500">계좌 정보를 설정하면 회원이 구독 신청 시 무통장 입금 옵션이 표시됩니다. 무통장 입금으로 신청한 회원은 입금확인 탭에서 승인해주세요.</p>
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

      {/* Member group modal */}
      {memberGroupModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setMemberGroupModal(null)}>
          <div className="card-surface w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-gothic text-base font-semibold text-slate-800 flex items-center gap-2"><Users className="h-4 w-4 text-cyan" /> {memberGroupModal.title}</h3>
              <button onClick={() => setMemberGroupModal(null)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-500">총 {memberGroupModal.members.length}명</p>
            {memberGroupModal.members.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">해당하는 회원이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {memberGroupModal.members.map(p => {
                  const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                  const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.full_name}</div>
                          <div className="text-xs text-slate-500">{p.cafe_nickname ?? '—'} · {p.email}</div>
                          <div className="mt-0.5 text-xs text-slate-400">연락처: {p.phone ?? '—'} · 구독시작: {formatDate(p.subscription_started_at)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                        {plan && <div className="mt-1 text-xs text-slate-500">{plan.name}</div>}
                        {p.subscription_expires_at && <div className="text-xs text-slate-400">만료: {formatDate(p.subscription_expires_at)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today's new members modal */}
      {showTodayMembersModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setShowTodayMembersModal(false)}>
          <div className="card-surface w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-gothic text-base font-semibold text-slate-800 flex items-center gap-2"><Users className="h-4 w-4 text-cyan" /> 오늘 신규 가입 회원</h3>
              <button onClick={() => setShowTodayMembersModal(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-500">{formatDate(new Date().toISOString())} 기준 · {todayStats.todayNewMembers}명</p>
            {todayStats.todayNewMembersList.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">오늘 가입한 회원이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {todayStats.todayNewMembersList.map(p => {
                  const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                  const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.full_name}</div>
                          <div className="text-xs text-slate-500">{p.cafe_nickname ?? '—'} · {p.email}</div>
                          <div className="mt-0.5 text-xs text-slate-400">가입: {formatDateTime(p.created_at)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                        {plan && <div className="mt-1 text-xs text-slate-500">{plan.name}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Today's new subscribers modal */}
      {showTodaySubsModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setShowTodaySubsModal(false)}>
          <div className="card-surface w-full max-w-lg max-h-[80vh] overflow-y-auto space-y-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-gothic text-base font-semibold text-slate-800 flex items-center gap-2"><Crown className="h-4 w-4 text-gold" /> 오늘 신규 구독 회원</h3>
              <button onClick={() => setShowTodaySubsModal(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-500">{formatDate(new Date().toISOString())} 기준 · {todayStats.todayNewSubs}명</p>
            {todayStats.todayNewSubsList.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">오늘 신규 구독한 회원이 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {todayStats.todayNewSubsList.map(p => {
                  const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-slate-50 px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-gold/10 text-sm font-bold text-gold-deep">{p.full_name.slice(0, 1)}</div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{p.full_name}</div>
                          <div className="text-xs text-slate-500">{p.cafe_nickname ?? '—'} · {p.email}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-medium text-slate-700">{plan?.name ?? '—'}</div>
                        <div className="text-xs text-slate-500">{p.subscription_billing_period === 'annual' ? '연 회원' : '월 회원'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === 'products' && (
        <div className="space-y-4">
          {/* Categories */}
          <div className="card-surface p-4">
            <div className="mb-3 flex items-center gap-2 font-gothic text-sm font-semibold text-slate-700"><Tag className="h-4 w-4 text-cyan" /> 카테고리 관리 <span className="text-xs font-normal text-slate-500">· 드래그하여 순서 변경</span></div>
            <div className="flex flex-wrap items-start gap-2">
              {categories.map((c, idx) => (
                <div key={c.id} className="flex flex-col gap-1.5 rounded-lg border border-navy-700 p-2" draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from)) handleMoveCategory(from, idx); }}>
                  {editCatId === c.id ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1">
                        <input value={editCatName} onChange={e => setEditCatName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(c); if (e.key === 'Escape') { setEditCatId(null); setEditCatName(''); setEditCatGrades(new Set()); } }}
                          autoFocus className="input-field h-7 w-28 px-2 py-1 text-xs" />
                        <button onClick={() => handleRenameCategory(c)} className="text-xs text-cyan hover:underline">저장</button>
                        <button onClick={() => { setEditCatId(null); setEditCatName(''); setEditCatGrades(new Set()); }} className="text-slate-500 hover:text-slate-600"><XCircle className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {activePlans.map(pl => (
                          <label key={pl.id} className={`cursor-pointer rounded-md border px-2 py-0.5 text-[10px] font-medium transition ${editCatGrades.has(pl.tier) ? 'border-cyan bg-cyan/10 text-cyan' : 'border-navy-700 text-slate-500 hover:text-slate-700'}`}>
                            <input type="checkbox" checked={editCatGrades.has(pl.tier)} onChange={() => toggleEditCatGrade(pl.tier)} className="hidden" />
                            {pl.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <GripVertical className="h-3.5 w-3.5 cursor-grab text-slate-400 hover:text-slate-600" />
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMoveCategory(idx, idx - 1)} disabled={idx === 0} className="text-slate-400 hover:text-cyan disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                        <button onClick={() => handleMoveCategory(idx, idx + 1)} disabled={idx === categories.length - 1} className="text-slate-400 hover:text-cyan disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                      </div>
                      <span onClick={() => openEditCategory(c)} className="chip cursor-pointer hover:border-cyan hover:text-cyan">{c.name}</span>
                      {c.visible_grades && c.visible_grades.length > 0 && (
                        <span className="text-[10px] text-slate-500">({c.visible_grades.map(t => activePlans.find(p => p.tier === t)?.name ?? t).join(', ')})</span>
                      )}
                      <button onClick={() => handleDeleteCategory(c)} className="text-slate-600 hover:text-red-400"><XCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
              ))}
              {categories.length === 0 && <span className="text-xs text-slate-600">카테고리가 없습니다.</span>}
            </div>
            <div className="mt-3 flex flex-col gap-2">
              <div className="flex gap-2">
                <input value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }} placeholder="새 카테고리 이름" className="input-field h-9 w-48 py-2 text-sm" />
                <button onClick={handleAddCategory} disabled={!newCat.trim()} className="btn-ghost h-9 px-3 py-2 text-sm"><Plus className="h-4 w-4" /> 추가</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">공개 등급:</span>
                {activePlans.map(pl => (
                  <label key={pl.id} className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition ${newCatGrades.has(pl.tier) ? 'border-cyan bg-cyan/10 text-cyan' : 'border-navy-700 text-slate-500 hover:text-slate-700'}`}>
                    <input type="checkbox" checked={newCatGrades.has(pl.tier)} onChange={() => toggleNewCatGrade(pl.tier)} className="hidden" />
                    {pl.name}
                  </label>
                ))}
                {newCatGrades.size === 0 && <span className="text-[10px] text-slate-400">선택 안 함 = 전체 공개</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">상품 관리</h2>
            <div className="flex flex-wrap items-center gap-2">
              {productSelectedIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-1.5">
                  <span className="text-sm font-medium text-cyan">{productSelectedIds.size}개 선택</span>
                  <button onClick={() => handleBatchTrialToggle(true)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-green-500/50 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:bg-green-500/10"><Gift className="h-3.5 w-3.5" /> 체험단 신청 받기</button>
                  <button onClick={() => handleBatchTrialToggle(false)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-slate-400 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"><XCircle className="h-3.5 w-3.5" /> 체험단 신청 끄기</button>
                  <button onClick={() => setProductSelectedIds(new Set())} className="text-xs text-slate-500 hover:text-slate-700">해제</button>
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="상품명, SKU, 카테고리 검색..."
                  className="input-field h-9 w-56 pl-9 text-sm"
                />
              </div>
              <button onClick={openCreateProduct} className="btn-primary px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 상품 등록</button>
            </div>
          </div>

          {showProductForm && (
            <form onSubmit={handleProductSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-800">{editProduct ? '상품 수정' : '새 상품 등록'}</h3>
                <button type="button" onClick={() => setShowProductForm(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Field label="상품명"><input required value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} className="input-field" /></Field></div>
                <Field label="카테고리 (복수 선택)">
                  <div className="flex flex-wrap gap-2">
                    {categories.map(c => (
                      <button key={c.id} type="button" onClick={() => toggleProductCategory(c.id)} className={`cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition ${pf.category_ids.includes(c.id) ? 'border-cyan bg-cyan/10 text-cyan' : 'border-navy-700 text-slate-500 hover:text-slate-700'}`}>
                        {c.name}
                      </button>
                    ))}
                    {categories.length === 0 && <span className="text-xs text-slate-500">카테고리를 먼저 추가하세요.</span>}
                  </div>
                </Field>
                <Field label="SKU"><input value={pf.sku} onChange={e => setPf({ ...pf, sku: e.target.value })} placeholder="SKU-001" className="input-field" /></Field>
                <Field label="정상가 (원)"><input required type="number" value={pf.original_price} onChange={e => setPf({ ...pf, original_price: e.target.value })} placeholder="89000" className="input-field" /></Field>
                <Field label="회원가 (원)"><input required type="number" value={pf.club_price} onChange={e => setPf({ ...pf, club_price: e.target.value })} placeholder="69000" className="input-field" /></Field>
                <div className="md:col-span-2"><Field label="상품 설명"><textarea value={pf.description} onChange={e => setPf({ ...pf, description: e.target.value })} rows={3} className="input-field resize-none" /></Field></div>
                <div className="md:col-span-2">
                  <ImageUpload label="대표 이미지" value={pf.image_url} onChange={(url) => setPf({ ...pf, image_url: url })} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">서브 이미지 (최대 6장)</label>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    {pf.sub_images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt="" className="h-20 w-full rounded-lg object-cover" />
                        <button type="button" onClick={() => setPf(prev => ({ ...prev, sub_images: prev.sub_images.filter((_, idx) => idx !== i) }))} className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white hover:bg-red-500"><XCircle className="h-3 w-3" /></button>
                      </div>
                    ))}
                    {pf.sub_images.length < 6 && (
                      <ImageUpload label="" value="" onChange={(url) => { if (url) setPf(prev => ({ ...prev, sub_images: [...prev.sub_images, url] })); }} className="h-20" />
                    )}
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">상품 상세페이지 이미지 (가로 800px 권장, 세로 제한 없음)</label>
                  <p className="mb-2 text-xs text-slate-500">상품 상세 화면에 위에서부터 순서대로 이어서 표시됩니다.</p>
                  <div className="space-y-3">
                    {pf.detail_images.map((img, i) => (
                      <div key={i} className="relative overflow-hidden rounded-lg border border-navy-700 bg-white">
                        <img src={img} alt={`상세 이미지 ${i + 1}`} className="max-h-48 w-full object-contain" />
                        <button type="button" onClick={() => setPf(prev => ({ ...prev, detail_images: prev.detail_images.filter((_, idx) => idx !== i) }))} className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-red-500"><XCircle className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                    <ImageUpload label="상세 이미지 추가" value="" onChange={(url) => { if (url) setPf(prev => ({ ...prev, detail_images: [...prev.detail_images, url] })); }} className="rounded-lg border border-dashed border-navy-700 p-3" />
                  </div>
                </div>
                <div className="md:col-span-2"><Field label="상품 정보 자세히 보기 링크 (스마트스토어 등, 선택)"><input value={pf.detail_link} onChange={e => setPf({ ...pf, detail_link: e.target.value })} placeholder="https://smartstore.naver.com/..." className="input-field" /></Field></div>
                <Field label="재고"><input type="number" value={pf.stock} onChange={e => setPf({ ...pf, stock: e.target.value })} className="input-field" /></Field>
                <div className="md:col-span-2"><span className="text-xs text-slate-500">정렬 순서는 상품 목록에서 드래그하여 변경할 수 있습니다.</span></div>

                {/* Options */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-400">상품 옵션 (복수 등록 가능)</label>
                    <button type="button" onClick={addOptionRow} className="btn-ghost px-3 py-1.5 text-xs"><Plus className="h-3.5 w-3.5" /> 옵션 추가</button>
                  </div>
                  {pf.options.map((opt, oi) => (
                    <div key={oi} className="rounded-lg border border-navy-700 bg-slate-50 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={opt.name} onChange={e => setOptionName(oi, e.target.value)} placeholder="옵션명 (예: 색상, 사이즈)" className="input-field h-8 flex-1 text-sm" />
                        <button type="button" onClick={() => removeOptionRow(oi)} className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                      <div className="space-y-1.5">
                        {opt.values.map((v, vi) => (
                          <div key={vi} className="flex items-center gap-2">
                            <input value={v.label} onChange={e => setOptionValue(oi, vi, 'label', e.target.value)} placeholder="옵션값 (예: 블랙, L)" className="input-field h-8 flex-1 text-sm" />
                            <input type="number" value={v.price_addition} onChange={e => setOptionValue(oi, vi, 'price_addition', e.target.value)} placeholder="추가 금액" className="input-field h-8 w-28 text-sm" />
                            <span className="text-xs text-slate-500">원</span>
                            {opt.values.length > 1 && <button type="button" onClick={() => removeOptionValue(oi, vi)} className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"><XCircle className="h-3.5 w-3.5" /></button>}
                          </div>
                        ))}
                        <button type="button" onClick={() => addOptionValue(oi)} className="text-xs text-cyan hover:underline"><Plus className="inline h-3 w-3" /> 옵션값 추가</button>
                      </div>
                    </div>
                  ))}
                  {pf.options.length === 0 && <p className="text-xs text-slate-500">옵션이 없는 상품은 기본 가격으로만 판매됩니다.</p>}
                </div>

                {/* Shipping */}
                <div className="md:col-span-2 space-y-3 rounded-lg border border-navy-700 bg-slate-50 p-3">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pf.use_default_shipping} onChange={e => setPf({ ...pf, use_default_shipping: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /> 기본 배송료 설정 사용</label>
                  {!pf.use_default_shipping && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="개별 배송료 (원)"><input type="number" value={pf.shipping_fee} onChange={e => setPf({ ...pf, shipping_fee: e.target.value })} placeholder="3000" className="input-field" /></Field>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-slate-400">배송비 결제 방식</label>
                        <select value={pf.shipping_type} onChange={e => setPf({ ...pf, shipping_type: e.target.value })} className="input-field">
                          <option value="default">기본 설정 따름</option>
                          <option value="prepaid">선불 (주문금액에 합산)</option>
                          <option value="collect">착불 (수령 시 기사에게 결제)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* YouTube URLs */}
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-medium text-slate-400">유튜브 영상 URL (여러 개 등록 가능)</label>
                  {pf.youtube_urls.map((url, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input value={url} onChange={e => setPf(prev => ({ ...prev, youtube_urls: prev.youtube_urls.map((u, j) => j === i ? e.target.value : u) }))} placeholder="https://www.youtube.com/watch?v=..." className="input-field h-9 flex-1 text-sm" />
                      {pf.youtube_urls.length > 1 && <button type="button" onClick={() => setPf(prev => ({ ...prev, youtube_urls: prev.youtube_urls.filter((_, j) => j !== i) }))} className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"><XCircle className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                  <button type="button" onClick={() => setPf(prev => ({ ...prev, youtube_urls: [...prev.youtube_urls, ''] }))} className="text-xs text-cyan hover:underline"><Plus className="inline h-3 w-3" /> 영상 추가</button>
                </div>

                {editProduct && (
                  <div className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pf.is_active} onChange={e => setPf({ ...pf, is_active: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /> 판매 중</label>
                  </div>
                )}
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={pf.is_trial_available} onChange={e => setPf({ ...pf, is_trial_available: e.target.checked })} className="h-4 w-4 rounded border-navy-700" /> 체험단 신청 가능</label>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">{busy ? '저장 중...' : editProduct ? '수정하기' : '등록하기'}</button>
                <button type="button" onClick={() => setShowProductForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}

          {/* Product list */}
          {filteredProducts.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={productSelectedIds.size === filteredProducts.length} onChange={() => setProductSelectedIds(productSelectedIds.size === filteredProducts.length ? new Set() : new Set(filteredProducts.map(p => p.id)))} className="h-4 w-4 rounded" /> 전체 선택</label>
          )}
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const idx = products.indexOf(p);
              const discount = calcDiscountRate(p.original_price, p.club_price);
              const productCatIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
              const productCatNames = productCatIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean);
              const pSelected = productSelectedIds.has(p.id);
              return (
                <div key={p.id} className={`card-surface p-4 transition ${pSelected ? 'ring-1 ring-cyan/40 bg-cyan/[0.03]' : ''}`} draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from)) handleMoveProduct(from, idx); }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" checked={pSelected} onChange={() => setProductSelectedIds(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })} className="mt-1 h-4 w-4 rounded" />
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <GripVertical className="h-4 w-4 cursor-grab text-slate-400 hover:text-slate-600" />
                        <button onClick={() => handleMoveProduct(idx, idx - 1)} disabled={idx === 0} className="text-slate-400 hover:text-cyan disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button onClick={() => handleMoveProduct(idx, idx + 1)} disabled={idx === products.length - 1} className="text-slate-400 hover:text-cyan disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </div>
                      {p.image_url ? <img src={p.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-lg bg-navy-800"><Package className="h-5 w-5 text-slate-600" /></div>}
                      <div>
                        <h3 className="font-gothic text-base font-semibold text-slate-800">{p.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {productCatNames.length > 0 ? productCatNames.join(', ') : '미분류'}</span>
                          <span className="text-cyan">{formatKRW(p.club_price)}</span>
                          {discount > 0 && <span className="text-red-400">{discount}%</span>}
                          <span>재고 {p.stock}</span>
                          {p.options && p.options.length > 0 && <span className="text-slate-600">옵션 {p.options.length}개</span>}
                          {p.detail_link && <a href={p.detail_link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5 text-cyan hover:underline"><ExternalLink className="h-3 w-3" /> 원본 보기</a>}
                          {!p.is_active && <span className="text-red-400">판매 중단</span>}
                          {p.is_trial_available && <span className="inline-flex items-center gap-0.5 rounded-full border border-gold/40 bg-gold/5 px-2 py-0.5 font-medium text-gold-light"><Gift className="h-3 w-3" /> 체험단</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <IconBtn onClick={() => handleToggleActive(p)} title={p.is_active ? '판매 중단' : '판매 시작'} icon={p.is_active ? CheckCircle2 : XCircle} hover="hover:border-cyan hover:text-cyan" />
                      <IconBtn onClick={() => openEditProduct(p)} title="수정" icon={Edit2} hover="hover:border-cyan hover:text-cyan" />
                      <IconBtn onClick={() => handleCopyProduct(p)} title="복사" icon={Copy} hover="hover:border-cyan hover:text-cyan" />
                      <IconBtn onClick={() => handleDeleteProduct(p)} title="삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="card-surface grid place-items-center py-16 text-center">
                <Package className="mb-3 h-10 w-10 text-slate-700" />
                <p className="text-sm text-slate-500">{productSearch.trim() ? '검색 결과가 없습니다.' : '등록된 상품이 없습니다.'}</p>
                {!productSearch.trim() && <button onClick={openCreateProduct} className="btn-primary mt-4 px-4 py-2 text-sm"><Plus className="h-4 w-4" /> 첫 상품 등록</button>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Orders ── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">주문 관리</h2>
            {orderSelectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{orderSelectedIds.size}건 선택</span>
                {orderSubTab === 'pending' && (
                  <button onClick={() => handleBatchOrderStatus('paid')} disabled={busy} className="btn-primary px-3 py-2 text-xs">선택 결제 확인</button>
                )}
                {orderSubTab === 'paid' && (
                  <button onClick={handleBatchShipOrders} disabled={busy} className="btn-primary px-3 py-2 text-xs"><Truck className="mr-1 inline h-3.5 w-3.5" /> 배송진행하기</button>
                )}
                {orderSubTab === 'all' && (
                  <button onClick={handleBatchDeleteOrdersAll} disabled={busy} className="btn-ghost px-3 py-2 text-xs hover:text-red-400 hover:border-red-500"><Trash2 className="mr-1 inline h-3.5 w-3.5" /> 선택 삭제</button>
                )}
                {orderSubTab === 'cancelled' && (
                  <button onClick={handleBatchDeleteOrders} disabled={busy} className="btn-ghost px-3 py-2 text-xs hover:text-red-400 hover:border-red-500"><Trash2 className="mr-1 inline h-3.5 w-3.5" /> 선택 삭제</button>
                )}
                <button onClick={downloadOrdersAsExcel} className="btn-ghost px-3 py-2 text-xs">엑셀 다운로드</button>
                <button onClick={() => setOrderSelectedIds(new Set())} className="btn-ghost px-3 py-2 text-xs">선택 해제</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-navy-700 pb-2">
            {orderSubTabs.map(([key, label, statuses]) => {
              const count = key === 'cancel_request'
                  ? orders.filter(o => o.cancel_requested_at && o.status !== 'cancelled').length
                  : key === 'delivered'
                    ? orders.filter(o => o.status === 'delivered' && isSameMonth(o.delivered_at)).length
                    : key === 'past_delivered'
                      ? orders.filter(o => o.status === 'delivered' && !isSameMonth(o.delivered_at)).length
                      : orders.filter(o => statuses.includes(o.status)).length;
              const active = orderSubTab === key;
              return (
                <button key={key} onClick={() => { setOrderSubTab(key); setOrderSelectedIds(new Set()); }}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${active ? 'bg-cyan text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                  {label} <span className={`ml-1 text-xs ${active ? 'text-white/70' : 'text-slate-400'}`}>({count})</span>
                </button>
              );
            })}
          </div>
          {filteredOrders.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center"><ShoppingBag className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">해당 상태의 주문이 없습니다。</p></div>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm text-slate-500"><input type="checkbox" checked={orderSelectedIds.size === filteredOrders.length && filteredOrders.length > 0} onChange={() => setOrderSelectedIds(orderSelectedIds.size === filteredOrders.length ? new Set() : new Set(filteredOrders.map(o => o.id)))} className="h-4 w-4 rounded" /> 전체 선택</label>
              {filteredOrders.map(o => {
                const sc = orderStatusConfig[o.status] ?? fallbackOrderStatus;
                const ti = tracking[o.id];
                return (
                  <div key={o.id} className="card-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <label className="flex items-start gap-3"><input type="checkbox" checked={orderSelectedIds.has(o.id)} onChange={() => setOrderSelectedIds(prev => { const n = new Set(prev); if (n.has(o.id)) n.delete(o.id); else n.add(o.id); return n; })} className="mt-1 h-4 w-4 rounded" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-gothic text-base font-semibold text-slate-800">{o.recipient_name ?? '알 수 없음'}</h3>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{o.status === 'pending' && <Clock className="h-3 w-3" />}{sc.label}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDateTime(o.created_at)}</span>
                          <span className="flex items-center gap-1 text-cyan"><Banknote className="h-3 w-3" /> {formatKRW(o.total_amount)}</span>
                          {o.shipping_fee > 0 && <span className="text-slate-500">(배송비 {formatKRW(o.shipping_fee)} 포함)</span>}
                          {o.points_used > 0 && <span>포인트 사용 {formatKRW(o.points_used)}</span>}
                        </div>
                        {o.address && <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span>{o.address} {o.address_detail} · {o.recipient_phone}</span></div>}
                        {o.tracking_number && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Truck className="h-3 w-3" /><span>{o.carrier} {o.tracking_number}</span></div>}
                        <div className="mt-2 text-xs text-slate-500">상품: {orderItems.filter(i => i.order_id === o.id).map(i => `${i.product_name} x ${i.quantity}`).join(', ') || '주문 상품 정보 없음'}</div>
                        {o.shipping_message && <div className="mt-1 text-xs text-slate-500">배송 메세지: {o.shipping_message}</div>}
                        {o.cash_receipt_requested && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/5 px-2.5 py-1.5 text-xs font-medium text-cyan">
                            <Receipt className="h-3.5 w-3.5" /> 현금영수증 {o.cash_receipt_type === 'business' ? '지출증빙' : '소득공제'} · {o.cash_receipt_number}
                          </div>
                        )}
                        {o.combined_shipping && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/5 px-2.5 py-1.5 text-xs font-medium text-cyan">
                            <Package className="h-3.5 w-3.5" /> 체험단 합배송
                            {o.trial_application_id && <span className="text-slate-500">(신청번호: {o.trial_application_id.slice(0, 8)})</span>}
                          </div>
                        )}
                      </div>
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                      {o.cancel_requested_at && o.status !== 'cancelled' && (
                        <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-gold-light"><Clock className="h-3.5 w-3.5" /> 회원 취소 요청</div>
                          <div className="mt-1.5 space-y-0.5 text-xs text-slate-600">
                            <div>취소 유형: {o.cancel_type === 'card' ? '카드 결제 취소' : '무통장입금 환불'}</div>
                            {o.cancel_reason && <div>취소 사유: {o.cancel_reason}</div>}
                            {o.cancel_type === 'manual' && o.refund_bank && (
                              <div className="mt-1 rounded bg-white/60 px-2 py-1">
                                <span className="font-medium text-slate-700">환불 계좌:</span> {o.refund_bank} {o.refund_account} ({o.refund_holder})
                              </div>
                            )}
                            {o.cancel_type === 'card' && <p className="text-slate-500">카드 결제 자동 취소 — 별도 조치 불필요</p>}
                          </div>
                          <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-primary mt-2 px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 취소 완료 처리</button>
                        </div>
                      )}
                      {o.status === 'pending' && (<>
                        <button onClick={() => handleOrderStatus(o, 'paid')} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 결제 확인</button>
                        <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400"><XCircle className="h-3.5 w-3.5" /> 주문 취소</button>
                      </>)}
                      {(o.status === 'paid' || o.status === 'preparing') && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={ti?.carrier ?? o.carrier ?? shipDefaultCarrier} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: e.target.value, number: ti?.number ?? o.tracking_number ?? '' } }))} className="input-field h-8 w-32 px-2 py-1 text-xs">{CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                          <input value={ti?.number ?? o.tracking_number ?? ''} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: ti?.carrier ?? o.carrier ?? shipDefaultCarrier, number: e.target.value } }))} placeholder="운송장 번호" className="input-field h-8 w-40 px-2 py-1 text-xs" />
                          <button onClick={() => handleShipOrder(o)} className="btn-primary px-3 py-1.5 text-xs"><Truck className="h-3.5 w-3.5" /> 배송 진행</button>
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
          <p className="text-xs text-slate-500">회원의 구독 활성/비활성 및 기간은 PG 결제 연동 후 결제일에 따라 자동으로 처리됩니다. 관리자는 회원의 등급만 변경할 수 있습니다.</p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">회원 관리</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={e => setMemberSearch(e.target.value)}
                placeholder="이름, 이메일, 연락처, 닉네임, 추천코드 검색"
                className="input-field h-9 w-72 pl-9 text-sm"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {([['all', '전체'], ['special_requested', '특별회원미승인'], ['special_approved', '특별회원승인']] as [typeof memberFilter, string][]).map(([k, label]) => {
                const pendingSpecialCount = k === 'special_requested' ? profiles.filter(p => p.special_member_status === 'requested').length : 0;
                return (
                <button key={k} onClick={() => setMemberFilter(k)} className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${memberFilter === k ? 'bg-cyan text-white shadow-glow' : 'text-slate-500 hover:text-slate-700'}`}>
                  {label}
                  {pendingSpecialCount > 0 && (
                    <span className={`ml-1.5 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${memberFilter === k ? 'bg-white text-cyan' : 'bg-red-500 text-white animate-pulse'}`}>{pendingSpecialCount}</span>
                  )}
                </button>
                );
              })}
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">{selectedIds.size}명 선택됨</span>
                <select value={batchPlanId} onChange={e => setBatchPlanId(e.target.value)} className="input-field h-9 px-2 py-1 text-sm">
                  <option value="">등급 선택</option>
                  {plans.filter(pl => pl.is_active).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </select>
                <button onClick={handleBatchChangeGrade} disabled={!batchPlanId || busy} className="btn-primary px-4 py-2 text-sm">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> 변경 중...</> : <><Crown className="h-4 w-4" /> 일괄 등급 변경</>}
                </button>
                <button onClick={handleBatchApproveSpecial} disabled={busy} className="btn-gold px-4 py-2 text-sm">
                  {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> 승인 중...</> : <><CheckCircle2 className="h-4 w-4" /> 특별회원 일괄 승인</>}
                </button>
                <button onClick={() => { setSelectedIds(new Set()); setBatchPlanId(''); }} className="btn-ghost px-3 py-2 text-sm">선택 해제</button>
              </div>
            )}
          </div>
          {filteredProfiles.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center"><Users className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">해당하는 회원이 없습니다.</p></div>
          ) : (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3"><input type="checkbox" checked={selectedIds.size === filteredProfiles.length && filteredProfiles.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-navy-700" /></th>
                    <th className="px-4 py-3 font-medium">회원</th>
                    <th className="px-4 py-3 font-medium">카페 닉네임</th>
                    <th className="px-4 py-3 font-medium">카페 회원 여부</th>
                    <th className="px-4 py-3 font-medium">특별회원</th>
                    <th className="px-4 py-3 font-medium">연락처</th>
                    <th className="px-4 py-3 font-medium">구독 상태</th>
                    <th className="px-4 py-3 font-medium">등급</th>
                    <th className="px-4 py-3 font-medium">포인트</th>
                    <th className="px-4 py-3 font-medium">추천코드</th>
                    <th className="px-4 py-3 font-medium">가입일</th>
                    <th className="px-4 py-3 font-medium">역할</th>
                    <th className="px-4 py-3 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {filteredProfiles.map(p => {
                    const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                    const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                    const selected = selectedIds.has(p.id);
                    const cm = p.cafe_membership ?? 'none';
                    const sms = p.special_member_status;
                    return (
                      <tr key={p.id} className={`transition hover:bg-slate-100 ${selected ? 'bg-cyan/5' : ''}`}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={() => toggleSelect(p.id)} className="h-4 w-4 rounded border-navy-700" /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                            <div><div className="font-medium text-slate-800">{p.full_name}</div><div className="text-xs text-slate-400">{p.email}</div></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.cafe_nickname ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cm === 'special' ? 'border-gold/40 text-gold-deep bg-gold/5' : cm === 'none' ? 'border-slate-300 text-slate-500' : 'border-cyan/40 text-cyan bg-cyan/5'}`}>{cafeMembershipLabel[cm]}</span>
                        </td>
                        <td className="px-4 py-3">
                          {sms === 'approved' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/5 px-2.5 py-0.5 text-xs font-medium text-green-400"><CheckCircle2 className="h-3 w-3" /> 승인됨</span>
                          ) : sms === 'requested' ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/5 px-2.5 py-0.5 text-xs font-medium text-amber-600"><Clock className="h-3 w-3" /> 미승인</span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.phone ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                          {p.subscription_expires_at && <div className="mt-0.5 text-[10px] text-slate-600">만료: {formatDate(p.subscription_expires_at)}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{plan?.name ?? '—'}</td>
                        <td className="px-4 py-3 text-cyan">{p.points?.toLocaleString() ?? '0'}</td>
                        <td className="px-4 py-3 text-slate-400">{p.my_referral_code ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{formatDate(p.created_at)}</td>
                        <td className="px-4 py-3">{p.role === 'admin' ? <span className="chip border-gold/40 text-gold-light"><Crown className="h-3 w-3" /> ADMIN</span> : <span className="chip">MEMBER</span>}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <IconBtn onClick={() => handleToggleRole(p)} title={p.role === 'admin' ? '정회원으로 강등' : '관리자로 승격'} icon={p.role === 'admin' ? UserIcon : Crown} hover="hover:border-gold hover:text-gold" />
                            {p.id !== profile.id && <IconBtn onClick={() => { setPwModalId(p.id); setPwValue(''); setPwErr(null); setPwSuccess(false); }} title="비밀번호 변경" icon={KeyRound} hover="hover:border-cyan hover:text-cyan" />}
                            {sms === 'requested' ? (
                              <button onClick={() => handleApproveSpecial(p)} title="특별회원 승인" className="inline-flex items-center gap-1 rounded-md border border-green-500/50 px-2 py-1 text-xs font-medium text-green-500 hover:bg-green-500/10"><CheckCircle2 className="h-3.5 w-3.5" /> 승인</button>
                            ) : sms === 'approved' ? (
                              <button onClick={() => handleUnapproveSpecial(p)} title="특별회원 승인 취소" className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 px-2 py-1 text-xs font-medium text-amber-600 hover:bg-amber-500/10"><XCircle className="h-3.5 w-3.5" /> 승인취소</button>
                            ) : (
                              <button onClick={() => handleApproveSpecial(p)} title="특별회원 지정" className="inline-flex items-center gap-1 rounded-md border border-gold/50 px-2 py-1 text-xs font-medium text-gold-deep hover:bg-gold/10"><Star className="h-3.5 w-3.5" /> 특별회원 지정</button>
                            )}
                            {sms && <IconBtn onClick={() => handleClearSpecial(p)} title="특별회원 표시 해제" icon={XCircle} hover="hover:border-slate-500 hover:text-slate-500" />}
                            <select value={p.subscription_plan_id ?? ''} onChange={e => handleChangeGrade(p, e.target.value)} className="input-field h-7 w-24 px-1 py-0.5 text-xs" disabled={!plans.filter(pl => pl.is_active).length}>
                              <option value="" disabled>등급 선택</option>
                              {plans.filter(pl => pl.is_active).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                            </select>
                            {p.id !== profile.id && <IconBtn onClick={() => handleDeleteProfileAction(p)} title="회원 삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />}
                            {p.subscription_status !== 'active' ? (
                              <button onClick={() => openActivateModal(p)} title="구독 수동 활성화" className="inline-flex items-center gap-1 rounded-md border border-cyan/50 px-2 py-1 text-xs font-medium text-cyan hover:bg-cyan/10">
                                <Power className="h-3.5 w-3.5" /> 활성화
                              </button>
                            ) : (
                              <button onClick={() => handleDeactivate(p)} title="구독 해제" className="inline-flex items-center gap-1 rounded-md border border-slate-400 px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100">
                                <Power className="h-3.5 w-3.5" /> 해제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Password change modal */}
          {pwModalId && (
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setPwModalId(null)}>
              <div className="card-surface w-full max-w-sm space-y-4 p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-gothic text-base font-semibold text-slate-800">비밀번호 변경</h3>
                  <button onClick={() => setPwModalId(null)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
                </div>
                <p className="text-sm text-slate-500">{profiles.find(p => p.id === pwModalId)?.full_name} 회원의 새 비밀번호를 입력하세요.</p>
                <div>
                  <input
                    type="password"
                    value={pwValue}
                    onChange={e => { setPwValue(e.target.value); setPwErr(null); }}
                    placeholder="새 비밀번호 (최소 6자)"
                    className="input-field"
                    autoFocus
                  />
                  {pwErr && <p className="mt-2 text-xs text-red-400">{pwErr}</p>}
                  {pwSuccess && <p className="mt-2 flex items-center gap-1.5 text-xs text-green-500"><CheckCircle2 className="h-3.5 w-3.5" /> 비밀번호가 변경되었습니다.</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleResetPassword} disabled={pwBusy} className="btn-primary px-5 py-2.5 text-sm">
                    {pwBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> 변경 중...</> : '비밀번호 변경'}
                  </button>
                  <button onClick={() => setPwModalId(null)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subscription activation modal */}
      {actModalId && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50" onClick={() => setActModalId(null)}>
          <div className="card-surface w-full max-w-sm space-y-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-gothic text-base font-semibold text-slate-800">구독 수동 활성화</h3>
              <button onClick={() => setActModalId(null)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-500">{profiles.find(p => p.id === actModalId)?.full_name} 회원의 구독을 선택한 날짜까지 활성화합니다.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">회원 등급</label>
                <select value={actPlanId} onChange={e => setActPlanId(e.target.value)} className="input-field text-sm">
                  <option value="" disabled>등급 선택</option>
                  {plans.filter(pl => pl.is_active).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">결제 주기</label>
                <select value={actPeriod} onChange={e => setActPeriod(e.target.value as 'monthly' | 'annual')} className="input-field text-sm">
                  <option value="monthly">월 결제</option>
                  <option value="annual">연 결제</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">만료일</label>
                <input type="date" value={actDate} onChange={e => setActDate(e.target.value)} className="input-field text-sm" />
              </div>
              {actErr && <p className="text-xs text-red-400">{actErr}</p>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleActivateSubmit} disabled={actBusy} className="btn-primary px-5 py-2.5 text-sm">
                {actBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> 활성화 중...</> : '활성화'}
              </button>
              <button onClick={() => setActModalId(null)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
      {/* ── Bank Transfer Confirmation ── */}
      {tab === 'bank_transfers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">무통장 입금 확인</h2>
            <button onClick={loadPendingTransfers} className="btn-ghost px-4 py-2 text-sm">
              <Loader2 className={`h-4 w-4 ${transferLoading ? 'animate-spin' : ''}`} /> 새로고침
            </button>
          </div>
          {!bankNameVal || !bankAccountVal || !bankHolderVal ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Building2 className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">무통장 입금 계좌가 설정되지 않았습니다.</p>
              <p className="mt-1 text-xs text-slate-500">대시보드 탭에서 계좌 정보를 먼저 설정해주세요.</p>
            </div>
          ) : transferLoading ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          ) : pendingTransfers.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <CheckCircle2 className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">입금 대기 중인 신청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingTransfers.map(t => {
                const mp = profiles.find(p => p.id === t.user_id);
                const plan = plans.find(pl => pl.id === t.plan_id);
                return (
                  <div key={t.id} className="card-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan/10">
                          <Building2 className="h-5 w-5 text-cyan" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-800">{t.depositor_name ?? mp?.full_name ?? '알 수 없음'}</span>
                            <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/5 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                              <Clock className="h-3 w-3" /> 입금 대기
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span>회원: {mp?.full_name ?? '—'} ({mp?.email ?? '—'})</span>
                            <span>등급: {plan?.name ?? '—'}</span>
                            <span>결제 주기: {t.billing_period === 'annual' ? '연 결제' : '월 결제'}</span>
                            <span>신청일: {formatDate(t.created_at)}</span>
                          </div>
                          <div className="mt-2 text-lg font-bold text-cyan">{formatKRW(t.amount)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleConfirmTransfer(t)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-green-500/50 px-3 py-2 text-xs font-medium text-green-500 hover:bg-green-500/10">
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} 입금 확인
                        </button>
                        <button onClick={() => handleRejectTransfer(t)} disabled={busy} className="inline-flex items-center gap-1 rounded-md border border-red-500/50 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10">
                          <XCircle className="h-3.5 w-3.5" /> 거절
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
                <Field label="내용"><RichTextEditor value={postF.content} onChange={html => setPostF({ ...postF, content: html })} minHeight={250} /></Field>
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

      {/* ── Reviews ── */}
      {tab === 'reviews' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">후기 관리</h2>
            <button onClick={() => { setReviewF(emptyReviewForm); setShowReviewForm(true); }} className="btn-primary px-4 py-2 text-sm">
              <Plus className="h-4 w-4" /> 후기 작성
            </button>
          </div>

          {showReviewForm && (
            <form onSubmit={handleReviewSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-800">후기 작성</h3>
                <button type="button" onClick={() => setShowReviewForm(false)} className="text-slate-500 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Field label="상품 선택">
                  <select value={reviewF.product_id} onChange={e => setReviewF({ ...reviewF, product_id: e.target.value })} className="input-field text-sm">
                    <option value="">상품을 선택하세요</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="작성자 이메일">
                  <input value={reviewF.author_email} onChange={e => setReviewF({ ...reviewF, author_email: e.target.value })} placeholder="example@email.com" className="input-field text-sm" />
                </Field>
                <Field label="작성일 (선택)" hint="비워두면 현재 날짜로 저장됩니다">
                  <input type="date" value={reviewF.created_at} onChange={e => setReviewF({ ...reviewF, created_at: e.target.value })} className="input-field text-sm" />
                </Field>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">만족도</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <button key={s} type="button" onClick={() => setReviewF({ ...reviewF, rating: s })} className="transition hover:scale-110">
                        <Star size={24} className={s <= reviewF.rating ? 'fill-gold text-gold' : 'text-slate-300'} />
                      </button>
                    ))}
                    <span className="ml-2 text-sm font-medium text-slate-600">{reviewF.rating}점</span>
                  </div>
                </div>
                <Field label={`후기 내용 (${reviewF.content.length}/150)`}>
                  <textarea value={reviewF.content} onChange={e => setReviewF({ ...reviewF, content: e.target.value.slice(0, 150) })} rows={4} placeholder="150자 이하로 작성" className="input-field text-sm" />
                </Field>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">사진 (최대 3장)</label>
                  <div className="flex flex-wrap gap-2">
                    {reviewF.images.map((img, i) => (
                      <div key={i} className="relative">
                        <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                        <button type="button" onClick={() => setReviewF(prev => ({ ...prev, images: prev.images.filter((_, idx) => idx !== i) }))} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white"><X className="h-3 w-3" /></button>
                      </div>
                    ))}
                    {reviewF.images.length < 3 && (
                      <ImageUpload value="" onChange={url => { if (url) setReviewF(prev => ({ ...prev, images: [...prev.images, url] })); }} label="" bucket="product-images" folder="reviews" className="w-20" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={reviewBusy} className="btn-primary px-5 py-2.5 text-sm">{reviewBusy ? '작성 중...' : '후기 등록'}</button>
                <button type="button" onClick={() => setShowReviewForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {reviews.length === 0 ? (
              <div className="card-surface grid place-items-center py-16 text-center"><Star className="mb-3 h-10 w-10 text-slate-300" /><p className="text-sm text-slate-500">등록된 후기가 없습니다.</p></div>
            ) : (
              reviews.map(r => {
                const product = products.find(p => p.id === r.product_id);
                return (
                  <div key={r.id} className="card-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{product?.name ?? '상품 없음'}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{r.author_email}</span>
                          <span>·</span>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => <Star key={s} size={12} className={s <= r.rating ? 'fill-gold text-gold' : 'text-slate-300'} />)}
                          </div>
                          <span>·</span>
                          <span>{formatDate(r.created_at)}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-600">{r.content}</p>
                        {r.images && r.images.length > 0 && (
                          <div className="mt-2 flex gap-1.5">
                            {r.images.map((img, i) => <img key={i} src={img} alt="" className="h-16 w-16 rounded-lg object-cover border border-slate-200" />)}
                          </div>
                        )}
                      </div>
                      <IconBtn onClick={() => handleDeleteReview(r)} title="삭제" icon={Trash2} hover="hover:border-red-500 hover:text-red-400" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Inquiries ── */}
      {tab === 'inquiries' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">1:1 문의 관리</h2>
          {inquiries.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">접수된 문의가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inquiries.map(inq => {
                const author = profiles.find(p => p.id === inq.user_id);
                const isReplying = inquiryReplyId === inq.id;
                return (
                  <div key={inq.id} className="card-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            inq.status === 'answered'
                              ? 'border-green-500/40 text-green-400 bg-green-500/5'
                              : 'border-gold/40 text-gold-light bg-gold/5'
                          }`}>
                            {inq.status === 'answered' ? <><CheckCircle2 className="h-3 w-3" /> 답변완료</> : <><Clock className="h-3 w-3" /> 답변대기</>}
                          </span>
                          <span className="text-xs text-slate-500">{author?.full_name ?? '알 수 없음'}</span>
                          <span className="ml-auto text-xs text-slate-500">{formatDate(inq.created_at)}</span>
                        </div>
                        <h3 className="mt-3 font-gothic text-base font-semibold text-slate-800">{inq.title}</h3>
                        <div className="mt-2 rounded-lg border border-navy-700 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{inq.content}</div>
                      </div>
                    </div>

                    {inq.answer && !isReplying && (
                      <div className="mt-3 rounded-lg border border-cyan/30 bg-cyan/5 p-3">
                        <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-cyan">
                          <MessageSquare className="h-3.5 w-3.5" /> 관리자 답변
                          <span className="ml-auto font-normal text-slate-500">{formatDate(inq.answered_at ?? inq.updated_at)}</span>
                        </div>
                        <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{inq.answer}</div>
                      </div>
                    )}

                    {isReplying ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={inquiryReplyText}
                          onChange={e => setInquiryReplyText(e.target.value)}
                          placeholder="답변을 입력하세요"
                          rows={4}
                          className="input-field text-sm"
                        />
                        <div className="flex gap-2">
                          <button
                            disabled={inquiryBusy || !inquiryReplyText.trim()}
                            onClick={async () => {
                              setInquiryBusy(true);
                              try {
                                if (inq.answer) await updateInquiryAnswer(inq.id, inquiryReplyText.trim(), profile.id);
                                else await answerInquiry(inq.id, inquiryReplyText.trim(), profile.id);
                                setInquiryReplyId(null); setInquiryReplyText(''); refresh();
                              } catch (e: any) { alert(e.message || '답변 작성에 실패했습니다.'); }
                              finally { setInquiryBusy(false); }
                            }}
                            className="btn-primary px-4 py-2 text-sm"
                          >
                            {inquiryBusy ? '저장 중...' : '답변 저장'}
                          </button>
                          <button onClick={() => { setInquiryReplyId(null); setInquiryReplyText(''); }} className="btn-ghost px-4 py-2 text-sm">취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button
                          onClick={() => { setInquiryReplyId(inq.id); setInquiryReplyText(inq.answer ?? ''); }}
                          className="btn-ghost px-4 py-2 text-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" /> {inq.answer ? '답변 수정' : '답변 작성'}
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm('이 문의를 삭제하시겠습니까?')) {
                              try { await deleteInquiry(inq.id); refresh(); }
                              catch (e: any) { alert(e.message || '문의 삭제에 실패했습니다.'); }
                            }
                          }}
                          className="btn-ghost px-3 py-2 text-sm hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> 삭제
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
                <Field label="연 구독료 (원)" hint="빈 칸이면 연 결제 미지원. 11개월 무료 체험 혜택 포함"><input type="number" value={planF.annual_price} onChange={e => setPlanF({ ...planF, annual_price: e.target.value })} placeholder="108900" className="input-field" /></Field>
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
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500"><span className="text-gold-light">{formatKRW(p.monthly_price)}/월</span>{p.annual_price ? <span className="text-cyan">{formatKRW(p.annual_price)}/11개월</span> : null}<span>할인 {p.discount_rate}%</span></div>
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

      {/* ── Trials ── */}
      {tab === 'trials' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">체험단 관리</h2>
          {trials.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Gift className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">접수된 체험단 신청이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trials.map(inq => {
                const applicant = profiles.find(p => p.id === inq.user_id);
                const product = inq.product_id ? products.find(p => p.id === inq.product_id) : null;
                const remainingDays = inq.shipped_at ? getRemainingDays(
                  new Date(new Date(inq.shipped_at).getTime() + 30 * 86400000).toISOString(),
                ) : null;
                return (
                  <div key={inq.id} className="card-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                            inq.status === 'completed' ? 'border-green-500/40 text-green-400 bg-green-500/5'
                            : inq.status === 'shipped' ? 'border-cyan/40 text-cyan bg-cyan/5'
                            : inq.status === 'approved' ? 'border-cyan/40 text-cyan bg-cyan/5'
                            : inq.status === 'rejected' ? 'border-red-500/40 text-red-400 bg-red-500/5'
                            : 'border-gold/40 text-gold-light bg-gold/5'
                          }`}>
                            {inq.status === 'completed' && <><CheckCircle2 className="h-3 w-3" /> 완료</>}
                            {inq.status === 'shipped' && <><Truck className="h-3 w-3" /> 발송완료</>}
                            {inq.status === 'approved' && <><CheckCircle2 className="h-3 w-3" /> 승인</>}
                            {inq.status === 'rejected' && <><XCircle className="h-3 w-3" /> 거절</>}
                            {inq.status === 'pending' && <><Clock className="h-3 w-3" /> 대기</>}
                          </span>
                          <span className="text-xs text-slate-500">{applicant?.full_name ?? '알 수 없음'}</span>
                          {inq.review_url_submitted_at && isNewer(inq.review_url_submitted_at, lastSeen.trials ?? 0) && (
                            <span className="inline-flex items-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white animate-pulse">URL 제출</span>
                          )}
                          <span className="ml-auto text-xs text-slate-500">{formatDate(inq.created_at)}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-3">
                          {product?.image_url && <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                          <div>
                            <h3 className="font-gothic text-base font-semibold text-slate-800">{product?.name ?? '상품 정보 없음'}</h3>
                            <p className="mt-0.5 text-xs text-slate-500">신청자: {inq.recipient_name} · {inq.recipient_phone}</p>
                          </div>
                        </div>
                        <div className="mt-2 rounded-lg border border-navy-700 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                          <span className="text-xs font-semibold text-slate-500">신청 이유: </span>{inq.reason}
                        </div>
                        <div className="mt-2 text-xs text-slate-500">
                          <span className="font-semibold">주소: </span>{inq.address} {inq.address_detail} · <span className="font-semibold">리뷰 플랫폼: </span>{inq.review_platform}
                        </div>
                      </div>
                    </div>

                    {inq.reject_reason && (
                      <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
                        <div className="mb-1 text-xs font-semibold text-red-400">거절 사유</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{inq.reject_reason}</div>
                      </div>
                    )}

                    {inq.shipped_at && (
                      <div className="mt-3 rounded-lg border border-cyan/30 bg-cyan/5 p-3 text-sm">
                        <div className="flex items-center gap-2 text-xs font-semibold text-cyan">
                          <Truck className="h-3.5 w-3.5" /> 발송일: {formatDate(inq.shipped_at)}
                          {remainingDays !== null && remainingDays > 0 && inq.status !== 'completed' && (
                            <span className="ml-auto font-normal text-slate-500">리뷰 마감까지 {remainingDays}일</span>
                          )}
                          {remainingDays !== null && remainingDays <= 0 && inq.status !== 'completed' && (
                            <span className="ml-auto font-normal text-red-400">기한 초과</span>
                          )}
                        </div>
                        {inq.review_url && (
                          <a href={inq.review_url} target="_blank" rel="noopener noreferrer" className="mt-1.5 flex items-center gap-1.5 break-all text-cyan hover:underline">
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {inq.review_url}
                          </a>
                        )}
                      </div>
                    )}

                    {inq.completed_at && inq.admin_comment && (
                      <div className="mt-3 rounded-lg border border-green-500/30 bg-green-500/5 p-3">
                        <div className="mb-1 text-xs font-semibold text-green-400">완료 코멘트 ({formatDate(inq.completed_at)})</div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap">{inq.admin_comment}</div>
                      </div>
                    )}

                    {/* Action buttons */}
                    {inq.status === 'pending' && (
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button onClick={async () => { try { await approveTrialApplication(inq.id); refresh(); } catch (e: any) { alert(e.message); } }} className="btn-primary px-4 py-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 승인
                        </button>
                        <button onClick={() => { const reason = prompt('거절 사유를 입력하세요'); if (reason !== null) { rejectTrialApplication(inq.id, reason.trim()).then(refresh).catch((e: any) => alert(e.message)); } }} className="btn-ghost px-4 py-2 text-sm hover:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> 거절
                        </button>
                        <button onClick={() => { if (confirm('이 신청을 삭제하시겠습니까?')) { deleteTrialApplication(inq.id).then(refresh).catch((e: any) => alert(e.message)); } }} className="btn-ghost px-3 py-2 text-sm hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" /> 삭제
                        </button>
                      </div>
                    )}

                    {inq.status === 'approved' && (
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button onClick={async () => { try { await shipTrialApplication(inq.id); refresh(); } catch (e: any) { alert(e.message); } }} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700">
                          <Truck className="h-3.5 w-3.5" /> 발송 완료 처리
                        </button>
                      </div>
                    )}

                    {inq.status === 'shipped' && (
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button onClick={() => {
                          const comment = prompt('완료 코멘트를 입력하세요');
                          if (comment !== null) {
                            completeTrialApplication(inq.id, comment.trim()).then(refresh).catch((e: any) => alert(e.message));
                          }
                        }} className="btn-primary px-4 py-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 체험 완료 처리
                        </button>
                      </div>
                    )}

                    {(inq.status === 'completed' || inq.status === 'rejected') && (
                      <div className="mt-3 flex justify-end gap-1.5">
                        <button onClick={() => { if (confirm('이 신청을 삭제하시겠습니까?')) { deleteTrialApplication(inq.id).then(refresh).catch((e: any) => alert(e.message)); } }} className="btn-ghost px-3 py-2 text-sm hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" /> 삭제
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Analytics ── */}
      {tab === 'analytics' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">로그 분석</h2>
            <div className="flex items-center gap-2">
              <select value={analyticsDays} onChange={e => { const d = parseInt(e.target.value, 10); setAnalyticsDays(d); }} className="input-field h-9 px-3 text-sm">
                <option value={1}>최근 1일</option>
                <option value={3}>최근 3일</option>
                <option value={7}>최근 7일</option>
                <option value={14}>최근 14일</option>
                <option value={30}>최근 30일</option>
              </select>
              <button onClick={loadAnalytics} disabled={analyticsLoading} className="btn-ghost px-4 py-2 text-sm">
                <Loader2 className={`h-4 w-4 ${analyticsLoading ? 'animate-spin' : ''}`} /> 새로고침
              </button>
            </div>
          </div>

          {analyticsLoading ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-slate-400" />
              <p className="text-sm text-slate-500">불러오는 중...</p>
            </div>
          ) : !analyticsData || analyticsData.totalVisitors === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Search className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-500">해당 기간의 방문 기록이 없습니다.</p>
            </div>
          ) : (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <div className="card-surface p-4">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-cyan/10"><TrendingUp className="h-4 w-4 text-cyan" /></div>
                  <div className="font-gothic text-xl font-bold text-slate-800">{analyticsData.totalVisitors}</div>
                  <div className="text-xs text-slate-500">총 방문 (PV)</div>
                </div>
                <div className="card-surface p-4">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-gold/10"><Users className="h-4 w-4 text-gold" /></div>
                  <div className="font-gothic text-xl font-bold text-slate-800">{analyticsData.uniqueVisitors}</div>
                  <div className="text-xs text-slate-500">고유 방문자 (UV)</div>
                </div>
                <div className="card-surface p-4">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-cyan/10"><UserIcon className="h-4 w-4 text-cyan" /></div>
                  <div className="font-gothic text-xl font-bold text-slate-800">{analyticsData.todayVisitors}</div>
                  <div className="text-xs text-slate-500">오늘 방문 (PV)</div>
                </div>
                <div className="card-surface p-4">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-gold/10"><Users className="h-4 w-4 text-gold" /></div>
                  <div className="font-gothic text-xl font-bold text-slate-800">{analyticsData.todayUniqueVisitors}</div>
                  <div className="text-xs text-slate-500">오늘 고유 (UV)</div>
                </div>
                <div className="card-surface p-4">
                  <div className="mb-2 inline-grid h-9 w-9 place-items-center rounded-lg bg-slate-200"><Package className="h-4 w-4 text-slate-600" /></div>
                  <div className="font-gothic text-xl font-bold text-slate-800">{analyticsData.mobileVisitors}</div>
                  <div className="text-xs text-slate-500">모바일 방문</div>
                </div>
              </div>

              {/* Daily chart */}
              <div className="card-surface p-5">
                <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                  <TrendingUp className="h-4 w-4 text-cyan" /> 일별 방문 추이
                </div>
                <div className="space-y-2">
                  {analyticsData.dailyCounts.map(d => {
                    const maxCount = Math.max(...analyticsData.dailyCounts.map(x => x.count), 1);
                    const pct = (d.count / maxCount) * 100;
                    return (
                      <div key={d.date} className="flex items-center gap-3">
                        <span className="w-24 text-xs text-slate-500">{formatDate(d.date)}</span>
                        <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-100">
                          <div className="h-7 rounded-lg bg-gradient-to-r from-cyan/60 to-cyan" style={{ width: `${pct}%` }} />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-700">{d.count} 방문 · {d.unique} 고유</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Path breakdown */}
                <div className="card-surface p-5">
                  <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                    <MapPin className="h-4 w-4 text-cyan" /> 방문 경로 (페이지별)
                  </div>
                  <div className="space-y-2">
                    {analyticsData.pathCounts.map(({ path, count }) => {
                      const maxCount = Math.max(...analyticsData.pathCounts.map(x => x.count), 1);
                      const pct = (count / maxCount) * 100;
                      return (
                        <div key={path} className="flex items-center gap-3">
                          <span className="w-32 truncate text-xs font-medium text-slate-700" title={path}>{path || '/'}</span>
                          <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-100">
                            <div className="h-6 rounded-lg bg-cyan/40" style={{ width: `${pct}%` }} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-700">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Referrer breakdown */}
                <div className="card-surface p-5">
                  <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                    <ExternalLink className="h-4 w-4 text-cyan" /> 유입 경로 (Referrer)
                  </div>
                  {analyticsData.referrerCounts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">유입 경로 데이터가 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {analyticsData.referrerCounts.map(({ referrer, count }) => {
                        const maxCount = Math.max(...analyticsData.referrerCounts.map(x => x.count), 1);
                        const pct = (count / maxCount) * 100;
                        return (
                          <div key={referrer} className="flex items-center gap-3">
                            <span className="w-36 truncate text-xs font-medium text-slate-700" title={referrer}>{referrer}</span>
                            <div className="relative flex-1 overflow-hidden rounded-lg bg-slate-100">
                              <div className="h-6 rounded-lg bg-gold/40" style={{ width: `${pct}%` }} />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-700">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Search keywords */}
              {analyticsData.keywordCounts.length > 0 && (
                <div className="card-surface p-5">
                  <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                    <Search className="h-4 w-4 text-cyan" /> 검색 키워드
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analyticsData.keywordCounts.map(({ keyword, count }) => (
                      <span key={keyword} className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1.5 text-sm font-medium text-cyan">
                        {keyword} <span className="text-xs text-slate-500">{count}회</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent visits */}
              <div className="card-surface p-5">
                <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
                  <Clock className="h-4 w-4 text-cyan" /> 최근 방문 기록 (최대 50건)
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">시간</th>
                        <th className="px-4 py-3 font-medium">경로</th>
                        <th className="px-4 py-3 font-medium">유입 경로</th>
                        <th className="px-4 py-3 font-medium">기기</th>
                        <th className="px-4 py-3 font-medium">검색어</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700">
                      {analyticsData.recentVisits.map(v => (
                        <tr key={v.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(v.created_at)}</td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700">{v.path || '/'}</td>
                          <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate" title={v.referrer ?? ''}>{v.referrer ? (() => { try { return new URL(v.referrer).hostname } catch { return v.referrer.slice(0, 30) } })() : '직접 방문'}</td>
                          <td className="px-4 py-3"><span className={`text-xs ${v.is_mobile ? 'text-cyan' : 'text-slate-500'}`}>{v.is_mobile ? '모바일' : 'PC'}</span></td>
                          <td className="px-4 py-3 text-xs text-slate-600">{v.search_keyword ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div><label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>{children}{hint && <p className="mt-1 text-[10px] text-slate-500">{hint}</p>}</div>
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
