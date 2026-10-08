import { useEffect, useState, useCallback } from 'react';
import { adminSupabase, isAdminSupabaseConfigured } from './adminSupabase';
import {
  Profile, SubscriptionPlan, Category, Product, ProductOption, Order, OrderItem, Post, Setting,
} from './types';

function useAdminCollection<T>(
  table: string,
  order?: { column: string; ascending?: boolean },
  enabled: boolean = true,
  filter?: { column: string; value: any },
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const orderCol = order?.column;
  const orderAsc = order?.ascending;
  const filterCol = filter?.column;
  const filterVal = filter?.value;

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isAdminSupabaseConfigured || !adminSupabase) {
        setItems([]);
        return;
      }
      let q = adminSupabase.from(table).select('*');
      if (filterCol && filterVal !== undefined) q = q.eq(filterCol, filterVal);
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
  }, [table, orderCol, orderAsc, filterCol, filterVal]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { items, loading, refresh };
}

export function useAdminProducts(enabled: boolean = true) {
  return useAdminCollection<Product>('products', { column: 'sort_order', ascending: true }, enabled);
}
export function useAdminCategories(enabled: boolean = true) {
  return useAdminCollection<Category>('categories', { column: 'sort_order', ascending: true }, enabled);
}
export function useAdminOrders(enabled: boolean = true) {
  return useAdminCollection<Order>('orders', { column: 'created_at', ascending: false }, enabled);
}

export function useAdminOrderItems(enabled: boolean = true) {
  return useAdminCollection<OrderItem>('order_items', { column: 'created_at', ascending: true }, enabled);
}
export function useAdminProfiles(enabled: boolean = true) {
  return useAdminCollection<Profile>('profiles', { column: 'created_at', ascending: false }, enabled);
}
export function useAdminPosts(enabled: boolean = true) {
  return useAdminCollection<Post>('posts', { column: 'created_at', ascending: false }, enabled);
}
export function useAdminPlans(enabled: boolean = true) {
  return useAdminCollection<SubscriptionPlan>('subscription_plans', { column: 'sort_order', ascending: true }, enabled);
}
export function useAdminSettings(enabled: boolean = true) {
  return useAdminCollection<Setting>('settings', undefined, enabled);
}

export function getSettingValue(settings: Setting[], key: string): string | null {
  return settings.find((s) => s.key === key)?.value ?? null;
}

export async function updateSetting(key: string, value: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  const { error } = await adminSupabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error('update setting error', error);
}

export async function createProduct(input: {
  name: string; category: string; category_id?: string | null; category_ids?: string[] | null;
  original_price: number; club_price: number; description?: string;
  image_url?: string | null; sub_images?: string[] | null;
  sku?: string | null; stock?: number; sort_order?: number;
  detail_link?: string | null; options?: ProductOption[] | null;
  youtube_urls?: string[] | null;
  use_default_shipping?: boolean; shipping_fee?: number | null; shipping_type?: string;
}): Promise<Product | null> {
  if (!isAdminSupabaseConfigured || !adminSupabase) return null;
  const { data, error } = await adminSupabase.from('products').insert({
    name: input.name, category: input.category, category_id: input.category_id ?? null,
    category_ids: input.category_ids ?? null,
    original_price: input.original_price, club_price: input.club_price,
    description: input.description || null, image_url: input.image_url ?? null,
    sub_images: input.sub_images ?? null, sku: input.sku ?? null,
    stock: input.stock ?? 100, sort_order: input.sort_order ?? 0, is_active: true,
    detail_link: input.detail_link ?? null,
    options: input.options ?? null,
    youtube_urls: input.youtube_urls ?? null,
    use_default_shipping: input.use_default_shipping ?? true,
    shipping_fee: input.shipping_fee ?? null,
    shipping_type: input.shipping_type ?? 'default',
  }).select().single();
  if (error) { console.error('create product error', error); return null; }
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  const { error } = await adminSupabase.from('products').update(patch).eq('id', id);
  if (error) console.error('update product error', error);
}

export async function deleteProduct(id: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  const { error } = await adminSupabase.from('products').delete().eq('id', id);
  if (error) console.error('delete product error', error);
}

export async function createCategory(name: string, sortOrder: number = 0, visibleGrades: string[] | null = null) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('categories').insert({ name, sort_order: sortOrder, visible_grades: visibleGrades });
}
export async function updateCategory(id: string, patch: Partial<Category>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('categories').update(patch).eq('id', id);
}
export async function deleteCategory(id: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('categories').delete().eq('id', id);
}

