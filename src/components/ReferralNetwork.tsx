import { useMemo, useState } from 'react';
import { UserPlus, Crown, Search, Users, Sparkles, Send, CheckCircle2, Clock, XCircle, MessageSquare } from 'lucide-react';
import { Profile, ReferralRequest } from '../lib/types';
import { formatDate } from '../lib/format';
import { useReferralRequests, submitReferralRequest } from '../lib/data';
import { useAuth } from '../lib/auth';

interface Props {
  profiles: Profile[];
  me: Profile;
}

export default function ReferralNetwork({ profiles, me }: Props) {
  const invited = useMemo(
    () => profiles.filter((p) => p.referred_by_code === me.my_referral_code),
    [profiles, me.my_referral_code],
  );
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return invited;
    const q = query.toLowerCase();
    return invited.filter(
      (p) => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
    );
  }, [invited, query]);

  const { requests, refresh } = useReferralRequests(me.id);
  const { refresh: refreshProfile } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCode = Boolean(me.my_referral_code);
  const pendingRequest = requests.find((r) => r.status === 'pending');

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await submitReferralRequest(me.id, reason.trim());
      if (result) {
        setReason('');
        refresh();
      } else {
        setError('신청 중 오류가 발생했습니다.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <UserPlus className="h-4 w-4 text-cyan" /> 내가 초대한 회원
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-cyan">{invited.length}</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Crown className="h-4 w-4 text-gold" /> 내 초대 코드
          </div>
          {hasCode ? (
            <>
              <div className="mt-2 font-mono text-2xl font-bold text-gold-light">{me.my_referral_code}</div>
              <div className="mt-1 text-xs text-slate-500">이 코드를 공유해 지인을 클럽에 초대하세요.</div>
            </>
          ) : (
            <div className="mt-2 text-sm text-slate-500">초대 코드 미발급</div>
          )}
        </div>
      </div>

      {/* Referral code request / status */}
      {!hasCode && (
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-100">
            <Sparkles className="h-4 w-4 text-gold" /> 초대 코드 신청
          </div>
          <p className="mt-2 text-sm text-slate-400">
            초대 코드는 관리자 승인 후 발급됩니다. 신청 사유를 작성해주세요.
          </p>

          {/* Pending request */}
          {pendingRequest ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-cyan/30 bg-cyan/5 px-3 py-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-100">승인 대기 중</div>
                <div className="mt-1 text-xs text-slate-400">
                  신청 사유: {pendingRequest.reason}
                </div>
                <div className="mt-1 text-xs text-slate-500">신청일: {formatDate(pendingRequest.created_at)}</div>
              </div>
            </div>
          ) : (
            /* Request form */
            requests.find((r) => r.status === 'rejected') ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-3">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-100">신청 반려</div>
                  <div className="mt-1 text-xs text-slate-400">
                    관리자가 반려한 신청입니다. 사유를 수정하여 재신청할 수 있습니다.
                  </div>
                </div>
              </div>
            ) : null
          )}

          {!pendingRequest && (
            <form onSubmit={handleSubmitRequest} className="mt-3 space-y-3">
              <div>
                <label className="mb-1 block text-xs text-slate-400">신청 사유</label>
                <textarea
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="초대 코드 발급 사유를 입력해주세요. (예: 지인 3명 이상 초대 예정)"
                  className="input-field resize-none"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button type="submit" disabled={busy} className="btn-gold">
                {busy ? '신청 중...' : <><Send className="h-4 w-4" /> 신청하기</>}
              </button>
            </form>
          )}

          {/* Approved notice */}
          {requests.find((r) => r.status === 'approved') && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div className="text-sm text-slate-100">
                초대 코드가 발급되었습니다: <span className="font-mono font-bold text-gold-light">{me.my_referral_code}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Request history (if any) */}
      {requests.length > 0 && hasCode && (
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 font-display text-base font-semibold text-slate-100">
            <MessageSquare className="h-4 w-4 text-slate-400" /> 신청 내역
          </div>
          <div className="mt-3 space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-start gap-3 rounded-lg border border-navy-700 bg-navy-800/40 p-3">
                {r.status === 'pending' && <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan" />}
                {r.status === 'approved' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />}
                {r.status === 'rejected' && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />}
                <div className="flex-1">
                  <div className="text-sm text-slate-200">{r.reason}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatDate(r.created_at)} · {r.status === 'pending' ? '대기 중' : r.status === 'approved' ? `승인됨 (${r.assigned_code})` : '반려됨'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List */}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-navy-700 px-5 py-4">
          <div className="flex items-center gap-2 font-display text-lg font-semibold text-slate-100">
            <Users className="h-5 w-5 text-cyan" /> 내 초대 현황
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="이름/이메일 검색"
              className="input-field w-48 pl-9 py-2 text-xs"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="grid place-items-center px-5 py-16 text-center text-slate-500">
            <div className="mb-3 rounded-full bg-navy-800 p-4">
              <Users className="h-8 w-8 text-slate-600" />
            </div>
            <p className="text-sm">
              {invited.length === 0
                ? '아직 내 초대 코드로 가입한 지인이 없습니다.'
                : '검색 결과가 없습니다.'}
            </p>
            {invited.length === 0 && hasCode && (
              <p className="mt-1 text-xs text-slate-600">
                내 코드 <span className="font-mono text-gold-light">{me.my_referral_code}</span>를 공유해보세요.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-navy-950/40 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">회원</th>
                  <th className="px-5 py-3 font-medium">이메일</th>
                  <th className="px-5 py-3 font-medium">초대 코드</th>
                  <th className="px-5 py-3 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-700">
                {filtered.map((p) => (
                  <tr key={p.id} className="transition hover:bg-navy-800/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-cyan-sheen text-xs font-bold text-navy-950">
                          {p.full_name.slice(0, 1)}
                        </div>
                        <span className="font-medium text-slate-100">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-400">{p.email}</td>
                    <td className="px-5 py-3"><span className="font-mono text-xs text-cyan">{p.my_referral_code ?? '미발급'}</span></td>
                    <td className="px-5 py-3 text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        {formatDate(p.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
