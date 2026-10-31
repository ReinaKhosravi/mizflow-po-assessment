// Privileged cleanup is only for already-marked, explicitly tracked demo test orders.
export async function markTestOrder(db, orderId, restaurantId, tableId) {
  const result = await db.query(
    "update public.orders o set demo_scenario='automated-test' where id=$1 and restaurant_id=$2 and table_id=$3 and exists(select 1 from auth.users u where u.id=o.created_by and u.raw_app_meta_data->>'mizflow_demo'='true')",
    [orderId, restaurantId, tableId],
  );
  if (result.rowCount !== 1)
    throw new Error("Refusing to mark a non-demo test order");
}
export async function cancelTestOrders(db, ids, restaurantId, ownerId) {
  for (const id of ids) {
    await db.query("begin");
    try {
      const rows = await db.query(
        "select id,branch_id,version,status from public.orders where id=$1 and restaurant_id=$2 and demo_scenario='automated-test' for update",
        [id, restaurantId],
      );
      if (
        rows.rows[0] &&
        !["closed", "cancelled"].includes(rows.rows[0].status)
      ) {
        const order = rows.rows[0];
        await db.query(
          "update public.order_items set status='cancelled',version=version+1 where order_id=$1 and status<>'cancelled'",
          [id],
        );
        await db.query(
          "update public.orders set status='cancelled',version=version+1 where id=$1",
          [id],
        );
        await db.query(
          "insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details) values($1,$2,$3,$4,'order_cancelled',$5,gen_random_uuid(),'{\"reason\":\"automated_test_cleanup\"}')",
          [restaurantId, order.branch_id, id, ownerId, order.version + 1],
        );
      }
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    }
  }
}

// Live suites run sequentially and borrow a genuinely free demo table. Never add tables to the user's hall.
export async function createTestTable(db, restaurantId, branchId) {
  const result = await db.query(
    "select t.id from public.dining_tables t where t.restaurant_id=$1 and t.branch_id=$2 and t.is_active and not exists(select 1 from public.orders o where o.table_id=t.id and o.status not in ('closed','cancelled')) order by t.created_at,t.id limit 1",
    [restaurantId, branchId],
  );
  if (result.rowCount !== 1)
    throw new Error(
      "No free demo table; test will not overwrite an occupied table",
    );
  return result.rows[0].id;
}
export async function retireTestTable(db, tableId) {
  void db;
  void tableId;
  /* Borrowed physical tables remain active; tracked test orders are closed separately. */
}
