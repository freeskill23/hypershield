import { useMemo, useState } from 'react';
import { ShoppingCart, Plus, Minus, Trash2, Tag, X, CheckCircle2, Package } from 'lucide-react';
import { Product, CartItem } from '../lib/types';
import { formatKRW } from '../lib/format';
import { createOrder } from '../lib/data';
import { useAuth } from '../lib/auth';

interface Props {
  products: Product[];
  onOrdered: () => void;
}

export default function PrivateStore({ products, onOrdered }: Props) {
  const { profile } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [category, setCategory] = useState<string>('전체');
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category));
    return ['전체', ...Array.from(set)];
  }, [products]);

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
    setCartOpen(true);
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

  async function checkout() {
    if (!profile || cart.length === 0) return;
    setBusy(true);
    setCheckoutMsg(null);
    try {
      const order = await createOrder({ user_id: profile.id, total_amount: cartTotal });
      if (order) {
        setCheckoutMsg(`주문 완료 · ${formatKRW(cartTotal)} (${order.id.slice(-6).toUpperCase()})`);
        setCart([]);
        onOrdered();
      } else {
        setCheckoutMsg('주문 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
      setTimeout(() => setCheckoutMsg(null), 4000);
    }
  }

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
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
        <button
          onClick={() => setCartOpen(true)}
          className="btn-ghost relative"
        >
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
          <div key={p.id} className="card-surface group flex flex-col overflow-hidden transition hover:border-cyan/40 hover:shadow-card">
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
                <Tag className="h-3 w-3" /> 50% OFF
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
                <button onClick={() => addToCart(p)} className="btn-primary px-3 py-2 text-xs">
                  <Plus className="h-3.5 w-3.5" /> 담기
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative h-full w-full max-w-md animate-fadeIn border-l border-navy-700 bg-navy-900 shadow-card">
            <div className="flex items-center justify-between border-b border-navy-700 px-5 py-4">
              <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
                <ShoppingCart className="h-5 w-5 text-cyan" /> 장바구니
              </div>
              <button onClick={() => setCartOpen(false)} className="text-slate-400 hover:text-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex h-[calc(100%-9rem)] flex-col overflow-y-auto px-5 py-4">
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
                            <button onClick={() => changeQty(i.product.id, -1)} className="grid h-6 w-6 place-items-center rounded-md border border-navy-700 text-slate-300 hover:border-cyan hover:text-cyan">
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-6 text-center text-sm text-slate-100">{i.qty}</span>
                            <button onClick={() => changeQty(i.product.id, 1)} className="grid h-6 w-6 place-items-center rounded-md border border-navy-700 text-slate-300 hover:border-cyan hover:text-cyan">
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                          <button onClick={() => removeItem(i.product.id)} className="text-slate-500 hover:text-red-400">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-0 left-0 right-0 border-t border-navy-700 bg-navy-900 px-5 py-4">
              <div className="mb-3 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>시중가 합계</span>
                  <span className="line-through">{formatKRW(retailTotal)}</span>
                </div>
                <div className="flex justify-between text-cyan">
                  <span>클럽가 합계</span>
                  <span className="font-semibold">{formatKRW(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-gold-light">
                  <span>절약액</span>
                  <span>- {formatKRW(savings)}</span>
                </div>
              </div>
              <button onClick={checkout} disabled={busy || cart.length === 0} className="btn-gold w-full">
                {busy ? '결제 중...' : `결제하기 · ${formatKRW(cartTotal)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
