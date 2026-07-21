import { useMemo, useState } from 'react';
import { Users, UserPlus, Calendar, Crown, Search } from 'lucide-react';
import { Profile } from '../lib/types';
import { formatDate } from '../lib/format';

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

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
          <div className="mt-2 font-mono text-2xl font-bold text-gold-light">{me.my_referral_code}</div>
        </div>
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Users className="h-4 w-4 text-cyan" /> 클럽 전체 회원
          </div>
          <div className="mt-2 font-display text-3xl font-bold text-slate-100">{profiles.length}</div>
        </div>
      </div>

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
            {invited.length === 0 && (
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
                    <td className="px-5 py-3"><span className="font-mono text-xs text-cyan">{p.my_referral_code}</span></td>
                    <td className="px-5 py-3 text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
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
