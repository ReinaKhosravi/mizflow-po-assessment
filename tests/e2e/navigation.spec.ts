import { test, expect } from "@playwright/test";
test("Persian RTL shell and all navigation destinations", async ({ page, isMobile }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "fa");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("یک شیفت روان");
  for (const [label, path, heading] of [["میزها", "/tables", "هر میز"], ["آشپزخانه", "/kitchen", "از سفارش"], ["منوی کافه", "/menu", "یک منوی"], ["پیشخوان", "/", "یک شیفت"]]) {
    if (isMobile) await page.getByRole("button", { name: "فهرست" }).click();
    await page.getByRole("navigation").getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(heading);
    await expect(page.getByRole("navigation").getByRole("link", {name: label, exact: true})).toHaveAttribute("aria-current", "page");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
