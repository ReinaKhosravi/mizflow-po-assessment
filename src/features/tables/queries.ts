import "server-only";
import { z } from "zod";
import { requireContext } from "@/features/auth/context";
import { dataUnavailable } from "@/lib/data-error";

export async function readTables() {
  const { supabase, membership } = await requireContext();
  let query = supabase
    .from("dining_tables")
    .select("id, label, seats, is_active, branch_id, branches(name)")
    .eq("restaurant_id", membership.restaurant_id)
    .order("label");
  if (membership.branch_id) query = query.eq("branch_id", membership.branch_id);
  const { data, error } = await query;
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        label: z.string(),
        seats: z.number().int().positive(),
        is_active: z.boolean(),
        branch_id: z.uuid(),
        branches: z.object({ name: z.string() }),
      }),
    )
    .safeParse(data);
  if (error || !parsed.success) {
    dataUnavailable();
  }
  return parsed.data;
}
