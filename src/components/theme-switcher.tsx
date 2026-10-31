"use client";
import { useSyncExternalStore } from "react";
type Theme = "dark" | "light" | "system";
function readTheme(): Theme {
  try {
    const value = localStorage.getItem("mizflow-theme");
    return value === "light" || value === "system" ? value : "dark";
  } catch {
    return "dark";
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("mizflow-theme", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mizflow-theme", callback);
  };
}
export function ThemeSwitcher() {
  const theme = useSyncExternalStore(
    subscribe,
    readTheme,
    () => "dark" as Theme,
  );
  return (
    <label className="theme-control">
      ظاهر{" "}
      <select
        aria-label="انتخاب تم"
        value={theme}
        onChange={(event) => {
          const value = event.target.value as Theme;
          try {
            localStorage.setItem("mizflow-theme", value);
          } catch {}
          document.documentElement.dataset.theme =
            value === "system"
              ? matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
              : value;
          window.dispatchEvent(new Event("mizflow-theme"));
        }}
      >
        <option value="dark">تاریک</option>
        <option value="light">روشن</option>
        <option value="system">هماهنگ با سیستم</option>
      </select>
    </label>
  );
}
