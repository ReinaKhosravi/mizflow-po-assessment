import { expect, it } from "vitest";
import { menuItemIcon } from "./item-icon";
it("uses food-specific icons and distinguishes cold coffee from hot drinks", () => {
  for (const [name, category, icon] of [
    ["برگر مخصوص", "غذای گرم", "🍔"],
    ["پیتزا مارگاریتا", "غذا", "🍕"],
    ["کیک هویج", "کیک و دسر", "🍰"],
    ["سالاد سزار", "غذا", "🥗"],
    ["چای ایرانی", "چای و دمنوش", "🍵"],
    ["آیس‌لاته", "قهوه", "🥤"],
    ["لاته", "قهوه گرم", "☕"],
    ["پنینی مرغ", "غذا", "🥪"],
    ["ناشناخته", "غذا", "🍽️"],
  ])
    expect(menuItemIcon(name, category)).toBe(icon);
});
