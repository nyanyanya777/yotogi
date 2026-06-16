import { test, expect } from "@playwright/test";

test("story last paragraph readable above footer at 375x667", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("http://localhost:3001/story", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  // Scroll to bottom of main
  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    const allPs = main ? Array.from(main.querySelectorAll("p")) : [];
    const lastP = allPs[allPs.length - 1];

    const footerRect = footer?.getBoundingClientRect();
    const lastPRect = lastP?.getBoundingClientRect();

    return {
      footerTop: footerRect?.top,
      footerHeight: footerRect?.height,
      lastParaBottom: lastPRect?.bottom,
      lastParaTop: lastPRect?.top,
      lastParaText: lastP?.textContent?.substring(0, 80),
      isLastParaAboveFooter: lastPRect && footerRect ? lastPRect.bottom <= footerRect.top : null,
      mainScrollTop: main?.scrollTop,
      mainScrollHeight: main?.scrollHeight,
      mainClientHeight: main?.clientHeight,
    };
  });

  console.log("Story scroll 375x667:", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__story__375x667__scrolled-end.png", fullPage: false });
});

test("story last paragraph readable above footer at 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:3001/story", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    const main = document.querySelector("main");
    if (main) main.scrollTop = main.scrollHeight;
  });
  await page.waitForTimeout(150);

  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const footer = document.querySelector("footer");
    const allPs = main ? Array.from(main.querySelectorAll("p")) : [];
    const lastP = allPs[allPs.length - 1];

    const footerRect = footer?.getBoundingClientRect();
    const lastPRect = lastP?.getBoundingClientRect();

    return {
      footerTop: footerRect?.top,
      lastParaBottom: lastPRect?.bottom,
      lastParaText: lastP?.textContent?.substring(0, 80),
      isLastParaAboveFooter: lastPRect && footerRect ? lastPRect.bottom <= footerRect.top : null,
    };
  });

  console.log("Story scroll 390x844:", JSON.stringify(result, null, 2));
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__story__390x844__scrolled-end.png", fullPage: false });
});

test("story page footer width on PC 1920x1080 - spans full viewport?", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("http://localhost:3001/story", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);

  const footerInfo = await page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (!footer) return null;
    const rect = footer.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width };
  });
  console.log("Story footer at 1920x1080:", footerInfo);
  await page.screenshot({ path: "/tmp/qa-screenshots/DETAIL__story__1920x1080__footer.png", fullPage: false });
});
