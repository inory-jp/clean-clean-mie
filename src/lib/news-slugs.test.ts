import assert from "node:assert/strict";
import test from "node:test";
import { withUniqueNewsSlugs } from "./news-slugs.ts";

const older = { id: "older", slug: "20260801", publishedAt: "2026-08-01T01:53:02.103Z" };
const newer = { id: "newer", slug: "20260801", publishedAt: "2026-08-01T06:54:51.242Z" };

test("古い記事のURLを維持して両記事を残し、取得順に依存しない", () => {
  const result = withUniqueNewsSlugs([newer, older]);
  assert.equal(result.length, 2);
  assert.equal(result[0].slug, "20260801-newer");
  assert.equal(result[1].slug, "20260801");
  assert.deepEqual(withUniqueNewsSlugs([older, newer]), [...result].reverse());
  assert.equal(newer.slug, "20260801");
});

test("生成したURLが他の記事の既存URLとも衝突しない", () => {
  const existing = { id: "existing", slug: "20260801-newer", publishedAt: "2026-09-01T00:00:00Z" };
  const result = withUniqueNewsSlugs([newer, older, existing]);
  assert.equal(result[0].slug, "20260801-newer-2");
  assert.equal(result[2].slug, existing.slug);
  assert.equal(new Set(result.map((article) => article.slug)).size, 3);
});

test("公開日時が同じ場合も記事IDで安定し、重複がない記事は変わらない", () => {
  const a = { ...older, id: "a" };
  const b = { ...older, id: "b" };
  assert.deepEqual(withUniqueNewsSlugs([b, a]).map((article) => article.slug), ["20260801-b", "20260801"]);
  assert.deepEqual(withUniqueNewsSlugs([older]), [older]);
  assert.deepEqual(withUniqueNewsSlugs([]), []);
});
