# Database foundation

Migration: `supabase/migrations/202610310001_tenant_foundation.sql` (transactional). It creates eight tables, enums, constraints, indexes, timestamp/actor/append-only triggers, least-privilege grants and RLS policies together. Apply with the migration administrator, never through the application's public client. Supabase CLI tracks migration versions; do not rerun the SQL directly on an already-migrated schema.

| Table                  | Scope / integrity                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| restaurants            | Root tenant UUID; unique slug                                                                                                               |
| branches               | Required restaurant; unique name within restaurant; composite candidate key                                                                 |
| restaurant_memberships | Restaurant + Auth user; one row per pair; owners restaurant-wide, other roles branch-bound; revocation timestamp                            |
| dining_tables          | Restaurant + branch composite FK; unique label per branch; seats and active configuration                                                   |
| menu_items             | Restaurant + branch composite FK; unique name per branch; integer IRR price bounds                                                          |
| orders                 | Restaurant + branch + table composite FK; author membership; status, version, scoped idempotency key                                        |
| order_items            | Exact order and menu item in same restaurant/branch; price/name snapshots, quantity, status, version, scoped idempotency key                |
| order_events           | Exact order/item in same scope; actor membership and branch validation; fixed event vocabulary; append-only; version recorded at event time |

All records have `created_at`; mutable tables have a trigger-maintained `updated_at`. Events intentionally have no mutable timestamp. FK deletes are RESTRICT to preserve history. Deactivate tables/menu and revoke memberships rather than deleting history. Indexes support membership checks, branch/menu/table relationships, kitchen board reads and ordered event history. UUID PKs are not an authorization mechanism.

## Lifecycle and concurrency preparation

Intended order lifecycle: `draft → submitted → in_preparation → ready → served → closed`, with explicit cancellation before final closure. Items: `queued → preparing → ready → served`, with explicit cancellation before service. Enums constrain stored states; a future command layer must define and enforce exact allowed transitions (including all-item/order aggregation) transactionally. No status transition endpoint exists yet.

`version` starts at 1. Future commands must use `WHERE version = expected_version`, increment atomically, and reject stale updates. Scoped unique UUID idempotency keys are present on orders, items and events. They prevent duplicate values in those scopes; they do not yet implement replay response storage or detect a repeated key with a different payload. No claim of solved concurrency is made.

Future commands must resolve current active membership inside the transaction, lock/compare the relevant records, snapshot prices from menu records on the server, check totals safely, apply allowed transitions, and append an event in the same commit. Item quantity is bounded and monetary fields are nonnegative bigint within JavaScript's safe integer range. Snapshot fields are read-only to app roles today; trusted seed/admin writes can create historical records. The database does not independently calculate order totals or ensure item/order status aggregation.

Demo imports explicitly record `demo_imported` events instead of inventing a historical sequence of operations that never occurred. `order_version` is a historical snapshot, not an FK to today's version. Actors must match the restaurant and branch when attached; prior history survives future revocation/reassignment.

## Existing Cloud project: safe continuation

Target: `qfyiyqjogfagevxzdgol`, `https://qfyiyqjogfagevxzdgol.supabase.co`. The initial migration was reviewed locally without modification in iteration 3. Every tenant child carries restaurant scope; branch-specific FKs bind scopes; RLS and role grants are enabled in the migration transaction. Cloud migration 202610310001 is now applied/recorded and all eight RLS tables are present. The Auth-aware seed completed twice without duplicate rows; independent counts confirmed 12/8 tables, twelve menu items and five orders per café, and three active memberships each.

