import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProductInfo {
  title: string | null;
  description: string | null;
  image_url: string | null;
  original_price: number | null;
  store_name: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL이 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const productInfo = await scrapeProductPage(url);

    return new Response(
      JSON.stringify(productInfo),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "상품 정보를 가져오지 못했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function scrapeProductPage(url: string): Promise<ProductInfo> {
  // Fetch the page HTML
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`페이지를 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  const html = await response.text();

  return parseProductInfo(html, url);
}

function parseProductInfo(html: string, sourceUrl: string): ProductInfo {
  // Extract Open Graph meta tags (works for most smart stores / e-commerce sites)
  const getMeta = (property: string): string | null => {
    // Try property attribute first, then name attribute
    const propRegex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const propMatch = html.match(propRegex);
    if (propMatch) return decodeEntities(propMatch[1]);

    // Try reversed order (content before property)
    const revRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    );
    const revMatch = html.match(revRegex);
    if (revMatch) return decodeEntities(revMatch[1]);

    return null;
  };

  // Extract JSON-LD structured data
  const jsonLdMatch = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  let jsonLd: any = null;
  if (jsonLdMatch) {
    try {
      jsonLd = JSON.parse(jsonLdMatch[1].trim());
    } catch {
      // try to find array
      try {
        const arr = JSON.parse(jsonLdMatch[1].trim());
        if (Array.isArray(arr)) {
          jsonLd = arr.find(
            (item: any) =>
              item["@type"] === "Product" ||
              (Array.isArray(item["@type"]) && item["@type"].includes("Product")),
          ) || arr[0];
        }
      } catch {
        // ignore
      }
    }
  }

  // Title: og:title > jsonLd name > <title>
  let title: string | null = null;
  const ogTitle = getMeta("og:title");
  if (ogTitle) {
    title = ogTitle.replace(/\s*[|\-–]\s*네이버.*$/i, "").replace(/\s*[|\-–]\s*스마트스토어.*$/i, "").trim();
  }
  if (!title && jsonLd?.name) {
    title = jsonLd.name;
  }
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag) {
      title = decodeEntities(titleTag[1]).replace(/\s*[|\-–]\s*네이버.*$/i, "").trim();
    }
  }

  // Description: og:description > jsonLd description > meta description
  let description: string | null = null;
  description = getMeta("og:description") || null;
  if (!description && jsonLd?.description) {
    description = jsonLd.description;
  }
  if (!description) {
    description = getMeta("description");
  }

  // Image: og:image > jsonLd image
  let image_url: string | null = null;
  image_url = getMeta("og:image") || null;
  if (!image_url && jsonLd?.image) {
    if (Array.isArray(jsonLd.image)) {
      image_url = jsonLd.image[0];
    } else {
      image_url = jsonLd.image;
    }
  }

  // Make image URL absolute
  if (image_url && !image_url.startsWith("http")) {
    try {
      image_url = new URL(image_url, sourceUrl).href;
    } catch {
      // keep as-is
    }
  }

  // Price: jsonLd offers.price > meta product:price:amount
  let original_price: number | null = null;
  if (jsonLd?.offers?.price) {
    original_price = Number(jsonLd.offers.price);
  } else if (jsonLd?.offers && Array.isArray(jsonLd.offers) && jsonLd.offers[0]?.price) {
    original_price = Number(jsonLd.offers[0].price);
  }
  if (!original_price) {
    const priceMeta = getMeta("product:price:amount");
    if (priceMeta) {
      original_price = Number(priceMeta);
    }
  }
  if (original_price && isNaN(original_price)) {
    original_price = null;
  }

  // Store name: og:site_name or jsonLd seller
  let store_name: string | null = null;
  store_name = getMeta("og:site_name") || null;
  if (!store_name && jsonLd?.seller?.name) {
    store_name = jsonLd.seller.name;
  }

  return { title, description, image_url, original_price, store_name };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .trim();
}
