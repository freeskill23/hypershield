import { useState, useMemo } from 'react';
import {
  Plus, Users, Package, ShoppingBag, TrendingUp, Clock, CheckCircle2,
  XCircle, Trash2, Edit2, Banknote, Truck, MapPin, Calendar, Tag,
  AlertCircle, Building2, Phone, User as UserIcon, Link2, Loader2, Search,
} from 'lucide-react';
import { Profile, GroupBuy, Participant, GroupBuyStatus, ParticipantStatus } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getTimeRemaining } from '../lib/format';
import {
  createGroupBuy, updateGroupBuy, deleteGroupBuy,
  confirmDeposit, markShipped, setProfileRole, deleteProfile,
  fetchProductInfo,
} from '../lib/data';

type Tab = 'overview' | 'groupbuys' | 'participants' | 'members';

interface Props {
  profile: Profile;
  groupBuys: GroupBuy[];
  participants: Participant[];
  profiles: Profile[];
  refresh: () => void;
}

interface GBFormState {
  title: string;
  description: string;
  image_url: string;
  original_price: string;
  group_price: string;
  target_count: string;
  deadline: string;
  bank_account: string;
  bank_holder: string;
}

const emptyForm: GBFormState = {
  title: '',
  description: '',
  image_url: '',
  original_price: '',
  group_price: '',
  target_count: '',
  deadline: '',
  bank_account: '',
  bank_holder: '',
};

