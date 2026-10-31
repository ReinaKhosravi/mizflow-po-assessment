import { describe, expect, it } from "vitest";
import { kitchenColumns, itemReadSchema, type KitchenItem } from "./read-model";
const base: KitchenItem = {
  id: "10000000-0000-4000-8000-000000000001",
  order_id: "10000000-0000-4000-8000-000000000002",
  branch_id: "10000000-0000-4000-8000-000000000003",
  name_snapshot: "لاته",
  quantity: 2,
  unit_price_irr: 1250000,
  status: "queued",
  notes: "بدون شکر",
  created_at: "2026-11-01T07:00:00Z",
  orders: { status: "submitted", branches: { name: "ولیعصر" } },
};
describe("read-only kitchen projection", () => {
  it("counts only displayed preparation states, without treating served/cancelled as active", () => {
    const states: KitchenItem["status"][] = [
      "queued",
      "preparing",
      "ready",
      "served",
      "cancelled",
    ];
    const columns = kitchenColumns(
      states.map((status) => ({ ...base, status })),
    );
    expect(columns.map((c) => c.items.length)).toEqual([1, 1, 1]);
    expect(kitchenColumns([]).map((c) => c.items.length)).toEqual([0, 0, 0]);
  });
  it("rejects invalid persisted state and money instead of silently substituting a fixture", () => {
    expect(
      itemReadSchema.safeParse({ ...base, status: "unknown" }).success,
    ).toBe(false);
    expect(
      itemReadSchema.safeParse({ ...base, unit_price_irr: -1 }).success,
    ).toBe(false);
    expect(itemReadSchema.safeParse({ ...base, quantity: 0 }).success).toBe(
      false,
    );
  });
});
