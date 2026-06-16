/**
 * Debug splash page CTA visibility
 */
import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3001";

test.describe("Splash CTA debug", () => {
  test("debug splash at 1240x670", async ({ page }) => {
    await page.setViewportSize({ width: 1240, height: 670 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // Check all buttons on page
    const buttons = await page.$$eval("button", (btns) =>
      btns.map((b) => ({ text: b.textContent?.trim(), disabled: b.disabled, type: b.type }))
    );
    console.log("[splash 1240x670] all buttons:", JSON.stringify(buttons));

    // Check all links
    const links = await page.$$eval("a", (as) =>
      as.map((a) => ({ text: a.textContent?.trim(), href: a.getAttribute("href") }))
    );
    console.log("[splash 1240x670] all links:", JSON.stringify(links));

    // Check body scroll state
    const bodyInfo = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      innerHeight: window.innerHeight,
    }));
    console.log("[splash 1240x670] body info:", bodyInfo);

    // Get full page DOM structure around CTA area
    const structure = await page.evaluate(() => {
      // Find all flex-col containers
      const ctaContainers = Array.from(document.querySelectorAll("div.flex-col")).map(el => ({
        classes: el.className,
        childCount: el.children.length,
        text: el.textContent?.substring(0, 100),
        rect: {
          top: el.getBoundingClientRect().top,
          bottom: el.getBoundingClientRect().bottom,
          height: el.getBoundingClientRect().height,
        },
      }));
      return ctaContainers;
    });
    console.log("[splash 1240x670] flex-col containers:", JSON.stringify(structure, null, 2));

    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__1240x670.png", fullPage: true });
    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__1240x670__viewport.png", fullPage: false });
  });

  test("debug splash at 375x667", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    // Check all buttons
    const buttons = await page.$$eval("button", (btns) =>
      btns.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          disabled: b.disabled,
          bounds: { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height },
        };
      })
    );
    console.log("[splash 375x667] all buttons:", JSON.stringify(buttons, null, 2));

    const bodyInfo = await page.evaluate(() => ({
      scrollHeight: document.body.scrollHeight,
      clientHeight: document.body.clientHeight,
      innerHeight: window.innerHeight,
    }));
    console.log("[splash 375x667] body info:", bodyInfo);

    // Check the inner div with min-h-[874px]
    const innerDiv = await page.evaluate(() => {
      const el = document.querySelector("[class*='min-h-\\[874px\\]']") as HTMLElement;
      if (!el) return "not found";
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, className: el.className };
    });
    console.log("[splash 375x667] 874px div:", innerDiv);

    // Check the justify-between container
    const justifyBetween = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll("div[class*='justify-between']")) as HTMLElement[];
      return els.map(el => {
        const r = el.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, height: r.height };
      });
    });
    console.log("[splash 375x667] justify-between divs:", justifyBetween);

    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__375x667.png", fullPage: true });
    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__375x667__viewport.png", fullPage: false });
  });

  test("debug splash at 390x844", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const buttons = await page.$$eval("button", (btns) =>
      btns.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          bounds: { top: rect.top, bottom: rect.bottom, height: rect.height },
        };
      })
    );
    console.log("[splash 390x844] all buttons:", JSON.stringify(buttons, null, 2));

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log("[splash 390x844] body.scrollHeight:", bodyScrollHeight);

    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__390x844__viewport.png", fullPage: false });
    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__390x844.png", fullPage: true });
  });

  test("debug splash at 412x915", async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);

    const buttons = await page.$$eval("button", (btns) =>
      btns.map((b) => {
        const rect = b.getBoundingClientRect();
        return {
          text: b.textContent?.trim(),
          bounds: { top: rect.top, bottom: rect.bottom, height: rect.height },
        };
      })
    );
    console.log("[splash 412x915] all buttons:", JSON.stringify(buttons, null, 2));

    const bodyScrollHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log("[splash 412x915] body.scrollHeight:", bodyScrollHeight);

    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__412x915__viewport.png", fullPage: false });
    await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__412x915.png", fullPage: true });
  });
});
