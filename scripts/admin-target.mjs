import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";
export const PROJECT_REF = "qfyiyqjogfagevxzdgol";
export const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const loopback = (host) => ["localhost", "127.0.0.1", "[::1]"].includes(host);
export function parseAdminUrl(value) {
  try {
    return new URL(value || "");
  } catch {
    throw new Error(
      "Missing or invalid administrative URL; configure the ignored local environment file.",
    );
  }
}
export function verifyTarget(apiValue, dbValue, hostedOptIn) {
  const api = parseAdminUrl(apiValue),
    db = parseAdminUrl(dbValue);
  if (
    !["http:", "https:"].includes(api.protocol) ||
    api.username ||
    api.password ||
    api.search ||
    api.hash
  )
    throw new Error("Invalid Supabase API URL.");
  if (!["postgres:", "postgresql:"].includes(db.protocol))
    throw new Error("A PostgreSQL URL is required.");
  if (loopback(api.hostname) && loopback(db.hostname))
    return { api, db, hosted: false };
  if (
    api.origin !== PROJECT_URL ||
    api.pathname !== "/" ||
    api.username ||
    api.password ||
    hostedOptIn !== PROJECT_REF
  )
    throw new Error(
      "Only loopback or the explicitly confirmed development project is allowed.",
    );
  if (db.port && db.port !== "5432")
    throw new Error(
      "Use the direct or session pooler connection on port 5432, not transaction pooling.",
    );
  const direct =
    db.hostname === `db.${PROJECT_REF}.supabase.co` &&
    db.username === "postgres";
  const pooler =
    db.hostname.endsWith(".pooler.supabase.com") &&
    db.username === `postgres.${PROJECT_REF}`;
  if (!direct && !pooler)
    throw new Error(
      "Database endpoint/username does not match the confirmed project.",
    );
  return { api, db, hosted: true };
}
export function databaseOptions(
  target,
  caFile = process.env.MIZFLOW_DB_CA_FILE,
) {
  // Do not allow sslmode in a copied URL to override certificate verification.
  const url = new URL(target.db);
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  let ca;
  if (target.hosted && caFile) {
    try {
      const certificate = new X509Certificate(readFileSync(caFile));
      if (!certificate.ca) throw new Error("Not a CA certificate");
      ca = certificate.toString();
    } catch {
      throw new Error(
        "Cannot load a valid Supabase root CA certificate; check MIZFLOW_DB_CA_FILE.",
      );
    }
  }
  return {
    connectionString: url.toString(),
    ...(target.hosted
      ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } }
      : {}),
    connectionTimeoutMillis: 10000,
  };
}
export async function verifyMigration(db) {
  const schema = await db.query(
    "select count(*)::int as n from information_schema.tables where table_schema='public' and table_name=any($1)",
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
  if (schema.rows[0].n !== 8)
    throw new Error("The eight-table migration is missing or incomplete.");
}
export async function assertDemoTargets(db, cafes) {
  for (const cafe of cafes) {
    const rows = await db.query(
      "select id,slug from public.restaurants where id=$1 or slug=$2",
      [cafe.id, cafe.slug],
    );
    if (rows.rows.some((row) => row.id !== cafe.id || row.slug !== cafe.slug))
      throw new Error("Demo identity collision: no data was overwritten.");
    if (rows.rows.length) {
      const marked = await db.query(
        "select exists(select 1 from public.restaurant_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=$1 and u.raw_app_meta_data->>'mizflow_demo'='true') as present",
        [cafe.id],
      );
      if (!marked.rows[0].present)
        throw new Error(
          "Existing restaurant is not marked by demo membership; seeding stopped.",
        );
    }
    const nonDemoMembers = await db.query(
      "select exists(select 1 from public.restaurant_memberships m join auth.users u on u.id=m.user_id where m.restaurant_id=$1 and coalesce((u.raw_app_meta_data->>'mizflow_demo')::boolean,false)=false) as present",
      [cafe.id],
    );
    if (nonDemoMembers.rows[0].present)
      throw new Error("Refusing to seed a restaurant with non-demo users.");
    const branch = await db.query(
      "select restaurant_id from public.branches where id=$1",
      [cafe.branch],
    );
    if (branch.rows.some((row) => row.restaurant_id !== cafe.id))
      throw new Error("Demo branch collision: no data was overwritten.");
  }
}
