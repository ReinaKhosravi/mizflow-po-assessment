import { describe, expect, it } from "vitest";
import { canAccess, membershipSchema, type Membership } from "./permissions";
const restaurant = "10000000-0000-4000-8000-000000000001";
const branch = "11000000-0000-4000-8000-000000000001";
const other = "20000000-0000-4000-8000-000000000001";
const base: Membership = {
  id: restaurant,
  restaurant_id: restaurant,
  user_id: other,
  branch_id: branch,
  role: "waiter",
  revoked_at: null,
};
describe("default-deny permission decisions (not RLS evidence)", () => {
  it("restricts branch staff and owner-only configuration", () => {
    expect(canAccess(base, restaurant, branch, "read")).toBe(true);
    expect(canAccess(base, restaurant, other, "read")).toBe(false);
    expect(canAccess(base, other, branch, "read")).toBe(false);
    expect(canAccess(base, restaurant, branch, "configure")).toBe(false);
    expect(
      canAccess({ ...base, role: "kitchen" }, restaurant, branch, "configure"),
    ).toBe(false);
  });
  it("allows owners across their branches and may take orders, but cannot manage memberships", () => {
    const owner: Membership = { ...base, role: "owner", branch_id: null };
    expect(canAccess(owner, restaurant, other, "configure")).toBe(true);
    expect(canAccess(owner, restaurant, branch, "write_orders")).toBe(true);
    expect(canAccess(owner, other, branch, "write_orders")).toBe(false);
    expect(canAccess(owner, restaurant, branch, "prepare_items")).toBe(true);
    expect(canAccess(owner, restaurant, null, "manage_memberships")).toBe(
      false,
    );
  });
  it("denies revoked memberships regardless of role", () => {
    expect(
      canAccess(
        { ...base, revoked_at: new Date().toISOString() },
        restaurant,
        branch,
        "read",
      ),
    ).toBe(false);
  });
  it("rejects unknown roles and invalid branch assignments at the DB read boundary", () => {
    expect(membershipSchema.safeParse({ ...base, role: "admin" }).success).toBe(
      false,
    );
    expect(membershipSchema.safeParse({ ...base, role: "owner" }).success).toBe(
      false,
    );
    expect(
      membershipSchema.safeParse({ ...base, branch_id: null }).success,
    ).toBe(false);
  });
});
