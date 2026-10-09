import { useState } from 'react';
import {
  Gift, Plus, ArrowLeft, Clock, CheckCircle2, XCircle, Truck, Package,
  X, AlertCircle, ExternalLink, MapPin, Phone, User, Home,
} from 'lucide-react';
import { TrialApplication, Product } from '../lib/types';
import { formatDate, formatDateTime, getRemainingDays, formatPhoneNumber } from '../lib/format';
import { createTrialApplication, submitTrialReviewUrl } from '../lib/data';
import AddressSearchButton from './AddressSearchButton';

interface Props {
  trials: TrialApplication[];
  products: Product[];
  userId: string;
  onRefresh: () => void;
}

const statusConfig: Record<string, { label: string; cls: string; icon: any }> = {
  pending: { label: '심사 중', cls: 'border-gold/40 text-gold-light bg-gold/5', icon: Clock },
  approved: { label: '승인됨', cls: 'border-cyan/40 text-cyan bg-cyan/5', icon: CheckCircle2 },
  rejected: { label: '거절됨', cls: 'border-red-500/40 text-red-400 bg-red-500/5', icon: XCircle },
  shipped: { label: '발송 완료', cls: 'border-cyan/40 text-cyan bg-cyan/5', icon: Truck },
  completed: { label: '체험 완료', cls: 'border-green-500/40 text-green-400 bg-green-500/5', icon: CheckCircle2 },
};

