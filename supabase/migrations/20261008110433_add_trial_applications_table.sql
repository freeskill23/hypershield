/*
# 체험단(Trial Reviewer) 신청 시스템

1. New Tables
- `trial_applications` — 구독자 체험단 신청 정보
  - `id` (uuid, PK)
  - `user_id` (uuid, NOT NULL DEFAULT auth.uid(), FK → profiles)
  - `product_id` (uuid, FK → products)
  - `reason` (text, 신청 이유)
  - `recipient_name` (text, 성함)
  - `recipient_phone` (text, 연락처)
  - `address` (text, 주소)
  - `address_detail` (text, 상세주소)
  - `review_platform` (text, 리뷰 작성 예정 플랫폼/주소)
  - `agreed` (boolean, NOT NULL, 약관 동의 여부)
  - `status` (text, NOT NULL DEFAULT 'pending') — pending / approved / rejected / shipped / completed
  - `reject_reason` (text, 거절 사유 - 관리자 입력)
  - `shipped_at` (timestamptz, 발송일)
  - `review_url` (text, 회원이 제출한 리뷰 URL)
  - `review_url_submitted_at` (timestamptz, 리뷰 URL 제출일)
  - `admin_comment` (text, 관리자 완료 코멘트)
  - `completed_at` (timestamptz, 완료일)
  - `created_at` (timestamptz, DEFAULT now())
  - `updated_at` (timestamptz, DEFAULT now())

2. Constraints
- UNIQUE(user_id, product_id) — 동일 상품 중복 신청 방지
- status CHECK: pending, approved, rejected, shipped, completed

3. Indexes
- idx_trial_applications_user_id (user_id)
- idx_trial_applications_status (status)
- idx_trial_applications_created_at (created_at DESC)

4. Security (RLS)
- RLS enabled on trial_applications
- 사용자: 자신의 신청만 SELECT / INSERT / UPDATE(리뷰 URL 제출용)
- 관리자: 전체 SELECT / UPDATE / DELETE (profiles.role = 'admin')
*/

CREATE TABLE IF NOT EXISTS trial_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  reason text,
  recipient_name text,
  recipient_phone text,
  address text,
  address_detail text,
  review_platform text,
  agreed boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  reject_reason text,
  shipped_at timestamptz,
  review_url text,
  review_url_submitted_at timestamptz,
  admin_comment text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT trial_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'shipped', 'completed')),
  CONSTRAINT trial_unique_user_product UNIQUE (user_id, product_id)
);

ALTER TABLE trial_applications ENABLE ROW LEVEL SECURITY;

-- 사용자: 자신의 신청 조회
DROP POLICY IF EXISTS "select_own_trial_applications" ON trial_applications;
CREATE POLICY "select_own_trial_applications"
ON trial_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 사용자: 신청 생성
DROP POLICY IF EXISTS "insert_own_trial_applications" ON trial_applications;
CREATE POLICY "insert_own_trial_applications"
ON trial_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 사용자: 자신의 신청 수정 (리뷰 URL 제출용 - review_url, review_url_submitted_at, updated_at만)
DROP POLICY IF EXISTS "update_own_trial_applications" ON trial_applications;
CREATE POLICY "update_own_trial_applications"
ON trial_applications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 관리자: 전체 조회
DROP POLICY IF EXISTS "admin_select_trial_applications" ON trial_applications;
CREATE POLICY "admin_select_trial_applications"
ON trial_applications FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 관리자: 상태 변경, 거절사유 입력, 발송, 완료
DROP POLICY IF EXISTS "admin_update_trial_applications" ON trial_applications;
CREATE POLICY "admin_update_trial_applications"
ON trial_applications FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 관리자: 삭제
DROP POLICY IF EXISTS "admin_delete_trial_applications" ON trial_applications;
CREATE POLICY "admin_delete_trial_applications"
ON trial_applications FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_trial_applications_user_id ON trial_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_applications_status ON trial_applications(status);
CREATE INDEX IF NOT EXISTS idx_trial_applications_created_at ON trial_applications(created_at DESC);
