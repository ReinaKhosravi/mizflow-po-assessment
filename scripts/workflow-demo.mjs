import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  verifyTarget,
  databaseOptions,
  assertDemoTargets,
} from "./admin-target.mjs";
import { cafes, fixtureId } from "./demo-fixtures.mjs";
const env = process.env;
let db;
try {
  if (
    env.NODE_ENV === "production" ||
    env.MIZFLOW_DEMO_SEED !== "development-only"
  )
    throw new Error("Development only");
  const target = verifyTarget(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.MIZFLOW_DEMO_DATABASE_URL || env.MIZFLOW_ADMIN_DATABASE_URL,
    env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  if (!env.MIZFLOW_SEED_AUTH_KEY || !env.MIZFLOW_DEMO_PASSWORD)
    throw new Error("Offline seed credentials required");
  const admin = createClient(target.api.toString(), env.MIZFLOW_SEED_AUTH_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (url, options = {}) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(15000) }),
    },
  });
  const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (existing.error) throw new Error("Auth admin unavailable");
  const find = (role) =>
    existing.data.users.find(
      (u) =>
        u.email === `narvan.${role}@demo.mizflow.test` &&
        u.app_metadata.mizflow_demo === true,
    );
  const waiter = find("waiter"),
    owner = find("owner");
  if (!waiter || !owner) throw new Error("Run the original demo seed first");
  let waiter2 = existing.data.users.find(
    (u) => u.email === "narvan.waiter2@demo.mizflow.test",
  );
  if (waiter2 && waiter2.app_metadata.mizflow_demo !== true)
    throw new Error("Account collision");
  if (!waiter2) {
    const created = await admin.auth.admin.createUser({
      email: "narvan.waiter2@demo.mizflow.test",
      password: env.MIZFLOW_DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { mizflow_demo: true },
    });
    if (created.error) throw new Error("Cannot provision second demo waiter");
    waiter2 = created.data.user;
  }
  db = new pg.Client({ ...databaseOptions(target), query_timeout: 20000 });
  db.on("error", () => {});
  await db.connect();
  await assertDemoTargets(db, cafes);
  await db.query("begin");
  const cafe = cafes[0],
    tableId = fixtureId(0, 2, 12);
  await db.query(
    "select id from public.dining_tables where id=$1 and restaurant_id=$2 for update",
    [tableId, cafe.id],
  );
  await db.query(
    "insert into public.restaurant_memberships(restaurant_id,user_id,branch_id,role) values($1,$2,$3,'waiter') on conflict(restaurant_id,user_id) do nothing",
    [cafe.id, waiter2.id, cafe.branch],
  );
  for (const [n, name, price] of [
    [13, "برگر مخصوص", 3950000],
    [14, "پیتزا مارگاریتا", 4200000],
  ])
    await db.query(
      "insert into public.menu_items(id,restaurant_id,branch_id,name,category,description,price_irr) values($1,$2,$3,$4,'غذای گرم','تهیه تازه برای سفارش میز',$5) on conflict(id) do nothing",
      [fixtureId(0, 3, n), cafe.id, cafe.branch, name, price],
    );
  const current = await db.query(
    "select id,demo_scenario,version from public.orders where table_id=$1 and restaurant_id=$2 and status in ('draft','submitted','in_preparation','ready','served') for update",
    [tableId, cafe.id],
  );
  if (
    current.rows.length &&
    current.rows[0].demo_scenario !== "table12-walkthrough"
  )
    throw new Error("Unmarked order on demo table: refusing reset");
  if (env.MIZFLOW_DEMO_RESET === "table12-only" && current.rows.length) {
    const old = current.rows[0];
    await db.query(
      "update public.order_items set status='cancelled',version=version+1 where order_id=$1 and status<>'cancelled'",
      [old.id],
    );
    await db.query(
      "update public.orders set status='cancelled',version=version+1 where id=$1",
      [old.id],
    );
    await db.query(
      "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details) values($1,$2,$3,$4,'order_cancelled',$5,$6,'{\"reason\":\"demo_reset\"}')",
      [cafe.id, cafe.branch, old.id, owner.id, old.version + 1, randomUUID()],
    );
  }
  if (current.rows.length === 0 || env.MIZFLOW_DEMO_RESET === "table12-only") {
    const orderId = randomUUID();
    await db.query(
      "insert into public.orders(id,restaurant_id,branch_id,table_id,created_by,status,idempotency_key,demo_scenario) values($1,$2,$3,$4,$5,'submitted',$1,'table12-walkthrough')",
      [orderId, cafe.id, cafe.branch, tableId, waiter.id],
    );
    await db.query(
      "insert into public.order_items(restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,notes,idempotency_key) select restaurant_id,branch_id,$1,id,name,price_irr,1,'بدون پیاز',$2 from public.menu_items where id=$3",
      [orderId, randomUUID(), fixtureId(0, 3, 13)],
    );
    await db.query(
      "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details) values($1,$2,$3,$4,'demo_imported',1,$5,'{\"scenario\":\"table12-walkthrough\"}')",
      [cafe.id, cafe.branch, orderId, owner.id, randomUUID()],
    );
  }
  await db.query("commit");
  console.log(
    JSON.stringify({
      demoReady: true,
      table: 12,
      secondWaiter: true,
      reset: env.MIZFLOW_DEMO_RESET === "table12-only",
    }),
  );
} catch {
  if (db) await db.query("rollback").catch(() => {});
  console.error(
    JSON.stringify({
      event: "workflow_demo_stopped",
      message:
        "Check target, seed accounts, migration or unmarked active table order; no unknown customer data is changed.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
}
