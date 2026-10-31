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

## 9. Reproducible build path and dependency review

Use the officially supported Webpack mode for both dev/build and Tailwind PostCSS. The starter's Turbopack integration failed because its internal port binding was denied in this assessment environment. Keeping one bundler for dev and production avoids divergent behavior. Node 24 is the local baseline; Vitest's current toolchain needs newer Node types than the starter supplied.

`npm audit` reported 16 moderate development-tool findings propagated from minimatch; `npm audit --omit=dev` reported zero production findings. Do not force npm's suggested incompatible downgrades. Revisit upstream compatible lint-tool updates before deployment.

# Iteration 2 — 2026-10-31

## 10. Supabase persistence and cookie sessions

Use `@supabase/ssr` on the server with HttpOnly cookies and `auth.getUser()` for live identity verification. Proxy refreshes cookies; protected pages and read helpers independently authorize via trusted membership records. Alternative: trusting `getSession()`/browser state or a proxy-only guard. Rejected because neither is sufficient authorization. React cache deduplicates one render only, not users or requests. Missing configuration fails closed to a setup page rather than continuing the public preview. The existing Persian shell/routes remain; their source moved into an App Router group without changing URLs.

## 11. Explicit tenant and branch integrity

All eight tables are tenant roots or carry restaurant scope; branch records and dependent data use composite FKs. Owners are restaurant-wide; waiter/kitchen memberships require exactly one branch. One membership per user/restaurant is deliberate; oldest active membership selects the workspace until a switcher exists. Alternative: browser-provided active roles/scopes or globally unique UUIDs without composite FKs. Rejected because uniqueness is not relationship authorization. Menu/table pages now use RLS-protected reads and display actual branch names; workflow placeholders remain labeled.

## 12. Default-deny database privileges

Enable RLS on every tenant table, revoke anonymous/table defaults, and grant only scoped reads and owner configuration writes. Update grants name specific configuration columns, preventing scope/ID rewrites. Membership mutation is denied even to owners; setup is administrator-only until reviewed invitation/role commands exist. Alternative: owner clients writing membership rows freely; rejected because mistakes can create self-escalation paths. Three narrow private-schema SECURITY DEFINER boolean predicates avoid recursive membership policies, pin an empty search path, use the authenticated subject, and deny public/anonymous EXECUTE. They depend on a trusted migration owner with RLS bypass, not an app/service-role request.

## 13. Order safety preparation without premature mutations

Enums document order/item lifecycle states; bigint IRR snapshots, positive versions and scoped unique UUID idempotency keys prepare the schema. Order/item mutations and event appends are denied to every app role today. Append-only triggers reject event rewrites/deletion/truncation, while administrator seed imports explicitly identify themselves as imports. Alternative: exposing simple REST status writes before transactions and concurrency tests. Rejected because schema fields alone do not solve stale updates, duplicate commands, price derivation, event atomicity, or lifecycle aggregation. See docs/DATABASE.md for remaining transaction requirements. Composite FKs and actor-scope triggers prevent cross-tenant/branch references independently of app checks.

## 14. Separate development provisioning

The demo seed uses a privileged Auth admin API plus a direct PostgreSQL connection only in an offline loopback-only script. Normal requests never import that script or require its keys. Passwords are supplied by ignored environment variables, never defaulted or printed. Stable fixture IDs, account metadata checks, upserts, per-café transactions and an advisory lock make retries reproducible. Auth and PostgreSQL provisioning cannot be atomic together; reruns repair partial work and deliberately reset demo credentials/memberships. Hosted seeding is refused. Alternative: committed demo passwords, browser-visible demo accounts, or service-role application clients. Rejected.

## 15. Real database evidence, bounded claims

Docker is installed but not running; there is no configured Supabase project. Use the installed PostgreSQL 17 to create a disposable private-socket cluster, apply the actual migration, and run real SQL-role RLS/constraint tests. A minimal identity bootstrap supplies only Supabase's `auth.users`/`auth.uid()` contract; it is not a mock database and not a full Supabase stack. Full GoTrue/PostgREST/cookie-refresh and seeded Auth navigation still need a running configured Supabase stack. Authenticated browser tests explicitly skip when that prerequisite is absent; unauthenticated route protection runs without inventing a backend result. Diagnostic logs use allowlisted events and omit raw sensitive payloads. No deployed schema or successful full-stack Auth run is claimed.

