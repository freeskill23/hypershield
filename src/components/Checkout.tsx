import { useState } from 'react';
import {
  ArrowLeft, Check, MapPin, User, Phone, Home, CreditCard, AlertCircle,
} from 'lucide-react';
import { CartItemWithProduct, Address } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';
import { createOrder } from '../lib/data';

interface Props {
  cartItems: CartItemWithProduct[];
  addresses: Address[];
  userId: string;
  onBack: () => void;
  onComplete: () => void;
}

export default function Checkout({ cartItems, addresses, userId, onBack, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(
    addresses.find((a) => a.is_default)?.id ?? null,
  );
  const [form, setForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    address: '',
    address_detail: '',
  });

  const totalAmount = cartItems.reduce(
    (sum, item) => sum + (item.product?.club_price ?? 0) * item.quantity,
    0,
  );

  const useExisting = selectedAddrId && addresses.find((a) => a.id === selectedAddrId);
  const shippingData = useExisting
    ? {
        recipient_name: (useExisting as Address).recipient_name,
        recipient_phone: (useExisting as Address).recipient_phone,
        address: (useExisting as Address).address,
        address_detail: (useExisting as Address).address_detail ?? '',
      }
    : form;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingData.recipient_name || !shippingData.address) {
      setError('배송지 정보를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder(userId, cartItems, shippingData);
      if (order) {
        onComplete();
      } else {
        setError('주문 생성에 실패했습니다.');
      }
    } catch (e: any) {
      setError(e.message || '주문 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="grid place-items-center py-20 text-slate-500">
        <p>장바구니가 비어 있습니다.</p>
        <button onClick={onBack} className="btn-ghost mt-4 px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> 장바구니
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> 장바구니
      </button>

      <h1 className="font-gothic text-2xl font-bold text-slate-800">주문/결제</h1>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Shipping address */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-cyan" /> 배송지
            </div>

            {addresses.length > 0 && (
              <div className="mb-4 space-y-2">
                {addresses.map((addr) => (
                  <button
                    key={addr.id}
                    type="button"
                    onClick={() => setSelectedAddrId(addr.id)}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedAddrId === addr.id
                        ? 'border-cyan bg-cyan/5'
                        : 'border-navy-700 hover:border-slate-600'
                    }`}
                  >
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
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedAddrId(null)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition ${
                    !selectedAddrId ? 'border-cyan bg-cyan/5 text-cyan' : 'border-navy-700 text-slate-400'
                  }`}
                >
                  + 새 배송지 입력
                </button>
              </div>
            )}

            {!selectedAddrId && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">받는 분</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <input
                        required
                        value={form.recipient_name}
                        onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
                        placeholder="홍길동"
                        className="input-field pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">연락처</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <input
                        required
                        value={form.recipient_phone}
                        onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
                        placeholder="010-0000-0000"
                        className="input-field pl-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">주소</label>
                  <div className="relative">
                    <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      required
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="서울시 강남구 테헤란로 123"
                      className="input-field pl-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">상세 주소</label>
                  <input
                    value={form.address_detail}
                    onChange={(e) => setForm({ ...form, address_detail: e.target.value })}
                    placeholder="101동 202호"
                    className="input-field text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Payment method placeholder */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <CreditCard className="h-4 w-4 text-gold" /> 결제 수단
            </div>
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-4 text-sm text-gold-light">
              NHN KCP 결제 연동 예정
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span>
                현재는 주문 생성만 가능합니다. 결제 연동은 추후 NHN KCP 연동 후 적용됩니다.
                주문 생성 후 관리자가 확인하여 처리합니다.
              </span>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <div className="card-surface p-5">
            <h3 className="font-gothic text-base font-semibold text-slate-800">주문 요약</h3>
            <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">
                    {item.product?.name ?? '—'} × {item.quantity}
                  </span>
                  <span className="text-slate-800">
                    {formatKRW((item.product?.club_price ?? 0) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-navy-700 pt-3">
              <div className="flex justify-between">
                <span className="font-medium text-slate-800">결제 금액</span>
                <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(totalAmount)}</span>
              </div>
            </div>
            <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
              {busy ? '주문 중...' : <><Check className="h-4 w-4" /> 주문 생성</>}
            </button>
            {error && (
              <div className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
