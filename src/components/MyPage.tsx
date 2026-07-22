import { useState } from 'react';
import { Package, MapPin, Truck, CheckCircle2, Clock, Plus, Trash2, X, ShoppingBag } from 'lucide-react';
import { Profile, OrderStatus, Address } from '../lib/types';
import { formatKRW, formatDateTime } from '../lib/format';
import { useMyOrders, useAddresses, addAddress, deleteAddress } from '../lib/data';
import { supabase } from '../lib/supabase';

interface Props {
  profile: Profile;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: '입금대기',
  shipping_ready: '배송대기',
  shipping: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
};

const STATUS_ICONS: Record<OrderStatus, typeof Clock> = {
  pending: Clock,
  shipping_ready: Package,
  shipping: Truck,
  delivered: CheckCircle2,
  cancelled: X,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'text-gold-light border-gold/40',
  shipping_ready: 'text-cyan border-cyan/40',
  shipping: 'text-cyan border-cyan/40',
  delivered: 'text-emerald-400 border-emerald-500/40',
  cancelled: 'text-red-400 border-red-500/40',
};

export default function MyPage({ profile }: Props) {
  const { orders, loading } = useMyOrders(profile.id);
  const { addresses, refresh } = useAddresses(profile.id);
  const [tab, setTab] = useState<'orders' | 'addresses'>('orders');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: '기본 배송지', recipient_name: profile.full_name, recipient_phone: '', address: '', address_detail: '' });

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const result = await addAddress({
      user_id: profile.id,
      ...form,
      is_default: addresses.length === 0,
    });
    if (result) {
      setShowForm(false);
      setForm({ label: '추가 배송지', recipient_name: profile.full_name, recipient_phone: '', address: '', address_detail: '' });
      refresh();
    }
  }

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
        <button
          onClick={() => setTab('orders')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === 'orders' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShoppingBag className="h-4 w-4" /> 주문 현황
        </button>
        <button
          onClick={() => setTab('addresses')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
            tab === 'addresses' ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="h-4 w-4" /> 배송지 관리
        </button>
      </div>

      {/* Orders tab */}
      {tab === 'orders' && (
        <div className="space-y-3">
          {loading && (
            <div className="grid place-items-center py-16 text-slate-500">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan border-t-transparent" />
            </div>
          )}
          {!loading && orders.length === 0 && (
            <div className="grid place-items-center py-16 text-center text-slate-500">
              <div className="mb-3 rounded-full bg-navy-800 p-4">
                <ShoppingBag className="h-8 w-8 text-slate-600" />
              </div>
              <p className="text-sm">주문 내역이 없습니다.</p>
            </div>
          )}
          {orders.map((o) => {
            const Icon = STATUS_ICONS[o.status] ?? Clock;
            return (
              <div key={o.id} className="card-surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-navy-700 px-5 py-3">
                  <div>
                    <div className="text-xs text-slate-500">주문번호 {o.id.slice(-6).toUpperCase()}</div>
                    <div className="text-xs text-slate-500">{formatDateTime(o.created_at)}</div>
                  </div>
                  <span className={`chip ${STATUS_COLORS[o.status]}`}>
                    <Icon className="h-3 w-3" /> {STATUS_LABELS[o.status]}
                  </span>
                </div>
                <div className="px-5 py-3">
                  {/* Items */}
                  {o.order_items && o.order_items.length > 0 ? (
                    <div className="space-y-2">
                      {o.order_items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-navy-950">
                            {item.product_image && (
                              <img src={item.product_image} alt="" className="h-full w-full object-cover" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-sm text-slate-100">{item.product_name}</div>
                            <div className="text-xs text-slate-500">
                              {formatKRW(item.unit_price)} × {item.quantity}
                            </div>
                          </div>
                          <div className="text-sm font-medium text-slate-100">
                            {formatKRW(item.unit_price * item.quantity)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">주문 상품 정보 없음</div>
                  )}

                  {/* Address */}
                  {o.address && (
                    <div className="mt-3 flex items-start gap-2 border-t border-navy-700 pt-3 text-xs text-slate-400">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <div>
                        {o.recipient_name} · {o.recipient_phone}<br />
                        {o.address} {o.address_detail}
                      </div>
                    </div>
                  )}

                  {/* Tracking */}
                  {o.tracking_number && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-cyan">
                      <Truck className="h-3.5 w-3.5" />
                      {o.carrier} · 송장번호 {o.tracking_number}
                    </div>
                  )}

                  {/* Total */}
                  <div className="mt-3 flex justify-between border-t border-navy-700 pt-3">
                    <span className="text-xs text-slate-400">총 결제 금액</span>
                    <span className="font-display text-base font-bold text-cyan">{formatKRW(o.total_amount)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Addresses tab */}
      {tab === 'addresses' && (
        <div className="space-y-3">
          {addresses.length === 0 && !showForm && (
            <p className="text-sm text-slate-500">저장된 배송지가 없습니다. 새 배송지를 등록해주세요.</p>
          )}
          {addresses.map((a) => (
            <div key={a.id} className="card-surface flex items-start gap-3 p-4">
              <MapPin className="mt-1 h-4 w-4 shrink-0 text-cyan" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-100">{a.label}</span>
                  {a.is_default && <span className="chip border-gold/40 text-gold-light">기본</span>}
                </div>
                <div className="mt-1 text-xs text-slate-400">{a.recipient_name} · {a.recipient_phone}</div>
                <div className="mt-0.5 text-xs text-slate-500">{a.address} {a.address_detail}</div>
              </div>
              <button
                onClick={() => deleteAddress(a.id).then(refresh)}
                className="text-slate-600 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {showForm ? (
            <form onSubmit={handleAdd} className="card-surface space-y-3 p-4">
              <div>
                <label className="mb-1 block text-xs text-slate-400">배송지 이름</label>
                <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">받는분</label>
                  <input value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} className="input-field" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">연락처</label>
                  <input value={form.recipient_phone} onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })} placeholder="010-0000-0000" className="input-field" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">주소</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="도로명 주소" className="input-field" />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">상세주소</label>
                <input value={form.address_detail} onChange={(e) => setForm({ ...form, address_detail: e.target.value })} placeholder="건물, 호수 등" className="input-field" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary flex-1">배송지 저장</button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost">취소</button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowForm(true)} className="btn-ghost w-full">
              <Plus className="h-4 w-4" /> 새 배송지 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
