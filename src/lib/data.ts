import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { mockBackend } from './mockBackend';
import { Product, Order, Profile } from './types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setProducts(await mockBackend.listProducts());
        return;
      }
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProducts((data as Product[]) ?? []);
    } catch (e) {
      console.error('products load error', e);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { products, loading, refresh };
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setOrders(await mockBackend.listOrders());
        return;
      }
      const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setOrders((data as Order[]) ?? []);
    } catch (e) {
      console.error('orders load error', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { orders, loading, refresh };
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setProfiles(await mockBackend.listProfiles());
        return;
      }
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setProfiles((data as Profile[]) ?? []);
    } catch (e) {
      console.error('profiles load error', e);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profiles, loading, refresh };
}

export async function createOrder(input: { user_id: string; total_amount: number }): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) {
    return mockBackend.createOrder(input);
  }
  const { data, error } = await supabase
    .from('orders')
    .insert({ user_id: input.user_id, total_amount: input.total_amount, status: 'completed' })
    .select()
    .single();
  if (error) {
    console.error('create order error', error);
    return null;
  }
  return data as Order;
}

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
  // Admin delete: RLS allows admin to delete.
  const { error } = await supabase.from('profiles').delete().eq('id', user_id);
  if (error) console.error('delete profile error', error);
}

export async function addProduct(p: Omit<Product, 'id' | 'created_at'>): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Mock backend doesn't persist new products; return a synthetic one.
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
