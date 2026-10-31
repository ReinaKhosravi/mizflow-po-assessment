import { readFile } from "node:fs/promises";
import pg from "pg";
import {
  verifyTarget,
  databaseOptions,
  PROJECT_URL,
  PROJECT_REF,
} from "./admin-target.mjs";
const versions = {
  202611010004: {
    name: "table_service",
    previous: ["202610310001", "202611010001", "202611010002", "202611010003"],
  },
  202611010003: {
    name: "owner_ordering",
    previous: ["202610310001", "202611010001", "202611010002"],
  },
  202611010001: { name: "order_workflow", previous: ["202610310001"] },
  202611010002: {
    name: "domain_conflicts",
    previous: ["202610310001", "202611010001"],
  },
};
const version = process.env.MIZFLOW_APPLY_REVIEWED_MIGRATION;
const migration = versions[version];
let db;
try {
  const target = verifyTarget(
    PROJECT_URL,
    process.env.MIZFLOW_ADMIN_DATABASE_URL,
    process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
  );
  if (
    !migration ||
    !target.hosted ||
    process.env.MIZFLOW_APPLY_REVIEWED_MIGRATION !== version
  )
    throw new Error("Explicit version required");
  const source = await readFile(
    `supabase/migrations/${version}_${migration.name}.sql`,
    "utf8",
  );
  if (!source.startsWith("begin;") || !/commit;\s*$/.test(source))
    throw new Error("Unexpected transaction boundary");
  db = new pg.Client({ ...databaseOptions(target), query_timeout: 30000 });
  db.on("error", () => {});
  await db.connect();
  await db.query("begin");
  await db.query("set local lock_timeout='10s'");
  await db.query("set local statement_timeout='25s'");
  await db.query(
    "select pg_advisory_xact_lock(hashtext('mizflow-schema-migration'))",
  );
  const history = await db.query(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  if (history.rows.some((r) => r.version === version)) {
    await db.query("rollback");
    console.log(JSON.stringify({ version, alreadyApplied: true }));
  } else {
    if (
      JSON.stringify(history.rows.map((r) => r.version)) !==
      JSON.stringify(migration.previous)
    )
      throw new Error("Unexpected migration state");
    await db.query(source.replace(/^begin;/, "").replace(/commit;\s*$/, ""));
    await db.query(
      "insert into supabase_migrations.schema_migrations(version,name,statements) values($1,$2,$3)",
      [version, migration.name, [source]],
    );
    await db.query("commit");
    console.log(
      JSON.stringify({ project: PROJECT_REF, version, applied: true }),
    );
  }
} catch {
  if (db) await db.query("rollback").catch(() => {});
  console.error(
    JSON.stringify({
      event: "workflow_migration_stopped",
      message:
        "Target/history/schema verification or migration failed; transaction rolled back.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (db) await db.end().catch(() => {});
}
