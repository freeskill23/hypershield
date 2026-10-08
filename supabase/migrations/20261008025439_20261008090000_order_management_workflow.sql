/*
# Improve order management workflow

1. New columns
- `orders.payment_method`: records whether the customer selected card or manual payment.
- `orders.shipping_message`: stores the customer's delivery request.
- `orders.delivered_at`: records when an order was marked delivered.

2. Modified table
- `orders`: adds payment and delivery workflow metadata without removing or changing existing customer data.

3. Security
- Existing orders RLS policies remain in place. No new table is exposed.

4. Important notes
- Existing orders keep safe defaults for the new fields.
- The application uses the existing authenticated customer and administrator policies for all reads and updates.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_method') THEN
    ALTER TABLE public.orders ADD COLUMN payment_method text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'shipping_message') THEN
    ALTER TABLE public.orders ADD COLUMN shipping_message text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivered_at') THEN
    ALTER TABLE public.orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_status_created_at ON public.orders(status, created_at DESC);