import { useState } from 'react';
import {
  User as UserIcon, Mail, Calendar, Package, MapPin, Plus, Trash2,
  CheckCircle2, Clock, Truck, XCircle, CreditCard, Crown, AlertCircle,
} from 'lucide-react';
import { Profile, Order, Address, SubscriptionPlan } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getRemainingDays } from '../lib/format';
import { addAddress, deleteAddress } from '../lib/data';
import AddressSearchButton from './AddressSearchButton';

interface Props {
  profile: Profile;
  orders: Order[];
  addresses: Address[];
  plans: SubscriptionPlan[];
  onRefresh: () => void;
}

type Tab = 'overview' | 'orders' | 'addresses';

const orderStatusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: '결제 대기', className: 'border-gold/40 text-gold-light', icon: Clock },
  paid: { label: '결제 완료', className: 'border-cyan/40 text-cyan', icon: CheckCircle2 },
  preparing: { label: '준비 중', className: 'border-cyan/40 text-cyan', icon: Package },
  shipped: { label: '배송 중', className: 'border-cyan/40 text-cyan', icon: Truck },
  delivered: { label: '배송 완료', className: 'border-green-500/40 text-green-400', icon: CheckCircle2 },
  cancelled: { label: '취소됨', className: 'border-slate-600 text-slate-500', icon: XCircle },
};

export default function MyPage({ profile, orders, addresses, plans, onRefresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [busy, setBusy] = useState(false);
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
        ] as [Tab, string][]).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
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
            <div className="grid grid-cols-3 gap-3">
              {[
                ['총 주문', orders.length],
                ['배송 중', orders.filter((o) => o.status === 'shipped').length],
                ['완료', orders.filter((o) => o.status === 'delivered').length],
              ].map(([label, count]) => (
                <div key={label as string} className="rounded-lg border border-navy-700 bg-slate-50 p-3 text-center">
                  <div className="font-gothic text-xl font-bold text-slate-800">{count}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-navy-700 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">총 결제 금액</span>
                <span className="font-gothic text-base font-bold text-cyan">
                  {formatKRW(orders.reduce((s, o) => s + o.total_amount, 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders */}
      {tab === 'orders' && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Package className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">주문 내역이 없습니다.</p>
            </div>
          ) : (
            orders.map((order) => {
              const cfg = orderStatusConfig[order.status] ?? orderStatusConfig.pending;
              const Icon = cfg.icon;
              return (
                <div key={order.id} className="card-surface p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        주문 #{order.id.slice(0, 8)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.created_at)}</div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.className}`}>
                      <Icon className="h-3 w-3" /> {cfg.label}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-navy-700 pt-3 text-sm text-slate-400">
                    <div>수령인: {order.recipient_name}</div>
                    <div>배송지: {order.address} {order.address_detail}</div>
                    {order.tracking_number && (
                      <div className="mt-1 text-cyan">
                        운송장: {order.carrier} {order.tracking_number}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex justify-between border-t border-navy-700 pt-3">
                    <span className="text-sm text-slate-400">결제 금액</span>
                    <span className="font-gothic text-base font-bold text-cyan">{formatKRW(order.total_amount)}</span>
                  </div>
                </div>
              );
            })
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
                    value={addrForm.recipient_phone}
                    onChange={(e) => setAddrForm({ ...addrForm, recipient_phone: e.target.value })}
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
    </div>
  );
}
