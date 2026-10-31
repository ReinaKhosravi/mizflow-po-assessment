// Explicit development-only hall normalization; no deletion of orders or audit history.
import pg from "pg";
import {
  verifyTarget,
  databaseOptions,
  PROJECT_URL,
  assertDemoTargets,
} from "./admin-target.mjs";
import { cafes, fixtureId } from "./demo-fixtures.mjs";
import { markTestOrder, cancelTestOrders } from "./workflow-test-support.mjs";
if (process.env.MIZFLOW_DEMO_SEED !== "development-only")
  throw new Error("Development-only authorization required");
const db = new pg.Client(
  databaseOptions(
    verifyTarget(
      PROJECT_URL,
      process.env.MIZFLOW_ADMIN_DATABASE_URL,
      process.env.MIZFLOW_CONFIRMED_PROJECT_REF,
    ),
  ),
);
db.on("error", () => {});
await db.connect();
try {
  await assertDemoTargets(db, cafes);
  const cafe = cafes[0];
  const canonical = Array.from({ length: 12 }, (_, i) =>
    fixtureId(0, 2, i + 1),
  );
  const rows = (
    await db.query(
      "select id,label,is_active from public.dining_tables where restaurant_id=$1 and branch_id=$2 order by created_at,id",
      [cafe.id, cafe.branch],
    )
  ).rows;
  if (!canonical.every((id) => rows.some((t) => t.id === id)))
    throw new Error("Expected twelve physical demo tables");
  const extras = rows.filter((t) => !canonical.includes(t.id));
  if (
    extras.some(
      (t) =>
        !t.label.startsWith("آزمون ") &&
        !/^میز (۱۳|۱۴)$/.test(t.label) &&
        !(t.is_active === false && /^[۰-۹0-9]+$/.test(t.label)),
    )
  )
    throw new Error("Unrecognized extra table; refusing normalization");
  const owner = (
    await db.query(
      "select user_id from public.restaurant_memberships where restaurant_id=$1 and role='owner'",
      [cafe.id],
    )
  ).rows[0].user_id;
  for (const table of extras) {
    const orders = await db.query(
      "select id from public.orders where table_id=$1 and status not in ('closed','cancelled')",
      [table.id],
    );
    for (const order of orders.rows)
      await markTestOrder(db, order.id, cafe.id, table.id);
    await cancelTestOrders(
      db,
      orders.rows.map((r) => r.id),
      cafe.id,
      owner,
    );
  }
  await db.query("begin");
  await db.query(
    "select id from public.dining_tables where restaurant_id=$1 and branch_id=$2 for update",
    [cafe.id, cafe.branch],
  );
  for (const row of rows)
    await db.query("update public.dining_tables set label=$1 where id=$2", [
      `renumber-${row.id}`,
      row.id,
    ]);
  for (let i = 0; i < canonical.length; i++)
    await db.query(
      "update public.dining_tables set label=$1,is_active=true,seats=$2 where id=$3",
      [
        new Intl.NumberFormat("fa-IR").format(i + 1),
        i < 8 ? 4 : 2,
        canonical[i],
      ],
    );
  for (let i = 0; i < extras.length; i++)
    await db.query(
      "update public.dining_tables set label=$1,is_active=false where id=$2",
      [new Intl.NumberFormat("fa-IR").format(i + 13), extras[i].id],
    );
  await db.query("commit");
  const result = await db.query(
    "select label,seats from public.dining_tables where restaurant_id=$1 and branch_id=$2 and is_active order by length(label),label",
    [cafe.id, cafe.branch],
  );
  console.log(
    JSON.stringify({
      activeTables: result.rowCount,
      labels: result.rows.map((t) => t.label),
      twoSeatTables: result.rows.filter((t) => t.seats === 2).length,
      fourSeatTables: result.rows.filter((t) => t.seats === 4).length,
      historyPreserved: true,
    }),
  );
} catch {
  await db.query("rollback").catch(() => {});
  console.error(
    "Demo hall normalization stopped; review target and extra tables.",
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
