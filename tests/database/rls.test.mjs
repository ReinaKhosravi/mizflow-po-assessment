import { test } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import {
  cafes,
  fixtureId,
  insertCafeData,
} from "../../scripts/demo-fixtures.mjs";

const tables = [
  "restaurants",
  "branches",
  "restaurant_memberships",
  "dining_tables",
  "menu_items",
  "orders",
  "order_items",
  "order_events",
];
const users = [
  {
    owner: "a0000000-0000-4000-8000-000000000001",
    waiter: "a0000000-0000-4000-8000-000000000002",
    kitchen: "a0000000-0000-4000-8000-000000000003",
  },
  {
    owner: "b0000000-0000-4000-8000-000000000001",
    waiter: "b0000000-0000-4000-8000-000000000002",
    kitchen: "b0000000-0000-4000-8000-000000000003",
  },
];
const secondBranch = "11000000-0000-4000-8000-000000000099";

test("real PostgreSQL grants, constraints and RLS", async (t) => {
  assert.ok(
    process.env.MIZFLOW_TEST_PG_SOCKET,
    "Run npm run test:db; an isolated cluster is required",
  );
  const db = new pg.Client({
    host: process.env.MIZFLOW_TEST_PG_SOCKET,
    user: "postgres",
    database: "postgres",
  });
  await db.connect();
  t.after(() => db.end());
  for (const ids of users)
    for (const id of Object.values(ids))
      await db.query("insert into auth.users(id) values($1)", [id]);
  const unassigned = "c0000000-0000-4000-8000-000000000001";
  await db.query("insert into auth.users(id) values($1)", [unassigned]);
  for (const [i, cafe] of cafes.entries())
    await insertCafeData(db, cafe, i, users[i]);
  await db.query(
    "insert into public.branches(id,restaurant_id,name) values($1,$2,$3)",
    [secondBranch, cafes[0].id, "شعبه دوم"],
  );
  await db.query(
    "insert into public.dining_tables(id,restaurant_id,branch_id,label,seats) values($1,$2,$3,$4,2)",
    [fixtureId(0, 2, 99), cafes[0].id, secondBranch, "میز شعبه دوم"],
  );
  await db.query(
    "insert into public.menu_items(id,restaurant_id,branch_id,name,category,price_irr) values($1,$2,$3,$4,$5,100000)",
    [fixtureId(0, 3, 99), cafes[0].id, secondBranch, "چای شعبه دوم", "چای"],
  );
  // Owner can author historical records for either branch.
  await db.query(
    "insert into public.orders(id,restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,$5,$1)",
    [
      fixtureId(0, 4, 99),
      cafes[0].id,
      secondBranch,
      fixtureId(0, 2, 99),
      users[0].owner,
    ],
  );
  await db.query(
    "insert into public.order_items(id,restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,idempotency_key) values($1,$2,$3,$4,$5,'چای',100000,1,$1)",
    [
      fixtureId(0, 5, 99),
      cafes[0].id,
      secondBranch,
      fixtureId(0, 4, 99),
      fixtureId(0, 3, 99),
    ],
  );
  await db.query(
    "insert into public.order_events(id,restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key) values($1,$2,$3,$4,$5,'demo_imported',1,$1)",
    [
      fixtureId(0, 6, 99),
      cafes[0].id,
      secondBranch,
      fixtureId(0, 4, 99),
      users[0].owner,
    ],
  );

  async function asRole(user, callback, role = "authenticated") {
    await db.query("begin");
    try {
      await db.query(`set local role ${role}`); // role comes only from this test, never user input
      await db.query("select set_config('request.jwt.claims',$1,true)", [
        JSON.stringify(user ? { sub: user, role } : { role }),
      ]);
      return await callback(db);
    } finally {
      await db.query("rollback");
    }
  }
  const denied = (promise) =>
    assert.rejects(promise, (e) => e.code === "42501");
  const foreignKey = (promise) =>
    assert.rejects(promise, (e) => e.code === "23503");

  await t.test(
    "fresh demo seed has 12/8 tables, separate twelve-item menus and five order snapshots per cafe",
    async () => {
      for (const [index, cafe] of cafes.entries()) {
        const tables = await db.query(
          "select count(*)::int n from public.dining_tables where branch_id=$1",
          [cafe.branch],
        );
        assert.equal(tables.rows[0].n, index === 0 ? 12 : 8);
        const items = await db.query(
          "select count(*)::int n from public.menu_items where branch_id=$1",
          [cafe.branch],
        );
        assert.equal(items.rows[0].n, 12);
        const orders = await db.query(
          "select count(*)::int n from public.orders where branch_id=$1",
          [cafe.branch],
        );
        assert.equal(orders.rows[0].n, 5);
      }
    },
  );
  await t.test(
    "all eight tables have RLS and anonymous access is denied",
    async () => {
      const result = await db.query(
        "select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relname=any($1)",
        [tables],
      );
      assert.equal(result.rows.length, 8);
      assert.ok(result.rows.every((r) => r.relrowsecurity));
      for (const table of tables)
        await denied(
          asRole(null, (c) => c.query(`select * from public.${table}`), "anon"),
        );
      await denied(
        asRole(
          null,
          (c) => c.query("select private.is_owner($1)", [cafes[0].id]),
          "anon",
        ),
      );
    },
  );
  await t.test(
    "owner A cannot read B in any tenant table; B can read its own records",
    async () => {
      for (const table of tables) {
        const key = table === "restaurants" ? "id" : "restaurant_id";
        const result = await asRole(users[0].owner, (c) =>
          c.query(`select * from public.${table} where ${key}=$1`, [
            cafes[1].id,
          ]),
        );
        assert.equal(result.rowCount, 0, table);
        const own = await asRole(users[1].owner, (c) =>
          c.query(`select * from public.${table} where ${key}=$1`, [
            cafes[1].id,
          ]),
        );
        assert.ok(own.rowCount > 0, table);
      }
    },
  );
  await t.test(
    "cross-restaurant UPDATE returns no rows and INSERT is denied",
    async () => {
      const result = await asRole(users[0].owner, (c) =>
        c.query(
          "update public.menu_items set price_irr=1 where restaurant_id=$1 returning id",
          [cafes[1].id],
        ),
      );
      assert.equal(result.rowCount, 0);
      await denied(
        asRole(users[0].owner, (c) =>
          c.query(
            "insert into public.menu_items(restaurant_id,branch_id,name,category,price_irr) values($1,$2,'تزریق','چای',1)",
            [cafes[1].id, cafes[1].branch],
          ),
        ),
      );
    },
  );
  await t.test(
    "cross-tenant branch FK injection fails even for permitted owner inserts",
    async () => {
      await foreignKey(
        asRole(users[0].owner, (c) =>
          c.query(
            "insert into public.dining_tables(restaurant_id,branch_id,label,seats) values($1,$2,'تزریق',2)",
            [cafes[0].id, cafes[1].branch],
          ),
        ),
      );
      await foreignKey(
        asRole(users[0].owner, (c) =>
          c.query(
            "insert into public.menu_items(restaurant_id,branch_id,name,category,price_irr) values($1,$2,'تزریق','چای',1)",
            [cafes[0].id, cafes[1].branch],
          ),
        ),
      );
    },
  );
  await t.test(
    "same-tenant cross-branch order/table/menu/event references fail at DB level",
    async () => {
      // Administrator bypasses RLS here to prove composite FKs independently of denied write grants.
      await assert.rejects(
        db.query(
          "insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,gen_random_uuid())",
          [cafes[0].id, secondBranch, fixtureId(0, 2, 1), users[0].owner],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.order_items(restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,idempotency_key) values($1,$2,$3,$4,'چای',1,1,gen_random_uuid())",
          [
            cafes[0].id,
            cafes[0].branch,
            fixtureId(0, 4, 1),
            fixtureId(0, 3, 99),
          ],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.order_events(restaurant_id,branch_id,order_id,order_item_id,actor_id,event_type,order_version,idempotency_key) values($1,$2,$3,$4,$5,'item_ready',1,gen_random_uuid())",
          [
            cafes[0].id,
            cafes[0].branch,
            fixtureId(0, 4, 1),
            fixtureId(0, 5, 2),
            users[0].owner,
          ],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,gen_random_uuid())",
          [cafes[0].id, cafes[0].branch, fixtureId(0, 2, 1), users[1].owner],
        ),
        (e) => e.code === "23503",
      );
    },
  );
  await t.test(
    "cross-tenant order/item/event injection and cross-branch actors are rejected independently of RLS",
    async () => {
      await assert.rejects(
        db.query(
          "insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,gen_random_uuid())",
          [cafes[0].id, cafes[0].branch, fixtureId(1, 2, 1), users[0].owner],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.order_items(restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,idempotency_key) values($1,$2,$3,$4,'چای',1,1,gen_random_uuid())",
          [
            cafes[0].id,
            cafes[0].branch,
            fixtureId(1, 4, 1),
            fixtureId(0, 3, 1),
          ],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key) values($1,$2,$3,$4,'demo_imported',1,gen_random_uuid())",
          [cafes[0].id, cafes[0].branch, fixtureId(1, 4, 1), users[0].owner],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,gen_random_uuid())",
          [cafes[0].id, secondBranch, fixtureId(0, 2, 99), users[0].waiter],
        ),
        (e) => e.code === "23503",
      );
      await assert.rejects(
        db.query(
          "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key) values($1,$2,$3,$4,'demo_imported',1,gen_random_uuid())",
          [cafes[0].id, secondBranch, fixtureId(0, 4, 99), users[0].kitchen],
        ),
        (e) => e.code === "23503",
      );
    },
  );
  await t.test(
    "waiter cannot perform owner configuration; kitchen cannot change prices",
    async () => {
      for (const user of [users[0].waiter, users[0].kitchen]) {
        const r = await asRole(user, (c) =>
          c.query(
            "update public.menu_items set price_irr=1 where restaurant_id=$1 returning id",
            [cafes[0].id],
          ),
        );
        assert.equal(r.rowCount, 0);
        await denied(
          asRole(user, (c) =>
            c.query(
              "insert into public.branches(restaurant_id,name) values($1,'شعبه غیرمجاز')",
              [cafes[0].id],
            ),
          ),
        );
      }
      const permitted = await asRole(users[0].owner, (c) =>
        c.query(
          "update public.menu_items set price_irr=100000 where id=$1 returning id",
          [fixtureId(0, 3, 1)],
        ),
      );
      assert.equal(permitted.rowCount, 1);
    },
  );
  await t.test(
    "branch-scoped staff cannot read other branches; owners see both",
    async () => {
      for (const table of [
        "branches",
        "dining_tables",
        "menu_items",
        "orders",
        "order_items",
        "order_events",
      ]) {
        const key = table === "branches" ? "id" : "branch_id";
        for (const user of [users[0].waiter, users[0].kitchen]) {
          const r = await asRole(user, (c) =>
            c.query(`select * from public.${table} where ${key}=$1`, [
              secondBranch,
            ]),
          );
          assert.equal(r.rowCount, 0, table);
        }
        const own = await asRole(users[0].owner, (c) =>
          c.query(`select * from public.${table} where ${key}=$1`, [
            secondBranch,
          ]),
        );
        assert.ok(own.rowCount > 0, table);
      }
    },
  );
  await t.test(
    "users cannot grant themselves owner, change scope, or create membership",
    async () => {
      for (const user of [users[0].waiter, users[0].owner]) {
        await denied(
          asRole(user, (c) =>
            c.query(
              "update public.restaurant_memberships set role='owner',branch_id=null where user_id=$1",
              [user],
            ),
          ),
        );
        await denied(
          asRole(user, (c) =>
            c.query(
              "insert into public.restaurant_memberships(restaurant_id,user_id,role) values($1,$2,'owner')",
              [cafes[1].id, user],
            ),
          ),
        );
      }
      await denied(
        asRole(users[0].owner, (c) =>
          c.query("update public.menu_items set restaurant_id=$1 where id=$2", [
            cafes[1].id,
            fixtureId(0, 3, 1),
          ]),
        ),
      );
    },
  );
  await t.test(
    "order mutations are default-denied for every app role",
    async () => {
      for (const user of Object.values(users[0])) {
        await denied(
          asRole(user, (c) =>
            c.query("update public.orders set status='cancelled' where id=$1", [
              fixtureId(0, 4, 1),
            ]),
          ),
        );
        await denied(
          asRole(user, (c) =>
            c.query(
              "update public.order_items set status='ready' where id=$1",
              [fixtureId(0, 5, 1)],
            ),
          ),
        );
        await denied(
          asRole(user, (c) =>
            c.query("delete from public.order_events where id=$1", [
              fixtureId(0, 6, 1),
            ]),
          ),
        );
        await denied(
          asRole(user, (c) =>
            c.query(
              "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key) values($1,$2,$3,$4,'item_ready',1,gen_random_uuid())",
              [cafes[0].id, cafes[0].branch, fixtureId(0, 4, 1), user],
            ),
          ),
        );
      }
    },
  );
  await t.test(
    "event history rejects UPDATE/DELETE/TRUNCATE even as migration administrator",
    async () => {
      await denied(
        db.query("update public.order_events set event_type='order_closed'"),
      );
      await denied(db.query("delete from public.order_events"));
      await denied(db.query("truncate public.order_events"));
    },
  );
  await t.test(
    "idempotency uniqueness and money bounds are enforced",
    async () => {
      await assert.rejects(
        db.query(
          "insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key) values($1,$2,$3,$4,$5)",
          [
            cafes[0].id,
            cafes[0].branch,
            fixtureId(0, 2, 1),
            users[0].owner,
            fixtureId(0, 4, 1),
          ],
        ),
        (e) => e.code === "23505",
      );
      await assert.rejects(
        db.query("update public.menu_items set price_irr=-1 where id=$1", [
          fixtureId(0, 3, 1),
        ]),
        (e) => e.code === "23514",
      );
      await assert.rejects(
        db.query(
          "update public.menu_items set price_irr=9007199254740992 where id=$1",
          [fixtureId(0, 3, 1)],
        ),
        (e) => e.code === "23514",
      );
    },
  );
  await t.test(
    "unassigned authenticated users have no private access",
    async () => {
      for (const table of tables)
        assert.equal(
          (
            await asRole(unassigned, (c) =>
              c.query(`select * from public.${table}`),
            )
          ).rowCount,
          0,
          table,
        );
    },
  );
  await t.test(
    "revoked membership immediately denies access with the same user identity",
    async () => {
      const before = await asRole(users[0].waiter, (c) =>
        c.query("select * from public.menu_items"),
      );
      assert.ok(before.rowCount > 0);
      await db.query(
        "update public.restaurant_memberships set revoked_at=now() where user_id=$1",
        [users[0].waiter],
      );
      for (const table of tables)
        assert.equal(
          (
            await asRole(users[0].waiter, (c) =>
              c.query(`select * from public.${table}`),
            )
          ).rowCount,
          0,
          table,
        );
      const update = await asRole(users[0].waiter, (c) =>
        c.query("update public.menu_items set price_irr=1 returning id"),
      );
      assert.equal(update.rowCount, 0);
    },
  );
  await t.test(
    "development data seeding is idempotent and does not rewrite event history",
    async () => {
      const before = await db.query(
        "select count(*)::int as n from public.order_events",
      );
      for (const [i, cafe] of cafes.entries())
        await insertCafeData(db, cafe, i, users[i]);
      const stillRevoked = await db.query(
        "select revoked_at from public.restaurant_memberships where user_id=$1",
        [users[0].waiter],
      );
      assert.ok(
        stillRevoked.rows[0].revoked_at,
        "Rerunning a seed must not reactivate a revoked membership",
      );
      const after = await db.query(
        "select count(*)::int as n from public.order_events",
      );
      assert.equal(after.rows[0].n, before.rows[0].n);
    },
  );
});
