/*
# Add annual subscription billing period

## Purpose
- 구독 상품을 월 결제와 12개월 연 결제 모두 지원
- 연 결제 시 체험단 무료 신청 혜택을 매월 1회(12개월 최대 12회)로 부여
- 월 결제는 여전히 구독 기간당 1회 무료 신청

## Schema changes
1. `subscription_plans`
   - `annual_price integer` 컬럼 추가. NULL이면 연 결제 미지원, 값이 있으면 연 결제 금액.
2. `profiles`
   - `subscription_billing_period text` 컬럼 추가 ('monthly' | 'annual').
   - 결제 시 어떤 주기로 구독이 활성화되었는지 기록하여 체험단 자격 계산에 사용.
3. `subscription_payments`
   - `billing_period text` 컬럼 추가 ('monthly' | 'annual').
   - 결제 기록에 청구 주기 보존.

## Security
- 기존 RLS 정책 유지. 컬럼 추가만 하므로 권한 변경 없음.
- 새 컬럼은 기존 CRUD 정책 범위에 자동 포함(Supabase는 컬럼 수준 권한을 테이블 정책으로 통제).

## Important notes
1. 기존 월 결제 회원은 `subscription_billing_period`가 NULL이며, 자격 함수는 NULL을 월 결제로 취급.
2. 기존 결제 내역의 `billing_period`도 NULL이며, 이는 과거 기록에 영향을 주지 않음.
3. 데이터 손실 없이 컬럼만 추가됨.
*/

ALTER TABLE subscription_plans
  ADD COLUMN IF NOT EXISTS annual_price integer;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_billing_period text
  CHECK (subscription_billing_period IS NULL OR subscription_billing_period IN ('monthly', 'annual'));

ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS billing_period text
  CHECK (billing_period IS NULL OR billing_period IN ('monthly', 'annual'));