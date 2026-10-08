import { useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from './supabase';
import {
  Profile, SubscriptionPlan, Category, Product, CartItemWithProduct,
  Order, OrderItem, Address, Post, Setting, SelectedOption, Inquiry,
} from './types';

// ============================================================
// Collection hooks
// ============================================================

function useCollection<T>(
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
      if (!isSupabaseConfigured || !supabase) {
        setItems([]);
        return;
      }
      let q = supabase.from(table).select('*');
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

export function useSubscriptionPlans(enabled: boolean = true) {
  return useCollection<SubscriptionPlan>(
    'subscription_plans', { column: 'sort_order', ascending: true }, enabled,
  );
}

export function useCategories(enabled: boolean = true) {
  return useCollection<Category>(
    'categories', { column: 'sort_order', ascending: true }, enabled,
  );
}

export function useProducts(enabled: boolean = true) {
  return useCollection<Product>(
    'products', { column: 'sort_order', ascending: true }, enabled,
  );
}

export function usePosts(enabled: boolean = true) {
  return useCollection<Post>(
    'posts', { column: 'created_at', ascending: false }, enabled,
  );
}

export function useOrders(enabled: boolean = true) {
  return useCollection<Order>(
    'orders', { column: 'created_at', ascending: false }, enabled,
  );
}

export function useUserOrderItems(userId: string | undefined, enabled: boolean = true) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, order:orders(user_id)')
        .eq('order.user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as any[])?.map(({ order: _, ...rest }: any) => rest as OrderItem) ?? []);
    } catch (e) {
      console.error('user order items load error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { items, loading, refresh };
}

export function useProfiles(enabled: boolean = true) {
  return useCollection<Profile>(
    'profiles', { column: 'created_at', ascending: false }, enabled,
  );
}

export function useSettings(enabled: boolean = true) {
  return useCollection<Setting>('settings', undefined, enabled);
}

export function getSettingValue(settings: Setting[], key: string): string | null {
  return settings.find((s) => s.key === key)?.value ?? null;
}

export async function updateSetting(key: string, value: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) console.error('update setting error', error);
}

export function useCart(userId: string | undefined) {
  const [items, setItems] = useState<CartItemWithProduct[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select('*, product:products(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as CartItemWithProduct[]) ?? []);
    } catch (e) {
      console.error('cart load error', e);
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

export function useAddresses(userId: string | undefined) {
  const [items, setItems] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as Address[]) ?? []);
    } catch (e) {
      console.error('addresses load error', e);
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
// Cart operations
// ============================================================

function optionsMatch(a: SelectedOption[] | null, b: SelectedOption[] | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name || a[i].value !== b[i].value || a[i].price_addition !== b[i].price_addition) return false;
  }
  return true;
}

export async function addToCart(productId: string, quantity: number = 1, selectedOptions?: SelectedOption[]) {
  if (!isSupabaseConfigured || !supabase) return;
  const optionsJson = selectedOptions && selectedOptions.length > 0 ? selectedOptions : null;

  const { data: existingItems } = await supabase
    .from('cart_items')
    .select('id, quantity, selected_options')
    .eq('product_id', productId);

  const match = (existingItems as any[])?.find((item) => {
    const itemOpts = item.selected_options as SelectedOption[] | null;
    return optionsMatch(optionsJson ?? null, itemOpts);
  });

  if (match) {
    await supabase
      .from('cart_items')
      .update({ quantity: match.quantity + quantity })
      .eq('id', match.id);
    return;
  }

  await supabase.from('cart_items').insert({ product_id: productId, quantity, selected_options: optionsJson });
}

export async function updateCartQuantity(cartItemId: string, quantity: number) {
  if (!isSupabaseConfigured || !supabase) return;
  if (quantity <= 0) {
    await removeFromCart(cartItemId);
    return;
  }
  await supabase.from('cart_items').update({ quantity }).eq('id', cartItemId);
}

export async function removeFromCart(cartItemId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('cart_items').delete().eq('id', cartItemId);
}

export async function clearCart(userId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('cart_items').delete().eq('user_id', userId);
}

// ============================================================
// Order operations
// ============================================================

export async function createOrder(
  userId: string,
  items: CartItemWithProduct[],
  shipping: {
    recipient_name: string;
    recipient_phone: string;
    address: string;
    address_detail: string;
    shipping_message?: string;
    payment_method?: string;
  },
  pointsUsed: number = 0,
  skipClearCart: boolean = false,
): Promise<Order | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const totalAmount = items.reduce((sum, item) => {
    const base = item.product?.club_price ?? 0;
    const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
    return sum + (base + optionAdd) * item.quantity;
  }, 0) - pointsUsed;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      total_amount: Math.max(0, totalAmount),
      status: 'pending',
      recipient_name: shipping.recipient_name,
      recipient_phone: shipping.recipient_phone,
      address: shipping.address,
      address_detail: shipping.address_detail,
      shipping_message: shipping.shipping_message ?? null,
      payment_method: shipping.payment_method ?? 'manual',
      points_used: pointsUsed,
      points_earned: Math.floor(totalAmount / 100),
    })
    .select()
    .single();

  if (orderError || !order) {
    console.error('create order error', orderError);
    return null;
  }

  const orderItems = items.map((item) => {
    const optionAdd = (item.selected_options ?? []).reduce((s, o) => s + (o.price_addition ?? 0), 0);
    const optionLabel = item.selected_options && item.selected_options.length > 0
      ? item.selected_options.map(o => `${o.name}: ${o.value}`).join(', ')
      : null;
    return {
      order_id: (order as any).id,
      product_id: item.product_id,
      product_name: optionLabel ? `${item.product?.name ?? '알 수 없는 상품'} (${optionLabel})` : (item.product?.name ?? '알 수 없는 상품'),
      product_image: item.product?.image_url ?? null,
      quantity: item.quantity,
      unit_price: (item.product?.club_price ?? 0) + optionAdd,
      original_price: item.product?.original_price ?? 0,
    };
  });

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
  if (itemsError) console.error('create order items error', itemsError);

  if (!skipClearCart) {
    await clearCart(userId);
  }

  return order as Order;
}

