"use client";
import Link from "next/link";
import { useState } from "react";
import { compareTableLabels, tableDisplayName } from "@/features/tables/sort";
import type { StaffRole } from "@/features/auth/permissions";
import { useOperationalPoll } from "./use-operational-poll";
import { ConnectionState } from "./connection-state";
import type { TableSummary } from "./workflow-model";
type Filter = "all" | "available" | "occupied" | "waiting";
const number = (n: number) => new Intl.NumberFormat("fa-IR").format(n);
export function TablesBoard({
  initial,
  role,
}: {
  initial: TableSummary[];
  role: StaffRole;
}) {
  const { data, state } = useOperationalPoll(
    initial,
    "/api/operations?view=tables",
  );
  const [filter, setFilter] = useState<Filter>("all");
  const ready = data.reduce((sum, t) => sum + t.readyCount, 0);
  const occupied = data.filter((t) => t.order).length;
  const waiting = data.filter((t) => t.order?.status === "draft").length;
  const branches = Array.from(
    new Map(data.map((t) => [t.branch_id, t.branches.name])).entries(),
  ).sort((a, b) => compareTableLabels(a[1], b[1]));
  return (
    <>
      <ConnectionState state={state} />
      <div className="hall-toolbar">
        <div>
          <h2>چیدمان سالن</h2>
          <p>میز دلخواه را انتخاب کنید تا سفارش آن باز شود.</p>
        </div>
        <div
          className="table-filters"
          role="group"
          aria-label="فیلتر وضعیت میزها"
        >
          {(
            [
              ["all", "همه میزها", data.length],
              ["available", "آزاد", data.length - occupied],
              ["occupied", "اشغال", occupied],
              ["waiting", "منتظر سفارش", waiting],
            ] as const
          ).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
              <span>{number(count)}</span>
            </button>
          ))}
        </div>
      </div>
      {ready > 0 && (
        <p className="ready-notice" role="status">
          {number(ready)} آیتم آماده سرو است؛ میزهای مشخص‌شده را بررسی کنید.
        </p>
      )}
      <div className="hall-legend">
        <span>
          <i className="legend-free" />
          آزاد
        </span>
        <span>
          <i className="legend-busy" />
          اشغال
        </span>
        <span>چیدمان نمایشی؛ موقعیت واقعی میزها قابل تنظیم نیست.</span>
      </div>
      {branches.map(([branchId, name]) => {
        const tables = data
          .filter(
            (t) =>
              t.branch_id === branchId &&
              (filter === "all" ||
                (filter === "waiting"
                  ? t.order?.status === "draft"
                  : filter === "occupied"
                    ? !!t.order
                    : !t.order)),
          )
          .sort((a, b) => compareTableLabels(a.label, b.label));
        return (
          <section
            className="hall-room"
            key={branchId}
            aria-label={`سالن ${name}`}
          >
            <div className="hall-room-heading">
              <h3>{name}</h3>
              <span>ورودی سالن</span>
            </div>
            {tables.length ? (
              <div className="hall-grid">
                {tables.map((t) => (
                  <Link
                    className={`table-card floor-table ${t.order ? "occupied" : "available"}`}
                    href={`/tables/${t.id}`}
                    key={t.id}
                    data-occupancy={t.order ? "occupied" : "available"}
                  >
                    <div
                      className={`floor-table-shape seats-${t.seats <= 2 ? "two" : t.seats <= 4 ? "four" : "many"}`}
                      aria-hidden="true"
                    >
                      <i className="chair chair-one" />
                      <i className="chair chair-two" />
                      <i className="chair chair-three" />
                      <i className="chair chair-four" />
                      {t.seats > 4 && (
                        <>
                          <i className="chair chair-five" />
                          <i className="chair chair-six" />
                        </>
                      )}
                      <div className="table-top">
                        <span>{t.label}</span>
                        <small>{number(t.seats)} نفره</small>
                      </div>
                    </div>
                    <h2 className="floor-table-name sr-only">
                      {tableDisplayName(t.label)}
                    </h2>
                    <p className="table-state">
                      {t.order
                        ? t.order.status === "draft"
                          ? "منتظر سفارش · منو داده شده"
                          : t.order.status === "served"
                            ? "سرو شده · مهمان سر میز"
                            : "اشغال · مشاهده سفارش"
                        : role === "kitchen"
                          ? "آزاد · مشاهده میز"
                          : "آزاد · پذیرش مهمان"}
                    </p>
                    {t.readyCount > 0 && (
                      <span className="status-badge ready">
                        {number(t.readyCount)} آماده سرو
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-state" role="status">
                {filter === "occupied"
                  ? "هیچ میز اشغالی در این سالن نیست."
                  : filter === "waiting"
                    ? "هیچ میزی منتظر ثبت سفارش نیست."
                    : "میز آزادی در این سالن نیست."}
              </p>
            )}
          </section>
        );
      })}
      {data.length === 0 && (
        <p className="panel">هنوز میزی در محدوده دسترسی شما ثبت نشده است.</p>
      )}
    </>
  );
}
