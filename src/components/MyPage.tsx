import { useState } from 'react';
import {
  User as UserIcon, Mail, Calendar, Package, MapPin, Plus, Trash2,
  CheckCircle2, Clock, Truck, XCircle, CreditCard, Crown, AlertCircle,
  ChevronRight, ArrowLeft, Search, MessageSquare, Star, Upload, X,
} from 'lucide-react';
import { Profile, Order, OrderItem, Address, SubscriptionPlan, OrderStatus, Inquiry, Review } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getRemainingDays, formatPhoneNumber } from '../lib/format';
import { addAddress, deleteAddress, requestOrderCancellation, createReviewWithError } from '../lib/data';
import AddressSearchButton from './AddressSearchButton';
import MyInquiry from './MyInquiry';
import { supabase } from '../lib/supabase';

interface Props {
  profile: Profile;
  orders: Order[];
  orderItems: OrderItem[];
  addresses: Address[];
  plans: SubscriptionPlan[];
  inquiries: Inquiry[];
  reviews: Review[];
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

export default function MyPage({ profile, orders, orderItems, addresses, plans, inquiries, reviews, onRefresh }: Props) {
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
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundBank, setRefundBank] = useState('');
  const [refundAccount, setRefundAccount] = useState('');
  const [refundHolder, setRefundHolder] = useState('');
  const [cancelBusy, setCancelBusy] = useState(false);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewImages, setReviewImages] = useState<string[]>([]);
  const [reviewBusy, setReviewBusy] = useState(false);

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

  async function handleCancelRequest() {
    if (!cancelModalOrder) return;
    const isCard = cancelModalOrder.payment_method === 'card';
    if (!isCard && (!refundBank.trim() || !refundAccount.trim() || !refundHolder.trim())) {
      alert('환불 받을 은행, 계좌번호, 예금주를 모두 입력해주세요.');
      return;
    }
    setCancelBusy(true);
    try {
      const ok = await requestOrderCancellation(
        cancelModalOrder.id,
        isCard ? 'card' : 'manual',
        cancelReason.trim(),
        isCard ? undefined : { bank: refundBank.trim(), account: refundAccount.trim(), holder: refundHolder.trim() },
      );
      if (ok) {
        setCancelModalOrder(null);
        setCancelReason(''); setRefundBank(''); setRefundAccount(''); setRefundHolder('');
        onRefresh();
      } else {
        alert('취소 요청 중 오류가 발생했습니다.');
      }
    } finally { setCancelBusy(false); }
  }

  async function handleReviewImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !supabase) return;
    if (reviewImages.length >= 3) { alert('사진은 최대 3장까지 첨부할 수 있습니다.'); return; }
    if (file.size > 5 * 1024 * 1024) { alert('이미지 크기는 5MB 이하여야 합니다.'); return; }
    setReviewBusy(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `reviews/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('product-images').upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
      if (urlData?.publicUrl) setReviewImages(prev => [...prev, urlData.publicUrl]);
    } catch (err: any) { alert(err.message || '이미지 업로드에 실패했습니다.'); }
    finally { setReviewBusy(false); if (e.target) e.target.value = ''; }
  }

  async function handleSubmitReview() {
    if (!reviewItem) return;
    if (!reviewContent.trim()) { alert('후기 내용을 입력해주세요.'); return; }
    if (reviewContent.length > 150) { alert('후기는 150자 이하로 작성해주세요.'); return; }
    if (!reviewItem.product_id) { alert('상품 정보를 찾을 수 없습니다.'); return; }
    setReviewBusy(true);
    try {
      const result = await createReviewWithError({
        product_id: reviewItem.product_id,
        order_item_id: reviewItem.id,
        rating: reviewRating,
        content: reviewContent.trim(),
        images: reviewImages,
      });
      if (result.ok) {
        setReviewItem(null); setReviewRating(5); setReviewContent(''); setReviewImages([]);
        onRefresh();
      } else { alert(`후기 작성 실패: ${result.error ?? '알 수 없는 오류'}`); }
    } finally { setReviewBusy(false); }
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
                                  <div className="flex flex-col items-end gap-1.5">
                                    <div className="text-sm font-bold text-slate-800">{formatKRW(item.unit_price * item.quantity)}</div>
                                    {item.original_price > item.unit_price && (
                                      <div className="text-xs text-slate-400 line-through">{formatKRW(item.original_price * item.quantity)}</div>
                                    )}
                                    {(order.status === 'shipped' || order.status === 'delivered') && item.product_id && (
                                      (() => {
                                        const hasReview = reviews.some(r => r.order_item_id === item.id);
                                        return hasReview ? (
                                          <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-500">후기 작성됨</span>
                                        ) : (
                                          <button
                                            onClick={() => { setReviewItem(item); setReviewRating(5); setReviewContent(''); setReviewImages([]); }}
                                            className="btn-ghost px-2.5 py-1 text-xs hover:text-cyan"
                                          >
                                            <Star className="h-3 w-3" /> 후기 작성
                                          </button>
                                        );
                                      })()
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
                            {order.cancel_type && (
                              <div className="mt-2 space-y-1 text-xs text-slate-500">
                                <div>취소 유형: {order.cancel_type === 'card' ? '카드 결제 취소' : '무통장입금 환불'}</div>
                                {order.cancel_reason && <div>취소 사유: {order.cancel_reason}</div>}
                                {order.cancel_type === 'manual' && order.refund_bank && (
                                  <div>환불 계좌: {order.refund_bank} {order.refund_account} ({order.refund_holder})</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Cancel request button — for pending/paid orders with no cancel request yet */}
                        {(order.status === 'pending' || order.status === 'paid') && !order.cancel_requested_at && (
                          <div className="flex justify-end">
                            <button
                              onClick={() => { setCancelModalOrder(order); setCancelReason(''); setRefundBank(''); setRefundAccount(''); setRefundHolder(''); }}
                              className="btn-ghost px-4 py-2 text-sm text-red-500 hover:border-red-500 hover:text-red-600"
                            >
                              <XCircle className="h-4 w-4" /> 주문 취소 요청
                            </button>
                          </div>
                        )}

                        {/* Cancel requested — waiting for admin */}
                        {order.cancel_requested_at && order.status !== 'cancelled' && (
                          <div className="mb-4 rounded-lg border border-gold/30 bg-gold/5 p-4">
                            <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-gold-light">
                              <Clock className="h-4 w-4" /> 취소 요청 처리 중
                            </div>
                            <p className="text-xs text-slate-500">
                              {order.cancel_type === 'card'
                                ? '카드 결제 취소 요청이 접수되었습니다. 카드사 자동 취소 처리 후 취소 완료됩니다.'
                                : '환불 계좌로 수동 환불 후 관리자가 취소 완료 처리합니다.'}
                            </p>
                            {order.cancel_type === 'manual' && order.refund_bank && (
                              <p className="mt-1 text-xs text-slate-500">환불 계좌: {order.refund_bank} {order.refund_account} ({order.refund_holder})</p>
                            )}
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

      {/* Cancel order modal */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setCancelModalOrder(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-gothic text-lg font-bold text-slate-800">주문 취소 요청</h3>
              <button onClick={() => setCancelModalOrder(null)} className="text-slate-400 hover:text-slate-600"><XCircle className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">주문 번호</div>
              <div className="text-sm font-medium text-slate-800">#{cancelModalOrder.id.slice(0, 8)}</div>
              <div className="mt-1 text-xs text-slate-500">결제 방법: {cancelModalOrder.payment_method === 'card' ? '카드결제' : '무통장입금'}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">취소 사유 (선택)</label>
                <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="취소 사유를 입력하세요" className="input-field text-sm" />
              </div>
              {cancelModalOrder.payment_method !== 'card' && (
                <div className="rounded-lg border border-gold/30 bg-gold/5 p-3">
                  <p className="mb-2 text-xs text-slate-500">환불 받을 계좌를 입력해주세요. 관리자가 해당 계좌로 환불处理后 취소 완료 처리합니다.</p>
                  <div className="space-y-2">
                    <input value={refundBank} onChange={(e) => setRefundBank(e.target.value)} placeholder="은행명 (예: 국민은행)" className="input-field text-sm" />
                    <input value={refundAccount} onChange={(e) => setRefundAccount(e.target.value)} placeholder="계좌번호" className="input-field text-sm" />
                    <input value={refundHolder} onChange={(e) => setRefundHolder(e.target.value)} placeholder="예금주" className="input-field text-sm" />
                  </div>
                </div>
              )}
              {cancelModalOrder.payment_method === 'card' && (
                <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-3">
                  <p className="text-xs text-slate-500">카드 결제 건은 결제 취소 요청이 접수되면 자동으로 카드사 승인 취소 처리됩니다. 별도의 환불 계좌 입력이 필요하지 않습니다.</p>
                </div>
              )}
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleCancelRequest} disabled={cancelBusy} className="btn-primary px-5 py-2.5 text-sm">
                {cancelBusy ? '처리 중...' : '취소 요청하기'}
              </button>
              <button onClick={() => setCancelModalOrder(null)} className="btn-ghost px-5 py-2.5 text-sm">닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Review writing modal */}
      {reviewItem && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setReviewItem(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-gothic text-lg font-bold text-slate-800">상품 후기 작성</h3>
              <button onClick={() => setReviewItem(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                {reviewItem.product_image && <img src={reviewItem.product_image} alt="" className="h-10 w-10 rounded-md object-cover" />}
                <div>
                  <div className="text-sm font-medium text-slate-800">{reviewItem.product_name}</div>
                  <div className="text-xs text-slate-500">수량 {reviewItem.quantity}개</div>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">만족도</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setReviewRating(s)} className="transition hover:scale-110">
                      <Star size={28} className={s <= reviewRating ? 'fill-gold text-gold' : 'text-slate-300'} />
                    </button>
                  ))}
                  <span className="ml-2 text-sm font-medium text-slate-600">{reviewRating}점</span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">후기 내용 ({reviewContent.length}/150)</label>
                <textarea
                  value={reviewContent}
                  onChange={(e) => setReviewContent(e.target.value.slice(0, 150))}
                  placeholder="상품에 대한 후기를 150자 이내로 작성해주세요."
                  rows={4}
                  className="input-field text-sm"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">사진 첨부 (최대 3장)</label>
                <div className="flex flex-wrap gap-2">
                  {reviewImages.map((img, i) => (
                    <div key={i} className="relative">
                      <img src={img} alt="" className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                      <button onClick={() => setReviewImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-white text-xs hover:bg-red-600">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {reviewImages.length < 3 && (
                    <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 transition hover:border-cyan">
                      {reviewBusy ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan border-t-transparent" /> : <Upload className="h-5 w-5 text-slate-400" />}
                      <input type="file" accept="image/*" onChange={handleReviewImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={handleSubmitReview} disabled={reviewBusy} className="btn-primary px-5 py-2.5 text-sm">
                {reviewBusy ? '작성 중...' : '후기 작성'}
              </button>
              <button onClick={() => setReviewItem(null)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
