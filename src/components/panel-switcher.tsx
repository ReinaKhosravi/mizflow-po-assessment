"use client";
import { useState, useTransition } from "react";
import { switchPanel } from "@/features/auth/panel-actions";
import type { StaffRole } from "@/features/auth/permissions";
export function PanelSwitcher({
  role,
  onSelected,
}: {
  role: StaffRole;
  onSelected?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="panel-switcher">
      <label>
        پنل کاری
        <select
          aria-label="انتخاب پنل کاری"
          value={role}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as StaffRole;
            startTransition(async () => {
              setError("");
              try {
                const r = await switchPanel(next);
                if (!r.ok) {
                  setError("تغییر پنل مجاز نیست.");
                  return;
                }
                onSelected?.();
                window.location.assign(
                  next === "kitchen"
                    ? "/kitchen"
                    : next === "waiter"
                      ? "/tables"
                      : "/",
                );
              } catch {
                setError("تغییر پنل انجام نشد؛ دوباره تلاش کنید.");
              }
            });
          }}
        >
          <option value="owner">پنل مدیر · همه بخش‌ها</option>
          <option value="waiter">پنل گارسون · ثبت سفارش</option>
          <option value="kitchen">پنل آشپزخانه · آماده‌سازی</option>
        </select>
      </label>
      <small>
        {pending ? "در حال تغییر پنل…" : "دسترسی شما: مدیر رستوران"}
      </small>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
