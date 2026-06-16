import { test } from "@playwright/test";

const pages = [
  { path: "/", name: "splash" },
  { path: "/motif", name: "motif" },
  { path: "/story", name: "story" },
  { path: "/folklore", name: "folklore" },
];

for (const pg of pages) {
  test(`${pg.name} content width at 768x1024`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`http://localhost:3001${pg.path}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    
    const widths = await page.evaluate(() => {
      // Get the main content container widths
      const containers = Array.from(document.querySelectorAll("main, [class*='max-w-\\[402px\\]'], nav, footer"));
      return containers.map(el => ({
        tag: el.tagName,
        class: el.className.substring(0, 50),
        width: el.getBoundingClientRect().width,
      }));
    });
    console.log(`[${pg.name} 768x1024] containers:`, JSON.stringify(widths, null, 2));
  });
}
