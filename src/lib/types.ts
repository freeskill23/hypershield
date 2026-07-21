export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  my_referral_code: string;
  referred_by_code: string | null;
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

export type OrderStatus = 'pending' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: OrderStatus;
  created_at: string;
}

export interface CartItem {
  product: Product;
  qty: number;
}
