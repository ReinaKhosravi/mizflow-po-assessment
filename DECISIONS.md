# Initial decisions — 2026-10-31

## 1. Small, verifiable UI foundation

Use Next.js App Router, React, strict TypeScript and Tailwind. Keep routes as Server Components, with a single client navigation shell. Alternative: a fully client-side SPA. Trade-off: App Router supports future server authorization directly but requires care around client/server imports. No premature repository/service abstraction.

## 2. Public, explicit preview

All café names, table layouts and menu entries are labeled fixtures; operational counts use disconnected placeholders. No login, role switcher, localStorage session, fake API or mutation button. Alternative: mock the entire workflow. Trade-off: less apparent functionality, but honest assessment scope and no misleading security claims. Real private data must not be added before auth/RLS.

## 3. Tenant boundary belongs on the server and in PostgreSQL

Plan Supabase Auth plus verified server sessions, restaurant membership, branch scope and RLS. Use database constraints to prevent cross-tenant references. Alternative: browser-filtered queries or client role checks; rejected because they do not enforce isolation. RLS/server checks are a future requirement, not implemented protection.

## 4. Atomic operations before live orders

Future order commands must atomically validate permissions and allowed transitions, use expected versions to reject stale edits, and use unique scoped idempotency keys for retries. Persist item price snapshots from server-controlled menu records. Alternative: last-write-wins browser updates; rejected because waiters/kitchen can overwrite each other. Exact schema, conflict UX, transaction functions and automated concurrency tests remain for the backend iteration.

## 5. Money is integer IRR

Zod accepts nonnegative safe integers only. Display divides by 10 and explicitly labels تومان. Preserve tenths of a toman rather than silently rounding unexpected sub-toman values. Alternative: floating-point stored toman; rejected to avoid inconsistent units and rounding. Business bounds can tighten when real menu editing exists.

## 6. Persian-first, dependency-light design

Root `lang="fa" dir="rtl"`, Persian number formatting, system Tahoma/Arial fallback, cream/teal surfaces, responsive navigation. Alternative: downloading a hosted Persian font; deferred to keep builds independent of font network access. A self-hosted licensed Persian typeface can improve consistency later. No external imagery needed for this operational scaffold.

## 7. Targeted verification

Vitest exercises money boundaries; Playwright checks real routes and responsive RTL navigation on desktop/mobile. Alternative: tests that duplicate static page markup; omitted. Auth, tenancy and concurrency integration tests become mandatory when those capabilities are implemented.

## 8. Local only

No publishing, paid service, backend connection or deployment in this iteration. Keep a lockfile and empty environment template. The user's requested Next.js/PostgreSQL direction takes precedence over alternate hosting starter stacks.