# Iteration 3 — 2026-11-01

## 16. Targeted Cloud configuration without invented credentials

The user supplied an existing project URL/reference. Create ignored mode-0600 `.env.local` with that URL and an intentionally invalid publishable-key placeholder. Never reuse the exposed administrative key or treat a secret as a public key. The operator must revoke the compromised key and configure a NEW public key locally. The Cloud target and migration state cannot be verified without authorization; no remote schema/seed mutation was attempted. A read-only preflight checks exact target, migration history and RLS flags once the DB URL is configured. Existing unrecorded schema requires reconciliation, not a reset or blind migration repair.

## 17. Keep privileged tooling separate and non-destructive

Admin, seed and real-test credentials live in separate ignored local files, not app configuration or frontend imports. The seed can now target only loopback or the explicitly confirmed supplied development project, with matching DB identity and verified TLS. The newly named `MIZFLOW_SEED_AUTH_KEY` has no fallback to the previous secret variable and requires explicit rotation attestation. This does not cryptographically verify rotation; Supabase administration must revoke the old key. Seed reruns now preserve existing passwords, roles, revocations and business data, superseding iteration 2's development-reset behavior. Stable IDs and collision/demo-membership checks prevent overwriting unmarked data. Fresh fixtures are 12/8 tables, 12 separately scoped menu items each, six Auth users and five imported order snapshots per café. Old extra rows are not deleted to force a fresh-fixture shape.

## 18. Real read-only screens before ordering commands

Preserve the Persian shell; replace dashboard placeholder counts and kitchen placeholder columns with server-authorized database queries. Use exact scoped counts and parent-order filters for active kitchen items. Add Persian loading/empty/error states and sanitized retry failures, never a mock fallback. Limit the kitchen to the oldest 100 active items with a visible truncation notice. Counts are independently read snapshots, not an atomic live view. No order/status mutation, realtime behavior or inventory feature was introduced. Database reads are implemented/compiled locally but remain unverified through the actual project's PostgREST until keys and accounts exist.

## 19. Distinguish three kinds of evidence

Vitest covers projection/config/guard behavior. Real PostgreSQL exercises the existing migration/RLS/FKs and expanded seed idempotency. A separate opt-in suite exercises actual Supabase Auth/PostgREST, including real refresh and scoped revocation of a marked demo member, with only public-key user requests. Browser tests add reload/new-tab persistence to the existing login/logout flow. Missing external credentials produce explicit skips/blocks, not successful Cloud assertions. No expired-SSR-cookie refresh claim is made from a build, API refresh implementation or PostgreSQL-only tests.

## 20. User-authorized development-key reuse and successful Cloud migration

The user explicitly authorized reusing the earlier administrative key for this noncritical development project, superseding decision 17's rotation-attestation gate. The offline seed still requires an explicitly populated administrative key and confirmed development target; it never substitutes that key for the public application key. The previous value was deleted and is not available, so seeding remains blocked rather than inventing or recovering a credential. The verified empty Cloud project now has migration 202610310001 applied/recorded atomically with all eight RLS tables; actual anonymous API requests are denied. Authenticated behavior remains unverified until real accounts are provisioned.

## 21. Live verification and reachable account controls

Cloud Auth provisioning and the full real API suite are now executed successfully. Close the seed's preflight DB connection before network Auth operations; use bounded API calls and a short advisory-locked transaction for each café. Full seed reruns preserve data and were verified. Browser QA now owns a dedicated port/server and can test a production build, rather than sharing a user's long-running dev instance. Actual browser testing exposed the fixed sidebar's logout button outside short desktop viewports; add sidebar scrolling and prevent footer shrinking so account actions are reachable. Do not bypass actionability checks or force clicks to make tests pass.

## 2026-11-01 — Iteration 4 implementation and 5A independent audit

