import { useState, useEffect } from 'react';
import { Crown, Check, AlertCircle, ArrowRight, Loader2, CreditCard, Sparkles, ShieldCheck, Building2, Copy } from 'lucide-react';
import { Profile, SubscriptionPlan, BillingPeriod, Setting } from '../lib/types';
import { formatKRW } from '../lib/format';
import { requestProductPayment, generatePaymentId, isPaymentConfigured } from '../lib/payment';
import { confirmManualSubscriptionPayment, requestBankTransferSubscription, createPendingCardPayment, getSettingValue, getMyPendingCardPayments } from '../lib/data';

interface Props {
  profile: Profile;
  plans: SubscriptionPlan[];
  settings: Setting[];
  onSignOut: () => Promise<void>;
  onActivated: () => void;
}

interface BannerOption {
  period: BillingPeriod;
  amount: number;
  label: string;
  periodLabel: string;
  benefit: string;
  duration: string;
  savings?: number;
  featured?: boolean;
}

export default function SubscriptionGate({ profile, plans, settings, onSignOut, onActivated }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showGeneralPlans, setShowGeneralPlans] = useState(false);
  const [bankTransferPlan, setBankTransferPlan] = useState<{ plan: SubscriptionPlan; banner: BannerOption } | null>(null);
  const [depositorName, setDepositorName] = useState('');
  const [bankTransferError, setBankTransferError] = useState<string | null>(null);

  const bankName = getSettingValue(settings, 'bank_transfer_bank') ?? '';
  const bankAccount = getSettingValue(settings, 'bank_transfer_account') ?? '';
  const bankHolder = getSettingValue(settings, 'bank_transfer_holder') ?? '';
  const bankTransferEnabled = !!(bankName && bankAccount && bankHolder);

  const activePlans = plans
    .filter((p) => p.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const [redirectConfirming, setRedirectConfirming] = useState(false);
  const [autoRetrying, setAutoRetrying] = useState(false);

  useEffect(() => {
    if (autoRetrying) return;
    setAutoRetrying(true);
    (async () => {
      const pending = await getMyPendingCardPayments();
      if (pending.length === 0) { setAutoRetrying(false); return; }
      const latest = pending[0];
      setBusy('auto-retry');
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 9000)));
        const result = await confirmManualSubscriptionPayment({
          paymentId: latest.portone_payment_id,
          planId: latest.plan_id,
          period: latest.billing_period === 'annual' ? 'annual' : 'monthly',
          amount: latest.amount,
        });
        if (result.ok) {
          setSuccess('이전 결제가 확인되었습니다. 구독이 활성화되었습니다.');
          onActivated();
          setBusy(null);
          setAutoRetrying(false);
          return;
        }
      }
      setBusy(null);
      setAutoRetrying(false);
      setError('이전 카드 결제가 정상 처리되었으나 시스템 확인이 지연되고 있습니다. 잠시 후 새로고침하거나 관리자에게 문의해 주세요. 결제금액은 안전하게 보관됩니다.');
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = sessionStorage.getItem('pending_subscription_payment');
    if (!stored || redirectConfirming) return;
    let ctx: { paymentId: string; planId: string; period: BillingPeriod; amount: number; planName: string };
    try { ctx = JSON.parse(stored); } catch { sessionStorage.removeItem('pending_subscription_payment'); return; }
    setRedirectConfirming(true);
    (async () => {
      setBusy('redirect-confirm');
      setError(null);
      for (let attempt = 0; attempt < 8; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 12000)));
          const result = await confirmManualSubscriptionPayment({
            paymentId: ctx.paymentId,
            planId: ctx.planId,
            period: ctx.period,
            amount: ctx.amount,
          });
          if (result.ok) {
            sessionStorage.removeItem('pending_subscription_payment');
            setSuccess(
              ctx.period === 'annual'
                ? `${ctx.planName} 연 구독 결제가 완료되었습니다. 11개월 동안 회원제 쇼핑몰을 이용할 수 있고, 매월 1회 무료 체험 상품을 신청할 수 있습니다.`
                : `${ctx.planName} 월 구독 결제가 완료되었습니다. 1개월 동안 회원제 쇼핑몰을 이용할 수 있습니다.`,
            );
            onActivated();
            setBusy(null);
            return;
          }
          if (attempt < 7) continue;
          setError('카드 결제는 정상적으로 처리되었습니다. 시스템 확인이 지연되고 있으며 잠시 후 자동으로 활성화됩니다. 페이지를 새로고침하거나 잠시 후 다시 접속해 주세요. 결제금액은 안전하게 보관됩니다.');
        } catch (e: any) {
          if (attempt < 7) continue;
          setError('카드 결제는 정상적으로 처리되었습니다. 시스템 확인이 지연되고 있으며 잠시 후 자동으로 활성화됩니다. 페이지를 새로고침하거나 잠시 후 다시 접속해 주세요. 결제금액은 안전하게 보관됩니다.');
        }
      }
      setBusy(null);
    })();
  }, [redirectConfirming, onActivated]);

  const isApprovedSpecial = profile.special_member_status === 'approved';
  const isPendingSpecial = profile.special_member_status === 'requested';
  const isShowingGeneralPlans = !isApprovedSpecial && (!isPendingSpecial || showGeneralPlans);

  const visiblePlans = activePlans.filter((p) =>
    isApprovedSpecial ? p.tier === 'premium' : isShowingGeneralPlans && p.tier !== 'premium'
  );

  const headline = isApprovedSpecial
    ? '특별회원 구독'
    : isPendingSpecial && !showGeneralPlans
      ? '특별회원 승인 대기'
      : '일반회원 구독';
  const subline = isApprovedSpecial
    ? '특별회원으로 승인되었습니다. 특별회원 전용 구독 상품만 노출됩니다.'
    : isPendingSpecial && !showGeneralPlans
      ? '특별회원 승인이 완료되면 특별회원 구독을 신청할 수 있습니다.'
      : '하이퍼쉴드 멤버쉽은 회원제 쇼핑몰입니다. 등록된 일반회원 구독 상품을 결제하면 모든 제품을 할인가로 구매할 수 있습니다.';

  function buildBanners(plan: SubscriptionPlan): BannerOption[] {
    const banners: BannerOption[] = [];
    if (plan.monthly_price && plan.monthly_price > 0) {
      banners.push({
        period: 'monthly',
        amount: plan.monthly_price,
        label: '월 결제',
        periodLabel: '/ 월',
        benefit: '1개월 이용',
        duration: '1개월',
      });
    }
    if (plan.annual_price && plan.annual_price > 0) {
      const savings = plan.monthly_price > 0
        ? plan.monthly_price * 11 - (plan.annual_price as number)
        : undefined;
      banners.push({
        period: 'annual',
        amount: plan.annual_price as number,
        label: '11개월 연 결제',
        periodLabel: '/ 11개월',
        benefit: '11개월 이용 + 매월 무료 체험',
        duration: '11개월',
        savings,
        featured: true,
      });
    }
    return banners;
  }

  async function handleSubscribe(plan: SubscriptionPlan, banner: BannerOption) {
    setError(null);
    setSuccess(null);
    if (busy !== null) return;
    if (!isPaymentConfigured()) {
      setError('결제 설정이 누락되었습니다. 관리자에게 문의해 주세요.');
      return;
    }
    if (!banner.amount || banner.amount <= 0) {
      setError('선택한 결제 주기의 가격이 설정되어 있지 않습니다.');
      return;
    }
    setBusy(`${plan.id}-${banner.period}`);
    try {
      const paymentId = generatePaymentId('sub');

      const pending = await createPendingCardPayment({
        paymentId,
        planId: plan.id,
        period: banner.period,
        amount: banner.amount,
      });
      if (!pending.ok) {
        setError(pending.error || '결제 준비에 실패했습니다.');
        return;
      }

      sessionStorage.setItem('pending_subscription_payment', JSON.stringify({
        paymentId,
        planId: plan.id,
        period: banner.period,
        amount: banner.amount,
        planName: plan.name,
      }));
      const response = await requestProductPayment({
        paymentId,
        orderName: `${plan.name} ${banner.period === 'annual' ? '연 구독료' : '월 구독료'}`,
        totalAmount: banner.amount,
        customer: {
          fullName: profile.full_name,
          email: profile.email,
        },
        redirectUrl: window.location.origin + window.location.pathname + '#subscribe',
      });

      if (!response) {
        sessionStorage.removeItem('pending_subscription_payment');
        setError('결제가 완료되지 않았습니다.');
        return;
      }
      if (response.code) {
        sessionStorage.removeItem('pending_subscription_payment');
        setError(response.message || '결제에 실패했습니다.');
        return;
      }

      const confirmedPaymentId = response.paymentId || paymentId;
      let confirmOk = false;
      let confirmError: string | null = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          if (attempt > 0) await new Promise((r) => setTimeout(r, Math.min(3000 * attempt, 12000)));
          const result = await confirmManualSubscriptionPayment({
            paymentId: confirmedPaymentId,
            planId: plan.id,
            period: banner.period,
            amount: banner.amount,
          });
          if (result.ok) {
            confirmOk = true;
            break;
          }
          confirmError = result.error || '결제 확인에 실패했습니다.';
        } catch (e: any) {
          confirmError = e.message || '결제 확인 중 오류가 발생했습니다.';
        }
      }
      if (!confirmOk) {
        setError('카드 결제는 정상적으로 처리되었습니다. 시스템 확인이 지연되고 있으며 잠시 후 자동으로 활성화됩니다. 페이지를 새로고침하거나 잠시 후 다시 접속해 주세요. 결제금액은 안전하게 보관됩니다.');
        return;
      }
      sessionStorage.removeItem('pending_subscription_payment');

      setSuccess(
        banner.period === 'annual'
          ? `${plan.name} 연 구독 결제가 완료되었습니다. 11개월 동안 회원제 쇼핑몰을 이용할 수 있고, 매월 1회 무료 체험 상품을 신청할 수 있습니다.`
          : `${plan.name} 월 구독 결제가 완료되었습니다. 1개월 동안 회원제 쇼핑몰을 이용할 수 있습니다.`,
      );
      onActivated();
    } catch (e: any) {
      setError(e.message || '구독 결제 중 오류가 발생했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function openBankTransfer(plan: SubscriptionPlan, banner: BannerOption) {
    setError(null);
    setSuccess(null);
    setBankTransferPlan({ plan, banner });
    setDepositorName(profile.full_name);
    setBankTransferError(null);
  }

  async function handleBankTransferSubmit() {
    if (!bankTransferPlan) return;
    if (!depositorName.trim()) { setBankTransferError('입금자명을 입력해주세요.'); return; }
    if (!bankTransferEnabled) { setBankTransferError('무통장 입금 계좌가 설정되지 않았습니다. 관리자에게 문의해주세요.'); return; }
    setBusy('bank-transfer');
    setBankTransferError(null);
    try {
      const result = await requestBankTransferSubscription({
        planId: bankTransferPlan.plan.id,
        period: bankTransferPlan.banner.period,
        amount: bankTransferPlan.banner.amount,
        depositorName: depositorName.trim(),
      });
      if (!result.ok) {
        setBankTransferError(result.error || '무통장 입금 신청에 실패했습니다.');
        return;
      }
      setBankTransferPlan(null);
      setSuccess(
        `무통장 입금 신청이 완료되었습니다. 아래 계좌로 ${formatKRW(bankTransferPlan.banner.amount)}을 입금해주세요. 관리자가 입금 확인 후 구독이 활성화됩니다.\n\n${bankName} ${bankAccount} (${bankHolder})\n입금자명: ${depositorName.trim()}`,
      );
    } catch (e: any) {
      setBankTransferError(e.message || '무통장 입금 신청 중 오류가 발생했습니다.');
    } finally {
      setBusy(null);
    }
  }

  function copyAccount() {
    const text = `${bankName} ${bankAccount} (${bankHolder})`;
    navigator.clipboard?.writeText(text);
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
              {profile.full_name}님, 구독기간을 선택해주세요.
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              {subline}
            </p>
          </div>

          {isPendingSpecial && !showGeneralPlans ? (
            <div className="mb-6 rounded-xl border border-gold/40 bg-gold/5 p-6 text-center">
              <AlertCircle className="mx-auto mb-3 h-7 w-7 text-gold-deep" />
              <p className="font-medium text-slate-800">특별회원은 관리자 승인이 필요합니다.</p>
              <p className="mt-1 text-sm text-slate-600">관리자 승인 후 구독신청해주시기 바랍니다.</p>
              <button
                type="button"
                onClick={() => setShowGeneralPlans(true)}
                className="btn-primary mt-5 px-5 py-3"
              >
                일반회원으로 구독신청할래요 <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold-deep">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">결제가 완료되어야 쇼핑몰에 입장할 수 있습니다.</p>
                <p className="mt-1 text-xs text-slate-500">
                  카드 결제 또는 무통장 입금으로 구독할 수 있습니다. 무통장 입금은 관리자가 입금 확인 후 구독이 활성화됩니다.
                </p>
              </div>
            </div>
          )}

          {(busy === 'redirect-confirm' || busy === 'auto-retry') && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-cyan/30 bg-cyan/5 px-4 py-3 text-sm text-cyan">
              <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
              <span>결제 확인 중입니다. 잠시만 기다려주세요...</span>
            </div>
          )}

          {error && redirectConfirming && (
            <div className="mb-6 space-y-3">
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={() => {
                  setRedirectConfirming(false);
                  setError(null);
                }}
                className="btn-primary px-5 py-2.5 text-sm"
              >
                결제 확인 다시 시도
              </button>
            </div>
          )}

          {error && !redirectConfirming && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <Check className="mt-0.5 h-5 w-5 shrink-0" />
              <span className="whitespace-pre-line">{success}</span>
            </div>
          )}

          {visiblePlans.map((plan) => {
            const banners = buildBanners(plan);
            return (
              <div key={plan.id} className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  {plan.tier === 'premium' && (
                    <span className="rounded-full bg-gold/20 px-2.5 py-1 text-xs font-medium text-gold-deep">
                      특별회원
                    </span>
                  )}
                  <h3 className="font-gothic text-lg font-bold text-slate-800">{plan.name}</h3>
                  {plan.description && (
                    <span className="text-xs text-slate-500">{plan.description}</span>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {banners.map((banner) => {
                    const busyKey = `${plan.id}-${banner.period}`;
                    return (
                      <div
                        key={banner.period}
                        className={`card-surface relative overflow-hidden p-6 transition hover:border-cyan/40 ${
                          banner.featured ? 'ring-1 ring-gold/40' : ''
                        }`}
                      >
                        {banner.featured && (
                          <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-[10px] font-bold text-gold-deep">
                            <Sparkles className="h-3 w-3" /> 혜택
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                            banner.featured ? 'bg-gold/10 text-gold-deep' : 'bg-cyan/10 text-cyan'
                          }`}>
                            {banner.featured ? <Sparkles className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                            {banner.label}
                          </span>
                        </div>
                        <div className="mt-4">
                          <span className={`font-gothic text-3xl font-bold ${banner.featured ? 'text-gold-deep' : 'text-cyan'}`}>
                            {formatKRW(banner.amount)}
                          </span>
                          <span className="text-sm text-slate-400"> {banner.periodLabel}</span>
                        </div>
                        {banner.savings !== undefined && banner.savings > 0 && (
                          <p className="mt-1 text-xs text-gold-deep">
                            월 결제 대비 {formatKRW(banner.savings)} 절약
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
                            <Check className={`h-4 w-4 ${banner.featured ? 'text-gold' : 'text-cyan'}`} /> 카드 결제 후 {banner.duration} 이용
                          </div>
                          {banner.featured && (
                            <div className="flex items-start gap-2 rounded-md bg-gold/5 px-2.5 py-2 text-sm text-gold-deep">
                              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                              <span className="font-medium">연 결제 혜택: 매월 1회 무료 체험 상품 신청, 11개월간 최대 11회</span>
                            </div>
                          )}
                          {plan.discount_rate >= 60 && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <Check className="h-4 w-4 text-gold" /> 우선 배송
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleSubscribe(plan, banner)}
                          disabled={busy !== null}
                          className={`mt-5 w-full ${banner.featured ? 'btn-gold' : 'btn-primary'}`}
                        >
                          {busy === busyKey ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /> 결제 중...</>
                          ) : (
                            <><CreditCard className="h-4 w-4" /> {banner.featured ? '연 결제하기' : '월 결제하기'} <ArrowRight className="h-4 w-4" /></>
                          )}
                        </button>
                        {bankTransferEnabled && (
                          <button
                            onClick={() => openBankTransfer(plan, banner)}
                            disabled={busy !== null}
                            className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-cyan hover:text-cyan"
                          >
                            <Building2 className="mr-1.5 inline h-4 w-4" /> 무통장 입금으로 신청
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {visiblePlans.length === 0 && !(isPendingSpecial && !showGeneralPlans) && (
            <div className="card-surface p-8 text-center text-sm text-slate-500">
              {isApprovedSpecial
                ? '현재 특별회원 전용 구독 상품이 없습니다. 관리자에게 문의해 주세요.'
                : '현재 선택 가능한 회원 등급이 없습니다. 관리자에게 문의해 주세요.'}
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <span>
              카드 결제는 NHN KCP를 통해 즉시 활성화됩니다. 무통장 입금은 관리자가 입금 확인 후 구독을 활성화합니다.
            </span>
          </div>

          <div className="mt-6 text-center">
            <button onClick={async () => { await onSignOut(); }} className="text-sm text-slate-400 underline hover:text-slate-600">
              로그아웃
            </button>
          </div>
        </div>
      </div>

      {bankTransferPlan && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 px-4" onClick={() => setBankTransferPlan(null)}>
          <div className="card-surface w-full max-w-md space-y-4 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-gothic text-base font-semibold text-slate-800">무통장 입금 신청</h3>
              <button onClick={() => setBankTransferPlan(null)} className="text-slate-400 hover:text-slate-600">
                <AlertCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">입금 계좌</span>
                <button onClick={copyAccount} className="inline-flex items-center gap-1 text-xs text-cyan hover:underline">
                  <Copy className="h-3 w-3" /> 복사
                </button>
              </div>
              <p className="font-gothic text-sm font-bold text-slate-800">{bankName}</p>
              <p className="text-lg font-bold text-slate-800">{bankAccount}</p>
              <p className="text-sm text-slate-500">예금주: {bankHolder}</p>
            </div>
            <div className="rounded-lg border border-cyan/30 bg-cyan/5 p-3 text-sm text-slate-700">
              <p className="font-medium">{bankTransferPlan.plan.name} {bankTransferPlan.banner.label}</p>
              <p className="mt-1 text-cyan">입금 금액: {formatKRW(bankTransferPlan.banner.amount)}</p>
              <p className="mt-0.5 text-xs text-slate-500">이용 기간: {bankTransferPlan.banner.duration}</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">입금자명</label>
              <input
                type="text"
                value={depositorName}
                onChange={e => { setDepositorName(e.target.value); setBankTransferError(null); }}
                placeholder="입금하시는 분의 이름"
                className="input-field"
                autoFocus
              />
              {bankTransferError && <p className="mt-2 text-xs text-red-400">{bankTransferError}</p>}
            </div>
            <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              위 계좌로 입금 후 관리자가 입금을 확인하면 구독이 자동으로 활성화됩니다. 입금자명은 실제 입금하시는 분의 이름과 동일하게 입력해주세요.
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleBankTransferSubmit} disabled={busy !== null} className="btn-primary px-5 py-2.5 text-sm">
                {busy === 'bank-transfer' ? <><Loader2 className="h-4 w-4 animate-spin" /> 신청 중...</> : '무통장 입금 신청'}
              </button>
              <button onClick={() => setBankTransferPlan(null)} className="btn-ghost px-5 py-2.5 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
