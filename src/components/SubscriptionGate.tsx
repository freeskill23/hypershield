import { Crown, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { Profile, SubscriptionPlan } from '../lib/types';
import { formatKRW } from '../lib/format';

interface Props {
  profile: Profile;
  plans: SubscriptionPlan[];
  onSignOut: () => Promise<void>;
}

export default function SubscriptionGate({ profile, plans, onSignOut }: Props) {
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-cyan/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-4 py-1.5 text-xs font-medium text-gold-deep">
              <Crown className="h-3.5 w-3.5" /> 회원 등급 선택
            </div>
            <h1 className="font-gothic text-2xl font-bold text-slate-800">
              {profile.full_name}님, 회원 등급을 선택해 주세요
            </h1>
            <p className="mt-3 text-sm text-slate-500">
              노애드 세차클럽은 회원제 쇼핑몰입니다.
              <br />
              등급별 구독료를 결제하면 모든 제품을 할인가로 구매할 수 있습니다.
            </p>
          </div>

          {/* Notice */}
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold-deep">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-medium">결제가 완료되어야 쇼핑몰에 입장할 수 있습니다.</p>
              <p className="mt-1 text-xs text-slate-500">
                구독료는 매월 자동 결제되며, 더 좋은 품질의 제품을 공급하는 데 사용됩니다.
              </p>
            </div>
          </div>

          {/* Grade cards */}
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
                  {plan.discount_rate >= 60 && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Check className="h-4 w-4 text-gold" /> 우선 배송
                    </div>
                  )}
                </div>
                <button className="btn-primary mt-5 w-full" disabled>
                  결제하기 <ArrowRight className="h-4 w-4" />
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
              NHN KCP 정기결제 연동은 시스템 구축 후 적용 예정입니다.
              현재는 관리자가 수동으로 회원 등급을 활성화할 수 있습니다.
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
