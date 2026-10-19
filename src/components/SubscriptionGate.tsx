import { useState } from 'react';
import { Crown, Check, AlertCircle, ArrowRight, Loader2, CreditCard, Sparkles } from 'lucide-react';
import { Profile, SubscriptionPlan, BillingPeriod } from '../lib/types';
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
  const [period, setPeriod] = useState<BillingPeriod>('monthly');

  const activePlans = plans
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const isApprovedSpecial = profile.special_member_status === 'approved';

  const visiblePlans = activePlans.filter((p) =>
    isApprovedSpecial ? p.tier === 'premium' : p.tier !== 'premium'
  );

  const headline = isApprovedSpecial ? '특별회원 구독' : '일반회원 구독';
  const subline = isApprovedSpecial
    ? '특별회원으로 승인되었습니다. 특별회원 전용 구독 상품만 노출됩니다.'
    : '하이퍼쉴드 멤버쉽은 회원제 쇼핑몰입니다. 등록된 일반회원 구독 상품을 결제하면 모든 제품을 할인가로 구매할 수 있습니다.';

  const supportsAnnual = visiblePlans.some((p) => p.annual_price && p.annual_price > 0);

  async function handleSubscribe(plan: SubscriptionPlan) {
    setError(null);
    setSuccess(null);
    if (!isPaymentConfigured()) {
      setError('결제 설정이 누락되었습니다. 관리자에게 문의해 주세요.');
      return;
    }
    const useAnnual = period === 'annual' && plan.annual_price && plan.annual_price > 0;
    const amount = useAnnual ? (plan.annual_price as number) : plan.monthly_price;
    if (!amount || amount <= 0) {
      setError('선택한 결제 주기의 가격이 설정되어 있지 않습니다.');
      return;
    }
    const chosenPeriod: BillingPeriod = useAnnual ? 'annual' : 'monthly';
    setBusy(plan.id);
    try {
      const paymentId = generatePaymentId('sub');
      const response = await requestProductPayment({
        paymentId,
        orderName: `${plan.name} ${chosenPeriod === 'annual' ? '연 구독료' : '월 구독료'}`,
        totalAmount: amount,
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

      const result = await confirmManualSubscriptionPayment({ paymentId, planId: plan.id, period: chosenPeriod, amount });
      if (!result.ok) {
        setError(result.error || '결제 확인에 실패했습니다.');
        return;
      }

      setSuccess(
        chosenPeriod === 'annual'
          ? `${plan.name} 연 구독 결제가 완료되었습니다. 12개월 동안 회원제 쇼핑몰을 이용할 수 있고, 매월 1회 무료 체험 상품을 신청할 수 있습니다.`
          : `${plan.name} 월 구독 결제가 완료되었습니다. 1개월 동안 회원제 쇼핑몰을 이용할 수 있습니다.`,
      );
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

          {supportsAnnual && (
            <div className="mb-6 flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPeriod('monthly')}
                className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
                  period === 'monthly' ? 'bg-cyan text-white shadow-glow' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                월 결제
              </button>
              <button
                type="button"
                onClick={() => setPeriod('annual')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition ${
                  period === 'annual' ? 'bg-gold text-white shadow-gold' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                12개월 연 결제
                <span className="rounded-full bg-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-gold-deep">혜택</span>
              </button>
            </div>
          )}

          <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold-deep">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">결제가 완료되어야 쇼핑몰에 입장할 수 있습니다.</p>
              <p className="mt-1 text-xs text-slate-500">
                {period === 'annual' && supportsAnnual
                  ? '12개월 연 결제 시 결제일로부터 12개월 동안 이용할 수 있고, 매월 1회 무료 체험 상품을 신청할 수 있습니다(최대 12회).'
                  : '월 결제 시 결제일로부터 1개월 동안 이용할 수 있으며, 현재 구독 기간에 무료 체험 상품을 1회 신청할 수 있습니다.'}
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
            {visiblePlans.map((plan) => {
              const useAnnual = period === 'annual' && plan.annual_price && plan.annual_price > 0;
              const displayAmount = useAnnual ? (plan.annual_price as number) : plan.monthly_price;
              const periodLabel = useAnnual ? '/ 12개월' : '/ 월';
              return (
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
                    <span className="font-gothic text-3xl font-bold text-cyan">{formatKRW(displayAmount)}</span>
                    <span className="text-sm text-slate-400"> {periodLabel}</span>
                  </div>
                  {useAnnual && plan.monthly_price > 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      월 결제 대비 {formatKRW(plan.monthly_price * 12 - (plan.annual_price as number))} 절약
                    </p>
                  )}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-cyan" /> 모든 제품 {plan.discount_rate}% 할인
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-cyan" /> 회원제 쇼핑몰 이용
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-gold" /> 카드 수동 결제 후 {useAnnual ? '12개월' : '1개월'} 이용
                    </div>
                    {useAnnual && (
                      <div className="flex items-start gap-2 rounded-md bg-gold/5 px-2.5 py-2 text-sm text-gold-deep">
                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span className="font-medium">연 결제 혜택: 매월 1회 무료 체험 상품 신청, 12개월간 최대 12회</span>
                      </div>
                    )}
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
                      <><CreditCard className="h-4 w-4" /> {useAnnual ? '연 결제하기' : '결제하기'} <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                </div>
              );
            })}
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
              NHN KCP 카드 결제가 적용되었습니다. 월 결제는 1개월, 연 결제는 12개월 이용 기간이 제공됩니다.
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
