# Iteration 5A audit — 2026-11-01

Status: audit completed. Known tested flows pass; production and AI remain NO-GO. Do not interpret an earlier iteration report as current evidence.

## Product boundaries

Real: Supabase password identities, active DB memberships, scoped pages, table order opening, append-only item submission, kitchen queued/preparing/ready, polling, persisted snapshots/audit, RTL, dark/light/system and self-hosted Vazirmatn.

Absent: serve/close/cancel UI, table turnover, payment, onboarding/invitations, password recovery, menu configuration UI, tenant switching, inventory, AI. Imported demo historical orders are seeded fixtures, not evidence of prior real restaurant operation. Sample menu source is not used as a failed-DB fallback.

## Findings and fixes

- Prior README/security/order docs claimed operations were read-only despite migration and UI commands. Replaced current-state documentation; historical AI records remain historical.
- Fixed-table test fixtures collided with leftover active orders. Initial API run: 10 passes / 7 failures; initial browser run: 9 passes / 1 failure. Independent test tables now isolate runs; order cleanup preserves audit history and retires its table.
- Found an ambiguous-response UX race: if opening committed but its response was lost, polling could reveal the order and remove the opening retry while retaining its key. The editor now keeps the correct opening retry available and blocks submission until resolved. Browser regression loses the response only after the real server has processed it.
- Added explicit persisted state checks after reload, anonymous polling endpoint checks, tablet coverage and a twenty-operation actual API burst with DB totals, line count, versions and audit verification.

## Demo walkthrough

Use separate browser profiles for narvan.waiter, narvan.kitchen and narvan.waiter2. Use the development password stored locally, not an API key. Open a free table, start its order, add burger with a note and drinks, submit. Kitchen starts preparation then marks burger ready. Waiter sees ready without navigation; second waiter appends pizza without overwriting the burger. Reload and confirm saved items, total and statuses. Table 12 has a separate marked demonstration scenario; the explicit reset command only resets that scenario.

## Release blockers / AI decision

**NO-GO for adding AI.** Verify rollout and recovery of the newly implemented table turnover, independently review authorization, validate actual expired-cookie SSR refresh, add pagination/limits, monitor failures, verify backup restoration, configure hosted Auth/rate limits/HTTPS and rotate any previously disclosed administrative key before production. Current user permission to reuse a development key is not evidence of production secret hygiene.

Polling reads are separate SQL snapshots; they are not a single atomic read model. Kitchen displays only the oldest 100 active items with a warning. Other list queries inherit the API row limit and need pagination; order-item reads now compare exact count and fail closed rather than displaying a truncated total. Pagination is still absent. Unsaved draft selections and idempotency attempts live in memory and do not survive reload. No offline queue exists. Revocation stops subsequent DB access, but cannot erase data already delivered to a browser. Tests cover known cases, not a human penetration test, a full accessibility certification or human service-time study.

## Additional critical findings

The live occupied-table conflict originally used SQLSTATE 40001, which is a retriable serialization failure rather than a final product conflict. Live tests timed out; local SQL tests had passed. Forward migration 202611010002 was tested locally and applied atomically to the confirmed demo. It changes those domain conflicts to PT409. Independent HTTP probes then returned an occupied-table conflict in about 0.2 seconds. The complete real API suite passed 19 reported tests (17 scenarios plus two parent tests), zero skips/failures, including twenty concurrent appends.

The dashboard also still told users ordering was disabled. Corrected that message, preserved the distinction between reload-only dashboard counts and polling operational pages, and excluded inactive tables from operational views/counts. Exact item count now guards against presenting an incomplete order total when the API truncates rows. Long labels wrap rather than overflowing.

## Test interpretation

Initial failures were not seven independent security breaches: after the opening assertion failed, dependent requests lacked an order ID and produced schema/payload errors. Those errors are not evidence that a forged price or unauthorized write was accepted. Final negative tests require the expected denial code and inspect persisted values. A subsequent repeat had 10 security passes but a workflow-suite administrative connection timeout before its cases ran; this external connection failure is retained in AI_USAGE rather than hidden.

The first successful three-profile browser run passed all 15 tests, zero skips, with automated workflow cases around 38–40 seconds including several real logins, polling and deliberately induced offline/response-loss recovery. This is not a measured human service-time SLA. Mobile/tablet coverage uses Chromium viewport emulation, not physical iOS Safari devices. Visual review covered Persian layout, typography, status text, touch-sized quantity/action buttons and navigation; it is not a complete WCAG or assistive-technology audit.

## Verified commands and evidence

