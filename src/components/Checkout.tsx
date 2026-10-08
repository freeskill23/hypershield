import { useState } from 'react';
import {
  ArrowLeft, Check, MapPin, User, Phone, Home, CreditCard, AlertCircle, Truck,
} from 'lucide-react';
import { CartItemWithProduct, Address, Setting, Product, SelectedOption } from '../lib/types';
import { formatKRW, formatPhoneNumber } from '../lib/format';
import { createOrder, getSettingValue, updateOrderStatus } from '../lib/data';
import AddressSearchButton from './AddressSearchButton';

interface Props {
  cartItems: CartItemWithProduct[];
  buyNowItem?: { product: Product; quantity: number; selected_options?: SelectedOption[] } | null;
  addresses: Address[];
  userId: string;
  settings: Setting[];
  onBack: () => void;
  onComplete: () => void;
}

function isJeju(address: string): boolean {
  return /제주|서귀포|제주시/i.test(address);
}
function isIsland(address: string): boolean {
  return /울릉|독도|백령도|추자도|거문도|연평도|홍도|대마도|가거도|어청도|외도|초도|신도|모도|구곡도|가사도|나로도|안도|보라색도|장도|고사리도|소매물도|대매물도|하추자도|상추자도|비양도|우도|마라도|가파도|비양도|당사도|죽도|사승봉도|호도|국도|대도|소도|횡간도|단도|봉도|무월도|도담도|사선도|매화도|이월도|말도|원도|악어도|호암도|대장도|소장도|오리도|죽항도|당도|송도|화도|이도|구률도|갑선도|외양도|대야도|소야도|생연도|지도|무늬도|가덕도|거제도|진도|고군도|완도|노화도|보길도|청산도|소안도|영광|신지도|조도|완도|진도|고흥|여수|무안|신안|장흥|보성|해남|진도|완도|고군도|비금도|도화도|압해도|매화도|가사도|나로도|안도|보라색도/i.test(address);
}

