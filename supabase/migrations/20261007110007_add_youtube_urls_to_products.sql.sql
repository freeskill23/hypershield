/*
# Add youtube_urls column to products table

1. Changes
- Adds `youtube_urls` column (JSONB, nullable) to `products` table.
- Stores an array of YouTube URL strings (e.g. ["https://www.youtube.com/watch?v=xxx", "https://youtu.be/xxx"]).
2. Security
- No RLS changes needed; existing policies on products already govern access.
3. Notes
- The column is nullable so existing products without videos remain valid.
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS youtube_urls JSONB;