export default function MyTrials({ trials, products, userId, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // form state
  const [productId, setProductId] = useState('');
  const [reason, setReason] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [reviewPlatform, setReviewPlatform] = useState('');
  const [agreed, setAgreed] = useState(false);

  // review url submission
  const [reviewUrlInput, setReviewUrlInput] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);

  const selected = trials.find((t) => t.id === selectedId);
  const productMap = new Map(products.map((p) => [p.id, p]));
  const usedProductIds = new Set(trials.map((t) => t.product_id));
  const availableProducts = products.filter((p) => p.is_active && p.is_trial_available && !usedProductIds.has(p.id));
  const completedCount = trials.filter((t) => t.status === 'completed').length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId || !reason.trim() || !name.trim() || !phone.trim() || !address.trim() || !reviewPlatform.trim() || !agreed) {
      alert('모든 항목을 입력하고 약관에 동의해주세요.');
      return;
    }
    setBusy(true);
    try {
      const result = await createTrialApplication({
        product_id: productId,
        reason: reason.trim(),
        recipient_name: name.trim(),
        recipient_phone: phone.trim(),
        address: address.trim(),
        address_detail: addressDetail.trim(),
        review_platform: reviewPlatform.trim(),
      });
      if (result.ok) {
        setShowForm(false);
        setProductId(''); setReason(''); setName(''); setPhone(''); setAddress(''); setAddressDetail(''); setReviewPlatform(''); setAgreed(false);
        onRefresh();
      } else {
        alert(result.error || '신청에 실패했습니다.');
      }
    } finally { setBusy(false); }
  }

  async function handleSubmitReviewUrl() {
    if (!selected || !reviewUrlInput.trim()) return;
    setUrlBusy(true);
    try {
      const result = await submitTrialReviewUrl(selected.id, reviewUrlInput.trim());
      if (result.ok) {
        setReviewUrlInput('');
        onRefresh();
      } else {
        alert(result.error || '리뷰 URL 제출에 실패했습니다.');
      }
    } finally { setUrlBusy(false); }
  }

  // ── Detail view ──
  if (selected) {
    const product = selected.product_id ? productMap.get(selected.product_id) : null;
    const sc = statusConfig[selected.status] ?? statusConfig.pending;
    const remainingDays = selected.shipped_at ? getRemainingDays(
      new Date(new Date(selected.shipped_at).getTime() + 30 * 86400000).toISOString(),
    ) : null;

    return (
      <div className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="btn-ghost px-4 py-2 text-sm">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </button>

        <div className="card-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${sc.cls}`}>
                  <sc.icon className="h-3 w-3" /> {sc.label}
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(selected.created_at)}</span>
              </div>
              <h2 className="mt-3 font-gothic text-lg font-bold text-slate-800">
                {product?.name ?? '상품 정보 없음'}
              </h2>
              {product?.image_url && (
                <img src={product.image_url} alt={product.name} className="mt-3 h-32 w-32 rounded-lg object-cover" />
              )}
            </div>
          </div>

          {/* Application info */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-navy-700 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><User className="h-3.5 w-3.5" /> 성함</div>
              <div className="text-sm text-slate-800">{selected.recipient_name}</div>
            </div>
            <div className="rounded-lg border border-navy-700 bg-slate-50 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Phone className="h-3.5 w-3.5" /> 연락처</div>
              <div className="text-sm text-slate-800">{selected.recipient_phone}</div>
            </div>
            <div className="rounded-lg border border-navy-700 bg-slate-50 p-3 sm:col-span-2">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><MapPin className="h-3.5 w-3.5" /> 주소</div>
              <div className="text-sm text-slate-800">{selected.address} {selected.address_detail}</div>
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-navy-700 bg-slate-50 p-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">신청 이유</div>
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{selected.reason}</div>
          </div>

          <div className="mt-3 rounded-lg border border-navy-700 bg-slate-50 p-3">
            <div className="mb-1 text-xs font-semibold text-slate-500">리뷰 작성 예정 플랫폼</div>
            <div className="text-sm text-slate-700">{selected.review_platform}</div>
          </div>

          {/* Reject reason */}
          {selected.status === 'rejected' && selected.reject_reason && (
            <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-red-400">
                <XCircle className="h-4 w-4" /> 거절 사유
              </div>
              <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{selected.reject_reason}</div>
            </div>
          )}

          {/* Shipping timeline */}
          {selected.shipped_at && (
            <div className="mt-4 rounded-lg border border-cyan/30 bg-cyan/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan">
                <Truck className="h-4 w-4" /> 발송 완료
                <span className="ml-auto font-normal text-slate-500">{formatDate(selected.shipped_at)}</span>
              </div>
              {remainingDays !== null && remainingDays > 0 && (
                <div className="text-sm text-slate-700">
                  리뷰 작성 기한: <span className="font-semibold text-cyan">남은 {remainingDays}일</span> (발송일로부터 30일 이내)
                </div>
              )}
              {remainingDays !== null && remainingDays <= 0 && selected.status !== 'completed' && (
                <div className="flex items-center gap-1.5 text-sm text-red-400">
                  <AlertCircle className="h-4 w-4" /> 리뷰 작성 기한이 지났습니다. 추가 체험단 진행이 제한될 수 있습니다.
                </div>
              )}
            </div>
          )}

          {/* Review URL submission / display */}
          {selected.status === 'shipped' && (
            <div className="mt-4 space-y-3">
              {selected.review_url ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4">
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-green-400">
                    <CheckCircle2 className="h-4 w-4" /> 제출된 리뷰 URL
                    <span className="ml-auto font-normal text-slate-500">{formatDateTime(selected.review_url_submitted_at ?? selected.updated_at)}</span>
                  </div>
                  <a href={selected.review_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-cyan hover:underline break-all">
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {selected.review_url}
                  </a>
                </div>
              ) : (
                <div className="rounded-lg border border-navy-700 bg-slate-50 p-4 space-y-2">
                  <div className="text-xs font-semibold text-slate-500">체험 후기 URL 제출</div>
                  <p className="text-xs text-slate-400">작성하신 체험 후기의 URL을 입력해주세요.</p>
                  <div className="flex gap-2">
                    <input
                      value={reviewUrlInput}
                      onChange={(e) => setReviewUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="input-field flex-1 text-sm"
                    />
                    <button
                      onClick={handleSubmitReviewUrl}
                      disabled={urlBusy || !reviewUrlInput.trim()}
                      className="btn-primary px-4 py-2 text-sm whitespace-nowrap"
                    >
                      {urlBusy ? '제출 중...' : 'URL 제출'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completed */}
          {selected.status === 'completed' && (
            <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-green-400">
                <CheckCircle2 className="h-4 w-4" /> 체험 완료
                <span className="ml-auto font-normal text-slate-500">{formatDate(selected.completed_at ?? selected.updated_at)}</span>
              </div>
              {selected.review_url && (
                <a href={selected.review_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-cyan hover:underline break-all">
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" /> {selected.review_url}
                </a>
              )}
              {selected.admin_comment && (
                <div className="mt-2 rounded-lg border border-navy-700 bg-slate-50 p-3">
                  <div className="mb-1 text-xs font-semibold text-slate-500">관리자 코멘트</div>
                  <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{selected.admin_comment}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Application form ──
  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">체험단 신청</h2>
          <button onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm">
            <X className="h-4 w-4" /> 취소
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card-surface space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">체험 상품 선택</label>
            <select
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="input-field text-sm"
            >
              <option value="">상품을 선택하세요</option>
              {availableProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {availableProducts.length === 0 && (
              <p className="mt-1 text-xs text-slate-400">신청 가능한 상품이 없습니다. (이미 신청한 상품은 중복 신청할 수 없습니다.)</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">체험단 신청 이유</label>
            <textarea
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="이 상품을 체험하고 싶은 이유를 작성해주세요."
              rows={4}
              className="input-field text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-500">받는 분</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  type="tel"
                  inputMode="numeric"
                  maxLength={13}
                  value={phone}
                  onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                  placeholder="010-0000-0000"
                  className="input-field pl-9 text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-500">주소</label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Home className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  required
                  readOnly
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="도로명 주소 검색 버튼을 눌러주세요"
                  className="input-field min-h-12 cursor-not-allowed bg-slate-50 pl-9 text-sm"
                />
              </div>
              <AddressSearchButton onSelect={(addr) => setAddress(addr)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-500">상세 주소</label>
            <input value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="101동 202호" className="input-field text-sm" />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">체험 후기 작성 예정 플랫폼 / 주소</label>
            <input
              required
              value={reviewPlatform}
              onChange={(e) => setReviewPlatform(e.target.value)}
              placeholder="예: 네이버 블로그, 인스타그램, YouTube, 디테일링포럼, 퍼펙트샤인, 자동차 동호회 등"
              className="input-field text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">한 달 안에 체험 후기를 작성할 플랫폼을 입력해주세요.</p>
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-navy-700 bg-slate-50 p-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-navy-700"
            />
            <span className="leading-relaxed">
              체험단 상품을 무료로 발송해드리며, 발송일로부터 1개월 이내에 체험 후기를 작성해야 합니다.
              기한 내 후기를 작성하지 않는 경우 추가 체험단 진행이 불가하며, 해당 제품의 가격을 결제하셔야 합니다.
              위 내용에 동의합니다.
            </span>
          </label>

          <div className="flex gap-2">
            <button type="submit" disabled={busy || !agreed || !productId} className="btn-primary px-5 py-2.5 text-sm">
              {busy ? '신청 중...' : '체험단 신청'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-5 py-2.5 text-sm">
              취소
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-gothic text-lg font-semibold text-slate-800">체험단 신청</h2>
          <p className="mt-0.5 text-xs text-slate-400">완료된 체험단 {completedCount}회 / 연 12회 가능</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" /> 체험단 신청
        </button>
      </div>

      {trials.length === 0 ? (
        <div className="card-surface grid place-items-center py-16 text-center">
          <Gift className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">신청 내역이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-400">체험단 신청을 통해 무료로 상품을 체험해보세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trials.map((trial) => {
            const sc = statusConfig[trial.status] ?? statusConfig.pending;
            const product = trial.product_id ? productMap.get(trial.product_id) : null;
            return (
              <button
                key={trial.id}
                onClick={() => setSelectedId(trial.id)}
                className="card-surface block w-full p-5 text-left transition hover:border-cyan/40"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${sc.cls}`}>
                    <sc.icon className="h-3 w-3" /> {sc.label}
                  </span>
                  <span className="ml-auto text-xs text-slate-500">{formatDate(trial.created_at)}</span>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  {product?.image_url && (
                    <img src={product.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{product?.name ?? '상품 정보 없음'}</h3>
                    <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-slate-400">{trial.reason}</p>
                  </div>
                </div>
                {trial.status === 'shipped' && (
                  <div className="mt-2 text-xs text-cyan">
                    {trial.review_url ? '리뷰 URL 제출 완료' : '리뷰 URL 제출 필요 (기한 내 작성)'}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
