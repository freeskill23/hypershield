import { useState } from 'react';
import {
  User as UserIcon, Mail, Calendar, Package, MapPin, Plus, Trash2,
  CheckCircle2, Clock, Truck, XCircle, CreditCard, Crown, AlertCircle,
  ChevronRight, ArrowLeft, Search, MessageSquare,
} from 'lucide-react';
import { Profile, Order, OrderItem, Address, SubscriptionPlan, OrderStatus, Inquiry } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getRemainingDays, formatPhoneNumber } from '../lib/format';
import { addAddress, deleteAddress } from '../lib/data';
import AddressSearchButton from './AddressSearchButton';
import MyInquiry from './MyInquiry';

interface Props {
  profile: Profile;
  orders: Order[];
  orderItems: OrderItem[];
  addresses: Address[];
  plans: SubscriptionPlan[];
  inquiries: Inquiry[];
  onRefresh: () => void;
}

type Tab = 'overview' | 'orders' | 'addresses' | 'inquiries';
type OrderFilter = 'all' | 'shipped' | 'delivered' | 'cancelled';

const orderStatusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: '결제 대기', className: 'border-gold/40 text-gold-light', icon: Clock },
  paid: { label: '결제 완료', className: 'border-cyan/40 text-cyan', icon: CheckCircle2 },
  preparing: { label: '준비 중', className: 'border-cyan/40 text-cyan', icon: Package },
  shipped: { label: '배송 중', className: 'border-cyan/40 text-cyan', icon: Truck },
  delivered: { label: '배송 완료', className: 'border-green-500/40 text-green-400', icon: CheckCircle2 },
  cancelled: { label: '취소됨', className: 'border-slate-600 text-slate-500', icon: XCircle },
};

