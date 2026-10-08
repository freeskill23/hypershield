import { useState } from 'react';
import {
  ArrowLeft, Package, ShoppingCart, TrendingDown, Check, Minus, Plus, Truck, ExternalLink, Youtube, Zap,
} from 'lucide-react';
import { Product, ProductOption, Setting, SelectedOption, Review } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';
import { addToCart, getSettingValue } from '../lib/data';
import { Star } from 'lucide-react';

function maskEmail(email: string): string {
  const atIdx = email.indexOf('@');
  if (atIdx <= 4) return email;
  return email.slice(0, 4) + '*'.repeat(Math.min(atIdx - 4, 4)) + email.slice(atIdx);
}

function ReviewStars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? 'fill-gold text-gold' : 'text-slate-300'}
        />
      ))}
    </div>
  );
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

interface Props {
  product: Product | null;
  settings?: Setting[];
  reviews?: Review[];
  onBack: () => void;
  onGoCart: () => void;
  onBuyNow?: (item: { product: Product; quantity: number; selected_options?: SelectedOption[] }) => void;
  onAddedToCart?: () => void;
}

export default function ProductDetail({ product, settings, reviews = [], onBack, onGoCart, onBuyNow, onAddedToCart }: Props) {
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});

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

  const options: ProductOption[] = product.options ?? [];
  const optionAddition = options.reduce((sum, opt, oi) => {
    const vi = selectedOptions[oi];
    if (vi === undefined) return sum;
    return sum + (opt.values[vi]?.price_addition ?? 0);
  }, 0);
  const allOptionsSelected = options.length === 0 || options.every((_, oi) => selectedOptions[oi] !== undefined);
  const unitPrice = product.club_price + optionAddition;
  const totalPrice = unitPrice * qty;

  // Shipping fee calculation
  const defaultFee = parseInt(getSettingValue(settings ?? [], 'shipping_default_fee') ?? '3000', 10);
  const freeThreshold = parseInt(getSettingValue(settings ?? [], 'shipping_free_threshold') ?? '50000', 10);
  const productShippingFee = product.use_default_shipping
    ? defaultFee
    : (product.shipping_fee ?? 0);
  const isFreeShipping = totalPrice >= freeThreshold;
  const shippingTypeLabel = product.shipping_type === 'collect'
    ? '착불'
    : product.shipping_type === 'default'
      ? (getSettingValue(settings ?? [], 'shipping_default_type') === 'collect' ? '착불' : '선불')
      : '선불';

  async function handleAddToCart() {
    if (!product) return;
    if (!allOptionsSelected) return;
    setBusy(true);
    try {
      const opts: SelectedOption[] = options.map((opt, oi) => {
        const vi = selectedOptions[oi]!;
        return { name: opt.name, value: opt.values[vi].label, price_addition: opt.values[vi].price_addition };
      });
      await addToCart(product.id, qty, opts.length > 0 ? opts : undefined);
      setAdded(true);
      onAddedToCart?.();
      setTimeout(() => setAdded(false), 2000);
    } finally {
      setBusy(false);
    }
  }

  function handleBuyNow() {
    if (!product) return;
    if (!allOptionsSelected) return;
    const opts: SelectedOption[] = options.map((opt, oi) => {
      const vi = selectedOptions[oi]!;
      return { name: opt.name, value: opt.values[vi].label, price_addition: opt.values[vi].price_addition };
    });
    onBuyNow?.({ product, quantity: qty, selected_options: opts.length > 0 ? opts : undefined });
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
            <h1 className="font-gothic text-xl font-bold text-slate-800">{product.name}</h1>
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

            {/* Shipping info */}
            <div className="mt-4 rounded-lg border border-navy-700 bg-navy-900/50 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="h-4 w-4 shrink-0 text-cyan" />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-600">배송비</span>
                    {isFreeShipping ? (
                      <span className="font-bold text-green-500">무료</span>
                    ) : (
                      <span className="font-bold text-slate-800">{formatKRW(productShippingFee)}</span>
                    )}
                    <span className="text-xs text-slate-500">({shippingTypeLabel})</span>
                  </div>
                  {!isFreeShipping && (
                    <p className="text-xs text-slate-500">
                      {formatKRW(freeThreshold)} 이상 주문 시 무료 배송
                    </p>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <Package className="h-3.5 w-3.5" />
                <span>재고: {product.stock}개</span>
              </div>
            </div>

            {options.length > 0 && (
              <div className="mt-4 space-y-3">
                {options.map((opt, oi) => (
                  <div key={oi}>
                    <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                      <span className="text-cyan">●</span>
                      {opt.name}
                      <span className="text-xs font-normal text-red-400">* 필수</span>
                    </label>
                    <div className="relative">
                      <select
                        value={selectedOptions[oi] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            setSelectedOptions(prev => { const next = { ...prev }; delete next[oi]; return next; });
                          } else {
                            setSelectedOptions(prev => ({ ...prev, [oi]: parseInt(val, 10) }));
                          }
                        }}
                        className={`w-full appearance-none rounded-lg border px-4 py-3 pr-10 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-cyan/30 ${
                          selectedOptions[oi] !== undefined
                            ? 'border-cyan bg-cyan/5 text-slate-800'
                            : 'border-navy-600 bg-white text-slate-500 hover:border-navy-500'
                        }`}
                      >
                        <option value="">{opt.name}을(를) 선택하세요</option>
                        {opt.values.map((v, vi) => {
                          const extra = v.price_addition !== 0 ? ` (+${formatKRW(v.price_addition)})` : '';
                          return (
                            <option key={vi} value={vi}>
                              {v.label}{extra}
                            </option>
                          );
                        })}
                      </select>
                      <svg className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {product.detail_link && (
              <a href={product.detail_link} target="_blank" rel="noopener" className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-2.5 text-sm font-medium text-cyan transition hover:bg-cyan/10">
                <ExternalLink className="h-4 w-4" />
                상품 정보 자세히 보기
              </a>
            )}
          </div>

          {/* Quantity + cart */}
          <div className="card-surface p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">수량</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="grid h-8 w-8 place-items-center rounded-lg border border-navy-700 text-slate-400 hover:border-cyan hover:text-cyan"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-gothic text-lg font-bold text-slate-800 w-8 text-center">{qty}</span>
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
                <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(totalPrice)}</span>
              </div>
              {optionAddition !== 0 && (
                <div className="mt-1 text-right text-xs text-slate-500">옵션 추가 금액: {formatKRW(optionAddition * qty)}</div>
              )}
              <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                <span>배송비</span>
                <span className={isFreeShipping ? 'font-medium text-green-500' : ''}>
                  {isFreeShipping ? '무료' : formatKRW(productShippingFee)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleAddToCart} disabled={busy || !allOptionsSelected} className="btn-ghost flex-1">
                {!allOptionsSelected ? (
                  <><Package className="h-4 w-4" /> 옵션을 선택하세요</>
                ) : added ? (
                  <><Check className="h-4 w-4" /> 추가됨</>
                ) : (
                  <><ShoppingCart className="h-4 w-4" /> 장바구니</>
                )}
              </button>
              <button
                onClick={handleBuyNow}
                disabled={!allOptionsSelected || !onBuyNow}
                className="btn-primary flex-1"
              >
                <Zap className="h-4 w-4" /> 바로 구매
              </button>
              <button onClick={onGoCart} className="btn-ghost px-4 py-2.5">
                장바구니
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* YouTube videos */}
      {product.youtube_urls && product.youtube_urls.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-gothic text-base font-semibold text-slate-800 flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" /> 영상
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {product.youtube_urls.map((url, i) => {
              const videoId = extractYouTubeId(url);
              if (!videoId) return null;
              return (
                <div key={i} className="card-surface overflow-hidden">
                  <div className="relative aspect-video w-full bg-navy-900">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title={`YouTube video ${i + 1}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-gothic text-base font-semibold text-slate-800 flex items-center gap-2">
            <Star className="h-5 w-5 text-gold" /> 상품 후기 ({reviews.length})
          </h2>
          {reviews.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">평균 만족도</span>
              <ReviewStars rating={Math.round(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length)} />
              <span className="font-gothic text-sm font-bold text-gold">
                {(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)}
              </span>
            </div>
          )}
        </div>
        {reviews.length === 0 ? (
          <div className="card-surface grid place-items-center py-12 text-center">
            <Star className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">아직 작성된 후기가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((rev) => (
              <div key={rev.id} className="card-surface p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
                      {maskEmail(rev.author_email).slice(0, 1).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-700">{maskEmail(rev.author_email)}</span>
                  </div>
                  <span className="text-xs text-slate-400">{new Date(rev.created_at).toLocaleDateString('ko-KR')}</span>
                </div>
                <div className="mt-2"><ReviewStars rating={rev.rating} /></div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap">{rev.content}</p>
                {rev.images && rev.images.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {rev.images.map((img, i) => (
                      <img key={i} src={img} alt={`후기 이미지 ${i + 1}`} className="h-20 w-20 rounded-lg object-cover border border-slate-200" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