export default function Checkout({ cartItems, buyNowItem, addresses, userId, settings, onBack, onComplete }: Props) {
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
    shipping_message: '',
  });
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'manual'>('manual');

  const isBuyNow = !!buyNowItem;
  const checkoutItems: CartItemWithProduct[] = isBuyNow && buyNowItem
    ? [{ id: 'buynow', user_id: userId, product_id: buyNowItem.product.id, quantity: buyNowItem.quantity, selected_options: buyNowItem.selected_options ?? null, created_at: '', product: buyNowItem.product }]
    : cartItems;

  const totalAmount = checkoutItems.reduce(
    (sum, item) => {
      const base = item.product?.club_price ?? 0;
      const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
      return sum + (base + optionAdd) * item.quantity;
    },
    0,
  );

  const defaultFee = parseInt(getSettingValue(settings, 'shipping_default_fee') ?? '3000', 10);
  const freeThreshold = parseInt(getSettingValue(settings, 'shipping_free_threshold') ?? '50000', 10);
  const jejuFee = parseInt(getSettingValue(settings, 'shipping_jeju_fee') ?? '3000', 10);
  const islandFee = parseInt(getSettingValue(settings, 'shipping_island_fee') ?? '5000', 10);
  const defaultCarrier = getSettingValue(settings, 'shipping_default_carrier') ?? 'CJ대한통운';
  const defaultShipType = getSettingValue(settings, 'shipping_default_type') ?? 'prepaid';

  const useExisting = selectedAddrId && addresses.find((a) => a.id === selectedAddrId);
  const shippingData = useExisting
    ? {
        recipient_name: (useExisting as Address).recipient_name,
        recipient_phone: (useExisting as Address).recipient_phone,
        address: (useExisting as Address).address,
        address_detail: (useExisting as Address).address_detail ?? '',
        shipping_message: form.shipping_message,
      }
    : form;

  const shippingAddress = shippingData.address || '';
  const isFreeShipping = totalAmount >= freeThreshold;

  const effectiveShipType = (() => {
    const products = checkoutItems.map(i => i.product).filter(Boolean);
    const customTypes = products.filter(p => !p!.use_default_shipping && p!.shipping_type && p!.shipping_type !== 'default');
    if (customTypes.length > 0) return customTypes[0]!.shipping_type as string;
    return defaultShipType;
  })();
  const isCollect = effectiveShipType === 'collect';

  const shippingFee = (() => {
    if (isFreeShipping) return 0;
    if (isCollect) return 0;
    let fee = defaultFee;
    const products = checkoutItems.map(i => i.product).filter(Boolean);
    const hasCustomShipping = products.some(p => !p!.use_default_shipping);
    if (hasCustomShipping) {
      fee = products.reduce((max, p) => {
        if (!p!.use_default_shipping && p!.shipping_fee != null) {
          return Math.max(max, p!.shipping_fee);
        }
        return max;
      }, 0) || defaultFee;
    }
    if (isJeju(shippingAddress)) fee += jejuFee;
    else if (isIsland(shippingAddress)) fee += islandFee;
    return fee;
  })();

  const finalAmount = totalAmount + shippingFee;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!shippingData.recipient_name || !shippingData.address) {
      setError('배송지 정보를 입력해 주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const order = await createOrder(userId, checkoutItems, { ...shippingData, payment_method: paymentMethod }, 0, isBuyNow);
      if (paymentMethod === 'card' && order) {
        await updateOrderStatus(order.id, 'paid');
      }
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

  if (checkoutItems.length === 0) {
    return (
      <div className="grid place-items-center py-20 text-slate-500">
        <p>{isBuyNow ? '상품 정보가 없습니다.' : '장바구니가 비어 있습니다.'}</p>
        <button onClick={onBack} className="btn-ghost mt-4 px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> {isBuyNow ? '쇼핑몰' : '장바구니'}
        </button>
      </div>
    );
  }

  const backLabel = isBuyNow ? '쇼핑몰' : '장바구니';

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
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
                        type="tel"
                        inputMode="numeric"
                        maxLength={13}
                        value={form.recipient_phone}
                        onChange={(e) => setForm({ ...form, recipient_phone: formatPhoneNumber(e.target.value) })}
                        placeholder="010-0000-0000"
                        className="input-field pl-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">주소</label>
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <input
                        required
                        readOnly
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        placeholder="도로명 주소 검색 버튼을 눌러주세요"
                        className="input-field min-h-12 cursor-not-allowed bg-slate-50 pl-9 text-sm"
                      />
                    </div>
                    <AddressSearchButton onSelect={(addr) => setForm({ ...form, address: addr })} />
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

            <div className="mt-3">
              <label className="mb-1 block text-xs text-slate-500">배송요청사항</label>
              <input
                value={form.shipping_message}
                onChange={(e) => setForm({ ...form, shipping_message: e.target.value })}
                placeholder="배송 기사님께 전달할 내용을 입력하세요"
                className="input-field text-sm"
              />
            </div>
          </div>

          {/* Shipping info */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <Truck className="h-4 w-4 text-cyan" /> 배송 정보
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">배송업체</span>
                <span className="text-slate-800">{defaultCarrier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">배송비 결제 방식</span>
                <span className="text-slate-800">{isCollect ? '착불 (수령 시 기사에게 결제)' : '선불 (주문금액에 합산)'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">배송료</span>
                <span className={`font-medium ${isFreeShipping ? 'text-green-500' : isCollect ? 'text-gold' : 'text-slate-800'}`}>
                  {isFreeShipping ? '무료배송' : isCollect ? `착불 ${formatKRW(shippingFee || defaultFee)}` : formatKRW(shippingFee)}
                </span>
              </div>
              {!isFreeShipping && (
                <p className="text-xs text-slate-500">
                  {formatKRW(freeThreshold)} 이상 주문 시 무료배송
                  {isCollect && ' · 착불: 수령 시 택배 기사에게 배송비를 직접 결제합니다'}
                  {isJeju(shippingAddress) && ` · 제주도 추가 ${formatKRW(jejuFee)}`}
                  {isIsland(shippingAddress) && !isJeju(shippingAddress) && ` · 도서산간 추가 ${formatKRW(islandFee)}`}
                </p>
              )}
            </div>
          </div>

          {/* Payment method placeholder */}
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-800">
              <CreditCard className="h-4 w-4 text-gold" /> 결제 수단
            </div>
            <div className="space-y-3">
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${paymentMethod === 'card' ? 'border-cyan bg-cyan/5 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                <input type="radio" name="payment_method" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                카드 결제
              </label>
              <label className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition ${paymentMethod === 'manual' ? 'border-cyan bg-cyan/5 text-slate-800' : 'border-slate-200 text-slate-500'}`}>
                <input type="radio" name="payment_method" checked={paymentMethod === 'manual'} onChange={() => setPaymentMethod('manual')} />
                기타 결제 / 관리자 확인
              </label>
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
              {checkoutItems.map((item) => {
                const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
                const unitPrice = (item.product?.club_price ?? 0) + optionAdd;
                return (
                <div key={item.id} className="space-y-0.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">
                      {item.product?.name ?? '—'} × {item.quantity}
                    </span>
                    <span className="text-slate-800">
                      {formatKRW(unitPrice * item.quantity)}
                    </span>
                  </div>
                  {item.selected_options && item.selected_options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-1">
                      {item.selected_options.map((opt, i) => (
                        <span key={i} className="text-xs text-slate-500">
                          {opt.name}: {opt.value}{opt.price_addition ? ` (+${formatKRW(opt.price_addition)})` : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 border-t border-navy-700 pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">상품 합계</span>
                <span className="text-slate-800">{formatKRW(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">배송료</span>
                <span className={isFreeShipping ? 'text-green-500' : isCollect ? 'text-gold' : 'text-slate-800'}>
                  {isFreeShipping ? '무료배송' : isCollect ? `착불 ${formatKRW(shippingFee || defaultFee)}` : formatKRW(shippingFee)}
                </span>
              </div>
              <div className="flex justify-between border-t border-navy-700 pt-2">
                <span className="font-medium text-slate-800">결제 금액</span>
                <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(finalAmount)}</span>
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
