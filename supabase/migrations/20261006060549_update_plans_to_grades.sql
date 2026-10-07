/*
# Update subscription plans to member grade system

## Overview
Renames existing subscription plans from "스탠다드/프리미엄" to grade-based names
"일반회원/특별회원" to match the new member grade concept.

## Changes
- Updates subscription_plans rows:
  - '스탠다드' → '일반회원', description updated
  - '프리미엄' → '특별회원', description updated
- Adds a third grade 'VIP회원' for future expansion

## Security
No security changes — same RLS policies apply.
*/

UPDATE subscription_plans SET name = '일반회원', description = '일반 등급 — 모든 제품 50% 할인' WHERE tier = 'standard';
UPDATE subscription_plans SET name = '특별회원', description = '특별 등급 — 모든 제품 60% 할인 + 우선 배송' WHERE tier = 'premium';

INSERT INTO subscription_plans (name, description, monthly_price, tier, discount_rate, is_active, sort_order)
SELECT 'VIP회원', 'VIP 등급 — 모든 제품 70% 할인 + 우선 배송 + 신상품 선구매', 29900, 'vip', 70, true, 2
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE tier = 'vip');
