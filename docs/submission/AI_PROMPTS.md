# Principal AI prompts used

This is a submission-facing record of user task prompts, not hidden system instructions. It distinguishes exact excerpts from summaries. Passwords, tokens and private connection strings are excluded. Product-planning ChatGPT assistance and Codex implementation are disclosed in AI_USAGE.md.

## 1. Initial foundation — verbatim excerpts

> You are the senior founding engineer of MizFlow, a SaaS restaurant order-to-kitchen platform designed for independent Iranian cafés and restaurants.
>
> Your task in this FIRST iteration is to establish a clean, working foundation. Do not attempt to build the full product yet.

The same brief defined independent Iranian cafés with about 10–20 tables, Persian RTL, integer IRR displayed in toman, owner/waiter/kitchen roles and a future restocking feature that must not be implemented yet.

> Do not use mock authentication or localStorage as a substitute for production security.
>
> Do not invent a working backend or claim that placeholder pages are functional.
>
> Do not expose Supabase service-role keys to the browser.

## 2. Persistence/security iteration — summary, not a verbatim transcript

Continue the existing frontend. Add Supabase SSR/Auth, real login/logout, protected routes, active membership lookup, a documented permission matrix, eight restaurant/branch-scoped tables with integrity constraints and RLS, append-only order history and concurrency preparation. Seed two separate cafés through development-only tooling, keep credentials out of source, run real PostgreSQL negative tests and accurately disclose missing external configuration. Do not build the full ordering workflow in that iteration.

Verbatim boundary:

> Never accept browser-provided roles or tenant membership as authoritative.

## 3. Supabase completion — complete supplied implementation prompt

The original supplied prompt is reproduced below, with the public project URL/reference retained and no secret values.

```text
You are continuing the existing MizFlow project.

This is Iteration 3: Complete Supabase integration, real authentication, demo data, and end-to-end security verification.

IMPORTANT: Do not recreate the project. Preserve the existing Persian RTL UI, migrations, tests, architecture, and documentation.

## 1. Supabase configuration

The Supabase Cloud project already exists.

Project URL:
https://qfyiyqjogfagevxzdgol.supabase.co

Project reference:
qfyiyqjogfagevxzdgol

Inspect `.env.example`, `.env.local`, and the existing Supabase client implementation.

Create or update `.env.local` with:

NEXT_PUBLIC_SUPABASE_URL=https://qfyiyqjogfagevxzdgol.supabase.co

Use the existing environment variable name for the publishable key. If it is missing, add the appropriate variable with a placeholder.

Do not invent API keys.

Do not use a secret key as a publishable key.

A previously exposed Supabase secret key must be treated as compromised. Do not use it. Do not store it in any file, prompt, documentation, test fixture, or commit.

Tell me exactly where to paste the NEW publishable key locally.

Ensure `.env.local` and all sensitive environment files are gitignored.

## 2. Verify the database integration

Inspect the existing SQL migration:

supabase/migrations/202610310001_tenant_foundation.sql

Verify:
- All tenant-owned tables have restaurant scoping.
- Branch-specific tables enforce branch relationships.
- Foreign keys prevent cross-tenant relationships.
- RLS is enabled on every tenant-owned table.
- Policies fail closed.
- Restaurant membership is resolved from trusted records.
- Roles cannot be escalated by manipulating client requests.
- Anonymous users cannot read private restaurant data.

Apply the migration to the Supabase Cloud project only after verifying the target project and migration state.

If database credentials or authorization are required, stop and explain how I can configure them securely. Do not ask me to paste credentials into the chat.

Do not overwrite existing production data.

## 3. Real authentication

Complete Supabase Auth integration.

Implement and verify:
- Login
- Logout
- Session persistence
- Session refresh
- Protected routes
- Server-side user verification
- Restaurant membership resolution
- Role-based access
- Unauthorized access handling

Roles:
- Owner
- Waiter
- Kitchen

Users must never select or modify their own privileged role.

A logged-in user without an active restaurant membership must not access private restaurant data.

## 4. Realistic demo data

Create a reproducible and idempotent demo seed.

Create two separate fictional Iranian cafés with realistic Persian names.

Restaurant A:
- 12 dining tables
- At least 12 realistic Persian menu items
- Owner account
- Waiter account
- Kitchen account
- Realistic historical orders

Restaurant B:
- 8 dining tables
- Separate menu and orders
- Owner account
- Waiter account
- Kitchen account

Use realistic prices stored as integer IRR.

Use Persian descriptions, appropriate café terminology, and plausible order histories.

Create demo users through a secure administrative seed procedure.

Do not hardcode passwords in committed source files.

Provide a documented way to set development-only demo passwords through ignored local environment variables.

Do not expose privileged seed credentials to the browser.

## 5. Connect the existing UI to real data

Replace static sample data on protected pages with authorized database reads.

Pages:
- Dashboard
- Tables
- Menu
- Kitchen

Every read must respect the authenticated user's restaurant and branch access.

Do not silently fall back to public mock data when database access fails.

Show proper:
- Loading states
- Empty states
- Error states
- Unauthorized states

Keep the interface Persian, RTL, responsive, and usable on mobile.

The Kitchen page may remain read-only until the next iteration, but it must not pretend that preparation status updates are functional.

## 6. Security verification

Run tests against actual Supabase Auth and PostgREST where possible.

Required scenarios:
- Anonymous access is rejected.
- Restaurant A cannot read Restaurant B records.
- Restaurant A cannot update Restaurant B records.
- Waiter cannot modify menu prices.
- Kitchen cannot access owner-only operations.
- Revoked memberships lose access.
- Cross-tenant foreign-key injection is rejected.
- Protected pages reject unauthenticated sessions.

Use real integration tests where feasible.

Do not claim that PostgreSQL-only tests prove Supabase Auth integration.

## 7. Engineering quality

Run:
- npm run typecheck
- npm run lint
- npm test
- npm run build
- Available Playwright tests

Fix failures caused by this iteration.

Keep logs useful but free from secrets and personal data.

Do not introduce paid services.

## 8. Documentation

Update:
- README.md
- DECISIONS.md
- AI_USAGE.md
- docs/DATABASE.md
- docs/SECURITY.md

Document actual verification results and known limitations.

## 9. Final report

Report:
1. Files changed
2. Environment variables configured
3. Migration status
4. Demo seed status
5. Authentication verification results
6. Security tests and actual results
7. Build/test results
8. Remaining blockers
9. Exact next steps for me

Do not claim success for operations that could not be executed.

Do not implement the full ordering workflow or AI inventory features yet.

Stop when this iteration is complete.
```