Environment independently checked: Node v26.0.0, npm 11.12.1, PostgreSQL 17.10 (Homebrew). Normal user paths use the configured Supabase Cloud project, not the PostgreSQL bootstrap. The migration history query returned exactly 202610310001, 202611010001 and 202611010002. A reviewed cleanup cancelled one leftover explicitly marked automated-test order and appended its cleanup event; unmarked orders were left untouched.

| Command                                           |                     Passed | Failed | Skipped |
| ------------------------------------------------- | -------------------------: | -----: | ------: |
| `npm run typecheck`                               |                        yes |      0 |       0 |
| `npm run lint`                                    |                        yes |      0 |       0 |
| `npm test`                                        |                         28 |      0 |       0 |
| `npm run test:db`                                 | 26 reported / 24 scenarios |      0 |       0 |
| `npm run test:supabase` (final independent rerun) | 19 reported / 17 scenarios |      0 |       0 |
| `npm run build`                                   |                        yes |      0 |       0 |
| `npm run format:check`, `git diff --check`        |                        yes |      0 |       0 |

Production browser command: `MIZFLOW_E2E_PRODUCTION=1 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`. Successful first clean run: 15 passed, 0 failed, 0 skipped. Final visual-fix rerun also passed all 15 tests, zero failures/skips, in 2.6 minutes. Workflow cases took 39.2s desktop, 38.3s tablet and 38.4s mobile. Neither live suite silently retries failures to report success; the separate failed connection run remains documented.

## Files changed by this audit

- New forward migration `supabase/migrations/202611010002_domain_conflicts.sql`; bounded exact-history application support in `scripts/apply-workflow-migration.mjs`.
- Order editor ambiguous-open recovery; workflow error mapping/contract test; exact item-count guard; active-table operational queries; dashboard message; small contrast/wrapping fixes in globals.css.
- Independent fixture helpers, real PostgREST burst/role/revocation tests, expanded Playwright workflow/reload/anonymous checks and tablet configuration; E2E command loads ignored explicit test configuration.
- README, DECISIONS, AI_USAGE, this handover, database/security/feature documentation and test CA configuration example.

Existing uncommitted earlier-iteration changes were preserved. No deployment of the Next.js app, public publishing, repository commit or AI implementation was performed. No credential is missing for this development demo; production Auth settings, key rotation, monitoring and backup restoration remain unverified external prerequisites.

Final review: the last full real API run passed 19/19 with zero skips/failures, including the added kitchen-price persisted-value check. The final production browser run passed 15/15 with zero skips/failures after the contrast fixes. Desktop/tablet/mobile screenshots were inspected. Quantity controls are 44px and main kitchen/submit controls at least 48px; roles/statuses have text labels as well as color. Typecheck, lint, 28 unit tests, build and formatting passed on the final code; PostgreSQL integration passed 26/26 on the corrected migrations. Earlier failed/interrupted dependency runs remain documented above. No application work is pending within this audit; the listed production blockers remain unresolved and require a separately approved iteration.

## User follow-up: all manager workflows, panels, ordering and hall layout

This supersedes the earlier owner-read-only workflow decision: managers may now open/append orders and prepare/ready items in every branch of their own restaurant. Other roles retain their assigned permissions. Owners can select manager/waiter/kitchen work panels; this changes the presentation, not stored membership or authentication. Staff cannot elevate themselves using that preference. Migration 202611010003 is applied on the confirmed demo.

Navigation/menu now expose order entry. Menu icons follow actual food/drink categories and names. Tables use an illustrative hall layout with Persian natural number ordering and all/free/occupied filters; choosing a table opens its persisted order. The two older active test tables were renamed میز ۱۳ and میز ۱۴ with orders preserved. No inventory, AI, physical floor-plan editor or completion/payment flow was added. Prior audit counts and permissions above are historical; current follow-up verification is recorded below.

## Latest user-requested service completion

Supersedes the earlier “no close/serve” limitations: per-item waiter/owner serving, server actor/time, kitchen removal, seated-awaiting-order state, additional rounds, explicit departure/freeing and a distinct order for the next party are now implemented. No payment flow exists. The hall now has exactly twelve active canonical نارون tables numbered ۱–۱۲, with eight four-seat rectangles and four two-seat circles. Legacy fixture histories remain on inactive numbered tables. Tests now borrow a free physical table rather than creating visible test tables.

Migration 202611010004 was tested against real PostgreSQL and applied atomically to the exact demo. Real Supabase verification passed 21 reported tests, zero failures/skips, including actual waiter serve/close/reopen and persistent server actor/time. Local PostgreSQL passed 31 reported tests, including two-waiter serve races and close-vs-append races. Typecheck/lint/build and 31 unit tests passed. Browser lifecycle/panel/hall verification is being recorded below after completion. Earlier runs were interrupted as the user expanded the active scope; the owner panel navigation race found during that work was corrected using one fresh navigation after persisting the owner-only preference.
