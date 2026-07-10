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

export interface Campaign {
  id: string;
  title: string;
  notice_text?: string;
  banner_image_pc: { url: string; width: number; height: number };
  banner_image_sp?: { url: string; width: number; height: number };
  alt_text: string;
  link_url?: string;
  display_order: number;
  start_at?: string;
  end_at?: string;
  published: boolean;
}

export async function getActiveCampaigns(): Promise<Campaign[]> {
  if (!client) return [];
  try {
    // 期間（start_at / end_at）は任意項目。published のみ microCMS 側で絞り、
    // 期間判定はコード側で行う。期間未設定のバナーは常時表示し、
    // 設定されている場合だけその範囲内に限定する（入れ忘れで消えない運用）。
    const res = await client.getList<Campaign>({
      endpoint: "campaigns",
      queries: {
        filters: `published[equals]true`,
        orders: "display_order",
        limit: 20,
      },
    });
    const now = Date.now();
    return res.contents.filter((c) => {
      const startOk = !c.start_at || new Date(c.start_at).getTime() <= now;
      const endOk = !c.end_at || new Date(c.end_at).getTime() >= now;
      return startOk && endOk;
    });
  } catch (err) {
    console.error("microCMS getCampaigns error:", err);
    return [];
  }
}
