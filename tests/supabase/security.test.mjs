import { test } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { cafes } from "../../scripts/demo-fixtures.mjs";
import {
  verifyTarget,
  databaseOptions,
  verifyMigration,
  assertDemoTargets,
} from "../../scripts/admin-target.mjs";
const enabled = process.env.MIZFLOW_RUN_SUPABASE_TESTS === "1";
const tableNames = [
  "restaurants",
  "branches",
  "restaurant_memberships",
  "dining_tables",
  "menu_items",
  "orders",
  "order_items",
  "order_events",
];
const ok = (condition, message) => assert.ok(Boolean(condition), message);

test(
  "actual Supabase Auth and PostgREST security (requires explicit demo-only configuration)",
  {
    skip: enabled
      ? false
      : "No configured Supabase credentials; this is not evidence of Auth/PostgREST success.",
  },
  async (t) => {
    const env = process.env;
    ok(
      env.MIZFLOW_TEST_WRITE === "demo-only",
      "Explicit demo-only mutation authorization is required",
    );
    let target;
    try {
      target = verifyTarget(
        env.NEXT_PUBLIC_SUPABASE_URL,
        env.MIZFLOW_TEST_DATABASE_URL,
        env.MIZFLOW_CONFIRMED_PROJECT_REF,
      );
    } catch {
      throw new Error(
        "Configure the confirmed project and matching database URL locally",
      );
    }
    const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
    let isAnon = false;
    try {
      isAnon =
        JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString())
          .role === "anon";
    } catch {}
    ok(
      key.startsWith("sb_publishable_") || isAnon,
      "Only a publishable or local anon key may run user requests",
    );
    ok(
      env.MIZFLOW_DEMO_PASSWORD?.length >= 16,
      "Configure the seeded development password locally",
    );
    const client = () =>
      createClient(target.api.toString(), key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const anonymous = client(),
      sessions = [];
    let db;
    try {
      db = new pg.Client(databaseOptions(target));
      await db.connect();
      await verifyMigration(db);
      await assertDemoTargets(db, cafes);
    } catch {
      if (db) await db.end();
      throw new Error(
        "Administrative test preflight failed; no user tests executed",
      );
    }
    t.after(async () => {
      for (const c of sessions) await c.auth.signOut({ scope: "local" });
      await db.end();
    });
    // Only accounts explicitly marked as demo may participate in the revocation test.
    const identities = {};
    for (const [index, cafe] of cafes.entries()) {
      identities[index] = {};
      for (const role of ["owner", "waiter", "kitchen"]) {
        const c = client();
        const auth = await c.auth.signInWithPassword({
          email: `${cafe.prefix}.${role}@demo.mizflow.test`,
          password: env.MIZFLOW_DEMO_PASSWORD,
        });
        ok(
          !auth.error && auth.data.user?.app_metadata?.mizflow_demo === true,
          "Real seeded demo Auth login failed",
        );
        sessions.push(c);
        identities[index][role] = { c, userId: auth.data.user.id };
        const membership = await c
          .from("restaurant_memberships")
          .select("id,role,branch_id")
          .eq("user_id", auth.data.user.id)
          .eq("restaurant_id", cafe.id)
          .is("revoked_at", null)
          .single();
        ok(
          !membership.error && membership.data.role === role,
          "Seeded role/scope is not active",
        );
      }
    }
    const ownerA = identities[0].owner.c,
      ownerB = identities[1].owner.c;
    const menuB = await ownerB
      .from("menu_items")
      .select("id,price_irr")
      .eq("restaurant_id", cafes[1].id)
      .limit(1)
      .single();
    ok(!menuB.error, "Positive control: B must read its own menu");
    const menuA = await ownerA
      .from("menu_items")
      .select("id,price_irr")
      .eq("restaurant_id", cafes[0].id)
      .limit(1)
      .single();
    ok(!menuA.error, "Positive control: A must read its own menu");

    await t.test(
      "workspace PostgREST relationships and exact counts resolve without mock rows",
      async () => {
        for (const table of ["menu_items", "dining_tables"]) {
          const rows = await ownerA
            .from(table)
            .select("id,branches(name)")
            .eq("restaurant_id", cafes[0].id)
            .limit(1);
          ok(
            !rows.error && typeof rows.data?.[0]?.branches?.name === "string",
            "Workspace branch relation failed",
          );
        }
        const kitchen = await ownerA
          .from("order_items")
          .select("id,orders!inner(status,branches(name))")
          .eq("restaurant_id", cafes[0].id)
          .in("status", ["queued", "preparing", "ready"])
          .in("orders.status", ["submitted", "in_preparation", "ready"]);
        ok(
          !kitchen.error &&
            kitchen.data.length > 0 &&
            typeof kitchen.data[0].orders?.branches?.name === "string",
          "Kitchen parent/branch relation failed",
        );
        const count = await ownerA
          .from("order_items")
          .select("id,orders!inner(status)", { head: true, count: "exact" })
          .eq("restaurant_id", cafes[0].id)
          .in("orders.status", ["submitted", "in_preparation", "ready"])
          .eq("status", "ready");
        ok(
          !count.error && count.count > 0,
          "Dashboard parent-scoped exact count failed",
        );
      },
    );
    await t.test(
      "anonymous public-key requests cannot read any tenant table",
      async () => {
        for (const table of tableNames) {
          const r = await anonymous.from(table).select("*").limit(1);
          ok(
            r.error || r.data?.length === 0,
            "Anonymous private read was allowed",
          );
        }
      },
    );
    await t.test("A cannot read B rows in any tenant table", async () => {
      for (const table of tableNames) {
        const r = await ownerA
          .from(table)
          .select("*")
          .eq(table === "restaurants" ? "id" : "restaurant_id", cafes[1].id);
        ok(
          !r.error && r.data.length === 0,
          "Cross-restaurant read leaked records",
        );
      }
    });
    await t.test(
      "A cannot update B menu; B values remain unchanged",
      async () => {
        const r = await ownerA
          .from("menu_items")
          .update({ price_irr: menuB.data.price_irr })
          .eq("id", menuB.data.id)
          .select("id");
        ok(
          r.error || r.data?.length === 0,
          "Cross-restaurant update was allowed",
        );
        const verify = await ownerB
          .from("menu_items")
          .select("price_irr")
          .eq("id", menuB.data.id)
          .single();
        ok(
          !verify.error && verify.data.price_irr === menuB.data.price_irr,
          "B menu was changed",
        );
      },
    );
    await t.test(
      "waiter cannot change menu price and kitchen cannot create a branch",
      async () => {
        const waiter = await identities[0].waiter.c
          .from("menu_items")
          .update({ price_irr: menuA.data.price_irr })
          .eq("id", menuA.data.id)
          .select("id");
        ok(
          waiter.error || waiter.data?.length === 0,
          "Waiter configuration was allowed",
        );
        const kitchenPrice = await identities[0].kitchen.c
          .from("menu_items")
          .update({ price_irr: 1 })
          .eq("id", menuA.data.id)
          .select("id");
        ok(
          kitchenPrice.error || kitchenPrice.data?.length === 0,
          "Kitchen menu price update must be denied",
        );
        const verifyPrice = await ownerA
          .from("menu_items")
          .select("price_irr")
          .eq("id", menuA.data.id)
          .single();
        ok(
          !verifyPrice.error &&
            verifyPrice.data.price_irr === menuA.data.price_irr,
          "Menu price must remain unchanged",
        );
        const probeId = randomUUID();
        try {
          const kitchen = await identities[0].kitchen.c
            .from("branches")
            .insert({
              id: probeId,
              restaurant_id: cafes[0].id,
              name: `آزمایش نقش ${probeId.slice(0, 8)}`,
            })
            .select("id");
          ok(
            kitchen.error,
            "Kitchen owner-only operation was allowed in its own restaurant",
          );
        } finally {
          // If a deployed policy regresses, remove only this test's marked demo probe.
          await db.query(
            "delete from public.branches where id=$1 and restaurant_id=$2",
            [probeId, cafes[0].id],
          );
        }
      },
    );
    await t.test(
      "cross-tenant FK injection is rejected through PostgREST",
      async () => {
        const probeId = randomUUID();
        try {
          const r = await ownerA.from("dining_tables").insert({
            id: probeId,
            restaurant_id: cafes[0].id,
            branch_id: cafes[1].branch,
            label: `آزمایش ${probeId.slice(0, 8)}`,
            seats: 2,
          });
          ok(
            r.error?.code === "23503",
            "Expected a database foreign-key rejection",
          );
        } finally {
          await db.query(
            "delete from public.dining_tables where id=$1 and restaurant_id=$2",
            [probeId, cafes[0].id],
          );
        }
      },
    );
    await t.test("users cannot elevate their membership role", async () => {
      const userId = identities[0].waiter.userId;
      const previous = await db.query(
        "select id,role,branch_id from public.restaurant_memberships where restaurant_id=$1 and user_id=$2",
        [cafes[0].id, userId],
      );
      ok(previous.rowCount === 1, "Missing marked demo membership");
      try {
        const r = await identities[0].waiter.c
          .from("restaurant_memberships")
          .update({ role: "owner", branch_id: null })
          .eq("user_id", userId)
          .select("id");
        ok(r.error || r.data?.length === 0, "Role escalation was allowed");
      } finally {
        await db.query(
          "update public.restaurant_memberships set role=$2,branch_id=$3 where id=$1 and (role is distinct from $2 or branch_id is distinct from $3)",
          [
            previous.rows[0].id,
            previous.rows[0].role,
            previous.rows[0].branch_id,
          ],
        );
      }
    });
    await t.test(
      "real Auth refresh returns another verified session",
      async () => {
        const c = identities[1].waiter.c;
        const refreshed = await c.auth.refreshSession();
        ok(!refreshed.error && refreshed.data.session, "Refresh failed");
        const verified = await c.auth.getUser();
        ok(
          !verified.error &&
            verified.data.user?.id === identities[1].waiter.userId,
          "Refreshed identity verification failed",
        );
        const rows = await c
          .from("dining_tables")
          .select("id")
          .eq("restaurant_id", cafes[1].id);
        ok(
          !rows.error && rows.data.length > 0,
          "Refreshed PostgREST access failed",
        );
      },
    );
    await t.test(
      "revoked membership loses PostgREST access without logging out",
      async () => {
        const user = identities[0].waiter;
        const previous = await db.query(
          "select m.id,m.revoked_at from public.restaurant_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=$1 and m.user_id=$2 and u.raw_app_meta_data->>'mizflow_demo'='true'",
          [cafes[0].id, user.userId],
        );
        ok(
          previous.rowCount === 1 && previous.rows[0].revoked_at === null,
          "Revocation test must target an active demo membership",
        );
        try {
          await db.query(
            "update public.restaurant_memberships set revoked_at=now() where id=$1",
            [previous.rows[0].id],
          );
          for (const table of tableNames) {
            const r = await user.c.from(table).select("*").limit(1);
            ok(
              !r.error && r.data.length === 0,
              "Revoked membership retained private access",
            );
          }
        } finally {
          await db.query(
            "update public.restaurant_memberships set revoked_at=$2 where id=$1",
            [previous.rows[0].id, previous.rows[0].revoked_at],
          );
        }
      },
    );
  },
);
