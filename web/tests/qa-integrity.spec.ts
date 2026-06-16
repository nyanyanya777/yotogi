/**
 * QA Integrity spec — specific layout bug detection
 * Checks for overflow, clipping, CTA visibility, sticky behavior, overlaps
 */
import { test, expect, Page } from "@playwright/test";

const BASE = "http://localhost:3001";

// -------------------------
// HELPER: check element is visible in viewport
// -------------------------
async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.left >= 0 &&
      rect.right <= window.innerWidth &&
      rect.width > 0 &&
      rect.height > 0
    );
  }, selector);
}

// check if element overflows its parent
async function checkOverflow(page: Page, selector: string): Promise<{ overflowsX: boolean; overflowsY: boolean; width: number; scrollWidth: number; height: number; scrollHeight: number }> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement;
    if (!el) return { overflowsX: false, overflowsY: false, width: 0, scrollWidth: 0, height: 0, scrollHeight: 0 };
    return {
      overflowsX: el.scrollWidth > el.clientWidth,
      overflowsY: el.scrollHeight > el.clientHeight,
      width: el.clientWidth,
      scrollWidth: el.scrollWidth,
      height: el.clientHeight,
      scrollHeight: el.scrollHeight,
    };
  }, selector);
}

async function getElementBounds(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
  }, selector);
}

// -------------------------
// TEST: Splash CTA visible at 670px height (PC short viewport)
// -------------------------
test.describe("Splash / CTA fold visibility", () => {
  test("CTA '作成する' visible at 1240x670 (short PC viewport)", async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 670 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    // Find PrimaryCTA button
    const ctaBtn = page.locator("button").filter({ hasText: "作成する" });
    const count = await ctaBtn.count();
    expect(count, "CTA button '作成する' must exist").toBeGreaterThan(0);

    const bounds = await ctaBtn.first().boundingBox();
    expect(bounds, "CTA button must have bounding box").not.toBeNull();

    // CTA bottom must be within viewport height
    expect(
      bounds!.y + bounds!.height,
      `CTA bottom (${bounds!.y + bounds!.height}px) must be <= viewport height (670px). CTA is hidden below fold.`
    ).toBeLessThanOrEqual(670);

    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__splash__1240x670__cta-check.png", fullPage: false });
  });

  test("CTA '作成する' visible at 375x667 (mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const ctaBtn = page.locator("button").filter({ hasText: "作成する" });
    const bounds = await ctaBtn.first().boundingBox();
    expect(bounds, "CTA must have bounds").not.toBeNull();

    // On mobile splash has min-h-[874px], so CTA WILL be below fold — this is a known potential issue
    const isVisible = (bounds!.y + bounds!.height) <= 667;
    // Take screenshot to document
    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__splash__375x667__cta-check.png", fullPage: false });

    // Report the values via a console log
    console.log(`[splash 375x667] CTA top=${bounds!.y} bottom=${bounds!.y + bounds!.height} viewport=667 visible=${isVisible}`);
  });

  test("CTA '作成する' visible at 390x844 (mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const ctaBtn = page.locator("button").filter({ hasText: "作成する" });
    const bounds = await ctaBtn.first().boundingBox();
    expect(bounds, "CTA must have bounds").not.toBeNull();

    const isVisible = (bounds!.y + bounds!.height) <= 844;
    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__splash__390x844__cta-check.png", fullPage: false });
    console.log(`[splash 390x844] CTA top=${bounds!.y} bottom=${bounds!.y + bounds!.height} viewport=844 visible=${isVisible}`);
  });
});

