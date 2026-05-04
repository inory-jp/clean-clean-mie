import { createClient } from "microcms-js-sdk";

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  category: string;
  eyecatch?: { url: string; width: number; height: number };
  body: string;
  published_at: string;
  tags?: string[];
  publishedAt: string;
  revisedAt: string;
}

const serviceDomain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = import.meta.env.MICROCMS_API_KEY;

const client =
  serviceDomain && apiKey
    ? createClient({ serviceDomain, apiKey })
    : null;

export async function getNewsList(opts: {
  limit?: number;
  offset?: number;
  category?: string;
} = {}): Promise<{ contents: NewsArticle[]; totalCount: number }> {
  if (!client) return { contents: [], totalCount: 0 };
  try {
    const filters = opts.category ? `category[equals]${opts.category}` : undefined;
    const res = await client.getList<NewsArticle>({
      endpoint: "news",
      queries: {
        limit: opts.limit ?? 12,
        offset: opts.offset ?? 0,
        filters,
        orders: "-published_at",
      },
    });
    return { contents: res.contents, totalCount: res.totalCount };
  } catch (err) {
    console.error("microCMS getList error:", err);
    return { contents: [], totalCount: 0 };
  }
}

export async function getNewsBySlug(slug: string): Promise<NewsArticle | null> {
  if (!client) return null;
  try {
    const res = await client.getList<NewsArticle>({
      endpoint: "news",
      queries: { filters: `slug[equals]${slug}`, limit: 1 },
    });
    return res.contents[0] ?? null;
  } catch (err) {
    console.error("microCMS getBySlug error:", err);
    return null;
  }
}

export async function getAllNewsForPaths(): Promise<NewsArticle[]> {
  if (!client) return [];
  try {
    const res = await client.getAllContents<NewsArticle>({
      endpoint: "news",
    });
    return res;
  } catch (err) {
    console.error("microCMS getAll error:", err);
    return [];
  }
}

export const formatDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
};
