/*
# 1:1 문의 게시판 테이블 추가

1. New Tables
- `inquiries` — 회원 1:1 문의 게시판
  - `id` (uuid, PK)
  - `user_id` (uuid, FK auth.users, 문의 작성자)
  - `title` (text, 문의 제목)
  - `content` (text, 문의 내용)
  - `status` (text, 'waiting' | 'answered', 기본 'waiting')
  - `answer` (text, 관리자 답변 내용, nullable)
  - `answered_at` (timestamptz, 답변 작성 시간, nullable)
  - `answered_by` (uuid, FK auth.users, 답변한 관리자, nullable)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- RLS 활성화
- 회원은 본인 문의만 SELECT/INSERT 가능
- 회원은 본인 문의 수정/삭제 불가 (이미 답변했거나 대기 중이든)
- 관리자는 모든 문의 SELECT/UPDATE 가능 (answer, status, answered_at, answered_by 컬럼만)
- 관리자 INSERT/DELETE 불가 (관리자가 직접 문의를 생성하거나 삭제할 수 없음)
*/

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'answered')),
  answer text,
  answered_at timestamptz,
  answered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- 회원: 본인 문의만 조회
DROP POLICY IF EXISTS "select_own_inquiries" ON inquiries;
CREATE POLICY "select_own_inquiries"
ON inquiries FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 회원: 본인 문의 작성
DROP POLICY IF EXISTS "insert_own_inquiries" ON inquiries;
CREATE POLICY "insert_own_inquiries"
ON inquiries FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 관리자: 모든 문의 조회 (admin role 체크)
DROP POLICY IF EXISTS "admin_select_inquiries" ON inquiries;
CREATE POLICY "admin_select_inquiries"
ON inquiries FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 관리자: 문의에 답변 작성 (answer, status, answered_at, answered_by, updated_at만 업데이트)
DROP POLICY IF EXISTS "admin_update_inquiries" ON inquiries;
CREATE POLICY "admin_update_inquiries"
ON inquiries FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_inquiries_user_id ON inquiries(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries(created_at DESC);
