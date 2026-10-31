import type { Metadata } from "next";
import "@fontsource/vazirmatn/400.css";
import "@fontsource/vazirmatn/500.css";
import "@fontsource/vazirmatn/700.css";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { themeBootstrap } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "میزفلو | مدیریت کافه", template: "%s | میزفلو" },
  icons: { icon: "/mark.svg" },
  description: "از میز تا آشپزخانه، با خیال راحت — پیش‌نمایش میزفلو",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <div className="global-theme">
          <ThemeSwitcher />
        </div>
        {children}
      </body>
    </html>
  );
}
