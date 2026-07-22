import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { mockBackend } from './mockBackend';
import { Product, Order, OrderItem, Profile, Category, Address, ReferralRequest } from './types';

// ============================================================
// Generic hook factory for Supabase queries
// ============================================================

function useCollection<T>(
  table: string,
  mockFn: () => Promise<T[]>,
  order?: { column: string; ascending?: boolean },
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setItems(await mockFn());
        return;
      }
      let q = supabase.from(table).select('*');
      if (order) q = q.order(order.column, { ascending: order.ascending ?? false });
      const { data, error } = await q;
      if (error) throw error;
      setItems((data as T[]) ?? []);
    } catch (e) {
      console.error(`${table} load error`, e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [table, mockFn, order?.column, order?.ascending]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

// ============================================================
// Collection hooks
// ============================================================

export function useProducts() {
  return useCollection<Product>('products', () => mockBackend.listProducts(), {
    column: 'created_at',
    ascending: false,
  });
}

export function useCategories() {
  return useCollection<Category>('categories', async () => [], {
    column: 'sort_order',
    ascending: true,
  });
}

export function useOrders() {
  return useCollection<Order>('orders', () => mockBackend.listOrders(), {
    column: 'created_at',
    ascending: false,
  });
}

export function useMyOrders(userId: string | undefined) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setOrders([]);
        return;
      }
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data as Order[]) ?? []);
    } catch (e) {
      console.error('my orders load error', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { orders, loading, refresh };
}

export function useProfiles() {
  return useCollection<Profile>('profiles', () => mockBackend.listProfiles(), {
    column: 'created_at',
    ascending: false,
  });
}

export function useAddresses(userId: string | undefined) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setAddresses([]);
        return;
      }
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setAddresses((data as Address[]) ?? []);
    } catch (e) {
      console.error('addresses load error', e);
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { addresses, loading, refresh };
}

export function useReferralRequests(userId: string | undefined) {
  const [requests, setRequests] = useState<ReferralRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setRequests([]);
        return;
      }
      const { data, error } = await supabase
        .from('referral_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRequests((data as ReferralRequest[]) ?? []);
    } catch (e) {
      console.error('referral requests load error', e);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { requests, loading, refresh };
}

export function useAllReferralRequests() {
  return useCollection<ReferralRequest>('referral_requests', async () => [], {
    column: 'created_at',
    ascending: false,
  });
}

// ============================================================
// Order operations
// ============================================================

export async function createOrderWithItems(input: {
  user_id: string;
  items: { product: Product; qty: number }[];
  address: Address;
}): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const total = input.items.reduce((s, i) => s + i.qty * i.product.club_price, 0);

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      user_id: input.user_id,
      total_amount: total,
      status: 'pending',
      recipient_name: input.address.recipient_name,
      recipient_phone: input.address.recipient_phone,
      address: input.address.address,
      address_detail: input.address.address_detail,
    })
    .select()
    .single();
  if (orderErr) {
    console.error('create order error', orderErr);
    return null;
  }

  const rows = input.items.map((i) => ({
    order_id: order.id,
    product_id: i.product.id,
    product_name: i.product.name,
    product_image: i.product.image_url,
    quantity: i.qty,
    unit_price: i.product.club_price,
    original_price: i.product.original_price,
  }));
  const { error: itemErr } = await supabase.from('order_items').insert(rows);
  if (itemErr) console.error('create order items error', itemErr);

  return order as Order;
}

export async function updateOrderStatus(orderId: string, status: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const patch: Record<string, unknown> = { status };
  if (status === 'shipping') patch.shipped_at = new Date().toISOString();
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) console.error('update order status error', error);
}

export async function updateOrderTracking(
  orderId: string,
  carrier: string,
  trackingNumber: string,
) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('orders')
    .update({ carrier, tracking_number: trackingNumber, shipped_at: new Date().toISOString(), status: 'shipping' })
    .eq('id', orderId);
  if (error) console.error('update tracking error', error);
}

