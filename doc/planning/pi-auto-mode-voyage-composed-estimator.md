# Paired-hypothesis Voyage estimator

## Authority and scope

The user chose B,
a separate composed-estimator investigation,
and delegated the method:
"You come up with something yourself."
This document selects a concrete research design,
not a production provider,
probability profile,
or deployment.
Parameter fitting and training still require separate authorization before execution.
The first stage does neither.
Private Voyage inputs,
original reserved scenarios,
new providers,
new Pro calls,
and paused Laya source work remain excluded.

## Failure being addressed

The [corrected feature study](pi-auto-mode-voyage-fit.md#completed-corrected-result)
found opposite-reference source texts with the same scalar under the same claim query.
No function of that scalar alone can distinguish those observations.
Another sigmoid,
normalization,
or threshold cannot restore information already absent from that feature.
Abstention remains possible,
but the next experiment should seek additional discriminating information before fitting anything.

## Selected composition

### Code prepares one source and its operation

Keep parser-established Bash structure,
source selection,
authority eligibility,
binding completeness,
and final action choice in code.
Use the existing actual parser/structured-read projection.
Do not ask a model whether quoted Bash executes.
One request or approved-prose source is evaluated at a time;
do not blend their language or authority.

### Reverse the rerank representation

Put the selected source wording and code-supplied operation in the query.
Use candidate semantic hypotheses as documents,
not candidate actions.
Each hypothesis document includes complete current `AGENTS.md`.
The query instructs the scorer to evaluate the hypothesis against the selected source,
not treat policy text as evidence of what that source says.
Set `truncation: false`.
Keep `rerank-3` and the already authorized legacy endpoint.

For each source,
submit these pairs independently:

- Positive relation:
  the source expressly requests the operation,
  or expressly permits it for approved prose;
  versus the closed-source complement that it does not express that relation.
- Explicit prohibition:
  the source expressly prohibits the operation,
  including a containing broader ban;
  versus the complement that it states no such prohibition.

The complement concerns this selected source's wording,
not an inference about every other source or the action's final authorization.
Absence of permission is not prohibition.
No document says approve,
deny,
or ask.

For a request about reading `.env`,
the hypotheses are conceptually:

```text
# Semantic hypotheses, not verdicts or expected answers
This selected request expressly asks for the supplied local .env-content read.
This selected request does not expressly ask for that supplied read.
This selected request expressly prohibits that supplied read.
This selected request states no explicit prohibition of that supplied read.
```

The exact reusable wording and its generator must be frozen before calls.
The source text,
operation descriptor,
and policy are the only task context;
reference labels and case names stay out of requests.

Four hypothesis documents fit one API call per selected source.
A request/prose pair therefore needs two sequential calls in this proposed representation.
Both calls share the existing five-second total assessment clock.
That call count is a design property,
not a measured latency guarantee.

### Preserve both raw scores per axiom

For each axiom separately,
retain support score `s_yes` and complement score `s_no`.
Use their margin and common level as feature coordinates:

```text
# Proposed two-feature representation, not probabilities or log-odds
margin = s_yes - s_no
level = s_yes / 2 + s_no / 2
```

Retain the original pair too.
Reject non-finite derived features rather than silently clipping them.
Do not softmax across hypotheses,
normalize across axioms,
or interpret the margin as a probability.
Positive-relation and prohibition scores never stand in for each other's complements.

### Future supervised probability adapter

If the feature mechanism earns further investigation,
use a separate regularized logistic head for each source-kind/axiom role.
There are four roles:
request/prose crossed with positive relation/prohibition.
Each head receives only that axiom's two feature coordinates,
not scenario IDs,
operation-family IDs,
reference labels,
or the other axiom's scores.

The proposed form is:

```text
# Future learned mapping; no coefficients have been fitted
p_true = sigmoid(b + w_margin * margin + w_level * level)
```

This changes prediction target from relevance to claim truth.
It is supervised estimation,
not a mathematical conversion licensed by the rerank API.
A sigmoid output is not automatically calibrated.
The proposed fit uses regularized binary log loss;
preprocessing,
regularization choice,
and all parameters must be learned only from the fit partition under a separately frozen training protocol.
No fitting library or production implementation is selected here.

### Code owns abstention and permission

Without a qualified adapter/profile,
return no probability estimate rather than a fabricated `0.5`.
Missing trusted source provenance,
missing required facts,
unsupported operation forms,
stale policy,
transport/schema failures,
and expired qualification prevent approval.

After any future fit,
only a separately validated selection rule may expose usable estimates.
It must be evaluated on its accepted subset,
including ambiguous-source challenges,
not merely on all-data accuracy.
No production cutoff is chosen in this design.
The design does not promise that code can detect every semantic ambiguity or distribution shift.
Undetected confident errors remain a qualification risk,
not something an abstention label automatically solves.
Final approve/deny/ask remains deterministic policy work outside the estimator.

## First no-fitting mechanism test

Use only four existing read profiles:
direct positive,
direct prohibition,
scope mismatch,
and cross-clause binding.
Each has request and approved-prose sources.
These are deliberately exposed development examples,
not held-out qualification.
They directly include the old opposite-reference collisions.

Freeze at most twelve calls and forty-eight raw scores:

- Eight base calls,
  one per selected source,
  with four hypothesis documents each.
- One exact repeat of the direct-positive request and one of its approved-prose source.
  These measure observed repeat movement at those inputs,
  not a global noise bound.
- One reversed-document-order call for each of those same sources.
  These probe order effects on both source kinds,
  not every possible position or template bias.

Every request/prose pair shares five seconds,
including actual preparation,
serialization,
response checks,
and final freshness checks.
The controls are declared experimental calls,
not client retries.
There is no transport retry or parallel live fan-out.

Primary questions are fixed before scoring:

- Do the old opposite-reference collisions remain identical in the full two-score vector?
- Does replacing a positive source with a direct prohibition move the relevant margin in its expected direction?
- How do observed repeat and order changes compare with those observed source-contrast changes?

Do not require a particular absolute margin sign:
a future supervised intercept may account for a constant hypothesis preference.
Do not treat a uniformly preferred negative hypothesis as semantic discrimination.
Report unchanged pairs,
changes,
ties,
and contrary movement together.
A zero repeat difference in two observations is not proof of determinism.
No small observed separation is called robust solely because those repeats matched.

Stop on the first input,
policy,
source,
HTTP,
schema,
transport,
or deadline failure,
or at the frozen end.
No template revision,
threshold hunt,
fitting,
or automatic larger experiment follows from scores.
If the paired features retain the same informative collisions or show no relevant source sensitivity,
record that this mechanism has not earned a fitting stage.
Observed separation is only mechanism evidence,
not a probability profile or adoption qualification.

## Frozen mechanism checkpoint

Private source is `~/temp/agent/voyage-paired-hypotheses-2026-09-28`.
Commit `4a0d2a6` freezes the exact hypothesis strings,
encoder,
independent-pair decoder,
comparison logic,
and shared-clock client before model calls.
Commit `c17ab9f` retains inputs,
58 source/input identities,
local checks,
and the model-free result verifier.

`proc_681b` passed local controls without networking:
full policy in every hypothesis,
selected-source isolation,
reference exclusion,
index mapping despite sorted or reversed documents,
independent axiom pairs,
non-finite/overflow rejection,
and raw values outside the unit interval.
A swapped-side mutation exposed incorrect feature decoding;
removing the final deadline check exposed late acceptance.
Original sources remained unchanged.

The schedule first runs the direct-positive request/prose pair,
then its exact repeat,
then its reversed-document-order pair,
then direct prohibition,
scope mismatch,
and cross-clause binding.
Every set shares five seconds across its two sources.
Frozen query sizes are 714 to 764 bytes;
complete requests are 189,406 to 189,816 bytes.
These byte measurements do not establish token limits or latency.
The complete policy remains 42,677 bytes,
SHA-256 `4731752e57e66bf587462e86aff22cbae7b4f073cb1f125f965438268e7c064b`.

No model result,
probability,
fit,
or deployment qualification follows from this preparation checkpoint.

## Later validation boundary

Any fitting stage needs new authorization and its own frozen protocol.
Use independently predeclared references,
never Jev or Respan outputs as teaching labels.
The already queried examples remain development diagnostics;
no independent calibration or test claim may be made from them.
For this proposal,
collect fresh episodes for fit,
selection/calibration,
and locked test partitions,
keeping siblings and paraphrase variants together in one partition.
The original reserved scenarios remain unopened unless separately released for an explicitly frozen validation phase.

Evaluate probability loss,
calibration,
accepted-subset calibration,
wrong true/false resolutions,
and coverage per source-kind/axiom role and per operation.
Report the amount and dependence of the evidence,
not a population error guarantee from synthetic examples.
Selection must not pass by abstaining on every useful role.
Ambiguous-source references must not be silently assigned a binary target merely to complete a dataset.

A qualification artifact must bind claim definitions,
query/document generator,
model/route identity,
policy revision,
fit and validation provenance,
parameters,
selection rule,
and code-checkable input envelope.
The preview alias does not independently attest immutable hosted weights.
Serving changes and revalidation remain an adoption gate;
a matching canary alone cannot prove unchanged internals.

## Evidence and rejected shortcuts

[Yin et al.][yin],
section 5,
provides precedent for turning labels into natural-language hypotheses with input text as premise.
Section 6.3 shows that hypothesis formulation matters.
Their system uses trained entailment models;
this is a structural precedent,
not proof that Voyage is an entailment model.

[Ma et al.][ma],
section 2 and appendix A.2,
reports lexical/template sensitivity and unstable transfer from entailment to classification.
That motivates the fixed wording,
source contrasts,
and order controls.
It does not diagnose the cause of any Voyage score.

[Guo et al.][guo],
sections 2 and 4,
separates confidence from calibration and fits post-processing methods using held-out labels.
Temperature scaling of classifier logits is not a justification for softmaxing arbitrary relevance scores.
The selected logistic head is a proposed supervised adapter that must earn calibration evidence.

[Fisch et al.][fisch],
sections 1 and 4.1,
distinguishes calibration on accepted predictions from marginal calibration.
No selector network,
conformal guarantee,
or their training implementation is adopted here.

The existing guard and shared-harness source searches found no implemented logistic or conformal calibration owner;
the current repository contains planning constraints and experiment scaffolds instead.
Reuse the existing parser,
policy freshness helper,
and indexed Voyage response decoder for the feature test.
Do not introduce another SDK or execute third-party training code.

The design rejects direct score normalization,
one-score-only remapping of the observed collision,
cross-axiom score mixing,
and a new third-party NLI model.
It keeps the existing model boundary and tests a specific new source/hypothesis representation.

[yin]: https://aclanthology.org/D19-1404.pdf
[ma]: https://aclanthology.org/2021.acl-short.99.pdf
[guo]: https://proceedings.mlr.press/v70/guo17a/guo17a.pdf
[fisch]: https://arxiv.org/html/2208.12084
