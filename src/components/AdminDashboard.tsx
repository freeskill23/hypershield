import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import {
  Users, ShoppingBag, UserPlus, TrendingUp, Crown, Search, Trash2, ShieldOff, Shield, ChevronRight,
} from 'lucide-react';
import { Profile, Order, Product } from '../lib/types';
import { formatKRW, formatDate, formatDateTime } from '../lib/format';
import { setProfileRole, deleteProfile, addProduct } from '../lib/data';

interface Props {
  profiles: Profile[];
  orders: Order[];
  products: Product[];
  refresh: () => void;
}

export default function AdminDashboard({ profiles, orders, products, refresh }: Props) {
  const [tab, setTab] = useState<'overview' | 'referrals' | 'products'>('overview');
  const switchTab = useCallback((t: 'overview' | 'referrals' | 'products') => {
    setTab(t);
    window.history.pushState({ view: 'admin', tab: t }, '', `#${t}`);
  }, []);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state?.view === 'admin') {
        const t = e.state.tab;
        if (t === 'overview' || t === 'referrals' || t === 'products') setTab(t);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'overview' || hash === 'referrals' || hash === 'products') {
      setTab(hash);
      window.history.replaceState({ view: 'admin', tab: hash }, '', `#${hash}`);
    } else {
      window.history.replaceState({ view: 'admin', tab }, '', `#${tab}`);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [query, setQuery] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);

  const totalMembers = profiles.filter((p) => p.role === 'member').length;
  const totalAdmins = profiles.filter((p) => p.role === 'admin').length;
  const totalOrders = orders.length;
  const totalRevenue = orders.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total_amount, 0);

  // Active referrers: profiles whose code was used by at least one other member.
  const referrerCounts = useMemo(() => {
    const map = new Map<string, number>();
    profiles.forEach((p) => {
      if (p.referred_by_code) {
        map.set(p.referred_by_code, (map.get(p.referred_by_code) ?? 0) + 1);
      }
    });
    return map;
  }, [profiles]);

  const activeReferrers = Array.from(referrerCounts.values()).filter((c) => c > 0).length;

  // Weekly signups by referral (last 8 weeks)
  const weeklyData = useMemo(() => {
    const weeks: { label: string; signups: number; direct: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7 - 6);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const signups = profiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= start && d <= end;
      }).length;
      weeks.push({
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        signups,
        direct: 0,
      });
    }
    return weeks;
  }, [profiles]);

  // Referral tree: each profile with their referrer name and invitee count + purchases.
  const referralRows = useMemo(() => {
    return profiles.map((p) => {
      const referrer = profiles.find((r) => r.my_referral_code === p.referred_by_code);
      const invitedCount = profiles.filter((x) => x.referred_by_code === p.my_referral_code).length;
      const purchases = orders.filter((o) => o.user_id === p.id && o.status === 'completed');
      const purchaseTotal = purchases.reduce((s, o) => s + o.total_amount, 0);
      return {
        profile: p,
        referrerName: referrer?.full_name ?? '— (루트)',
        invitedCount,
        purchaseCount: purchases.length,
        purchaseTotal,
      };
    });
  }, [profiles, orders]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return referralRows;
    const q = query.toLowerCase();
    return referralRows.filter(
      (r) =>
        r.profile.full_name.toLowerCase().includes(q) ||
        r.profile.email.toLowerCase().includes(q) ||
        r.profile.my_referral_code.toLowerCase().includes(q),
    );
  }, [referralRows, query]);

  async function handleToggleRole(p: Profile) {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    await setProfileRole(p.id, newRole);
    refresh();
  }

  async function handleDelete(p: Profile) {
    if (!confirm(`${p.full_name} 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    await deleteProfile(p.id);
    refresh();
  }

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Users} label="총 클럽 회원" value={String(totalMembers + totalAdmins)} accent="cyan" sub={`정회원 ${totalMembers} · 관리자 ${totalAdmins}`} />
        <KpiCard icon={ShoppingBag} label="총 주문 건수" value={String(totalOrders)} accent="cyan" sub={`매출 ${formatKRW(totalRevenue)}`} />
        <KpiCard icon={UserPlus} label="추천인 활성화" value={String(activeReferrers)} accent="gold" sub="초대 성공 회원 수" />
        <KpiCard icon={TrendingUp} label="평균 초대율" value={`${profiles.length > 0 ? Math.round((activeReferrers / profiles.length) * 100) : 0}%`} accent="gold" sub="활성 추천인 비율" />
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
        {([
          ['overview', '대시보드'],
          ['referrals', '추천인 트래킹'],
          ['products', '상품 관리'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-100">
              <TrendingUp className="h-4 w-4 text-cyan" /> 주간 신규 회원 가입 (추천인 기반)
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27364d" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                <YAxis allowDecimals={false} stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #27364d', borderRadius: 8, color: '#e2e8f0' }}
                  cursor={{ fill: 'rgba(56,189,248,0.08)' }}
                />
                <Bar dataKey="signups" name="신규 가입" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-slate-100">
              <ShoppingBag className="h-4 w-4 text-gold" /> 최근 주문 현황
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto">
              {orders.slice(0, 8).map((o) => {
                const p = profiles.find((x) => x.id === o.user_id);
                return (
                  <div key={o.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-950/40 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{p?.full_name ?? '알 수 없음'}</div>
                      <div className="text-xs text-slate-500">{formatDateTime(o.created_at)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-cyan">{formatKRW(o.total_amount)}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">{o.status}</div>
                    </div>
                  </div>
                );
              })}
              {orders.length === 0 && (
                <div className="grid place-items-center py-12 text-sm text-slate-500">주문 내역이 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'referrals' && (
        <div className="card-surface overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-700 px-5 py-4">
            <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
              <Crown className="h-5 w-5 text-gold" /> 추천인 트래킹 시스템
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="이름/이메일/코드 검색"
                className="input-field w-56 pl-9 py-2 text-xs"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">회원</th>
                  <th className="px-5 py-3 font-medium">초대 코드</th>
                  <th className="px-5 py-3 font-medium">추천인 (Invited By)</th>
                  <th className="px-5 py-3 font-medium">하위 초대 수</th>
                  <th className="px-5 py-3 font-medium">총 구매액</th>
                  <th className="px-5 py-3 font-medium">역할</th>
                  <th className="px-5 py-3 font-medium text-right">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {filteredRows.map((r) => (
                  <tr key={r.profile.id} className="transition hover:bg-navy-800/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-navy-950 ${r.profile.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
                          {r.profile.full_name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-100">{r.profile.full_name}</div>
                          <div className="text-xs text-slate-500">{r.profile.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-cyan">{r.profile.my_referral_code}</span></td>
                    <td className="px-5 py-3 text-slate-300">{r.referrerName}</td>
                    <td className="px-5 py-3">
                      <span className={`chip ${r.invitedCount > 0 ? 'border-cyan/40 text-cyan' : ''}`}>
                        {r.invitedCount}명
                      </span>
                    </td>
                    <td className="px-5 py-3 font-medium text-cyan">{r.purchaseCount > 0 ? formatKRW(r.purchaseTotal) : '—'}</td>
                    <td className="px-5 py-3">
                      {r.profile.role === 'admin' ? (
                        <span className="chip border-gold/40 text-gold-light"><Crown className="h-3 w-3" /> ADMIN</span>
                      ) : (
                        <span className="chip">MEMBER</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggleRole(r.profile)}
                          title={r.profile.role === 'admin' ? '정회원으로 강등' : '관리자로 승격'}
                          className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-gold hover:text-gold"
                        >
                          {r.profile.role === 'admin' ? <ShieldOff className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleDelete(r.profile)}
                          title="회원 및 하위 추천 라인 삭제"
                          className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
              <ShoppingBag className="h-5 w-5 text-cyan" /> 상품 및 수량 관리
            </div>
            <button onClick={() => setShowProductForm((s) => !s)} className="btn-primary">
              {showProductForm ? '취소' : <><UserPlus className="h-4 w-4" /> 상품 추가</>}
            </button>
          </div>

          {showProductForm && <ProductForm onCreated={() => { setShowProductForm(false); refresh(); }} />}

          <div className="card-surface overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">상품명</th>
                    <th className="px-5 py-3 font-medium">카테고리</th>
                    <th className="px-5 py-3 font-medium">시중가</th>
                    <th className="px-5 py-3 font-medium">클럽가</th>
                    <th className="px-5 py-3 font-medium">할인율</th>
                    <th className="px-5 py-3 font-medium">재고</th>
                    <th className="px-5 py-3 font-medium">등록일</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {products.map((p) => {
                    const discount = Math.round((1 - p.club_price / p.original_price) * 100);
                    return (
                      <tr key={p.id} className="transition hover:bg-navy-800/40">
                        <td className="px-5 py-3 font-medium text-slate-100">{p.name}</td>
                        <td className="px-5 py-3 text-slate-400">{p.category}</td>
                        <td className="px-5 py-3 text-slate-500 line-through">{formatKRW(p.original_price)}</td>
                        <td className="px-5 py-3 font-semibold text-cyan">{formatKRW(p.club_price)}</td>
                        <td className="px-5 py-3"><span className="chip border-gold/40 text-gold-light">{discount}%</span></td>
                        <td className="px-5 py-3 text-slate-300">{p.stock}</td>
                        <td className="px-5 py-3 text-slate-500">{formatDate(p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({
  icon: Icon, label, value, sub, accent,
}: { icon: any; label: string; value: string; sub: string; accent: 'cyan' | 'gold' }) {
  return (
    <div className="card-surface p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Icon className={`h-4 w-4 ${accent === 'cyan' ? 'text-cyan' : 'text-gold'}`} /> {label}
        </div>
      </div>
      <div className={`mt-2 font-display text-3xl font-bold ${accent === 'cyan' ? 'text-cyan' : 'text-gold-light'}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function ProductForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('케미컬');
  const [original, setOriginal] = useState('');
  const [club, setClub] = useState('');
  const [description, setDescription] = useState('');
  const [stock, setStock] = useState('100');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const op = parseInt(original, 10);
    const cp = parseInt(club, 10);
    const st = parseInt(stock, 10);
    if (!name || !op || !cp) { setBusy(false); return; }
    await addProduct({
      name,
      category,
      original_price: op,
      club_price: cp,
      description: description || null,
      image_url: null,
      stock: st || 100,
    });
    setBusy(false);
    onCreated();
  }

  return (
    <form onSubmit={submit} className="card-surface grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <label className="mb-1 block text-xs text-slate-400">상품명</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="예) 코팅 세정제" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">카테고리</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="input-field">
          <option>케미컬</option>
          <option>타월</option>
          <option>코팅</option>
          <option>소모품</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">시중가 (원)</label>
        <input type="number" value={original} onChange={(e) => setOriginal(e.target.value)} className="input-field" placeholder="89000" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">클럽가 (원)</label>
        <input type="number" value={club} onChange={(e) => setClub(e.target.value)} className="input-field" placeholder="44500" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-400">재고</label>
        <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="input-field" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <label className="mb-1 block text-xs text-slate-400">설명</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" placeholder="간략 설명" />
      </div>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={busy} className="btn-gold">
          {busy ? '추가 중...' : '상품 등록'}
        </button>
      </div>
    </form>
  );
}
