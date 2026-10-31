"use client";

export function ConnectionState({
  state,
}: {
  state: "connecting" | "online" | "error" | "unauthorized";
}) {
  return (
    <p className={`connection-state ${state}`} role="status" aria-live="polite">
      {state === "online"
        ? "● متصل · تازه‌سازی خودکار هر ۴ ثانیه"
        : state === "connecting"
          ? "در حال بررسی اتصال…"
          : state === "unauthorized"
            ? "دسترسی یا نشست تغییر کرده است؛ دوباره وارد شوید."
            : "ارتباط قطع است؛ اطلاعات نمایش‌داده‌شده ممکن است قدیمی باشد. تلاش دوباره خودکار است."}
    </p>
  );
}