export async function batchUpdateTracking(
  updates: { orderId: string; carrier: string; trackingNumber: string }[],
) {
  if (!isSupabaseConfigured || !supabase) return;
  for (const u of updates) {
    const { error } = await supabase
      .from('orders')
      .update({
        carrier: u.carrier,
        tracking_number: u.trackingNumber,
        shipped_at: new Date().toISOString(),
        status: 'shipping',
      })
      .eq('id', u.orderId);
    if (error) console.error('batch tracking error', error);
  }
}

// ============================================================
// Address operations
// ============================================================

export async function addAddress(input: Omit<Address, 'id' | 'created_at'>): Promise<Address | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('addresses')
    .insert(input)
    .select()
    .single();
  if (error) {
    console.error('add address error', error);
    return null;
  }
  return data as Address;
}

export async function deleteAddress(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('addresses').delete().eq('id', id);
  if (error) console.error('delete address error', error);
}

// ============================================================
// Referral request operations
// ============================================================

export async function submitReferralRequest(userId: string, reason: string): Promise<ReferralRequest | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('referral_requests')
    .insert({ user_id: userId, reason })
    .select()
    .single();
  if (error) {
    console.error('submit referral request error', error);
    return null;
  }
  return data as ReferralRequest;
}

export async function approveReferralRequest(requestId: string): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.rpc('approve_referral_request', { request_id: requestId });
  if (error) {
    console.error('approve referral request error', error);
    return null;
  }
  return data as string;
}

export async function rejectReferralRequest(requestId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('referral_requests')
    .update({ status: 'rejected', approved_at: new Date().toISOString() })
    .eq('id', requestId);
  if (error) console.error('reject referral request error', error);
}

// ============================================================
// Category operations (admin)
// ============================================================

export async function addCategory(name: string, sortOrder: number): Promise<Category | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, sort_order: sortOrder })
    .select()
    .single();
  if (error) {
    console.error('add category error', error);
    return null;
  }
  return data as Category;
}

export async function deleteCategory(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) console.error('delete category error', error);
}

// ============================================================
// Product operations (admin)
// ============================================================

export async function uploadProductImage(file: File): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, file, { cacheControl: '3600', upsert: false });
  if (error) {
    console.error('upload image error', error);
    return null;
  }
  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function addProduct(p: Omit<Product, 'id' | 'created_at'>): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      ...p,
      id: 'mock-' + Math.random().toString(36).slice(2, 10),
      created_at: new Date().toISOString(),
    };
  }
  const { data, error } = await supabase.from('products').insert(p).select().single();
  if (error) {
    console.error('add product error', error);
    return null;
  }
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) console.error('update product error', error);
}

export async function deleteProduct(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) console.error('delete product error', error);
}

// ============================================================
// Profile operations (admin)
// ============================================================

export async function setProfileRole(user_id: string, role: 'member' | 'admin') {
  if (!isSupabaseConfigured || !supabase) {
    await mockBackend.updateProfileRole(user_id, role);
    return;
  }
  const { error } = await supabase.from('profiles').update({ role }).eq('id', user_id);
  if (error) console.error('update role error', error);
}

export async function deleteProfile(user_id: string) {
  if (!isSupabaseConfigured || !supabase) {
    await mockBackend.deleteProfile(user_id);
    return;
  }
  const { error } = await supabase.from('profiles').delete().eq('id', user_id);
  if (error) console.error('delete profile error', error);
}

// Legacy export kept for backward compatibility
export async function createOrder(input: { user_id: string; total_amount: number }): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) {
    return mockBackend.createOrder(input);
  }
  const { data, error } = await supabase
    .from('orders')
    .insert({ user_id: input.user_id, total_amount: input.total_amount, status: 'pending' })
    .select()
    .single();
  if (error) {
    console.error('create order error', error);
    return null;
  }
  return data as Order;
}
