"use client";

import { PanelSwitcher } from "./panel-switcher";
import Link from "next/link";
import { logout } from "@/features/auth/actions";
import type { StaffRole } from "@/features/auth/permissions";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navigation = [
  { href: "/", title: "پیشخوان", icon: "◫" },
  { href: "/tables", title: "میزها", icon: "▦" },
  { href: "/kitchen", title: "آشپزخانه", icon: "♨" },
  { href: "/menu", title: "منوی کافه", icon: "☷" },
];
export function AppShell({
  children,
  restaurantName,
  branchName,
  role,
  canSwitchPanel = false,
}: {
  children: React.ReactNode;
  restaurantName: string;
  branchName: string;
  role: StaffRole;
  canSwitchPanel?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <a className="skip-link" href="#main">
        رفتن به محتوای اصلی
      </a>
      <header className="mobile-header">
        <Link href="/" className="brand">
          میزفلو<span>MizFlow</span>
        </Link>
        <button
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(!open)}
        >
          {open ? "بستن منو ×" : "فهرست ☰"}
        </button>
      </header>
      <aside className={`sidebar ${open ? "is-open" : ""}`} id="sidebar">
        <Link href="/" className="brand" onClick={() => setOpen(false)}>
          <i aria-hidden="true">م</i>
          <div>
            میزفلو<span>MIZFLOW</span>
          </div>
        </Link>
        <div className="venue">
          <span className="eyebrow">رستوران شما</span>
          <strong>{restaurantName}</strong>
          <small>{branchName}</small>
        </div>
        {canSwitchPanel && (
          <PanelSwitcher role={role} onSelected={() => setOpen(false)} />
        )}
        {role !== "kitchen" && (
          <Link
            className="button order-entry"
            href="/tables"
            onClick={() => setOpen(false)}
          >
            ＋ ثبت سفارش
          </Link>
        )}
        <p className="nav-caption">فضای کار کافه</p>
        <nav aria-label="ناوبری اصلی">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname === item.href ? "page" : undefined}
              className={pathname === item.href ? "active" : ""}
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.title}
              <b aria-hidden="true">‹</b>
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span aria-hidden="true">✧</span>
          <strong>یک جریان، از میز تا آشپزخانه</strong>
          <p>تمرکز روی مهمان‌ها؛ نظم سفارش‌ها با میزفلو.</p>
        </div>
        <div className="sidebar-footer">
          <span className="avatar">م</span>
          <div>
            <strong>
              {
                {
                  owner: "مدیر رستوران",
                  waiter: "پیشخدمت",
                  kitchen: "آشپزخانه",
                }[role]
              }
            </strong>
            <form action={logout}>
              <button type="submit" className="logout-button">
                خروج از حساب
              </button>
            </form>
          </div>
          <span className="dot" />
        </div>
        <form action={logout} className="mobile-logout">
          <button type="submit" className="logout-button">
            خروج از حساب
          </button>
        </form>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <span>
            فضای کار <span className="separator">/</span>{" "}
            {navigation.find((item) => item.href === pathname)?.title ??
              "میزفلو"}
          </span>
          <span className="preview-pill">
            <span className="dot" /> فضای کار رستوران
          </span>
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="footer">
          <span>میزفلو؛ همراه روزهای شلوغ کافه</span>
          <span>نسخه ۰.۴ · سفارش تا آشپزخانه</span>
        </footer>
      </div>
    </>
  );
}
