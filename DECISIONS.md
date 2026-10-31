# Engineering and product decisions

**MizFlow · Reina Khosravi**

These are the final decisions for the frozen implementation. Earlier iteration notes are preserved in [the development log](docs/history/DECISIONS_DEVELOPMENT_LOG.md). “Revisited” entries identify choices that were wrong or insufficient, not decisions rewritten to look inevitable.

## 1. One service workflow before a restaurant suite

**Decision:** build seating → ordering → preparation → delivery → table release; leave payment and inventory separate.

**Reason:** coordination is shared by waiter and kitchen on every order, and concurrent edits can be tested concretely.

**Alternative:** implement a shallow menu/POS/inventory/reporting suite.

**Trade-off:** the product cannot replace an existing payment/POS system. Discounts and purchasing are deliberately absent.

## 2. A server-rendered app with one database authority

**Decision:** Next.js App Router, strict TypeScript, Zod, Supabase Auth/PostgreSQL and narrow feature modules.

**Reason:** keep identity verification and mutations on the server and make the code reviewable within the time box.

**Alternative:** a client-only app or separate API service with additional infrastructure.

**Trade-off:** framework/session behavior must be tested carefully. There is no abstraction layer pretending the database could be swapped cheaply.

## 3. Tenant isolation below the UI

**Decision:** restaurant/branch scope in records, composite foreign keys, explicit grants, RLS and current database memberships.

**Reason:** hiding a menu or filtering a list cannot prevent a crafted request.

**Alternative:** authorize only in application code or trust tenant/role fields from the client/JWT metadata.

**Trade-off:** SQL policies and SECURITY DEFINER routines need disciplined review. A database administrator remains a privileged operator; application RLS is not a defense against a compromised administrator.

## 4. Serialize mutations per order, not the whole restaurant

**Decision:** locked database RPCs, a partial unique active-table-order index, item versions and an actor/command/target/payload-bound idempotency ledger.

**Reason:** append operations and kitchen progress should commit independently without full-order replacement. Events commit with the mutation.

**Alternative:** last-write-wins JSON replacement or client-side optimistic updates without database checks.

**Trade-off:** a hot order is a serialization point. This is intentional for a small café; it is not a throughput claim for a stadium or a benchmark at scale.

## 5. Final product conflicts need final responses — corrected

**Decision:** return PT409 for occupied-table/stale-state business conflicts.

**Reason:** the first generated implementation used SQLSTATE 40001. Local SQL tests passed, but real PostgREST conflict requests stalled. A forward migration corrected the distinction; bounded live probes then returned promptly.

**Alternative:** keep a serialization-failure code or silently retry every conflict.

**Trade-off:** clients must handle explicit conflict/reload. **The original choice was wrong; local database success was insufficient evidence of HTTP behavior.**

## 6. Manager coverage, not artificial read-only management — corrected

**Decision:** an active owner can operate all existing order/kitchen workflows within their restaurant; waiter and kitchen remain narrower.

**Reason:** the owner must cover for staff during a shift. Reviewer feedback exposed that the earlier owner account could inspect but could not place an order.

**Alternative:** retain owner read-only order/preparation access in the name of least privilege.

**Trade-off:** owners have broader operational powers. A manager panel preference does not create a new identity, grant staff privileges or expose another tenant. **The initial role boundary was a product mistake.**

## 7. Polling now, revisit delivery architecture with evidence

**Decision:** authenticated short-interval polling, paused while hidden, with visible connection state and a ten-second request deadline. Reuse the verified context within a request; background polling does not cancel a post-mutation refresh.

**Reason:** simple authorization and cleanup were preferable to rushed realtime subscription rules. A tablet verification exposed a refresh timing failure and repeated identity resolution.

**Alternative:** Supabase realtime subscriptions or an event-delivery service.

**Trade-off:** eventual display updates and substantial read/Auth traffic. Revisit polling well before a large rollout; it is not instantaneous notification or offline synchronization.

## 8. Ready, delivered and departed are different facts

**Decision:** kitchen readiness, waiter delivery and guest departure are separate operations. Store served actor/time and append history; allow another round before departure.

**Reason:** ready food can still be waiting at the pass, and delivered food does not mean the party left.

**Alternative:** free a table when kitchen marks ready, or close the service as a payment event.

**Trade-off:** explicit staff actions are required. Partial delivery within a multi-quantity line, arbitrary cancellation and financial settlement remain outside this implementation.

## 9. Stable physical tables; disposable orders — corrected

**Decision:** keep twelve canonical نارون tables and borrow a genuinely free table for live tests; clean only explicitly tracked test orders. Archive old fixture tables and retain history.

**Reason:** generating new test tables polluted the user's visible hall. Fixed table 10 also collided with leftover active orders.

**Alternative:** keep creating visible fixture tables, or overwrite a fixed table before each run.

**Trade-off:** live suites must run sequentially and refuse an occupied resource. **Both earlier fixture strategies were unsuitable for a shared demo.**

## 10. Preserve intent across failures and party changes

**Decision:** uncertain commands retain their original key/payload; a cart is bound to its original order. A new party cannot inherit its selections.

**Reason:** network uncertainty is not permission to duplicate an order or retarget food to a different guest.

**Alternative:** generate a new key on every retry or silently move selections to the newly active order.

**Trade-off:** staff may need to resolve/retry or explicitly clear old selections. Unsent state still does not survive reload; there is no durable offline queue.

## 11. Persian service conventions and honest demo data

**Decision:** Persian RTL, self-hosted Vazirmatn, explicit integer-IRR/toman conversion, touch controls, semantic food icons and separate fictional cafés.

**Reason:** a realistic Iranian staff experience matters more than a generic admin template.

**Alternative:** English LTR screens, floating money values or one coffee icon for every food item.

**Trade-off:** imported demo history is illustrative, not evidence of merchant adoption. Iran-specific payment/tax compliance has not been implemented or researched to a legal standard.

## 12. Do not invent AI or a production claim for the submission

**Decision:** freeze the current product as requested and disclose the missing AI capability and incomplete final browser matrix.

**Reason:** documents should explain the actual artifact, including evidence limits.

**Alternative:** call deterministic screens “AI,” claim every test passed, or implement an unreviewed inventory assistant during packaging.

**Trade-off:** the submission openly falls short of the brief's AI requirement. The defensible proposed next capability is grounded shift insight, not autonomous procurement; it is not represented as shipped.
