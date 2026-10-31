# AI capability: fit, limits and explicit delivery gap

## Current product

There is no AI feature, model call, AI provider key or AI-generated restaurant recommendation in the frozen application. Use of Codex to build the application is not an AI capability of the product. The assessment's “at least one AI capability” line is therefore not fulfilled by this artifact. The applicant requested a product freeze during final packaging; documentation does not change that fact.

## Why not autonomous restocking?

The chosen workflow records orders, preparation, delivery and table service. It does not model ingredients, recipe yields, inventory counts, waste, supplier lead times or purchase confirmations. Recommending quantities or purchases from item popularity alone would imply knowledge the system does not have. Autonomous purchasing would add financial and operational risk unrelated to the narrow workflow proved here.

## The narrow next capability considered: grounded shift insights

A useful small extension would explain an already-computed shift report: which items waited longest, which period was busiest and one or two operational follow-ups. Counts and durations must be computed deterministically from trusted records. A model may explain the report; it must not invent counts, read another tenant, change prices/orders, send messages or place purchases.

The following is a **design proposal, not implemented safeguards**:

| Concern          | Proposed boundary                                                                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider failure | Keep the numeric report usable without the provider; show a clear unavailable state for the narrative                                                       |
| Latency          | Generate on explicit manager request after a shift, with a short bounded timeout; never block ordering or kitchen work                                      |
| Cost             | One cached narrative per closed shift/report version; strict token limit and per-restaurant budget; no per-poll/model calls                                 |
| Prompt injection | Treat menu names and preparation notes as untrusted data; provide minimal structured aggregates, not raw staff instructions; no tools or action permissions |
| Privacy          | Resolve scope server-side, minimize payloads, exclude credentials/customer identifiers and review provider retention before sending data                    |
| Accuracy         | Schema-validate output, prohibit invented metrics, attach underlying report references and label advice as suggestions                                      |
| Evaluation       | Compare against deterministic aggregates; test malicious notes, empty reports, timeout, malformed output and budget exhaustion                              |

Before building it, validate whether owners would act on that explanation more readily than a clear numeric report. If not, the correct product decision may be a non-AI report—but that would still need explicit agreement with the assessment reviewer, not an unannounced substitution.
