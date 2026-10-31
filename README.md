# MizFlow · میزفلو

A Persian RTL foundation for independent Iranian cafés. **Iteration 1 is a public UI preview, not a functioning restaurant system.** No authentication, database reads/writes, live order state, or authorization enforcement is implemented. All displayed café/menu/table data is public sample content.

## Local setup

Use Node.js 24 LTS and npm (Next.js requires Node >=20.9). The initial installation was checked on Node 26.0.0 / npm 11.12.0+; use the committed lockfile for reproducible installs.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Environment values can remain empty: this iteration does not connect to Supabase. Do not enter real credentials for the preview. The Next.js setup follows the [official installation documentation](https://nextjs.org/docs/app/getting-started/installation).

```sh
npm run build       # production build
npm start           # serve the production build
npm run typecheck
npm run lint
npm test            # Vitest: money validation/conversion
npx playwright install chromium  # once, for browser tests
npm run test:e2e    # desktop + mobile navigation, RTL, and overflow checks
```

## Implemented

- App Router, strict TypeScript, Tailwind CSS, responsive Persian RTL shell.
- Accessible navigation, active route indication, mobile menu, skip link, Persian 404.
- `/`: dashboard preview and future workflow explanation.
- `/tables`: 12 sample tables (40 proposed seats), without operational status.
- `/kitchen`: clearly disconnected preparation board.
- `/menu`: six sample café items; integer IRR converted explicitly to toman.
- Zod money validation, Vitest boundary tests, Playwright smoke tests.

## Structure and architecture direction

```text
src/app/            App Router pages and global layout/styles
src/components/     Shared shell and page presentation
src/features/       auth, restaurants, branches, tables, menu, orders, kitchen
src/lib/            Small shared utilities (money validation/formatting)
tests/e2e/          Desktop/mobile browser smoke tests
```

Pages are Server Components by default. Only navigation state is client-side. Feature folders reserve domain boundaries; they do not contain fake services. No database client or service key is bundled. The app works without Google Fonts or another runtime font service, using system Persian-capable fonts.

### Required before real data

Use Supabase Auth with server-verified sessions. Resolve restaurant membership and role from trusted server/database records on each protected read or mutation. Never trust restaurant IDs, branch IDs, roles, or prices submitted by the browser. Protected application routes must be gated before adding private data; these preview routes are intentionally public.

Every tenant-owned record must carry a restaurant scope, with branch scope where relevant. Enable PostgreSQL RLS, validate membership through `auth.uid()`, and enforce cross-tenant/branch relationships with composite keys and foreign keys. The publishable key is not an authorization mechanism. Service-role credentials must never use `NEXT_PUBLIC_*`, appear in client imports, or bypass RLS in ordinary user requests.

For order changes, validate input using Zod and authorize in the same server entry point. Use database transactions, expected-version checks, server-priced item snapshots, unique idempotency keys, and conditional allowed status transitions. Test two simultaneous updates, retries, cross-tenant IDs, revoked memberships, and unauthorized roles before exposing real operations. Realtime notifications must be authorized and treated as prompts to refresh authoritative data.

## Not implemented / next iteration

Supabase connection, schema/migrations/RLS, login/session handling, restaurant/branch management, role permissions, editable tables/menu, order creation/editing, kitchen updates, realtime delivery, and secure concurrency. Proposed roles: owner/manager (configuration + oversight), waiter (table orders), kitchen (item preparation). A final permission matrix still needs agreement.

Payment, inventory, supplier integration, autonomous purchasing, and AI restocking recommendations are out of scope. No paid external services are required. See DECISIONS.md and AI_USAGE.md. Stop here pending approval for the next iteration.
