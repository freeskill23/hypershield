import { useMemo, useState, useRef, useCallback } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, Tag, X, CheckCircle2, Package, MapPin, Truck, AlertCircle, CreditCard, Coins,
} from 'lucide-react';
import { Product, CartItem, Category, Profile, Address, OrderStatus } from '../lib/types';
import { formatKRW } from '../lib/format';
import { createOrderWithItems, addAddress, deleteAddress, useAddresses, useMyOrders } from '../lib/data';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface Props {
  products: Product[];
  categories: Category[];
  profile: Profile;
  onOrdered: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: '입금대기',
  shipping_ready: '배송대기',
  shipping: '배송중',
  delivered: '배송완료',
  cancelled: '취소',
};

export default function PrivateStore({ products, categories, profile }: Props) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>('전체');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'address' | 'confirm'>('cart');

  const catNames = useMemo(() => {
    return ['전체', ...categories.map((c) => c.name)];
  }, [categories]);

  const filtered = useMemo(() => {
    if (category === '전체') return products;
    return products.filter((p) => p.category === category);
  }, [products, category]);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.qty * i.product.club_price, 0);
  const retailTotal = cart.reduce((s, i) => s + i.qty * i.product.original_price, 0);
  const savings = retailTotal - cartTotal;

  function addToCart(p: Product) {
    setCart((c) => {
      const existing = c.find((i) => i.product.id === p.id);
      if (existing) {
        return c.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { product: p, qty: 1 }];
    });
  }

  function changeQty(id: string, delta: number) {
    setCart((c) =>
      c
        .map((i) => (i.product.id === id ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  }

  function removeItem(id: string) {
    setCart((c) => c.filter((i) => i.product.id !== id));
  }

  function closeCart() {
    setCartOpen(false);
    setCheckoutStep('cart');
  }

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {catNames.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                category === c
                  ? 'bg-cyan text-navy-950 shadow-glow'
                  : 'border border-navy-700 bg-navy-800/60 text-slate-300 hover:border-cyan hover:text-cyan'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <button onClick={() => { setCartOpen(true); setCheckoutStep('cart'); }} className="btn-ghost relative">
          <ShoppingCart className="h-4 w-4" />
          장바구니
          {cartCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-950">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {checkoutMsg && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {checkoutMsg}
        </div>
      )}

      {/* Product grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => (
          <div
            key={p.id}
            onClick={() => setDetailProduct(p)}
            className="card-surface group flex cursor-pointer flex-col overflow-hidden transition hover:border-cyan/40 hover:shadow-card"
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-navy-950">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-slate-600">
                  <Package className="h-10 w-10" />
                </div>
              )}
              <div className="absolute left-3 top-3 chip border-gold/40 bg-navy-950/80 text-gold-light">
                <Tag className="h-3 w-3" /> {Math.round((1 - p.club_price / p.original_price) * 100)}% OFF
              </div>
              {p.stock <= 50 && (
                <div className="absolute right-3 top-3 chip border-cyan/40 bg-navy-950/80 text-cyan">
                  재고 {p.stock}개
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="text-[10px] uppercase tracking-widest text-slate-500">{p.category}</div>
              <h3 className="mt-1 font-medium leading-snug text-slate-100">{p.name}</h3>
              {p.description && (
                <p className="mt-1.5 line-clamp-2 text-xs text-slate-400">{p.description}</p>
              )}
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-xs text-slate-500 line-through">{formatKRW(p.original_price)}</div>
                  <div className="font-display text-lg font-bold text-cyan">{formatKRW(p.club_price)}</div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); addToCart(p); }}
                  className="btn-primary px-3 py-2 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" /> 담기
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="grid place-items-center py-20 text-center text-slate-500">
          <Package className="mb-3 h-12 w-12 text-slate-600" />
          <p className="text-sm">등록된 상품이 없습니다.</p>
        </div>
      )}

      {/* Product Detail Modal */}
      {detailProduct && (
        <ProductDetailModal
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          onAddToCart={(p) => { addToCart(p); setDetailProduct(null); }}
        />
      )}

      {/* Cart / Checkout Drawer */}
      {cartOpen && (
        <CartCheckoutDrawer
          cart={cart}
          profile={profile}
          step={checkoutStep}
          cartTotal={cartTotal}
          retailTotal={retailTotal}
          savings={savings}
          busy={busy}
          onStepChange={setCheckoutStep}
          onQtyChange={changeQty}
          onRemove={removeItem}
          onClose={closeCart}
          onCheckoutComplete={(msg) => {
            setCart([]);
            setCheckoutMsg(msg);
            setCheckoutStep('cart');
            setTimeout(() => setCheckoutMsg(null), 5000);
          }}
          onSetBusy={setBusy}
        />
      )}
    </div>
  );
}

// ============================================================
// Product Detail Modal
// ============================================================

function ProductDetailModal({
  product, onClose, onAddToCart,
}: { product: Product; onClose: () => void; onAddToCart: (p: Product) => void }) {
  const discount = Math.round((1 - product.club_price / product.original_price) * 100);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-fadeIn overflow-hidden rounded-2xl border border-navy-700 bg-navy-900 shadow-card">
        <button onClick={onClose} className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-navy-950/80 text-slate-400 hover:text-slate-100">
          <X className="h-4 w-4" />
        </button>
        <div className="relative aspect-[4/3] overflow-hidden bg-navy-950">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-slate-600">
              <Package className="h-16 w-16" />
            </div>
          )}
          <div className="absolute left-3 top-3 chip border-gold/40 bg-navy-950/80 text-gold-light">
            <Tag className="h-3 w-3" /> {discount}% OFF
          </div>
        </div>
        <div className="space-y-3 p-5">
          <div className="text-[10px] uppercase tracking-widest text-slate-500">{product.category}</div>
          <h2 className="font-display text-xl font-bold text-slate-50">{product.name}</h2>
          {product.description && (
            <p className="text-sm leading-relaxed text-slate-400">{product.description}</p>
          )}
          <div className="flex items-end gap-3 border-t border-navy-700 pt-3">
            <div className="text-sm text-slate-500 line-through">{formatKRW(product.original_price)}</div>
            <div className="font-display text-2xl font-bold text-cyan">{formatKRW(product.club_price)}</div>
          </div>
          <div className="flex items-center justify-between border-t border-navy-700 pt-3 text-xs text-slate-400">
            <span>재고: <span className="text-slate-200">{product.stock}개</span></span>
          </div>
          <button onClick={() => onAddToCart(product)} className="btn-primary w-full">
            <Plus className="h-4 w-4" /> 장바구니에 담기
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Cart + Checkout Drawer
// ============================================================