export default function AdminDashboard({ profile, groupBuys, participants, profiles, refresh }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<GroupBuy | null>(null);
  const [form, setForm] = useState<GBFormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [productUrl, setProductUrl] = useState('');
  const [fetchingProduct, setFetchingProduct] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchSuccess, setFetchSuccess] = useState(false);

  const switchTab = (t: Tab) => {
    setTab(t);
    window.history.replaceState({ view: 'admin', tab: t }, '', `#${t}`);
  };

  const stats = useMemo(() => {
    const active = groupBuys.filter((g) => g.status === 'recruiting').length;
    const succeeded = groupBuys.filter((g) => g.status === 'succeeded').length;
    const totalParticipants = participants.filter((p) => p.status !== 'cancelled').length;
    const totalRevenue = participants
      .filter((p) => p.status === 'deposited' || p.status === 'shipped')
      .reduce((s, p) => {
        const gb = groupBuys.find((g) => g.id === p.group_buy_id);
        return s + (gb?.group_price ?? 0);
      }, 0);
    const pendingDeposits = participants.filter((p) => p.status === 'address_submitted').length;
    return { active, succeeded, totalParticipants, totalRevenue, pendingDeposits };
  }, [groupBuys, participants]);

  function openCreate() {
    setEditTarget(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(gb: GroupBuy) {
    setEditTarget(gb);
    setForm({
      title: gb.title,
      description: gb.description ?? '',
      image_url: gb.image_url ?? '',
      original_price: String(gb.original_price),
      group_price: String(gb.group_price),
      target_count: String(gb.target_count),
      deadline: gb.deadline.slice(0, 16),
      bank_account: gb.bank_account ?? '',
      bank_holder: gb.bank_holder ?? '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const input = {
        title: form.title.trim(),
        description: form.description.trim(),
        image_url: form.image_url.trim() || null,
        original_price: Number(form.original_price) || 0,
        group_price: Number(form.group_price) || 0,
        target_count: Number(form.target_count) || 1,
        deadline: form.deadline ? new Date(form.deadline).toISOString() : new Date().toISOString(),
        bank_account: form.bank_account.trim() || null,
        bank_holder: form.bank_holder.trim() || null,
      };

      if (editTarget) {
        await updateGroupBuy(editTarget.id, input);
      } else {
        await createGroupBuy(input);
      }
      setShowForm(false);
      setForm(emptyForm);
      setEditTarget(null);
      refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleFetchProduct() {
    if (!productUrl.trim()) return;
    setFetchingProduct(true);
    setFetchError(null);
    setFetchSuccess(false);
    try {
      const info = await fetchProductInfo(productUrl.trim());
      setForm((prev) => ({
        ...prev,
        title: prev.title || info.title || '',
        description: prev.description || info.description || '',
        image_url: prev.image_url || info.image_url || '',
        original_price: prev.original_price || (info.original_price ? String(info.original_price) : ''),
      }));
      setFetchSuccess(true);
    } catch (e: any) {
      setFetchError(e.message || '상품 정보를 가져오지 못했습니다.');
    } finally {
      setFetchingProduct(false);
    }
  }

  async function handleDelete(gb: GroupBuy) {
    if (!confirm(`'${gb.title}' 공동구매를 삭제하시겠습니까?`)) return;
    await deleteGroupBuy(gb.id);
    refresh();
  }

  async function handleSetStatus(gb: GroupBuy, status: GroupBuyStatus) {
    await updateGroupBuy(gb.id, { status });
    refresh();
  }

  async function handleConfirmDeposit(p: Participant) {
    await confirmDeposit(p.id);
    refresh();
  }

  async function handleMarkShipped(p: Participant) {
    await markShipped(p.id);
    refresh();
  }

  async function handleToggleRole(p: Profile) {
    const newRole = p.role === 'admin' ? 'member' : 'admin';
    await setProfileRole(p.id, newRole);
    refresh();
  }

  async function handleDeleteProfile(p: Profile) {
    if (!confirm(`${p.full_name} 회원을 삭제하시겠습니까?`)) return;
    await deleteProfile(p.id);
    refresh();
  }

  const tabs: [Tab, string, number?][] = [
    ['overview', '대시보드'],
    ['groupbuys', '공동구매 관리'],
    ['participants', '참여자 관리', stats.pendingDeposits || undefined],
    ['members', '회원 관리'],
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Clock} label="모집 중" value={String(stats.active)} accent="cyan" />
        <KpiCard icon={CheckCircle2} label="성공" value={String(stats.succeeded)} accent="gold" />
        <KpiCard icon={Users} label="총 참여자" value={String(stats.totalParticipants)} accent="cyan" />
        <KpiCard icon={TrendingUp} label="확정 매출" value={formatKRW(stats.totalRevenue)} accent="gold" />
      </div>

      {/* Tab nav */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-navy-950/60 p-1">
        {tabs.map(([k, label, badge]) => (
          <button
            key={k}
            onClick={() => switchTab(k)}
            className={`relative rounded-md px-4 py-2 text-sm font-medium transition ${
              tab === k ? 'bg-cyan text-navy-950 shadow-glow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
            {badge ? (
              <span className="ml-1.5 inline-grid h-4 min-w-[16px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy-950">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-100">
              <Package className="h-4 w-4 text-cyan" /> 공동구매 현황
            </div>
            <div className="space-y-2">
              {groupBuys.slice(0, 6).map((gb) => (
                <div key={gb.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-950/40 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {gb.image_url ? (
                      <img src={gb.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <div className="grid h-8 w-8 place-items-center rounded bg-navy-800">
                        <Package className="h-4 w-4 text-slate-600" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium text-slate-100">{gb.title}</div>
                      <div className="text-xs text-slate-500">
                        {gb.current_count}/{gb.target_count}명 · {formatKRW(gb.group_price)}
                      </div>
                    </div>
                  </div>
                  <GBStatusBadge status={gb.status} />
                </div>
              ))}
              {groupBuys.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">공동구매가 없습니다.</div>
              )}
            </div>
          </div>

          <div className="card-surface p-5">
            <div className="mb-4 flex items-center gap-2 font-gothic text-base font-semibold text-slate-100">
              <Banknote className="h-4 w-4 text-gold" /> 최근 참여자
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto">
              {participants.slice(0, 8).map((p) => {
                const gb = groupBuys.find((g) => g.id === p.group_buy_id);
                const user = profiles.find((u) => u.id === p.user_id);
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-navy-700 bg-navy-950/40 px-3 py-2.5">
                    <div>
                      <div className="text-sm font-medium text-slate-100">{user?.full_name ?? '알 수 없음'}</div>
                      <div className="text-xs text-slate-500">{gb?.title ?? '—'}</div>
                    </div>
                    <ParticipantStatusChip status={p.status} />
                  </div>
                );
              })}
              {participants.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">참여자가 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Group Buy management */}
      {tab === 'groupbuys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-gothic text-lg font-semibold text-slate-100">공동구매 관리</h2>
            <button onClick={openCreate} className="btn-primary px-4 py-2 text-sm">
              <Plus className="h-4 w-4" /> 공동구매 등록
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleSubmit} className="card-surface space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-gothic text-base font-semibold text-slate-100">
                  {editTarget ? '공동구매 수정' : '새 공동구매 등록'}
                </h3>
                <button type="button" onClick={() => setShowForm(false)} className="text-slate-500 hover:text-slate-300">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Smart store URL fetcher */}
              {!editTarget && (
                <div className="rounded-lg border border-cyan/20 bg-cyan/5 p-4">
                  <label className="mb-1.5 block text-xs font-medium text-cyan">스마트스토어 상품 URL에서 자동 가져오기</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={productUrl}
                        onChange={(e) => setProductUrl(e.target.value)}
                        placeholder="https://smartstore.naver.com/... 또는 상품 상세 페이지 URL"
                        className="input-field pl-9 text-sm"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchProduct(); } }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchProduct}
                      disabled={fetchingProduct || !productUrl.trim()}
                      className="btn-primary px-4 py-2.5 text-sm whitespace-nowrap"
                    >
                      {fetchingProduct ? (
                        <><Loader2 className="h-4 w-4 animate-spin" /> 가져오는 중...</>
                      ) : (
                        <><Search className="h-4 w-4" /> 정보 가져오기</>
                      )}
                    </button>
                  </div>
                  {fetchError && (
                    <div className="mt-2 flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{fetchError}</span>
                    </div>
                  )}
                  {fetchSuccess && (
                    <div className="mt-2 flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      상품 정보를 성공적으로 가져왔습니다. 필요한 부분을 수정하세요.
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-500">
                    네이버 스마트스토어, 쿠팡, 11번가 등 쇼핑몰 상품 페이지 URL을 입력하면 상품명, 설명, 이미지, 가격을 자동으로 채워줍니다.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">제품명</label>
                  <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="예: 코스틱 랩탑 파우치" className="input-field" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">제품 설명</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="제품에 대한 설명을 입력하세요" rows={3} className="input-field resize-none" />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">이미지 URL</label>
                  <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    placeholder="https://images.pexels.com/..." className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">정상가 (원)</label>
                  <input required type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })}
                    placeholder="89000" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">공동구매가 (원)</label>
                  <input required type="number" value={form.group_price} onChange={(e) => setForm({ ...form, group_price: e.target.value })}
                    placeholder="69000" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">목표 인원</label>
                  <input required type="number" min="1" value={form.target_count} onChange={(e) => setForm({ ...form, target_count: e.target.value })}
                    placeholder="20" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">마감일시</label>
                  <input required type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                    className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">입금 계좌 (선택)</label>
                  <input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })}
                    placeholder="국민은행 123-456-789" className="input-field" />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-400">예금주 (선택)</label>
                  <input value={form.bank_holder} onChange={(e) => setForm({ ...form, bank_holder: e.target.value })}
                    placeholder="홍길동" className="input-field" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">
                  {busy ? '저장 중...' : editTarget ? '수정하기' : '등록하기'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-5 py-2.5 text-sm">
                  취소
                </button>
              </div>
            </form>
          )}

          {/* Group buy list */}
          <div className="space-y-3">
            {groupBuys.map((gb) => (
              <div key={gb.id} className="card-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {gb.image_url ? (
                      <img src={gb.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="grid h-12 w-12 place-items-center rounded-lg bg-navy-800">
                        <Package className="h-5 w-5 text-slate-600" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-gothic text-base font-semibold text-slate-100">{gb.title}</h3>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {gb.current_count}/{gb.target_count}명</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(gb.deadline)}</span>
                        <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {formatKRW(gb.group_price)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GBStatusBadge status={gb.status} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                  {gb.status === 'recruiting' && (
                    <>
                      <button onClick={() => handleSetStatus(gb, 'succeeded')} className="btn-primary px-3 py-1.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> 성공 처리
                      </button>
                      <button onClick={() => handleSetStatus(gb, 'failed')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400">
                        <XCircle className="h-3.5 w-3.5" /> 실패 처리
                      </button>
                    </>
                  )}
                  {gb.status === 'succeeded' && (
                    <button onClick={() => handleSetStatus(gb, 'cancelled')} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400">
                      <XCircle className="h-3.5 w-3.5" /> 취소
                    </button>
                  )}
                  {gb.status === 'failed' && (
                    <button onClick={() => handleSetStatus(gb, 'recruiting')} className="btn-ghost px-3 py-1.5 text-xs">
                      <Clock className="h-3.5 w-3.5" /> 모집 재개
                    </button>
                  )}
                  <button onClick={() => openEdit(gb)} className="btn-ghost px-3 py-1.5 text-xs">
                    <Edit2 className="h-3.5 w-3.5" /> 수정
                  </button>
                  <button onClick={() => handleDelete(gb)} className="btn-ghost px-3 py-1.5 text-xs hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" /> 삭제
                  </button>
                </div>
              </div>
            ))}
            {groupBuys.length === 0 && (
              <div className="card-surface grid place-items-center py-16 text-center">
                <Package className="mb-3 h-10 w-10 text-slate-700" />
                <p className="text-sm text-slate-500">등록된 공동구매가 없습니다.</p>
                <button onClick={openCreate} className="btn-primary mt-4 px-4 py-2 text-sm">
                  <Plus className="h-4 w-4" /> 첫 공동구매 등록
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Participants management */}
      {tab === 'participants' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-100">참여자 관리</h2>

          {participants.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">참여자가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {participants.map((p) => {
                const gb = groupBuys.find((g) => g.id === p.group_buy_id);
                const user = profiles.find((u) => u.id === p.user_id);
                const isSucceeded = gb?.status === 'succeeded';

                return (
                  <div key={p.id} className="card-surface p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-cyan-sheen text-sm font-bold text-navy-950">
                          {user?.full_name?.slice(0, 1) ?? '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-100">{user?.full_name ?? '알 수 없음'}</div>
                          <div className="text-xs text-slate-500">{user?.email}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {gb?.title} · {formatKRW(gb?.group_price ?? 0)}
                          </div>
                        </div>
                      </div>
                      <ParticipantStatusChip status={p.status} />
                    </div>

                    {/* Address info */}
                    {p.address && (
                      <div className="mt-3 rounded-lg border border-navy-700 bg-navy-950/40 p-3 text-sm">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" /> 배송지
                        </div>
                        <div className="mt-1 text-slate-300">
                          {p.recipient_name} · {p.recipient_phone}
                        </div>
                        <div className="text-slate-400">
                          {p.address} {p.address_detail}
                        </div>
                      </div>
                    )}

                    {/* Bank account info for succeeded group buys */}
                    {isSucceeded && gb?.bank_account && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Building2 className="h-3 w-3 text-gold" />
                        입금계좌: {gb.bank_account} ({gb.bank_holder})
                      </div>
                    )}

                    {/* Admin actions */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-700 pt-3">
                      {p.status === 'address_submitted' && (
                        <button onClick={() => handleConfirmDeposit(p)} className="btn-primary px-3 py-1.5 text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" /> 입금 확인
                        </button>
                      )}
                      {p.status === 'deposited' && (
                        <button onClick={() => handleMarkShipped(p)} className="btn-primary px-3 py-1.5 text-xs">
                          <Truck className="h-3.5 w-3.5" /> 배송 완료 처리
                        </button>
                      )}
                      <span className="ml-auto text-xs text-slate-600">
                        참여일: {formatDateTime(p.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Members management */}
      {tab === 'members' && (
        <div className="space-y-4">
          <h2 className="font-gothic text-lg font-semibold text-slate-100">회원 관리</h2>

          {profiles.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-slate-700" />
              <p className="text-sm text-slate-500">가입한 회원이 없습니다.</p>
            </div>
          ) : (
            <div className="card-surface overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">회원</th>
                    <th className="px-5 py-3 font-medium">가입일</th>
                    <th className="px-5 py-3 font-medium">역할</th>
                    <th className="px-5 py-3 font-medium text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-700">
                  {profiles.map((p) => (
                    <tr key={p.id} className="transition hover:bg-navy-800/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold text-navy-950 ${p.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
                            {p.full_name.slice(0, 1)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-100">{p.full_name}</div>
                            <div className="text-xs text-slate-500">{p.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-400">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3">
                        {p.role === 'admin' ? (
                          <span className="chip border-gold/40 text-gold-light">ADMIN</span>
                        ) : (
                          <span className="chip">MEMBER</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleRole(p)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-gold hover:text-gold"
                            title={p.role === 'admin' ? '정회원으로 강등' : '관리자로 승격'}
                          >
                            {p.role === 'admin' ? <UserIcon className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                          {p.id !== profile.id && (
                            <button
                              onClick={() => handleDeleteProfile(p)}
                              className="grid h-7 w-7 place-items-center rounded-md border border-navy-700 text-slate-400 hover:border-red-500 hover:text-red-400"
                              title="회원 삭제"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, sub }: { icon: any; label: string; value: string; accent: 'cyan' | 'gold'; sub?: string }) {
  const color = accent === 'cyan' ? 'text-cyan' : 'text-gold';
  const bg = accent === 'cyan' ? 'bg-cyan/10' : 'bg-gold/10';
  return (
    <div className="card-surface p-4">
      <div className={`mb-2 inline-grid h-9 w-9 place-items-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div className="font-gothic text-xl font-bold text-slate-100">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
      {sub && <div className="mt-0.5 text-[10px] text-slate-600">{sub}</div>}
    </div>
  );
}

function GBStatusBadge({ status }: { status: GroupBuyStatus }) {
  const config: Record<GroupBuyStatus, { label: string; className: string }> = {
    recruiting: { label: '모집 중', className: 'border-cyan/40 text-cyan bg-cyan/5' },
    succeeded: { label: '성공', className: 'border-green-500/40 text-green-400 bg-green-500/5' },
    failed: { label: '실패', className: 'border-red-500/40 text-red-400 bg-red-500/5' },
    cancelled: { label: '취소됨', className: 'border-slate-600 text-slate-500 bg-slate-700/20' },
  };
  const c = config[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${c.className}`}>{c.label}</span>;
}

function ParticipantStatusChip({ status }: { status: ParticipantStatus }) {
  const config: Record<ParticipantStatus, { label: string; className: string }> = {
    joined: { label: '참여 중', className: 'border-cyan/40 text-cyan' },
    deposited: { label: '입금 확인', className: 'border-green-500/40 text-green-400' },
    address_submitted: { label: '배송지 제출', className: 'border-gold/40 text-gold-light' },
    shipped: { label: '배송 완료', className: 'border-green-500/40 text-green-400' },
    cancelled: { label: '취소됨', className: 'border-slate-600 text-slate-500' },
  };
  const c = config[status];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${c.className}`}>{c.label}</span>;
}
