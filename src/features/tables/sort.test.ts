import { expect, it } from "vitest";
import { compareTableLabels } from "./sort";
it("sorts Persian and Latin table numbers naturally", () => {
  expect(
    ["میز ۱۰", "میز ۲", "میز ۱", "میز ۱۴", "میز ۳"].sort(compareTableLabels),
  ).toEqual(["میز ۱", "میز ۲", "میز ۳", "میز ۱۰", "میز ۱۴"]);
  expect(compareTableLabels("میز 2", "میز ۱۰")).toBeLessThan(0);
});
