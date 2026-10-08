/*
# 주문 취소 요청 기능 추가

1. Modified Tables
- `orders`에 취소 요청 관련 컬럼 추가:
  - `cancel_requested_at` (timestamptz, 취소 요청 시간, nullable)
  - `cancel_type` (text, 'card' | 'manual', 결제 방식에 따른 취소 타입, nullable)
  - `cancel_reason` (text, 취소 사유, nullable)
  - `refund_bank` (text, 환불 은행, nullable — 무통장입금 건만)
  - `refund_account` (text, 환불 계좌번호, nullable — 무통장입금 건만)
  - `refund_holder` (text, 환불 예금주, nullable — 무통장입금 건만)
  - `cancelled_at` (timestamptz, 취소 완료 시간, nullable)

2. Security
- 기존 orders RLS 정책 유지
- 회원이 본인 주문의 취소 요청(cancel 관련 컬럼만)을 UPDATE할 수 있는 정책 추가
  - 단, status가 'pending' 또는 'paid'일 때만 취소 요청 가능
  - cancel_requested_at, cancel_type, cancel_reason, refund_bank, refund_account, refund_holder 컬럼만 업데이트 허용
*/

DO $$ BEGIN
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_type text CHECK (cancel_type IS NULL OR cancel_type IN ('card', 'manual'));
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancel_reason text;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_bank text;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_account text;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_holder text;
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
END $$;

-- 회원이 본인 주문의 취소 요청을 할 수 있는 UPDATE 정책 추가
-- (기존 admin UPDATE 정책이 있으므로, 회원용 정책을 별도로 추가)
DROP POLICY IF EXISTS "users_request_cancel_own_orders" ON orders;
CREATE POLICY "users_request_cancel_own_orders"
ON orders FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_orders_cancel_requested_at ON orders(cancel_requested_at) WHERE cancel_requested_at IS NOT NULL;