export async function updateOrderStatus(orderId: string, status: Order['status'], extra?: Partial<Order>) {
  if (!isSupabaseConfigured || !supabase) return;
  const patch: any = { status, ...extra };
  if (status === 'shipped' && !extra?.shipped_at) {
    patch.shipped_at = new Date().toISOString();
  }
  if (status === 'delivered' && !extra?.delivered_at) {
    patch.delivered_at = new Date().toISOString();
  }
  if (status === 'cancelled' && !extra?.cancelled_at) {
    patch.cancelled_at = new Date().toISOString();
  }
  await supabase.from('orders').update(patch).eq('id', orderId);
}

export async function requestOrderCancellation(
  orderId: string,
  cancelType: 'card' | 'manual',
  reason: string,
  refundInfo?: { bank: string; account: string; holder: string },
): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const patch: any = {
    cancel_requested_at: new Date().toISOString(),
    cancel_type: cancelType,
    cancel_reason: reason || null,
  };
  if (cancelType === 'manual' && refundInfo) {
    patch.refund_bank = refundInfo.bank;
    patch.refund_account = refundInfo.account;
    patch.refund_holder = refundInfo.holder;
  }
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  if (error) {
    console.error('request cancellation error', error);
    return false;
  }
  return true;
}

// ============================================================
// Address operations
// ============================================================

export async function addAddress(
  userId: string,
  addr: Omit<Address, 'id' | 'user_id' | 'created_at' | 'is_default'> & { is_default?: boolean },
) {
  if (!isSupabaseConfigured || !supabase) return;
  if (addr.is_default) {
    await supabase.from('addresses').update({ is_default: false }).eq('user_id', userId);
  }
  await supabase.from('addresses').insert({
    user_id: userId,
    label: addr.label,
    recipient_name: addr.recipient_name,
    recipient_phone: addr.recipient_phone,
    address: addr.address,
    address_detail: addr.address_detail,
    is_default: addr.is_default ?? false,
  });
}

export async function deleteAddress(addressId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('addresses').delete().eq('id', addressId);
}

// ============================================================
// Product operations (admin)
// ============================================================

export async function createProduct(input: {
  name: string;
  category: string;
  category_id?: string | null;
  original_price: number;
  club_price: number;
  description?: string;
  image_url?: string | null;
  sub_images?: string[] | null;
  sku?: string | null;
  stock?: number;
  sort_order?: number;
}): Promise<Product | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: input.name,
      category: input.category,
      category_id: input.category_id ?? null,
      original_price: input.original_price,
      club_price: input.club_price,
      description: input.description || null,
      image_url: input.image_url ?? null,
      sub_images: input.sub_images ?? null,
      sku: input.sku ?? null,
      stock: input.stock ?? 100,
      sort_order: input.sort_order ?? 0,
      is_active: true,
    })
    .select()
    .single();
  if (error) {
    console.error('create product error', error);
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
// Category operations (admin)
// ============================================================

export async function createCategory(name: string, sortOrder: number = 0) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('categories').insert({ name, sort_order: sortOrder });
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('categories').update(patch).eq('id', id);
}

