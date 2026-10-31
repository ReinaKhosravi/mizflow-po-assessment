# MizFlow — agreed first-release scope

**Applicant:** Reina Khosravi

**Estimated effort:** approximately 4.5 hours, applicant-reported

**Customer:** an independent Iranian café, used as the first-customer scenario

## Scope provenance

The target customer, Iranian context, primary workflow, roles, tenant boundary and main non-goals were established before implementation in the product-planning conversation and initial build brief. This document consolidates that agreed scope. Manager coverage, explicit seating/serving/table release, and the twelve-table presentation were subsequently refined through direct review feedback. The consolidated file is prepared for submission; it is not backdated, and does not imply that every detail was fixed before the first line of code.

## 1. The customer problem

A waiter writes a table request, the kitchen receives another version, and a later drink or preparation change is lost between people. The first release should replace that coordination gap with one shared, trustworthy service record. It should not attempt to replace the restaurant's entire business in a six-hour assessment.

The initial customer is a small café with roughly 10–20 tables, several staff working at once, and one kitchen. A restaurant may have multiple branches. Separate restaurants are separate customers, not merely UI filters.

**Primary outcome:** a seated party's food reaches the kitchen and is delivered to the correct table without silently losing concurrent changes. Staff can then release the table and start a distinct record for the next party.

## 2. Market assumptions and validation boundary

- Persian is the working language; layout, labels, numbers and touch controls should support a Persian RTL service.
- Staff and owners expect toman prices. Store integer IRR and explicitly display IRR ÷ 10 as toman; do not mix units or infer payment settlement.
- Mobile/tablet use, brief preparation notes and intermittent connectivity are design assumptions. They are not claimed findings from merchant interviews.
- Existing payment/POS processes continue separately. This release makes no claims about Iranian fiscal invoicing, payment-provider certification, VAT or legal compliance.

The evidence here is the supplied market brief, scenario-based product planning, implemented workflow and direct reviewer feedback. No field study, live restaurant pilot or invented customer quotation is represented as research.

## 3. Included workflow

1. **Seat:** select a free physical table and record that guests have been seated and given menus. Show “awaiting order.”
2. **Order:** select actual menu items, quantities and optional preparation notes. Submit only after a deliberate staff action.
3. **Prepare:** kitchen sees the table, items, quantities, notes and submission time; advance queued → preparing → ready.
4. **Extend:** another waiter may append a drink or pizza without replacing prior items or kitchen progress.
5. **Serve:** waiter marks each ready line delivered. Record the authenticated actor and server time, retain history, and remove the served line from the kitchen queue.
6. **Continue or depart:** guests may order another round. A fully served table remains occupied until staff confirm departure. An empty seated party may also leave without ordering.
7. **Reuse:** close the service and let the next party start a new order on the same physical table. Do not reuse the previous party's order or silently carry its unsent selections forward.

The initial نارون demonstration has twelve active tables numbered ۱–۱۲: eight four-seat tables and four two-seat tables. The hall is an illustrative layout, not a surveyed floor plan. Filters distinguish free, occupied and awaiting-order tables.

## 4. People and authority

| Role          | Work it must support                                                                           | Boundary                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Owner/manager | View own restaurant branches, take orders, operate kitchen, serve and release tables           | No access to another restaurant; no unimplemented staff-administration powers     |
| Waiter        | Seat parties, submit/append items, read preparation, serve ready food, release eligible tables | Assigned branch; cannot edit menu prices or perform kitchen preparation           |
| Kitchen       | Read submitted work and update preparation                                                     | Assigned branch; cannot claim waiter delivery, release tables or edit menu prices |

Manager work-panel switching changes the working view, not identity, membership or the underlying tenant boundary. Staff cannot grant themselves another role.

## 5. Acceptance conditions

- A real authenticated waiter can complete the order-to-kitchen workflow, and persisted state survives reload.
- A ready line is not treated as delivered until waiter/owner confirms delivery. Delivered lines have a traceable actor/time and leave kitchen work.
- A table with unserved food cannot be freed. Departure/reopening creates a distinct party/order record.
- Two concurrent appends retain both additions; preparation racing with an append retains both effects.
- A repeated command with the same actor/key/target/payload creates one effect and one event. A conflicting command fails explicitly.
- Two simultaneous opens cannot create two active orders for one table.
- Server/database authorization rejects anonymous, revoked, wrong-role, wrong-branch and cross-restaurant requests. Database relationships reject cross-scope references.
- Client prices and claimed roles/tenants are not authoritative. Submitted prices are integer server snapshots.
- Loading, empty, offline/error and uncertain-result states do not pretend success or substitute mock restaurant data.

## 6. Exclusions

Payment/discounts/checkout, fiscal invoices, inventory, suppliers, autonomous purchasing, invitations/onboarding, password recovery, tenant switching, multiple-branch staff assignment, kitchen printers, durable offline ordering, floor-plan editing and production operations infrastructure are not in this release. Database configuration permissions do not imply configuration screens exist.

## 7. AI boundary and assessment mismatch

The project plan explicitly deferred AI while transactional service was being verified. No AI capability exists in the frozen product. The assessment brief asks for one; this remains an unmet requirement, not a capability hidden behind documentation. See [AI capability assessment](docs/AI_CAPABILITY_ASSESSMENT.md) for the narrow, defensible extension considered and its failure/cost/injection boundaries. No feature is being added during submission packaging.

## 8. Release decision

This is a real persisted, authenticated assessment implementation, suitable for a supervised demonstration and controlled pilot. It is not a claim of an independently audited production rollout. Before sole reliance during a paid shift, validate real devices/network conditions, hosted Auth/rate limits, monitoring, key rotation and backup restoration. The verification record distinguishes completed checks, earlier failures and the final browser run interrupted at the requested product freeze.
