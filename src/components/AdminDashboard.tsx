import { useEffect, useState, useMemo } from 'react';
import {
  Plus, Package, Users, ShoppingBag, TrendingUp, Clock, CheckCircle2,
  XCircle, Trash2, Edit2, Banknote, Truck, MapPin, Calendar, Tag,
  Crown, Megaphone, Eye, Lock, Pin, ExternalLink,
  Loader2, User as UserIcon, Flame, KeyRound, GripVertical, ArrowUp, ArrowDown, Copy,
} from 'lucide-react';
import {
  Profile, Product, ProductOption, Category, Order, OrderItem, Post, SubscriptionPlan, OrderStatus, Setting,
} from '../lib/types';
import { formatKRW, formatDate, formatDateTime, calcDiscountRate } from '../lib/format';
import {
  createProduct, updateProduct, deleteProduct,
  createCategory, updateCategory, deleteCategory,
  createPost, updatePost, deletePost,
  createPlan, updatePlan, deletePlan,
  updateOrderStatus, batchUpdateOrderStatus, setProfileRole, deleteProfile,
  changeMemberGrade, batchChangeMemberGrade,
  updateSetting, getSettingValue,
  resetMemberPassword,
} from '../lib/adminData';
import ImageUpload from './ImageUpload';

type Tab = 'overview' | 'products' | 'orders' | 'members' | 'posts' | 'plans';
type OrderSubTab = 'all' | 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

const orderSubTabs: [OrderSubTab, string, OrderStatus[]][] = [
  ['all', '전체', ['pending', 'paid', 'preparing', 'shipped', 'delivered', 'cancelled']],
  ['pending', '주문', ['pending']],
  ['paid', '결제완료', ['paid', 'preparing']],
  ['shipped', '배송중', ['shipped']],
  ['delivered', '배송완료', ['delivered']],
  ['cancelled', '취소', ['cancelled']],
];

interface Props {
  profile: Profile; products: Product[]; categories: Category[]; orders: Order[]; orderItems: OrderItem[];
  profiles: Profile[]; posts: Post[]; plans: SubscriptionPlan[]; settings: Setting[]; refresh: () => void;
}

interface OptionFormRow { name: string; values: { label: string; price_addition: string }[]; }
interface ProductForm { name: string; category_ids: string[]; original_price: string; club_price: string; description: string; image_url: string; sub_images: string[]; detail_link: string; sku: string; stock: string; is_active: boolean; sort_order: string; options: OptionFormRow[]; youtube_urls: string[]; use_default_shipping: boolean; shipping_fee: string; shipping_type: string; }
const emptyProductForm: ProductForm = { name: '', category_ids: [], original_price: '', club_price: '', description: '', image_url: '', sub_images: [], detail_link: '', sku: '', stock: '100', is_active: true, sort_order: '0', options: [], youtube_urls: [], use_default_shipping: true, shipping_fee: '', shipping_type: 'default' };

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

