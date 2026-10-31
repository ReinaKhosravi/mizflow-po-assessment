"use client";
import { useRef, useState } from "react";
import { serveItem, closeTable } from "./actions";
import type { Order, WorkflowItem, MutationResult } from "./workflow-model";
type Attempt = {
  kind: "serve" | "close";
  targetId: string;
  expectedVersion: number;
  key: string;
};
export function ServiceControls({
  order,
  items,
  disabled,
  hasCart,
  refresh,
}: {
  order: Order;
  items: WorkflowItem[];
  disabled: boolean;
  hasCart: boolean;
  refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [retry, setRetry] = useState<Attempt | null>(null),
    [message, setMessage] = useState(""),
    [confirm, setConfirm] = useState(false);
  const guard = useRef(false);
  const ready = items.filter((i) => i.status === "ready");
  const canClose =
    order.status === "served" ||
    (order.status === "draft" && items.length === 0);
  async function execute(attempt: Attempt) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setMessage("");
    let result: MutationResult;
    try {
      result = await (attempt.kind === "serve" ? serveItem : closeTable)({
        targetId: attempt.targetId,
        expectedVersion: attempt.expectedVersion,
        key: attempt.key,
      });
    } catch {
      result = {
        ok: false,
        code: "unavailable",
        retryable: true,
        message: "نتیجه مشخص نیست؛ همان درخواست را دوباره بررسی کنید.",
      };
    }
    if (result.ok) {
      setRetry(null);
      setConfirm(false);
      setMessage(
        attempt.kind === "serve"
          ? "سرو آیتم ثبت شد و از صف آشپزخانه خارج شد."
          : "میز آزاد شد؛ آماده پذیرش مهمان جدید است.",
      );
      await refresh();
    } else {
      setMessage(result.message);
      setRetry(result.retryable ? attempt : null);
      if (!result.retryable) await refresh();
    }
    setBusy(false);
    guard.current = false;
  }
  const locked = disabled || busy || retry !== null;
  return (
    <section className="service-controls" aria-label="سرو و پایان حضور مهمان">
      {ready.length > 0 && (
        <>
          <h3>تحویل به مهمان</h3>
          <p className="page-note">
            فقط آیتمی را تأیید کنید که واقعاً به مهمان تحویل داده‌اید.
          </p>
          {ready.map((item) => (
            <div className="serve-line" key={item.id}>
              <span>
                {item.name_snapshot} ×{" "}
                {new Intl.NumberFormat("fa-IR").format(item.quantity)}
              </span>
              <button
                className="button"
                disabled={locked}
                onClick={() =>
                  execute({
                    kind: "serve",
                    targetId: item.id,
                    expectedVersion: item.version,
                    key: crypto.randomUUID(),
                  })
                }
                aria-label={`سرو شد · ${item.name_snapshot}`}
              >
                سرو شد ✓
              </button>
            </div>
          ))}
        </>
      )}
      {order.status === "served" && (
        <p className="notice">
          همه آیتم‌ها سرو شده‌اند. تا خروج مهمان، میز همچنان اشغال است؛
          می‌توانید سفارش جدیدی هم به همین میز اضافه کنید.
        </p>
      )}
      {canClose && (
        <div className="close-table">
          {!confirm ? (
            <button
              className="button secondary"
              disabled={locked || hasCart}
              onClick={() => setConfirm(true)}
            >
              آزاد کردن میز پس از خروج مهمان
            </button>
          ) : (
            <>
              <p>
                مهمان‌ها میز را ترک کرده‌اند؟ با تأیید، سرویس این میز پایان
                می‌یابد.
              </p>
              <button
                className="button"
                disabled={locked || hasCart}
                onClick={() =>
                  execute({
                    kind: "close",
                    targetId: order.id,
                    expectedVersion: order.version,
                    key: crypto.randomUUID(),
                  })
                }
              >
                تأیید خروج مهمان و آزاد کردن میز
              </button>
              <button
                className="button secondary"
                disabled={locked}
                onClick={() => setConfirm(false)}
              >
                انصراف
              </button>
            </>
          )}
          {hasCart && (
            <p className="page-note">
              ابتدا انتخاب‌های ارسال‌نشده را ارسال یا حذف کنید.
            </p>
          )}
        </div>
      )}
      {retry && (
        <button
          className="button"
          disabled={busy || disabled}
          onClick={() => execute(retry)}
        >
          بررسی دوباره ثبت سرویس
        </button>
      )}
      <p role="status" className="submission-message">
        {message}
      </p>
    </section>
  );
}
