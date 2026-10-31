import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { randomUUID } from "node:crypto";
const id = (n) => `f0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const R = id(1),
  B = id(2),
  B2 = id(3),
  RB = id(4),
  BB = id(5),
  W = id(10),
  W2 = id(11),
  K = id(12),
  O = id(13),
  OTHER = id(14),
  BRANCH = id(15),
  REVOKED = id(16),
  M = id(20),
  MB = id(21);
function client() {
  return new pg.Client({
    host: process.env.MIZFLOW_TEST_PG_SOCKET,
    user: "postgres",
    database: "postgres",
  });
}
async function run(user, sql, args = [], role = "authenticated") {
  const c = client();
  await c.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${role}`);
    await c.query("select set_config('request.jwt.claims',$1,true)", [
      JSON.stringify(user ? { sub: user, role } : { role }),
    ]);
    const r = await c.query(sql, args);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    await c.end();
  }
}
const open = (table, key = randomUUID(), user = W) =>
  run(user, "select public.open_table_order($1,$2) result", [table, key]).then(
    (r) => r.rows[0].result,
  );
const add = (
  order,
  key = randomUUID(),
  user = W,
  items = [{ menu_item_id: M, quantity: 1, notes: "بدون پیاز" }],
) =>
  run(user, "select public.add_order_items($1,$2,$3) result", [
    order,
    JSON.stringify(items),
    key,
  ]).then((r) => r.rows[0].result);
const advance = (item, version, status, key = randomUUID(), user = K) =>
  run(user, "select public.advance_order_item($1,$2,$3,$4) result", [
    item,
    version,
    status,
    key,
  ]).then((r) => r.rows[0].result);
