import { useState } from 'react';
import { Crown, Check, AlertCircle, ArrowRight, Loader2, CreditCard } from 'lucide-react';
import { Profile, SubscriptionPlan } from '../lib/types';
import { formatKRW } from '../lib/format';
import { requestBillingKey, generatePaymentId, isPaymentConfigured } from '../lib/payment';
import { saveBillingKey, recordSubscriptionPayment, activateSubscription } from '../lib/data';
import { supabase } from '../lib/supabase';

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

  const premiumPlan = activePlans.find((p) => p.tier === 'premium');
  const standardPlan = activePlans.find((p) => p.tier === 'standard');

  const showStandard = standardPlan && !profile.cafe_nickname;
  const showPremium = premiumPlan && !!profile.cafe_nickname;

  const visiblePlans = activePlans.filter((p) => {
    if (p.tier === 'premium') return showPremium || (showStandard && !premiumPlan);
    if (p.tier === 'standard') return showStandard || (!showPremium && !premiumPlan);
    return true;
  });

  async function handleSubscribe(plan: SubscriptionPlan) {
    setError(null);
    setSuccess(null);
    if (!isPaymentConfigured()) {
      setError('결제 설정이 누락되었습니다. 관리자에게 문의해 주세요.');
      return;
    }
    setBusy(plan.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email ?? profile.email;
      const issueId = generatePaymentId('issue');

      const response = await requestBillingKey({
        issueId,
        issueName: `${plan.name} 구독 결제`,
        customer: {
          fullName: profile.full_name,
          email,
        },
        redirectUrl: window.location.origin + window.location.pathname + '#subscribe',
      });

      if (!response) {
        setError('빌링키 발급이 완료되지 않았습니다.');
        return;
      }
      if (response.code) {
        setError(response.message || '빌링키 발급에 실패했습니다.');
        return;
      }

      const billingKey = response.billingKey;
      if (!billingKey) {
        setError('빌링키를 받지 못했습니다.');
        return;
      }

      await saveBillingKey({
        user_id: profile.id,
        portone_billing_key: billingKey,
        portone_issue_id: issueId,
        plan_id: plan.id,
        card_company: (response as any).cardCompany ?? null,
        card_number_masked: (response as any).cardNumber ?? null,
      });

      const paymentId = generatePaymentId('sub');
      const apiUrl = `${(supabase as any).supabaseUrl}/functions/v1/charge-subscription`;
      const chargeRes = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(supabase as any).supabaseKey}`,
          apikey: (supabase as any).supabaseKey,
        },
        body: JSON.stringify({
          userId: profile.id,
          planId: plan.id,
          billingKey,
          paymentId,
          amount: plan.monthly_price,
          orderName: `${plan.name} 월 구독료`,
        }),
      });
      const chargeData = await chargeRes.json().catch(() => ({}));
      if (!chargeRes.ok || chargeData.error) {
        await recordSubscriptionPayment({
          user_id: profile.id,
          plan_id: plan.id,
          portone_payment_id: paymentId,
          amount: plan.monthly_price,
          status: 'failed',
          error_message: chargeData.error || '최초 결제 실패',
        });
        setError(chargeData.error || '최초 결제에 실패했습니다. 카드 정보를 확인해 주세요.');
        return;
      }

      await activateSubscription(profile.id, plan.id, plan.tier, 1);
      await recordSubscriptionPayment({
        user_id: profile.id,
        plan_id: plan.id,
        portone_payment_id: paymentId,
        amount: plan.monthly_price,
        status: 'paid',
      });

      setSuccess(`${plan.name} 구독 결제가 완료되었습니다!`);
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
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold-deep">
              <Crown className="h-3.5 w-3.5" /> 회원 등급 선택
            </div>
            <h1 className="font-gothic text-2xl font-bold text-slate-800">
              {profile.full_name}님, 회원 등급을 선택해 주세요
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              하이퍼쉴드 멤버쉽은 회원제 쇼핑몰입니다.
              <br />
              등급별 구독료를 결제하면 모든 제품을 할인가로 구매할 수 있습니다.
            </p>
          </div>

          <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold-deep">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">결제가 완료되어야 쇼핑몰에 입장할 수 있습니다.</p>
              <p className="mt-1 text-xs text-slate-500">
                구독료는 매월 자동 결제되며, 언제든 해지할 수 있습니다.
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
                    <Check className="h-4 w-4 text-gold" /> 매월 자동 결제 (카드)
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
                현재 선택 가능한 회원 등급이 없습니다. 관리자에게 문의해 주세요.
              </div>
            )}
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>
              NHN KCP 결제 연동이 적용되었습니다. 카드 결제 후 매월 자동 결제됩니다.
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
