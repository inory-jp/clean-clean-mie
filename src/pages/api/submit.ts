import type { APIRoute } from "astro";
import { Resend } from "resend";

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
}

const yen = (n: number) => `¥${n.toLocaleString()}`;

const cartTextLines = (cart: CartItem[]) =>
  cart.map((i) => `・${i.name} × ${i.qty}　${yen(i.price * i.qty)}`).join("\n");

const cartHtmlRows = (cart: CartItem[]) =>
  cart
    .map(
      (i) =>
        `<tr><td style="padding:8px;border-bottom:1px solid #eee">${i.name} × ${i.qty}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${yen(i.price * i.qty)}</td></tr>`,
    )
    .join("");

const datesText = (dates: string[], times: string[]) =>
  dates
    .map((d, i) => (d ? `第${i + 1}希望: ${d} ${times[i] || ""}` : null))
    .filter(Boolean)
    .join("\n");

export const POST: APIRoute = async ({ request }) => {
  try {
    const apiKey = import.meta.env.RESEND_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "サーバー設定エラー" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as Payload;

    if (!body.cart?.length) {
      return new Response(JSON.stringify({ error: "メニューが選択されていません" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const c = body.customer;
    if (!c?.name || !c?.email || !c?.tel || !c?.address) {
      return new Response(JSON.stringify({ error: "必須項目が未入力です" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const resend = new Resend(apiKey);

    const customerSubject = "【CLEAN×CLEAN 津中央店】お申込みありがとうございます";
    const customerText = `${c.name} 様

このたびはCLEAN×CLEAN 津中央店をお選びいただきありがとうございます。
以下の内容でお申込みを承りました。後ほど栗田よりご連絡いたします（翌営業日中）。

━━━━━━━━━━━━━━━━━━━
ご注文内容
━━━━━━━━━━━━━━━━━━━
${cartTextLines(body.cart)}

合計（税込）: ${yen(body.total)}

※ 掲載料金は確定料金です。現場状況により標準作業に含まれない追加作業が必要な場合は、別途お見積もりのうえご相談いたします。

━━━━━━━━━━━━━━━━━━━
ご希望日時
━━━━━━━━━━━━━━━━━━━
${datesText(c.dates, c.times)}

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
〒514-0008 三重県津市上浜町3-15-2
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
<p>${c.name} 様</p>
<p>このたびはCLEAN×CLEAN 津中央店をお選びいただきありがとうございます。<br>以下の内容でお申込みを承りました。後ほど栗田よりご連絡いたします（翌営業日中）。</p>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">ご注文内容</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${cartHtmlRows(body.cart)}
<tr><td style="padding:10px 8px;font-weight:bold;background:#E8F5F9">合計（税込）</td><td style="padding:10px 8px;text-align:right;font-weight:bold;background:#E8F5F9;color:#E55F2C;font-size:18px">${yen(body.total)}</td></tr>
</table>
<p style="font-size:12px;color:#6B7A8F;margin-top:8px">※ 掲載料金は確定料金です。現場状況により標準作業に含まれない追加作業が必要な場合は、別途お見積もりのうえご相談いたします。</p>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">ご希望日時</h2>
<pre style="font-family:inherit;white-space:pre-wrap;font-size:14px;margin:0">${datesText(c.dates, c.times)}</pre>
<h2 style="font-size:14px;color:#0D5B7A;border-bottom:2px solid #1E88B0;padding-bottom:5px;margin-top:25px">お客様情報</h2>
<table style="width:100%;font-size:14px">
<tr><td style="padding:4px 0;color:#6B7A8F;width:80px">お名前</td><td>${c.name}（${c.kana}）</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">電話</td><td>${c.tel}</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">メール</td><td>${c.email}</td></tr>
<tr><td style="padding:4px 0;color:#6B7A8F">住所</td><td>〒${c.postal} ${c.address}</td></tr>
${c.coupon ? `<tr><td style="padding:4px 0;color:#6B7A8F">クーポン</td><td>${c.coupon}</td></tr>` : ""}
${c.referrer ? `<tr><td style="padding:4px 0;color:#6B7A8F">紹介者</td><td>${c.referrer}</td></tr>` : ""}
${c.notes ? `<tr><td style="padding:4px 0;color:#6B7A8F">備考</td><td style="white-space:pre-wrap">${c.notes}</td></tr>` : ""}
</table>
<div style="margin-top:30px;padding:15px;background:#E8F5F9;border-radius:8px;text-align:center">
<p style="margin:0;font-size:12px;color:#6B7A8F">お急ぎの場合はお電話ください</p>
<p style="margin:5px 0 0;font-size:22px;font-weight:bold;color:#1E88B0">📞 059-271-5908</p>
<p style="margin:5px 0 0;font-size:12px;color:#6B7A8F">営業時間 9:00〜18:00 / 不定休</p>
</div>
</div>
<div style="background:#0D5B7A;color:#fff;padding:15px;text-align:center;font-size:12px">
CLEAN×CLEAN 津中央店<br>〒514-0008 三重県津市上浜町3-15-2
</div>
</div>
</body></html>`;

    const ownerSubject = `【新規申込】${c.name} 様より`;
    const ownerText = `新規申込が届きました。

━━━━━━━━━━━━━━━━━━━
申込内容
━━━━━━━━━━━━━━━━━━━
${cartTextLines(body.cart)}

合計（税込）: ${yen(body.total)}

━━━━━━━━━━━━━━━━━━━
ご希望日時
━━━━━━━━━━━━━━━━━━━
${datesText(c.dates, c.times)}

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

    await Promise.all([
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

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit error:", err);
    return new Response(
      JSON.stringify({ error: "送信に失敗しました。お電話ください: 059-271-5908" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
