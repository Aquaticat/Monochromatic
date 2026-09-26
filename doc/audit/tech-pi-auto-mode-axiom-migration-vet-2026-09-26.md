# Pi auto-mode axiom migration vetting

## Metadata

- Status:
   in progress;
   targeted route audit,
   no recommendation.
- Started:
   2026-09-26.
- Last updated:
   2026-09-26.
- Subject:
   Pi auto-mode axiom migration.
- Owner:
   `01a0dc52-0955-77f6-ae77-68a6e15bb12b`.
- Governing skill commit:
   `a05818ad70a40e5769a36de669697ba109891b31`.
- Governing skill SHA-256:
   `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Compatibility fingerprint:
   `4a2938840ff56544f24ad0d2dd543431c94baa1e18db815adb8ee68af297ea8d`.
- Prior compatible report:
   none;
   the historical Laya-only context is incompatible.
- Scope override:
   only the user-authorized candidate families,
   no unrestricted vendor discovery.

Fingerprint input,
 with sorted keys and sets;
 hash computed from compact canonical JSON:

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

Base:
 inspectable open-source local technology.
Overlays:
 incumbent replacement,
high-trust local execution,
native runtime,
and sensitive-data handling.
Source revision:
 `4066d5d5fbf08b66c6757ddeedbd797bd7655bc0`,
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

Base:
 managed inference and gateway services.
Any proposed local adapter is a separate inspectable high-trust component.
Overlays:
 incumbent replacement,
sensitive-data routing,
and authorization evidence.
Selected probe model:
 `typesafe/jev-1.13.0`.
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

Base:
 managed gateway and inference services.
Secondary authorized route,
not the preferred route and not a coding-plan fallback.
Access was verified using `typesafe/jev-1.13` with provider fallbacks disabled.
Historical direct-verdict quality comparisons are withdrawn.
No equal-depth axiom evaluation or data-handling audit is complete.

### Relevant Voyage services

Base:
 managed inference service.
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

## Preferred-route evidence gathered on 2026-09-26

### Discovery and source provenance

The frozen Radius query returned six results with `max_results: 8`,
search ID `search_dbbd95595c6ac6b9a78f967c3faa17de`.
All returned URLs were on `llmgateway.io`.
No unrelated candidate was added.
A bounded expansion queried
`site:docs.typesafe.ai Jev context limit truncation maximum input tokens security guardrails moderation`
to resolve missing overflow and intended-use documentation.
It returned four results with `max_results: 6`,
search ID `search_8d92ca62d6b7d6a3a21616379a353b5f`.
Neither response supplies pagination or an exhaustive-discovery guarantee;
no saturation claim is made.

Official System One documentation links the public source repository:
<https://github.com/theopenco/llmgateway>.
A process-managed shallow clone completed at
`~/temp/agent/llmgateway-auto-mode-source-2026-09-26`,
revision `4affe8bf02559880fea74fa5ba685ad2cb19168d`.
The initial interrupted clone was not used as evidence.
License text assigns non-`ee/` source to AGPLv3;
this audit does not propose shipping copied gateway source in the extension.
No upstream dependency install or build was run.
Hosted deployment equivalence is unknown.

### Native request shape and actual limits

Primary sources:
[System One feature](https://docs.llmgateway.io/features/system-one),
[API reference](https://docs.llmgateway.io/v1_systemone),
and [TypeSafe models](https://docs.typesafe.ai/models).

The native shape is `model`,
`state`,
and named typed `questions`.
Noul is an independent yes/no probability.
This fits the required axiom interface,
not an authorization-quality conclusion.
The TypeSafe reference additionally states that question IDs are not model input;
all effect meaning must be in instructions,
criteria,
or state rather than hidden in the ID.
The pilot instructions explicitly name their effect keys.

TypeSafe documents both 64k tokens for state plus all questions
and 32k for state plus the longest individual question.
The gateway catalog records only `contextSize: 64000`
in `packages/models/src/models/typesafe.ts:19` at the pinned revision.
The aggregate figure alone is insufficient admission logic.
Text is the supported modality;
images,
audio,
and video require a separately qualified conversion path or manual review.
No such conversion path is selected.

The model and API pages do not establish a tested overflow-rejection guarantee for this gateway route.
The API page's 429 description concerns rate limits,
not context truncation.
The offline route preserves the supplied policy string when forwarding,
but that does not prove the hosted model sees all tokens.
Gate:
 pending model-input/overflow evidence.

The [Jev 1.13 limitations page](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
explicitly warns about adversarial state,
indirection,
and irrelevant long context.
It does not treat state as hostile by default.
Its advice to filter context cannot override the user's mandatory complete-policy requirement.
Adversarial and policy-position evaluation remain required;
the six development examples do not discharge them.

### Gateway identity, retries, and log boundaries

The [source trace and offline verification](../troubleshooting/llmgateway-systemone-boundaries.md)
records exact excerpts,
line ranges,
image identity,
execution bounds,
and reproduced results.

The pinned route forwards the selected model but overwrites `upstream.model`
with its catalog-derived response label.
A mock mismatched upstream identity still returned the requested label.
The matching label in the live pilot therefore verifies response shape,
not independent upstream version attestation.
No historical mismatch is alleged.

Two mocked retryable upstream failures produced three calls across synthetic credentials,
including with `x-no-fallback: true`.
This is same-provider credential rotation,
not cross-provider fallback.
No test established the number of internal attempts in the historical hosted pilot.
The client's one-retry preference needs an explicit client-versus-upstream interpretation.
A five-second caller deadline does not itself prove upstream work or billing stops.

Metadata-only stripping cleared ordinary payload fields but preserved upstream error text.
If a provider echoes input in that text,
content can survive the stripping boundary.
The mock proves that conditional path,
not live private-data retention or actual TypeSafe error echoing.
Gate:
 pending complete retention and hosted configuration evidence.

The probe ran in image `0a55e1fbafe71f9bf6b539e0c8011b7d9ce7ba768690143c801fb3de5160dd53`,
with 2 GiB memory,
2 CPUs,
64 PIDs,
60 seconds,
no network,
no host mounts,
and no real credentials.
Process `proc_dff9` exited 0.
The full upstream CI and real HTTP host boundary were not exercised.

### Gateway privacy is not upstream privacy

[Gateway privacy](https://llmgateway.io/legal/privacy),
updated August 20,
2026,
says the gateway does not train models on customer data.
It also says the selected provider applies its own policies.
[Data-retention documentation](https://docs.llmgateway.io/features/data-retention)
describes metadata-only as the default,
optional payload retention for 30 days,
and a separately retained Responses API surface.
The pilot used System One,
not Responses API.
The user's actual organization retention setting has not been inspected;
a documented default is not account-state evidence.
The source error-channel finding also prevents treating metadata-only as proof that every diagnostic is content-free.

[Gateway subprocessors](https://llmgateway.io/legal/sub-processors),
version August 19,
2026,
lists operational services and makes AI-provider safeguards provider-specific.
It recommends named-provider pinning and warns that some international-transfer safeguards remain unresolved.
The TypeSafe mapping is named,
not a stealth-provider selection.
Its exact service agreement through the gateway remains unverified.

### TypeSafe retention and permitted data use

[Gateway TypeSafe metadata](https://llmgateway.io/providers/typesafe)
labels API training as No,
prompt logging as Unknown,
and retention as Unknown.
That is missing evidence,
not a zero-retention promise.

[TypeSafe privacy](https://typesafe.ai/legal/privacy-policy),
updated November 19,
2025,
says TypeSafe will not train or fine-tune models on input.
Its retention section permits retention for as long as reasonably necessary for service or business purposes;
it does not give a fixed payload deletion deadline.
[TypeSafe legal documentation](https://docs.typesafe.ai/legal)
says enterprise ZDR is offered,
not that this gateway account has it.

[TypeSafe MCA](https://typesafe.ai/legal/mca),
updated September 23,
2026,
section 4.1 gives TypeSafe limited-purpose rights to customer data,
including perpetual rights to derive telemetry,
monitor abuse,
and comply with law.
Section 4.3 defines telemetry to include logs,
hashes,
summary statistics,
classifications,
metrics,
and learnings.
These are processing rights,
not evidence that raw input is actually stored forever.
The no-training clause limits TypeSafe's use of customer data;
it does not grant the customer permission to train another model on TypeSafe outputs.

The [DPA](https://typesafe.ai/legal/data-processing),
updated April 24,
2026,
limits processing of customer personal data to documented instructions
and incorporates additional transfer provisions.
Its schedule uses a necessity-based duration rather than a fixed payload window.
The operative customer,
order,
and DPA coverage for gateway-mediated requests have not been established.
These readings are audit concerns,
not legal advice or a claim that every direct-account term applies identically to this route.
An independent Advisor review confirmed these interpretation boundaries.

The [TypeSafe subprocessor page](https://trust.typesafe.ai/subprocessors)
required browser rendering after text fetch returned only a description.
An isolated browser session exposed all six displayed entries.
It described AWS live-request information as stored and processed;
Modal,
Nebius,
and CoreWeave prompt processing as not stored;
and Slack/Google Workspace as communication services.
It did not identify this gateway route's compute backend or AWS retention duration.
The browser session was closed.

Gate:
 private hosted payloads remain unqualified.
A fixed retention requirement versus mandatory zero payload retention is an unresolved user preference.
No private upload is authorized by the general willingness expressed in Q8.

### Terms affecting adversarial evaluation and fine-tuning

[Gateway terms](https://llmgateway.io/legal/terms),
updated September 18,
2026,
section 6 announces discretionary restrictions for high content-filter violation rates
starting October 15,
2026.
The source does not establish whether or how that policy will apply to this guard's classification traffic.
Section 4 provides no standard PAYG service-level commitment.
These are operational concerns for an always-available guard,
not evidence of an actual suspension or outage.
Manual/headless behavior must remain available independently.

[TypeSafe AUP](https://typesafe.ai/legal/acceptable-use-policy),
updated September 23,
2026,
section 1.5 covers inputs containing malware or malicious code.
The guard may need to classify hostile code,
which is different from executing or facilitating it.
The inspected text provides no express classification exception.
The user subsequently stated that section 1.5 is acceptable for this work.
It is therefore not an unresolved blocker for guard-classification evaluation.
Do not require provider clarification solely about that section.
No special provider exception or contractual amendment is established.
Existing restrictions on executing fixture commands,
private uploads,
training,
and production implementation remain unchanged.

MCA section 2.3 restricts distillation,
training imitation of outputs,
and development of competing services.
Do not use Jev outputs as Laya training labels.
Independently authored local labels and Laya evaluation remain separate.
Training is not authorized in any case.
A downstream classical classifier mentioned in TypeSafe documentation is not permission to distill a competing model.

No vendor contact,
account modification,
private upload,
or new hosted hostile-content batch occurred in this audit phase.

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
