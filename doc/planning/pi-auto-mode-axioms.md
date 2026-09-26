# Auto-mode axiom assessment and deterministic policy

## Authority and current status

The user corrected the design:

> These are NOT reasoning models.
> Instead of asking them to reason through which action should be taken,
> get them to emit probabilities for the axioms and then we deterministically algorithmically parse through them ourselves
> and get the final action.

This is the required architecture.
The model assesses narrowly defined claims.
Our code owns policy and the final approve/deny/ask result.
Implementation in the production guard remains blocked until the design interview is confirmed.
Private prototypes and evaluation are authorized.

The earlier direct-verdict and candidate-verdict-reranking pilots asked the wrong question.
Their approval-quality comparisons and model-selection implications are withdrawn.
Preserve their API-access,
context-capacity,
input-freshness,
resource,
and measured runtime evidence.
Do not use their action-label scores to accept or reject a model for this corrected design.
The existing synthetic actions remain usable;
they need independently authored axiom truth labels.
Their final expected actions belong in deterministic-policy tests,
not in the model's output schema.

The [migration interview record](pi-auto-mode-laya.md) retains the requirements and experiment history.
This document is the focused current architecture proposal.

## Settled requirements

- Zero coding-plan judge calls,
  including fallback.
- Keep deterministic safety checks and existing manual approval behavior.
- Additional manual approvals are acceptable.
- Every guard-model evaluation retains complete current `AGENTS.md`;
  no summary,
  selected rules,
  or silent truncation.
- Read and fingerprint the policy before assessment;
  a changed policy invalidates the pending result before it can authorize an action.
- Existing histories may be inspected locally to create synthetic cases.
  Do not upload raw histories or commit them.
- Laya fine-tuning is in scope for assessment,
  not automatically authorized training or external compute.
- Authorized model scope: Laya,
  relevant Voyage products/models,
  and Jev.
- Prefer LLM Gateway over OpenRouter.
  OpenRouter is secondary,
  not prohibited.
- Local Laya experiments may use up to 8 GiB,
  2 CPUs,
  no extra swap,
  no network or host mounts,
  and a 5-minute container deadline.
  Run one inference container at a time.

## Vocabulary

### Axiom

A named,
versioned,
narrow claim about an operation,
its effects,
a resource,
or a relationship to trusted user intent.
It is not a disguised final decision such as whether the action is safe or should be approved.
Each axiom has a truth definition,
required evidence,
positive and negative examples,
and an explicit unknown case.

### Deterministic fact

Evidence established by code or an authoritative host interface.
Examples include a canonical path,
verified scratch-directory ownership,
an active user-approved directive,
a fixed guard match,
and the policy fingerprint.
A filename hint or assistant assertion is not automatically a proved fact about runtime contents.

### Axiom estimate

A model's estimated probability that one axiom holds,
tied to its input snapshot,
definition version,
model/runtime identity,
and calibration evidence.
The estimate is not execution permission and is not a certainty certificate.
Different axioms may all be true;
do not normalize their probabilities as mutually exclusive action choices.

### Unresolved evidence

Missing,
stale,
unsupported,
contradictory,
or insufficiently qualified evidence needed by the policy.
Do not turn missing information into a low probability or ask a model to invent it.

### Policy result

The deterministic module's approve,
deny,
or ask result,
with the matched rule and evidence responsible for that result.
It is never a field requested from the assessment model.

## Module responsibilities

### Evidence collection

Reuse the existing shell analyzer,
path canonicalization,
secret-path signals,
read-only proofs,
allowlists,
session entries,
and fixed virtual-input guard.
Keep facts that code can establish in code.
Distinguish flags that warrant investigation from proved effects.
Do not weaken a deterministic block because a model disagrees.

Preserve the existing trusted-versus-untrusted distinction:
user-approved session directives can carry authority;
project context,
tool payloads,
and tool outputs cannot manufacture it.
A message's `user` role alone does not establish human authorization.
Code must retain the originating human task and grant provenance;
automated continuations do not create new authority.
Complete `AGENTS.md` remains context,
not a replacement for the guard's fixed policy.

### Axiom assessment

This module accepts the complete immutable input snapshot and selected axiom definitions.
Its interface returns only estimates for those named claims,
plus provenance and validated transport metadata.
It returns no final action,
no policy thresholds,
and no generated authorization rationale.

Narrow questions point at explicit input fields.
A claim about executing code must distinguish executable behavior from quoted examples or printed strings.
A claim about introduced code must distinguish runtime code from documentation or fixtures.
Use separate claims where an instruction currently bundles independent conditions.

Provider-specific adapters translate this interface into native primitives.
Jev's Noul returns P(yes).
Laya can return binary probabilities,
but label sensitivity and the full-policy runtime must be evaluated for the chosen representation.
Voyage reranker relevance scores are not automatically axiom truth probabilities;
a validated calibration adapter or an auxiliary role is required before treating them as such.

