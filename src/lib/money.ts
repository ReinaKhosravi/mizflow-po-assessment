import { z } from "zod";

/** All stored monetary values are non-negative integer IRR. */
export const irrSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);

/** 10 IRR = 1 toman; preserve sub-toman amounts instead of silently rounding. */
export function formatToman(irr: number): string {
  const valid = irrSchema.parse(irr);
  return `${new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(valid / 10)} تومان`;
}
