# Authorization and trust boundaries — iteration 5A

## Permission matrix (implemented now)

All permissions require an active membership resolved from database records for a server-verified Supabase user. `owner` means manager/owner; there is no separate `manager` role. Owners are restaurant-wide (`branch_id IS NULL`); waiters and kitchen staff are assigned exactly one branch. One membership per restaurant/user is supported.

| Resource / operation                                         | Owner                       | Waiter           | Kitchen          | Anonymous / revoked / unassigned |
| ------------------------------------------------------------ | --------------------------- | ---------------- | ---------------- | -------------------------------- |
| Restaurant metadata: read                                    | Own restaurant              | Own restaurant   | Own restaurant   | Denied                           |
| Restaurant name: update                                      | Own restaurant              | Denied           | Denied           | Denied                           |
| Branches: read                                               | All own branches            | Assigned branch  | Assigned branch  | Denied                           |
| Branches: create / rename                                    | Own restaurant              | Denied           | Denied           | Denied                           |
| Tables and menu: read                                        | All own branches            | Assigned branch  | Assigned branch  | Denied                           |
| Tables/menu: create and update allowed configuration columns | Own restaurant              | Denied           | Denied           | Denied                           |
| Memberships: read                                            | Own restaurant              | Active self only | Active self only | Denied                           |
| Memberships: create/update/revoke                            | Denied in app/API           | Denied           | Denied           | Denied                           |
| Orders, items, events: read                                  | All own branches            | Assigned branch  | Assigned branch  | Denied                           |
| Orders/items: insert/update/delete                           | Denied directly; RPCs below | Denied           | Denied           | Denied                           |
| Events: insert                                               | Denied directly; RPCs below | Denied           | Denied           | Denied                           |
| Events: update/delete/truncate                               | Denied                      | Denied           | Denied           | Denied                           |
| Other hard deletes, scope/ID changes                         | Denied                      | Denied           | Denied           | Denied                           |

This matrix describes database privileges, not available configuration screens. Configuration editing UI is absent. Order mutations use only the authorized RPCs described below; dashboard reads and operational polling share the context/RLS boundary. Setup administrators provision restaurants and memberships out of band; even application owners cannot grant themselves or others a new role. Do not use user-editable `user_metadata` or JWT role claims as restaurant permissions. A later invitation/membership management flow requires its own reviewed transaction and audit rules.

## Enforcement

- `src/proxy.ts` only refreshes SSR cookies and marks responses private/no-store. It is not the authorization boundary.
- Every protected page/read entry point calls `requireContext()` or `readContext()`. It calls `auth.getUser()` against Supabase Auth, then queries active membership under the user's own RLS identity. The layout also guards the shell. An unauthenticated request redirects to `/login`; invalid/missing configuration redirects to `/setup`; missing/revoked membership redirects to `/access-denied`. Data/database failures never fall back to fixtures.
- React `cache()` is used only for render-local deduplication; no cross-request session, membership or data cache is used. Protected routes are dynamic. After revocation, the next DB statement under the same user identity is denied by RLS, even with an otherwise valid JWT. A page already delivered to the browser cannot be recalled; navigation/new requests revalidate access.
- If a user has multiple restaurant memberships, the oldest active membership (then ID order) is used deterministically. A tenant/branch switcher and multi-branch staff memberships are not implemented. No tenant cookie, submitted role, email-domain heuristic or localStorage token is trusted.
- Table grants and RLS both apply. Anonymous table privileges are revoked. Owners can update only named configuration columns; IDs, restaurant/branch scopes, membership roles and audit timestamps cannot be changed using ordinary API updates.
- Composite FKs bind branch → restaurant, table/menu → branch, orders → table, items → order/menu, and events → exact order/item. Authors/actors reference a membership in the same restaurant; triggers additionally enforce branch assignment or restaurant-wide owner scope on new references. History is retained after later membership revocation.
- Three narrow boolean SECURITY DEFINER helpers in the non-exposed `private` schema avoid recursive membership RLS. They pin `search_path=''`, schema-qualify objects, use `auth.uid()`, expose no membership rows, and revoke PUBLIC/anon EXECUTE. The migration role must own them and retain RLS bypass to avoid recursion. Do not change ownership to an ordinary app role or enable FORCE RLS on the membership table without redesigning these helpers. Ordinary user requests never run as that role.
- Event UPDATE/DELETE/TRUNCATE are rejected by triggers in addition to absent grants. A database administrator can always alter/drop triggers or schema; this is append-only application history, not a tamper-proof external ledger.

## Authentication

Password login/logout use Next.js Server Actions (POST and same-origin checks), Zod validation and cookie-backed `@supabase/ssr`. Cookies are HttpOnly, SameSite=Lax, Secure in production. There is deliberately no browser Supabase client or browser token storage in this iteration. Server credentials use only the public publishable/legacy anon key; elevated keys are rejected in the application configuration. Supabase's own Auth server verifies identities. No fake session, fallback user or role switcher exists.

Signup is disabled in local Supabase configuration. For a hosted project, disable public signup in the Auth dashboard too; the lack of a signup form alone is not a server restriction. Password reset, invitations, MFA, OAuth and account lifecycle UI are not implemented. Configure Auth rate limits and HTTPS before exposing a hosted deployment. The application does not add a process-local rate limiter that would give false distributed protection.

Logout uses local-session signout, clears its SSR cookies and refresh token, and redirects to login. Already issued access tokens may remain valid until expiration; restaurant membership revocation is the immediate data-access kill switch. Transient logout failures are reported rather than represented as success.

## Logs and secrets

Structured server warnings contain an allowlisted event, random reference, timestamp and optional numeric HTTP status. No tokens, emails, raw Auth errors, SQL, request bodies or connection strings are logged. These are diagnostic logs, not a complete audit service. Event history is a separate database record. Do not enable request-body logging on the login endpoint.

