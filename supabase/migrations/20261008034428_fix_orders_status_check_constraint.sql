/*
# Fix orders status check constraint

The orders table has a CHECK constraint that only allows:
  pending, shipping_ready, shipping, delivered, cancelled

But the application uses these status values:
  pending, paid, preparing, shipped, delivered, cancelled

This mismatch causes order status updates to silently fail — the Supabase
client receives an error but the app doesn't surface it, so the order
appears unchanged.

This migration drops the old constraint and creates a new one that allows
all status values the application uses. No data is lost or modified.
*/

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'paid'::text,
    'preparing'::text,
    'shipped'::text,
    'shipping_ready'::text,
    'shipping'::text,
    'delivered'::text,
    'cancelled'::text
  ]));