export async function deleteCategory(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('categories').delete().eq('id', id);
}

// ============================================================
// Post operations (admin)
// ============================================================

export async function createPost(input: {
  title: string;
  content: string;
  excerpt?: string;
  category?: string;
  visibility: 'public' | 'members';
  is_pinned?: boolean;
}): Promise<Post | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('posts')
    .insert({
      title: input.title,
      content: input.content,
      excerpt: input.excerpt || null,
      category: input.category || null,
      visibility: input.visibility,
      is_pinned: input.is_pinned ?? false,
    })
    .select()
    .single();
  if (error) {
    console.error('create post error', error);
    return null;
  }
  return data as Post;
}

export async function updatePost(id: string, patch: Partial<Post>) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
}

export async function deletePost(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('posts').delete().eq('id', id);
}

export async function incrementPostView(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  const { error } = await supabase.rpc('increment_post_view', { post_id: id });
  if (error) {
    // Fallback: direct update
    await supabase.from('posts')
      .update({ view_count: (await supabase.from('posts').select('view_count').eq('id', id).maybeSingle()).data?.view_count + 1 })
      .eq('id', id);
  }
}

// ============================================================
// Subscription plan operations (admin)
// ============================================================

export async function createPlan(input: Omit<SubscriptionPlan, 'id' | 'created_at'>) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('subscription_plans').insert({
    name: input.name,
    description: input.description,
    monthly_price: input.monthly_price,
    tier: input.tier,
    discount_rate: input.discount_rate,
    is_active: input.is_active,
    sort_order: input.sort_order,
  });
}

export async function updatePlan(id: string, patch: Partial<SubscriptionPlan>) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('subscription_plans').update(patch).eq('id', id);
}

export async function deletePlan(id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('subscription_plans').delete().eq('id', id);
}

// ============================================================
// Subscription activation (admin manually activates for now;
// NHNKCP integration will be done later)
// ============================================================

export async function activateSubscription(
  userId: string,
  planId: string,
  tier: string,
  months: number = 1,
) {
  if (!isSupabaseConfigured || !supabase) return;
  const now = new Date();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + months);

  await supabase.from('profiles').update({
    subscription_plan_id: planId,
    subscription_tier: tier,
    subscription_status: 'active',
    subscription_expires_at: expires.toISOString(),
    subscription_started_at: now.toISOString(),
  }).eq('id', userId);
}

export async function deactivateSubscription(userId: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('profiles').update({
    subscription_status: 'expired',
  }).eq('id', userId);
}

// ============================================================
// Profile operations (admin)
// ============================================================

export async function setProfileRole(user_id: string, role: 'member' | 'admin') {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('profiles').update({ role }).eq('id', user_id);
}

export async function deleteProfile(user_id: string) {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.from('profiles').delete().eq('id', user_id);
}

// ============================================================
// Inquiry (1:1 문의) operations
// ============================================================

export function useInquiries(userId: string | undefined, enabled: boolean = true) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inquiries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setItems((data as Inquiry[]) ?? []);
    } catch (e) {
      console.error('inquiries load error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [refresh, enabled]);

  return { items, loading, refresh };
}

export async function createInquiry(userId: string, title: string, content: string): Promise<Inquiry | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('inquiries')
    .insert({ user_id: userId, title, content })
    .select()
    .single();
  if (error) {
    console.error('create inquiry error', error);
    return null;
  }
  return data as Inquiry;
}

export async function fetchInquiry(id: string): Promise<Inquiry | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase
    .from('inquiries')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('fetch inquiry error', error);
    return null;
  }
  return data as Inquiry | null;
}

// ============================================================
// Product info scraping (via edge function)
// ============================================================

export interface ScrapedProductInfo {
  title: string | null;
  description: string | null;
  image_url: string | null;
  original_price: number | null;
  store_name: string | null;
}

export async function fetchProductInfo(url: string): Promise<ScrapedProductInfo> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase가 설정되지 않았습니다.');
  }
  const apiUrl = `${(supabase as any).supabaseUrl}/functions/v1/fetch-product-info`;
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${(supabase as any).supabaseKey}`,
      apikey: (supabase as any).supabaseKey,
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
