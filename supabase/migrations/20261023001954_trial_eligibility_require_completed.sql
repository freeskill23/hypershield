/*
# 체험단 자격 판정: 완료 처리 필수

## 목적
- 관리자가 체험단 신청을 완료(completed) 처리하지 않으면, 다음 달 체험단 1회 신청이 열리지 않도록 변경.
- 후기 미작성 또는 성의 없는 후기 → 관리자가 완료 처리 보류 → 회원은 새 신청 불가.

## 변경 내용
1. 새 조건 추가: 이전 달 이전에 생성된 non-rejected, non-completed 신청이 있으면 자격 불가.
   - reason: "이전 체험단 신청이 완료 처리되지 않았습니다. 관리자 완료处理后 다시 신청할 수 있습니다."
2. 월별 카운트: 기존대로 non-rejected 신청을 당월 기준으로 카운트 (당월 중복 신청 방지 유지).
3. 연별 카운트: 기존대로 non-rejected 신청을 연결제 기간 내에서 카운트.
4. 거절(rejected) 신청은 카운트에서 제외 (기존 로직 유지).

## 보안
- SECURITY DEFINER 유지, search_path = public 고정.
- 실행 권한은 authenticated로 제한 (기존과 동일).
*/

CREATE OR REPLACE FUNCTION public.get_trial_eligibility(p_user_id uuid)
RETURNS TABLE (
  eligible boolean,
  reason text,
  current_month_count integer,
  year_count integer,
  max_per_month integer,
  max_per_year integer,
  next_eligible_date timestamptz
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
  v_incomplete_count integer := 0;
  v_period_start timestamptz;
  v_eligible boolean := true;
  v_reason text := '';
  v_next_eligible timestamptz := NULL;
BEGIN
  SELECT subscription_status, subscription_expires_at, subscription_started_at, subscription_billing_period
    INTO v_status, v_expires, v_started, v_period
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL OR v_status <> 'active' THEN
    RETURN QUERY SELECT false, '구독이 활성 상태가 아닙니다. 구독 결제 후 체험단 신청이 가능합니다.', 0, 0, v_max_per_month, v_max_per_year, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RETURN QUERY SELECT false, '구독이 만료되었습니다. 구독 결제 후 다시 신청할 수 있습니다.', 0, 0, v_max_per_month, v_max_per_year, NULL::timestamptz;
    RETURN;
  END IF;

  IF v_period IS NULL OR v_period <> 'annual' THEN
    RETURN QUERY SELECT false, '체험단 무료 신청은 12개월 연 결제 회원만 이용할 수 있습니다. 연 결제로 변경하신 후 신청할 수 있습니다.', 0, 0, v_max_per_month, v_max_per_year, NULL::timestamptz;
    RETURN;
  END IF;

  v_period_start := COALESCE(v_started, now() - interval '12 month');

  -- 당월 non-rejected 신청 카운트 (당월 중복 신청 방지)
  SELECT count(*)::integer
    INTO v_month_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND status <> 'rejected'
    AND created_at >= date_trunc('month', now())
    AND created_at < date_trunc('month', now()) + interval '1 month';

  -- 연결제 기간 내 non-rejected 신청 카운트
  SELECT count(*)::integer
    INTO v_year_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND status <> 'rejected'
    AND created_at >= v_period_start
    AND (v_expires IS NULL OR created_at < v_expires);

  -- 이전 달 이전에 생성된, 완료되지 않은 non-rejected 신청 카운트
  SELECT count(*)::integer
    INTO v_incomplete_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND status NOT IN ('rejected', 'completed')
    AND created_at < date_trunc('month', now());

  IF v_incomplete_count > 0 THEN
    v_eligible := false;
    v_reason := '이전 체험단 신청이 아직 완료 처리되지 않았습니다. 후기 작성 및 관리자 완료 처리 후 다시 신청할 수 있습니다.';
    v_next_eligible := NULL;
  ELSIF v_month_count >= v_max_per_month THEN
    v_eligible := false;
    v_reason := '이번 달 체험단 무료 신청(1회)을 이미 사용했습니다.';
    v_next_eligible := date_trunc('month', now()) + interval '1 month';
  ELSIF v_year_count >= v_max_per_year THEN
    v_eligible := false;
    v_reason := '연 결제 혜택의 무료 체험 횟수(12회)를 모두 사용했습니다. 다음 연 결제 시 다시 이용할 수 있습니다.';
  ELSE
    v_reason := '연 결제 혜택: 매월 1회, 12개월간 최대 12회 무료 체험 신청이 가능합니다.';
  END IF;

  RETURN QUERY SELECT v_eligible, v_reason, v_month_count, v_year_count, v_max_per_month, v_max_per_year, v_next_eligible;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_eligibility(uuid) TO authenticated;
