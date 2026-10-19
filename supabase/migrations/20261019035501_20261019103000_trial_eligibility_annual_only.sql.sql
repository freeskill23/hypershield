/*
# Trial eligibility restricted to annual subscribers only

## Purpose
- 체험단 무료 신청은 연 결제(12개월) 회원만 이용 가능.
- 월 결제 회원은 체험단 신청 불가. 연 결제로 변경 시 이용 가능.

## Function behavior
- profiles.subscription_billing_period가 'annual'이고 구독 활성 상태일 때만 eligible = true.
- 'monthly' 또는 NULL인 경우 eligible = false, 안내 메시지로 연 결제 권유.
- 연 결제 회원의 횟수 제한(매월 1회, 12개월 최대 12회)은 기존과 동일하게 유지.

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
  v_max_per_year integer := 12;
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

  IF v_period IS NULL OR v_period <> 'annual' THEN
    RETURN QUERY SELECT false, '체험단 무료 신청은 12개월 연 결제 회원만 이용할 수 있습니다. 연 결제로 변경하신 후 신청할 수 있습니다.', 0, 0, v_max_per_month, v_max_per_year;
    RETURN;
  END IF;

  v_period_start := COALESCE(v_started, now() - interval '12 month');

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

  RETURN QUERY SELECT v_eligible, v_reason, v_month_count, v_year_count, v_max_per_month, v_max_per_year;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_eligibility(uuid) TO authenticated;
