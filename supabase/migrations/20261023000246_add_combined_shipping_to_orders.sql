/*
# 체험단 합배송 기능 추가

1. Modified Tables
- `orders` 테이블에 두 컬럼 추가:
  - `combined_shipping` (boolean, NOT NULL DEFAULT false) — 체험단과 합배송 요청 여부
  - `trial_application_id` (uuid, nullable, FK → trial_applications) — 연결된 체험단 신청

2. Security
- 기존 orders 테이블의 RLS 정책이 그대로 적용됨
- trial_application_id 컬럼은 사용자가 INSERT 시 설정 가능 (자신의 신청만)
- 관리자는 기존 UPDATE 정책으로 모든 필드 확인 가능
- FK 제약조건으로 존재하지 않는 trial_application은 참조 불가

3. Important Notes
- combined_shipping이 true인 주문은 배송료가 일반 주문분만 부과됨 (체험단분은 무료배송)
- 회원이 결제 페이지에서 승인된 체험단 신청이 있을 때만 옵션 표시
- trial_application_id로 관리자가 어떤 체험단과 합배송인지 추적 가능
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS combined_shipping boolean NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS trial_application_id uuid REFERENCES trial_applications(id) ON DELETE SET NULL;