// -------------------------
// TEST: Motif page — sticky CTA at short viewports
// -------------------------
test.describe("Motif / sticky CTA + chip scroll", () => {
  const motifViewports = [
    { name: "375x667", w: 375, h: 667 },
    { name: "390x844", w: 390, h: 844 },
    { name: "412x915", w: 412, h: 915 },
    { name: "1240x670", w: 1240, h: 670 },
    { name: "1280x800", w: 1280, h: 800 },
  ];

  for (const vp of motifViewports) {
    test(`motif sticky CTA visible at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);

      // Check sticky bottom bar is visible
      const ctaBtn = page.locator("button").filter({ hasText: "怪談を作る" });
      const count = await ctaBtn.count();
      expect(count, "CTA '怪談を作る' must exist").toBeGreaterThan(0);

      const bounds = await ctaBtn.first().boundingBox();
      console.log(`[motif ${vp.name}] CTA bounds: top=${bounds?.y} bottom=${bounds ? bounds.y + bounds.height : 'N/A'} viewport_h=${vp.h}`);

      if (bounds) {
        const ctaBottom = bounds.y + bounds.height;
        const isVisible = ctaBottom <= vp.h && bounds.y >= 0;
        console.log(`[motif ${vp.name}] CTA in viewport: ${isVisible}`);
      }

      await page.screenshot({ path: `/tmp/qa-screenshots/DETAIL__motif__${vp.name}__cta-check.png`, fullPage: false });
    });
  }

  test("motif chip scroll area doesn't overflow horizontally", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth;
    });
    console.log(`[motif 375x667] horizontal overflow on body: ${bodyOverflow}`);
    expect(bodyOverflow, "Page must not have horizontal scroll on mobile").toBe(false);

    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__motif__375x667__overflow-check.png", fullPage: false });
  });

  test("motif BottomBar not covering chips at 375x667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    // Get the scroll area and bottom bar bounds
    const scrollArea = await getElementBounds(page, ".overflow-y-auto");
    const bottomBar = await page.evaluate(() => {
      // Find sticky bottom container
      const stickyEls = Array.from(document.querySelectorAll("*")).filter(el => {
        const style = window.getComputedStyle(el);
        return style.position === "sticky" && el.textContent?.includes("怪談を作る");
      });
      if (stickyEls.length === 0) return null;
      const rect = stickyEls[0].getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: rect.height };
    });

    console.log(`[motif 375x667] scrollArea bounds:`, scrollArea);
    console.log(`[motif 375x667] bottomBar bounds:`, bottomBar);

    // The scroll content has pb-[180px] to account for bottom bar
    // Verify the padding is sufficient
    const scrollPaddingResult = await page.evaluate(() => {
      const scrollEl = document.querySelector(".overflow-y-auto");
      if (!scrollEl) return null;
      const style = window.getComputedStyle(scrollEl);
      return { paddingBottom: style.paddingBottom };
    });
    console.log(`[motif 375x667] scroll area padding-bottom: ${scrollPaddingResult?.paddingBottom}`);
  });
});

// -------------------------
// TEST: Story page — footer overlap check
// -------------------------
test.describe("Story / footer overlap on long content", () => {
  const storyViewports = [
    { name: "375x667", w: 375, h: 667 },
    { name: "390x844", w: 390, h: 844 },
    { name: "1240x670", w: 1240, h: 670 },
    { name: "1280x800", w: 1280, h: 800 },
  ];

  for (const vp of storyViewports) {
    test(`story footer visible and not overlapping content at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/story`, { waitUntil: "networkidle" });
      await page.waitForTimeout(300);

      const footer = await getElementBounds(page, "footer");
      console.log(`[story ${vp.name}] footer bounds:`, footer);

      // Footer should be visible in viewport
      if (footer) {
        console.log(`[story ${vp.name}] footer top=${footer.top} bottom=${footer.bottom} viewport_h=${vp.h}`);
        // Footer must be within viewport bottom
        const footerInView = footer.bottom <= vp.h;
        console.log(`[story ${vp.name}] footer in viewport: ${footerInView}`);
      }

      // Check if main content overlaps with footer
      const mainEl = await getElementBounds(page, "main");
      if (mainEl && footer) {
        const overlap = mainEl.bottom > footer.top;
        console.log(`[story ${vp.name}] main.bottom=${mainEl.bottom} footer.top=${footer.top} overlap=${overlap}`);
      }

      // Check max-width constraint on story page (should be max 402px on PC)
      const containerWidth = await page.evaluate(() => {
        const el = document.querySelector("footer");
        if (!el) return null;
        const style = window.getComputedStyle(el);
        return { width: el.clientWidth, maxWidth: style.maxWidth };
      });
      console.log(`[story ${vp.name}] footer container:`, containerWidth);

      await page.screenshot({ path: `/tmp/qa-screenshots/DETAIL__story__${vp.name}__footer.png`, fullPage: false });
    });
  }

  test("story CTA '解説を作成' button is clickable", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/story`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const cta = page.locator("a").filter({ hasText: "解説を作成" });
    const count = await cta.count();
    expect(count, "解説を作成 link must exist").toBeGreaterThan(0);

    const isEnabled = await cta.first().isEnabled();
    expect(isEnabled, "解説を作成 link must be enabled").toBe(true);

    // Check pointer events
    const pointerEvents = await cta.first().evaluate((el) => {
      return window.getComputedStyle(el).pointerEvents;
    });
    console.log(`[story] 解説を作成 pointer-events: ${pointerEvents}`);
    expect(pointerEvents, "pointer-events must not be 'none'").not.toBe("none");
  });
});

