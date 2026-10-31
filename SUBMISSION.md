# MizFlow — assessment submission

**Applicant:** Reina Khosravi

**Estimated effort:** approximately 4.5 hours, applicant-reported

**Product status:** frozen for submission; documentation/hosting only after the freeze

## Review links

- **Live application:** https://mizflow-po-assessment.vercel.app
- **Repository:** https://github.com/ReinaKhosravi/mizflow-po-assessment
- **Demo credentials:** supplied privately through the assessment form; not committed publicly.

The public HTTPS login and anonymous API denial were checked. Owner, waiter and kitchen accounts each signed in, viewed scoped pages with twelve نارون tables, showed their expected controls, used Secure/HttpOnly session cookies and signed out. These were read-only hosting smoke checks: no restaurant orders were changed during packaging.

## Required material

| Brief item                         | Artifact / current status                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Part A: agreed scope               | [SCOPE.md](SCOPE.md); core scope established before implementation, consolidated with later explicit refinements                      |
| Part B: product                    | Live URL above; one real persisted service workflow and realistic fictional café data                                                 |
| Product AI capability              | **Not implemented**; [fit/gap assessment](docs/AI_CAPABILITY_ASSESSMENT.md), not disguised as shipped AI                              |
| Part C: setup and architecture     | [README.md](README.md), [database](docs/DATABASE.md), [security](docs/SECURITY.md), actual migrations/tests                           |
| Part D: decisions and two revisits | [DECISIONS.md](DECISIONS.md), with four corrected choices clearly identified                                                          |
| Part E: AI usage                   | [AI_USAGE.md](AI_USAGE.md) and [principal prompts](docs/submission/AI_PROMPTS.md)                                                     |
| Part F: nontechnical handover      | [HANDOVER.md](HANDOVER.md), plus [Persian staff guide](HANDOVER.fa.md); ranked next five and concrete scale limits                    |
| Verification and omissions         | [TEST_REPORT.md](docs/TEST_REPORT.md), including failures and the interrupted final matrix                                            |
| 5–10 minute recorded walkthrough   | 8-minute narrated frozen-product walkthrough and transcript; synthetic narration is disclosed, not presented as the applicant's voice |
| Documentation ZIP / README upload  | Generated from these final Markdown documents; no credentials or environment files                                                    |
| Walkthrough ZIP                    | MP4, transcript and disclosure; no credentials                                                                                        |

## The defensible argument

The workflow choice was coordination during service, not a broad restaurant ERP. Database-backed authority and append commands protect shared work; kitchen readiness, actual delivery and departure are separate facts. The strongest current evidence is real-role SQL/Auth/API/browser execution with persisted-state checks, not screen polish alone.

## What a reviewer should challenge

AI is missing despite the brief. The final full cross-device matrix was interrupted at the applicant's product freeze; it is not represented as 18/18 success. Full rollout still requires hosted operational/security settings, key hygiene, real-device rehearsal, monitoring and backup restoration. Lists/history/offline work and service exceptions remain bounded as documented. These are actual limits, not generic legal disclaimers.
