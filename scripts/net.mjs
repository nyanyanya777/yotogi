// 洒落怖(ネット怪談)コレクター — dangi.link(洒落怖超まとめ)から本文を収集
// Usage: node scripts/net.mjs [maxFetch]
import fs from 'fs';
import { sleep, cachedFetch, writeJSON } from './lib.mjs';

const MAX = parseInt(process.argv[2] || '450', 10);
const SITEMAPS = ['', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15']
  .map(i => `https://dangi.link/post-sitemap${i}.xml`);

// 1) サイトマップから記事URLを列挙
async function collectUrls() {
  const set = new Set();
  for (const sm of SITEMAPS) {
    try {
      const xml = await cachedFetch(sm, `data/raw/net/sitemap_${sm.match(/sitemap(\d*)\.xml/)[1] || '1'}.xml`);
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const u = m[1].trim();
        // 記事URL = https://dangi.link/<slug>/ (カテゴリ/タグ/固定ページ等を除外)
        if (/^https:\/\/dangi\.link\/[^/]+\/$/.test(u) && !/\/(category|tag|page|author|link|privacy|about|contact)\//.test(u)) {
          set.add(u);
        }
      }
      await sleep(150);
    } catch (e) { console.log(`sitemap skip ${sm}: ${e.message}`); }
  }
  return [...set];
}

// 2) 記事本文の抽出 (<div id="post-NNN"> ... </article>)
function extractBody(html) {
  const m = html.match(/<div id="post-\d+"[^>]*>([\s\S]*?)<\/article>/i);
  if (!m) return '';
  let seg = m[1]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '');
  let txt = seg.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/g, ' ')
    .replace(/[ \t　]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  // 先頭のパンくず(ホーム/洒落怖/Part…/題/日付)を、最初の日付YYYY/MM/DDまで捨てる
  const dm = txt.match(/\d{4}\/\d{1,2}\/\d{1,2}/);
  if (dm) txt = txt.slice(txt.indexOf(dm[0]) + dm[0].length).trim();
  // 2chの投稿メタ行(NNN 名前：… 投稿日：…)を除去
  txt = txt.replace(/\d+\s*[:：]?\s*名前\s*[：:][^\n]*?投稿日\s*[：:][^\n]*\n?/g, '');
  txt = txt.replace(/^[\s>＞]+/, '').trim();
  return txt;
}

function extractTitle(html) {
  const t = html.match(/<title>([^<]+)<\/title>/);
  if (t) return t[1].split(/\s*[-|｜]\s*/)[0].trim();
  const e = html.match(/class="entry-title"[^>]*>\s*<a[^>]*>([^<]+)</);
  return e ? e[1].trim() : '';
}

// --- run ---
console.log('サイトマップから記事URLを列挙中...');
const urls = await collectUrls();
console.log(`記事URL候補: ${urls.length}`);

const stories = [];
let tried = 0;
for (const url of urls) {
  if (stories.length >= MAX) break;
  tried++;
  const slug = url.replace(/^https:\/\/dangi\.link\//, '').replace(/\/$/, '');
  try {
    const html = await cachedFetch(url, `data/raw/net/${slug}.html`);
    const body = extractBody(html);
    if (body.length < 200) continue; // インデックス/スタブ除外
    stories.push({
      id: `net_${slug}`,
      title: extractTitle(html) || slug,
      system: 'ネット怪談',
      source: 'dangi',
      sourceUrl: url,
      bodyText: body,
      bodyChars: body.length,
    });
    if (stories.length % 25 === 0) console.log(`  ...${stories.length}本 (${stories[stories.length - 1].title})`);
    await sleep(350);
  } catch (e) {
    console.log(`  skip ${slug}: ${e.message}`);
  }
}

writeJSON('data/net.json', stories);
console.log(`\nwrote data/net.json : ${stories.length}本 (試行 ${tried})`);
console.log('サンプル:', stories.slice(0, 6).map(s => `「${s.title}」(${s.bodyChars}字)`).join(' / '));