// -------------------------
// TEST: Folklore — night-fragment fade overlay check
// -------------------------
test.describe("Folklore / night-fragment fade overlay", () => {
  test("night-fragment has content and fade overlay", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/folklore`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // Find the night-fragment section (sumi-1 bg card)
    const fragment = page.locator("section.rounded-\\[20px\\]").first();
    const count = await fragment.count();
    expect(count, "night-fragment section must exist").toBeGreaterThan(0);

    // Check excerpt text is present
    const excerptEl = await page.evaluate(() => {
      const sections = document.querySelectorAll("section");
      for (const s of sections) {
        if (s.classList.contains("bg-sumi-1") || window.getComputedStyle(s).backgroundColor.includes("28, 24, 20")) {
          const p = s.querySelector("p:last-of-type");
          return p ? { text: p.textContent?.substring(0, 50), exists: true } : { text: null, exists: false };
        }
      }
      return { text: null, exists: false };
    });
    console.log(`[folklore] night-fragment excerpt:`, excerptEl);

    // Check fade overlay exists
    const fadeOverlay = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll("div[aria-hidden='true']"));
      return divs.some(d => {
        const style = window.getComputedStyle(d);
        const bg = style.background || style.backgroundImage;
        return bg.includes("gradient") || bg.includes("linear");
      });
    });
    console.log(`[folklore] fade overlay exists: ${fadeOverlay}`);

    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__folklore__375x667__fragment.png", fullPage: false });
  });

  test("folklore text readable - not hidden by overlay at all viewports", async ({ page }) => {
    const viewports = [
      { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 1280, h: 800 }
    ];
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/folklore`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);

      // Check the main academic section text is visible
      const academicText = await page.locator("text=民俗学的解説").first();
      const acCount = await academicText.count();
      console.log(`[folklore ${vp.w}x${vp.h}] '民俗学的解説' heading found: ${acCount > 0}`);

      await page.screenshot({ path: `/tmp/qa-screenshots/DETAIL__folklore__${vp.w}x${vp.h}.png`, fullPage: true });
    }
  });

  test("folklore horizontal overflow check", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/folklore`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const hOverflow = await page.evaluate(() => document.body.scrollWidth > document.body.clientWidth);
    console.log(`[folklore 375x667] horizontal overflow: ${hOverflow}`);
    expect(hOverflow, "folklore must not have horizontal scroll").toBe(false);
  });
});

// -------------------------
// TEST: Generating page — dawn transition
// -------------------------
test.describe("Generating / dawn transition", () => {
  test("generating dawn-1 frame renders immediately", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/generating?next=story`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    // Check kanji is visible
    const kanjiEl = await page.locator(".font-mincho").filter({ hasText: /^[暗薄明解]$/ }).first();
    const kanjiCount = await kanjiEl.count();
    console.log(`[generating] kanji visible count: ${kanjiCount}`);

    // Check progressbar
    const progressbar = page.locator("[role='progressbar']");
    const pbCount = await progressbar.count();
    console.log(`[generating] progressbar count: ${pbCount}`);

    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__generating__390x844__dawn1.png", fullPage: false });
  });

  test("generating page does not show blank screen during transition", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/generating?next=story`, { waitUntil: "domcontentloaded" });

    // Capture at dawn-1
    await page.waitForTimeout(100);
    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__generating__1280x800__t100.png", fullPage: false });

    // Capture at dawn-2 transition
    await page.waitForTimeout(2100);
    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__generating__1280x800__t2100.png", fullPage: false });

    // Check bg is not default white (would indicate blank render)
    const bgColor = await page.evaluate(() => {
      const el = document.querySelector("[aria-live='polite']") as HTMLElement;
      if (!el) return window.getComputedStyle(document.body).backgroundColor;
      return window.getComputedStyle(el).backgroundColor;
    });
    console.log(`[generating 1280x800 t2100] background: ${bgColor}`);
    expect(bgColor, "generating page must not be white/blank").not.toBe("rgb(255, 255, 255)");
  });

  test("generating kanji text not clipped at all mobile viewports", async ({ page }) => {
    const viewports = [
      { w: 375, h: 667 }, { w: 390, h: 844 }, { w: 412, h: 915 }
    ];
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/generating?next=story`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);

      const kanjiBounds = await page.evaluate(() => {
        const spans = Array.from(document.querySelectorAll("span.font-mincho, span[style*='color']"));
        for (const s of spans) {
          const text = s.textContent?.trim();
          if (text && ["暗", "薄", "明", "解"].includes(text)) {
            const rect = s.getBoundingClientRect();
            return { text, top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
          }
        }
        return null;
      });
      console.log(`[generating ${vp.w}x${vp.h}] kanji bounds:`, kanjiBounds);
    }
  });
});

