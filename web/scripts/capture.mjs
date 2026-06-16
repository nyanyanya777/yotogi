import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const OUT_DIR = '/tmp/yotogi_capture';
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:3000';

const ROUTES = [
  { name: 'splash', path: '/' },
  { name: 'motif', path: '/motif' },
  { name: 'story', path: '/story' },
  { name: 'folklore', path: '/folklore' },
];

async function snap(ctx, label, path, viewportLabel) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    // small settle delay for any client transitions
    await page.waitForTimeout(400);
    const file = `${OUT_DIR}/${viewportLabel}_${label}.png`;
    await page.screenshot({ path: file, fullPage: false });
    console.log(`OK  ${file}`);
  } catch (e) {
    console.error(`ERR ${viewportLabel}_${label}: ${e.message}`);
  } finally {
    await page.close();
  }
}

async function captureDawn(ctx) {
  // Capture all 4 dawn phases on mobile width.
  // Frame duration = 2000ms, transition = 1600ms.
  // Take screenshots at ~1000ms, ~3000ms, ~5000ms, ~7000ms.
  // But transitions are between frames; the bg/color settle after transition completes.
  // To get clean separation, capture near end of each phase: 1800ms, 3800ms, 5800ms, 7800ms? But transitions overlap.
  // Strategy: capture at mid of each frame: 1000, 3000, 5000, 7000.
  for (let i = 0; i < 4; i++) {
    const page = await ctx.newPage();
    try {
      // Block navigation away from /generating on dawn-4 completion by using a fresh page each time.
      await page.goto(`${BASE}/generating?next=story`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      // Wait until target moment
      const waitMs = 1000 + i * 2000;
      await page.waitForTimeout(waitMs);
      const file = `${OUT_DIR}/dawn_${i + 1}.png`;
      await page.screenshot({ path: file, fullPage: false });
      console.log(`OK  ${file}`);
    } catch (e) {
      console.error(`ERR dawn_${i + 1}: ${e.message}`);
    } finally {
      await page.close();
    }
  }
}

const browser = await chromium.launch();

const ctxMobile = await browser.newContext({
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 2,
});
const ctxPc = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

for (const r of ROUTES) {
  await snap(ctxMobile, r.name, r.path, 'mobile');
  await snap(ctxPc, r.name, r.path, 'pc');
}

// Also capture /generating still (mobile + pc) as a baseline
await snap(ctxMobile, 'generating', '/generating?next=story', 'mobile');
await snap(ctxPc, 'generating', '/generating?next=story', 'pc');

await captureDawn(ctxMobile);

await browser.close();
console.log('done');
