import { useState } from 'react';
import { Crown, Check, AlertCircle, ArrowRight, Loader2, CreditCard } from 'lucide-react';
import { Profile, SubscriptionPlan } from '../lib/types';
import { formatKRW } from '../lib/format';
import { requestProductPayment, generatePaymentId, isPaymentConfigured } from '../lib/payment';
import { confirmManualSubscriptionPayment } from '../lib/data';

interface Props {
  profile: Profile;
  plans: SubscriptionPlan[];
  onSignOut: () => Promise<void>;
  onActivated: () => void;
}

export default function SubscriptionGate({ profile, plans, onSignOut, onActivated }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const activePlans = plans
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const isApprovedSpecial = profile.special_member_status === 'approved';

  const visiblePlans = activePlans.filter((p) =>
    isApprovedSpecial ? p.tier === 'premium' : p.tier !== 'premium'
  );

  const headline = isApprovedSpecial
    ? '특별회원 구독'
    : '일반회원 구독';
  const subline = isApprovedSpecial
    ? '특별회원으로 승인되었습니다. 특별회원 전용 구독 상품만 노출됩니다.'
    : '하이퍼쉴드 멤버쉽은 회원제 쇼핑몰입니다. 등록된 일반회원 구독 상품을 결제하면 모든 제품을 할인가로 구매할 수 있습니다.';

  async function handleSubscribe(plan: SubscriptionPlan) {
    setError(null);
    setSuccess(null);
    if (!isPaymentConfigured()) {
      setError('결제 설정이 누락되었습니다. 관리자에게 문의해 주세요.');
      return;
    }
    setBusy(plan.id);
    try {
      const paymentId = generatePaymentId('sub');
      const response = await requestProductPayment({
        paymentId,
        orderName: `${plan.name} 월 구독료`,
        totalAmount: plan.monthly_price,
        customer: {
          fullName: profile.full_name,
          email: profile.email,
        },
        redirectUrl: window.location.origin + window.location.pathname + '#subscribe',
      });

      if (!response) {
        setError('결제가 완료되지 않았습니다.');
        return;
      }
      if (response.code) {
        setError(response.message || '결제에 실패했습니다.');
        return;
      }

      const result = await confirmManualSubscriptionPayment({ paymentId, planId: plan.id });
      if (!result.ok) {
        setError(result.error || '결제 확인에 실패했습니다.');
        return;
      }

      setSuccess(`${plan.name} 월 구독 결제가 완료되었습니다. 1개월 동안 회원제 쇼핑몰을 이용할 수 있습니다.`);
      onActivated();
    } catch (e: any) {
      setError(e.message || '구독 결제 중 오류가 발생했습니다.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          <div className="mb-8 text-center">
            <div className={`mx-auto mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium ${isApprovedSpecial ? 'border-gold/30 bg-gold/5 text-gold-deep' : 'border-cyan/30 bg-cyan/5 text-cyan'}`}>
              <Crown className="h-3.5 w-3.5" /> {headline}
            </div>
            <h1 className="font-gothic text-2xl font-bold text-slate-800">
              {profile.full_name}님, 회원 등급을 선택해 주세요
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {subline}
            </p>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold-deep">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">결제가 완료되어야 쇼핑몰에 입장할 수 있습니다.</p>
              <p className="mt-1 text-xs text-slate-500">
                결제할 때마다 1개월 이용 기간이 시작되며, 만료 후 다시 결제할 수 있습니다.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {visiblePlans.map((plan) => (
              <div
                key={plan.id}
                className="card-surface relative overflow-hidden p-6 transition hover:border-gold/40"
              >
                {plan.tier === 'premium' && (
                  <div className="absolute right-4 top-4 rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-gold-deep">
                    특별회원
                  </div>
                )}
                <h3 className="font-gothic text-lg font-bold text-slate-800">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-xs text-slate-500">{plan.description}</p>
                )}
                <div className="mt-4">
                  <span className="font-gothic text-3xl font-bold text-cyan">{formatKRW(plan.monthly_price)}</span>
                  <span className="text-sm text-slate-400"> / 월</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-cyan" /> 모든 제품 {plan.discount_rate}% 할인
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-cyan" /> 회원제 쇼핑몰 이용
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Check className="h-4 w-4 text-gold" /> 카드 수동 결제 후 1개월 이용
                  </div>
                  {plan.discount_rate >= 60 && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-gold" /> 우선 배송
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleSubscribe(plan)}
                  disabled={busy !== null}
                  className="btn-primary mt-5 w-full"
                >
                  {busy === plan.id ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> 결제 중...</>
                  ) : (
                    <><CreditCard className="h-4 w-4" /> 결제하기 <ArrowRight className="h-4 w-4" /></>
                  )}
                </button>
              </div>
            ))}
            {visiblePlans.length === 0 && (
              <div className="card-surface col-span-full p-8 text-center text-sm text-slate-500">
                {isApprovedSpecial
                  ? '현재 특별회원 전용 구독 상품이 없습니다. 관리자에게 문의해 주세요.'
                  : '현재 선택 가능한 회원 등급이 없습니다. 관리자에게 문의해 주세요.'}
              </div>
            )}
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>
              NHN KCP 카드 결제가 적용되었습니다. 매월 직접 결제하면 결제일로부터 1개월 동안 이용할 수 있습니다.
            </span>
          </div>

          <div className="mt-6 text-center">
            <button onClick={async () => { await onSignOut(); }} className="text-sm text-slate-400 underline hover:text-slate-600">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
