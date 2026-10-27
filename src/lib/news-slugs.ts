interface NewsSlugSource {
  id: string;
  slug: string;
  publishedAt: string;
}

/** 同じslugの最初の公開記事を維持し、後続記事にはID付きのURLを割り当てる。 */
export function withUniqueNewsSlugs<T extends NewsSlugSource>(articles: T[]): T[] {
  const reserved = new Set(articles.map((article) => article.slug));
  const assigned = new Map<string, string>();
  const used = new Set<string>();
  const chronological = [...articles].sort(
    (a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id),
  );

  for (const article of chronological) {
    let slug = article.slug;
    if (used.has(slug)) {
      const base = `${article.slug}-${article.id}`;
      slug = base;
      for (let suffix = 2; reserved.has(slug) || used.has(slug); suffix++) {
        slug = `${base}-${suffix}`;
      }
    }
    used.add(slug);
    assigned.set(article.id, slug);
  }

  return articles.map((article) => ({ ...article, slug: assigned.get(article.id)! }));
}
