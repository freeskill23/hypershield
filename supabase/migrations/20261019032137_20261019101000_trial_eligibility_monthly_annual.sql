/*
# Trial eligibility for monthly vs annual subscriptions

## Purpose
- 월 결제 회원: 현재 구독 기간(1개월) 동안 체험단 무료 신청 1회
- 연 결제 회원: 12개월 구독 기간 동안 매월 1회, 최대 12회 무료 신청
- 연 결제 혜택 문구를 클라이언트에서 표시할 수 있도록 max_per_year를 12로 반환

## Function behavior
- `get_trial_eligibility(p_user_id uuid)` 반환 컬럼 유지(eligible, reason, current_month_count, year_count, max_per_month, max_per_year).
- profiles.subscription_billing_period가 'annual'이면:
  - max_per_month = 1, max_per_year = 12
  - 구독 시작일부터 현재까지 각 월별로 1회 신청 허용(현재 월 신청 횟수가 곧 잔여 여부 판단)
  - year_count는 최근 12개월(rolling) 신청 수
- 'monthly' 또는 NULL이면:
  - max_per_month = 1, max_per_year = 1
  - 현재 구독 기간(시작일~만료일) 동안 1회만 허용

## Security
- SECURITY DEFINER 유지, search_path = public 고정.
- 실행 권한은 authenticated로 제한.
*/

CREATE OR REPLACE FUNCTION public.get_trial_eligibility(p_user_id uuid)
RETURNS TABLE (
  eligible boolean,
  reason text,
  current_month_count integer,
  year_count integer,
  max_per_month integer,
  max_per_year integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_expires timestamptz;
  v_started timestamptz;
  v_period text;
  v_max_per_month integer := 1;
  v_max_per_year integer := 1;
  v_month_count integer := 0;
  v_year_count integer := 0;
  v_period_start timestamptz;
  v_eligible boolean := true;
  v_reason text := '';
BEGIN
  SELECT subscription_status, subscription_expires_at, subscription_started_at, subscription_billing_period
    INTO v_status, v_expires, v_started, v_period
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL OR v_status <> 'active' THEN
    RETURN QUERY SELECT false, '구독이 활성 상태가 아닙니다. 구독 결제 후 체험단 신청이 가능합니다.', 0, 0, v_max_per_month, v_max_per_year;
    RETURN;
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RETURN QUERY SELECT false, '구독이 만료되었습니다. 구독 결제 후 다시 신청할 수 있습니다.', 0, 0, v_max_per_month, v_max_per_year;
    RETURN;
  END IF;

  v_period_start := COALESCE(v_started, now() - interval '1 month');

  IF v_period = 'annual' THEN
    v_max_per_month := 1;
    v_max_per_year := 12;

    SELECT count(*)::integer
      INTO v_month_count
    FROM trial_applications
    WHERE user_id = p_user_id
      AND created_at >= date_trunc('month', now())
      AND created_at < date_trunc('month', now()) + interval '1 month';

    SELECT count(*)::integer
      INTO v_year_count
    FROM trial_applications
    WHERE user_id = p_user_id
      AND created_at >= v_period_start
      AND (v_expires IS NULL OR created_at < v_expires);

    IF v_month_count >= v_max_per_month THEN
      v_eligible := false;
      v_reason := '이번 달 체험단 무료 신청(1회)을 이미 사용했습니다. 다음 달에 다시 신청할 수 있습니다.';
    ELSIF v_year_count >= v_max_per_year THEN
      v_eligible := false;
      v_reason := '연 결제 혜택의 무료 체험 횟수(12회)를 모두 사용했습니다. 다음 연 결제 시 다시 이용할 수 있습니다.';
    ELSE
      v_reason := '연 결제 혜택: 매월 1회, 12개월간 최대 12회 무료 체험 신청이 가능합니다.';
    END IF;
  ELSE
    v_max_per_month := 1;
    v_max_per_year := 1;

    SELECT count(*)::integer
      INTO v_month_count
    FROM trial_applications
    WHERE user_id = p_user_id
      AND created_at >= v_period_start
      AND (v_expires IS NULL OR created_at < v_expires);

    v_year_count := v_month_count;

    IF v_month_count >= v_max_per_month THEN
      v_eligible := false;
      v_reason := '현재 월 구독 기간의 체험단 무료 신청(1회)을 이미 사용했습니다. 다음 달 결제 후 다시 신청할 수 있습니다.';
    ELSE
      v_reason := '월 결제 회원은 현재 구독 기간에 1회 무료 체험 신청이 가능합니다. 연 결제 시 매월 1회, 최대 12회 혜택이 제공됩니다.';
    END IF;
  END IF;

  RETURN QUERY SELECT v_eligible, v_reason, v_month_count, v_year_count, v_max_per_month, v_max_per_year;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_eligibility(uuid) TO authenticated;