1. Revoke the exposed secret key in Settings → API Keys. Do not use it again. Put only the NEW publishable key in `.env.local` under `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; the URL is already set. Restart `npm run dev`. [Official key/rotation guidance](https://supabase.com/docs/guides/getting-started/api-keys).
2. Copy `config/admin.env.example` to `.env.admin.local`. Put the database URL from Supabase's Connect dialog into `MIZFLOW_ADMIN_DATABASE_URL`. Include the DB password **only in that ignored local file**, never a shell argument or chat. Set `MIZFLOW_CONFIRMED_PROJECT_REF=qfyiyqjogfagevxzdgol`. Use the direct host or session pooler on port 5432; transaction pooling is refused. Hosted TLS verifies certificates.
3. Run `npm run db:check:cloud`. It is read-only and reports whether the original migration is recorded, how many tenant tables exist, and whether all eight have RLS. It does not audit every deployed policy and is not approval to overwrite existing schema. If any public tables/private functions exist without recorded migration history, stop for schema reconciliation.
4. Authenticate the Supabase CLI yourself with `npx supabase login` (interactive browser flow). Do not paste the access token in chat. Link the exact project with `npx supabase link --project-ref qfyiyqjogfagevxzdgol`; enter the DB password through its secure prompt if needed, not `--password` in shell history.
5. Run `npx supabase migration list --linked` and compare with the local migration file. If migration `202610310001` is recorded, do not run its SQL again. If it is absent but any part of the schema already exists, stop rather than using migration repair to hide the mismatch.
6. Only after verification, review `npx supabase db push --dry-run`, then apply the reviewed pending migrations with `npx supabase db push`. No remote `db reset`, table replacement, deletion or migration-history repair is authorized by these instructions. This iteration did not run a Cloud push.
7. In Cloud Auth settings disable public signup and set Site URL/allowed redirect URLs for the app. The committed local Supabase config does not change Cloud settings. Provision access only through trusted administration.

## Secure, idempotent demo provisioning

Copy `config/seed.env.example` to ignored `.env.seed.local`. Configure:

- `MIZFLOW_DEMO_SEED=development-only`, `NODE_ENV=development`.
- `NEXT_PUBLIC_SUPABASE_URL` and exact `MIZFLOW_CONFIRMED_PROJECT_REF` for the named development project, or both loopback endpoints for an isolated local stack.
- `MIZFLOW_DEMO_DATABASE_URL`: matching direct/session-pooler DB URL. It is used by this offline script, never the deployed app.
- `MIZFLOW_SEED_AUTH_KEY`: a **NEW** administrative Auth key created after revoking the exposed one. Set `MIZFLOW_SEED_KEY_ROTATED=yes` only once you have performed that rotation. This is an operator attestation, not proof that Supabase revoked a key. The old `SUPABASE_SECRET_KEY` variable is no longer read or accepted as a fallback.
- `MIZFLOW_DEMO_PASSWORD`: choose a development-only password of at least 16 characters. No password or key is generated, committed, printed or sent in chat by Codex.

Run `npm run db:seed:cloud` (or `npm run db:seed`, using the same separate file). The script refuses production mode, unconfirmed/unrelated hosts, mismatched DB identities, unmarked existing accounts, and conflicting or non-demo restaurant memberships. It checks all eight tables before provisioning and locks the seed operation. Fixture IDs are stable; inserts do nothing on existing IDs. Existing business values, password choices, roles and membership revocations are preserved. Auth creation and per-café database transactions are not atomic together, so rerun after partial failures. Existing non-demo data is not overwritten. Run this only on a development project; tests may temporarily revoke a marked demo membership.

| Café                | Tables on fresh seed | Menu                            | Accounts                                                         |
| ------------------- | -------------------- | ------------------------------- | ---------------------------------------------------------------- |
| کافه نارون · ولیعصر | 12                   | 12 Persian items                | narvan.owner / narvan.waiter / narvan.kitchen @demo.mizflow.test |
| کافه روز · کریم‌خان | 8                    | 12 separate branch items/prices | rooz.owner / rooz.waiter / rooz.kitchen @demo.mizflow.test       |

Use full emails without spaces, e.g. `narvan.owner@demo.mizflow.test`. Accounts are real Auth users, never frontend fixtures or a role selector. Every café gets two historical closed orders and three explicitly imported active snapshots (`submitted`, `in_preparation`, `ready`) with corresponding item states. Import events honestly record `demo_imported`; they are not a fabricated event sequence. Fixed demo timestamps are reproducible, not evidence of recent live activity.

If a previous seed already created extra demo tables or older snapshots, reruns preserve them rather than deleting or rewriting history. The 12/8 layout is guaranteed for a fresh seed, not silently forced onto existing data. Handle any old demo cleanup separately after review. A revoked demo account remains revoked, and changing the password environment variable does not reset an existing account's password; account recovery/reset is a separate admin operation.

## Optional local stack

Start Docker, then `npm run db:start` and `npm run db:migrate`. `npm run db:reset` is only for disposable local data and deletes that data. SQL auto-seeding is disabled; use the same separate seed file with local endpoints, a fresh local administrative key and a chosen password. Do not put administrative variables in `.env.local` or on the deployed frontend.

## Verification and current status

The Cloud migration is applied and recorded, with all eight RLS tables present. The guarded direct-PG runner applied schema/history in a single transaction after confirming the target was empty; it does not reset databases or repair unknown history. Anonymous reads are denied through actual PostgREST. Do not rerun the initial migration.

The seed completed twice successfully. Independent Cloud queries confirmed: café A has 12 tables, café B has 8; each has 12 menu items, five orders and three active memberships. All six real Auth demo accounts sign in. Existing passwords/revocations are preserved on repeats. The initial attempt encountered a disconnected idle PostgreSQL session; the script now closes preflight connections before Auth calls, bounds those calls to 15 seconds and uses short advisory-locked transactions per café.

`npm run test:db` uses a disposable PostgreSQL 17 cluster and minimal test-only Auth identity contract. It passed 17 reported tests. `npm run test:supabase` uses actual Auth/PostgREST and passed 10 reported tests, including real refresh and denial after revocation. The latter requires the configured ignored test file; its operator-only DB access handles safe demo probes and never replaces user-token/RLS queries. A process forcibly stopped during a probe may need administrator cleanup.

The official root CA supplied by the user is referenced by `MIZFLOW_DB_CA_FILE`. The driver accepts PEM/DER CA files and verifies certificates and hostnames; it never uses `rejectUnauthorized:false`. Download the root only from the official dashboard as described in [Supabase SSL guidance](https://supabase.com/docs/guides/database/connecting-to-postgres).

The Cloud seed command loads `.env.admin.local` and `.env.seed.local` together so it can reuse the DB URL/CA in memory rather than duplicate them. The generated development password is only in the ignored seed file. The user explicitly authorized reuse of the supplied administrative Auth key for this development-only seed; the earlier rotation-attestation requirement is superseded. Normal app requests remain public-key/user-session requests. No ordering mutation or concurrency implementation was added.

## Current ordering migrations

Apply in order: foundation `202610310001`, workflow `202611010001`, then domain conflict correction `202611010002`. The last migration uses CREATE OR REPLACE on only the three reviewed workflow functions to emit PT409 for final business conflicts, preserving existing ownership/grants. This avoids treating occupied tables/stale versions as retriable database serialization errors over PostgREST. Local SQL tests alone did not expose that HTTP behavior.

The named demo was upgraded using `MIZFLOW_APPLY_REVIEWED_MIGRATION=202611010002 node --env-file=.env.admin.local scripts/apply-workflow-migration.mjs`. It verifies exact target/history and applies source plus history atomically under a migration lock; do not run without reviewing current state. Fresh local environments use normal ordered Supabase migrations. No table reset is part of this correction.

## Current service lifecycle (user follow-up)

Ordered forward migrations 202611010003 (owner staff operations) and 202611010004 (per-item serve metadata/RPC and table closure) are applied after the earlier three versions. `draft` means a seated party awaiting submitted items; `served` means all current items delivered while guests still occupy the table; `closed` means explicit departure and table release. A served order can accept another round and becomes submitted again. `serve_order_item` records `served_at`/`served_by` and one item_served event; kitchen filters exclude served rows. No financial status is inferred.

The development normalizer preserves canonical table IDs and all audit history, leaves exactly twelve active نارون tables numbered ۱–۱۲, retires recognized extra test tables, and cancels only those recognized demo test orders with cleanup audit events. Archived table rows remain for FK/history integrity. Live tests borrow free existing tables; they do not create new ones or silently take over occupied tables.
