export type Role = 'member' | 'admin';

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'cancelled' | 'expired';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  cafe_nickname: string | null;
  phone: string | null;
  subscription_plan_id: string | null;
  subscription_tier: string | null;
  subscription_status: SubscriptionStatus;
  subscription_expires_at: string | null;
  subscription_started_at: string | null;
  my_referral_code: string | null;
  referred_by_code: string | null;
  points: number;
  created_at: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  tier: string;
  discount_rate: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  visible_grades: string[] | null;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  category_id: string | null;
  original_price: number;
  club_price: number;
  description: string | null;
  image_url: string | null;
  sub_images: string[] | null;
  sku: string | null;
  stock: number;
  is_active: boolean;
  sort_order: number;
  detail_link: string | null;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
}

export interface CartItemWithProduct extends CartItem {
  product: Product | null;
}

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: OrderStatus;
  recipient_name: string | null;
  recipient_phone: string | null;
  address: string | null;
  address_detail: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: string | null;
  points_used: number;
  points_earned: number;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  original_price: number;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  recipient_name: string;
  recipient_phone: string;
  address: string;
  address_detail: string | null;
  is_default: boolean;
  created_at: string;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string;
}

export type PostVisibility = 'public' | 'members';

export interface Post {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  category: string | null;
  visibility: PostVisibility;
  is_pinned: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}
