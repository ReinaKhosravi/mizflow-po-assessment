import type { StaffRole } from "./permissions";
export const panelCookie = "mizflow-panel";
export function resolvePanelRole(
  role: StaffRole,
  preference?: string,
): StaffRole {
  if (role !== "owner") return role;
  return preference === "waiter" || preference === "kitchen"
    ? preference
    : "owner";
}
