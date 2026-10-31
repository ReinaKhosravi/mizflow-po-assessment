import { z } from "zod";
export const roleSchema = z.enum(["owner", "waiter", "kitchen"]);
export type StaffRole = z.infer<typeof roleSchema>;
export const membershipSchema = z
  .object({
    id: z.uuid(),
    restaurant_id: z.uuid(),
    user_id: z.uuid(),
    branch_id: z.uuid().nullable(),
    role: roleSchema,
    revoked_at: z.string().nullable(),
  })
  .refine((m) =>
    m.role === "owner" ? m.branch_id === null : m.branch_id !== null,
  );
export type Membership = z.infer<typeof membershipSchema>;
export type Permission =
  | "read"
  | "configure"
  | "write_orders"
  | "prepare_items"
  | "manage_memberships";
/** Only call with membership read from the DB for the verified user. RLS remains authoritative. */
export function canAccess(
  m: Membership,
  restaurantId: string,
  branchId: string | null,
  permission: Permission,
): boolean {
  if (m.revoked_at !== null || m.restaurant_id !== restaurantId) return false;
  if (branchId !== null && m.role !== "owner" && m.branch_id !== branchId)
    return false;
  if (permission === "read") return true;
  if (permission === "write_orders")
    return m.role === "waiter" || m.role === "owner";
  if (permission === "prepare_items")
    return m.role === "kitchen" || m.role === "owner";
  return permission === "configure" && m.role === "owner";
}
