import { useState, useMemo } from 'react';
import { Search, Package, TrendingDown } from 'lucide-react';
import { Product, Category } from '../lib/types';
import { formatKRW, calcDiscountRate } from '../lib/format';

interface Props {
  products: Product[];
  categories: Category[];
  onSelectProduct: (id: string) => void;
  onSelectCategory: (categoryId: string | null) => void;
  selectedCategoryId: string | null;
}

export default function ShopMain({
  products,
  categories,
  onSelectProduct,
  onSelectCategory,
  selectedCategoryId,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = products.filter((p) => p.is_active);
    if (selectedCategoryId) {
      list = list.filter((p) => p.category_id === selectedCategoryId);
    }
    if (search.trim()) {
      list = list.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description ?? '').toLowerCase().includes(search.toLowerCase()),
      );
    }
    return list;
  }, [products, selectedCategoryId, search]);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-navy-700 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1 text-xs font-medium text-cyan">
            <TrendingDown className="h-3.5 w-3.5" /> 노애드 멤버십
          </div>
          <h1 className="font-gothic text-2xl font-bold text-slate-800">쇼핑몰</h1>
          <p className="mt-2 text-sm text-slate-400">
            회원 전용 가격으로 구매하세요. 광고비를 지불하지 않은 만큼 더 낮은 가격에.
          </p>
        </div>
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
          {categories.map((cat) => (
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
