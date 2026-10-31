"use client";
import { tableDisplayName } from "@/features/tables/sort";
import { useRef, useState } from "react";
import type { StaffRole } from "@/features/auth/permissions";
import type { KitchenTicket } from "./workflow-queries";
import { advanceItem } from "./actions";
import { statusLabels } from "./workflow-model";
import { useOperationalPoll } from "./use-operational-poll";
import { ConnectionState } from "./connection-state";
type Attempt = {
  itemId: string;
  expectedVersion: number;
  nextStatus: "preparing" | "ready";
  key: string;
};
export function KitchenBoard({
  initial,
  role,
}: {
  initial: { items: KitchenTicket[]; truncated: boolean };
  role: StaffRole;
}) {
  const { data, state, refresh } = useOperationalPoll(
    initial,
    "/api/operations?view=kitchen",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState<Attempt | null>(null);
  const guard = useRef(false);
  async function change(item?: KitchenTicket) {
    const attempt: Attempt | null =
      retry ??
      (item
        ? {
            itemId: item.id,
            expectedVersion: item.version,
            nextStatus: item.status === "queued" ? "preparing" : "ready",
            key: crypto.randomUUID(),
          }
        : null);
    if (guard.current || !attempt) return;
    guard.current = true;
    setBusy(attempt.itemId);
    setMessage("");
    try {
      const r = await advanceItem(attempt);
      if (r.ok) {
        setRetry(null);
        setMessage("وضعیت با تأیید سرور ثبت شد.");
        await refresh();
      } else {
        setMessage(r.message);
        setRetry(r.retryable ? attempt : null);
        if (!r.retryable) await refresh();
      }
    } catch {
      setRetry(attempt);
      setMessage("نتیجه هنوز مشخص نیست؛ همان تغییر را دوباره بررسی کنید.");
    }
    setBusy(null);
    guard.current = false;
  }
  return (
    <>
      <ConnectionState state={state} />
      <p className="notice">
        {role !== "waiter"
          ? "فقط مرحله بعد مجاز است: در انتظار ← در حال آماده‌سازی ← آماده سرو."
          : "نمای فقط خواندنی؛ تغییر وضعیت برای آشپزخانه و مدیر مجاز است."}
      </p>
      <p role="status" className="submission-message">
        {message}
      </p>
      {retry && (
        <button
          className="button"
          disabled={busy !== null}
          onClick={() => change()}
        >
          بررسی دوباره تغییر قبلی
        </button>
      )}
      {data.truncated && (
        <p className="notice">فقط ۱۰۰ آیتم قدیمی‌تر نمایش داده می‌شود.</p>
      )}
      <div className="kitchen-grid">
        {(["queued", "preparing", "ready"] as const).map((status) => {
          const items = data.items.filter((i) => i.status === status);
          return (
            <section className="kitchen-column" key={status}>
              <div className="column-heading">
                <h2>{statusLabels[status]}</h2>
                <span>
                  {new Intl.NumberFormat("fa-IR").format(items.length)}
                </span>
              </div>
              {items.length === 0 && (
                <p className="empty-state">آیتمی در این وضعیت نیست.</p>
              )}
              {items.map((item) => (
                <article
                  className="panel kitchen-ticket"
                  key={item.id}
                  data-testid={`kitchen-item-${item.id}`}
                >
                  <small>{item.orders.branches.name}</small>
                  <h3>
                    {tableDisplayName(item.orders.dining_tables.label)} ·{" "}
                    {item.name_snapshot} ×{" "}
                    {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                  </h3>
                  {item.notes && <p>{item.notes}</p>}
                  <time>
                    {new Intl.DateTimeFormat("fa-IR", {
                      timeStyle: "short",
                      timeZone: "Asia/Tehran",
                    }).format(new Date(item.submitted_at))}
                  </time>
                  <span className={`status-badge ${status}`}>
                    {statusLabels[status]}
                  </span>
                  {role !== "waiter" && status !== "ready" && (
                    <button
                      className="button"
                      disabled={
                        busy !== null ||
                        (retry !== null && retry.itemId !== item.id) ||
                        state === "unauthorized"
                      }
                      onClick={() => change(item)}
                    >
                      {busy === item.id
                        ? "در حال ثبت…"
                        : retry?.itemId === item.id
                          ? "بررسی دوباره تغییر"
                          : status === "queued"
                            ? "شروع آماده‌سازی"
                            : "آماده شد"}
                    </button>
                  )}
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
