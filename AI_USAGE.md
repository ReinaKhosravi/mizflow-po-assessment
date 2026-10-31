# AI usage log

## 2026-10-31 — Initial foundation (Codex)

Codex inspected the empty repository and used create-next-app to generate the Next.js/TypeScript/Tailwind starter. Codex generated the Persian RTL shell, four placeholder pages, sample menu/table content, IRR utility, test configuration/tests, environment example and project documentation.

Codex review covered: strict TypeScript configuration; public fixture labeling; absence of mock authentication, localStorage sessions, service-role secrets and fake backend operations; client/server component boundary; explicit IRR-to-toman conversion; mobile navigation and intended future tenant/concurrency boundaries. Generated tests and build checks are recorded in the handoff. This is an automated engineering review, not a human security audit. The user has not yet approved the scaffold or any next iteration.

No production data, actual credentials or private restaurant information was provided to the generated application. AI recommendations for inventory/restocking are not implemented. Auth, RLS and concurrency designs in documentation are proposals requiring implementation and adversarial tests before production use.