## 4. Operational ordering iteration — complete supplied prompt

```text
Continue the existing MizFlow repository.

## ITERATION 4 — Production-oriented Order-to-Kitchen Workflow

You are acting as a senior full-stack engineer and product owner.

Our goal is to implement ONE complete, operationally credible workflow for an Iranian café: table ordering → kitchen preparation → waiter notification.

Do not recreate the project. Preserve the existing Persian RTL design, Supabase integration, authentication, RLS, migrations, demo data and documentation.

### 0. Verify prerequisites

Before implementing anything:
- Inspect the existing repository, migrations, security policies, README, SCOPE.md, and tests.
- Verify whether Supabase Auth and database connectivity actually work.
- Verify whether migrations and demo accounts exist in the configured environment.
- If essential prerequisites are missing, fix them safely or report the blocker.
- Never silently fall back to fake data.
- Never expose secret keys.

### 1. Table management

Implement a functional table view:
- Display tables belonging to the authorized restaurant and branch.
- Clearly distinguish available and occupied tables.
- Open a table to view its active order.
- Create an order for an available table.
- Prevent duplicate active orders on the same table.
- Show helpful loading, error and empty states.

### 2. Waiter ordering workflow

Implement:
- Select a table.
- Browse the real menu.
- Add multiple menu items with quantities.
- Add optional preparation notes.
- Submit the order to the kitchen.
- Add more items to an existing order.
- View each item's preparation status.
- See the total using server-authoritative IRR price snapshots, displayed in toman.

Do not implement payment or checkout.

Do not allow clients to submit trusted prices, restaurant IDs, or roles.

### 3. Kitchen workflow

Implement a real kitchen display:
- Show submitted order items for the authorized branch.
- Display table number, item, quantity, notes, and time submitted.
- Support item status transitions:
  pending → preparing → ready
- Allow only authorized kitchen staff to change preparation status.
- Prevent invalid transitions.
- Show newly submitted items and updated statuses without requiring manual navigation.

Use realtime notifications if safe and feasible; otherwise implement reliable short-interval polling with cleanup and visible connection/error states.

### 4. Safe concurrent operations

This is a critical evaluation criterion.

Implement order mutations using PostgreSQL transactions and database-enforced authorization.

Requirements:
- Two waiters can add items to the same active order without overwriting each other's changes.
- A kitchen status update cannot be lost when a waiter adds another item.
- Use atomic operations instead of replacing the full order state.
- Use optimistic concurrency or row-level locking where appropriate.
- Enforce unique idempotency keys for retryable operations.
- Prevent duplicate active orders per table.
- Return explicit conflict errors where a mutation cannot safely proceed.
- Maintain an append-only audit history of meaningful order changes.

Prefer narrow database RPC functions with explicit authenticated-user checks and least-privilege EXECUTE grants.

Do not use service-role credentials to bypass RLS for ordinary application operations.

### 5. Authorization and tenant isolation

All reads and writes must be scoped to the authenticated user's restaurant and authorized branch.

Required restrictions:
- Waiters can create orders and add items.
- Kitchen staff can view submitted orders and update preparation statuses.
- Owners can view restaurant activity.
- Users cannot access another restaurant's records.
- Users cannot access unauthorized branches.
- Clients cannot manipulate prices or privileged status transitions.

Validate all API inputs with Zod.

Return safe, structured errors without leaking tenant existence or private information.

### 6. Operational UX

Use Persian RTL throughout.

Design for a busy café:
- Large touch-friendly controls
- Minimal steps to add an item
- Clear status colors with text labels
- Mobile-friendly waiter screens
- Tablet-friendly kitchen board
- Visible submission feedback
- Prevent accidental double submission
- Preserve unsent form input when requests fail
- Never show a successful submission before server confirmation

Keep the interface polished but prioritize operational reliability over decoration.

### 7. Realistic demo scenario

Ensure the seeded data supports a walkthrough:

Restaurant A:
- Table 12 has an active order.
- Waiter can add a drink.
- Kitchen can change a burger to preparing.
- Another waiter can add a pizza.
- All changes remain visible and auditable.

Restaurant B:
- Has completely separate tables, menu, orders and staff.
- Cannot access Restaurant A data.

Provide a reproducible demo reset procedure that does not affect real customer data.

### 8. Automated tests

Add tests that cover:

A. Full workflow:
Login as waiter → open table → add items → submit order → login as kitchen → mark item preparing → mark ready → verify waiter sees ready.

B. Concurrency:
- Two simultaneous add-item requests.
- Kitchen update while waiter adds an item.
- Duplicate request with same idempotency key.
- Two simultaneous attempts to open an order for the same table.

C. Security:
- Cross-tenant order reads denied.
- Cross-tenant mutations denied.
- Cross-branch access denied.
- Unauthorized role actions denied.
- Forged prices ignored or rejected.
- Invalid status transitions rejected.

Run real PostgreSQL integration tests. Run actual Supabase Auth/PostgREST tests where the environment supports them.

Do not replace security tests with mocks.

### 9. Documentation

Update:
- README.md
- DECISIONS.md
- AI_USAGE.md
- HANDOVER.md
- docs/SECURITY.md

For every significant architecture decision, record:
- Decision
- Reason
- Alternative considered
- Accepted trade-off

Document limitations honestly.

### 10. Verification

Run:
- npm run typecheck
- npm run lint
- npm test
- npm run build
- npm run test:e2e (if configured)

Report which tests actually ran and which were skipped.

Do not claim that a working UI proves concurrency or tenant isolation.

### Completion criteria

The application must support a real end-to-end order-to-kitchen workflow backed by PostgreSQL, with role authorization and safe concurrent mutations.

At the end, report:
1. Files changed
2. Migrations added
3. Working user journeys
4. Security controls
5. Concurrency strategy
6. Tests and actual results
7. Remaining blockers
8. Known limitations

Stop after completing this iteration. Do not implement inventory, AI restocking, payment, or supplier integrations.
```

