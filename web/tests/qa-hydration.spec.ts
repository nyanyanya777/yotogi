import { test, expect } from "@playwright/test";

test("splash CTA element type after hydration", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
  // Extra wait for hydration
  await page.waitForTimeout(1000);
  
  const ctaInfo = await page.evaluate(() => {
    // Find all elements containing "作成する"
    const allEls = Array.from(document.querySelectorAll("*")).filter(el => 
      el.childElementCount === 0 && el.textContent?.trim() === "作成する"
    );
    return allEls.map(el => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      const pRect = parent?.getBoundingClientRect();
      return {
        tagName: el.tagName,
        parentTagName: parent?.tagName,
        parentRect: pRect ? { top: pRect.top, bottom: pRect.bottom } : null,
        elementRect: { top: rect.top, bottom: rect.bottom },
        href: (el as HTMLAnchorElement).href || (parent as HTMLAnchorElement)?.href || "none",
        disabled: (el as HTMLButtonElement).disabled,
      };
    });
  });
  
  console.log("CTA elements after hydration (375x667):", JSON.stringify(ctaInfo, null, 2));
  await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__375x667__hydrated.png", fullPage: false });
});

test("splash CTA element type after hydration - 1240x670", async ({ page }) => {
  await page.setViewportSize({ width: 1240, height: 670 });
  await page.goto("http://localhost:3001/", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  
  const ctaInfo = await page.evaluate(() => {
    const allEls = Array.from(document.querySelectorAll("*")).filter(el => 
      el.childElementCount === 0 && el.textContent?.trim() === "作成する"
    );
    return allEls.map(el => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      const pRect = parent?.getBoundingClientRect();
      return {
        tagName: el.tagName,
        parentTagName: parent?.tagName,
        parentRect: pRect ? { top: pRect.top, bottom: pRect.bottom } : null,
        elementRect: { top: rect.top, bottom: rect.bottom },
        href: (el.closest("a") as HTMLAnchorElement)?.href || "none",
        inViewport: rect.bottom <= window.innerHeight && rect.top >= 0,
        viewportH: window.innerHeight,
      };
    });
  });
  
  console.log("CTA elements after hydration (1240x670):", JSON.stringify(ctaInfo, null, 2));
  await page.screenshot({ path: "/tmp/qa-screenshots/DEBUG__splash__1240x670__hydrated.png", fullPage: false });
});