export async function createPost(input: {
  title: string; content: string; excerpt?: string; category?: string;
  visibility: 'public' | 'members'; is_pinned?: boolean;
}): Promise<Post | null> {
  if (!isAdminSupabaseConfigured || !adminSupabase) return null;
  const { data, error } = await adminSupabase.from('posts').insert({
    title: input.title, content: input.content, excerpt: input.excerpt || null,
    category: input.category || null, visibility: input.visibility, is_pinned: input.is_pinned ?? false,
  }).select().single();
  if (error) { console.error('create post error', error); return null; }
  return data as Post;
}
export async function updatePost(id: string, patch: Partial<Post>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}
export async function deletePost(id: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('posts').delete().eq('id', id);
}

export async function createPlan(input: Omit<SubscriptionPlan, 'id' | 'created_at'>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('subscription_plans').insert({
    name: input.name, description: input.description, monthly_price: input.monthly_price,
    tier: input.tier, discount_rate: input.discount_rate, is_active: input.is_active, sort_order: input.sort_order,
  });
}
export async function updatePlan(id: string, patch: Partial<SubscriptionPlan>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('subscription_plans').update(patch).eq('id', id);
}
export async function deletePlan(id: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('subscription_plans').delete().eq('id', id);
}

export async function updateOrderStatus(orderId: string, status: Order['status'], extra?: Partial<Order>) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  const patch: Partial<Order> & { status: Order['status'] } = { status, ...extra };
  if (status === 'shipped' && !extra?.shipped_at) patch.shipped_at = new Date().toISOString();
  if (status === 'delivered' && !extra?.delivered_at) patch.delivered_at = new Date().toISOString();
  const { error } = await adminSupabase.from('orders').update(patch).eq('id', orderId);
  if (error) console.error('update order status error', error);
}

export async function batchUpdateOrderStatus(orderIds: string[], status: Order['status']) {
  if (!isAdminSupabaseConfigured || !adminSupabase || orderIds.length === 0) return;
  const patch: Partial<Order> & { status: Order['status'] } = { status };
  if (status === 'delivered') patch.delivered_at = new Date().toISOString();
  const { error } = await adminSupabase.from('orders').update(patch).in('id', orderIds);
  if (error) console.error('batch update order status error', error);
}

export async function setProfileRole(user_id: string, role: 'member' | 'admin') {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('profiles').update({ role }).eq('id', user_id);
}
export async function deleteProfile(user_id: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('profiles').delete().eq('id', user_id);
}

export async function changeMemberGrade(userId: string, planId: string, tier: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  await adminSupabase.from('profiles').update({
    subscription_plan_id: planId, subscription_tier: tier,
  }).eq('id', userId);
}

export async function batchChangeMemberGrade(userIds: string[], planId: string, tier: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) return;
  const { error } = await adminSupabase.from('profiles').update({
    subscription_plan_id: planId, subscription_tier: tier,
  }).in('id', userIds);
  if (error) console.error('batch change grade error', error);
}

export async function resetMemberPassword(userId: string, newPassword: string, adminId: string) {
  if (!isAdminSupabaseConfigured || !adminSupabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const apiUrl = `${(adminSupabase as any).supabaseUrl}/functions/v1/admin-reset-password`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(adminSupabase as any).supabaseKey}`,
      apikey: (adminSupabase as any).supabaseKey,
    },
    body: JSON.stringify({ user_id: userId, new_password: newPassword, admin_id: adminId }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `비밀번호 변경에 실패했습니다. (${response.status})`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
}

export interface ReviewImage {
  url: string;
  author?: string | null;
}

export interface ScrapedProductInfo {
  title: string | null; description: string | null; image_url: string | null;
  original_price: number | null; store_name: string | null;
  review_images: ReviewImage[];
  review_count: number | null;
  review_rating: number | null;
}

export async function fetchProductInfo(url: string): Promise<ScrapedProductInfo> {
  if (!isAdminSupabaseConfigured || !adminSupabase) throw new Error('Supabase가 설정되지 않았습니다.');
  const apiUrl = `${(adminSupabase as any).supabaseUrl}/functions/v1/fetch-product-info`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(adminSupabase as any).supabaseKey}`,
      apikey: (adminSupabase as any).supabaseKey,
    },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `상품 정보를 가져오지 못했습니다. (${response.status})`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data as ScrapedProductInfo;
}