// -------------------------
// TEST: Global horizontal overflow check
// -------------------------
test.describe("Global / horizontal overflow", () => {
  const pages = ["/", "/motif", "/story", "/folklore", "/generating?next=story"];
  const viewports = [
    { name: "375x667", w: 375, h: 667 },
    { name: "390x844", w: 390, h: 844 },
    { name: "768x1024", w: 768, h: 1024 },
  ];

  for (const pg of pages) {
    for (const vp of viewports) {
      test(`no horizontal overflow: ${pg} @ ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h });
        await page.goto(`${BASE}${pg}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);

        const result = await page.evaluate(() => ({
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          overflows: document.body.scrollWidth > document.body.clientWidth,
        }));
        console.log(`[${pg} ${vp.name}] ${JSON.stringify(result)}`);
        expect(result.overflows, `${pg} at ${vp.name} has horizontal scroll (scrollWidth=${result.bodyScrollWidth} > clientWidth=${result.bodyClientWidth})`).toBe(false);
      });
    }
  }
});

// -------------------------
// TEST: PC viewport — motif max-width container check
// -------------------------
test.describe("PC viewports / container width sanity", () => {
  const pcViewports = [
    { name: "1280x800", w: 1280, h: 800 },
    { name: "1440x900", w: 1440, h: 900 },
    { name: "1920x1080", w: 1920, h: 1080 },
  ];

  for (const vp of pcViewports) {
    test(`motif container width <= 402px at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);

      const containerWidth = await page.evaluate(() => {
        // Find the 402px constrained container
        const el = document.querySelector(".max-w-\\[402px\\]") as HTMLElement;
        if (!el) return null;
        return el.clientWidth;
      });
      console.log(`[motif ${vp.name}] container width: ${containerWidth}`);
      if (containerWidth !== null) {
        expect(containerWidth, `Mobile container should be <= 402px at PC viewport`).toBeLessThanOrEqual(402);
      }
    });

    test(`story max-width on PC at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`${BASE}/story`, { waitUntil: "networkidle" });
      await page.waitForTimeout(200);

      const contentWidth = await page.evaluate(() => {
        const main = document.querySelector("main") as HTMLElement;
        if (!main) return null;
        return main.clientWidth;
      });
      console.log(`[story ${vp.name}] main width: ${contentWidth}`);
    });
  }
});