## 5. Critical audit — verbatim instruction and summary

> Act as a skeptical senior engineer reviewing this project for a demanding AI Product Owner hiring assessment.
>
> Do not assume previous iterations succeeded merely because their reports say so.
>
> Your goal is to independently verify the existing application and fix critical defects, not to add new features.

The audit required actual waiter/kitchen journeys, concurrent mutations checked against final database state, tenant/branch/role/price/transition/revocation attacks, responsive Persian UX, all configured checks, truthful results and a GO/NO-GO recommendation for AI. It explicitly said not to implement AI yet.

## 6. Direct product-review feedback — verbatim Persian excerpts

> تم دارک مود اضافه کن و قابلیت عوض کردن تم داشته باشه
> دیفالت رو هم دارک مود بذار
> فونت متون رو هم یا بکن ب نازنین یا وزیرمتن یا irmitra

> مدیر باید بتونه به همه جا دسترسی داشته باشه
> از طرفی قابلیت سوییچ کردن به حالت پنل گارسون یا اشپز یا مدیر هم بذار

> میز ها رو نمایش شون رو مرتب کن و یه جوری نشون بده که انگار مثلا توی یه سالن چیده شدن میتونی انتخاب کنی اون میز رو و بعد باز بشه. همچنین به ترتیب باشن و با یه فیلتری چیزی قابلیت دیدن میزهای اشغال و ازاد هم وجود داشته باشه

> تعداد میزها رو بکن ۱۲ تا و اسم هیچ میزی هم آزمون نباشه و فقط شماره ی میز باشه

> باید ثبت بشه که چه چیزایی که اماده سرو بودن، توسط گارسون سرو شدن و دیگه تو اشپزخونه نیستن و تموم شده

Additional feedback required a distinction between two-/four-seat shapes, guests seated with menus before ordering, and a waiter freeing the table after guests left so a new party could order. It also identified missing manager order controls and inappropriate coffee icons on food.

## 7. Final freeze and delivery — summary

Prepare a public GitHub repository, deploy the existing artifact, write the requested final Markdown documents and assemble the submission package. Do not change the product or add features. The applicant supplied the name Reina Khosravi, reported approximately 4.5 hours and confirmed that scope had been established in prior planning before implementation.

## Review caution

These prompts explain intent, not completion. For actual implementation/results, read the code, TEST_REPORT.md and AI_USAGE.md. The product's missing AI capability and incomplete final browser matrix are not erased by a prompt requesting them.
