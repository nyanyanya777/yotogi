// Aozora Bunko collector — pulls public-domain kaidan works (metadata + full body text)
// Usage: node scripts/aozora.mjs [maxFetch]
import fs from 'fs';
import { parseCSV, sleep, cachedFetch, htmlToText, writeJSON } from './lib.mjs';

const MAX = parseInt(process.argv[2] || '40', 10);

// curated kaidan authors (matched by name; person-id resolved from the CSV)
const KAIDAN_AUTHORS = [
  ['小泉', '八雲'], ['岡本', '綺堂'], ['泉', '鏡花'], ['田中', '貢太郎'],
  ['三遊亭', '円朝'], ['夢野', '久作'], ['豊島', '与志雄'], ['柳田', '国男'],
];
const TITLE_KW = /怪|幽霊|妖|鬼|化け|呪|祟|亡霊|怨|魔|霊|幻|物の怪|百物語|怪談/;

const csv = parseCSV(fs.readFileSync('data/raw/list_person_all_extended_utf8.csv', 'utf8'));
const head = csv[0]; const col = (n) => head.indexOf(n);
const C = {
  id: col('作品ID'), name: col('作品名'), ndc: col('分類番号'), shoshutsu: col('初出'),
  flag: col('作品著作権フラグ'), card: col('図書カードURL'), pid: col('人物ID'),
  sei: col('姓'), mei: col('名'), role: col('役割フラグ'), botsu: col('没年月日'),
};
const rows = csv.slice(1).filter(r => r.length > C.card);

const isAuthor = (r) => KAIDAN_AUTHORS.some(([s, m]) => r[C.sei] === s && r[C.mei] === m);
// candidate = public domain AND (curated kaidan author OR kaidan keyword in title)
let cands = rows.filter(r => r[C.flag] === 'なし' && (isAuthor(r) || TITLE_KW.test(r[C.name])));
// de-dup by 作品ID (a work can have multiple person rows: author/translator)
const seen = new Set();
cands = cands.filter(r => { const k = r[C.id]; if (seen.has(k)) return false; seen.add(k); return true; });
// authors first (highest quality), then keyword hits
cands.sort((a, b) => (isAuthor(b) ? 1 : 0) - (isAuthor(a) ? 1 : 0));

console.log(`candidates: ${cands.length} (fetching up to ${MAX})`);

const stories = [];
let fetched = 0;
for (const r of cands) {
  if (fetched >= MAX) break;
  const cardUrl = r[C.card];
  const pidDir = cardUrl.match(/cards\/(\d+)\//)?.[1];
  const cardId = cardUrl.match(/card(\d+)\.html/)?.[1];
  if (!pidDir || !cardId) continue;
  try {
    const cardHtml = await cachedFetch(cardUrl, `data/raw/aozora/card_${pidDir}_${cardId}.html`);
    const xhtmlRel = cardHtml.match(/files\/(\d+_\d+\.html)/)?.[1];
    if (!xhtmlRel) continue; // no XHTML body available (some are images only)
    const xhtmlUrl = `https://www.aozora.gr.jp/cards/${pidDir}/files/${xhtmlRel}`;
    const xhtml = await cachedFetch(xhtmlUrl, `data/raw/aozora/body_${pidDir}_${xhtmlRel}`);
    const body = htmlToText(xhtml);
    if (body.length < 200) continue; // skip stubs
    stories.push({
      id: `aozora_${r[C.id]}`,
      title: r[C.name],
      author: `${r[C.sei]}${r[C.mei]}`.trim(),
      system: '古典怪談',
      ndc: r[C.ndc],
      shoshutsu: r[C.shoshutsu],
      sourceUrl: cardUrl,            // kept for our records, NOT shown in UI
      bodyText: body,
      bodyChars: body.length,
    });
    fetched++;
    if (fetched % 5 === 0) console.log(`  ...${fetched} fetched (${r[C.name]})`);
    await sleep(400); // polite rate-limit
  } catch (e) {
    console.log(`  skip ${r[C.name]}: ${e.message}`);
  }
}

writeJSON('data/aozora.json', stories);
console.log(`\nwrote data/aozora.json : ${stories.length} stories`);
console.log('sample:', stories.slice(0, 8).map(s => `${s.author}「${s.title}」(${s.bodyChars}字)`).join('\n  '));
