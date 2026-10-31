import { readFile } from "node:fs/promises";
import pg from "pg";
import {
  verifyTarget,
  databaseOptions,
  PROJECT_URL,
  PROJECT_REF,
} from "./admin-target.mjs";
const version = "202610310001";
const names = [
  "restaurants",
  "branches",
  "restaurant_memberships",
  "dining_tables",
  "menu_items",
  "orders",
  "order_items",
  "order_events",
];
let db;
try {
  const target = verifyTarget(
    PROJECT_URL,
    process.env.MIZFLOW_ADMIN_DATABASE_URL,
    process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  if (
    !target.hosted ||
    process.env.MIZFLOW_APPLY_REVIEWED_MIGRATION !== version
  )
    throw new Error("Explicit reviewed migration version required");
  const source = await readFile(
    `supabase/migrations/${version}_tenant_foundation.sql`,
    "utf8",
  );
  if (!/^begin;$/m.test(source) || !/\ncommit;\s*$/.test(source))
    throw new Error("Unexpected migration transaction boundaries");
  const sql = source.replace(/^begin;$/m, "").replace(/\ncommit;\s*$/, "");
  db = new pg.Client(databaseOptions(target));
  await db.connect();
  await db.query("begin");
  await db.query(
    "select pg_advisory_xact_lock(hashtext('mizflow-schema-migration'))",
  );
  const exists = await db.query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
  );
  if (exists.rows[0].present) {
    const history = await db.query(
      "select version from supabase_migrations.schema_migrations order by version",
    );
    if (history.rows.length)
      throw new Error(
        "Migration history is not empty; inspect before proceeding",
      );
  }
  const objects = await db.query(
    "select (select count(*)::int from pg_tables where schemaname='public') as tables, (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private') as functions",
  );
  if (objects.rows[0].tables || objects.rows[0].functions)
    throw new Error("Existing application objects require reconciliation");
  // Execute the unchanged reviewed source within our transaction so schema and history commit together.
  await db.query(sql);
  const verify = await db.query(
    "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any($1)",
    [names],
  );
  if (verify.rows.length !== 8 || !verify.rows.every((r) => r.relrowsecurity))
    throw new Error("Migration verification failed");
  if (!exists.rows[0].present) {
    await db.query("create schema if not exists supabase_migrations");
    await db.query(
      "create table supabase_migrations.schema_migrations (version text primary key, statements text[], name text)",
    );
    await db.query(
      "revoke all on schema supabase_migrations from public, anon, authenticated",
    );
    await db.query(
      "revoke all on supabase_migrations.schema_migrations from public, anon, authenticated",
    );
  }
  await db.query(
    "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
    [version, "tenant_foundation", [source]],
  );
  await db.query("notify pgrst, 'reload schema'");
  await db.query("commit");
  console.log(
    JSON.stringify({
      project: PROJECT_REF,
      migration: version,
      applied: true,
      tenantTables: 8,
      allRlsEnabled: true,
    }),
  );
} catch {
  if (db) await db.query("rollback").catch(() => {});
  console.error(
    JSON.stringify({
      event: "cloud_migration_stopped",
      message:
        "Preconditions or migration failed; transaction rolled back. No credentials or raw SQL errors are logged.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
