import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ReviewImage {
  url: string;
  author?: string | null;
}

interface ProductInfo {
  title: string | null;
  description: string | null;
  image_url: string | null;
  original_price: number | null;
  store_name: string | null;
  review_images: ReviewImage[];
  review_count: number | null;
  review_rating: number | null;
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

// -- URL helpers --

function toMobileUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "smartstore.naver.com") {
      return `https://m.smartstore.naver.com${u.pathname}${u.search}`;
    }
    if (u.hostname === "search.shopping.naver.com") {
      u.hostname = "m.search.shopping.naver.com";
      return u.href;
    }
    if (u.hostname === "cr2.shopping.naver.com") {
      return url;
    }
    return url;
  } catch {
    return url;
  }
}

function toDesktopUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "m.smartstore.naver.com") {
      return `https://smartstore.naver.com${u.pathname}${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

// -- Fetch strategies --

async function fetchWithHeaders(
  url: string,
  userAgent: string,
  referer?: string,
): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": userAgent,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Sec-Ch-Ua": '"Chromium";v="120", "Not(A:Brand";v="24", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?1",
      "Sec-Ch-Ua-Platform": '"Android"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      ...(referer ? { Referer: referer } : {}),
    },
    redirect: "follow",
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 14; SM-S928N Build/UQ1A.240205.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function scrapeProductPage(originalUrl: string): Promise<ProductInfo> {
  const urls = new Set<string>();
  urls.add(originalUrl);
  urls.add(toMobileUrl(originalUrl));
  urls.add(toDesktopUrl(originalUrl));

  const userAgents = [MOBILE_UA, DESKTOP_UA];
  const referers = [
    undefined,
    "https://www.naver.com/",
    "https://m.naver.com/",
  ];

  let lastError = "";

  for (const url of urls) {
    for (const ua of userAgents) {
      for (const ref of referers) {
        try {
          const resp = await fetchWithHeaders(url, ua, ref);
          if (resp.ok) {
            const html = await resp.text();
            if (html && html.length > 500) {
              const info = parseProductInfo(html, url);
              if (info.title || info.image_url) {
                return info;
              }
            }
          }
          if (resp.status === 429) {
            lastError = `HTTP 429 (요청이 너무 많음) — 잠시 후 다시 시도해 주세요.`;
            await sleep(800);
            continue;
          }
          lastError = `HTTP ${resp.status}`;
        } catch (e) {
          lastError = e.message;
        }
      }
    }
  }

  throw new Error(
    `상품 페이지를 불러오지 못했습니다. ${lastError}\n잠시 후 다시 시도하거나, 수동으로 정보를 입력해 주세요.`,
  );
}

function parseProductInfo(html: string, sourceUrl: string): ProductInfo {
  const getMeta = (property: string): string | null => {
    const propRegex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
      "i",
    );
    const propMatch = html.match(propRegex);
    if (propMatch) return decodeEntities(propMatch[1]);

    const revRegex = new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    );
    const revMatch = html.match(revRegex);
    if (revMatch) return decodeEntities(revMatch[1]);

    return null;
  };

  const jsonLdMatch = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  let jsonLd: any = null;
  if (jsonLdMatch) {
    try {
      jsonLd = JSON.parse(jsonLdMatch[1].trim());
    } catch {
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

  let title: string | null = null;
  const ogTitle = getMeta("og:title");
  if (ogTitle) {
    title = ogTitle
      .replace(/\s*[|\-–]\s*네이버.*$/i, "")
      .replace(/\s*[|\-–]\s*스마트스토어.*$/i, "")
      .replace(/\s*[|\-–]\s*Naver.*$/i, "")
      .trim();
  }
  if (!title && jsonLd?.name) title = jsonLd.name;
  if (!title) {
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleTag) {
      title = decodeEntities(titleTag[1])
        .replace(/\s*[|\-–]\s*네이버.*$/i, "")
        .trim();
    }
  }

  let description: string | null = null;
  description = getMeta("og:description") || null;
  if (!description && jsonLd?.description) description = jsonLd.description;
  if (!description) description = getMeta("description");

  let image_url: string | null = null;
  image_url = getMeta("og:image") || null;
  if (!image_url) image_url = getMeta("twitter:image");
  if (!image_url && jsonLd?.image) {
    if (Array.isArray(jsonLd.image)) image_url = jsonLd.image[0];
    else image_url = jsonLd.image;
  }
  if (image_url && !image_url.startsWith("http")) {
    try {
      image_url = new URL(image_url, sourceUrl).href;
    } catch {
      // keep as-is
    }
  }

  let original_price: number | null = null;
  if (jsonLd?.offers?.price) {
    original_price = Number(jsonLd.offers.price);
  } else if (jsonLd?.offers && Array.isArray(jsonLd.offers) && jsonLd.offers[0]?.price) {
    original_price = Number(jsonLd.offers[0].price);
  }
  if (!original_price) {
    const priceMeta = getMeta("product:price:amount");
    if (priceMeta) original_price = Number(priceMeta);
  }
  if (original_price && isNaN(original_price)) original_price = null;

  let store_name: string | null = null;
  store_name = getMeta("og:site_name") || null;
  if (!store_name && jsonLd?.seller?.name) store_name = jsonLd.seller.name;

  // -- Extract review images --
  const review_images: ReviewImage[] = [];

  // Naver embeds review photos in data-src or src attributes within review sections
  // Look for common Naver review image patterns
  const reviewImgRegexes = [
    // Review photo containers with data-src
    /<img[^>]+(?:data-src|src)=["'](https?:\/\/[^"']+\/shopphoto[^"']*)["']/gi,
    // Naver review image URLs
    /<img[^>]+(?:data-src|src)=["'](https?:\/\/(?:review|image)[^"']*naver[^"']*)["']/gi,
    // General review image patterns in JSON
    /"reviewImage"(?:\s*:\s*)\[([^\]]+)\]/gi,
  ];

  const seenUrls = new Set<string>();

  for (const regex of reviewImgRegexes) {
    let match;
    while ((match = regex.exec(html)) !== null && review_images.length < 20) {
      const imgUrl = match[1] || match[0];
      if (!seenUrls.has(imgUrl) && !imgUrl.includes("logo") && !imgUrl.includes("icon")) {
        seenUrls.add(imgUrl);
        review_images.push({ url: imgUrl, author: null });
      }
    }
  }

  // Try to extract from JSON-embedded review data (Naver uses __NEXT_DATA__ or similar)
  const nextDataMatch = html.match(/<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if (nextDataMatch) {
    try {
      const nextData = JSON.parse(nextDataMatch[1].trim());
      // Navigate common paths where review images might be stored
      const searchJson = (obj: any, depth: number = 0) => {
        if (depth > 8 || review_images.length >= 20) return;
        if (!obj || typeof obj !== "object") return;
        for (const key of Object.keys(obj)) {
          const val = obj[key];
          // Look for review photo arrays
          if ((key === "reviewPhotos" || key === "photoList" || key === "reviewImages") && Array.isArray(val)) {
            for (const photo of val) {
              const photoUrl = typeof photo === "string" ? photo : (photo?.url || photo?.imageUrl || photo?.photoUrl);
              if (photoUrl && !seenUrls.has(photoUrl)) {
                seenUrls.add(photoUrl);
                review_images.push({
                  url: photoUrl,
                  author: typeof photo === "object" ? (photo?.author || photo?.writerName || null) : null,
                });
              }
            }
          }
          if (typeof val === "object") {
            searchJson(val, depth + 1);
          }
        }
      };
      searchJson(nextData);
    } catch {
      // ignore JSON parse errors
    }
  }

  // Extract review count and rating from aggregation patterns
  let review_count: number | null = null;
  let review_rating: number | null = null;

  // Try JSON-LD aggregateRating
  if (jsonLd?.aggregateRating) {
    review_count = jsonLd.aggregateRating.reviewCount ? Number(jsonLd.aggregateRating.reviewCount) : null;
    review_rating = jsonLd.aggregateRating.ratingValue ? Number(jsonLd.aggregateRating.ratingValue) : null;
  }

  // Try meta tags
  if (!review_count) {
    const reviewCountMeta = getMeta("product:review:count");
    if (reviewCountMeta) review_count = Number(reviewCountMeta);
  }
  if (!review_rating) {
    const ratingMeta = getMeta("product:review:rating");
    if (ratingMeta) review_rating = Number(ratingMeta);
  }

  // Try common text patterns for Naver
  if (!review_count) {
    const countMatch = html.match(/리뷰\s*(?:수)?\s*[:\s]*([0-9,]+)/);
    if (countMatch) review_count = parseInt(countMatch[1].replace(/,/g, ""), 10);
  }
  if (!review_rating) {
    const ratingMatch = html.match(/(?:평점|별점)\s*[:\s]*([0-9.]+)/);
    if (ratingMatch) review_rating = parseFloat(ratingMatch[1]);
  }

  return { title, description, image_url, original_price, store_name, review_images, review_count, review_rating };
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
