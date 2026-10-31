import { test, expect, type Page } from "@playwright/test";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import {
  verifyTarget,
  databaseOptions,
  assertDemoTargets,
} from "../../scripts/admin-target.mjs";
import { cafes } from "../../scripts/demo-fixtures.mjs";
import {
  markTestOrder,
  cancelTestOrders,
  createTestTable,
  retireTestTable,
} from "../../scripts/workflow-test-support.mjs";
import { formatToman } from "../../src/lib/money";
import { compareTableLabels } from "../../src/features/tables/sort";

test("waiter submits, kitchen prepares and waiter sees ready without navigation", async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(150000);
  test.skip(
    process.env.MIZFLOW_E2E_AUTH !== "1",
    "Requires actual seeded Supabase Auth and workflow migration",
  );
  expect(process.env.MIZFLOW_TEST_WRITE).toBe("demo-only");
  const target = verifyTarget(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.MIZFLOW_TEST_DATABASE_URL,
    process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  const db = new pg.Client({
    ...databaseOptions(target),
    query_timeout: 20000,
  });
  db.on("error", () => {});
  await db.connect();
  await assertDemoTargets(db, cafes);
  const startedAt = Date.now();
  const tableId = await createTestTable(db, cafes[0].id, cafes[0].branch),
    orders: string[] = [];
  const owner = await db.query(
    "select m.user_id from public.restaurant_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=$1 and m.role='owner' and u.raw_app_meta_data->>'mizflow_demo'='true'",
    [cafes[0].id],
  );
  expect(owner.rowCount).toBe(1);
  const kitchenContext = await browser.newContext({
      baseURL,
      viewport: { width: 1024, height: 768 },
    }),
    otherContext = await browser.newContext({ baseURL });
  async function login(p: Page, role: string) {
    await p.goto("/login");
    await p
      .getByLabel("ایمیل", { exact: true })
      .fill(`narvan.${role}@demo.mizflow.test`);
    await p
      .getByLabel("گذرواژه", { exact: true })
      .fill(process.env.MIZFLOW_DEMO_PASSWORD!);
    await p.getByRole("button", { name: "ورود به میزفلو" }).click();
    await expect(p).toHaveURL("/");
  }
  try {
    await login(page, "waiter");
    await page.goto(`/tables/${tableId}`);
    await expect(
      page.getByRole("button", {
        name: "نشستن مهمان و ارائه منو",
        exact: true,
      }),
    ).toBeVisible();
    // Let the server commit, then lose the response. Polling must not hide replay.
    await page.route(`**/tables/${tableId}`, async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fetch();
      await route.abort("failed");
      await page.unroute(`**/tables/${tableId}`);
    });
    await page
      .getByRole("button", { name: "نشستن مهمان و ارائه منو", exact: true })
      .click();
    await expect(
      page.getByText("برای جلوگیری از ثبت دوباره", { exact: false }),
    ).toBeVisible();
    await page.waitForResponse(
      (r) =>
        r.url().includes("/api/operations?view=order") && r.status() === 200,
    );
    await page
      .getByRole("button", { name: "بررسی دوباره شروع سفارش", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "افزودن به سفارش", exact: true }),
    ).toBeVisible();
    const current = await db.query(
      "select id from public.orders where table_id=$1 and status='draft'",
      [tableId],
    );
    expect(current.rowCount).toBe(1);
    const orderId = current.rows[0].id;
    await markTestOrder(db, orderId, cafes[0].id, tableId);
    orders.push(orderId);
    await page
      .getByRole("button", { name: "افزودن برگر مخصوص", exact: true })
      .click();
    await page
      .getByLabel("توضیح آماده‌سازی برای برگر مخصوص", { exact: true })
      .fill("بدون پیاز");
    await page
      .getByRole("button", { name: "افزودن لاته", exact: true })
      .click();
    await page
      .getByRole("button", { name: "افزودن لاته", exact: true })
      .click();
    // Actual offline failure: preserve the draft and replay the same command after reconnect.
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "ارسال به آشپزخانه", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "بررسی دوباره ارسال", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByLabel("توضیح آماده‌سازی برای برگر مخصوص", { exact: true }),
    ).toHaveValue("بدون پیاز");
    await page.context().setOffline(false);
    await page
      .getByRole("button", { name: "بررسی دوباره ارسال", exact: true })
      .click();
    await expect(
      page.getByText("آیتم‌ها با تأیید سرور به آشپزخانه ارسال شدند.", {
        exact: true,
      }),
    ).toBeVisible();
    const items = await db.query(
      "select id,name_snapshot,quantity,unit_price_irr from public.order_items where order_id=$1",
      [orderId],
    );
    expect(items.rowCount).toBe(2);
    const burger = items.rows.find((r) => r.name_snapshot === "برگر مخصوص");
    expect(burger.quantity).toBe(1);
    expect(burger.unit_price_irr).toBe("3950000");
    const kitchen = await kitchenContext.newPage();
    await login(kitchen, "kitchen");
    await kitchen.goto("/kitchen");
    const ticket = kitchen.getByTestId(`kitchen-item-${burger.id}`);
    await expect(ticket).toContainText("بدون پیاز");
    await ticket
      .getByRole("button", { name: "شروع آماده‌سازی", exact: true })
      .click();
    await expect(
      ticket.getByRole("button", { name: "آماده شد", exact: true }),
    ).toBeVisible();
    await ticket.getByRole("button", { name: "آماده شد", exact: true }).click();
    await page.bringToFront();
    await expect(page.getByTestId(`order-item-${burger.id}`)).toContainText(
      "آماده سرو",
      { timeout: 15000 },
    );
    const another = await otherContext.newPage();
    await login(another, "waiter2");
    await another.goto(`/tables/${tableId}`);
    await another
      .getByRole("button", { name: "افزودن پیتزا مارگاریتا", exact: true })
      .click();
    await another
      .getByRole("button", { name: "ارسال به آشپزخانه", exact: true })
      .click();
    await expect(
      another.getByText("آیتم‌ها با تأیید سرور به آشپزخانه ارسال شدند.", {
        exact: true,
      }),
    ).toBeVisible();
    await page.bringToFront();
    await expect(page.getByTestId(`order-item-${burger.id}`)).toContainText(
      "آماده سرو",
    );
    await expect(page.locator(".order-total")).toContainText(
      formatToman(10650000),
      { timeout: 15000 },
    );
    const audit = await db.query(
      "select event_type from public.order_events where order_id=$1",
      [orderId],
    );
    expect(audit.rows.map((r) => r.event_type).sort()).toEqual(
      [
        "order_created",
        "order_submitted",
        "item_preparing",
        "item_ready",
        "items_added",
      ].sort(),
    );
    await page.reload();
    await expect(page.getByTestId(`order-item-${burger.id}`)).toContainText(
      "آماده سرو",
    );
    await expect(page.locator(".order-total")).toContainText(
      formatToman(10650000),
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    testInfo.annotations.push({
      type: "automated-workflow-seconds",
      description: String(Math.round((Date.now() - startedAt) / 1000)),
    });
    await page
      .getByRole("button", { name: "سرو شد · برگر مخصوص", exact: true })
      .click();
    await expect(page.getByTestId(`order-item-${burger.id}`)).toContainText(
      "سرو شده",
    );
    const delivery = (
      await db.query(
        "select served_at,served_by=(select id from auth.users where email='narvan.waiter@demo.mizflow.test') correct_waiter from public.order_items where id=$1",
        [burger.id],
      )
    ).rows[0];
    expect(delivery.correct_waiter).toBe(true);
    expect(delivery.served_at).toBeTruthy();
    await page.reload();
    await expect(page.getByTestId(`order-item-${burger.id}`)).toContainText(
      "سرو شده",
    );
    console.log("Workflow: persisted reload and waiter delivery verified");
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("waiter-order.png"),
      fullPage: true,
      timeout: 15000,
      animations: "disabled",
    });
    console.log("Workflow: waiter screenshot captured");
    await kitchen.bringToFront();
    await expect(
      kitchen.getByText("پیتزا مارگاریتا", { exact: false }),
    ).toBeVisible({ timeout: 15000 });
    console.log("Workflow: kitchen append visible");
    await kitchen.evaluate(() => window.scrollTo(0, 0));
    await expect(kitchen.getByTestId(`kitchen-item-${burger.id}`)).toHaveCount(
      0,
      { timeout: 15000 },
    );
    await kitchen.screenshot({
      path: testInfo.outputPath("kitchen.png"),
      fullPage: true,
      timeout: 15000,
      animations: "disabled",
    });
  } finally {
    console.log("Workflow: closing contexts");
    await kitchenContext.close();
    await otherContext.close();
    console.log("Workflow: cancelling tracked orders");
    await cancelTestOrders(db, orders, cafes[0].id, owner.rows[0].user_id);
    await retireTestTable(db, tableId);
    await db.end();
    console.log("Workflow: cleanup complete");
  }
});

