import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import { GroupBuy, Participant, Profile } from './types';

// ============================================================
// Collection hooks
// ============================================================

function useCollection<T>(
  table: string,
  order?: { column: string; ascending?: boolean },
  enabled: boolean = true,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const orderCol = order?.column;
  const orderAsc = order?.ascending;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setItems([]);
        return;
      }
      let q = supabase.from(table).select('*');
      if (orderCol) q = q.order(orderCol, { ascending: orderAsc ?? false });
      const { data, error } = await q;
      if (error) throw error;
      setItems((data as T[]) ?? []);
    } catch (e) {
      console.error(`${table} load error`, e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [table, orderCol, orderAsc]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { items, loading, refresh };
}

export function useGroupBuys(enabled: boolean = true) {
  return useCollection<GroupBuy>('group_buys', { column: 'created_at', ascending: false }, enabled);
}

export function useProfiles(enabled: boolean = true) {
  return useCollection<Profile>('profiles', { column: 'created_at', ascending: false }, enabled);
}

export function useParticipants(enabled: boolean = true) {
  return useCollection<Participant>('participants', { column: 'created_at', ascending: false }, enabled);
}

export function useMyParticipations(userId: string | undefined) {
  const [items, setItems] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        setItems([]);
        return;
      }
      const { data, error } = await supabase
        .from('participants')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as Participant[]) ?? []);
    } catch (e) {
      console.error('my participations load error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, loading, refresh };
}

// ============================================================
// Group Buy operations
// ============================================================

export async function createGroupBuy(input: {
  title: string;
  description: string;
  image_url: string | null;
  original_price: number;
  group_price: number;
  target_count: number;
  deadline: string;
}): Promise<GroupBuy | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('group_buys')
    .insert({
      title: input.title,
      description: input.description || null,
      image_url: input.image_url,
      original_price: input.original_price,
      group_price: input.group_price,
      target_count: input.target_count,
      deadline: input.deadline,
    })
    .select()
    .single();
  if (error) {
    console.error('create group buy error', error);
    return null;
  }
  return data as GroupBuy;
}

export async function updateGroupBuy(id: string, patch: Partial<GroupBuy>) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('group_buys').update(patch).eq('id', id);
  if (error) console.error('update group buy error', error);
}

export async function deleteGroupBuy(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('group_buys').delete().eq('id', id);
  if (error) console.error('delete group buy error', error);
}

// ============================================================
// Participant operations
// ============================================================

export async function joinGroupBuy(groupBuyId: string): Promise<Participant | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('participants')
    .insert({ group_buy_id: groupBuyId })
    .select()
    .single();
  if (error) {
    console.error('join group buy error', error);
    return null;
  }
  return data as Participant;
}

export async function cancelParticipation(participantId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('participants')
    .update({ status: 'cancelled' })
    .eq('id', participantId);
  if (error) console.error('cancel participation error', error);
}

export async function submitAddress(
  participantId: string,
  address: {
    recipient_name: string;
    recipient_phone: string;
    address: string;
    address_detail: string;
  },
) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('participants')
    .update({
      recipient_name: address.recipient_name,
      recipient_phone: address.recipient_phone,
      address: address.address,
      address_detail: address.address_detail,
      status: 'address_submitted',
    })
    .eq('id', participantId);
  if (error) console.error('submit address error', error);
}

export async function confirmDeposit(participantId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('participants')
    .update({
      status: 'deposited',
      deposit_confirmed_at: new Date().toISOString(),
    })
    .eq('id', participantId);
  if (error) console.error('confirm deposit error', error);
}

export async function markShipped(participantId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('participants')
    .update({ status: 'shipped' })
    .eq('id', participantId);
  if (error) console.error('mark shipped error', error);
}

// ============================================================
// Profile operations (admin)
// ============================================================

export async function setProfileRole(user_id: string, role: 'member' | 'admin') {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('profiles').update({ role }).eq('id', user_id);
  if (error) console.error('update role error', error);
}

export async function deleteProfile(user_id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.from('profiles').delete().eq('id', user_id);
  if (error) console.error('delete profile error', error);
}

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
