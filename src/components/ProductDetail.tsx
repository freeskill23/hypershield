import { useState } from 'react';
import {
  ArrowLeft, Package, ShoppingCart, TrendingDown, Check, Minus, Plus, Truck,
} from 'lucide-react';
import { Product } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';
import { addToCart } from '../lib/data';

interface Props {
  product: Product | null;
  onBack: () => void;
  onGoCart: () => void;
}

export default function ProductDetail({ product, onBack, onGoCart }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!product) {
    return (
      <div className="grid place-items-center py-20 text-slate-500">
        <p>상품을 찾을 수 없습니다.</p>
        <button onClick={onBack} className="btn-ghost mt-4 px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> 목록
        </button>
      </div>
    );
  }

  const discount = calcDiscountRate(product.original_price, product.club_price);
  const allImages = [
    product.image_url,
    ...(product.sub_images ?? []),
  ].filter(Boolean) as string[];

  async function handleAddToCart() {
    if (!product) return;
    setBusy(true);
    try {
      await addToCart(product.id, qty);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> 목록
      </button>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Images */}
        <div className="space-y-3">
          <div className="card-surface overflow-hidden">
            <div className="relative aspect-square w-full overflow-hidden bg-navy-900">
              {allImages[selectedImage] ? (
                <img src={allImages[selectedImage]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Package className="h-12 w-12 text-slate-700" />
                </div>
              )}
              {discount > 0 && (
                <div className="absolute right-4 top-4 rounded-lg bg-red-500/90 px-3 py-1.5 text-base font-bold text-white">
                  {discount}%
                </div>
              )}
            </div>
          </div>
          {allImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {allImages.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                    selectedImage === i ? 'border-cyan' : 'border-navy-700'
                  }`}
                >
                  <img src={img} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-4">
          <div className="card-surface p-5">
            <h1 className="font-gothic text-xl font-bold text-slate-100">{product.name}</h1>
            {product.sku && <p className="mt-1 text-xs text-slate-500">SKU: {product.sku}</p>}

            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-gothic text-2xl font-bold text-cyan">{formatKRW(product.club_price)}</span>
              {product.original_price > product.club_price && (
                <span className="text-base text-slate-500 line-through">{formatKRW(product.original_price)}</span>
              )}
            </div>
            {discount > 0 && (
              <div className="mt-1 text-sm text-slate-400">
                <span className="font-bold text-red-400">{discount}%</span> 할인 ·
                <span className="font-bold text-cyan"> {formatKRW(product.original_price - product.club_price)}</span> 절약
              </div>
            )}

            {product.description && (
              <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-400">
                {product.description}
              </p>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Truck className="h-3.5 w-3.5" />
              <span>재고: {product.stock}개</span>
            </div>
          </div>

          {/* Quantity + cart */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-300">수량</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-navy-700 text-slate-400 hover:border-cyan hover:text-cyan"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-gothic text-lg font-bold text-slate-100 w-8 text-center">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(product.stock, q + 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-navy-700 text-slate-400 hover:border-cyan hover:text-cyan"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-navy-700 pt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">총 상품 금액</span>
                <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(product.club_price * qty)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleAddToCart} disabled={busy} className="btn-primary flex-1">
                {added ? (
                  <><Check className="h-4 w-4" /> 장바구니 추가됨</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> 장바구니 담기</>
                )}
              </button>
              <button onClick={onGoCart} className="btn-ghost px-4 py-2.5">
                장바구니
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