export default function AdminDashboard({ profile, products, categories, orders, orderItems, profiles, posts, plans, settings, refresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [orderSubTab, setOrderSubTab] = useState<OrderSubTab>('all');
  const [busy, setBusy] = useState(false);

  const recruitmentOpen = getSettingValue(settings, 'recruitment_open') !== 'false';
  const recruitmentLimit = parseInt(getSettingValue(settings, 'recruitment_limit') ?? '500', 10);
  const recruitmentBatch = getSettingValue(settings, 'recruitment_batch') ?? '1';
  const activeSubs = profiles.filter(p => p.subscription_status === 'active').length;

  const [showProductForm, setShowProductForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [pf, setPf] = useState<ProductForm>(emptyProductForm);


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
  const [pwModalId, setPwModalId] = useState<string | null>(null);
  const [pwValue, setPwValue] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    const overdueOrders = orders.filter(o => o.status === 'shipped' && o.shipped_at && Date.now() - new Date(o.shipped_at).getTime() >= 2 * 86400000);
    if (overdueOrders.length > 0) {
      Promise.all(overdueOrders.map(o => updateOrderStatus(o.id, 'delivered'))).then(refresh);
    }
  }, [orders, refresh]);

  const stats = useMemo(() => ({
    totalMembers: profiles.length,
    activeSubs: profiles.filter(p => p.subscription_status === 'active').length,
    totalOrders: orders.length,
    confirmedRevenue: orders.filter(o => ['paid', 'preparing', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + o.total_amount, 0),
  }), [profiles, orders]);

  const orderSubTabConfig = orderSubTabs.find(t => t[0] === orderSubTab) ?? orderSubTabs[0];
  const filteredOrders = useMemo(() => orders.filter(o => orderSubTabConfig[2].includes(o.status)), [orders, orderSubTabConfig]);

  // ── Product ──
  function openCreateProduct() { setEditProduct(null); setPf(emptyProductForm); setShowProductForm(true); }
  function openEditProduct(p: Product) {
    setEditProduct(p);
    const catIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
    const opts: OptionFormRow[] = (p.options ?? []).map(o => ({ name: o.name, values: o.values.map(v => ({ label: v.label, price_addition: String(v.price_addition) })) }));
    setPf({ name: p.name, category_ids: catIds, original_price: String(p.original_price), club_price: String(p.club_price), description: p.description ?? '', image_url: p.image_url ?? '', sub_images: p.sub_images ?? [], detail_link: p.detail_link ?? '', sku: p.sku ?? '', stock: String(p.stock), is_active: p.is_active, sort_order: String(p.sort_order), options: opts, youtube_urls: p.youtube_urls ?? [], use_default_shipping: p.use_default_shipping ?? true, shipping_fee: p.shipping_fee != null ? String(p.shipping_fee) : '', shipping_type: p.shipping_type ?? 'default' });
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
        image_url: pf.image_url.trim() || null, sub_images: subVal, sku: pf.sku.trim() || null,
        stock: Number(pf.stock) || 0, sort_order: Number(pf.sort_order) || 0,
        detail_link: pf.detail_link.trim() || null,
        options: cleanOptions,
        youtube_urls: ytVal,
        use_default_shipping: pf.use_default_shipping,
        shipping_fee: shipFee,
        shipping_type: pf.shipping_type,
      };
      if (editProduct) await updateProduct(editProduct.id, { ...common, description: pf.description.trim() || null, is_active: pf.is_active });
      else await createProduct({ ...common, description: pf.description.trim() || undefined });
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
      image_url: p.image_url, sub_images: p.sub_images ?? undefined,
      sku: p.sku ?? undefined, stock: p.stock, sort_order: products.length,
      detail_link: p.detail_link ?? undefined,
      options: p.options ?? null,
      youtube_urls: p.youtube_urls ?? undefined,
      use_default_shipping: p.use_default_shipping ?? true,
      shipping_fee: p.shipping_fee ?? null,
      shipping_type: p.shipping_type ?? 'default',
    });
    refresh();
  }
  async function handleToggleActive(p: Product) { await updateProduct(p.id, { is_active: !p.is_active }); refresh(); }
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
  function downloadOrdersAsExcel() {
    const selectedOrders = orders.filter(o => orderSelectedIds.has(o.id));
    if (selectedOrders.length === 0) return;
    const escapeCell = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const rows = selectedOrders.map(o => {
      const productsText = orderItems.filter(i => i.order_id === o.id).map(i => `${i.product_name} x ${i.quantity}`).join(', ');
      return `<tr><td>${escapeCell(formatDateTime(o.created_at))}</td><td>${escapeCell(o.recipient_name ?? '')}</td><td>${escapeCell(`${o.address ?? ''} ${o.address_detail ?? ''}`)}</td><td>${escapeCell(o.recipient_phone ?? '')}</td><td>${escapeCell(productsText)}</td><td>${escapeCell(o.shipping_message ?? '')}</td></tr>`;
    }).join('');
    const html = `<table><thead><tr><th>날짜</th><th>주문자명</th><th>주소</th><th>연락처</th><th>주문상품</th><th>배송메세지</th></tr></thead><tbody>${rows}</tbody></table>`;
    const blob = new Blob([`<html><head><meta charset="UTF-8"></head><body>${html}</body></html>`], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `주문목록-${new Date().toISOString().slice(0, 10)}.xls`; link.click(); URL.revokeObjectURL(url);
  }

  // ── Member ──
  async function handleToggleRole(p: Profile) { await setProfileRole(p.id, p.role === 'admin' ? 'member' : 'admin'); refresh(); }
  async function handleDeleteProfileAction(p: Profile) { if (confirm(`${p.full_name} 회원을 삭제하시겠습니까?`)) { await deleteProfile(p.id); refresh(); } }
  async function handleChangeGrade(p: Profile, planId: string) {
    const plan = plans.find(pl => pl.id === planId); if (!plan) return;
    await changeMemberGrade(p.id, plan.id, plan.tier); refresh();
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === profiles.length ? new Set() : new Set(profiles.map(p => p.id)));
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

  // ── Shipping ──
  const shipDefaultFee = getSettingValue(settings, 'shipping_default_fee') ?? '3000';
  const shipFreeThreshold = getSettingValue(settings, 'shipping_free_threshold') ?? '50000';
  const shipJejuFee = getSettingValue(settings, 'shipping_jeju_fee') ?? '3000';
  const shipIslandFee = getSettingValue(settings, 'shipping_island_fee') ?? '5000';
  const shipDefaultCarrier = getSettingValue(settings, 'shipping_default_carrier') ?? 'CJ대한통운';
  const shipDefaultType = getSettingValue(settings, 'shipping_default_type') ?? 'prepaid';
  async function handleSaveShipping(key: string, value: string) { await updateSetting(key, value); refresh(); }

  function setTabAndReset(t: Tab) {
    setTab(t);
    setShowProductForm(false); setEditProduct(null); setPf(emptyProductForm);
    setShowPostForm(false); setEditPost(null); setPostF(emptyPostForm);
    setShowPlanForm(false); setEditPlan(null); setPlanF(emptyPlanForm);
    setEditCatId(null); setEditCatName(''); setEditCatGrades(new Set());
    setNewCat(''); setNewCatGrades(new Set());
    setSelectedIds(new Set()); setBatchPlanId('');
    setOrderSelectedIds(new Set());
    setOrderSubTab('all');
    setTracking({});
    setPwModalId(null);
  }

  const tabs: [Tab, string][] = [['overview', '대시보드'], ['products', '상품 관리'], ['orders', '주문 관리'], ['members', '회원 관리'], ['posts', '게시판 관리'], ['plans', '회원 등급']];

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
          <button key={k} onClick={() => setTabAndReset(k)} className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === k ? 'bg-cyan text-white shadow-glow' : 'text-slate-400 hover:text-slate-700'}`}>{label}</button>
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
                <div className="md:col-span-2"><Field label="상품 정보 자세히 보기 링크 (스마트스토어 등)"><input value={pf.detail_link} onChange={e => setPf({ ...pf, detail_link: e.target.value })} placeholder="https://smartstore.naver.com/..." className="input-field" /></Field></div>
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
              </div>
              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">{busy ? '저장 중...' : editProduct ? '수정하기' : '등록하기'}</button>
                <button type="button" onClick={() => setShowProductForm(false)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
              </div>
            </form>
          )}

          {/* Product list */}
          <div className="space-y-3">
            {products.map((p, idx) => {
              const discount = calcDiscountRate(p.original_price, p.club_price);
              const productCatIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
              const productCatNames = productCatIds.map(id => categories.find(c => c.id === id)?.name).filter(Boolean);
              return (
                <div key={p.id} className="card-surface p-4" draggable onDragStart={e => { e.dataTransfer.setData('text/plain', String(idx)); }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from)) handleMoveProduct(from, idx); }}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">주문 관리</h2>
            {orderSelectedIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-500">{orderSelectedIds.size}건 선택</span>
                <button onClick={() => handleBatchOrderStatus('paid')} disabled={busy} className="btn-primary px-3 py-2 text-xs">선택 결제 확인</button>
                <button onClick={downloadOrdersAsExcel} className="btn-ghost px-3 py-2 text-xs">엑셀 다운로드</button>
                <button onClick={() => setOrderSelectedIds(new Set())} className="btn-ghost px-3 py-2 text-xs">선택 해제</button>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2 border-b border-navy-700 pb-2">
            {orderSubTabs.map(([key, label, statuses]) => {
              const count = orders.filter(o => statuses.includes(o.status)).length;
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
                          {o.points_used > 0 && <span>포인트 사용 {formatKRW(o.points_used)}</span>}
                        </div>
                        {o.address && <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-400"><MapPin className="mt-0.5 h-3 w-3 shrink-0" /><span>{o.address} {o.address_detail} · {o.recipient_phone}</span></div>}
                        {o.tracking_number && <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400"><Truck className="h-3 w-3" /><span>{o.carrier} {o.tracking_number}</span></div>}
                        <div className="mt-2 text-xs text-slate-500">상품: {orderItems.filter(i => i.order_id === o.id).map(i => `${i.product_name} x ${i.quantity}`).join(', ') || '주문 상품 정보 없음'}</div>
                        {o.shipping_message && <div className="mt-1 text-xs text-slate-500">배송 메세지: {o.shipping_message}</div>}
                      </div>
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                      {o.status === 'pending' && (<>
                        <button onClick={() => handleOrderStatus(o, 'paid')} className="btn-primary px-3 py-1.5 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> 결제 확인</button>
                        <button onClick={() => handleOrderStatus(o, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400"><XCircle className="h-3.5 w-3.5" /> 주문 취소</button>
                      </>)}
                      {(o.status === 'paid' || o.status === 'preparing') && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={ti?.carrier ?? o.carrier ?? CARRIERS[0]} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: e.target.value, number: ti?.number ?? o.tracking_number ?? '' } }))} className="input-field h-8 w-32 px-2 py-1 text-xs">{CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}</select>
                          <input value={ti?.number ?? o.tracking_number ?? ''} onChange={e => setTracking(prev => ({ ...prev, [o.id]: { carrier: ti?.carrier ?? o.carrier ?? CARRIERS[0], number: e.target.value } }))} placeholder="운송장 번호" className="input-field h-8 w-40 px-2 py-1 text-xs" />
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
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">회원 관리</h2>
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
                <button onClick={() => { setSelectedIds(new Set()); setBatchPlanId(''); }} className="btn-ghost px-3 py-2 text-sm">선택 해제</button>
              </div>
            )}
          </div>
          {profiles.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center"><Users className="mb-3 h-10 w-10 text-slate-700" /><p className="text-sm text-slate-500">가입한 회원이 없습니다.</p></div>
          ) : (
            <div className="card-surface overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3"><input type="checkbox" checked={selectedIds.size === profiles.length && profiles.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-navy-700" /></th>
                    <th className="px-4 py-3 font-medium">회원</th>
                    <th className="px-4 py-3 font-medium">카페 닉네임</th>
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
                  {profiles.map(p => {
                    const sc = subStatusConfig[p.subscription_status] ?? subStatusConfig.none;
                    const plan = plans.find(pl => pl.id === p.subscription_plan_id);
                    const selected = selectedIds.has(p.id);
                    return (
                      <tr key={p.id} className={`transition hover:bg-slate-100 ${selected ? 'bg-cyan/5' : ''}`}>
                        <td className="px-4 py-3"><input type="checkbox" checked={selected} onChange={() => toggleSelect(p.id)} className="h-4 w-4 rounded border-navy-700" /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-white ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>{p.full_name.slice(0, 1)}</div>
                            <div><div className="font-medium text-slate-800">{p.full_name}</div><div className="text-xs text-slate-400">{p.email}</div></div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {p.cafe_nickname ? (
                            <span className="text-sm font-medium text-gold-deep">{p.cafe_nickname}</span>
                          ) : (
                            <span className="text-xs text-slate-400">미입력</span>
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
                            <select value={p.subscription_plan_id ?? ''} onChange={e => handleChangeGrade(p, e.target.value)} className="input-field h-7 w-24 px-1 py-0.5 text-xs" disabled={!plans.filter(pl => pl.is_active).length}>
                              <option value="" disabled>등급 선택</option>
                              {plans.filter(pl => pl.is_active).map(pl => <option key={pl.id} value={pl.id}>{pl.name}</option>)}
                            </select>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div><label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>{children}</div>
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
