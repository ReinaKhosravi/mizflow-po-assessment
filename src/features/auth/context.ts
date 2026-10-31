import "server-only";
import { cookies } from "next/headers";
import { resolvePanelRole, panelCookie } from "./panel";
import { cache } from "react";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readSupabaseConfig } from "@/lib/supabase/config";
import { logSecurityEvent } from "@/lib/logger";
import { membershipSchema } from "./permissions";

export class AuthContextError extends Error {
  constructor(
    public code:
      "configuration" | "unauthenticated" | "forbidden" | "unavailable",
  ) {
    super(code);
  }
}
function deny(code: AuthContextError["code"]): never {
  throw new AuthContextError(code);
}
// React cache deduplicates only within a server render, never across users/requests.
export const readContext = cache(async () => {
  if (!readSupabaseConfig()) deny("configuration");
  const supabase = await createSupabaseServerClient();
  const result = await supabase.auth.getUser().catch(() => null);
  if (!result) {
    logSecurityEvent("auth_unavailable");
    deny("unavailable");
  }
  if (result.error || !result.data.user) deny("unauthenticated");
  const user = result.data.user;
  const { data, error } = await supabase
    .from("restaurant_memberships")
    .select("id, restaurant_id, user_id, branch_id, role, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at")
    .order("id")
    .limit(1)
    .maybeSingle();
  if (error) {
    logSecurityEvent("database_unavailable");
    deny("unavailable");
  }
  const parsed = membershipSchema.safeParse(data);
  if (!parsed.success || parsed.data.user_id !== user.id) {
    logSecurityEvent("membership_denied");
    deny("forbidden");
  }
  const membership = parsed.data;
  const restaurant = await supabase
    .from("restaurants")
    .select("name")
    .eq("id", membership.restaurant_id)
    .single();
  const restaurantName = z
    .object({ name: z.string().min(1) })
    .safeParse(restaurant.data);
  if (restaurant.error || !restaurantName.success) {
    logSecurityEvent("database_unavailable");
    deny("unavailable");
  }
  let branchName = "همه شعبه‌ها";
  if (membership.branch_id) {
    const branch = await supabase
      .from("branches")
      .select("name")
      .eq("restaurant_id", membership.restaurant_id)
      .eq("id", membership.branch_id)
      .single();
    const parsedBranch = z
      .object({ name: z.string().min(1) })
      .safeParse(branch.data);
    if (branch.error || !parsedBranch.success) {
      logSecurityEvent("membership_denied");
      deny("forbidden");
    }
    branchName = parsedBranch.data.name;
  }
  return {
    supabase,
    user,
    membership,
    panelRole: resolvePanelRole(
      membership.role,
      (await cookies()).get(panelCookie)?.value,
    ),
    restaurantName: restaurantName.data.name,
    branchName,
  };
});

export async function requireContext() {
  try {
    return await readContext();
  } catch (error) {
    if (!(error instanceof AuthContextError)) throw error;
    if (error.code === "configuration") redirect("/setup");
    if (error.code === "unauthenticated") redirect("/login");
    if (error.code === "unavailable") redirect("/access-denied?error=database");
    redirect("/access-denied");
  }
}