### Deterministic policy

Code combines facts and qualified estimates using explicit rules and precedence.
Do not multiply estimated probabilities under an untested independence assumption.
Do not invent one universal confidence threshold from the earlier pilots.
Thresholds and abstention behavior belong to a versioned,
held-out-validated policy profile.

The existing fixed guards,
explicit bypass semantics,
current-policy approval reuse,
manual approval,
headless refusal,
and session trust reset remain code-owned responsibilities.
Unknown or unqualified assessment must not silently become approval.
Preserve the reason for review in the policy result;
explanations come from matched rules and evidence,
not invented model reasoning.

## Initial axiom-definition work

These are candidate claim families,
not yet a frozen exhaustive schema:

- Operation matching:
  the trusted request asks for a specified operation.
- Resource matching:
  the trusted request refers to a specified resource or scope.
- Directive matching:
  a specified active user-approved directive covers a named operation or resource.
  Split operation and resource claims when they vary independently.
- Protected-data flow:
  a specified protected source reaches a specified external recipient through the proposed operation.
  Reading sensitive data and making an unrelated network call do not establish this relation.
- Content removal:
  a proposed operation removes or overwrites existing target contents.
  Merely printing or documenting the command does not count.
- Remote mutation:
  a proposed operation changes a remote resource,
  rather than reading it or causing incidental request logging.
- Introduced behavior:
  a proposed edit installs one specified behavior in executable content.
  Ask separately about protected-data transmission,
  access-control removal,
  or destructive behavior.
- Denied-effect recurrence:
  a proposed operation repeats the protected effect that was previously blocked.
  Sharing the user's overall task is not enough.

Use deterministic answers where available.
Use model probabilities only for the semantic part that remains.
Per-axiom labels must be authored independently from model outputs and final policy labels.
Ambiguous truth labels remain explicit rather than being forced into yes or no to obtain a desired final action.

## Evaluation order

1.  Define each axiom and its evidence requirements from the current guard's consumed responsibilities.
2.  Add positive,
    negative,
    ambiguous,
    negated,
    quoted-code,
    trust-reset,
    and context-change cases for each claim.
3.  Test the deterministic policy with supplied ground-truth facts,
    including every precedence and uncertainty branch.
4.  Query models only for axiom probabilities.
    Keep final expected actions and axiom labels outside model input.
5.  Evaluate each axiom and the composed policy separately.
    Inspect which estimate or rule causes each final mismatch.
6.  Fit any calibration or thresholds on development/calibration data;
    evaluate them on separate frozen scenario groups.
    Do not select thresholds from the reserved results.
7.  Verify complete-policy coverage,
    snapshot freshness,
    cancellation,
    malformed/absent estimates,
    and manual/headless behavior at the actual Pi consumer interface.

No further direct approve/deny/ask model questions are authorized by this design.
No production decision profile is selected yet.

## Primary-source cross-check

The user's correction is the authority for this design.
Current TypeSafe documentation independently supports it:

- [How to build with System One](https://docs.typesafe.ai/concepts/how-to-build-with-system-one)
  keeps control flow and deterministic rules in code,
  asks atomic questions,
  and composes answers in code.
- [Noul](https://docs.typesafe.ai/primitives/noul)
  defines one probability per yes/no claim,
  recommends splitting independent conditions,
  and returns each answer under its question id.
- [Confidence](https://docs.typesafe.ai/confidence)
  makes thresholds domain- and risk-dependent.
- [LLM Gateway System One](https://docs.llmgateway.io/features/system-one)
  provides the native probability interface and explicitly keeps policy in code.

Upstream advice to select only relevant context does not override the user's full-current-`AGENTS.md` requirement.
Example thresholds in provider documentation are not validated thresholds for this guard.

## Preferred gateway verification

The user supplied `AUTO_MODE_LLMGATEWAY_API_KEY` and prioritized LLM Gateway over OpenRouter.
The non-sensitive native probe used
`POST https://api.llmgateway.io/v1/systemone`
with explicit model `typesafe/jev-1.13.0`.
HTTP 200 returned that same provider/model identity.
The two independent Noul answers were 0.92 for reading package metadata
and 0.05 for sending a network request.
No final action was requested.
Reported usage was 321 input and 41 output tokens;
the observed request duration was 1398.043704 milliseconds.
This verifies access and primitive shape,
not safety calibration or full-policy quality.
No credential or private history was used as test content.

## Proposed agent-guidance edit

Propose this new rule under `AGENTS.md` Architecture decisions:

```text
AXQ:
 For decision-model integrations, request probabilities for narrow axioms.
 Deterministic code owns policy and final actions; validate uncertainty handling on held-out cases.
```

The handle was checked against current `AGENTS.md`,
`CLAUDE.md`,
and the local forbidden-string appendix;
no existing handle match was found.
The appendix's contents must not be copied into this document or sent to external services.
The proposal has not been applied to the root instruction files.
