import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "میزفلو | مدیریت کافه", template: "%s | میزفلو" },
  description: "از میز تا آشپزخانه، با خیال راحت — پیش‌نمایش میزفلو",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fa" dir="rtl"><body><AppShell>{children}</AppShell></body></html>;
}