`MIZFLOW_SEED_AUTH_KEY` and `MIZFLOW_DEMO_DATABASE_URL` are exclusively for offline development provisioning, with exact Cloud-target confirmation or loopback endpoints. The legacy secret variable is not a fallback. Do not set them on the deployed app. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are needed for normal requests.

## Verification limits

The real PostgreSQL suite exercises grants, RLS, FKs, triggers and revocation, switching to `anon`/`authenticated` with transaction-local claims. Its isolated bootstrap supplies minimal `auth.users` and the same `auth.uid()` identity contract. It does not run Supabase Auth/GoTrue, PostgREST, refresh-token rotation, production defaults, or HTTP key validation. The bootstrap is test-only and must never be applied to Supabase. Full stack login and authenticated navigation still require a live Supabase stack and seeded Auth accounts. See README for actual results and commands.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and the installed Next.js proxy/cookies/Server Actions guides.

## Verified Cloud state and remaining limits

The supplied project `qfyiyqjogfagevxzdgol` has migration 202610310001 applied and recorded atomically after an empty-schema/target check. All eight tables have RLS. Anonymous PostgREST requests return 401/42501. The offline seed provisioned six real Auth accounts and two cafés with independent data; rerunning it preserved passwords, roles, revocations and rows. Privileged keys are absent from ordinary user request paths and from the browser.

The real Supabase suite passed 10 reported tests (nine scenarios plus parent), with six password sign-ins, actual nested workspace reads/counts, anonymous denial, cross-tenant read/update denial, waiter/kitchen restrictions, self-escalation denial, FK rejection, explicit Auth refresh, and revoked-member denial under the same still-authenticated identity. Demo role/revocation probes are restored and generated probe IDs are cleaned up. Run only against the confirmed development project; forced termination during a probe may need administrator cleanup.

Browser QA uses a dedicated server on port 3100 rather than reusing a user's dev instance. It verifies real login, reload/new-tab cookie persistence, all four routes, RTL/no horizontal overflow, logout and protected-route rejection after logout. The first real run exposed an inaccessible desktop logout button in short viewports; the sidebar now scrolls and its footer does not shrink. Tests use ordinary actionability checks, not forced clicks. See README/AI_USAGE for final execution counts.

An actually expired SSR-cookie refresh has not been forced separately; successful explicit Auth refresh and browser persistence are narrower evidence. Later workflow tests cover specific concurrent operations; no suite proves every branch configuration or production threat.

## Local administrative configuration

The app uses only the public URL/key in ignored `.env.local`. Administrative DB credentials and the official root CA path are in ignored `.env.admin.local`; the seed's administrative Auth key and generated demo password are in ignored `.env.seed.local`. Test configuration is in ignored `.env.test.local`, without copying the Auth admin key. Populated files have mode 0600. None is committed or imported into the frontend.

The user explicitly permitted prior-key reuse for this noncritical development seed, superseding the initial mandatory-rotation instruction. This permission does not allow that key in the public-key field or ordinary authenticated traffic. Cloud helpers still require an exact target origin/reference and matching DB endpoint/username, verify TLS/hostnames and refuse transaction pooling. The supplied CA resolved the SSL trust error; outer password-placeholder brackets were corrected locally without printing the password. No TLS bypass is used.

Dashboard counts and kitchen items derive scopes from trusted membership. Kitchen includes active parent orders, permits next-state actions only for the kitchen role, and shows the oldest 100 matching items with an explicit truncation notice. Counts are separate read snapshots, not an atomic live view. Failures are sanitized and shown with retry UI; no mock data replaces real records. Loading/error boundaries contain no tenant data.

## Current ordering boundary (supersedes read-only statements above)

Migration 202611010001 adds authorized order commands. Direct order/item/event writes remain denied for every ordinary role. Waiter may execute open_table_order/add_order_items in its assigned branch; kitchen may advance_order_item queued→preparing→ready in its assigned branch. After user-requested migration 202611010003, an active owner may execute all three in its own restaurant, across its own branches. Anonymous/revoked/unassigned users cannot execute commands. The private order_commands table has RLS and no app grants. RPCs derive role/scope from current membership, lock it against concurrent revocation, pin an empty search path and validate exact resource scope, payload, transitions and snapshots. Same-key replay still rechecks current membership. Membership/role self-escalation remains denied.

Live integration suites use real Auth tokens for requests; privileged DB access is limited to demo fixture setup, adversarial membership probes, independent result inspection and cleanup. Run live suites sequentially to avoid deliberate revocation affecting another test. See HANDOVER.md for the latest actual results and production blockers; old successful test counts above are historical.

## Owner work panels

The `mizflow-panel` cookie chooses a work view only for a DB-verified owner. Non-owners ignore it. Panel-switch Server Actions check actual ownership; order/preparation Server Actions and RPCs always check actual membership, never the selected view. Changing to a kitchen/waiter panel does not impersonate another account or grant access to another tenant. Managers may operate all existing order/kitchen screens; membership administration remains denied until implemented separately.

## Per-item serving and table closure

Migration 202611010004 exposes `serve_order_item` and `close_table_service` only to authenticated callers; current membership additionally restricts success to assigned-branch waiter or own-restaurant owner. Kitchen cannot claim delivery/free a table. Both use the same private command ledger, explicit versions, empty search paths and resource locks as earlier commands. The serving actor/time is server-generated, has a restaurant FK plus branch-scope trigger, and is readable only through existing scoped RLS. Raw order/item/event writes remain denied. Close rejects unserved items and records the departed-party event; idempotent replay of an old close cannot close a newly opened order. No payment action or role change is hidden in these operations.
