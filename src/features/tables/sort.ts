const digits = (value: string) =>
  value
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const collator = new Intl.Collator("fa", {
  numeric: true,
  sensitivity: "base",
});
export function compareTableLabels(a: string, b: string) {
  return collator.compare(digits(a), digits(b));
}

export function tableDisplayName(label: string) {
  return /^[۰-۹٠-٩0-9]+$/.test(label.trim()) ? `میز ${label}` : label;
}
