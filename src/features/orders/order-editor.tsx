"use client";
import { ServiceControls } from "./service-controls";
import { tableDisplayName } from "@/features/tables/sort";
import { useRef, useState } from "react";
import type { StaffRole } from "@/features/auth/permissions";
import { menuItemIcon } from "@/features/menu/item-icon";
import { formatToman } from "@/lib/money";
import { openOrder, submitItems } from "./actions";
import {
  statusLabels,
  type OrderView,
  type MutationResult,
} from "./workflow-model";
import { useOperationalPoll } from "./use-operational-poll";
import { ConnectionState } from "./connection-state";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price_irr: number;
  is_available: boolean;
  branch_id: string;
};
type Line = { menu_item_id: string; quantity: number; notes: string };
const eventLabels: Record<string, string> = {
  order_created: "پذیرش مهمان و ارائه منو",
  item_served: "سرو آیتم توسط گارسون",
  order_closed: "خروج مهمان و آزاد شدن میز",
  order_submitted: "ارسال به آشپزخانه",
  items_added: "افزودن آیتم",
  item_preparing: "شروع آماده‌سازی",
  item_ready: "آماده سرو",
  demo_imported: "ورود نمونه آزمایشی",
  order_cancelled: "لغو سفارش آزمایشی",
};
export function OrderEditor({
  initial,
  menu,
  role,
}: {
  initial: OrderView;
  menu: MenuItem[];
  role: StaffRole;
}) {
  const { data, state, refresh } = useOperationalPoll(
    initial,
    `/api/operations?view=order&tableId=${initial.table.id}`,
  );
  const [cart, setCart] = useState<Line[]>([]);
  const [cartOrderId, setCartOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attemptKind, setAttemptKind] = useState<"open" | "submit" | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const attempt = useRef<{
    key: string;
    kind: "open" | "submit";
    items?: Line[];
    orderId?: string;
  } | null>(null);
  const inFlight = useRef(false);
  const staleCart = cart.length > 0 && cartOrderId !== data.order?.id;
  const locked = busy || uncertain || staleCart;
  const ready = data.items.filter((i) => i.status === "ready").length;
  function change(id: string, quantity: number, notes?: string) {
    if (locked) return;
    if (cart.length === 0 && quantity > 0)
      setCartOrderId(data.order?.id ?? null);
    attempt.current = null;
    setCart((previous) => {
      const old = previous.find((l) => l.menu_item_id === id);
      const rest = previous.filter((l) => l.menu_item_id !== id);
      return quantity > 0
        ? [
            ...rest,
            {
              menu_item_id: id,
              quantity: Math.min(100, quantity),
              notes: notes ?? old?.notes ?? "",
            },
          ]
        : rest;
    });
  }
  async function mutate(kind: "open" | "submit") {
    if (inFlight.current || (kind === "submit" && staleCart)) return;
    inFlight.current = true;
    setBusy(true);
    setAttemptKind(kind);
    setMessage("");
    if (!attempt.current)
      attempt.current = {
        key: crypto.randomUUID(),
        kind,
        ...(kind === "submit"
          ? {
              items: cart.map((l) => ({ ...l })),
              orderId: cartOrderId ?? data.order?.id,
            }
          : {}),
      };
    let result: MutationResult;
    try {
      result =
        kind === "open"
          ? await openOrder({
              tableId: data.table.id,
              key: attempt.current.key,
            })
          : await submitItems({
              orderId: attempt.current.orderId,
              key: attempt.current.key,
              items: attempt.current.items,
            });
    } catch {
      result = {
        ok: false,
        code: "unavailable",
        message: "نتیجه هنوز مشخص نیست؛ همان درخواست را دوباره بررسی کنید.",
        retryable: true,
      };
    }
    if (result.ok) {
      setMessage(
        kind === "open"
          ? "سفارش میز شروع شد."
          : "آیتم‌ها با تأیید سرور به آشپزخانه ارسال شدند.",
      );
      setCart([]);
      setCartOrderId(null);
      setUncertain(false);
      attempt.current = null;
      await refresh();
    } else {
      setMessage(result.message);
      setUncertain(result.retryable);
      if (!result.retryable) {
        attempt.current = null;
        await refresh();
      }
    }
    setBusy(false);
    inFlight.current = false;
  }
  return (
    <>
      <ConnectionState state={state} />
      <p className="notice" role="status">
        {role !== "kitchen"
          ? "افزودن آیتم‌ها، موارد قبلی یا وضعیت آشپزخانه را بازنویسی نمی‌کند."
          : "این نما برای نقش شما فقط خواندنی است."}
      </p>
      {ready > 0 && (
        <p className="ready-notice" role="status">
          {new Intl.NumberFormat("fa-IR").format(ready)} آیتم آماده سرو است.
        </p>
      )}
      <div className="order-layout">
        <section className="panel">
          <div className="section-heading">
            <h2>سفارش {tableDisplayName(data.table.label)}</h2>
            <span>{data.table.branches.name}</span>
          </div>
          {!data.order ? (
            <div className="empty-state">
              <p>این میز سفارش فعال ندارد.</p>
              {role !== "kitchen" && data.table.is_active && (
                <button
                  className="button"
                  disabled={busy || state === "unauthorized"}
                  onClick={() => mutate("open")}
                >
                  {busy
                    ? "در حال بررسی…"
                    : uncertain
                      ? "بررسی دوباره شروع سفارش"
                      : "نشستن مهمان و ارائه منو"}
                </button>
              )}
            </div>
          ) : (
            <>
              {data.items.length === 0 && (
                <p className="page-note">
                  مهمان نشسته و منو ارائه شده است؛ این میز منتظر ثبت سفارش است.
                  از منو انتخاب و سپس ارسال کنید.
                </p>
              )}
              <ul className="order-lines">
                {data.items.map((item) => (
                  <li key={item.id} data-testid={`order-item-${item.id}`}>
                    <div>
                      <strong>
                        {item.name_snapshot} ×{" "}
                        {new Intl.NumberFormat("fa-IR").format(item.quantity)}
                      </strong>
                      <p>{item.notes}</p>
                      {item.served_at && (
                        <small>
                          سرو شده در{" "}
                          {new Intl.DateTimeFormat("fa-IR", {
                            timeStyle: "short",
                            timeZone: "Asia/Tehran",
                          }).format(new Date(item.served_at))}
                        </small>
                      )}
                      <small>
                        {formatToman(item.unit_price_irr)} برای هر عدد
                      </small>
                    </div>
                    <span className={`status-badge ${item.status}`}>
                      {statusLabels[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="order-total">
                جمع ثبت‌شده: <strong>{formatToman(data.totalIrr)}</strong>
              </p>
              {role !== "kitchen" && (
                <ServiceControls
                  key={data.order.id}
                  order={data.order}
                  items={data.items}
                  disabled={locked || state === "unauthorized"}
                  hasCart={cart.length > 0}
                  refresh={refresh}
                />
              )}
              <details>
                <summary>تاریخچه سفارش</summary>
                <ul className="audit-list">
                  {data.events.map((event) => (
                    <li key={event.id}>
                      {eventLabels[event.event_type] ?? "تغییر سفارش"} ·{" "}
                      {new Intl.DateTimeFormat("fa-IR", {
                        timeStyle: "short",
                        timeZone: "Asia/Tehran",
                      }).format(new Date(event.created_at))}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )}
          <p className="submission-message" role="status" aria-live="polite">
            {message}
          </p>
          {uncertain && attemptKind === "open" && data.order && (
            <button
              className="button"
              disabled={busy || state === "unauthorized"}
              onClick={() => mutate("open")}
            >
              بررسی دوباره شروع سفارش
            </button>
          )}
          {uncertain && (
            <p className="notice">
              برای جلوگیری از ثبت دوباره، ویرایش انتخاب‌ها تا مشخص‌شدن نتیجه
              متوقف است؛ دکمه بررسی دوباره را بزنید.
            </p>
          )}
        </section>
        {role !== "kitchen" &&
          data.order &&
          !(uncertain && attemptKind === "open") && (
            <section className="panel">
              <h2>افزودن به سفارش</h2>
              {staleCart && (
                <p className="notice" role="alert">
                  این انتخاب‌ها مربوط به مهمان قبلی است؛ برای سفارش مهمان جدید
                  ابتدا انتخاب‌های قبلی را پاک کنید.
                </p>
              )}
              {cart.length > 0 && (
                <button
                  type="button"
                  className="button secondary"
                  disabled={busy || uncertain}
                  onClick={() => {
                    setCart([]);
                    setCartOrderId(null);
                    attempt.current = null;
                  }}
                >
                  پاک کردن انتخاب‌ها
                </button>
              )}
              <label className="search-menu">
                جست‌وجوی منو
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="نام غذا یا نوشیدنی"
                />
              </label>
              <div className="ordering-menu">
                {menu
                  .filter(
                    (m) =>
                      m.branch_id === data.table.branch_id &&
                      m.name.includes(search),
                  )
                  .map((m) => {
                    const line = cart.find((l) => l.menu_item_id === m.id);
                    return (
                      <article key={m.id} className="menu-pick">
                        <div>
                          <strong>
                            <span aria-hidden="true">
                              {menuItemIcon(m.name, m.category)}
                            </span>{" "}
                            {m.name}
                          </strong>
                          <small>
                            {m.category} · {formatToman(m.price_irr)}
                          </small>
                        </div>
                        <div className="quantity-control">
                          <button
                            aria-label={`کم کردن ${m.name}`}
                            disabled={locked || !line}
                            onClick={() =>
                              change(m.id, (line?.quantity ?? 0) - 1)
                            }
                          >
                            −
                          </button>
                          <output aria-label={`تعداد ${m.name}`}>
                            {new Intl.NumberFormat("fa-IR").format(
                              line?.quantity ?? 0,
                            )}
                          </output>
                          <button
                            aria-label={`افزودن ${m.name}`}
                            disabled={
                              locked ||
                              !m.is_available ||
                              (line?.quantity ?? 0) >= 100 ||
                              (!line && cart.length >= 30)
                            }
                            onClick={() =>
                              change(m.id, (line?.quantity ?? 0) + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        {line && (
                          <label className="prep-note">
                            توضیح آماده‌سازی برای {m.name}
                            <input
                              maxLength={500}
                              value={line.notes}
                              disabled={locked}
                              onChange={(e) =>
                                change(m.id, line.quantity, e.target.value)
                              }
                              placeholder="مثلاً بدون پیاز"
                            />
                          </label>
                        )}
                        {!m.is_available && <span>ناموجود</span>}
                      </article>
                    );
                  })}
              </div>
              {menu.filter((m) => m.branch_id === data.table.branch_id)
                .length === 0 && <p>منویی برای این شعبه ثبت نشده است.</p>}
              <p className="page-note">
                قیمت نهایی هنگام ارسال، از منوی سرور ثبت می‌شود؛ قیمت قبلی
                آیتم‌های ارسال‌شده تغییر نمی‌کند.
              </p>
              <button
                className="button submit-order"
                disabled={
                  busy ||
                  staleCart ||
                  (!uncertain && cart.length === 0) ||
                  state === "unauthorized"
                }
                onClick={() => mutate("submit")}
              >
                {busy
                  ? "در حال ارسال…"
                  : uncertain
                    ? "بررسی دوباره ارسال"
                    : "ارسال به آشپزخانه"}
              </button>
            </section>
          )}
      </div>
    </>
  );
}
