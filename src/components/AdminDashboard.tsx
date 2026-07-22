import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  Users, ShoppingBag, UserPlus, TrendingUp, Crown, Search, Trash2, ShieldOff, Shield,
  Tag, Plus, X, CheckCircle2, Clock, XCircle, Truck, Package, Image as ImageIcon, Save,
  ChevronRight, AlertCircle,
} from 'lucide-react';
import { Profile, Order, Product, Category, ReferralRequest, OrderStatus } from '../lib/types';
import { formatKRW, formatDate, formatDateTime } from '../lib/format';
import {
  setProfileRole, deleteProfile, addProduct, deleteProduct, uploadProductImage,
  addCategory, deleteCategory, updateOrderStatus, batchUpdateTracking,
  approveReferralRequest, rejectReferralRequest,
} from '../lib/data';
import { useAllReferralRequests } from '../lib/data';

type Tab = 'overview' | 'referrals' | 'products' | 'orders' | 'categories';

interface Props {
  profiles: Profile[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  refresh: () => void;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '입금대기',
  shipping_ready: '배송대기',
  shipping: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
};

const CARRIERS = ['CJ대한통운', '롯데택배', '한진택배', '우체국택배', '로젠택배'];

export default function AdminDashboard({ profiles, orders, products, categories, refresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const switchTab = useCallback((t: Tab) => {
    setTab(t);
    window.history.pushState({ view: 'admin', tab: t }, '', `#${t}`);
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.view === 'admin') {
        const t = e.state.tab;
        const valid: Tab[] = ['overview', 'referrals', 'products', 'orders', 'categories'];
        if (valid.includes(t)) setTab(t);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    const valid: Tab[] = ['overview', 'referrals', 'products', 'orders', 'categories'];
    if (valid.includes(hash as Tab)) {
      setTab(hash as Tab);
      window.history.replaceState({ view: 'admin', tab: hash }, '', `#${hash}`);
    } else {
      window.history.replaceState({ view: 'admin', tab }, '', `#${tab}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allRefRequests = useAllReferralRequests(true);
  const pendingRefRequests = allRefRequests.items.filter((r) => r.status === 'pending');

  const totalMembers = profiles.filter((p) => p.role === 'member').length;
  const totalAdmins = profiles.filter((p) => p.role === 'admin').length;
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'pending').length;
  const readyOrders = orders.filter((o) => o.status === 'shipping_ready').length;
  const totalRevenue = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'pending').reduce((s, o) => s + o.total_amount, 0);

  const referrerCounts = useMemo(() => {
    const map = new Map<string, number>();
    profiles.forEach((p) => {
      if (p.referred_by_code) {
        map.set(p.referred_by_code, (map.get(p.referred_by_code) ?? 0) + 1);
      }
    });
    return map;
  }, [profiles]);

  const activeReferrers = Array.from(referrerCounts.values()).filter((c) => c > 0).length;

  const weeklyData = useMemo(() => {
    const weeks: { label: string; signups: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7 - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const signups = profiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= start && d <= end;
      }).length;
      weeks.push({ label: `${start.getMonth() + 1}/${start.getDate()}`, signups });
    }
    return weeks;
  }, [profiles]);

  const referralRows = useMemo(() => {
    return profiles.map((p) => {
      const referrer = profiles.find((r) => r.my_referral_code === p.referred_by_code);
      const invitedCount = profiles.filter((x) => x.referred_by_code === p.my_referral_code).length;
      const purchases = orders.filter((o) => o.user_id === p.id && o.status !== 'cancelled');
      const purchaseTotal = purchases.reduce((s, o) => s + o.total_amount, 0);
      return { profile: p, referrerName: referrer?.full_name ?? '— (루트)', invitedCount, purchaseCount: purchases.length, purchaseTotal };
    });
  }, [profiles, orders]);

  const [query, setQuery] = useState('');
  const filteredRows = useMemo(() => {
    if (!query.trim()) return referralRows;
    const q = query.toLowerCase();
    return referralRows.filter(
      (r) => r.profile.full_name.toLowerCase().includes(q) || r.profile.email.toLowerCase().includes(q) || (r.profile.my_referral_code ?? '').toLowerCase().includes(q),
    );
  }, [referralRows, query]);

  async function handleToggleRole(p: Profile) {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    await setProfileRole(p.id, newRole);
    refresh();
  }

  async function handleDeleteProfile(p: Profile) {
    if (!confirm(`${p.full_name} 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    await deleteProfile(p.id);
    refresh();
  }

  async function handleApproveRequest(req: ReferralRequest) {
    const code = await approveReferralRequest(req.id);
    if (code) {
      alert(`초대 코드 발급 완료: ${code}`);
      allRefRequests.refresh();
      refresh();
    } else {
      alert('발급 중 오류가 발생했습니다.');
    }
  }

  async function handleRejectRequest(req: ReferralRequest) {
    await rejectReferralRequest(req.id);
    allRefRequests.refresh();
    refresh();
  }

  const tabs: [Tab, string, number?][] = [
    ['overview', '대시보드'],
    ['orders', '주문 관리', pendingOrders + readyOrders],
    ['referrals', '추천인/코드', pendingRefRequests.length],
    ['products', '상품 관리'],
    ['categories', '분류 관리'],
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users} label="총 클럽 회원" value={String(totalMembers + totalAdmins)} accent="cyan" sub={`정회원 ${totalMembers} · 관리자 ${totalAdmins}`} />
        <KpiCard icon={ShoppingBag} label="총 주문" value={String(totalOrders)} accent="cyan" sub={`입금대기 ${pendingOrders} · 배송대기 ${readyOrders}`} />
        <KpiCard icon={UserPlus} label="추천인 활성화" value={String(activeReferrers)} accent="gold" sub="초대 성공 회원 수" />
        <KpiCard icon={TrendingUp} label="누적 매출" value={formatKRW(totalRevenue)} accent="gold" sub="배송 포함 주문" />
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
        {tabs.map(([k, label, badge]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            className={`relative rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
            {badge ? (
              <span className="ml-1.5 inline-grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-950">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-100">
              <TrendingUp className="h-4 w-4 text-cyan" /> 주간 신규 회원 가입
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27364d" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #27364d', borderRadius: 8, color: '#e2e8f0' }}
                  cursor={{ fill: 'rgba(56,189,248,0.08)' }}
                />
                <Bar dataKey="signups" name="신규 가입" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-100">
              <ShoppingBag className="h-4 w-4 text-gold" /> 최근 주문 현황
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto">
              {orders.slice(0, 8).map((o) => {
                const p = profiles.find((x) => x.id === o.user_id);
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-950/40 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{p?.full_name ?? '알 수 없음'}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(o.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan">{formatKRW(o.total_amount)}</div>
                      <div className="text-[10px] text-slate-500">{STATUS_LABELS[o.status as OrderStatus] ?? o.status}</div>
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className="grid place-items-center py-12 text-sm text-slate-500">주문 내역이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && <OrdersTab orders={orders} profiles={profiles} refresh={refresh} />}

      {/* Referrals + Code Requests */}
      {tab === 'referrals' && (
        <div className="space-y-5">
          {/* Pending referral code requests */}
          {pendingRefRequests.length > 0 && (
            <div className="card-surface overflow-hidden">
              <div className="flex items-center gap-2 border-b border-navy-700 px-5 py-4 font-display text-base font-semibold text-slate-100">
                <Clock className="h-4 w-4 text-gold" /> 초대 코드 신청 대기 ({pendingRefRequests.length})
              </div>
              <div className="divide-y divide-navy-700">
                {pendingRefRequests.map((req) => {
                  const requester = profiles.find((p) => p.id === req.user_id);
                  return (
                    <div key={req.id} className="flex items-start gap-4 px-5 py-4">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-cyan-sheen text-sm font-bold text-navy-950">
                        {requester?.full_name.slice(0, 1) ?? '?'}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-slate-100">{requester?.full_name ?? '알 수 없음'}</div>
                        <div className="text-xs text-slate-500">{requester?.email}</div>
                        <div className="mt-1.5 text-sm text-slate-300">{req.reason}</div>
                        <div className="mt-1 text-xs text-slate-500">신청일: {formatDate(req.created_at)}</div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button onClick={() => handleApproveRequest(req)} className="btn-primary px-3 py-2 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 승인
                        </button>
                        <button onClick={() => handleRejectRequest(req)} className="btn-ghost px-3 py-2 text-xs hover:text-red-400">
                          <XCircle className="h-3.5 w-3.5" /> 반려
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Referral tracking table */}
          <div className="card-surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700 px-5 py-4">
              <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
                <Crown className="h-5 w-5 text-gold" /> 추천인 트래킹
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="이름/이메일/코드 검색"
                  className="input-field w-56 pl-9 py-2 text-xs"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">회원</th>
                    <th className="px-5 py-3 font-medium">초대 코드</th>
                    <th className="px-5 py-3 font-medium">추천인</th>
                    <th className="px-5 py-3 font-medium">하위 초대</th>
                    <th className="px-5 py-3 font-medium">총 구매액</th>
                    <th className="px-5 py-3 font-medium">역할</th>
                    <th className="px-5 py-3 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {filteredRows.map((r) => (
                    <tr key={r.profile.id} className="transition hover:bg-navy-800/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-navy-950 ${r.profile.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
                            {r.profile.full_name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-100">{r.profile.full_name}</div>
                            <div className="text-xs text-slate-500">{r.profile.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><span className="font-mono text-xs text-cyan">{r.profile.my_referral_code ?? '미발급'}</span></td>
                      <td className="px-5 py-3 text-slate-300">{r.referrerName}</td>
                      <td className="px-5 py-3">
                        <span className={`chip ${r.invitedCount > 0 ? 'border-cyan/40 text-cyan' : ''}`}>{r.invitedCount}명</span>
                      </td>
                      <td className="px-5 py-3 font-medium text-cyan">{r.purchaseCount > 0 ? formatKRW(r.purchaseTotal) : '—'}</td>
                      <td className="px-5 py-3">
                        {r.profile.role === 'admin' ? (
                          <span className="chip border-gold/40 text-gold-light"><Crown className="h-3 w-3" /> ADMIN</span>
                        ) : (
                          <span className="chip">MEMBER</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleRole(r.profile)}
                            title={r.profile.role === 'admin' ? '정회원으로 강등' : '관리자로 승격'}
                            className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-gold hover:text-gold"
                          >
                            {r.profile.role === 'admin' ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDeleteProfile(r.profile)}
                            title="회원 삭제"
                            className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Products */}
      {tab === 'products' && (
        <ProductsTab products={products} categories={categories} refresh={refresh} />
      )}

      {/* Categories */}
      {tab === 'categories' && <CategoriesTab categories={categories} refresh={refresh} />}
    </div>
  );
}

// ============================================================
// Orders Tab
// ============================================================

function OrdersTab({ orders, profiles, refresh }: { orders: Order[]; profiles: Profile[]; refresh: () => void }) {
  const [filter, setFilter] = useState<'pending' | 'shipping_ready' | 'shipping' | 'all'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [carrier, setCarrier] = useState(CARRIERS[0]);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const filtered = orders.filter((o) => filter === 'all' ? true : o.status === filter);

  async function handleConfirmDeposit(orderId: string) {
    setBusy(true);
    await updateOrderStatus(orderId, 'shipping_ready');
    setBusy(false);
    refresh();
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const readyIds = filtered.filter((o) => o.status === 'shipping_ready').map((o) => o.id);
    if (readyIds.every((id) => selected.has(id))) {
      setSelected((s) => {
        const next = new Set(s);
        readyIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((s) => {
        const next = new Set(s);
        readyIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  async function handleBatchShip() {
    setBusy(true);
    const updates = [...selected]
      .map((id) => {
        const o = orders.find((x) => x.id === id);
        if (!o) return null;
        return { orderId: id, carrier, trackingNumber: trackingInputs[id] ?? '' };
      })
      .filter(Boolean) as { orderId: string; carrier: string; trackingNumber: string }[];
    await batchUpdateTracking(updates);
    setSelected(new Set());
    setTrackingInputs({});
    setBusy(false);
    refresh();
  }

  const filterTabs: ['pending' | 'shipping_ready' | 'shipping' | 'all', string, number][] = [
    ['pending', '입금대기', orders.filter((o) => o.status === 'pending').length],
    ['shipping_ready', '배송대기', orders.filter((o) => o.status === 'shipping_ready').length],
    ['shipping', '배송중', orders.filter((o) => o.status === 'shipping').length],
    ['all', '전체', orders.length],
  ];

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
        {filterTabs.map(([k, label, count]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              filter === k ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Batch shipping toolbar (only when shipping_ready) */}
      {filter === 'shipping_ready' && filtered.length > 0 && (
        <div className="card-surface flex flex-wrap items-center gap-3 p-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={filtered.filter((o) => o.status === 'shipping_ready').every((o) => selected.has(o.id)) && filtered.some((o) => o.status === 'shipping_ready')} onChange={toggleSelectAll} className="accent-cyan" />
            전체 선택
          </label>
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input-field w-40 py-2 text-sm">
            {CARRIERS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <button onClick={handleBatchShip} disabled={busy || selected.size === 0} className="btn-gold">
            {busy ? '처리 중...' : <><Truck className="h-4 w-4" /> 배송시작 ({selected.size}건)</>}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-slate-400">{selected.size}건 선택됨</span>
          )}
        </div>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center text-slate-500">
            <Package className="mb-3 h-12 w-12 text-slate-600" />
            <p className="text-sm">해당 상태의 주문이 없습니다.</p>
          </div>
        )}
        {filtered.map((o) => {
          const p = profiles.find((x) => x.id === o.user_id);
          return (
            <div key={o.id} className="card-surface overflow-hidden">
              <div className="flex items-center justify-between border-b border-navy-700 px-5 py-3">
                <div className="flex items-center gap-3">
                  {o.status === 'shipping_ready' && (
                    <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} className="accent-cyan" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-slate-100">{p?.full_name ?? '알 수 없음'}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(o.created_at)} · 주문번호 {o.id.slice(-6).toUpperCase()}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-cyan">{formatKRW(o.total_amount)}</span>
                  <span className="chip border-navy-600 text-slate-300">{STATUS_LABELS[o.status as OrderStatus] ?? o.status}</span>
                </div>
              </div>

              <div className="px-5 py-3">
                {/* Items */}
                {o.order_items && o.order_items.length > 0 ? (
                  <div className="space-y-2">
                    {o.order_items.map((item) => (
                      <div key={item.id} className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-navy-950">
                          {item.product_image && <img src={item.product_image} alt="" className="h-full w-full object-cover" />}
                        </div>
                        <div className="flex-1 text-sm text-slate-200">{item.product_name} ×{item.quantity}</div>
                        <div className="text-sm text-slate-300">{formatKRW(item.unit_price * item.quantity)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">상품 정보 없음</div>
                )}

                {/* Address */}
                {o.address && (
                  <div className="mt-3 flex items-start gap-2 border-t border-navy-700 pt-3 text-xs text-slate-400">
                    <span className="text-slate-500">배송지:</span>
                    <span>{o.recipient_name} · {o.recipient_phone} · {o.address} {o.address_detail}</span>
                  </div>
                )}

                {/* Tracking info */}
                {o.tracking_number && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-cyan">
                    <Truck className="h-3.5 w-3.5" />
                    {o.carrier} · 송장번호 {o.tracking_number}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                  {o.status === 'pending' && (
                    <button onClick={() => handleConfirmDeposit(o.id)} disabled={busy} className="btn-primary px-3 py-2 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 입금확인
                    </button>
                  )}
                  {o.status === 'shipping_ready' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="input-field w-36 py-1.5 text-xs">
                        {CARRIERS.map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <input
                        value={trackingInputs[o.id] ?? ''}
                        onChange={(e) => setTrackingInputs({ ...trackingInputs, [o.id]: e.target.value })}
                        placeholder="송장번호"
                        className="input-field w-40 py-1.5 text-xs"
                      />
                      <button
                        onClick={async () => {
                          if (!trackingInputs[o.id]?.trim()) return;
                          setBusy(true);
                          await batchUpdateTracking([{ orderId: o.id, carrier, trackingNumber: trackingInputs[o.id] }]);
                          setBusy(false);
                          refresh();
                        }}
                        disabled={busy || !trackingInputs[o.id]?.trim()}
                        className="btn-gold px-3 py-2 text-xs"
                      >
                        <Truck className="h-3.5 w-3.5" /> 배송시작
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Products Tab
// ============================================================

function ProductsTab({ products, categories, refresh }: { products: Product[]; categories: Category[]; refresh: () => void }) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
          <ShoppingBag className="h-5 w-5 text-cyan" /> 상품 관리
        </div>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
          {showForm ? '취소' : <><Plus className="h-4 w-4" /> 상품 등록</>}
        </button>
      </div>

      {showForm && <ProductForm categories={categories} onCreated={() => { setShowForm(false); refresh(); }} />}

      <div className="card-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">이미지</th>
                <th className="px-5 py-3 font-medium">상품명</th>
                <th className="px-5 py-3 font-medium">분류</th>
                <th className="px-5 py-3 font-medium">정상가</th>
                <th className="px-5 py-3 font-medium">프라이빗가</th>
                <th className="px-5 py-3 font-medium">할인율</th>
                <th className="px-5 py-3 font-medium">재고</th>
                <th className="px-5 py-3 font-medium text-right">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700">
              {products.map((p) => {
                const discount = Math.round((1 - p.club_price / p.original_price) * 100);
                return (
                  <tr key={p.id} className="transition hover:bg-navy-800/40">
                    <td className="px-5 py-3">
                      <div className="h-12 w-16 overflow-hidden rounded-lg bg-navy-950">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-slate-600">
                            <ImageIcon className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-100">{p.name}</td>
                    <td className="px-5 py-3 text-slate-400">{p.category}</td>
                    <td className="px-5 py-3 text-slate-500 line-through">{formatKRW(p.original_price)}</td>
                    <td className="px-5 py-3 font-semibold text-cyan">{formatKRW(p.club_price)}</td>
                    <td className="px-5 py-3"><span className="chip border-gold/40 text-gold-light">{discount}%</span></td>
                    <td className="px-5 py-3 text-slate-300">{p.stock}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={async () => {
                          if (!confirm(`${p.name} 상품을 삭제하시겠습니까?`)) return;
                          await deleteProduct(p.id);
                          refresh();
                        }}
                        className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {products.length === 0 && (
          <div className="grid place-items-center py-12 text-sm text-slate-500">등록된 상품이 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Product Form with image upload (resize to 1000px max)
// ============================================================

function ProductForm({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categories[0]?.name ?? '케미컬');
  const [original, setOriginal] = useState('');
  const [club, setClub] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('100');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Resize image to max 1000px
    try {
      const resized = await resizeImage(file, 1000);
      setImageFile(resized);
      setImagePreview(URL.createObjectURL(resized));
    } catch {
      setError('이미지 처리 중 오류가 발생했습니다.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const op = parseInt(original, 10);
    const cp = parseInt(club, 10);
    const st = parseInt(stock, 10);
    if (!name || !op || !cp) {
      setError('상품명, 정상가, 프라이빗가를 입력해주세요.');
      setBusy(false);
      return;
    }
    let imageUrl: string | null = null;
    if (imageFile) {
      imageUrl = await uploadProductImage(imageFile);
      if (!imageUrl) {
        setError('이미지 업로드 실패. 다시 시도해주세요.');
        setBusy(false);
        return;
      }
    }
    await addProduct({
      name,
      category,
      original_price: op,
      club_price: cp,
      description: description || null,
      image_url: imageUrl,
      stock: st || 100,
    });
    setBusy(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="card-surface space-y-4 p-5">
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-slate-400">상품명</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="예) 코팅 세정제" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">분류</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            {categories.length === 0 && <option>케미컬</option>}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">재고 수량</label>
          <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" placeholder="100" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">정상가 (원)</label>
          <input type="number" value={original} onChange={(e) => setOriginal(e.target.value)} className="input-field" placeholder="89000" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400">프라이빗가 (원)</label>
          <input type="number" value={club} onChange={(e) => setClub(e.target.value)} className="input-field" placeholder="44500" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input-field resize-none" placeholder="상품 설명" />
      </div>

      <div>
        <label className="mb-1 block text-xs text-slate-400">상품 이미지 (1장, 자동 리사이징 1000px)</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost">
            <ImageIcon className="h-4 w-4" /> 이미지 선택
          </button>
          {imagePreview && (
            <div className="relative">
              <img src={imagePreview} alt="preview" className="h-20 w-28 rounded-lg object-cover" />
              <button type="button" onClick={() => { setImagePreview(null); setImageFile(null); }} className="absolute -right-2 -top-2 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      <button type="submit" disabled={busy} className="btn-gold">
        {busy ? '등록 중...' : <><Save className="h-4 w-4" /> 상품 등록</>}
      </button>
    </form>
  );
}

// Resize image to max dimension (1000px) using canvas
function resizeImage(file: File, maxSize: number): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('Blob creation failed')); return; }
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85,
        );
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// Categories Tab
// ============================================================

function CategoriesTab({ categories, refresh }: { categories: Category[]; refresh: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    await addCategory(name.trim(), categories.length + 1);
    setName('');
    setBusy(false);
    refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
        <Tag className="h-5 w-5 text-cyan" /> 분류 관리
      </div>

      <form onSubmit={handleAdd} className="card-surface flex items-center gap-3 p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="새 분류명 (예: 액세서리)" className="input-field flex-1" />
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
          <Plus className="h-4 w-4" /> 추가
        </button>
      </form>

      <div className="card-surface overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">분류명</th>
              <th className="px-5 py-3 font-medium">순서</th>
              <th className="px-5 py-3 font-medium text-right">삭제</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700">
            {categories.map((c) => (
              <tr key={c.id} className="transition hover:bg-navy-800/40">
                <td className="px-5 py-3 font-medium text-slate-100">{c.name}</td>
                <td className="px-5 py-3 text-slate-400">{c.sort_order}</td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={async () => {
                      if (!confirm(`분류 "${c.name}"을(를) 삭제하시겠습니까?`)) return;
                      await deleteCategory(c.id);
                      refresh();
                    }}
                    className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {categories.length === 0 && (
          <div className="grid place-items-center py-12 text-sm text-slate-500">등록된 분류가 없습니다.</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// KPI Card
// ============================================================

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: { icon: any; label: string; value: string; sub: string; accent: 'cyan' | 'gold' }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className={`h-4 w-4 ${accent === 'cyan' ? 'text-cyan' : 'text-gold'}`} /> {label}
      </div>
      <div className={`mt-2 font-display text-2xl font-bold ${accent === 'cyan' ? 'text-cyan' : 'text-gold-light'}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}
