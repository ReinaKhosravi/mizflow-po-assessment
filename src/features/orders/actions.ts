"use server";
import { z } from "zod";
import { requireContext } from "@/features/auth/context";
import {
  addInputSchema,
  advanceInputSchema,
  openInputSchema,
  mutationError,
  serviceInputSchema,
  type MutationResult,
} from "./workflow-model";
import { logSecurityEvent } from "@/lib/logger";
const resultSchema = z.object({ order_id: z.uuid() });
export async function openOrder(input: unknown): Promise<MutationResult> {
  const parsed = openInputSchema.safeParse(input);
  if (!parsed.success) return mutationError("22023");
  const { supabase, membership } = await requireContext();
  if (membership.role !== "waiter" && membership.role !== "owner")
    return mutationError("42501");
  try {
    const { data, error } = await supabase.rpc("open_table_order", {
      p_table_id: parsed.data.tableId,
      p_key: parsed.data.key,
    });
    if (error) return mutationError(error.code, error.message);
    const result = resultSchema.safeParse(data);
    if (!result.success) return mutationError();
    return { ok: true, orderId: result.data.order_id };
  } catch {
    logSecurityEvent("database_unavailable");
    return mutationError();
  }
}
export async function submitItems(input: unknown): Promise<MutationResult> {
  const parsed = addInputSchema.safeParse(input);
  if (!parsed.success) return mutationError("22023");
  const { supabase, membership } = await requireContext();
  if (membership.role !== "waiter" && membership.role !== "owner")
    return mutationError("42501");
  try {
    const { data, error } = await supabase.rpc("add_order_items", {
      p_order_id: parsed.data.orderId,
      p_items: parsed.data.items,
      p_key: parsed.data.key,
    });
    if (error) return mutationError(error.code, error.message);
    const result = resultSchema.safeParse(data);
    if (!result.success) return mutationError();
    return { ok: true, orderId: result.data.order_id };
  } catch {
    logSecurityEvent("database_unavailable");
    return mutationError();
  }
}
export async function advanceItem(input: unknown): Promise<MutationResult> {
  const parsed = advanceInputSchema.safeParse(input);
  if (!parsed.success) return mutationError("22023");
  const { supabase, membership } = await requireContext();
  if (membership.role !== "kitchen" && membership.role !== "owner")
    return mutationError("42501");
  try {
    const { data, error } = await supabase.rpc("advance_order_item", {
      p_item_id: parsed.data.itemId,
      p_expected_version: parsed.data.expectedVersion,
      p_next_status: parsed.data.nextStatus,
      p_key: parsed.data.key,
    });
    if (error) return mutationError(error.code, error.message);
    const result = resultSchema.safeParse(data);
    if (!result.success) return mutationError();
    return { ok: true, orderId: result.data.order_id };
  } catch {
    logSecurityEvent("database_unavailable");
    return mutationError();
  }
}

async function serviceCommand(
  input: unknown,
  command: "serve_order_item" | "close_table_service",
): Promise<MutationResult> {
  const parsed = serviceInputSchema.safeParse(input);
  if (!parsed.success) return mutationError("22023");
  const { supabase, membership } = await requireContext();
  if (membership.role !== "waiter" && membership.role !== "owner")
    return mutationError("42501");
  try {
    const { data, error } = await supabase.rpc(command, {
      [command === "serve_order_item" ? "p_item_id" : "p_order_id"]:
        parsed.data.targetId,
      p_expected_version: parsed.data.expectedVersion,
      p_key: parsed.data.key,
    });
    if (error) return mutationError(error.code, error.message);
    const result = resultSchema.safeParse(data);
    if (!result.success) return mutationError();
    return { ok: true, orderId: result.data.order_id };
  } catch {
    logSecurityEvent("database_unavailable");
    return mutationError();
  }
}
export async function serveItem(input: unknown) {
  return serviceCommand(input, "serve_order_item");
}
export async function closeTable(input: unknown) {
  return serviceCommand(input, "close_table_service");
}
