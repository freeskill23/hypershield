import { useState } from 'react';
import {
  ArrowLeft, Users, Clock, TrendingDown, CheckCircle2, XCircle, Tag,
  Calendar, Building2, MapPin, Phone, User, Banknote, AlertCircle,
} from 'lucide-react';
import { GroupBuy, Participant } from '../lib/types';
import { formatKRW, formatDate, formatDateTime, getTimeRemaining } from '../lib/format';
import { joinGroupBuy, cancelParticipation, submitAddress } from '../lib/data';

interface Props {
  groupBuy: GroupBuy | null;
  myParticipation: Participant | null;
  onBack: () => void;
  onRefresh: () => void;
  currentUserId: string;
}

export default function GroupBuyDetail({
  groupBuy,
  myParticipation,
  onBack,
  onRefresh,
  currentUserId,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [addressForm, setAddressForm] = useState({
    recipient_name: '',
    recipient_phone: '',
    address: '',
    address_detail: '',
  });
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!groupBuy) {
    return (
      <div className="card-surface grid place-items-center py-20 text-center">
        <AlertCircle className="mb-3 h-10 w-10 text-slate-600" />
        <p className="text-sm text-slate-400">공동구매 정보를 찾을 수 없습니다.</p>
        <button onClick={onBack} className="btn-ghost mt-4 px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </button>
      </div>
    );
  }

  const remaining = getTimeRemaining(groupBuy.deadline);
  const isEnded = groupBuy.status !== 'recruiting';
  const isSucceeded = groupBuy.status === 'succeeded';
  const isFailed = groupBuy.status === 'failed' || groupBuy.status === 'cancelled';
  const hasJoined = !!myParticipation && myParticipation.status !== 'cancelled';
  const discount = groupBuy.original_price > 0
    ? Math.round((1 - groupBuy.group_price / groupBuy.original_price) * 100)
    : 0;

  async function handleJoin() {
    if (!groupBuy) return;
    setBusy(true);
    try {
      const result = await joinGroupBuy(groupBuy.id);
      if (result) {
        setMessage('공동구매에 참여했습니다!');
        onRefresh();
      } else {
        setMessage('참여 중 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!myParticipation) return;
    if (!confirm('참여를 취소하시겠습니까?')) return;
    setBusy(true);
    try {
      await cancelParticipation(myParticipation.id);
      setMessage('참여가 취소되었습니다.');
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!myParticipation) return;
    setBusy(true);
    try {
      await submitAddress(myParticipation.id, addressForm);
      setMessage('배송지가 등록되었습니다.');
      setShowAddressForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
        <ArrowLeft className="h-4 w-4" /> 목록으로
      </button>

      {message && (
        <div className="flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: Image + info */}
        <div className="space-y-4">
          <div className="card-surface overflow-hidden">
            <div className="relative h-72 w-full overflow-hidden bg-navy-900">
              {groupBuy.image_url ? (
                <img src={groupBuy.image_url} alt={groupBuy.title} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <Tag className="h-12 w-12 text-slate-700" />
                </div>
              )}
              {discount > 0 && (
                <div className="absolute right-4 top-4 rounded-lg bg-red-500/90 px-3 py-1.5 text-base font-bold text-white">
                  {discount}% 할인
                </div>
              )}
            </div>
          </div>

          {/* Price comparison */}
          <div className="card-surface p-5">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <TrendingDown className="h-4 w-4 text-cyan" /> 가격 비교
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-navy-700 bg-navy-950/40 p-4">
                <div className="text-xs text-slate-500">정상가</div>
                <div className="mt-1 font-gothic text-lg font-semibold text-slate-400 line-through">
                  {formatKRW(groupBuy.original_price)}
                </div>
              </div>
              <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-4">
                <div className="text-xs text-cyan">공동구매가</div>
                <div className="mt-1 font-gothic text-lg font-bold text-cyan">
                  {formatKRW(groupBuy.group_price)}
                </div>
              </div>
            </div>
            {discount > 0 && (
              <div className="mt-3 text-center text-sm text-slate-400">
                <span className="font-bold text-red-400">{discount}%</span> 절약 ·
                인당 <span className="font-bold text-cyan">{formatKRW(groupBuy.original_price - groupBuy.group_price)}</span> 할인
              </div>
            )}
          </div>
        </div>

        {/* Right: Details + actions */}
        <div className="space-y-4">
          {/* Title + description */}
          <div className="card-surface p-5">
            <h1 className="font-gothic text-xl font-bold text-slate-100">{groupBuy.title}</h1>
            {groupBuy.description && (
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-400">
                {groupBuy.description}
              </p>
            )}
          </div>

          {/* Progress + deadline */}
          <div className="card-surface p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="h-3.5 w-3.5" /> 참여 인원
                </div>
                <div className="mt-1 font-gothic text-2xl font-bold text-slate-100">
                  {groupBuy.current_count}<span className="text-base text-slate-500">/{groupBuy.target_count}명</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar className="h-3.5 w-3.5" /> 마감일
                </div>
                <div className="mt-1 font-gothic text-base font-semibold text-slate-100">
                  {formatDate(groupBuy.deadline)}
                </div>
                <div className="text-xs text-slate-500">{formatDateTime(groupBuy.deadline)}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="mt-4">
              <div className="h-3 overflow-hidden rounded-full bg-navy-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan to-cyan-light transition-all duration-500"
                  style={{ width: `${Math.min(100, (groupBuy.current_count / groupBuy.target_count) * 100)}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between text-xs text-slate-500">
                <span>{Math.round((groupBuy.current_count / groupBuy.target_count) * 100)}% 달성</span>
                {!isEnded && remaining && <span className="font-mono text-gold">{remaining} 남음</span>}
              </div>
            </div>

            {/* Status */}
            <div className="mt-4">
              {isSucceeded && (
                <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400">
                  <CheckCircle2 className="h-5 w-5" /> 공동구매가 성공했습니다! 아래 계좌로 입금해 주세요.
                </div>
              )}
              {isFailed && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <XCircle className="h-5 w-5" /> 목표 인원에 도달하지 못해 공동구매가 실패했습니다.
                </div>
              )}
              {!isEnded && (
                <div className="flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan">
                  <Clock className="h-5 w-5" /> 모집 중입니다. 목표 인원 달성 시 공동구매가 진행됩니다.
                </div>
              )}
            </div>
          </div>

          {/* Bank account info (only if succeeded) */}
          {isSucceeded && groupBuy.bank_account && (
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Building2 className="h-4 w-4 text-gold" /> 입금 계좌 안내
              </div>
              <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-4">
                <div className="font-gothic text-lg font-bold text-gold-light">{groupBuy.bank_account}</div>
                {groupBuy.bank_holder && (
                  <div className="mt-1 text-sm text-slate-400">예금주: {groupBuy.bank_holder}</div>
                )}
                <div className="mt-3 border-t border-gold/20 pt-3 text-sm text-slate-300">
                  입금액: <span className="font-bold text-gold-light">{formatKRW(groupBuy.group_price)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-navy-950/40 p-3 text-xs text-slate-500">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div>
                  입금자명을 <strong className="text-slate-300">이름 + 참여한 공동구매명</strong>으로 입금해 주세요.
                  관리자가 입금 확인 후 배송을 진행합니다.
                </div>
              </div>
            </div>
          )}

          {/* Address form (if succeeded and joined) */}
          {isSucceeded && hasJoined && (
            <div className="card-surface p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <MapPin className="h-4 w-4 text-cyan" /> 배송지 정보
              </div>

              {myParticipation?.address && !showAddressForm ? (
                <div className="mt-3 space-y-1.5 rounded-lg border border-navy-700 bg-navy-950/40 p-4 text-sm">
                  <div className="text-slate-100">{myParticipation.recipient_name} · {myParticipation.recipient_phone}</div>
                  <div className="text-slate-400">{myParticipation.address}</div>
                  {myParticipation.address_detail && <div className="text-slate-400">{myParticipation.address_detail}</div>}
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {myParticipation.status === 'address_submitted' && (
                      <span className="text-cyan">배송지 제출 완료</span>
                    )}
                    {myParticipation.status === 'deposited' && (
                      <span className="text-green-400">입금 확인 완료</span>
                    )}
                    {myParticipation.status === 'shipped' && (
                      <span className="text-green-400">배송 완료</span>
                    )}
                    <button
                      onClick={() => {
                        setAddressForm({
                          recipient_name: myParticipation.recipient_name ?? '',
                          recipient_phone: myParticipation.recipient_phone ?? '',
                          address: myParticipation.address ?? '',
                          address_detail: myParticipation.address_detail ?? '',
                        });
                        setShowAddressForm(true);
                      }}
                      className="text-slate-500 underline hover:text-slate-300"
                    >
                      수정
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleAddressSubmit} className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">받는 분</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          required
                          value={addressForm.recipient_name}
                          onChange={(e) => setAddressForm({ ...addressForm, recipient_name: e.target.value })}
                          placeholder="홍길동"
                          className="input-field pl-9 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">연락처</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                        <input
                          required
                          value={addressForm.recipient_phone}
                          onChange={(e) => setAddressForm({ ...addressForm, recipient_phone: e.target.value })}
                          placeholder="010-0000-0000"
                          className="input-field pl-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">주소</label>
                    <input
                      required
                      value={addressForm.address}
                      onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                      placeholder="서울시 강남구 테헤란로 123"
                      className="input-field text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">상세 주소</label>
                    <input
                      value={addressForm.address_detail}
                      onChange={(e) => setAddressForm({ ...addressForm, address_detail: e.target.value })}
                      placeholder="101동 202호"
                      className="input-field text-sm"
                    />
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary w-full text-sm">
                    {busy ? '저장 중...' : '배송지 등록하기'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="card-surface p-5">
            {!isEnded && !hasJoined && (
              <button onClick={handleJoin} disabled={busy} className="btn-primary w-full">
                {busy ? '참여 중...' : <><Users className="h-4 w-4" /> 공동구매 참여하기</>}
              </button>
            )}
            {!isEnded && hasJoined && (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-3 text-sm text-cyan">
                  <CheckCircle2 className="h-4 w-4" /> 참여 완료! 목표 인원 달성을 기다리는 중...
                </div>
                <button onClick={handleCancel} disabled={busy} className="btn-ghost w-full text-sm hover:text-red-400">
                  참여 취소
                </button>
              </div>
            )}
            {isSucceeded && hasJoined && !myParticipation?.address && (
              <div className="flex items-center gap-2 rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
                <Banknote className="h-4 w-4" /> 위 계좌로 입금 후 배송지를 등록해 주세요.
              </div>
            )}
            {isFailed && (
              <div className="text-center text-sm text-slate-500">
                이 공동구매는 종료되었습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