export default function MyPage({ profile, orders, orderItems, addresses, plans, inquiries, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [addrForm, setAddrForm] = useState({
    label: '기본 배송지',
    recipient_name: '',
    recipient_phone: '',
    address: '',
    address_detail: '',
    is_default: false,
  });
  const [showAddrForm, setShowAddrForm] = useState(false);

  const currentPlan = plans.find((p) => p.id === profile.subscription_plan_id);
  const remainingDays = getRemainingDays(profile.subscription_expires_at);
  const isActive = profile.subscription_status === 'active';

  const myOrders = orders.filter((o) => o.user_id === profile.id);
  const shippedCount = myOrders.filter((o) => o.status === 'shipped').length;
  const deliveredCount = myOrders.filter((o) => o.status === 'delivered').length;
  const cancelledCount = myOrders.filter((o) => o.status === 'cancelled').length;

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addAddress(profile.id, addrForm);
      setShowAddrForm(false);
      setAddrForm({ label: '기본 배송지', recipient_name: '', recipient_phone: '', address: '', address_detail: '', is_default: false });
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAddress(id: string) {
    await deleteAddress(id);
    onRefresh();
  }

  function handleStatClick(filter: OrderFilter) {
    setOrderFilter(filter);
    setTab('orders');
    setExpandedOrderId(null);
  }

  const filteredOrders = myOrders.filter((o) => {
    if (orderFilter === 'all') return true;
    if (orderFilter === 'shipped') return o.status === 'shipped';
    if (orderFilter === 'delivered') return o.status === 'delivered';
    if (orderFilter === 'cancelled') return o.status === 'cancelled';
    return true;
  }).filter((o) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const items = orderItems.filter((i) => i.order_id === o.id);
    const productNames = items.map((i) => i.product_name).join(' ');
    return (
      o.id.toLowerCase().includes(q) ||
      (o.recipient_name ?? '').toLowerCase().includes(q) ||
      productNames.toLowerCase().includes(q)
    );
  });

  const filterLabels: Record<OrderFilter, string> = {
    all: '전체',
    shipped: '배송 중',
    delivered: '배송 완료',
    cancelled: '취소됨',
  };

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="card-surface p-6">
        <div className="flex items-center gap-4">
          <div className={`grid h-16 w-16 place-items-center rounded-full text-xl font-bold text-white ${profile.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
            {profile.full_name.slice(0, 1)}
          </div>
          <div className="flex-1">
            <h1 className="font-gothic text-xl font-bold text-slate-800">{profile.full_name}</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {profile.email}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(profile.created_at)} 가입</span>
            </div>
          </div>
          {isActive && currentPlan && (
            <div className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1.5">
              <Crown className="h-4 w-4 text-gold" />
              <span className="text-sm font-medium text-gold-light">{currentPlan.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {([
          ['overview', '개요'],
          ['orders', '주문 내역'],
          ['addresses', '배송지 관리'],
          ['inquiries', '1:1 문의'],
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setTab(k); if (k === 'orders') setOrderFilter('all'); }}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-cyan text-white shadow-glow' : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Subscription status */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <Crown className="h-4 w-4 text-gold" /> 구독 상태
            </div>
            {isActive ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <CheckCircle2 className="h-4 w-4" /> 구독 활성화됨
                </div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">회원 등급</span>
                    <span className="text-slate-800">{currentPlan?.name ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">월 구독료</span>
                    <span className="text-slate-800">{formatKRW(currentPlan?.monthly_price ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">할인율</span>
                    <span className="text-cyan">{currentPlan?.discount_rate ?? 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">만료일</span>
                    <span className="text-slate-800">{formatDate(profile.subscription_expires_at ?? '')}</span>
                  </div>
                  {remainingDays !== null && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">남은 일수</span>
                      <span className={remainingDays > 7 ? 'text-slate-800' : 'text-gold'}>
                        {remainingDays > 0 ? `${remainingDays}일` : '만료됨'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> 구독 미활성화
                </div>
                <p className="text-sm text-slate-400">
                  구독 결제가 완료되면 쇼핑몰을 이용할 수 있습니다.
                </p>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <Package className="h-4 w-4 text-cyan" /> 주문 현황
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                onClick={() => handleStatClick('all')}
                className="group rounded-lg border border-navy-700 bg-slate-50 p-3 text-center transition hover:border-cyan/40 hover:bg-cyan/5"
              >
                <div className="font-gothic text-xl font-bold text-slate-800 group-hover:text-cyan">{myOrders.length}</div>
                <div className="text-xs text-slate-500">총 주문</div>
              </button>
              <button
                onClick={() => handleStatClick('shipped')}
                className="group rounded-lg border border-navy-700 bg-slate-50 p-3 text-center transition hover:border-cyan/40 hover:bg-cyan/5"
              >
                <div className="font-gothic text-xl font-bold text-slate-800 group-hover:text-cyan">{shippedCount}</div>
                <div className="text-xs text-slate-500">배송 중</div>
              </button>
              <button
                onClick={() => handleStatClick('delivered')}
                className="group rounded-lg border border-navy-700 bg-slate-50 p-3 text-center transition hover:border-green-500/40 hover:bg-green-500/5"
              >
                <div className="font-gothic text-xl font-bold text-slate-800 group-hover:text-green-500">{deliveredCount}</div>
                <div className="text-xs text-slate-500">완료</div>
              </button>
              <button
                onClick={() => handleStatClick('cancelled')}
                className="group rounded-lg border border-navy-700 bg-slate-50 p-3 text-center transition hover:border-red-500/40 hover:bg-red-500/5"
              >
                <div className="font-gothic text-xl font-bold text-slate-800 group-hover:text-red-500">{cancelledCount}</div>
                <div className="text-xs text-slate-500">취소</div>
              </button>
            </div>
            <div className="mt-4 border-t border-navy-700 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">총 결제 금액</span>
                <span className="font-gothic text-base font-bold text-cyan">
                  {formatKRW(myOrders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total_amount, 0))}
                </span>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">숫자를 클릭하면 해당 주문 내역을 확인할 수 있습니다</p>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Filter chips */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'shipped', 'delivered', 'cancelled'] as OrderFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => { setOrderFilter(f); setExpandedOrderId(null); }}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  orderFilter === f
                    ? 'border-cyan bg-cyan/10 text-cyan'
                    : 'border-navy-700 text-slate-500 hover:text-slate-700'
                }`}
              >
                {filterLabels[f]}
                {f === 'all' && ` (${myOrders.length})`}
                {f === 'shipped' && ` (${shippedCount})`}
                {f === 'delivered' && ` (${deliveredCount})`}
                {f === 'cancelled' && ` (${cancelledCount})`}
              </button>
            ))}
            <div className="relative ml-auto">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="주문 검색"
                className="input-field h-9 w-40 pl-8 text-xs"
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Package className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">
                {orderFilter === 'all' ? '주문 내역이 없습니다.' : `${filterLabels[orderFilter]} 주문이 없습니다.`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const cfg = orderStatusConfig[order.status] ?? orderStatusConfig.pending;
                const Icon = cfg.icon;
                const items = orderItems.filter((i) => i.order_id === order.id);
                const isExpanded = expandedOrderId === order.id;

                return (
                  <div key={order.id} className="card-surface overflow-hidden">
                    {/* Order header - always visible */}
                    <button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="flex w-full items-start justify-between p-5 text-left transition hover:bg-slate-50/50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">
                            주문 #{order.id.slice(0, 8)}
                          </span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
                            <Icon className="h-3 w-3" /> {cfg.label}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.created_at)}</div>
                        <div className="mt-1.5 text-xs text-slate-400">
                          {items.length > 0 ? items.map((i) => `${i.product_name} x ${i.quantity}`).join(', ') : '상품 정보 없음'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="font-gothic text-base font-bold text-cyan">{formatKRW(order.total_amount)}</span>
                        <ChevronRight className={`h-4 w-4 text-slate-400 transition ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="border-t border-navy-700 px-5 py-4">
                        {/* Order items */}
                        <div className="mb-4">
                          <div className="mb-2 text-xs font-semibold text-slate-600">주문 상품</div>
                          <div className="space-y-2">
                            {items.length === 0 ? (
                              <div className="text-xs text-slate-500">주문 상품 정보가 없습니다.</div>
                            ) : (
                              items.map((item) => (
                                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-navy-700 bg-slate-50 p-3">
                                  {item.product_image ? (
                                    <img src={item.product_image} alt={item.product_name} className="h-12 w-12 rounded-md object-cover" />
                                  ) : (
                                    <div className="grid h-12 w-12 place-items-center rounded-md bg-slate-200">
                                      <Package className="h-5 w-5 text-slate-400" />
                                    </div>
                                  )}
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-slate-800">{item.product_name}</div>
                                    <div className="mt-0.5 text-xs text-slate-500">
                                      수량 {item.quantity}개 · 단가 {formatKRW(item.unit_price)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className="text-sm font-bold text-slate-800">{formatKRW(item.unit_price * item.quantity)}</div>
                                    {item.original_price > item.unit_price && (
                                      <div className="text-xs text-slate-400 line-through">{formatKRW(item.original_price * item.quantity)}</div>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Shipping info */}
                        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-lg border border-navy-700 bg-slate-50 p-3">
                            <div className="mb-1.5 text-xs font-semibold text-slate-600">배송 정보</div>
                            <div className="space-y-1 text-xs text-slate-500">
                              <div>수령인: {order.recipient_name ?? '—'}</div>
                              <div>연락처: {order.recipient_phone ?? '—'}</div>
                              <div>주소: {order.address ?? ''} {order.address_detail ?? ''}</div>
                              {order.shipping_message && <div>배송메세지: {order.shipping_message}</div>}
                            </div>
                          </div>
                          <div className="rounded-lg border border-navy-700 bg-slate-50 p-3">
                            <div className="mb-1.5 text-xs font-semibold text-slate-600">결제 정보</div>
                            <div className="space-y-1 text-xs text-slate-500">
                              <div>결제 방법: {order.payment_method === 'card' ? '카드결제' : '수동결제'}</div>
                              {order.points_used > 0 && <div>포인트 사용: {formatKRW(order.points_used)}</div>}
                              {order.points_earned > 0 && <div>포인트 적립: {formatKRW(order.points_earned)}</div>}
                              <div className="pt-1 font-medium text-slate-800">총 결제금액: {formatKRW(order.total_amount)}</div>
                            </div>
                          </div>
                        </div>

                        {/* Tracking info - only for shipped orders */}
                        {order.status === 'shipped' && (
                          <div className="mb-4 rounded-lg border border-cyan/30 bg-cyan/5 p-4">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-cyan">
                              <Truck className="h-4 w-4" /> 배송 추적 정보
                            </div>
                            {order.tracking_number ? (
                              <div className="space-y-1 text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">택배사:</span>
                                  <span className="font-medium text-slate-800">{order.carrier ?? '—'}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">운송장번호:</span>
                                  <span className="font-mono font-medium text-slate-800">{order.tracking_number}</span>
                                </div>
                                {order.shipped_at && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-400">발송일:</span>
                                    <span className="text-slate-800">{formatDateTime(order.shipped_at)}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-500">운송장이 등록되지 않았습니다.</div>
                            )}
                          </div>
                        )}

                        {/* Delivered info */}
                        {order.status === 'delivered' && (
                          <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-green-500">
                              <CheckCircle2 className="h-4 w-4" /> 배송 완료 정보
                            </div>
                            <div className="space-y-1 text-sm">
                              {order.carrier && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">택배사:</span>
                                  <span className="font-medium text-slate-800">{order.carrier}</span>
                                </div>
                              )}
                              {order.tracking_number && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">운송장번호:</span>
                                  <span className="font-mono font-medium text-slate-800">{order.tracking_number}</span>
                                </div>
                              )}
                              {order.delivered_at && (
                                <div className="flex items-center gap-2">
                                  <span className="text-slate-400">완료일:</span>
                                  <span className="text-slate-800">{formatDateTime(order.delivered_at)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Cancelled info */}
                        {order.status === 'cancelled' && (
                          <div className="mb-4 rounded-lg border border-slate-600/30 bg-slate-100 p-4">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                              <XCircle className="h-4 w-4" /> 취소된 주문
                            </div>
                            <p className="text-xs text-slate-500">이 주문은 취소되었습니다. 결제 금액은 환불 처리됩니다.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Addresses */}
      {tab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-800">배송지 관리</h2>
            <button onClick={() => setShowAddrForm(!showAddrForm)} className="btn-primary px-4 py-2 text-sm">
              <Plus className="h-4 w-4" /> 배송지 추가
            </button>
          </div>

          {showAddrForm && (
            <form onSubmit={handleAddAddress} className="card-surface space-y-3 p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">배송지 명칭</label>
                  <input
                    value={addrForm.label}
                    onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">받는 분</label>
                  <input
                    required
                    value={addrForm.recipient_name}
                    onChange={(e) => setAddrForm({ ...addrForm, recipient_name: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">연락처</label>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    maxLength={13}
                    value={addrForm.recipient_phone}
                    onChange={(e) => setAddrForm({ ...addrForm, recipient_phone: formatPhoneNumber(e.target.value) })}
                    placeholder="010-0000-0000"
                    className="input-field text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">주소</label>
                  <div className="flex gap-2">
                    <input
                      required
                      readOnly
                      value={addrForm.address}
                      placeholder="도로명 주소 검색 버튼을 눌러주세요"
                      onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })}
                      className="input-field min-h-12 min-w-0 flex-1 cursor-not-allowed bg-slate-50 text-sm"
                    />
                    <AddressSearchButton onSelect={(addr) => setAddrForm({ ...addrForm, address: addr })} />
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs text-slate-500">상세 주소</label>
                  <input
                    value={addrForm.address_detail}
                    onChange={(e) => setAddrForm({ ...addrForm, address_detail: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>
                <label className="col-span-2 flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={addrForm.is_default}
                    onChange={(e) => setAddrForm({ ...addrForm, is_default: e.target.checked })}
                  />
                  기본 배송지로 설정
                </label>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-sm">
                  {busy ? '저장 중...' : '저장'}
                </button>
                <button type="button" onClick={() => setShowAddrForm(false)} className="btn-ghost px-4 py-2 text-sm">
                  취소
                </button>
              </div>
            </form>
          )}

          {addresses.length === 0 && !showAddrForm ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <MapPin className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">등록된 배송지가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {addresses.map((addr) => (
                <div key={addr.id} className="card-surface p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800">{addr.label}</span>
                        {addr.is_default && (
                          <span className="rounded-full bg-cyan/20 px-2 py-0.5 text-xs text-cyan">기본</span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        {addr.recipient_name} · {addr.recipient_phone}
                      </div>
                      <div className="text-xs text-slate-500">
                        {addr.address} {addr.address_detail}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAddress(addr.id)}
                      className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {/* Inquiries */}
      {tab === 'inquiries' && (
        <MyInquiry inquiries={inquiries} userId={profile.id} onRefresh={onRefresh} />
      )}
    </div>
  );
}