interface CartDrawerProps {
  cart: CartItem[];
  profile: Profile;
  step: 'cart' | 'address' | 'confirm';
  cartTotal: number;
  retailTotal: number;
  savings: number;
  busy: boolean;
  onStepChange: (s: 'cart' | 'address' | 'confirm') => void;
  onQtyChange: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
  onCheckoutComplete: (msg: string) => void;
  onSetBusy: (b: boolean) => void;
}

function CartCheckoutDrawer(props: CartDrawerProps) {
  const { cart, profile, step, cartTotal, retailTotal, savings, busy } = props;
  const { addresses, refresh: refreshAddresses } = useAddresses(profile.id);
  const [selectedAddrId, setSelectedAddrId] = useState<string | null>(null);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ label: '기본 배송지', recipient_name: profile.full_name, recipient_phone: '', address: '', address_detail: '' });
  const [usePoints, setUsePoints] = useState(false);
  const [pointsInput, setPointsInput] = useState('0');

  const selectedAddr = addresses.find((a) => a.id === selectedAddrId) ?? null;
  const pointsToUse = usePoints ? Math.min(Math.max(0, parseInt(pointsInput) || 0), profile.points, cartTotal) : 0;
  const finalTotal = Math.max(0, cartTotal - pointsToUse);

  async function handleAddAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    const result = await addAddress({
      user_id: profile.id,
      ...addrForm,
      is_default: addresses.length === 0,
    });
    if (result) {
      setShowAddrForm(false);
      setAddrForm({ label: '추가 배송지', recipient_name: profile.full_name, recipient_phone: '', address: '', address_detail: '' });
      refreshAddresses();
      setSelectedAddrId(result.id);
    }
  }

  async function handleCheckout() {
    if (!selectedAddr || cart.length === 0) return;
    props.onSetBusy(true);
    try {
      const order = await createOrderWithItems({
        user_id: profile.id,
        items: cart,
        address: selectedAddr,
        pointsToUse,
      });
      if (order) {
        props.onCheckoutComplete(`주문 완료 · ${formatKRW(finalTotal)} (주문번호 ${order.id.slice(-6).toUpperCase()})`);
        props.onStepChange('cart');
        props.onClose();
      } else {
        props.onCheckoutComplete('주문 처리 중 오류가 발생했습니다.');
      }
    } finally {
      props.onSetBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={props.onClose} />
      <div className="relative h-full w-full max-w-md animate-fadeIn border-l border-navy-700 bg-navy-900 shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-navy-700 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
            {step === 'cart' && <><ShoppingCart className="h-5 w-5 text-cyan" /> 장바구니</>}
            {step === 'address' && <><MapPin className="h-5 w-5 text-cyan" /> 배송지 선택</>}
            {step === 'confirm' && <><CreditCard className="h-5 w-5 text-cyan" /> 결제 확인</>}
          </div>
          <button onClick={props.onClose} className="text-slate-400 hover:text-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex h-[calc(100%-9rem)] flex-col overflow-y-auto px-5 py-4">
          {/* Step: Cart */}
          {step === 'cart' && (
            <>
              {cart.length === 0 ? (
                <div className="grid place-items-center text-center text-slate-500">
                  <div className="mb-3 rounded-full bg-navy-800 p-4">
                    <ShoppingCart className="h-8 w-8 text-slate-600" />
                  </div>
                  <p className="text-sm">장바구니가 비어 있습니다.</p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {cart.map((i) => (
                    <li key={i.product.id} className="flex gap-3 rounded-xl border border-navy-700 bg-navy-800/50 p-3">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-navy-950">
                        {i.product.image_url && (
                          <img src={i.product.image_url} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="flex flex-1 flex-col">
                        <div className="text-sm font-medium text-slate-100">{i.product.name}</div>
                        <div className="text-xs text-cyan">{formatKRW(i.product.club_price)}</div>
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button onClick={() => props.onQtyChange(i.product.id, -1)} className="grid h-6 w-6 place-items-center rounded-md border border-navy-700 text-slate-300 hover:border-cyan hover:text-cyan">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm text-slate-100">{i.qty}</span>
                            <button onClick={() => props.onQtyChange(i.product.id, 1)} className="grid h-6 w-6 place-items-center rounded-md border border-navy-700 text-slate-300 hover:border-cyan hover:text-cyan">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button onClick={() => props.onRemove(i.product.id)} className="text-slate-500 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {/* Step: Address */}
          {step === 'address' && (
            <div className="space-y-3">
              {addresses.length === 0 && !showAddrForm && (
                <p className="text-sm text-slate-500">저장된 배송지가 없습니다. 새 배송지를 등록해주세요.</p>
              )}
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${
                    selectedAddrId === a.id ? 'border-cyan bg-cyan/5' : 'border-navy-700 bg-navy-800/50 hover:border-navy-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="addr"
                    checked={selectedAddrId === a.id}
                    onChange={() => { setSelectedAddrId(a.id); }}
                    className="mt-1 accent-cyan"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-100">{a.label}</span>
                      {a.is_default && <span className="chip border-gold/40 text-gold-light">기본</span>}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      {a.recipient_name} · {a.recipient_phone}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {a.address} {a.address_detail}
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); deleteAddress(a.id).then(refreshAddresses); if (selectedAddrId === a.id) setSelectedAddrId(null); }}
                    className="self-start text-slate-600 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </label>
              ))}

              {showAddrForm ? (
                <form onSubmit={handleAddAddress} className="space-y-3 rounded-xl border border-navy-700 bg-navy-800/50 p-4">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">배송지 이름</label>
                    <input value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })} className="input-field" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">받는분</label>
                      <input value={addrForm.recipient_name} onChange={(e) => setAddrForm({ ...addrForm, recipient_name: e.target.value })} className="input-field" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-400">연락처</label>
                      <input value={addrForm.recipient_phone} onChange={(e) => setAddrForm({ ...addrForm, recipient_phone: e.target.value })} placeholder="010-0000-0000" className="input-field" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">주소</label>
                    <input value={addrForm.address} onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })} placeholder="도로명 주소" className="input-field" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">상세주소</label>
                    <input value={addrForm.address_detail} onChange={(e) => setAddrForm({ ...addrForm, address_detail: e.target.value })} placeholder="건물, 호수 등" className="input-field" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="btn-primary flex-1">배송지 저장</button>
                    <button type="button" onClick={() => setShowAddrForm(false)} className="btn-ghost">취소</button>
                  </div>
                </form>
              ) : (
                <button onClick={() => setShowAddrForm(true)} className="btn-ghost w-full">
                  <Plus className="h-4 w-4" /> 새 배송지 추가
                </button>
              )}
            </div>
          )}

          {/* Step: Confirm (bank transfer) */}
          {step === 'confirm' && (
            <div className="space-y-4">
              {/* Beta notice */}
              <div className="flex items-start gap-2 rounded-lg border border-gold/30 bg-gold/5 px-3 py-3 text-xs text-gold-light">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>현재 베타서비스로 결제는 계좌이체만 가능합니다.</span>
              </div>

              {/* Address summary */}
              {selectedAddr && (
                <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <MapPin className="h-3.5 w-3.5 text-cyan" /> 배송지
                  </div>
                  <div className="mt-1 text-sm text-slate-100">{selectedAddr.recipient_name} · {selectedAddr.recipient_phone}</div>
                  <div className="text-xs text-slate-500">{selectedAddr.address} {selectedAddr.address_detail}</div>
                </div>
              )}

              {/* Order items summary */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-slate-400">주문 상품</div>
                {cart.map((i) => (
                  <div key={i.product.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-300">{i.product.name} ×{i.qty}</span>
                    <span className="text-slate-100">{formatKRW(i.qty * i.product.club_price)}</span>
                  </div>
                ))}
              </div>

              {/* Points usage */}
              {profile.points > 0 && (
                <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gold-light">
                    <input
                      type="checkbox"
                      checked={usePoints}
                      onChange={(e) => { setUsePoints(e.target.checked); if (!e.target.checked) setPointsInput('0'); }}
                      className="h-4 w-4 accent-gold"
                    />
                    <Coins className="h-4 w-4" /> 포인트 사용
                  </label>
                  {usePoints && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs text-slate-400">보유 포인트: <span className="text-gold-light font-medium">{formatKRW(profile.points)}P</span></div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={Math.min(profile.points, cartTotal)}
                          value={pointsInput}
                          onChange={(e) => setPointsInput(e.target.value)}
                          placeholder="사용할 포인트"
                          className="input-field flex-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setPointsInput(String(Math.min(profile.points, cartTotal)))}
                          className="btn-ghost px-3 py-2 text-xs"
                        >
                          전액 사용
                        </button>
                      </div>
                      {pointsToUse > 0 && (
                        <div className="text-xs text-gold-light">{formatKRW(pointsToUse)}P 사용 → 결제금액에서 차감</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Bank transfer info */}
              <div className="rounded-xl border border-cyan/30 bg-cyan/5 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan">
                  <CreditCard className="h-4 w-4" /> 계좌이체 안내
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-300">
                  <div>은행: <span className="text-slate-100">국민은행</span></div>
                  <div>예금주: <span className="text-slate-100">하이퍼쉴드</span></div>
                  <div>계좌번호: <span className="font-mono text-slate-100">000-0000-0000</span></div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  위 계좌로 입금하시면 관리자 확인 후 배송이 시작됩니다.
                </div>
              </div>

              {/* Total */}
              <div className="space-y-1 border-t border-navy-700 pt-3 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>시중가 합계</span>
                  <span className="line-through">{formatKRW(retailTotal)}</span>
                </div>
                <div className="flex justify-between text-cyan">
                  <span>클럽가 합계</span>
                  <span className="font-semibold">{formatKRW(cartTotal)}</span>
                </div>
                {pointsToUse > 0 && (
                  <div className="flex justify-between text-gold-light">
                    <span>포인트 사용</span>
                    <span>- {formatKRW(pointsToUse)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gold-light">
                  <span>절약액</span>
                  <span>- {formatKRW(savings + pointsToUse)}</span>
                </div>
                <div className="flex justify-between border-t border-navy-700 pt-1 text-slate-200">
                  <span className="font-medium">최종 결제금액</span>
                  <span className="font-display text-base font-bold text-cyan">{formatKRW(finalTotal)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-navy-700 bg-navy-900 px-5 py-4">
          {step === 'cart' && (
            <>
              <div className="mb-3 flex justify-between text-xs">
                <span className="text-slate-400">클럽가 합계</span>
                <span className="font-semibold text-cyan">{formatKRW(cartTotal)}</span>
              </div>
              <button
                onClick={() => props.onStepChange('address')}
                disabled={busy || cart.length === 0}
                className="btn-gold w-full"
              >
                결제하기 · {formatKRW(cartTotal)}
              </button>
            </>
          )}
          {step === 'address' && (
            <div className="flex gap-2">
              <button onClick={() => props.onStepChange('cart')} className="btn-ghost flex-1">이전</button>
              <button
                onClick={() => props.onStepChange('confirm')}
                disabled={!selectedAddr}
                className="btn-gold flex-1"
              >
                다음
              </button>
            </div>
          )}
          {step === 'confirm' && (
            <div className="flex gap-2">
              <button onClick={() => props.onStepChange('address')} className="btn-ghost flex-1">이전</button>
              <button
                onClick={handleCheckout}
                disabled={busy || !selectedAddr}
                className="btn-gold flex-1"
              >
                {busy ? '주문 중...' : `주문하기 · ${formatKRW(finalTotal)}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
