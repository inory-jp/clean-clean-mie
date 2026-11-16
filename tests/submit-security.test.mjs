import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';

// ネットワークを完全に遮断し、メールSDKとの境界だけを差し替える。
globalThis.fetch = () => { throw new Error('テストから外部通信は禁止'); };
const menus = JSON.parse(await readFile(new URL('../src/data/menus.json', import.meta.url)));
const route = await readFile(new URL('../src/pages/api/submit.ts', import.meta.url), 'utf8');
let sequence = 0;
async function setup({ missingKey = false, error = false } = {}) {
  const key = `__submitTest${sequence++}`;
  globalThis[key] = { calls: [], error };
  const source = route
    .replace('import { Resend } from "resend";', `const state = globalThis[${JSON.stringify(key)}]; class Resend { emails = { send: async (mail) => { state.calls.push(mail); return state.error ? {error:{message:'dummy failure'}} : {data:{id:'dummy'}}; } }; }`)
    .replace('import menusData from "../../data/menus.json";', `const menusData = ${JSON.stringify(menus)};`)
    .replace('import.meta.env.RESEND_API_KEY', JSON.stringify(missingKey ? '' : 'test-only-no-network'));
  const { POST } = await import('data:text/javascript;base64,' + Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
  return { state: globalThis[key], post: async (body, headers = {}, raw = false) => POST({request:new Request('https://test.example/api/submit', {
    method:'POST', headers:{origin:'https://test.example','content-type':'application/json',...headers},body:raw ? body : JSON.stringify(body),
  })}) };
}
const category = menus.categories.find(c => c.orderable !== false && c.menus.some(m => m.published && m.price != null));
const menu = category.menus.find(m => m.published && m.price != null);
const payload = () => ({cart:[{id:menu.id, name:'偽の名称',price:1,qty:2}],total:2,website:'',customer:{name:'試験 <img src=x>',kana:'テスト',tel:'0000000000',email:'nobody@example.invalid',postal:'0000000',address:'試験住所',dates:[''],times:[''],notes:'<script>example</script>'}});

test('正常入力はマスタの名称・料金でメール2通を組み立て、HTMLをエスケープする',async()=>{
 const {post,state}=await setup();const r=await post(payload());assert.equal(r.status,200);assert.equal(state.calls.length,2);
 assert.ok(state.calls[0].text.includes(menu.name));assert.ok(state.calls[0].text.includes(`¥${(menu.price*2).toLocaleString()}`));assert.ok(!state.calls[0].text.includes('偽の名称'));
 assert.ok(state.calls[0].html.includes('&lt;script&gt;'));assert.ok(!state.calls[0].html.includes('<img src=x>'));
 assert.equal(r.headers.get('cache-control'),'no-store');
});
const mutations = [
 ['ハニーポット',p=>p.website='bot'], ['空白の氏名',p=>p.customer.name='  '], ['空白の電話',p=>p.customer.tel=' '],
 ['不正メール',p=>p.customer.email='a\r\nBcc:x@y.z'], ['氏名の改行',p=>p.customer.name='a\nb'],
 ['長すぎる備考',p=>p.customer.notes='x'.repeat(501)], ['非文字列の任意項目',p=>p.customer.coupon={}],
 ['日時が文字列',p=>p.customer.dates='tomorrow'], ['日時の要素が不正',p=>p.customer.times=[{}]],
 ['過剰な希望日時',p=>p.customer.dates=['','','','']], ['空カート',p=>p.cart=[]],
 ['不明なメニュー',p=>p.cart[0].id='missing'], ['数量0',p=>p.cart[0].qty=0], ['小数数量',p=>p.cart[0].qty=1.5],
 ['過剰数量',p=>p.cart[0].qty=11], ['重複ID',p=>p.cart.push({...p.cart[0]})], ['nullの商品',p=>p.cart=[null]],
];
for(const [name,mutate] of mutations)test(`${name}を拒否しメールSDKを呼ばない`,async()=>{const {post,state}=await setup();const p=payload();mutate(p);assert.equal((await post(p)).status,400);assert.equal(state.calls.length,0)});
for(const [name,body,headers,status] of [
 ['異なるOrigin','{}',{origin:'https://evil.example'},403], ['Origin欠落','{}',{origin:''},403],
 ['不正JSON','{',{},400],['null本文','null',{},400],['配列本文','[]',{},400],
 ['異なるContent-Type','{}',{'content-type':'text/plain'},415],
 ['長さ申告で制限','{}',{'content-length':'32001'},413],
 ['長さ申告なしでも制限',JSON.stringify({notes:'あ'.repeat(12000)}),{},413],
 ['小さい長さ申告でも制限',JSON.stringify({notes:'x'.repeat(33000)}),{'content-length':'1'},413],
])test(name,async()=>{const {post,state}=await setup();const r=await post(body,headers,true);assert.equal(r.status,status);assert.equal(state.calls.length,0);assert.equal(r.headers.get('cache-control'),'no-store')});
test('親なし・親より多いオプションを拒否する',async()=>{
 const cat=menus.categories.find(c=>c.orderable!==false && c.options?.some(o=>o.applies_to?.some(id=>c.menus.some(m=>m.id===id&&m.published&&m.price!=null))));
 const opt=cat.options.find(o=>o.applies_to?.some(id=>cat.menus.some(m=>m.id===id&&m.published&&m.price!=null)));const id=opt.applies_to.find(id=>cat.menus.some(m=>m.id===id&&m.published&&m.price!=null));
 const {post,state}=await setup();const p=payload();p.cart=[{id:`${opt.id}@${id}`,qty:1}];assert.equal((await post(p)).status,400);
 p.cart.push({id,qty:1});p.cart[0].qty=2;assert.equal((await post(p)).status,400);p.cart[0].qty=1;assert.equal((await post(p)).status,200);assert.equal(state.calls.length,2);
});
test('同一IPで6回目を拒否する（インスタンス内の補助制限）',async()=>{const {post,state}=await setup();for(let i=0;i<5;i++)assert.equal((await post(payload())).status,200);assert.equal((await post(payload())).status,429);assert.equal(state.calls.length,10)});
test('キー未設定では送信しない',async()=>{const {post,state}=await setup({missingKey:true});assert.equal((await post(payload())).status,500);assert.equal(state.calls.length,0)});
test('メールSDKのエラーを完了扱いにしない',async()=>{const {post}=await setup({error:true});assert.equal((await post(payload())).status,502)});
test('Vercelのセキュリティヘッダー設定',async()=>{const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url)));const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));assert.equal(headers['X-Frame-Options'],'DENY');assert.equal(headers['X-Content-Type-Options'],'nosniff');assert.equal(headers['Referrer-Policy'],'strict-origin-when-cross-origin');assert.equal(headers['Permissions-Policy'],'camera=(), microphone=(), geolocation=()')});
