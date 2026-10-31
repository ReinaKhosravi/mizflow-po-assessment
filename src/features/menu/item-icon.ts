/** Presentation only: persisted name/category determine a semantic food icon. */
export function menuItemIcon(name: string, category: string): string {
  const value = `${name} ${category}`
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .toLowerCase();
  if (/سالاد|salad/.test(value)) return "🥗";
  if (/پیتزا|pizza/.test(value)) return "🍕";
  if (/برگر|burger/.test(value)) return "🍔";
  if (/پنینی|ساندویچ|sandwich|panini/.test(value)) return "🥪";
  if (/کیک|cake/.test(value)) return "🍰";
  if (/بستنی|ice cream/.test(value)) return "🍨";
  if (/دسر|شیرینی|dessert/.test(value)) return "🍮";
  if (/آیس|سرد|لیموناد|آبمیوه|اسموتی|cold|juice/.test(value)) return "🥤";
  if (/چای|دمنوش|tea/.test(value)) return "🍵";
  if (/قهوه|اسپرسو|لاته|کاپوچینو|آمریکانو|موکا|coffee/.test(value)) return "☕";
  if (/صبحانه|تخم|breakfast/.test(value)) return "🍳";
  if (/سوپ|soup/.test(value)) return "🍲";
  return "🍽️";
}
