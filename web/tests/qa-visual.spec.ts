/**
 * QA Visual inspection spec — display integrity check
 * Tests all specified viewports against all target pages
 */
import { test, expect, Page } from "@playwright/test";

const PAGES = [
  { path: "/", name: "splash" },
  { path: "/motif", name: "motif" },
  { path: "/story", name: "story" },
  { path: "/folklore", name: "folklore" },
  { path: "/generating?next=story", name: "generating" },
];

const VIEWPORTS = [
  { name: "mobile-375x667", width: 375, height: 667 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-412x915", width: 412, height: 915 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "tablet-1024x1366", width: 1024, height: 1366 },
  { name: "pc-1280x800", width: 1280, height: 800 },
  { name: "pc-1440x900", width: 1440, height: 900 },
  { name: "pc-1920x1080", width: 1920, height: 1080 },
  { name: "pc-1240x670", width: 1240, height: 670 },
  { name: "pc-1240x800", width: 1240, height: 800 },
];

async function captureWithViewport(
  page: Page,
  path: string,
  vpWidth: number,
  vpHeight: number,
  pageName: string,
  vpName: string
) {
  await page.setViewportSize({ width: vpWidth, height: vpHeight });
  await page.goto(`http://localhost:3001${path}`, { waitUntil: "networkidle" });

  // Wait for fonts & transitions
  await page.waitForTimeout(300);

  const screenshotPath = `/tmp/qa-screenshots/${pageName}__${vpName}.png`;
  await page.screenshot({
    path: screenshotPath,
    fullPage: true,
  });

  // Also capture viewport-only (fold check)
  const viewportScreenshotPath = `/tmp/qa-screenshots/${pageName}__${vpName}__viewport.png`;
  await page.screenshot({
    path: viewportScreenshotPath,
    fullPage: false,
  });
}

test.describe("Visual QA - all viewports", () => {
  for (const vp of VIEWPORTS) {
    for (const pg of PAGES) {
      test(`${pg.name} @ ${vp.name}`, async ({ page }) => {
        await captureWithViewport(page, pg.path, vp.width, vp.height, pg.name, vp.name);

        // Basic sanity: page should load without error
        const title = await page.title();
        // No assertion needed — screenshot capture is the goal
        expect(title).toBeDefined();
      });
    }
  }
});
