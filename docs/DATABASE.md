# Database, transactions and reproduction

## Domain model

| Table                    | Responsibility and scope                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `restaurants`            | Tenant root; slug/name, IDs and timestamps                                                                       |
| `branches`               | Restaurant-owned branch with scoped uniqueness                                                                   |
| `restaurant_memberships` | Auth user → restaurant, role, optional branch, revocation; owners restaurant-wide, staff one branch              |
| `dining_tables`          | Physical table, capacity and active flag; restaurant/branch scoped                                               |
| `menu_items`             | Branch menu, category, availability and integer IRR price                                                        |
| `orders`                 | One party's service at a table; author, lifecycle, version and idempotency key                                   |
| `order_items`            | Submitted quantities/notes and server name/price snapshots; item lifecycle/version, submission/delivery metadata |
| `order_events`           | Append-only meaningful changes, actor, order version, time and details                                           |
| `private.order_commands` | Inaccessible command replay ledger, scoped to restaurant/branch and bound to actor/command/target/payload        |

Composite FKs tie branches to restaurants, tables/menu to branches, orders to physical tables, items to orders/menu and events to exact order/item scope. Actor relationships additionally check branch/restaurant-wide-owner scope. Delivery actor has a restaurant FK and branch-scope trigger. History survives later membership revocation; normal clients cannot delete memberships/history arbitrarily.

Stored monetary values are nonnegative integer IRR within JavaScript's safe integer range. Submission uses the available server menu row under a shared lock; it does not accept trusted client prices. Existing item snapshots remain unchanged when menu prices change. The UI displays IRR ÷ 10 and explicitly labels toman. Summed item totals use integer arithmetic and reject unsafe values.

## Lifecycle

| State            | Meaning                                                       |
| ---------------- | ------------------------------------------------------------- |
| No active order  | Physical table is free                                        |
| `draft`          | Party seated and menus given; awaiting submitted items        |
| `submitted`      | At least one line queued for kitchen                          |
| `in_preparation` | Preparation underway without queued lines taking precedence   |
| `ready`          | Remaining kitchen work ready for waiter delivery              |
| `served`         | All current food delivered; guests still occupy the table     |
| `closed`         | Explicit guest departure; table may host a new order          |
| `cancelled`      | Administrative/demo cleanup state; no general cancellation UI |

Item states are `queued`, `preparing`, `ready`, `served`, `cancelled`. “Ready” never implies actual service or table release. Another round may append to `served`, preserving prior delivered lines and returning the parent to submitted work. Delivery records `served_at`, `served_by` and one immutable `item_served` event. Closing has no payment meaning.

## Authorized commands

| RPC                   | Successful caller                       | Concurrency boundary                                                                           |
| --------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `open_table_order`    | Assigned waiter / own-restaurant owner  | Membership/key/table lock; unique active-order index                                           |
| `add_order_items`     | Assigned waiter / own-restaurant owner  | Membership/key/order locks, shared menu locks, append rows and snapshots                       |
| `advance_order_item`  | Assigned kitchen / own-restaurant owner | Parent then item lock, expected item version, next preparation state only                      |
| `serve_order_item`    | Assigned waiter / own-restaurant owner  | Parent then item lock, ready-only, expected item version, trusted delivery actor/time          |
| `close_table_service` | Assigned waiter / own-restaurant owner  | Physical table then order lock, expected parent version, only empty draft/fully served service |

Every RPC verifies the current `auth.uid()` membership, not browser role/tenant claims. Membership share locks serialize against revocation. Commands take a scoped idempotency advisory lock before resource writes; replay requires the same actor, command, target and payload. Events and command results commit with the business effect. Direct app writes to order/item/event/ledger tables remain denied.

The active-table partial unique index is the final database invariant. A business conflict emits PT409/HTTP 409, not a retriable serialization error. Closing racing with an append cannot silently discard food; reopening creates a distinct order. Replaying an old close cannot affect that new order.

A hot order is intentionally serialized. Read projections are separate statements, not one transactional snapshot of the entire restaurant. Kitchen pagination is visibly capped at 100 items; order-item reads compare exact counts and fail closed rather than present a truncated total. Broader pagination and scale measurements remain future work.

## Migrations

Apply in filename order using the normal Supabase migration mechanism:

1. `202610310001_tenant_foundation.sql`
2. `202611010001_order_workflow.sql`
3. `202611010002_domain_conflicts.sql`
4. `202611010003_owner_ordering.sql`
5. `202611010004_table_service.sql`

All five are recorded in the configured Cloud demo. Existing applied migrations were not rewritten to hide corrections. Exact-target offline application helpers verify history and use a schema advisory lock, bounded timeouts and an atomic source/history transaction. Do not reset a database to resolve an unexpected migration state.

## Local reproduction

With Docker, local Supabase tools and local configuration prepared:

```sh
npm ci && npm run db:start && npm run db:migrate && npm run db:seed && npm run dev
```

`db:reset` is destructive and only for disposable local data. Copy empty examples in `config/` to ignored local files and use actual local stack values. No published default password/key is supplied. The application's normal environment needs only public URL/key; seed/admin/test credentials stay separate and must not be deployed.

The demo seed creates real Auth accounts with a development-only password and deterministic restaurant/branch/menu/table IDs, plus explicitly imported historical snapshots. Reruns preserve existing accounts/passwords/roles/revocations/business rows. نارون has twelve canonical active tables; روز has its own eight-table dataset. The guarded hall normalizer archives recognized legacy fixtures and preserves audit history; it is not customer-data administration.

## Verification boundary

`npm run test:db` creates a real temporary PostgreSQL cluster using a test-only minimal auth bootstrap, applies migrations, runs roles/constraints/concurrency tests, then removes the cluster. Never apply that bootstrap to Supabase. Real Auth/PostgREST and browser suites have separate configuration and evidence. See TEST_REPORT.md for actual results; schema correctness is not a claim that every production Auth setting or operational recovery condition was tested.
