import { useState } from 'react';
import {
  User, Mail, Calendar, Package, CheckCircle2, Clock, XCircle,
  MapPin, Banknote, Truck, Phone,
} from 'lucide-react';
import { Profile, GroupBuy, Participant, ParticipantStatus } from '../lib/types';
import { formatKRW, formatDate, formatDateTime } from '../lib/format';
import { submitAddress } from '../lib/data';

interface Props {
  profile: Profile;
  myParticipations: Participant[];
  groupBuys: GroupBuy[];
  onRefresh: () => void;
}

function StatusChip({ status }: { status: ParticipantStatus }) {
  const config: Record<ParticipantStatus, { label: string; className: string; icon: any }> = {
    joined: { label: '참여 중', className: 'border-cyan/40 text-cyan', icon: Clock },
    deposited: { label: '입금 확인', className: 'border-green-500/40 text-green-400', icon: CheckCircle2 },
    address_submitted: { label: '배송지 제출', className: 'border-cyan/40 text-cyan', icon: MapPin },
    shipped: { label: '배송 완료', className: 'border-green-500/40 text-green-400', icon: Truck },
    cancelled: { label: '취소됨', className: 'border-slate-600 text-slate-500', icon: XCircle },
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

function AddressEditor({
  participation,
  onSave,
}: {
  participation: Participant;
  onSave: (id: string, data: { recipient_name: string; recipient_phone: string; address: string; address_detail: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    recipient_name: participation.recipient_name ?? '',
    recipient_phone: participation.recipient_phone ?? '',
    address: participation.address ?? '',
    address_detail: participation.address_detail ?? '',
  });

  if (!editing && participation.address) {
    return (
      <div className="mt-2 rounded-lg border border-navy-700 bg-navy-950/40 p-3 text-sm">
        <div className="text-slate-100">{participation.recipient_name} · {participation.recipient_phone}</div>
        <div className="text-slate-400">{participation.address} {participation.address_detail}</div>
        <button
          onClick={() => setEditing(true)}
          className="mt-2 text-xs text-slate-500 underline hover:text-slate-300"
        >
          수정
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave(participation.id, form);
        setBusy(false);
        setEditing(false);
      }}
      className="mt-2 space-y-2"
    >
      <div className="grid grid-cols-2 gap-2">
        <input
          required
          placeholder="받는 분"
          value={form.recipient_name}
          onChange={(e) => setForm({ ...form, recipient_name: e.target.value })}
          className="input-field text-sm"
        />
        <input
          required
          placeholder="연락처"
          value={form.recipient_phone}
          onChange={(e) => setForm({ ...form, recipient_phone: e.target.value })}
          className="input-field text-sm"
        />
      </div>
      <input
        required
        placeholder="주소"
        value={form.address}
        onChange={(e) => setForm({ ...form, address: e.target.value })}
        className="input-field text-sm"
      />
      <input
        placeholder="상세 주소"
        value={form.address_detail}
        onChange={(e) => setForm({ ...form, address_detail: e.target.value })}
        className="input-field text-sm"
      />
      <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-xs">
        {busy ? '저장 중...' : '배송지 저장'}
      </button>
    </form>
  );
}

export default function MyPage({ profile, myParticipations, groupBuys, onRefresh }: Props) {
  const [busy, setBusy] = useState(false);

  const handleSaveAddress = async (
    id: string,
    data: { recipient_name: string; recipient_phone: string; address: string; address_detail: string },
  ) => {
    setBusy(true);
    await submitAddress(id, data);
    setBusy(false);
    onRefresh();
  };

  const activeParticipations = myParticipations.filter((p) => p.status !== 'cancelled');
  const cancelledParticipations = myParticipations.filter((p) => p.status === 'cancelled');

  const getGroupBuy = (id: string) => groupBuys.find((g) => g.id === id);

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <div className="card-surface p-6">
        <div className="flex items-center gap-4">
          <div className={`grid h-16 w-16 place-items-center rounded-full text-xl font-bold text-navy-950 ${profile.role === 'admin' ? 'bg-gold-sheen' : 'bg-cyan-sheen'}`}>
            {profile.full_name.slice(0, 1)}
          </div>
          <div>
            <h1 className="font-gothic text-xl font-bold text-slate-100">{profile.full_name}</h1>
            <div className="mt-1 flex items-center gap-4 text-sm text-slate-400">
              <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {profile.email}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> {formatDate(profile.created_at)} 가입</span>
            </div>
          </div>
        </div>
      </div>

      {/* My participations */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-cyan" />
          <h2 className="font-gothic text-lg font-semibold text-slate-100">내 공동구매 참여 현황</h2>
          <span className="rounded-full bg-cyan/10 px-2 py-0.5 text-xs font-medium text-cyan">
            {activeParticipations.length}건
          </span>
        </div>

        {activeParticipations.length === 0 ? (
          <div className="card-surface grid place-items-center py-16 text-center">
            <Package className="mb-3 h-10 w-10 text-slate-700" />
            <p className="text-sm text-slate-500">참여한 공동구매가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeParticipations.map((p) => {
              const gb = getGroupBuy(p.group_buy_id);
              if (!gb) return null;
              const isSucceeded = gb.status === 'succeeded';

              return (
                <div key={p.id} className="card-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      {gb.image_url ? (
                        <img src={gb.image_url} alt={gb.title} className="h-16 w-16 rounded-lg object-cover" />
                      ) : (
                        <div className="grid h-16 w-16 place-items-center rounded-lg bg-navy-800">
                          <Package className="h-6 w-6 text-slate-600" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-gothic text-base font-semibold text-slate-100">{gb.title}</h3>
                        <div className="mt-1 text-sm text-slate-400">
                          공동구매가 <span className="font-medium text-cyan">{formatKRW(gb.group_price)}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          참여일: {formatDateTime(p.created_at)}
                        </div>
                      </div>
                    </div>
                    <StatusChip status={p.status} />
                  </div>

                  {/* Bank info for succeeded group buys */}
                  {isSucceeded && gb.bank_account && (
                    <div className="mt-3 rounded-lg border border-gold/30 bg-gold/5 p-3">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Banknote className="h-4 w-4 text-gold" />
                        <span>입금 계좌: <strong className="text-gold-light">{gb.bank_account}</strong></span>
                        {gb.bank_holder && <span className="text-slate-500">({gb.bank_holder})</span>}
                      </div>
                      <div className="mt-1 text-sm text-slate-400">
                        입금액: <span className="font-bold text-gold-light">{formatKRW(gb.group_price)}</span>
                      </div>
                      <div className="mt-2 flex items-start gap-2 text-xs text-slate-500">
                        <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>입금자명을 '이름 + 공동구매명'으로 입금해 주세요. 관리자 확인 후 배송이 진행됩니다.</span>
                      </div>
                    </div>
                  )}

                  {/* Address editor for succeeded group buys */}
                  {isSucceeded && (
                    <div className="mt-3 border-t border-navy-700 pt-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-300">
                        <MapPin className="h-4 w-4 text-cyan" /> 배송지
                      </div>
                      <AddressEditor participation={p} onSave={handleSaveAddress} />
                    </div>
                  )}

                  {/* Deposit status */}
                  {p.status === 'deposited' && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                      <CheckCircle2 className="h-4 w-4" /> 입금이 확인되었습니다. 배송 준비 중입니다.
                    </div>
                  )}
                  {p.status === 'shipped' && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-400">
                      <Truck className="h-4 w-4" /> 배송이 완료되었습니다.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Cancelled */}
      {cancelledParticipations.length > 0 && (
        <section>
          <h3 className="mb-3 font-gothic text-sm font-medium text-slate-500">취소한 공동구매</h3>
          <div className="space-y-2">
            {cancelledParticipations.map((p) => {
              const gb = getGroupBuy(p.group_buy_id);
              if (!gb) return null;
              return (
                <div key={p.id} className="card-surface flex items-center justify-between p-4 opacity-60">
                  <span className="text-sm text-slate-400">{gb.title}</span>
                  <StatusChip status={p.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
