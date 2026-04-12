export interface OgData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  url: string;
  domain: string;
}

const cache = new Map<string, OgData>();

function extractMeta(html: string, property: string): string | undefined {
  // Handle both attribute orders: property then content, and content then property
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

function extractTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match?.[1]?.trim() || undefined;
}

async function fetchOgData(url: string): Promise<OgData> {
  const domain = new URL(url).hostname;
  const base: OgData = { url, domain };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "bot" },
    });
    clearTimeout(timeout);

    if (!res.ok) return base;
    const html = await res.text();

    return {
      ...base,
      title: extractMeta(html, "og:title") || extractTitle(html),
      description: extractMeta(html, "og:description"),
      image: extractMeta(html, "og:image"),
      siteName: extractMeta(html, "og:site_name"),
      favicon: `https://${domain}/favicon.ico`,
    };
  } catch {
    return base;
  }
}

export async function getOgData(url: string): Promise<OgData> {
  const cached = cache.get(url);
  if (cached) return cached;
  const data = await fetchOgData(url);
  cache.set(url, data);
  return data;
}

export async function prefetchOgData(urls: string[]): Promise<void> {
  await Promise.allSettled(urls.map((u) => getOgData(u)));
}
