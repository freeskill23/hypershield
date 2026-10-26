/*
# Add cash receipt fields to orders

## Summary
무통장입금 주문 시 현금영수증 신청 정보를 저장할 수 있도록 orders 테이블에 컬럼을 추가합니다.

## Changes
- `orders.cash_receipt_type` (text, nullable): 현금영수증 발급 유형 ('personal' 소득공제 / 'business' 지출증빙)
- `orders.cash_receipt_number` (text, nullable): 현금영수증 발급 번호 (휴대폰 번호 또는 사업자등록번호)
- `orders.cash_receipt_requested` (boolean, default false): 현금영수증 신청 여부

## Security
- RLS 정책 변경 없음. 기존 orders 테이블 정책 그대로 적용됩니다.
- 기존 컬럼 권한 변경 없음.
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_receipt_type text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_receipt_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cash_receipt_requested boolean NOT NULL DEFAULT false;