The current ordering boundary is three SECURITY DEFINER RPCs with empty search paths, verified active waiter/kitchen membership and no direct app grants on orders/items/events. Acquire membership share lock, idempotency advisory lock, then table/order/item locks. Append commands serialize at the parent order; item transitions require expected version. This trades per-order throughput for simple, reviewable consistency. The private command ledger binds key to actor, command, target and exact payload; replay returns the original committed response. A partial unique index protects active table occupancy even outside the UI. Menu share locks and server snapshots prevent submitted client prices being authoritative. Event creation commits with each command. Owner workflow mutation is deliberately denied; owner configuration grants remain separate.

Polling was selected over realtime subscriptions to keep session and tenant authorization on each request; hidden pages pause and stale data is labeled. It is not instantaneous delivery. No serve/close feature was added under the audit. Large-query pagination and single-snapshot projections remain work.

For response-loss recovery, the editor must retain both command identity and its operation kind. Showing a newly polled order must not hide an unresolved open retry or reuse that key for item submission. The audit added a real committed-response-loss browser regression. Test resources use independent generated demo tables rather than assuming fixed table 10 is empty; cleanup cancels only tracked marked orders and retires test tables, preserving audit evidence. Live membership mutation probes and browser workflows must run sequentially.

Default dark/light/system uses only a UI preference in localStorage, never authentication or order data. Vazirmatn is bundled locally via @fontsource, avoiding remote font requests at runtime/build. Prior read-only architecture statements describe earlier iterations only. See HANDOVER.md for current limits and evidence.

### Domain conflict SQLSTATE

Independent live tests found that using serialization-failure `40001` for a business conflict could leave the PostgREST loser waiting instead of returning promptly, despite fast local SQL tests. Forward migration `202611010002_domain_conflicts.sql` changes only those reviewed conflict raises to `PT409` (HTTP 409). Real database serialization failures retain their real meaning. Do not rewrite the already-applied original workflow migration. The UI handles PT409 explicitly; live RPC tests disable SDK retries and bound waits so transport failures cannot masquerade as successful domain assertions. Every negative assertion still requires its expected code; a PGRST202 failure is not evidence of denied authorization.

## User-requested operations and panel follow-up

The user clarified that managers must operate every existing section, not only inspect it. Migration 202611010003 expands the active restaurant-wide owner predicate for the existing order/preparation RPCs. Waiters retain branch-only order privileges; kitchen retains branch-only preparation privileges. Owners still cannot use these commands outside their own restaurant. Existing membership administration is not silently opened.

Only an actual DB-verified owner may select manager/waiter/kitchen work panels. The HttpOnly `mizflow-panel` cookie is a presentation preference, never an authorization claim. Non-owner identities ignore forged panel cookies; Server Actions and SQL continue using actual membership. Owner default mode exposes both ordering and preparation, while alternate modes simplify task controls. Clear order-entry links are present in navigation and the menu page. Semantic food icons replace the universal coffee icon.

The table view uses a responsive illustrative hall layout, natural Persian-number sorting, selectable tables and all/free/occupied filters. No physical-coordinate editing or claim of an accurate surveyed floor plan is made. Two specifically identified legacy active test tables were renamed to میز ۱۳ and میز ۱۴ transactionally, preserving all associated orders.

## Table lifecycle requested by the user

Reused the existing draft order as a persisted seated/menus-given state rather than adding a second competing occupancy source. Kitchen receives only submitted items. Per-item serving is a separate waiter/owner command from kitchen readiness; actor, server timestamp and immutable event are recorded atomically. Served items leave the kitchen queue but do not free a table. A versioned close command is allowed only for an empty draft or a fully served order after departure confirmation. It locks the physical table before the parent order to serialize close/reopen; all mutation commands retain membership checks and idempotency. A served table can append another round without altering earlier service records. No financial settlement is implied.

Configured the existing twelve canonical نارون tables as active, with number-only labels; retired and numbered legacy test tables instead of deleting immutable history. Live tests now borrow a free physical table and refuse occupied ones; they no longer generate visible extra tables. Two-seat tables have round tops and two chairs; four-seat tables have rectangular tops and four chairs. The hall layout is illustrative, not a persisted coordinate editor. Panel changes now perform one fresh authenticated navigation after the server saves the preference, avoiding competing router refresh/navigation during same-page work-mode changes.
