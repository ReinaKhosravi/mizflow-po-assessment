"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireContext } from "./context";
import { roleSchema } from "./permissions";
import { panelCookie } from "./panel";
export async function switchPanel(input: unknown) {
  const { membership } = await requireContext();
  const parsed = roleSchema.safeParse(input);
  if (membership.role !== "owner" || !parsed.success) return { ok: false };
  (await cookies()).set(panelCookie, parsed.data, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  revalidatePath("/", "layout");
  return { ok: true };
}
