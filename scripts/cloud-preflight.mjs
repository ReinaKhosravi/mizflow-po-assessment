import pg from "pg";
import {
  verifyTarget,
  databaseOptions,
  PROJECT_URL,
  PROJECT_REF,
} from "./admin-target.mjs";
let db;
try {
  const target = verifyTarget(
    PROJECT_URL,
    process.env.MIZFLOW_ADMIN_DATABASE_URL,
    process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  db = new pg.Client(databaseOptions(target));
  await db.connect();
  await db.query("begin read only");
  const historyExists = await db.query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
  );
  let migrationRecorded = false;
  if (historyExists.rows[0].present)
    migrationRecorded = (
      await db.query(
        "select exists(select 1 from supabase_migrations.schema_migrations where version=$1) as present",
        ["202610310001"],
      )
    ).rows[0].present;
  const tables = await db.query(
    "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname=any($1)",
    [
      [
        "restaurants",
        "branches",
        "restaurant_memberships",
        "dining_tables",
        "menu_items",
        "orders",
        "order_items",
        "order_events",
      ],
    ],
  );
  const existing = await db.query(
    "select (select count(*)::int from pg_tables where schemaname='public') as public_tables, (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private') as private_functions",
  );
  await db.query("rollback");
  console.log(
    JSON.stringify({
      project: PROJECT_REF,
      readOnly: true,
      migrationRecorded,
      tenantTableCount: tables.rows.length,
      allTenantTablesHaveRls:
        tables.rows.length === 8 && tables.rows.every((t) => t.relrowsecurity),
      existingPublicTables: existing.rows[0].public_tables,
      action: migrationRecorded
        ? "Review deployed schema before seeding; do not rerun the initial SQL."
        : existing.rows[0].public_tables || existing.rows[0].private_functions
          ? "STOP: existing schema needs reconciliation; do not apply the initial migration blindly."
          : "Review CLI migration list and dry-run before applying; no changes made.",
    }),
  );
} catch (error) {
  const tlsFailure = [
    "SELF_SIGNED_CERT_IN_CHAIN",
    "DEPTH_ZERO_SELF_SIGNED_CERT",
    "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  ].includes(error.code);
  console.error(
    JSON.stringify({
      event: "cloud_preflight_blocked",
      reason: tlsFailure
        ? "root_certificate_required"
        : error.code === "28P01"
          ? "database_authentication_failed"
          : "configuration_or_connection",
      message: tlsFailure
        ? "Download the official root certificate from Supabase Database Settings and set MIZFLOW_DB_CA_FILE in .env.admin.local. TLS verification remains enabled. No migration was applied."
        : "Configure MIZFLOW_ADMIN_DATABASE_URL and MIZFLOW_CONFIRMED_PROJECT_REF in ignored .env.admin.local; verify connection and permissions. No migration was applied.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end();
}
