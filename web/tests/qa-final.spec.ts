import { test, expect } from "@playwright/test";
const BASE = "http://localhost:3001";

test("FolkloreGlosses at tablet 768x1024", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/folklore`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  
  const glosses = await page.evaluate(() => {
    const glossEls = document.querySelectorAll("[class*='gloss'], [class*='aside'], aside");
    const result = Array.from(glossEls).map(el => {
      const rect = el.getBoundingClientRect();
      return { class: el.className.substring(0, 60), left: rect.left, right: rect.right, width: rect.width };
    });
    return result;
  });
  console.log("[folklore 768x1024] glosses:", JSON.stringify(glosses, null, 2));
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__folklore__768x1024.png", fullPage: false });
});

test("story scroll height check at 375x667", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`${BASE}/story`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  
  const scrollInfo = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      mainScrollHeight: main?.scrollHeight,
      mainClientHeight: main?.clientHeight,
      canScroll: main ? main.scrollHeight > main.clientHeight : false,
      overflow: main ? window.getComputedStyle(main).overflowY : null,
    };
  });
  console.log("[story 375x667] scroll info:", scrollInfo);
});

test("story scroll height check at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/story`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  
  const scrollInfo = await page.evaluate(() => {
    const main = document.querySelector("main");
    return {
      mainScrollHeight: main?.scrollHeight,
      mainClientHeight: main?.clientHeight,
      canScroll: main ? main.scrollHeight > main.clientHeight : false,
    };
  });
  console.log("[story 390x844] scroll info:", scrollInfo);
});

test("check motif page at tablet 768x1024 - chip overflow", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  
  const info = await page.evaluate(() => {
    const scrollEl = document.querySelector(".overflow-y-auto");
    const ctaEl = Array.from(document.querySelectorAll("*")).find(el => el.textContent?.trim() === "怪談を作る");
    const ctaRect = ctaEl?.getBoundingClientRect();
    return {
      scrollable: scrollEl ? scrollEl.scrollHeight > scrollEl.clientHeight : null,
      ctaInViewport: ctaRect ? ctaRect.bottom <= window.innerHeight : null,
      ctaRect: ctaRect ? { top: ctaRect.top, bottom: ctaRect.bottom } : null,
    };
  });
  console.log("[motif 768x1024]:", info);
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__motif__768x1024.png", fullPage: false });
});

test("generating no PCFrame wrapper - full bleed check", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/generating?next=story`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  
  const info = await page.evaluate(() => {
    const bg = document.querySelector("[aria-live='polite']") as HTMLElement;
    if (!bg) return null;
    const rect = bg.getBoundingClientRect();
    return {
      width: rect.width,
      viewportWidth: window.innerWidth,
      isFullWidth: rect.width >= window.innerWidth,
    };
  });
  console.log("[generating 1440x900] full bleed:", info);
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__generating__1440x900.png", fullPage: false });
});
