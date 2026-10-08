import { useState } from 'react';
import {
  ArrowLeft, ShoppingCart, Minus, Plus, Trash2, Package, ArrowRight, Check,
} from 'lucide-react';
import { CartItemWithProduct } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';
import { updateCartQuantity, removeFromCart } from '../lib/data';

interface Props {
  cartItems: CartItemWithProduct[];
  onBack: () => void;
  onCheckout: () => void;
  onRefresh: () => void;
}

export default function Cart({ cartItems, onBack, onCheckout, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);

  const totalAmount = cartItems.reduce(
    (sum, item) => {
      const base = item.product?.club_price ?? 0;
      const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
      return sum + (base + optionAdd) * item.quantity;
    },
    0,
  );
  const totalOriginal = cartItems.reduce(
    (sum, item) => {
      const base = item.product?.original_price ?? 0;
      const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
      return sum + (base + optionAdd) * item.quantity;
    },
    0,
  );
  const totalSavings = totalOriginal - totalAmount;

  async function handleUpdateQty(id: string, qty: number) {
    setBusy(true);
    await updateCartQuantity(id, qty);
    onRefresh();
    setBusy(false);
  }

  async function handleRemove(id: string) {
    setBusy(true);
    await removeFromCart(id);
    onRefresh();
    setBusy(false);
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> 쇼핑몰
      </button>

      <h1 className="font-gothic text-2xl font-bold text-slate-800">장바구니</h1>

      {cartItems.length === 0 ? (
        <div className="card-surface grid place-items-center py-20 text-center">
          <ShoppingCart className="mb-4 h-12 w-12 text-slate-700" />
          <p className="text-sm text-slate-500">장바구니가 비어 있습니다.</p>
          <button onClick={onBack} className="btn-primary mt-5 px-5 py-2.5 text-sm">
            쇼핑 계속하기 <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Cart items */}
          <div className="space-y-3 lg:col-span-2">
            {cartItems.map((item) => {
              const product = item.product;
              if (!product) return null;
              const discount = calcDiscountRate(product.original_price, product.club_price);
              return (
                <div key={item.id} className="card-surface p-4">
                  <div className="flex gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-navy-900">
                      {product.image_url ? (
                        <img src={product.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Package className="h-6 w-6 text-slate-700" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-slate-800">{product.name}</h3>
                      {item.selected_options && item.selected_options.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.selected_options.map((opt, i) => (
                            <span key={i} className="rounded-md bg-cyan/10 px-2 py-0.5 text-xs text-cyan">
                              {opt.name}: {opt.value}{opt.price_addition ? ` (+${formatKRW(opt.price_addition)})` : ''}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="font-gothic text-base font-bold text-cyan">
                          {formatKRW((product.club_price + (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0)))}
                        </span>
                        {discount > 0 && (
                          <span className="text-xs text-slate-500 line-through">
                            {formatKRW(product.original_price)}
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleUpdateQty(item.id, item.quantity - 1)}
                            disabled={busy}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-navy-700 text-slate-400 hover:border-cyan hover:text-cyan"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-8 text-center text-sm font-medium text-slate-800">{item.quantity}</span>
                          <button
                            onClick={() => handleUpdateQty(item.id, item.quantity + 1)}
                            disabled={busy}
                            className="grid h-7 w-7 place-items-center rounded-lg border border-navy-700 text-slate-400 hover:border-cyan hover:text-cyan"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => handleRemove(item.id)}
                          disabled={busy}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-gothic text-base font-bold text-slate-800">
                        {formatKRW((product.club_price + (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0)) * item.quantity)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary */}
          <div className="space-y-4">
            <div className="card-surface p-5">
              <h3 className="font-gothic text-base font-semibold text-slate-800">결제 요약</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>정상가 합계</span>
                  <span className="line-through">{formatKRW(totalOriginal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>회원 할인</span>
                  <span className="text-red-400">-{formatKRW(totalSavings)}</span>
                </div>
                <div className="border-t border-navy-700 pt-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">결제 금액</span>
                    <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(totalAmount)}</span>
                  </div>
                </div>
              </div>
              <button onClick={onCheckout} className="btn-primary mt-5 w-full">
                주문하기 <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {totalSavings > 0 && (
              <div className="card-surface flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan/10">
                  <Check className="h-5 w-5 text-cyan" />
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {formatKRW(totalSavings)} 절약
                  </div>
                  <div className="text-xs text-slate-500">회원가로 절약한 금액</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
