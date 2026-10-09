import { useState, useMemo, useEffect } from 'react';
import { Search, Package, Megaphone, ArrowRight, Gift } from 'lucide-react';
import { Product, Category } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';

interface Props {
  products: Product[];
  categories: Category[];
  userTier: string | null;
  onSelectProduct: (id: string) => void;
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId: string | null;
  onGoBoard: () => void;
  onGoTrials: () => void;
}

export default function ShopMain({
  products,
  categories,
  userTier,
  onSelectProduct,
  onSelectCategory,
  selectedCategoryId,
  onGoBoard,
  onGoTrials,
}: Props) {
  const [search, setSearch] = useState('');

  const visibleCategories = useMemo(() => {
    return categories.filter(cat => {
      if (!cat.visible_grades || cat.visible_grades.length === 0) return true;
      return userTier ? cat.visible_grades.includes(userTier) : false;
    });
  }, [categories, userTier]);

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.is_active);
    if (selectedCategoryId) {
      list = list.filter((p) => {
        const catIds = p.category_ids && p.category_ids.length > 0 ? p.category_ids : (p.category_id ? [p.category_id] : []);
        return catIds.includes(selectedCategoryId);
      });
    }
    if (search.trim()) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
      );
    }
    return list;
  }, [products, selectedCategoryId, search, visibleCategories]);

  // Reset selected category if it becomes invisible
  useEffect(() => {
    if (selectedCategoryId && !visibleCategories.some(c => c.id === selectedCategoryId)) {
      onSelectCategory(null);
    }
  }, [visibleCategories, selectedCategoryId, onSelectCategory]);

  return (
    <div className="space-y-6">
      {/* Dual banner: board + trials */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={onGoBoard}
          className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-navy-700 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 text-left transition hover:border-cyan/40 md:p-6"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-cyan/10 blur-3xl" />
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan/10 text-cyan transition group-hover:bg-cyan/20">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="relative flex-1">
            <h2 className="font-gothic text-lg font-bold text-slate-800">하이퍼쉴드의 생각</h2>
            <p className="mt-0.5 text-sm text-slate-400">하이퍼쉴드가 말하고 싶은 이것저것.</p>
          </div>
          <ArrowRight className="relative h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-cyan" />
        </button>

        <button
          onClick={onGoTrials}
          className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-navy-700 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-5 text-left transition hover:border-gold/40 md:p-6"
        >
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gold/10 text-gold-light transition group-hover:bg-gold/20">
            <Gift className="h-6 w-6" />
          </div>
          <div className="relative flex-1">
            <h2 className="font-gothic text-lg font-bold text-slate-800">체험단 신청하기</h2>
            <p className="mt-0.5 text-sm text-slate-400">상품 무료 체험 후 리뷰를 작성해보세요.</p>
          </div>
          <ArrowRight className="relative h-5 w-5 shrink-0 text-slate-500 transition group-hover:translate-x-1 group-hover:text-gold-light" />
        </button>
      </div>

      {/* Search + categories */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="상품 검색..."
            className="input-field pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onSelectCategory(null)}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
              !selectedCategoryId
                ? 'border-cyan bg-cyan text-white'
                : 'border-navy-700 text-slate-400 hover:text-slate-700'
            }`}
          >
            전체
          </button>
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                selectedCategoryId === cat.id
                  ? 'border-cyan bg-cyan text-white'
                  : 'border-navy-700 text-slate-400 hover:text-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      {filtered.length === 0 ? (
        <div className="card-surface grid place-items-center py-16 text-center">
          <Package className="mb-3 h-10 w-10 text-slate-700" />
          <p className="text-sm text-slate-500">해당하는 상품이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((product) => {
            const discount = calcDiscountRate(product.original_price, product.club_price);
            return (
              <button
                key={product.id}
                onClick={() => onSelectProduct(product.id)}
                className="card-surface group overflow-hidden text-left transition hover:border-cyan/40 hover:shadow-card-lg"
              >
                <div className="relative aspect-square overflow-hidden bg-navy-900">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <Package className="h-10 w-10 text-slate-700" />
                    </div>
                  )}
                  {discount > 0 && (
                    <div className="absolute right-2 top-2 rounded-lg bg-red-500/90 px-2 py-0.5 text-xs font-bold text-white">
                      {discount}%
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-2 text-sm font-medium text-slate-800 transition group-hover:text-cyan">
                    {product.name}
                  </h3>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <span className="font-gothic text-base font-bold text-cyan">
                      {formatKRW(product.club_price)}
                    </span>
                    {product.original_price > product.club_price && (
                      <span className="text-xs text-slate-500 line-through">
                        {formatKRW(product.original_price)}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
