import { describe, it, expect } from "vitest";
import {
  addInputSchema,
  advanceInputSchema,
  orderTotal,
  mutationError,
} from "./workflow-model";
const id = "10000000-0000-4000-8000-000000000001";
describe("workflow request boundaries", () => {
  it("rejects trusted prices, roles and restaurant IDs in input", () => {
    const v = {
      orderId: id,
      key: id,
      items: [{ menu_item_id: id, quantity: 1, notes: "" }],
    };
    expect(addInputSchema.safeParse(v).success).toBe(true);
    expect(addInputSchema.safeParse({ ...v, restaurant_id: id }).success).toBe(
      false,
    );
    expect(
      addInputSchema.safeParse({
        ...v,
        items: [{ ...v.items[0], price_irr: 1 }],
      }).success,
    ).toBe(false);
    expect(
      advanceInputSchema.safeParse({
        itemId: id,
        key: id,
        expectedVersion: 1,
        nextStatus: "served",
      }).success,
    ).toBe(false);
  });
  it("calculates integer snapshot totals and rejects unsafe totals", () => {
    expect(
      orderTotal([
        { unit_price_irr: 1250000, quantity: 2, status: "ready" },
        { unit_price_irr: 1, quantity: 2, status: "cancelled" },
      ]),
    ).toBe(2500000);
    expect(() =>
      orderTotal([
        {
          unit_price_irr: Number.MAX_SAFE_INTEGER,
          quantity: 2,
          status: "queued",
        },
      ]),
    ).toThrow();
  });
  it("classifies conflicts as definite, transport failures as replayable", () => {
    expect(mutationError("PT409").code).toBe("conflict");
    expect(mutationError("PT409").retryable).toBe(false);
    expect(mutationError("40001").retryable).toBe(false);
    expect(mutationError().retryable).toBe(true);
    expect(mutationError("42501").code).toBe("forbidden");
  });
});
