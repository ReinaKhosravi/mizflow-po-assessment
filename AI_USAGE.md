# AI usage and authorship disclosure

**Project:** MizFlow

**Applicant:** Reina Khosravi

**Reported effort:** approximately 4.5 hours (applicant estimate)

## Tools and their actual roles

| Tool                                        | Use                                                                                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| ChatGPT product-planning conversation       | Explore a narrow Iranian café workflow, sequence the work and formulate implementation/review prompts                                              |
| Codex                                       | Inspect/scaffold the repository; generate and revise UI, authentication, SQL/RLS/RPCs, seed tooling, tests and documentation; investigate failures |
| TypeScript, ESLint, Vitest                  | Static checks and focused boundary/formatting/permission tests                                                                                     |
| Real PostgreSQL 17.10                       | Apply actual migrations in a disposable cluster; exercise roles, grants, FKs, RLS, transactions and concurrency                                    |
| Supabase Auth/PostgREST                     | Verify actual demo identities, scoped API behavior, roles, revocation, command replay and lifecycle operations                                     |
| Playwright with Chrome                      | Real authenticated desktop/tablet/mobile-emulated journeys, offline/response-loss recovery and persistent state                                    |
| GitHub/Vercel CLI and local recording tools | Submission publication and packaging of the frozen artifact; not new product features                                                              |

## Human direction versus generated implementation

The applicant established the customer/market, Persian RTL, currency convention, primary service workflow, tenant/security expectations and deliberate payment/inventory exclusions before implementation. Direct review feedback also required manager coverage, usable order entry, food-specific icons, a twelve-table hall, seating before an order, individual delivery and table reuse.

Codex proposed and wrote substantial architecture and implementation details, including the SQL authorization/locking approach, SSR integration, component structure and tests. This submission does **not** claim those details were all independently authored by the applicant. Accepting, reviewing and defending them remains the applicant's responsibility. Automated checks and Codex review are not a human penetration test or merchant pilot.

## Where AI saved real time

- Generating consistent schema/FKs/policies and negative-test fixtures across tenant-owned tables.
- Repeating the Persian RTL shell and operational states without starting a separate design system.
- Producing bounded transactional commands and exercising concurrency with independent connections.
- Connecting real Auth/PostgREST and browser verification, rather than relying on mocked happy paths.
- Consolidating final delivery documents from the actual source and observed results.

## Where generated work was bad or incomplete

1. The first manager boundary made owners read-only for operations. User review exposed that the apparent “manager” could not take an order.
2. Generated menu cards used a coffee icon for every item. Product review required food-specific symbols.
3. A fixed live-test table collided with leftover orders; generating extra test tables then polluted the shared hall. The final test helper borrows a free physical demo table instead.
4. SQLSTATE 40001 was used for a business conflict. PostgreSQL-only tests passed but live PostgREST calls stalled; a forward migration changed final conflicts to PT409.
5. A resolved failed login action reset uncontrolled fields, preventing a straightforward retry. Controlled fields and a real wrong-password/correct-password browser regression addressed it.
6. An uncertain open response could lose its visible retry after polling revealed the order. A committed-response-loss regression exposed the required recovery behavior.
7. A later tablet lifecycle check timed out during refresh. Repeated identity reads and background cancellation were corrected; final verification status remains explicitly bounded below.

## One recommendation rejected

The generated least-privilege interpretation restricted owners to reading order/kitchen activity. The applicant rejected that recommendation: a small-café owner must be able to cover a waiter or cook. The correction grants operational commands only within an active owner's own restaurant; it does not let staff choose their own role or cross the tenant boundary.

## How generated code was verified

No successful report was accepted as sufficient evidence by itself. Checks used actual migrations and independent database connections, real Supabase users/tokens, persisted row/event/version inspection, role/tenant/branch adversarial requests and real browser sessions. Price inputs are not authoritative. Production routines never use the offline administrative key.

The latest completed unit, PostgreSQL and Supabase results are in [TEST_REPORT.md](docs/TEST_REPORT.md). The final browser run was deliberately stopped when the applicant requested no further product work: 11 passed, 1 interrupted, 6 not run. A previous complete run had 17 passed and one tablet timeout. Earlier successful matrices do not prove the final frozen revision passed the entire matrix. No missing result is presented as success.

## Prompts and evidence

[AI_PROMPTS.md](docs/submission/AI_PROMPTS.md) provides the principal prompts and labels verbatim excerpts versus summaries. Secrets, passwords and private connection strings are excluded. The fuller chronological development log is retained in [docs/history](docs/history/AI_USAGE_DEVELOPMENT_LOG.md); earlier entries describe earlier states, not the final feature set.

## Product AI is different from development AI

The frozen product contains no AI capability. The external brief requires one, so this is a disclosed delivery gap. [AI capability assessment](docs/AI_CAPABILITY_ASSESSMENT.md) explains why a grounded shift explanation would fit better than autonomous inventory recommendations and distinguishes proposed failure/cost/injection controls from code that actually exists.

## Scope and timebox

Core scope was established before implementation; the submitted SCOPE consolidates those decisions and later explicit refinements. The applicant reports approximately 4.5 hours. No independent stopwatch record is claimed. Packaging and hosting do not authorize new product features; source code is frozen and checked against a local hash manifest during this delivery step.

## Final delivery preparation

After the explicit product freeze, only documentation, publication metadata and delivery artifacts were prepared. A hash manifest of 94 source/configuration/asset files was used to check that product code stayed unchanged. The existing app was deployed to Vercel, with only its two public Supabase runtime variables configured; ignored administrative/seed files were excluded. Read-only hosting smoke checks passed for owner, waiter and kitchen. No business data was changed for recording.

The walkthrough uses actual captured production screens and generated chapter cards, with installed macOS Samantha synthetic narration and FFmpeg encoding. It is explicitly not the applicant's voice or a recording of a live customer shift. More than half explains scope, trade-offs, evidence and limitations. The public code/documentation packages contain no passwords or administrative environment files; demo access is delivered separately.
