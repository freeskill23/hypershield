export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  my_referral_code: string | null;
  referred_by_code: string | null;
  points: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  original_price: number;
  club_price: number;
  description: string | null;
  image_url: string | null;
  stock: number;
  created_at: string;
}

export type OrderStatus = 'pending' | 'shipping_ready' | 'shipping' | 'delivered' | 'cancelled';

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
  order_items?: OrderItem[];
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

export type ReferralRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ReferralRequest {
  id: string;
  user_id: string;
  reason: string;
  status: ReferralRequestStatus;
  assigned_code: string | null;
  created_at: string;
  approved_at: string | null;
}

export interface CartItem {
  product: Product;
  qty: number;
}
