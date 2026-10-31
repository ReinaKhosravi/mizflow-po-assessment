import { describe, expect, it } from "vitest";
import { formatToman, irrSchema } from "./money";
describe("IRR money boundary", () => {
  it("converts IRR to Persian toman explicitly", () => {
    expect(formatToman(1250000)).toBe("۱۲۵٬۰۰۰ تومان");
    expect(formatToman(0)).toBe("۰ تومان");
    expect(formatToman(15)).toBe("۱٫۵ تومان");
  });
  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid monetary value %s",
    (value) => {
      expect(irrSchema.safeParse(value).success).toBe(false);
      expect(() => formatToman(value)).toThrow();
    },
  );
});
