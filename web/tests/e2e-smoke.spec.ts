/**
 * YOTOGI E2E smoke + regression suite
 * 10 viewports × 5 pages + happy-path + targeted regression checks
 */
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

const BASE = "http://localhost:3001";

const VIEWPORTS = [
  { name: "mobile-375x667",  width: 375,  height: 667  },
  { name: "mobile-390x844",  width: 390,  height: 844  },
  { name: "mobile-412x915",  width: 412,  height: 915  },
  { name: "tablet-768x1024", width: 768,  height: 1024 },
  { name: "tablet-1024x1366",width: 1024, height: 1366 },
  { name: "pc-1240x670",     width: 1240, height: 670  },
  { name: "pc-1280x800",     width: 1280, height: 800  },
  { name: "pc-1440x900",     width: 1440, height: 900  },
  { name: "pc-1920x1080",    width: 1920, height: 1080 },
  { name: "pc-2560x1440",    width: 2560, height: 1440 },
] as const;

const PAGES = [
  { path: "/",           name: "splash"     },
  { path: "/motif",      name: "motif"      },
  { path: "/story",      name: "story"      },
  { path: "/folklore",   name: "folklore"   },
  { path: "/generating", name: "generating" },
] as const;

const SCREENSHOT_DIR = path.join(__dirname, "../test-results/e2e-smoke");
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function screenshot(page: Page, name: string) {
  const p = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

// ── 1. Screenshot sweep: all 10 viewports × 5 pages ──────────────────────────

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("all 5 pages render without crash", async ({ page }) => {
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => errors.push(err.message));

      for (const pg of PAGES) {
        await page.goto(BASE + pg.path, { waitUntil: "domcontentloaded" });
        // wait a moment for hydration
        await page.waitForTimeout(600);
        await screenshot(page, `${vp.name}__${pg.name}`);
      }

      // console errors accumulated across all 5 pages
      const relevant = errors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("net::ERR_ABORTED") &&
          !e.includes("AbortError")
      );
      expect(relevant, `console errors on ${vp.name}: ${relevant.join(" | ")}`).toEqual([]);
    });
  });
}

// ── 2. Regression: splash CTA visible + clickable on iPhone SE 375×667 ───────

test.describe("regression: splash CTA on 375×667", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("CTA 作成する is fully visible and clickable", async ({ page }) => {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    const cta = page.getByRole("link", { name: "作成する" });
    await expect(cta).toBeVisible();

    // check it's not clipped below viewport
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(667 + 4); // ≤ viewport bottom (+4px tolerance)
    expect(box!.y).toBeGreaterThan(0);

    await screenshot(page, "regression__splash-cta-375x667");

    // Actually click and verify navigation to /motif
    await cta.click();
    await expect(page).toHaveURL(/\/motif/, { timeout: 5000 });
  });
});

// ── 3. Regression: /motif counter stays "3 / 3" on 4th chip click ────────────

test.describe("regression: /motif 4th-click counter", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("counter stays 3 / 3 after clicking 4th chip", async ({ page }) => {
    await page.goto(BASE + "/motif", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    // select 3 chips from different categories
    const chips = [
      "学校・施設",
      "女の霊・悪霊",
      "呪い・祟り",
      "錯乱（見えなくなる）", // 4th
    ];

    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: chips[i] }).click();
      await page.waitForTimeout(100);
    }

    const counter = page.locator("[aria-label*='選択中']");
    await expect(counter).toHaveText("3 / 3");

    // click 4th chip
    await page.getByRole("button", { name: chips[3] }).click();
    await page.waitForTimeout(100);

    // counter must remain 3 / 3
    await expect(counter).toHaveText("3 / 3");
    await screenshot(page, "regression__motif-counter-4th-click");
  });
});

// ── 4. Regression: /story chevron back → /motif (not /) ──────────────────────

test.describe("regression: /story chevron goes to /motif", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("chevron back button navigates to /motif", async ({ page }) => {
    // navigate splash → motif (so history has /motif before /story)
    await page.goto(BASE + "/motif", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    await page.goto(BASE + "/story", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);

    const backBtn = page.getByRole("button", { name: "戻る" });
    await expect(backBtn).toBeVisible();
    await screenshot(page, "regression__story-before-back");

    await backBtn.click();
    await expect(page).toHaveURL(/\/motif/, { timeout: 4000 });
    await screenshot(page, "regression__story-after-back");
  });
});

// ── 5. Regression: /story content scrollable, not hidden under footer ─────────

test.describe("regression: /story scroll without footer overlap", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("story body last paragraph is reachable above footer", async ({ page }) => {
    await page.goto(BASE + "/story", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);

    const main = page.locator("main");
    await expect(main).toBeVisible();

    // scroll to bottom of main
    await main.evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.waitForTimeout(200);

    const footer = page.locator("footer");
    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();

    // last paragraph
    const lastP = main.locator("p").last();
    const lastBox = await lastP.boundingBox();
    expect(lastBox).not.toBeNull();

    // footer top should be at or below story last paragraph bottom (no overlap)
    // i.e. footer doesn't cover the last paragraph when scrolled to bottom
    expect(footerBox!.y).toBeGreaterThanOrEqual(lastBox!.y + lastBox!.height - 16); // 16px tolerance

    await screenshot(page, "regression__story-scroll-footer-375x667");
  });
});

// ── 6. Regression: /generating Esc key → router.back() ──────────────────────

