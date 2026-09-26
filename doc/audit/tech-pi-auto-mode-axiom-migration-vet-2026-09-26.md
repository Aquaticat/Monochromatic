# Pi auto-mode axiom migration vetting

## Metadata

- Status: in progress; targeted route audit, no recommendation.
- Started: 2026-09-26.
- Last updated: 2026-09-26.
- Subject: Pi auto-mode axiom migration.
- Owner: `01a0dc52-0955-77f6-ae77-68a6e15bb12b`.
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`.
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Compatibility fingerprint: `4a2938840ff56544f24ad0d2dd543431c94baa1e18db815adb8ee68af297ea8d`.
- Prior compatible report: none; the historical Laya-only context is incompatible.
- Scope override: only the user-authorized candidate families, no unrestricted vendor discovery.

Fingerprint input, with sorted keys and sets; hash computed from compact canonical JSON:

```json
{
  "baseCategories": [
    "inspectable-open-source-local",
    "managed-service"
  ],
  "deployment": {
    "candidateHost": "Linux x86_64 workstation",
    "platformScope": "first workstation only",
    "runtime": null
  },
  "hardConstraints": [
    "Additional manual approvals acceptable",
    "Complete current AGENTS.md and stale-result invalidation",
    "Five-second total assessment budget including at most one transport retry",
    "Laya Voyage and Jev only; prefer LLM Gateway over OpenRouter",
    "Models estimate narrow axioms; deterministic code owns actions",
    "No implementation before final shared-understanding confirmation",
    "No private uploads now; future non-secret runtime content conditional on audit",
    "Preserve safety boundaries and human grant provenance",
    "Zero coding-plan judge calls including fallback"
  ],
  "incumbent": "pi-plugin-auto-mode@0.0.2",
  "overlays": [
    "high-trust-execution",
    "incumbent-replacement",
    "native-model-runtime",
    "sensitive-data"
  ],
  "schemaVersion": 1,
  "scope": "Authorized axiom assessors and deterministic-policy migration; no product implementation",
  "subject": "Pi auto-mode axiom migration",
  "trustBoundary": "Tool-call authorization over private runtime input with explicit human grant provenance"
}
```

## Scope and authority

This report supersedes the initial Laya-only audit for current selection work.
The [historical report](tech-pi-auto-mode-laya-migration-vet-2026-09-26.md) preserves its original scope.
Current requirements and experiments are recorded in the
[axiom design](../planning/pi-auto-mode-axioms.md)
and [migration interview](../planning/pi-auto-mode-laya.md).
No candidate is recommended or adopted.
Production implementation remains blocked pending confirmed shared understanding.

The user explicitly limits evaluation to Laya,
relevant Voyage products/models,
and Jev.
LLM Gateway is preferred over OpenRouter.
This named scope overrides unrestricted alternative discovery;
it does not waive source,
privacy,
execution,
or validation gates.
The incumbent is a responsibility baseline,
not an eligible coding-plan fallback.

## Confirmed constraints

- Models estimate narrow axioms;
  deterministic code owns policy and final actions.
- Zero coding-plan judge calls,
  including fallback.
- Preserve deterministic blocks,
  provenance,
  canonicalization,
  and manual/headless behavior.
- Complete current `AGENTS.md` accompanies every guard assessment.
  Reject stale results rather than authorize under an obsolete snapshot.
- First deployment is this Linux workstation.
- Five-second total interactive assessment budget,
  including at most one transport retry.
  No separate full budget for the retry.
- Additional manual approvals are acceptable.
- New grants present explicit human-confirmed scope alongside original prose.
  Approved prose remains eligible for qualified narrow-axiom matching.
- Future private non-secret runtime content is conditionally eligible after a satisfactory data-handling audit.
  No private upload is authorized now.
  Raw histories and credentials as assessment content remain excluded.
- Offline evaluation uses independently labelled synthetic cases with reserved scenario groups.
  No ongoing transcript capture.
- Laya probes remain bounded to 8 GiB,
  2 CPUs,
  no added swap,
  no network or host mounts,
  300 seconds,
  and one inference container at a time.
  Training and paid external compute are not authorized.

## Candidate ledger and evidence status

### Laya local runtime

Base: inspectable open-source local technology.
Overlays: incumbent replacement,
high-trust local execution,
native runtime,
and sensitive-data handling.
Source revision: `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`,
version 0.3.20.
Checkpoint provenance and CPU attention investigation are linked from the current design.
Full-policy runtime acceptance was verified with a consumer-side attention setting.
The tested CPU forwards do not fit the newly accepted interactive budget.
They used a retired direct-verdict task,
so their output labels cannot establish axiom quality or reject every authorized Laya configuration.
Axiom-batch fit,
fine-tuning feasibility,
complete source/maintenance gates,
and consumer integration remain open.

### Jev through LLM Gateway

Base: managed inference and gateway services.
Any proposed local adapter is a separate inspectable high-trust component.
Overlays: incumbent replacement,
sensitive-data routing,
and authorization evidence.
Selected probe model: `typesafe/jev-1.13.0`.
Native Noul access and six full-policy synthetic development requests succeeded.
Those requests yielded 57 model estimates,
not final-action answers.
The diagnostic action matches hide an uncertain prohibition estimate;
no calibration or provider choice follows from them.
Data handling,
route identity,
input overflow,
retry behavior,
and service gates remain open.

### Jev through OpenRouter

Base: managed gateway and inference services.
Secondary authorized route,
not the preferred route and not a coding-plan fallback.
Access was verified using `typesafe/jev-1.13` with provider fallbacks disabled.
Historical direct-verdict quality comparisons are withdrawn.
No equal-depth axiom evaluation or data-handling audit is complete.

### Relevant Voyage services

Base: managed inference service.
A local client would be a separate inspectable high-trust component.
Legacy `api.voyageai.com` rerank-3 access was verified.
Relevance scores are not axiom truth probabilities.
A calibrated assessment role or independently justified auxiliary role remains unestablished.
Atlas lifecycle documentation does not automatically govern the verified legacy endpoint.
No candidate is promoted to finalist or rejected solely from the old verdict-ranking pilot.

## Preferred-route audit schedule

This finite targeted schedule is frozen before new external lookups:

- Fetch official LLM Gateway System One feature and API reference pages.
- Search current official material with the literal query
  `site:llmgateway.io System One TypeSafe Jev privacy logging retention retries timeout provider`.
- Follow the official source repository link and inspect the System One route,
  provider adapter,
  request schema,
  error handling,
  logs,
  project settings,
  and relevant tests at a pinned revision.
- Follow official privacy,
  terms,
  logging,
  model catalog,
  and upstream TypeSafe links relevant to that route.
- Probe only missing request-boundary facts with public/synthetic content,
  after inspecting the proposed client execution path.

Record exact URLs,
queries,
revisions,
result limits,
and evidence gaps as work proceeds.
This is a targeted route audit,
not a claim of unrestricted discovery saturation.
No private source,
session data,
or credential is search content.

## Rubric and remaining gates

No candidate-specific ratings or scores are assigned.
Latency is a hard interactive constraint,
not a soft advantage that can excuse unsafe authorization.
A score rubric will be frozen before rating validated candidates.
User preferences do not waive held-out qualification or source gates.

Still required:
complete incumbent responsibility coverage;
full per-axiom reference labels;
provider routing and terms;
request and model-input completeness;
source and artifact provenance;
maintenance and service history;
qualified deadline and retry behavior;
images and hostile-content boundaries;
privacy-safe diagnostics;
and real Pi consumer-boundary verification in a disposable environment.
The initial prototype has fixture admission assumptions,
not a production effect extractor.

## Current outcome

In progress,
no recommendation.
The latest interview choices are documented,
but do not constitute final design confirmation or adoption.
