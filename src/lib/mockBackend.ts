import { Profile, Product, Order } from './types';
import { MOCK_PRODUCTS, MOCK_ADMIN_CODE } from './mockData';

// In-memory mock backend that mirrors Supabase behavior for local/demo use.
// This is used only when Supabase env vars are missing.

interface MockSession {
  user: { id: string; email: string };
  access_token: string;
}

interface StoredAccount {
  id: string;
  email: string;
  password: string;
  profile: Profile;
}

const ACCOUNTS_KEY = 'hypershield_mock_accounts';
const SESSION_KEY = 'hypershield_mock_session';
const ORDERS_KEY = 'hypershield_mock_orders';

function uid(): string {
  return 'mock-' + Math.random().toString(36).slice(2, 10);
}

function genReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return 'HYPER-' + s;
}

function loadAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAccount[];
  } catch {
    return [];
  }
}

function saveAccounts(accts: StoredAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accts));
}

function loadOrders(): Order[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

function saveOrders(orders: Order[]) {
  localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

// Seed an admin account on first run so the admin dashboard is reachable.
export function ensureMockSeed() {
  const accts = loadAccounts();
  if (!accts.some((a) => a.profile.role === 'admin')) {
    const admin: StoredAccount = {
      id: uid(),
      email: 'admin@hypershield.club',
      password: 'admin1234',
      profile: {
        id: uid(),
        email: 'admin@hypershield.club',
        full_name: '클럽 마스터',
        role: 'admin',
        my_referral_code: MOCK_ADMIN_CODE,
        referred_by_code: null,
        created_at: new Date(Date.now() - 86400000 * 60).toISOString(),
      },
    };
    accts.push(admin);
    saveAccounts(accts);
  }
  if (loadOrders().length === 0) {
    // Seed a few historical orders for the admin so the dashboard has data.
    const admin = loadAccounts().find((a) => a.profile.role === 'admin');
    if (admin) {
      const seedOrders: Order[] = [
        {
          id: uid(),
          user_id: admin.profile.id,
          total_amount: 74000,
          status: 'completed',
          created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
        },
        {
          id: uid(),
          user_id: admin.profile.id,
          total_amount: 119000,
          status: 'completed',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        },
      ];
      saveOrders(seedOrders);
    }
  }
}

export const mockBackend = {
  async signUp(input: {
    email: string;
    password: string;
    full_name: string;
    referral_code: string;
  }): Promise<{ session: MockSession; profile: Profile }> {
    const accts = loadAccounts();
    if (accts.some((a) => a.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('이미 가입된 이메일입니다.');
    }
    // Validate referral code: must match an existing account's my_referral_code.
    const referrer = accts.find((a) => a.profile.my_referral_code === input.referral_code);
    if (!referrer) {
      throw new Error('유효하지 않은 초대 코드입니다. 기존 회원의 코드가 필요합니다.');
    }
    const id = uid();
    let code = genReferralCode();
    while (accts.some((a) => a.profile.my_referral_code === code)) code = genReferralCode();
    const profile: Profile = {
      id,
      email: input.email,
      full_name: input.full_name,
      role: 'member',
      my_referral_code: code,
      referred_by_code: input.referral_code,
      created_at: new Date().toISOString(),
    };
    const acct: StoredAccount = { id, email: input.email, password: input.password, profile };
    accts.push(acct);
    saveAccounts(accts);
    const session: MockSession = { user: { id, email: input.email }, access_token: 'mock-' + uid() };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { session, profile };
  },

  async signIn(input: { email: string; password: string }): Promise<{ session: MockSession; profile: Profile }> {
    const accts = loadAccounts();
    const acct = accts.find((a) => a.email.toLowerCase() === input.email.toLowerCase());
    if (!acct || acct.password !== input.password) {
      throw new Error('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    const session: MockSession = {
      user: { id: acct.id, email: acct.email },
      access_token: 'mock-' + uid(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return { session, profile: acct.profile };
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  getSession(): { session: MockSession; profile: Profile } | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as MockSession;
    const accts = loadAccounts();
    const acct = accts.find((a) => a.id === session.user.id);
    if (!acct) return null;
    return { session, profile: acct.profile };
  },

  async listProfiles(): Promise<Profile[]> {
    return loadAccounts().map((a) => a.profile);
  },

  async validateReferralCode(code: string): Promise<boolean> {
    return loadAccounts().some((a) => a.profile.my_referral_code === code);
  },

  async listProducts(): Promise<Product[]> {
    return MOCK_PRODUCTS;
  },

  async listOrders(): Promise<Order[]> {
    return loadOrders();
  },

  async createOrder(input: { user_id: string; total_amount: number }): Promise<Order> {
    const orders = loadOrders();
    const order: Order = {
      id: uid(),
      user_id: input.user_id,
      total_amount: input.total_amount,
      status: 'completed',
      created_at: new Date().toISOString(),
    };
    orders.push(order);
    saveOrders(orders);
    return order;
  },

  async updateProfileRole(user_id: string, role: 'member' | 'admin') {
    const accts = loadAccounts();
    const a = accts.find((x) => x.profile.id === user_id);
    if (a) {
      a.profile.role = role;
      saveAccounts(accts);
    }
  },

  async deleteProfile(user_id: string) {
    const accts = loadAccounts().filter((a) => a.profile.id !== user_id);
    saveAccounts(accts);
    const orders = loadOrders().filter((o) => o.user_id !== user_id);
    saveOrders(orders);
  },
};
