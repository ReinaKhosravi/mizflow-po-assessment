// Public display fixtures only. Never treat these as persisted restaurant data.
export const sampleMenu = [
  {
    name: "اسپرسو دبل",
    category: "قهوه گرم",
    description: "عصاره‌گیری دو شات، ترکیب عربیکا و روبوستا",
    priceIrr: 850000,
    symbol: "☕",
  },
  {
    name: "لاته",
    category: "قهوه گرم",
    description: "اسپرسو دبل با شیر بخارداده‌شده",
    priceIrr: 1250000,
    symbol: "☕",
  },
  {
    name: "چای ایرانی",
    category: "چای و دمنوش",
    description: "چای دم‌کشیده لاهیجان همراه نبات",
    priceIrr: 650000,
    symbol: "♨",
  },
  {
    name: "کیک هویج و گردو",
    category: "کیک و دسر",
    description: "یک برش کیک روز با کرم پنیر",
    priceIrr: 1450000,
    symbol: "◇",
  },
  {
    name: "لیموناد تازه",
    category: "نوشیدنی سرد",
    description: "لیموترش تازه، نعناع و آب گازدار",
    priceIrr: 1100000,
    symbol: "◉",
  },
  {
    name: "پنینی مرغ",
    category: "غذای سبک",
    description: "مرغ گریل، پنیر و سس مخصوص کافه",
    priceIrr: 2450000,
    symbol: "▱",
  },
] as const;
