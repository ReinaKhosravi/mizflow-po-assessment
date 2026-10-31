# Verification evidence at product freeze

## Ground rules

Results below are observed runs, not inferred success from earlier reports. No product changes or business-data test runs are authorized during submission packaging. Read-only deployment smoke checks are reported separately when completed.

Tools observed: Node 26.0.0, npm 11.12.1, PostgreSQL 17.10 (Homebrew), Playwright/installed Chrome. Mobile/tablet coverage is Chromium emulation, not physical iOS Safari certification.

## Completed current checks

| Check                        | Actual result                        | What it establishes                                                                                                         |
| ---------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Typecheck                    | Passed                               | Current TypeScript/routes compile                                                                                           |
| ESLint                       | Passed                               | Current lint rules satisfied                                                                                                |
| Vitest                       | 31 passed                            | Money/input boundaries, permissions, panel preference and natural-number/icon behavior; not tenant-isolation proof          |
| Real disposable PostgreSQL   | 31 reported passed; 0 failed/skipped | 29 scenarios plus 2 parent tests; migrations, grants/RLS/FKs, independent concurrent transactions and persisted final state |
| Real Supabase Auth/PostgREST | 21 reported passed; 0 failed/skipped | 19 scenarios plus 2 parent tests; actual identities/API policy behavior, command replay, service metadata and table reuse   |
| Production build             | Passed                               | Frozen code compiles; does not prove hosted deployment                                                                      |
| Formatting / whitespace      | Passed                               | Final checked development files; packaging docs checked separately                                                          |

PostgreSQL tests use a minimal test-only auth identity bootstrap. That is not proof of GoTrue, PostgREST or cookie refresh; those have separate live tests.

## Browser chronology: do not collapse these into one green number

- Earlier iteration-5A six-/fifteen-case matrices passed for their respective versions. They do not certify the later service/panel revision.
- A full later 18-case run completed with **17 passed, 1 failed, 0 skipped**. The tablet owner/service case reached its five-second waiting-state assertion before the new state appeared.
- The response path was revised to reuse one trusted identity context within the request and to stop background polling from aborting a post-mutation refresh. Unsent choices were also bound to the original party/order.
- The final 18-case run on that corrected revision was **stopped at the explicit request to freeze the product**: **11 passed, 1 interrupted, 6 not run**. This is not an 18/18 pass. The completed desktop lifecycle included panel changes, seating, real preparation/delivery, departure/reopening and stale-cart protection. The waiter-to-kitchen-to-delivery case also passed on tablet. The final tablet-owner and mobile matrix were not completed.

The current submission therefore has a verified full user workflow, but **an incomplete final cross-device matrix**. Increasing an assertion budget is not represented as proof that every timing condition was solved.

## Concurrency and persisted-state assertions

- Two independent waiters append to one order: retain both lines and expected versions.
- Kitchen preparation races with an append: retain the new line and preparation progress.
- Same idempotency key replays one result, one insertion and one audit effect; changed payload is rejected.
- Concurrent table opens create one active order; the loser receives a final conflict.
- Twenty real API appends verify exact final line count, sum, versions and distinct audit versions—not just HTTP success.
- Serving records the authenticated actor/server time once, removes the line from the kitchen projection and preserves the order total/history.
- Two waiters serving the same ready item produce one effect and one explicit conflict.
- Close racing with an append cannot close over silently lost food.
- An old close replay cannot close the next party's order; a table can be reused with a distinct order ID.

## Adversarial coverage

Real SQL and/or actual Auth/PostgREST cover anonymous denial, cross-restaurant reads/writes, branch changes, composite-FK injection, waiter configuration denial, kitchen price/owner-operation denial, role self-escalation denial, revoked membership with an otherwise valid session, forged prices and invalid/stale transitions. Owner staff coverage is a positive control, not a bypass across restaurants.

## Failures retained rather than hidden

Early conflicts used the wrong SQLSTATE; dependent live tests then cascaded with missing order IDs. Those were not seven independent security breaches. Fixed/extra test tables collided with or polluted the shared demo and were replaced by borrowing a free physical table. One later administrative connection timed out before a workflow suite began; a separate independent rerun passed. Initial seed metadata SQL needed an explicit enum cast. The chronological development log preserves these incidents.

## Not tested / deliberately not claimed

- Physical café service, physical phones/tablets or assistive-technology certification.
- An actually expired SSR cookie refresh, forced separately end to end.
- Every production Supabase default, hosted signup/rate-limit configuration or secret rotation.
- Provider-AI failure/cost/injection behavior: no product AI/provider call exists.
- Long-duration/load/failover/backup restoration or the 10/1,000/100,000-restaurant estimates.
- Durable offline recovery, printers, payments, fiscal compliance, invitations, cancellation/partial delivery or historical reporting UI.
- A fully green final browser matrix after the last product revision.

## Deployment-only smoke checks after freeze

The same product was deployed to https://mizflow-po-assessment.vercel.app without changing source functionality. The public login returned HTTP 200; an unauthenticated operations request returned HTTP 401 and did not require a Vercel account. Owner, waiter and kitchen each completed HTTPS login, scoped read-only navigation, a twelve-table count, expected role-control checks, Secure/HttpOnly-cookie inspection and logout. All three passed. No order/menu/membership/preparation/delivery mutation was performed by these hosting checks; they are not a replacement for the interrupted final business-workflow matrix.
