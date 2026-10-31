import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import {
  verifyTarget,
  databaseOptions,
  assertDemoTargets,
} from "../../scripts/admin-target.mjs";
import { cafes, fixtureId } from "../../scripts/demo-fixtures.mjs";
import {
  markTestOrder,
  cancelTestOrders,
  createTestTable,
  retireTestTable,
} from "../../scripts/workflow-test-support.mjs";
const enabled = process.env.MIZFLOW_RUN_SUPABASE_TESTS === "1";
const ok = (v, m) => assert.ok(Boolean(v), m);
test(
  "real Auth/PostgREST operational concurrency",
  { skip: enabled ? false : "Live Supabase test configuration not enabled" },
  async (t) => {
    const env = process.env;
    ok(
      env.MIZFLOW_TEST_WRITE === "demo-only",
      "Demo-only test authorization required",
    );
    const target = verifyTarget(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.MIZFLOW_TEST_DATABASE_URL,
      env.MIZFLOW_CONFIRMED_PROJECT_REF,
    );
    const db = new pg.Client({
      ...databaseOptions(target),
      query_timeout: 20000,
    });
    db.on("error", () => {});
    await db.connect();
    await assertDemoTargets(db, cafes);
    const clients = [];
    const orders = [];
    let owner, table;
    async function login(email) {
      const c = createClient(
        target.api.toString(),
        env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const r = await c.auth.signInWithPassword({
        email,
        password: env.MIZFLOW_DEMO_PASSWORD,
      });
      ok(
        !r.error && r.data.user?.app_metadata.mizflow_demo === true,
        "Real demo login required",
      );
      clients.push(c);
      return { c, id: r.data.user.id };
    }
    t.after(async () => {
      if (owner) await cancelTestOrders(db, orders, cafes[0].id, owner.id);
      if (table) await retireTestTable(db, table);
      for (const c of clients) await c.auth.signOut({ scope: "local" });
      await db.end();
    });
    const w = await login("narvan.waiter@demo.mizflow.test"),
      w2 = await login("narvan.waiter2@demo.mizflow.test"),
      k = await login("narvan.kitchen@demo.mizflow.test"),
      other = await login("rooz.waiter@demo.mizflow.test");
    owner = await login("narvan.owner@demo.mizflow.test");
    table = await createTestTable(db, cafes[0].id, cafes[0].branch);
    const menu = fixtureId(0, 3, 13),
      menu2 = fixtureId(0, 3, 14);
    let order, first;
    const add = (
      c,
      key = randomUUID(),
      items = [{ menu_item_id: menu, quantity: 1, notes: "بدون پیاز" }],
    ) =>
      c
        .rpc("add_order_items", {
          p_order_id: order,
          p_items: items,
          p_key: key,
        })
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000));
    const advance = (c, item, version, next, key = randomUUID()) =>
      c
        .rpc("advance_order_item", {
          p_item_id: item,
          p_expected_version: version,
          p_next_status: next,
          p_key: key,
        })
        .retry(false)
        .abortSignal(AbortSignal.timeout(15000));
    await t.test(
      "two actual users opening one table receive one success and one conflict",
      async () => {
        const results = await Promise.all(
          [w.c, w2.c].map((c) =>
            c
              .rpc("open_table_order", {
                p_table_id: table,
                p_key: randomUUID(),
              })
              .retry(false)
              .abortSignal(AbortSignal.timeout(15000)),
          ),
        );
        ok(
          results.filter((r) => !r.error).length === 1,
          "Exactly one open must succeed: " +
            results.map((r) => r.error?.code || "ok").join(","),
        );
        order = results.find((r) => !r.error).data.order_id;
        await markTestOrder(db, order, cafes[0].id, table);
        orders.push(order);
        ok(
          results.find((r) => r.error)?.error.code === "PT409",
          "Open loser must return a final conflict",
        );
      },
    );
    await t.test(
      "two waiter requests append independent lines with authoritative snapshots",
      async () => {
        const result = await Promise.all([
          add(w.c),
          add(w2.c, randomUUID(), [
            { menu_item_id: menu2, quantity: 2, notes: "" },
          ]),
        ]);
        ok(
          result.every((r) => !r.error),
          "Concurrent appends failed",
        );
        first = result[0].data.item_ids[0];
        const rows = await w.c
          .from("order_items")
          .select("id,unit_price_irr,quantity")
          .eq("order_id", order);
        ok(!rows.error && rows.data.length === 2, "Concurrent lines lost");
        ok(
          rows.data.every((r) => r.unit_price_irr > 1),
          "Snapshots must use real menu prices",
        );
      },
    );
    await t.test(
      "duplicate live HTTP requests share one result and one audit event",
      async () => {
        const key = randomUUID();
        const r = await Promise.all([add(w.c, key), add(w.c, key)]);
        ok(
          r.every((x) => !x.error),
          "Replay failed",
        );
        assert.deepEqual(r[0].data, r[1].data);
        const count = await w.c
          .from("order_items")
          .select("id", { head: true, count: "exact" })
          .eq("order_id", order);
        ok(!count.error && count.count === 3, "Duplicate line was inserted");
        const mismatch = await add(w.c, key, [
          { menu_item_id: menu, quantity: 5, notes: "" },
        ]);
        ok(mismatch.error?.code === "22023", "Changed-payload reuse must fail");
      },
    );
    await t.test(
      "kitchen update and waiter append preserve both effects; waiter sees ready",
      async () => {
        const r = await Promise.all([
          advance(k.c, first, 1, "preparing"),
          add(w2.c),
        ]);
        ok(
          r.every((x) => !x.error),
          "Racing operations failed",
        );
        const before = await w.c
          .from("order_items")
          .select("status,version")
          .eq("id", first)
          .single();
        ok(
          !before.error && before.data.status === "preparing",
          "Preparation was overwritten",
        );
        const ready = await advance(k.c, first, 2, "ready");
        ok(!ready.error, "Ready update failed");
        const view = await w.c
          .from("order_items")
          .select("status")
          .eq("id", first)
          .single();
        ok(view.data?.status === "ready", "Waiter cannot see ready item");
        const events = await owner.c
          .from("order_events")
          .select("order_version")
          .eq("order_id", order);
        ok(
          !events.error && events.data.length === 7,
          "Missing or duplicate audit events",
        );
      },
    );
    await t.test(
      "forged price, role actions, invalid transitions and cross-tenant RPCs fail",
      async () => {
        ok(
          (
            await add(w.c, randomUUID(), [
              { menu_item_id: menu, quantity: 1, price_irr: 1 },
            ])
          ).error?.code === "22023",
          "Forged price accepted",
        );
        for (const c of [k.c, other.c])
          ok(
            (await add(c)).error?.code === "42501",
            "Unauthorized add accepted",
          );
        for (const c of [w.c, other.c])
          ok(
            (await advance(c, first, 3, "preparing")).error?.code === "42501",
            "Unauthorized kitchen update accepted",
          );
        ok(
          (await advance(k.c, first, 3, "preparing")).error?.code === "22023",
          "Backward transition accepted",
        );
        ok(
          (await advance(k.c, first, 1, "ready")).error?.code === "PT409",
          "Stale update accepted",
        );
        const hidden = await other.c
          .from("orders")
          .select("id")
          .eq("id", order);
        ok(
          !hidden.error && hidden.data.length === 0,
          "Cross-tenant order leaked",
        );
      },
    );
    await t.test(
      "twenty simultaneous appends have exact final lines, versions and totals",
      async () => {
        const before = await db.query(
          "select version,(select count(*)::int from public.order_items where order_id=$1) lines from public.orders where id=$1",
          [order],
        );
        const results = await Promise.all(
          Array.from({ length: 20 }, (_, i) => add(i % 2 ? w.c : w2.c)),
        );
        ok(
          results.every((r) => !r.error),
          "Burst append failed: " +
            results.map((r) => r.error?.code || "ok").join(","),
        );
        const after = await db.query(
          "select version,(select count(*)::int from public.order_items where order_id=$1) lines,(select sum(unit_price_irr*quantity)::text from public.order_items where order_id=$1) total from public.orders where id=$1",
          [order],
        );
        assert.equal(after.rows[0].lines, before.rows[0].lines + 20);
        assert.equal(after.rows[0].version, before.rows[0].version + 20);
        const events = await db.query(
          "select count(*)::int n,count(distinct order_version)::int versions from public.order_events where order_id=$1",
          [order],
        );
        assert.equal(events.rows[0].n, after.rows[0].version);
        assert.equal(events.rows[0].versions, after.rows[0].version);
        assert.equal(after.rows[0].total, String(3950000 * 23 + 4200000 * 2));
      },
    );
    await t.test(
      "anonymous and revoked users cannot execute workflow RPCs",
      async () => {
        const anon = createClient(
          target.api.toString(),
          env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        ok((await add(anon)).error?.code === "42501", "Anonymous RPC accepted");
        const previous = await db.query(
          "select id,revoked_at from public.restaurant_memberships where restaurant_id=$1 and user_id=$2",
          [cafes[0].id, w2.id],
        );
        try {
          await db.query(
            "update public.restaurant_memberships set revoked_at=now() where id=$1",
            [previous.rows[0].id],
          );
          ok((await add(w2.c)).error?.code === "42501", "Revoked RPC accepted");
        } finally {
          await db.query(
            "update public.restaurant_memberships set revoked_at=$2 where id=$1",
            [previous.rows[0].id, previous.rows[0].revoked_at],
          );
        }
      },
    );
    await t.test(
      "owner appends at server prices in own restaurant",
      async () => {
        const before = await db.query(
          "select count(*)::int n from public.order_items where order_id=$1",
          [order],
        );
        const result = await add(owner.c);
        ok(!result.error, "Owner order entry denied");
        ok(
          !(await advance(owner.c, result.data.item_ids[0], 1, "preparing"))
            .error,
          "Owner preparation denied",
        );
        ok(
          !(await advance(owner.c, result.data.item_ids[0], 2, "ready")).error,
          "Owner ready denied",
        );
        const rows = await db.query(
          "select unit_price_irr from public.order_items where order_id=$1",
          [order],
        );
        assert.equal(rows.rowCount, before.rows[0].n + 1);
        assert.equal(
          rows.rows.filter((r) => r.unit_price_irr === "3950000").length,
          before.rows[0].n,
        );
      },
    );
    await t.test(
      "changing trusted branch assignment denies the old branch immediately",
      async () => {
        const branch = randomUUID();
        await db.query(
          "insert into public.branches(id,restaurant_id,name) values($1,$2,$3)",
          [branch, cafes[0].id, "آزمون شعبه " + branch.slice(0, 8)],
        );
        try {
          await db.query(
            "update public.restaurant_memberships set branch_id=$1 where restaurant_id=$2 and user_id=$3",
            [branch, cafes[0].id, w2.id],
          );
          ok(
            (await add(w2.c)).error?.code === "42501",
            "Cross-branch mutation accepted",
          );
          const hidden = await w2.c.from("orders").select("id").eq("id", order);
          ok(
            !hidden.error && hidden.data.length === 0,
            "Cross-branch read accepted",
          );
        } finally {
          await db.query(
            "update public.restaurant_memberships set branch_id=$1 where restaurant_id=$2 and user_id=$3",
            [cafes[0].branch, cafes[0].id, w2.id],
          );
          await db.query("delete from public.branches where id=$1", [branch]);
        }
      },
    );
    await t.test(
      "actual waiter serves once with actor/time, closes table and accepts a new party",
      async () => {
        const tbl = await createTestTable(db, cafes[0].id, cafes[0].branch);
        const opened = await w.c.rpc("open_table_order", {
          p_table_id: tbl,
          p_key: randomUUID(),
        });
        ok(!opened.error, "Seat guests failed");
        const oid = opened.data.order_id;
        await markTestOrder(db, oid, cafes[0].id, tbl);
        orders.push(oid);
        const added = await w.c.rpc("add_order_items", {
          p_order_id: oid,
          p_items: [{ menu_item_id: menu, quantity: 1, notes: "" }],
          p_key: randomUUID(),
        });
        ok(!added.error, "Add failed");
        const iid = added.data.item_ids[0];
        ok(
          !(await advance(k.c, iid, 1, "preparing")).error,
          "Kitchen preparing failed",
        );
        const ready = await advance(k.c, iid, 2, "ready");
        ok(!ready.error, "Kitchen ready failed");
        ok(
          (
            await w.c.rpc("close_table_service", {
              p_order_id: oid,
              p_expected_version: ready.data.version,
              p_key: randomUUID(),
            })
          ).error?.code === "PT409",
          "Unserved table must not close",
        );
        const key = randomUUID();
        const args = { p_item_id: iid, p_expected_version: 3, p_key: key };
        ok(
          (await k.c.rpc("serve_order_item", args)).error?.code === "42501",
          "Kitchen cannot claim waiter delivery",
        );
        ok(
          (await other.c.rpc("serve_order_item", args)).error?.code === "42501",
          "Cross tenant delivery denied",
        );
        const served = await Promise.all([
          w.c.rpc("serve_order_item", args),
          w.c.rpc("serve_order_item", args),
        ]);
        ok(
          served.every((r) => !r.error),
          "Serve failed",
        );
        assert.deepEqual(served[0].data, served[1].data);
        const record = (
          await db.query(
            "select status,served_at,served_by from public.order_items where id=$1",
            [iid],
          )
        ).rows[0];
        assert.equal(record.status, "served");
        assert.equal(record.served_by, w.id);
        ok(record.served_at, "Server timestamp missing");
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.order_events where order_item_id=$1 and event_type='item_served' and actor_id=$2",
              [iid, w.id],
            )
          ).rows[0].n,
          1,
        );
        const kitchenView = await k.c
          .from("order_items")
          .select("id")
          .eq("id", iid)
          .in("status", ["queued", "preparing", "ready"]);
        ok(
          !kitchenView.error && kitchenView.data.length === 0,
          "Served item remains in kitchen queue",
        );
        const closeArgs = {
          p_order_id: oid,
          p_expected_version: served[0].data.version,
          p_key: randomUUID(),
        };
        ok(
          (await k.c.rpc("close_table_service", closeArgs)).error?.code ===
            "42501",
          "Kitchen cannot free table",
        );
        ok(
          !(await w.c.rpc("close_table_service", closeArgs)).error,
          "Close failed",
        );
        ok(
          !(await w.c.rpc("close_table_service", closeArgs)).error,
          "Close replay failed",
        );
        const next = await w2.c.rpc("open_table_order", {
          p_table_id: tbl,
          p_key: randomUUID(),
        });
        ok(!next.error, "New party blocked");
        assert.notEqual(next.data.order_id, oid);
        await markTestOrder(db, next.data.order_id, cafes[0].id, tbl);
        orders.push(next.data.order_id);
        assert.equal(
          (
            await db.query(
              "select count(*)::int n from public.orders where table_id=$1 and status not in ('closed','cancelled')",
              [tbl],
            )
          ).rows[0].n,
          1,
        );
      },
    );
  },
);