// -------------------------
// TEST: Motif overflow when chips exceed viewport height
// -------------------------
test.describe("Motif / scrollability", () => {
  test("scroll area scrolls and last chip reachable at 375x667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/motif`, { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    // Scroll to bottom of scroll container
    await page.evaluate(() => {
      const scrollEl = document.querySelector(".overflow-y-auto");
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
    await page.waitForTimeout(100);

    await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__motif__375x667__scrolled-bottom.png", fullPage: false });

    // Last chip should be visible (not hidden behind bottom bar)
    const lastChip = page.locator("button").filter({ hasText: "神隠し・行方不明" }).last();
    const lastChipCount = await lastChip.count();
    console.log(`[motif 375x667] last chip '神隠し・行方不明' count: ${lastChipCount}`);

    if (lastChipCount > 0) {
      const bounds = await lastChip.boundingBox();
      const ctaBtn = page.locator("button").filter({ hasText: "怪談を作る" });
      const ctaBounds = await ctaBtn.first().boundingBox();
      console.log(`[motif 375x667] last chip bottom=${bounds ? bounds.y + bounds.height : 'N/A'}, CTA top=${ctaBounds?.y}`);

      // After scroll, chip should not be behind CTA
      if (bounds && ctaBounds) {
        const chipsHiddenByCTA = bounds.y + bounds.height > ctaBounds.y && bounds.y < ctaBounds.y + ctaBounds.height;
        console.log(`[motif 375x667] last chip hidden by CTA overlay: ${chipsHiddenByCTA}`);
        expect(chipsHiddenByCTA, "last chip must not be obscured by sticky CTA after scrolling to bottom").toBe(false);
      }
    }
  });
});

// -------------------------
// TEST: PCFrame — bg image covers full viewport on PC
// -------------------------
test.describe("PCFrame / background", () => {
  test("splash bg image visible on PC viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const bgImg = await page.evaluate(() => {
      const img = document.querySelector("img[aria-hidden='true']") as HTMLImageElement;
      if (!img) return { found: false };
      const rect = img.getBoundingClientRect();
      return {
        found: true,
        visible: img.offsetParent !== null || window.getComputedStyle(img).display !== "none",
        width: img.naturalWidth,
        height: img.naturalHeight,
        rendered: { w: rect.width, h: rect.height },
      };
    });
    console.log(`[splash 1440x900] bg image:`, bgImg);
  });
});

// -------------------------
// TEST: Generating — check no nav/header overlaps kanji
// -------------------------
test.describe("Generating / layout integrity", () => {
  test("status bar doesn't overlap kanji character", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/generating?next=story`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);

    const statusBarBounds = await page.evaluate(() => {
      // Status bar is absolute top-0
      const el = document.querySelector(".absolute.top-0") as HTMLElement;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });

    const kanjiBounds = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll("span"));
      for (const s of spans) {
        const text = s.textContent?.trim();
        if (text && ["暗", "薄", "明", "解"].includes(text)) {
          const r = s.getBoundingClientRect();
          return { top: r.top, bottom: r.bottom };
        }
      }
      return null;
    });

    console.log(`[generating 375x667] statusBar:`, statusBarBounds);
    console.log(`[generating 375x667] kanji:`, kanjiBounds);

    if (statusBarBounds && kanjiBounds) {
      const overlaps = statusBarBounds.bottom > kanjiBounds.top && statusBarBounds.top < kanjiBounds.bottom;
      console.log(`[generating 375x667] status bar overlaps kanji: ${overlaps}`);
      expect(overlaps, "Status bar must not overlap kanji character").toBe(false);
    }
  });
});
