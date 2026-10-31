# Security model and actual evidence

## Threat boundary

Treat restaurant records, staff activity and notes as private—even when the demonstration data is fictional. An attacker may have a valid ordinary account, guess another table/order ID, alter request bodies, replay commands or keep a token after a membership change. A compromised database administrator is a different privileged threat; RLS does not make an administrator harmless.

## Permissions

All successful operations require a verified Supabase identity and active trusted membership.

| Operation                                                       | Owner/manager            | Waiter           | Kitchen          | Anonymous / revoked / unassigned |
| --------------------------------------------------------------- | ------------------------ | ---------------- | ---------------- | -------------------------------- |
| Read own restaurant activity                                    | All own branches         | Assigned branch  | Assigned branch  | Denied                           |
| Seat/open and append order                                      | Own restaurant           | Assigned branch  | Denied           | Denied                           |
| Advance preparation                                             | Own restaurant           | Denied           | Assigned branch  | Denied                           |
| Confirm waiter delivery                                         | Own restaurant           | Assigned branch  | Denied           | Denied                           |
| Release eligible table                                          | Own restaurant           | Assigned branch  | Denied           | Denied                           |
| Allowed menu/table/branch configuration columns, through DB API | Own restaurant           | Denied           | Denied           | Denied                           |
| Membership create/change/revoke through app                     | Not implemented / denied | Denied           | Denied           | Denied                           |
| Direct order/item/event writes                                  | Denied; RPC only         | Denied; RPC only | Denied; RPC only | Denied                           |
| Edit/delete/truncate event history                              | Denied                   | Denied           | Denied           | Denied                           |

The manager panel selector is presentation only. Its HttpOnly cookie is ignored for non-owners; selection does not alter identity or membership. Authorization always uses the actual active database role. A tenant switcher/multi-branch staff membership flow does not exist; the oldest active restaurant membership is selected deterministically.

## Three concrete risks and responses

### 1. A valid user reaches another customer's records

Every private public table has RLS and explicit privileges; branch-specific records carry restaurant/branch scope. Composite foreign keys reject cross-scope references even when a caller has a permitted insert elsewhere. Trusted active membership and branch checks are repeated by authorized mutation routines. SECURITY DEFINER helpers pin empty search paths and expose narrow predicates/commands, not membership dumps. The private command ledger has no ordinary app grants.

**Evidence:** real SQL and actual Auth/PostgREST cross-restaurant read/update, branch-change, composite-FK and role-escalation tests. No fake browser tenant/role switch is used as evidence.

### 2. Stale authority or tampered commands change service state

Server entry points verify `auth.getUser()` and resolve current membership; RLS checks current membership instead of trusting editable metadata. Revoked membership denies subsequent data access even while an access token remains otherwise valid. Mutation membership locks serialize against revocation. Price/name snapshots come from the server menu; clients cannot claim trusted prices, delivery actors or arbitrary transitions. Expected versions, scoped key replay and resource locks protect against stale/duplicate mutations.

**Evidence:** same-identity revocation, forbidden waiter/kitchen operations, forged price, invalid/stale transition, simultaneous mutation, duplicate command and final row/event/version assertions. Data already delivered to a browser cannot be recalled by revocation; the next request is the boundary.

### 3. Privileged provisioning credentials escape into ordinary traffic

The application uses only public Supabase configuration plus the actual user's session. Administrative DB credentials, Auth seed key and development password live in ignored local files for offline tools. No service role bypass is used by ordinary user requests. `.vercelignore` excludes local secret/delivery files; publication packages are independently scanned. Public demo passwords are not committed; reviewers receive them separately.

**Remaining real risk:** an administrative key was previously exposed outside the repository and development-only reuse was explicitly permitted. Rotation is not claimed complete. Revoke/replace it before introducing real restaurant/customer data. Do not mistake a clean repository for proof that an old credential was revoked.

## Session, input and failure behavior

- SSR cookies are HttpOnly, SameSite=Lax and Secure in production. There is no localStorage session or mock authentication.
- Proxy refreshes cookies; protected pages, actions, read helpers and RLS enforce access. Protected responses/operations are private/no-store.
- Server Actions use Next.js's POST/same-origin behavior; inputs/read projections are validated with Zod. Ordinary API query parameters cannot choose a tenant or authoritative role.
- SQL values are parameterized; user strings are rendered as text. The static theme bootstrap only handles a validated appearance preference.
- Missing configuration/auth/database failures fail closed. No public fixtures replace failed restaurant reads, and no success is shown before server confirmation.
- An uncertain command retains its key/payload; old-party drafts cannot be retargeted to a new party.

## Diagnostics and audit

Allowlisted structured warnings contain an event, random reference, timestamp and optional numeric status—not passwords, tokens, emails, request bodies, connection strings or raw SQL errors. These are useful local diagnostics, not a central alerting/tracing service. Transactional order events separately record meaningful business changes and actors. Database administrators can alter/drop schema/triggers; append-only application history is not an external tamper-proof ledger.

## Rollout checks not claimed complete

Configure hosted signup/rate limits/HTTPS and recovery appropriately; verify actual expired SSR refresh, real devices, long-running/load behavior, alerts and backup restoration. One successful build or RLS suite does not prove these. No product AI/provider call exists, so proposed AI failure/cost/injection safeguards are not represented as implemented controls. See TEST_REPORT.md, DEPLOYMENT.md and AI_CAPABILITY_ASSESSMENT.md.
