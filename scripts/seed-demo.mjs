import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { cafes, insertCafeData } from "./demo-fixtures.mjs";
import {
  verifyTarget,
  databaseOptions,
  verifyMigration,
  assertDemoTargets,
} from "./admin-target.mjs";

// This is an explicitly privileged, offline development provisioning command.
// It is never imported by the application and never prints credentials.
const env = process.env;
if (
  env.NODE_ENV === "production" ||
  env.MIZFLOW_DEMO_SEED !== "development-only"
)
  throw new Error(
    "Set MIZFLOW_DEMO_SEED=development-only in a development environment.",
  );
const target = verifyTarget(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.MIZFLOW_DEMO_DATABASE_URL || env.MIZFLOW_ADMIN_DATABASE_URL,
  env.MIZFLOW_CONFIRMED_PROJECT_REF,
);
if (!env.MIZFLOW_SEED_AUTH_KEY)
  throw new Error(
    "Configure the administrative Auth key only in ignored .env.seed.local for this development-only seed.",
  );
const password = env.MIZFLOW_DEMO_PASSWORD;
if (!password || password.length < 16)
  throw new Error(
    "Set a development-only MIZFLOW_DEMO_PASSWORD of at least 16 characters.",
  );
const admin = createClient(target.api.toString(), env.MIZFLOW_SEED_AUTH_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, {
        ...options,
        signal: AbortSignal.any([
          AbortSignal.timeout(15000),
          ...(options.signal ? [options.signal] : []),
        ]),
      }),
  },
});
let db;
let phase = "database_preflight";
function openDatabase() {
  const client = new pg.Client(databaseOptions(target));
  client.on("error", () => {}); // query promises report failure; do not emit raw credentials/errors.
  return client;
}
try {
  db = openDatabase();
  await db.connect();
  await verifyMigration(db);
  await assertDemoTargets(db, cafes);
  await db.end();
  db = undefined;
  phase = "auth_list";
  const existing = [];
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (result.error) throw new Error("Cannot list development Auth users");
    existing.push(...result.data.users);
    if (result.data.users.length < 1000) break;
  }
  for (const [index, cafe] of cafes.entries()) {
    const users = {};
    // Preflight all accounts before altering credentials or any café records.
    for (const role of ["owner", "waiter", "kitchen"]) {
      const found = existing.find(
        (u) => u.email === `${cafe.prefix}.${role}@demo.mizflow.test`,
      );
      if (found && found.app_metadata?.mizflow_demo !== true)
        throw new Error("Existing account is not a demo account.");
    }
    phase = "auth_provision";
    for (const role of ["owner", "waiter", "kitchen"]) {
      const email = `${cafe.prefix}.${role}@demo.mizflow.test`;
      const found = existing.find((u) => u.email === email);
      if (found && found.app_metadata?.mizflow_demo !== true)
        throw new Error(
          "Refusing to overwrite an account not marked as a MizFlow demo account.",
        );
      const result = found
        ? { data: { user: found }, error: null }
        : await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            app_metadata: { mizflow_demo: true },
          });
      if (result.error || !result.data.user)
        throw new Error("Cannot provision development Auth account");
      users[role] = result.data.user.id;
    }
    phase = "database_seed";
    db = openDatabase();
    await db.connect();
    await db.query("begin");
    await db.query(
      "select pg_advisory_xact_lock(hashtext('mizflow-demo-seed'))",
    );
    await assertDemoTargets(db, cafes);
    try {
      await insertCafeData(db, cafe, index, users);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      await db.end().catch(() => {});
      db = undefined;
    }
  }
  console.log(
    "Demo records ensured for two cafes and six development accounts. Existing passwords, revocations and business data were preserved.",
  );
} catch {
  // Do not log connection strings, Auth responses or database error details.
  console.error(
    JSON.stringify({
      event: "demo_seed_failed",
      phase,
      message:
        "Check local services, migrations and development-only configuration; rerunning is safe.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
}
