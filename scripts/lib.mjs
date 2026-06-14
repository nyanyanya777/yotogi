import fs from 'fs';
import path from 'path';

export function parseCSV(s) {
  s = s.replace(/^﻿/, '');
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else { if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c === '\r') {} else f += c; }
  }
  if (f.length || row.length) { row.push(f); rows.push(row); }
  return rows;
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// fetch with on-disk cache (so re-runs don't re-hit the network)
export async function cachedFetch(url, cacheFile, { binary = false, encoding = '' } = {}) {
  if (cacheFile && fs.existsSync(cacheFile)) {
    return binary ? fs.readFileSync(cacheFile) : fs.readFileSync(cacheFile, 'utf8');
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (netlore-collector; research)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  if (binary) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (cacheFile) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, buf); }
    return buf;
  }
  // charset-aware decode: 青空文庫のHTMLは Shift_JIS。バイトで受けてcharsetを判定しデコードする
  const buf = Buffer.from(await res.arrayBuffer());
  let enc = (encoding || '').toLowerCase();
  if (!enc) {
    const head = buf.toString('latin1', 0, 4096);
    const m = head.match(/charset\s*=\s*["']?([\w-]+)/i);
    enc = m ? m[1].toLowerCase() : 'utf-8';
  }
  if (['shift_jis', 'shift-jis', 'sjis', 'x-sjis', 'windows-31j', 'cp932'].includes(enc)) enc = 'shift_jis';
  const txt = new TextDecoder(enc).decode(buf); // 正しいUTF-8文字列に
  if (cacheFile) { fs.mkdirSync(path.dirname(cacheFile), { recursive: true }); fs.writeFileSync(cacheFile, txt, 'utf8'); }
  return txt;
}

// strip HTML tags, drop ruby furigana, collapse whitespace
export function htmlToText(html) {
  // Aozora main body is in <div class="main_text"> ... </div>
  const m = html.match(/<div class="main_text">([\s\S]*?)<\/div>\s*<\/div>/);
  let body = m ? m[1] : html;
  body = body
    .replace(/<rp>[\s\S]*?<\/rp>/g, '')      // ruby parens
    .replace(/<rt>[\s\S]*?<\/rt>/g, '')      // ruby reading (furigana)
    .replace(/<[^>]+>/g, '')                  // remaining tags
    .replace(/[ \t　]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&[a-z]+;/g, ' ')
    .trim();
  return body;
}

export function writeJSON(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