test.describe("regression: /generating Esc key", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Esc on /generating returns to previous page", async ({ page }) => {
    // build history: /motif → /generating
    await page.goto(BASE + "/motif", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    await page.goto(BASE + "/generating?next=story", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(600);

    await screenshot(page, "regression__generating-before-esc");

    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/motif/, { timeout: 4000 });

    await screenshot(page, "regression__generating-after-esc");
  });
});

// ── 7. Regression: browser back from /generating → no console errors ─────────

test.describe("regression: browser back from /generating", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("no stray console errors after browser back from generating", async ({ page }) => {
    const errors: string[] = [];
    const networkErrors: string[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("requestfailed", (req) => {
      // ignore intentional abort
      const failure = req.failure()?.errorText ?? "";
      if (!failure.includes("aborted") && !failure.includes("ERR_ABORTED")) {
        networkErrors.push(`${req.url()} — ${failure}`);
      }
    });

    await page.goto(BASE + "/motif", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(200);
    await page.goto(BASE + "/generating?next=story", {
      waitUntil: "domcontentloaded",
    });
    // wait for first frame to render and API call to fire
    await page.waitForTimeout(800);

    // browser back
    await page.goBack();
    await expect(page).toHaveURL(/\/motif/, { timeout: 4000 });
    // wait to catch any lingering async errors
    await page.waitForTimeout(1000);

    await screenshot(page, "regression__generating-browser-back");

    const relevant = errors.filter(
      (e) => !e.includes("favicon") && !e.includes("AbortError")
    );
    expect(relevant, `console errors after back: ${relevant.join(" | ")}`).toEqual([]);
    expect(
      networkErrors,
      `unexpected network errors: ${networkErrors.join(" | ")}`
    ).toEqual([]);
  });
});

// ── 8. Regression: tablet 768×1024 /story and /folklore max-w-[402px] ────────

test.describe("regression: tablet 768×1024 max-width constraint", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const pg of ["/story", "/folklore"] as const) {
    test(`${pg} content column ≤ 402px wide`, async ({ page }) => {
      await page.goto(BASE + pg, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      // /story uses height:100dvh on its wrapper; /folklore uses min-h-screen.
      // Both use mx-auto max-w-[402px] on the same inner div.
      // Locate the element that carries max-w-[402px] via Tailwind class.
      // On tablet (768px) it should be narrower than 402+1px wide.
      let box: { x: number; y: number; width: number; height: number } | null = null;

      // First try: the dvh-constrained wrapper (/story)
      const dvhEl = page.locator("[style*='100dvh']").first();
      const dvhCount = await dvhEl.count();
      if (dvhCount > 0) {
        box = await dvhEl.boundingBox();
      }

      // Fallback: look for the first div with min-h-screen or explicit w constraint (/folklore)
      if (!box) {
        // /folklore: the inner div has class "max-w-[402px]" — rendered as inline style
        // We find divs that are visually narrower than the 768px viewport
        const allDivs = page.locator("main").locator("..");
        const parentBox = await allDivs.first().boundingBox();
        if (parentBox && parentBox.width <= 403) {
          box = parentBox;
        } else {
          // Last resort: measure <main> directly
          const mainBox = await page.locator("main").first().boundingBox();
          box = mainBox;
        }
      }

      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(402 + 1); // 1px tolerance

      await screenshot(page, `regression__tablet-768x1024-${pg.replace("/", "")}-maxw`);
    });
  }
});

// ── 9. Happy path: splash → motif (3 select) → generating → story → folklore → back ──

test.describe("happy path end-to-end", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("full flow completes without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    // 1. Splash
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(300);
    await screenshot(page, "happypath__01-splash");

    // 2. → Motif
    await page.getByRole("link", { name: "作成する" }).click();
    await expect(page).toHaveURL(/\/motif/, { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, "happypath__02-motif");

    // 3. Select 3 motifs
    await page.getByRole("button", { name: "学校・施設" }).click();
    await page.getByRole("button", { name: "女の霊・悪霊" }).click();
    await page.getByRole("button", { name: "呪い・祟り" }).click();
    await page.waitForTimeout(100);

    const counter = page.locator("[aria-label*='選択中']");
    await expect(counter).toHaveText("3 / 3");
    await screenshot(page, "happypath__03-motif-3selected");

    // 4. → Generating (story)
    await page.getByRole("button", { name: "怪談を作る" }).click();
    await expect(page).toHaveURL(/\/generating/, { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, "happypath__04-generating");

    // 5. Wait for auto-navigation to /story (max 20s: 4 frames × 2s + API + buffer)
    await expect(page).toHaveURL(/\/story/, { timeout: 20000 });
    await page.waitForTimeout(400);
    await screenshot(page, "happypath__05-story");

    // 6. → Generating (folklore)
    await page.getByRole("link", { name: "解説を作成" }).click();
    await expect(page).toHaveURL(/\/generating/, { timeout: 5000 });
    await page.waitForTimeout(300);
    await screenshot(page, "happypath__06-generating-folklore");

    // 7. Wait for auto-navigation to /folklore (max 20s)
    await expect(page).toHaveURL(/\/folklore/, { timeout: 20000 });
    await page.waitForTimeout(400);
    await screenshot(page, "happypath__07-folklore");

    // 8. Back → /story
    await page.goBack();
    await expect(page).toHaveURL(/\/story/, { timeout: 4000 });
    await screenshot(page, "happypath__08-back-to-story");

    const relevant = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("AbortError") &&
        !e.includes("net::ERR_ABORTED")
    );
    expect(relevant, `console errors in happy path: ${relevant.join(" | ")}`).toEqual([]);
  });
});
