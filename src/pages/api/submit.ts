import type { APIRoute } from "astro";
import { Resend } from "resend";
import menusData from "../../data/menus.json";

export const prerender = false;

const FROM = "CLEAN×CLEAN 津中央店 <noreply@cleanclean-mie.jp>";
const OWNER_TO = "cleancleankurita@gmail.com";

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  duration?: string;
}

interface Payload {
  cart: CartItem[];
  total: number;
  customer: {
    name: string;
    kana: string;
    tel: string;
    email: string;
    postal: string;
    address: string;
    dates: string[];
    times: string[];
    coupon?: string;
    referrer?: string;
    notes?: string;
  };
  website?: string;
}

const yen = (n: number) => `¥${n.toLocaleString()}`;
const json = (body: Record<string, string>, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const validItems = new Map<string, { name: string; price: number; duration: string; parentId?: string }>();
for (const category of menusData.categories.filter((c) => (c as any).orderable !== false)) {
  for (const menu of category.menus) {
    if (!menu.published || menu.price == null) continue;
    validItems.set(menu.id, { name: menu.name, price: menu.price, duration: menu.duration });
    for (const option of (category.options as any[]) ?? []) {
      if (option.applies_to?.includes(menu.id)) {
        validItems.set(`${option.id}@${menu.id}`, {
          name: `${option.name}（${menu.name}用）`,
          price: option.price,
          duration: option.duration,
          parentId: menu.id,
        });
      }
    }
  }
}

// インスタンス内の補助的な制限。複数インスタンスを横断する制限ではない。
const recentRequests = new Map<string, number[]>();
const isRateLimited = (key: string) => {
  const now = Date.now();
  for (const [ip, times] of recentRequests) {
    if (times.every((time) => now - time >= 10 * 60 * 1000)) recentRequests.delete(ip);
  }
  if (!recentRequests.has(key) && recentRequests.size >= 10_000) return true;
  const recent = (recentRequests.get(key) ?? []).filter((time) => now - time < 10 * 60 * 1000);
  if (recent.length >= 5) {
    recentRequests.set(key, recent);
    return true;
  }
  recent.push(now);
  recentRequests.set(key, recent);
  return false;
};

const cartTextLines = (cart: CartItem[]) =>
  cart.map((i) => `・${i.name} × ${i.qty}　${yen(i.price * i.qty)}`).join("\n");

const cartHtmlRows = (cart: CartItem[]) =>
  cart
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${escapeHtml(i.name)} × ${i.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${yen(i.price * i.qty)}</td></tr>`,
    )
    .join("");

const datesText = (dates: string[], times: string[]) =>
  dates
    .map((d, i) => (d ? `第${i + 1}希望: ${d} ${times[i] || ""}` : null))
    .filter(Boolean)
    .join("\n");

export const POST: APIRoute = async ({ request }) => {
  try {
    const requestUrl = new URL(request.url);
    if (request.headers.get("origin") !== requestUrl.origin) {
      return json({ error: "不正なリクエストです" }, 403);
    }
    if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "JSON形式で送信してください" }, 415);
    }
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 32_000) return json({ error: "入力内容が大きすぎます" }, 413);
    // Content-Lengthの欠落・偽装時も実際に受け取ったバイト数で制限する。
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 32_000) {
          await reader.cancel();
          return json({ error: "入力内容が大きすぎます" }, 413);
        }
        chunks.push(value);
      }
    }
    const buffer = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
    let body: Payload;
    try { body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer)); }
    catch { return json({ error: "入力内容が不正です" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "入力内容が不正です" }, 400);
    if (body.website !== undefined && body.website !== "") return json({ error: "送信に失敗しました" }, 400);
    if (!Array.isArray(body.cart) || !body.cart.length || body.cart.length > 50) {
      return json({ error: "メニューが選択されていません" }, 400);
    }
    const c = body.customer;
    if (!c || typeof c !== "object" || Array.isArray(c) ||
      [c.name, c.email, c.tel, c.address].some((v) => typeof v !== "string" || !v.trim())) {
      return json({ error: "必須項目が未入力です" }, 400);
    }
    const fields = [c.name, c.kana, c.tel, c.email, c.postal, c.address, c.coupon, c.referrer, c.notes];
    if (fields.some((v) => v !== undefined && (typeof v !== "string" || v.length > 500)) || /[\r\n]/.test(c.name)) {
      return json({ error: "入力内容が長すぎるか不正です" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) || c.email.length > 254) {
      return json({ error: "メールアドレスをご確認ください" }, 400);
    }
    for (const list of [c.dates, c.times]) {
      if (!Array.isArray(list) || list.length > 3 || list.some((v) => typeof v !== "string" || v.length > 100)) {
        return json({ error: "希望日時をご確認ください" }, 400);
      }
    }

    const normalizedCart: CartItem[] = [];
    const seen = new Set<string>();
    for (const item of body.cart) {
      const master = item && typeof item.id === "string" ? validItems.get(item.id) : undefined;
      if (!master || seen.has(item.id) || !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 10) {
        return json({ error: "メニュー内容をご確認ください" }, 400);
      }
      seen.add(item.id);
      normalizedCart.push({ ...master, id: item.id, qty: item.qty });
    }
    const parentQty = new Map<string, number>();
    for (const item of normalizedCart.filter((i) => !i.id.includes("@"))) parentQty.set(item.id, item.qty);
    if (normalizedCart.some((item) => {
      const parentId = validItems.get(item.id)?.parentId;
      return parentId !== undefined && item.qty > (parentQty.get(parentId) ?? 0);
    })) {
      return json({ error: "オプション内容をご確認ください" }, 400);
    }
    const serverTotal = normalizedCart.reduce((sum, item) => sum + item.price * item.qty, 0);

    const clientKey = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(clientKey)) return json({ error: "しばらく時間をおいて再度お試しください" }, 429);
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) return json({ error: "サーバー設定エラー" }, 500);
    const resend = new Resend(apiKey);

    const customerSubject = "【CLEAN×CLEAN 津中央店】お申込みありがとうございます";
    const customerText = `${c.name} 様

このたびはCLEAN×CLEAN 津中央店をお選びいただきありがとうございます。
以下の内容でお申込みを承りました。後ほど栗田よりご連絡いたします（翌営業日中）。

━━━━━━━━━━━━━━━━━━━
ご注文内容
━━━━━━━━━━━━━━━━━━━
${cartTextLines(normalizedCart)}

合計（税込）: ${yen(serverTotal)}

※ 掲載料金は確定料金です。現場状況により標準作業に含まれない追加作業が必要な場合は、別途お見積もりのうえご相談いたします。

━━━━━━━━━━━━━━━━━━━
ご希望日時
━━━━━━━━━━━━━━━━━━━
${datesText(c.dates ?? [], c.times ?? [])}

━━━━━━━━━━━━━━━━━━━
お客様情報
━━━━━━━━━━━━━━━━━━━
お名前: ${c.name}（${c.kana}）
電話: ${c.tel}
メール: ${c.email}
住所: 〒${c.postal} ${c.address}
${c.coupon ? `\nクーポンコード: ${c.coupon}` : ""}
${c.referrer ? `紹介者: ${c.referrer}` : ""}
${c.notes ? `\n備考:\n${c.notes}` : ""}

━━━━━━━━━━━━━━━━━━━
お問合せ
━━━━━━━━━━━━━━━━━━━
お急ぎの場合はお電話ください
TEL: 059-271-5908（9:00〜18:00 / 不定休）

CLEAN×CLEAN 津中央店
栗田 祐志
〒514-0008 三重県津市上浜町3丁目49番地
`;

    const customerHtml = `
<!doctype html>
<html lang="ja"><body style="margin:0;padding:0;background:#f7fafc;font-family:'Noto Sans JP',sans-serif;color:#1A2738">
<div style="max-width:600px;margin:0 auto;padding:20px;background:#fff">
<div style="background:#1E88B0;color:#fff;padding:20px;text-align:center">
<h1 style="margin:0;font-size:18px">CLEAN×CLEAN 津中央店</h1>
<p style="margin:5px 0 0;font-size:13px">お申込みありがとうございます</p>
</div>
<div style="padding:20px">
<p>${escapeHtml(c.name)} 様</p>
<p>このたびはCLEAN×CLEAN 津中央店をお選びいただきありがとうございます。<br>以下の内容でお申込みを承りました。後ほど栗田よりご連絡いたします（翌営業日中）。</p>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">ご注文内容</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${cartHtmlRows(normalizedCart)}
<tr><td style="padding:10px 8px;font-weight:bold;background:#E8F5F9">合計（税込）</td><td style="padding:10px 8px;text-align:right;font-weight:bold;background:#E8F5F9;color:#E55F2C;font-size:18px">${yen(serverTotal)}</td></tr>
</table>
<p style="font-size:12px;color:#6B7A8F;margin-top:8px">※ 掲載料金は確定料金です。現場状況により標準作業に含まれない追加作業が必要な場合は、別途お見積もりのうえご相談いたします。</p>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">ご希望日時</h2>
<pre style="font-family:inherit;white-space:pre-wrap;font-size:14px;margin:0">${escapeHtml(datesText(c.dates ?? [], c.times ?? []))}</pre>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">お客様情報</h2>
<table style="width:100%;font-size:14px">
<tr><td style="padding:4px 0;color:#6B7A8F;width:80px">お名前</td><td>${escapeHtml(c.name)}（${escapeHtml(c.kana)}）</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">電話</td><td>${escapeHtml(c.tel)}</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">メール</td><td>${escapeHtml(c.email)}</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">住所</td><td>〒${escapeHtml(c.postal)} ${escapeHtml(c.address)}</td></tr>
${c.coupon ? `<tr><td style="padding:4px 0;color:#6B7A8F">クーポン</td><td>${escapeHtml(c.coupon)}</td></tr>` : ""}
${c.referrer ? `<tr><td style="padding:4px 0;color:#6B7A8F">紹介者</td><td>${escapeHtml(c.referrer)}</td></tr>` : ""}
${c.notes ? `<tr><td style="padding:4px 0;color:#6B7A8F">備考</td><td style="white-space:pre-wrap">${escapeHtml(c.notes)}</td></tr>` : ""}
</table>
<div style="margin-top:30px;padding:15px;background:#E8F5F9;border-radius:8px;text-align:center">
<p style="margin:0;font-size:12px;color:#6B7A8F">お急ぎの場合はお電話ください</p>
<p style="margin:5px 0 0;font-size:22px;font-weight:bold;color:#1E88B0">📞 059-271-5908</p>
<p style="margin:5px 0 0;font-size:12px;color:#6B7A8F">営業時間 9:00〜18:00 / 不定休</p>
</div>
</div>
<div style="background:#0D5B7A;color:#fff;padding:15px;text-align:center;font-size:12px">
CLEAN×CLEAN 津中央店<br>〒514-0008 三重県津市上浜町3丁目49番地
</div>
</div>
</body></html>`;

    const ownerSubject = `【新規申込】${c.name} 様より`;
    const ownerText = `新規申込が届きました。

━━━━━━━━━━━━━━━━━━━
申込内容
━━━━━━━━━━━━━━━━━━━
${cartTextLines(normalizedCart)}

合計（税込）: ${yen(serverTotal)}

━━━━━━━━━━━━━━━━━━━
ご希望日時
━━━━━━━━━━━━━━━━━━━
${datesText(c.dates ?? [], c.times ?? [])}

━━━━━━━━━━━━━━━━━━━
お客様情報
━━━━━━━━━━━━━━━━━━━
お名前: ${c.name}（${c.kana}）
電話: ${c.tel}
メール: ${c.email}
住所: 〒${c.postal} ${c.address}
${c.coupon ? `\n★クーポンコード: ${c.coupon}（手動割引適用必要）` : ""}
${c.referrer ? `\n紹介者: ${c.referrer}` : ""}
${c.notes ? `\n備考:\n${c.notes}` : ""}
`;

    const delivery = await Promise.all([
      resend.emails.send({
        from: FROM,
        to: c.email,
        subject: customerSubject,
        text: customerText,
        html: customerHtml,
      }),
      resend.emails.send({
        from: FROM,
        to: OWNER_TO,
        replyTo: c.email,
        subject: ownerSubject,
        text: ownerText,
      }),
    ]);

    if (delivery.some((result) => result.error)) {
      return json({ error: "送信に失敗しました。お電話ください: 059-271-5908" }, 502);
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("submit error");
    return new Response(
      JSON.stringify({ error: "送信に失敗しました。お電話ください: 059-271-5908" }),
      { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } },
    );
  }
};
