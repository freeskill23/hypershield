import { Users, Clock, TrendingDown, CheckCircle2, XCircle, Tag, Calendar } from 'lucide-react';
import { GroupBuy, Participant, GroupBuyStatus } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getTimeRemaining } from '../lib/format';

interface Props {
  groupBuys: GroupBuy[];
  participants: Participant[];
  myParticipations: Participant[];
  onSelectGroupBuy: (id: string) => void;
}

function StatusBadge({ status }: { status: GroupBuyStatus }) {
  const config: Record<GroupBuyStatus, { label: string; className: string; icon: any }> = {
    recruiting: {
      label: '모집 중',
      className: 'border-cyan/40 text-cyan bg-cyan/5',
      icon: Users,
    },
    succeeded: {
      label: '성공',
      className: 'border-green-500/40 text-green-400 bg-green-500/5',
      icon: CheckCircle2,
    },
    failed: {
      label: '실패',
      className: 'border-red-500/40 text-red-400 bg-red-500/5',
      icon: XCircle,
    },
    cancelled: {
      label: '취소됨',
      className: 'border-slate-600 text-slate-500 bg-slate-700/20',
      icon: XCircle,
    },
  };
  const c = config[status];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${c.className}`}>
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

function ProgressRing({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100));
  const color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#fbbf24' : '#38bdf8';
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r="28" fill="none" stroke="#27364d" strokeWidth="5" />
          <circle
            cx="32" cy="32" r="28" fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className="font-gothic text-sm font-bold" style={{ color }}>{pct}%</span>
        </div>
      </div>
      <div className="text-sm">
        <div className="font-medium text-slate-100">{current} / {target}명</div>
        <div className="text-xs text-slate-500">목표 인원</div>
      </div>
    </div>
  );
}

function GroupBuyCard({
  gb,
  participantCount,
  myParticipation,
  onClick,
}: {
  gb: GroupBuy;
  participantCount: number;
  myParticipation: Participant | null;
  onClick: () => void;
}) {
  const remaining = getTimeRemaining(gb.deadline);
  const isEnded = gb.status !== 'recruiting';
  const discount = gb.original_price > 0
    ? Math.round((1 - gb.group_price / gb.original_price) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      className="card-surface group block w-full overflow-hidden text-left transition hover:border-cyan/40 hover:shadow-card-lg"
    >
      {/* Image */}
      <div className="relative h-48 w-full overflow-hidden bg-navy-900">
        {gb.image_url ? (
          <img
            src={gb.image_url}
            alt={gb.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Tag className="h-10 w-10 text-slate-700" />
          </div>
        )}
        <div className="absolute left-3 top-3">
          <StatusBadge status={gb.status} />
        </div>
        {myParticipation && (
          <div className="absolute right-3 top-3 rounded-full bg-cyan px-2.5 py-1 text-xs font-bold text-navy-950">
            참여함
          </div>
        )}
        {discount > 0 && (
          <div className="absolute bottom-3 right-3 rounded-lg bg-red-500/90 px-2.5 py-1 text-sm font-bold text-white">
            {discount}% 할인
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="font-gothic text-base font-semibold text-slate-100 transition group-hover:text-cyan">
          {gb.title}
        </h3>
        {gb.description && (
          <p className="mt-1.5 line-clamp-2 text-sm text-slate-400">{gb.description}</p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <ProgressRing current={participantCount || gb.current_count} target={gb.target_count} />
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-navy-700 pt-4">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-gothic text-xl font-bold text-cyan">{formatKRW(gb.group_price)}</span>
              {gb.original_price > gb.group_price && (
                <span className="text-sm text-slate-500 line-through">{formatKRW(gb.original_price)}</span>
              )}
            </div>
            <div className="text-xs text-slate-500">공동구매가</div>
          </div>
          <div className="text-right">
            {!isEnded && remaining ? (
              <div className="flex items-center gap-1.5 text-sm text-gold">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-mono font-medium">{remaining}</span>
              </div>
            ) : isEnded && gb.status === 'succeeded' ? (
              <div className="text-xs text-green-400">공동구매 성공!</div>
            ) : isEnded && gb.status === 'failed' ? (
              <div className="text-xs text-red-400">목표 인원 미달</div>
            ) : null}
            <div className="mt-0.5 text-xs text-slate-500">
              <Calendar className="mr-1 inline h-3 w-3" />
              {formatDate(gb.deadline)} 마감
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function GroupBuyList({
  groupBuys,
  participants,
  myParticipations,
  onSelectGroupBuy,
}: Props) {
  const activeGroupBuys = groupBuys.filter((g) => g.status === 'recruiting');
  const endedGroupBuys = groupBuys
    .filter((g) => g.status === 'succeeded' || g.status === 'failed' || g.status === 'cancelled')
    .sort((a, b) => new Date(b.deadline).getTime() - new Date(a.deadline).getTime());

  const getParticipantCount = (gbId: string) =>
    participants.filter((p) => p.group_buy_id === gbId && p.status !== 'cancelled').length;

  const getMyParticipation = (gbId: string) =>
    myParticipations.find((p) => p.group_buy_id === gbId && p.status !== 'cancelled') ?? null;

  return (
    <div className="space-y-8">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-xl border border-navy-700 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-1/3 h-40 w-40 rounded-full bg-gold/5 blur-3xl" />
        <div className="relative">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-3 py-1 text-xs font-medium text-cyan">
            <TrendingDown className="h-3.5 w-3.5" />
            공동구매 베타 서비스
          </div>
          <h1 className="font-gothic text-2xl font-bold text-slate-100">진행 중인 공동구매</h1>
          <p className="mt-2 text-sm text-slate-400">
            목표 인원이 모이면 공동구매 가격으로 구매할 수 있습니다. 마감 기한 전에 참여하세요.
          </p>
        </div>
      </div>

      {/* Active group buys */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <h2 className="font-gothic text-lg font-semibold text-slate-100">모집 중</h2>
          <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">
            {activeGroupBuys.length}개
          </span>
        </div>

        {activeGroupBuys.length === 0 ? (
          <div className="card-surface grid place-items-center py-16 text-center">
            <Users className="mb-3 h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-500">현재 모집 중인 공동구매가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {activeGroupBuys.map((gb) => (
              <GroupBuyCard
                key={gb.id}
                gb={gb}
                participantCount={getParticipantCount(gb.id)}
                myParticipation={getMyParticipation(gb.id)}
                onClick={() => onSelectGroupBuy(gb.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Ended group buys — results */}
      {endedGroupBuys.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-2">
            <h2 className="font-gothic text-lg font-semibold text-slate-100">공동구매 결과</h2>
            <span className="rounded-full bg-navy-800 px-2 py-0.5 text-xs font-medium text-slate-400">
              {endedGroupBuys.length}개
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {endedGroupBuys.map((gb) => (
              <GroupBuyCard
                key={gb.id}
                gb={gb}
                participantCount={getParticipantCount(gb.id)}
                myParticipation={getMyParticipation(gb.id)}
                onClick={() => onSelectGroupBuy(gb.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
