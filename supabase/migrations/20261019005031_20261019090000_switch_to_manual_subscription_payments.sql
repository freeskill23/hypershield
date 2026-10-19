/*
# Switch subscriptions to one-time monthly payments

1. Purpose
- Replace recurring billing eligibility with a manually paid one-month subscription period.
- Grant one free trial application during each active subscription period.

2. Modified database behavior
- Replaces `get_trial_eligibility(uuid)` with the same public return shape used by the app.
- The function now counts applications from `profiles.subscription_started_at` through the current subscription period.
- `max_per_month` and `max_per_year` both return 1 for compatibility with existing clients, while the user-facing meaning is one application per subscription period.

3. Security
- Keeps the function `SECURITY DEFINER` with a fixed `search_path` so eligibility checks can read protected profile and application data without exposing rows.
- Keeps execution limited to authenticated users.

4. Important notes
- Existing trial applications are preserved.
- No tables, columns, or user data are deleted.
- A newly confirmed manual subscription must update `subscription_started_at` and `subscription_expires_at`; the application uses those timestamps for the entitlement window.
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
  v_period_start timestamptz;
  v_period_count integer := 0;
  v_eligible boolean := true;
  v_reason text := '';
  v_max_per_period integer := 1;
BEGIN
  SELECT subscription_status, subscription_expires_at, subscription_started_at
    INTO v_status, v_expires, v_started
  FROM profiles
  WHERE id = p_user_id;

  IF v_status IS NULL OR v_status <> 'active' THEN
    RETURN QUERY SELECT false, '구독이 활성 상태가 아닙니다. 월 구독 결제 후 체험단 신청이 가능합니다.', 0, 0, v_max_per_period, v_max_per_period;
    RETURN;
  END IF;

  IF v_expires IS NOT NULL AND v_expires <= now() THEN
    RETURN QUERY SELECT false, '구독이 만료되었습니다. 월 구독 결제 후 다시 신청할 수 있습니다.', 0, 0, v_max_per_period, v_max_per_period;
    RETURN;
  END IF;

  v_period_start := COALESCE(v_started, now() - interval '1 month');

  SELECT count(*)::integer
    INTO v_period_count
  FROM trial_applications
  WHERE user_id = p_user_id
    AND created_at >= v_period_start
    AND (v_expires IS NULL OR created_at < v_expires);

  IF v_period_count >= v_max_per_period THEN
    v_eligible := false;
    v_reason := '현재 구독 기간의 체험단 무료 신청 1회를 이미 사용했습니다. 다음 월 구독 결제 후 다시 신청할 수 있습니다.';
  ELSE
    v_reason := '체험단 무료 신청이 가능합니다. 현재 구독 기간에 1개 상품을 신청할 수 있습니다.';
  END IF;

  RETURN QUERY SELECT v_eligible, v_reason, v_period_count, v_period_count, v_max_per_period, v_max_per_period;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trial_eligibility(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trial_eligibility(uuid) TO authenticated;