test("transactional workflow on real PostgreSQL with independent connections", async (t) => {
  const db = client();
  await db.connect();
  t.after(() => db.end());
  for (const user of [W, W2, K, O, OTHER, BRANCH, REVOKED])
    await db.query("insert into auth.users(id) values($1)", [user]);
  await db.query(
    "insert into public.restaurants(id,name,slug) values($1,'آزمون','workflow-a'),($2,'جدا','workflow-b')",
    [R, RB],
  );
  await db.query(
    "insert into public.branches(id,restaurant_id,name) values($1,$2,'مرکزی'),($3,$2,'دوم'),($4,$5,'مرکزی')",
    [B, R, B2, BB, RB],
  );
  for (const [user, role, branch, rest] of [
    [W, "waiter", B, R],
    [W2, "waiter", B, R],
    [K, "kitchen", B, R],
    [O, "owner", null, R],
    [OTHER, "waiter", BB, RB],
    [BRANCH, "waiter", B2, R],
    [REVOKED, "waiter", B, R],
  ])
    await db.query(
      "insert into public.restaurant_memberships(restaurant_id,user_id,role,branch_id) values($1,$2,$3,$4)",
      [rest, user, role, branch],
    );
  await db.query(
    "update public.restaurant_memberships set revoked_at=now() where user_id=$1",
    [REVOKED],
  );
  await db.query(
    "insert into public.menu_items(id,restaurant_id,branch_id,name,category,price_irr) values($1,$2,$3,'برگر','غذا',2500000),($4,$5,$6,'جدا','غذا',1)",
    [M, R, B, MB, RB, BB],
  );
  let n = 100;
  async function table() {
    const x = id(n++);
    await db.query(
      "insert into public.dining_tables(id,restaurant_id,branch_id,label,seats) values($1,$2,$3,$4,4)",
      [x, R, B, `میز ${n}`],
    );
    return x;
  }
  await t.test(
    "open, submit multiple snapshots, prepare and ready with append-only audit",
    async () => {
      const o = await open(await table());
      const a = await add(o.order_id, randomUUID(), W, [
        { menu_item_id: M, quantity: 2, notes: "بدون پیاز" },
        { menu_item_id: M, quantity: 1, notes: "" },
      ]);
      const items = (
        await db.query("select * from public.order_items where order_id=$1", [
          o.order_id,
        ])
      ).rows;
      assert.equal(items.length, 2);
      assert.equal(items[0].unit_price_irr, "2500000");
      for (const item of items) {
        await advance(item.id, 1, "preparing");
        await advance(item.id, 2, "ready");
      }
      const row = (
        await run(W, "select status,version from public.orders where id=$1", [
          o.order_id,
        ])
      ).rows[0];
      assert.equal(row.status, "ready");
      assert.equal(row.version, 6);
      const events = (
        await db.query(
          "select * from public.order_events where order_id=$1 order by order_version",
          [o.order_id],
        )
      ).rows;
      assert.equal(events.length, 6);
      assert.equal(events[1].details.item_ids.length, 2);
      assert.equal(a.version, 2);
    },
  );
  await t.test(
    "two independent waiters append concurrently without lost lines",
    async () => {
      const o = await open(await table());
      await Promise.all([
        add(o.order_id, randomUUID(), W),
        add(o.order_id, randomUUID(), W2),
      ]);
      const row = (
        await db.query(
          "select version,(select count(*)::int from public.order_items where order_id=$1) as lines from public.orders where id=$1",
          [o.order_id],
        )
      ).rows[0];
      assert.equal(row.version, 3);
      assert.equal(row.lines, 2);
    },
  );
  await t.test(
    "kitchen update racing with append preserves both item status and new line",
    async () => {
      const o = await open(await table());
      const first = await add(o.order_id);
      await Promise.all([
        advance(first.item_ids[0], 1, "preparing"),
        add(o.order_id, randomUUID(), W2),
      ]);
      const rows = (
        await db.query(
          "select status from public.order_items where order_id=$1",
          [o.order_id],
        )
      ).rows
        .map((r) => r.status)
        .sort();
      assert.deepEqual(rows, ["preparing", "queued"]);
      assert.equal(
        (
          await db.query("select version from public.orders where id=$1", [
            o.order_id,
          ])
        ).rows[0].version,
        4,
      );
    },
  );
  await t.test(
    "simultaneous identical requests replay the same committed result once",
    async () => {
      const o = await open(await table());
      const key = randomUUID();
      const results = await Promise.all([
        add(o.order_id, key),
        add(o.order_id, key),
      ]);
      assert.deepEqual(results[0], results[1]);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.order_items where order_id=$1",
            [o.order_id],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.order_events where order_id=$1",
            [o.order_id],
          )
        ).rows[0].n,
        2,
      );
      await assert.rejects(
        add(o.order_id, key, W, [{ menu_item_id: M, quantity: 2, notes: "" }]),
        (e) => e.code === "22023",
      );
    },
  );
  await t.test(
    "simultaneous open attempts create exactly one active order with explicit conflict",
    async () => {
      const tbl = await table();
      const r = await Promise.allSettled([
        open(tbl, randomUUID(), W),
        open(tbl, randomUUID(), W2),
      ]);
      assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
      assert.equal(r.find((x) => x.status === "rejected").reason.code, "PT409");
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.orders where table_id=$1 and status='draft'",
            [tbl],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "open and preparation retries are idempotent, stale or invalid transitions conflict",
    async () => {
      const tbl = await table(),
        key = randomUUID();
      const o = await open(tbl, key);
      assert.deepEqual(await open(tbl, key), o);
      const a = await add(o.order_id);
      const k = randomUUID();
      const first = await advance(a.item_ids[0], 1, "preparing", k);
      assert.deepEqual(await advance(a.item_ids[0], 1, "preparing", k), first);
      await assert.rejects(
        advance(a.item_ids[0], 1, "ready"),
        (e) => e.code === "PT409",
      );
      await assert.rejects(
        advance(a.item_ids[0], 2, "served"),
        (e) => e.code === "22023",
      );
    },
  );
  await t.test(
    "tenant, branch, revoked and role violations fail closed at RPC and reads",
    async () => {
      const tbl = await table(),
        o = await open(tbl),
        a = await add(o.order_id);
      for (const user of [OTHER, BRANCH, REVOKED, K])
        await assert.rejects(
          add(o.order_id, randomUUID(), user),
          (e) => e.code === "42501",
        );
      for (const user of [W, W2, OTHER, BRANCH, REVOKED])
        await assert.rejects(
          advance(a.item_ids[0], 1, "preparing", randomUUID(), user),
          (e) => e.code === "42501",
        );
      for (const user of [OTHER, BRANCH, REVOKED])
        assert.equal(
          (
            await run(user, "select id from public.orders where id=$1", [
              o.order_id,
            ])
          ).rowCount,
          0,
        );
      await assert.rejects(
        run(
          null,
          "select public.open_table_order($1,$2)",
          [tbl, randomUUID()],
          "anon",
        ),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        run(W, "select * from private.order_commands"),
        (e) => e.code === "42501",
      );
    },
  );
  await t.test(
    "owner can order and prepare in own restaurant, never another restaurant",
    async () => {
      const o = await open(await table(), randomUUID(), O);
      const a = await add(o.order_id, randomUUID(), O);
      assert.equal(
        (
          await run(
            O,
            "select count(*)::int n from public.order_items where order_id=$1",
            [o.order_id],
          )
        ).rows[0].n,
        1,
      );
      await advance(a.item_ids[0], 1, "preparing", randomUUID(), O);
      await advance(a.item_ids[0], 2, "ready", randomUUID(), O);
      await assert.rejects(
        add(o.order_id, randomUUID(), OTHER),
        (e) => e.code === "42501",
      );
    },
  );
  await t.test(
    "forged prices, cross-tenant menu, invalid payload and all-or-nothing batches",
    async () => {
      const o = await open(await table());
      await assert.rejects(
        add(o.order_id, randomUUID(), W, [
          { menu_item_id: M, quantity: 1, price_irr: 1 },
        ]),
        (e) => e.code === "22023",
      );
      await assert.rejects(
        add(o.order_id, randomUUID(), W, [
          { menu_item_id: M, quantity: 1 },
          { menu_item_id: MB, quantity: 1 },
        ]),
        (e) => e.code === "22023",
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.order_items where order_id=$1",
            [o.order_id],
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query("select version from public.orders where id=$1", [
            o.order_id,
          ])
        ).rows[0].version,
        1,
      );
      await assert.rejects(
        add(o.order_id, randomUUID(), W, [{ menu_item_id: M, quantity: 1.5 }]),
        (e) => e.code === "22023",
      );
    },
  );
  await t.test(
    "serve records actor/time once, removes ready item, closes and reuses the physical table",
    async () => {
      const tbl = await table(),
        o = await open(tbl),
        a = await add(o.order_id);
      const item = a.item_ids[0];
      const serve = (key, version = 3, user = W) =>
        run(user, "select public.serve_order_item($1,$2,$3) result", [
          item,
          version,
          key,
        ]).then((r) => r.rows[0].result);
      await assert.rejects(serve(randomUUID(), 1), (e) => e.code === "22023");
      await advance(item, 1, "preparing");
      await advance(item, 2, "ready");
      for (const user of [K, OTHER, BRANCH, REVOKED])
        await assert.rejects(
          serve(randomUUID(), 3, user),
          (e) => e.code === "42501",
        );
      const key = randomUUID(),
        results = await Promise.all([serve(key), serve(key)]);
      assert.deepEqual(results[0], results[1]);
      const saved = (
        await db.query(
          "select status,served_by,served_at,version from public.order_items where id=$1",
          [item],
        )
      ).rows[0];
      assert.equal(saved.status, "served");
      assert.equal(saved.served_by, W);
      assert.ok(saved.served_at);
      assert.equal(saved.version, 4);
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.order_events where order_item_id=$1 and event_type='item_served' and actor_id=$2",
            [item, W],
          )
        ).rows[0].n,
        1,
      );
      assert.equal(
        (
          await run(
            K,
            "select count(*)::int n from public.order_items where id=$1 and status in ('queued','preparing','ready')",
            [item],
          )
        ).rows[0].n,
        0,
      );
      const ov = (
        await db.query("select version from public.orders where id=$1", [
          o.order_id,
        ])
      ).rows[0].version;
      const ck = randomUUID();
      const close = (user = W) =>
        run(user, "select public.close_table_service($1,$2,$3) result", [
          o.order_id,
          ov,
          ck,
        ]).then((r) => r.rows[0].result);
      await assert.rejects(close(K), (e) => e.code === "42501");
      const closed = await close();
      assert.deepEqual(await close(), closed);
      const next = await open(tbl);
      assert.notEqual(next.order_id, o.order_id);
      assert.deepEqual(await close(), closed);
      assert.equal(
        (
          await db.query("select status from public.orders where id=$1", [
            next.order_id,
          ])
        ).rows[0].status,
        "draft",
      );
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
  await t.test(
    "a served table remains occupied, can order another round, and cannot close with unserved food",
    async () => {
      const o = await open(await table()),
        a = await add(o.order_id);
      const item = a.item_ids[0];
      await advance(item, 1, "preparing");
      await advance(item, 2, "ready");
      await run(O, "select public.serve_order_item($1,3,$2)", [
        item,
        randomUUID(),
      ]);
      const more = await add(o.order_id, randomUUID(), W2);
      assert.equal(
        (
          await db.query("select status from public.order_items where id=$1", [
            item,
          ])
        ).rows[0].status,
        "served",
      );
      await assert.rejects(
        run(W, "select public.close_table_service($1,$2,$3)", [
          o.order_id,
          more.version,
          randomUUID(),
        ]),
        (e) => e.code === "PT409",
      );
      assert.equal(
        (
          await db.query("select status from public.orders where id=$1", [
            o.order_id,
          ])
        ).rows[0].status,
        "submitted",
      );
      const empty = await open(await table());
      await run(W, "select public.close_table_service($1,1,$2)", [
        empty.order_id,
        randomUUID(),
      ]);
    },
  );
  await t.test(
    "two waiters cannot serve the same ready item twice",
    async () => {
      const o = await open(await table()),
        a = await add(o.order_id),
        iid = a.item_ids[0];
      await advance(iid, 1, "preparing");
      await advance(iid, 2, "ready");
      const outcomes = await Promise.allSettled(
        [W, W2].map((user) =>
          run(user, "select public.serve_order_item($1,3,$2)", [
            iid,
            randomUUID(),
          ]),
        ),
      );
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        outcomes.find((r) => r.status === "rejected").reason.code,
        "PT409",
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int n from public.order_events where order_item_id=$1 and event_type='item_served'",
            [iid],
          )
        ).rows[0].n,
        1,
      );
    },
  );
  await t.test(
    "closing an empty seated table racing with new food has one explicit conflict, never lost food",
    async () => {
      const o = await open(await table());
      const outcomes = await Promise.allSettled([
        run(W, "select public.close_table_service($1,1,$2)", [
          o.order_id,
          randomUUID(),
        ]),
        add(o.order_id, randomUUID(), W2),
      ]);
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        outcomes.find((r) => r.status === "rejected").reason.code,
        "PT409",
      );
      const row = (
        await db.query(
          "select status,version,(select count(*)::int from public.order_items where order_id=$1) lines from public.orders where id=$1",
          [o.order_id],
        )
      ).rows[0];
      assert.equal(row.version, 2);
      if (row.status === "closed") assert.equal(row.lines, 0);
      else {
        assert.equal(row.status, "submitted");
        assert.equal(row.lines, 1);
      }
    },
  );
});
