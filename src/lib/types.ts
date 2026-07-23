export type Role = 'member' | 'admin';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  phone: string | null;
  my_referral_code: string | null;
  referred_by_code: string | null;
  points: number;
  created_at: string;
}

export type GroupBuyStatus = 'recruiting' | 'succeeded' | 'failed' | 'cancelled';

export interface GroupBuy {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  original_price: number;
  group_price: number;
  target_count: number;
  current_count: number;
  deadline: string;
  status: GroupBuyStatus;
  bank_account: string | null;
  bank_holder: string | null;
  created_at: string;
}

export type ParticipantStatus = 'joined' | 'deposited' | 'address_submitted' | 'shipped' | 'cancelled';

export interface Participant {
  id: string;
  group_buy_id: string;
  user_id: string;
  status: ParticipantStatus;
  recipient_name: string | null;
  recipient_phone: string | null;
  address: string | null;
  address_detail: string | null;
  deposit_confirmed_at: string | null;
  created_at: string;
}