test("owner discovers order entry from menu and submits a real table order", async ({
  page,
  isMobile,
}, testInfo) => {
  test.setTimeout(90000);
  test.skip(process.env.MIZFLOW_E2E_AUTH !== "1", "Requires real demo Auth");
  expect(process.env.MIZFLOW_TEST_WRITE).toBe("demo-only");
  const target = verifyTarget(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.MIZFLOW_TEST_DATABASE_URL,
    process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  const db = new pg.Client({
    ...databaseOptions(target),
    query_timeout: 20000,
  });
  db.on("error", () => {});
  await db.connect();
  await assertDemoTargets(db, cafes);
  const table = await createTestTable(db, cafes[0].id, cafes[0].branch);
  const ids: string[] = [];
  const owner = (
    await db.query(
      "select user_id from public.restaurant_memberships where restaurant_id=$1 and role='owner'",
      [cafes[0].id],
    )
  ).rows[0].user_id;
  async function choosePanel(value: string) {
    if (isMobile) await page.getByRole("button", { name: "فهرست ☰" }).click();
    await Promise.all([
      page.waitForEvent("domcontentloaded"),
      page
        .getByRole("combobox", { name: "انتخاب پنل کاری" })
        .selectOption(value),
    ]);
    await expect(
      page.locator('select[aria-label="انتخاب پنل کاری"]'),
    ).toHaveValue(value);
    await expect(page).toHaveURL(
      value === "kitchen" ? "/kitchen" : value === "waiter" ? "/tables" : "/",
    );
  }
  try {
    await page.goto("/login");
    await page
      .getByLabel("ایمیل", { exact: true })
      .fill("narvan.owner@demo.mizflow.test");
    await page
      .getByLabel("گذرواژه", { exact: true })
      .fill(process.env.MIZFLOW_DEMO_PASSWORD!);
    await page.getByRole("button", { name: "ورود به میزفلو" }).click();
    await expect(page).toHaveURL("/");
    await page.goto("/menu");
    await expect(
      page
        .locator(".menu-card")
        .filter({
          has: page.getByRole("heading", { name: "برگر مخصوص", exact: true }),
        })
        .locator(".menu-image"),
    ).toHaveText("🍔");
    await expect(
      page
        .locator(".menu-card")
        .filter({
          has: page.getByRole("heading", {
            name: "کیک هویج و گردو",
            exact: true,
          }),
        })
        .locator(".menu-image"),
    ).toHaveText("🍰");
    await page
      .getByRole("link", { name: "ثبت سفارش · انتخاب میز", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "ثبت سفارش میز", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".floor-table")).toHaveCount(12);
    await expect(page.locator(".seats-two")).toHaveCount(4);
    await expect(page.locator(".seats-four")).toHaveCount(8);
    const names = await page.locator(".floor-table-name").allTextContents();
    expect(names).toEqual([...names].sort(compareTableLabels));
    await page.getByRole("button", { name: /^اشغال/ }).click();
    await expect(
      page.locator(".floor-table[data-occupancy='available']"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /^آزاد/ }).click();
    await expect(
      page.locator(".floor-table[data-occupancy='occupied']"),
    ).toHaveCount(0);
    await page.getByRole("button", { name: /^همه میزها/ }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: testInfo.outputPath("hall.png"),
      fullPage: true,
      timeout: 15000,
      animations: "disabled",
    });
    await choosePanel("waiter");
    await page.locator(`a.table-card[href='/tables/${table}']`).click();
    await page
      .getByRole("button", { name: "نشستن مهمان و ارائه منو", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "افزودن به سفارش", exact: true }),
    ).toBeVisible();
    const order = (
      await db.query(
        "select id from public.orders where table_id=$1 and status='draft'",
        [table],
      )
    ).rows[0].id;
    await markTestOrder(db, order, cafes[0].id, table);
    ids.push(order);
    await page
      .getByRole("button", { name: "افزودن برگر مخصوص", exact: true })
      .click();
    await page
      .getByRole("button", { name: "ارسال به آشپزخانه", exact: true })
      .click();
    await expect(
      page.getByText("آیتم‌ها با تأیید سرور به آشپزخانه ارسال شدند.", {
        exact: true,
      }),
    ).toBeVisible();
    const item = (
      await db.query(
        "select quantity,unit_price_irr,status from public.order_items where order_id=$1",
        [order],
      )
    ).rows;
    expect(item).toEqual([
      { quantity: 1, unit_price_irr: "3950000", status: "queued" },
    ]);
    await page.reload();
    await expect(page.locator(".order-total")).toContainText(
      formatToman(3950000),
    );
    const itemId = (
      await db.query("select id from public.order_items where order_id=$1", [
        order,
      ])
    ).rows[0].id;
    await choosePanel("kitchen");
    const ticket = page.getByTestId(`kitchen-item-${itemId}`);
    await ticket
      .getByRole("button", { name: "شروع آماده‌سازی", exact: true })
      .click();
    await ticket.getByRole("button", { name: "آماده شد", exact: true }).click();
    await expect(ticket).toContainText("آماده سرو");
    await choosePanel("owner");
    await page.goto(`/tables/${table}`);
    await expect(page.getByTestId(`order-item-${itemId}`)).toContainText(
      "آماده سرو",
    );
    await page
      .getByRole("button", { name: "سرو شد · برگر مخصوص", exact: true })
      .click();
    await expect(page.getByTestId(`order-item-${itemId}`)).toContainText(
      "سرو شده",
    );
    const delivered = (
      await db.query(
        "select served_by,served_at from public.order_items where id=$1",
        [itemId],
      )
    ).rows[0];
    expect(delivered.served_by).toBe(owner);
    expect(delivered.served_at).toBeTruthy();
    await page
      .getByRole("button", {
        name: "آزاد کردن میز پس از خروج مهمان",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: "تأیید خروج مهمان و آزاد کردن میز",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", {
        name: "نشستن مهمان و ارائه منو",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "نشستن مهمان و ارائه منو", exact: true })
      .click();
    await expect(
      page.getByText("مهمان نشسته و منو ارائه شده است", { exact: false }),
    ).toBeVisible({ timeout: 15000 });
    const next = (
      await db.query(
        "select id from public.orders where table_id=$1 and status='draft'",
        [table],
      )
    ).rows[0].id;
    expect(next).not.toBe(order);
    await markTestOrder(db, next, cafes[0].id, table);
    ids.push(next);
    // Another real staff session closes/reseats while this browser has unsent selections.
    await page
      .getByRole("button", { name: "افزودن برگر مخصوص", exact: true })
      .click();
    const teammate = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    try {
      const signed = await teammate.auth.signInWithPassword({
        email: "narvan.waiter@demo.mizflow.test",
        password: process.env.MIZFLOW_DEMO_PASSWORD!,
      });
      expect(
        !signed.error && signed.data.user?.app_metadata.mizflow_demo === true,
      ).toBe(true);
      const closed = await teammate.rpc("close_table_service", {
        p_order_id: next,
        p_expected_version: 1,
        p_key: crypto.randomUUID(),
      });
      expect(!closed.error).toBe(true);
      const opened = await teammate.rpc("open_table_order", {
        p_table_id: table,
        p_key: crypto.randomUUID(),
      });
      expect(!opened.error).toBe(true);
      const third = opened.data.order_id;
      await markTestOrder(db, third, cafes[0].id, table);
      ids.push(third);
      await expect(
        page
          .getByRole("alert")
          .filter({ hasText: "این انتخاب‌ها مربوط به مهمان قبلی است" }),
      ).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("button", { name: "ارسال به آشپزخانه", exact: true }),
      ).toBeDisabled();
      await page
        .getByRole("button", { name: "پاک کردن انتخاب‌ها", exact: true })
        .click();
      await page
        .getByRole("button", { name: "افزودن لاته", exact: true })
        .click();
      await page
        .getByRole("button", { name: "ارسال به آشپزخانه", exact: true })
        .click();
      await expect(
        page.getByText("آیتم‌ها با تأیید سرور به آشپزخانه ارسال شدند.", {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15000 });
      const saved = await db.query(
        "select name_snapshot,quantity from public.order_items where order_id=$1",
        [third],
      );
      expect(saved.rows).toEqual([{ name_snapshot: "لاته", quantity: 1 }]);
      expect(
        (
          await db.query(
            "select count(*)::int n from public.order_items where order_id=$1",
            [next],
          )
        ).rows[0].n,
      ).toBe(0);
    } finally {
      await teammate.auth.signOut({ scope: "local" });
    }
  } finally {
    await cancelTestOrders(db, ids, cafes[0].id, owner);
    await retireTestTable(db, table);
    await db.end();
  }
});
