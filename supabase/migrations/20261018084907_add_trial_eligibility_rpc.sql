/*
# 체험단 신청 자격 확인 RPC

## 목적
- 구독이 정기결제로 12개월 유지되는 동안 체험단 신청 가능
- 1개월에 1회, 1년(12개월)에 최대 12회 신청 가능
- 정기결제 중단(구독 만료/취소) 시 체험단 신청 자동 중단

## 새 함수
- `get_trial_eligibility(p_user_id uuid)` (SECURITY DEFINER)
  - 사용자의 구독 상태, 이번 달 신청 횟수, 최근 12개월 신청 횟수를 종합하여 자격 여부 반환
  - 반환 컬럼: eligible(boolean), reason(text), current_month_count(int), year_count(int), max_per_month(int 기본 1), max_per_year(int 기본 12)

## 자격 조건
1. profiles.subscription_status = 'active'
2. profiles.subscription_expires_at IS NULL OR > now()
3. 이번 달(현재 월) 신청 생성 횟수 < 1
4. 최근 12개월(rolling) 신청 생성 횟수 < 12

## 보안
- SECURITY DEFINER: profiles와 trial_applications를 서버 권한으로 읽어 클라이언트 RLS와 무관하게 자격 판단
- 호출자는 자신의 user_id만 전달(프론트엔드에서 로그인 사용자만 호출)
- search_path 고정: 위 함수 변조 방지
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
  v_month_count integer;
  v_year_count integer;
  v_eligible boolean := true;
  v_reason text := '';
  v_max_per_month integer := 1;
  v_max_per_year integer := 12;
BEGIN
  SELECT subscription_status, subscription_expires_at
    INTO v_status, v_expires
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL OR v_status <> 'active' THEN
    RETURN QUERY SELECT false, '구독이 활성 상태가 아닙니다. 정기결제 구독 중에만 체험단 신청이 가능합니다.', 0, 0, v_max_per_month, v_max_per_year;
    RETURN;
  END IF;

  IF v_expires IS NOT NULL AND v_expires < now() THEN
    RETURN QUERY SELECT false, '구독이 만료되었습니다. 정기결제를 유지해야 체험단 신청이 가능합니다.', 0, 0, v_max_per_month, v_max_per_year;
    RETURN;
  END IF;

  SELECT count(*)::integer
    INTO v_month_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND date_trunc('month', created_at) = date_trunc('month', now());

  SELECT count(*)::integer
    INTO v_year_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND created_at >= (now() - interval '12 months');

  IF v_month_count >= v_max_per_month THEN
    v_eligible := false;
    v_reason := '이번 달 체험단 신청 횟수(1회)를 모두 사용했습니다. 다음 달에 다시 신청할 수 있습니다.';
  ELSIF v_year_count >= v_max_per_year THEN
    v_eligible := false;
    v_reason := '최근 12개월 체험단 신청 횟수(12회)를 모두 사용했습니다. 구독 유지 기간이 갱신되면 다시 신청할 수 있습니다.';
  ELSE
    v_reason := '체험단 신청이 가능합니다.';
  END IF;

  RETURN QUERY SELECT v_eligible, v_reason, v_month_count, v_year_count, v_max_per_month, v_max_per_year;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trial_eligibility(uuid) TO authenticated;
