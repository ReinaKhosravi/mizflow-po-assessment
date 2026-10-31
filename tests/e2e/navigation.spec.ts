import { test, expect } from "@playwright/test";

test("anonymous requests never render protected café pages", async ({
  page,
  request,
}) => {
  const api = await request.get("/api/operations?view=tables");
  expect(api.status()).toBe(401);
  expect(api.headers()["cache-control"]).toContain("no-store");
  for (const path of ["/", "/tables", "/kitchen", "/menu"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/(login|setup)(\?.*)?$/);
    await expect(
      page.getByRole("navigation", { name: "ناوبری اصلی" }),
    ).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "fa");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const response = await request.get(path, { maxRedirects: 0 });
    const body = await response.text();
    expect(body).not.toContain("همه‌چیز سرِ جای خودش");
    expect(body).not.toContain("اسپرسو دبل");
  }
});

test("login or configuration guidance renders without a simulated session", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "ورود کارکنان",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("real Supabase login, protected navigation and logout", async ({
  page,
  isMobile,
}, testInfo) => {
  // Real Cloud round trips + cold dev compilation span several complete page loads.
  test.setTimeout(90_000);
  test.skip(
    process.env.MIZFLOW_E2E_AUTH !== "1",
    "Requires a configured Supabase development project, applied migrations and demo Auth seed; no mock session is accepted.",
  );
  const password = process.env.MIZFLOW_DEMO_PASSWORD;
  expect(
    password,
    "Set the seeded development password in the test process",
  ).toBeTruthy();
  await page.goto("/login");
  await page
    .getByLabel("ایمیل", { exact: true })
    .fill("narvan.owner@demo.mizflow.test");
  const passwordField = page.getByLabel("گذرواژه", { exact: true });
  await page
    .getByRole("button", { name: "نمایش گذرواژه", exact: true })
    .click();
  await expect(passwordField).toHaveAttribute("type", "text");
  await page
    .getByRole("button", { name: "پنهان‌کردن گذرواژه", exact: true })
    .click();
  await expect(passwordField).toHaveAttribute("type", "password");
  await passwordField.fill("not-the-demo-password");
  await page.getByRole("button", { name: "ورود به میزفلو" }).click();
  await expect(page.getByRole("status")).toContainText(
    "ایمیل یا گذرواژه درست نیست",
  );
  await expect(page.getByLabel("ایمیل", { exact: true })).toHaveValue(
    "narvan.owner@demo.mizflow.test",
  );
  await passwordField.fill(password!);
  await page.getByRole("button", { name: "ورود به میزفلو" }).click();
  await expect(page).toHaveURL("/");
  console.info("Auth flow: login succeeded");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "یک شیفت",
  );
  console.info("Auth flow: reload succeeded");
  const restored = await page.context().newPage();
  await restored.goto("/menu");
  await expect(restored.getByRole("heading", { level: 1 })).toContainText(
    "یک منوی",
  );
  console.info("Auth flow: new-tab persistence succeeded");
  await restored.close();
  console.info("Auth flow: restored tab closed");
  for (const [label, path, heading] of [
    ["میزها", "/tables", "ثبت سفارش میز"],
    ["آشپزخانه", "/kitchen", "از سفارش"],
    ["منوی کافه", "/menu", "یک منوی"],
    ["پیشخوان", "/", "یک شیفت"],
  ]) {
    console.info("Auth flow: opening " + path);
    if (isMobile) {
      await page.getByRole("button", { name: "فهرست" }).click();
      await expect(
        page.getByRole("button", { name: "بستن منو" }),
      ).toHaveAttribute("aria-expanded", "true");
    }
    await page
      .getByRole("navigation")
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      heading,
    );
    if (isMobile) await page.getByRole("button", { name: "فهرست" }).click();
    await expect(
      page
        .getByRole("navigation")
        .getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    if (isMobile) await page.getByRole("button", { name: "بستن منو" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  if (isMobile) await page.getByRole("button", { name: "فهرست" }).click();
  await page
    .getByRole("button", { name: "خروج از حساب", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL("/login");
  await page.goto("/menu");
  await expect(page).toHaveURL("/login");
});
