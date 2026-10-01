# Drex 1.5 recheck

## Scope and status

Requested on 2026-10-01.
This is a release/API recheck and a revised qualification direction,
not provider adoption or production confidence evidence.
Jev through LLM Gateway remains the accepted qualification direction.
The user has not asked to replace it automatically.

The authenticated model catalogue returned HTTP 200 and listed `drex-v1.5` as a non-alias version.
No 1.5 inference or semantic result is claimed yet.
The [historical Drex study](pi-auto-mode-drex-qualification.md) measured 1.0,
not 1.5.
Its failed diagnostic bands neither qualify nor disqualify 1.5.

## Changes verified in current primary documentation

The [model reference][models] lists:

- `drex-v1.5`,
  released 2026-09-28.
- A 131,072-token state limit.
- A 139,264-token state-plus-longest-question limit.
- Long inputs remaining on Drex 1.5 rather than being handed to 1.0.
- `drex-latest` pointing to 1.5.
- `drex-v1.1` retired and served by 1.5.

This changes the documented route that caused the
[historical full-policy version mismatch](../troubleshooting/drex-model-route-label.md).
The old observation stays valid for its date and recorded responses.
Current documented routing is not proof of the physical serving weights.
Use the explicit 1.5 ID and validate every answering response's model field.

The [evaluation reference][evaluate] still uses `POST /v1/systemone`,
with text/JSON state and typed `noul`,
`choice`,
and `score` questions.
The [question guide][questions] permits up to 512 questions per call.
The [limits reference][limits] caps serialized state plus questions at 1,048,576 UTF-8 bytes.
The body-byte cap does not establish token fit.

The user clarified that questions in one call run in parallel without affecting one another.
The [three-call proposal](pi-auto-mode-batched-assessment.md) uses that premise:
batch independent axioms first,
reserve follow-up calls for information dependencies,
and stop as soon as code can settle the decision.
Do not reinstate an unsupported question-interference concern as a release gate.

## Live metadata verification

The new read-only request was `GET https://drex.nace.ai/v1/models`.
It sent no assessment state or questions,
made no inference call,
and performed no account or billing mutation.

The successful response listed:

- `drex-v1.0` with `alias_for: null`.
- `drex-v1.5` with `alias_for: null` and release date 2026-09-28.
- `drex-latest` with `alias_for: "drex-v1.5"`.
- `drex-v1.1` with `alias_for: "drex-v1.5"`.

The request returned 772 bytes in `689.330475` ms with no retries.
The command returned exit 0.
This verifies metadata authentication and the catalogue returned to the existing key,
not inference entitlement,
latency,
semantic quality,
or the model that would serve an inference request.

An initial managed-process attempt stopped before dispatch because its environment lacked
`AUTO_MODE_NACE_DREX_API_KEY`.
The credential was present in the separately checked Bash environment.
Node emitted `AssertionError [ERR_ASSERTION]: Named Drex credential unavailable`.
`proc_5894` exited 1.
A separately named `metadata-v2` used scoped forwarding through Bash;
no key value was printed or written to evidence.
The first attempt remains preserved,
not retrospectively repaired.

The private metadata source and results live in
`contract/research/drex-1.5-recheck/`
of the separate qualification repository.
Public documentation responses are retained there;
private raw metadata responses remain ignored.

## Data handling and operational differences

The current [Drex-specific terms][terms] replace the general model-improvement clause:
request content and answers are retained in operational logs for no more than 30 days,
not used to train or improve models.
The [privacy notice][privacy] names US processing and providers including Vercel,
Supabase,
Modal,
and AWS.
No-training does not mean no-retention.
The referenced [general terms][general-terms] and [general privacy policy][general-privacy] were fetched too.
The Drex-specific precedence language controls the stated Drex exception.

Drex inputs remain public/synthetic plus complete verified public policy.
The user's wider private-input authorization for Jev is not automatically reassigned to Drex.
No additional consent was requested for this recheck.

The [pricing reference][pricing] quotes $0.05 per million input tokens for 1.5,
with output tokens unbilled.
The Drex-specific terms still quote $0.04 per million generically.
Record that documentation inconsistency;
do not silently treat either text as a verified invoice rate.
No top-up or account change was performed.

The [retry guide][retries] recommends a 60-second client timeout for general use,
with up to 55 seconds waiting for the model.
Our preparation-inclusive five-second assessment deadline remains unchanged.
Parallel questions do not eliminate network,
queue,
encoding,
or finalization time.
Drex's `evaluation_time_ms` excludes those costs,
according to the [answer guide][answers].

The limits page also contains conflicting validation/rate-limit ordering prose:
its RPM section counts admitted requests that later fail body validation,
while its scope section says validation failures do not count.
No new rate-limit behavior was probed.
Use conservative serial research scheduling rather than deriving a guarantee from that inconsistency.

## Implications for fresh qualification

Do not repeat the old 36-call study mechanically.
It used a different model and request layout.
The next candidate phase should reflect the intended independent multi-question batch,
with narrow semantic questions and code-owned decisions.

Freeze new public/synthetic inputs,
references,
the adaptive question-construction and selection procedure,
answer-ID checks,
diagnostic bands,
call schedule,
clocks,
and stop conditions before inference.
Calls two and three may generate different question sets and wording from prior answers;
retain the generated questions and selection reasons rather than requiring a fixed checklist.
Include positive and prohibition controls,
the previously problematic cross-clause motifs as disclosed historical anchors,
and new independent cases rather than calling old anchors held-out evidence.

Measure end-to-end behavior and exact served identity together.
Do not widen the five-second budget,
fit thresholds after seeing outputs,
replay reserved scenarios,
or infer a production verdict from a leaderboard claim.
The vendor's [product note][product] reports benchmark and long-context gains;
those are vendor-reported results,
not our workload qualification.

## Remaining work

- Design the new bounded 1.5 batch profile under the accepted three-call ceiling.
- Validate local parsing,
  complete-answer checks,
  source freshness,
  counters,
  deadlines,
  and stop paths before live inference.
- Execute only the separately frozen phase and retain rejected results without resampling.
- Continue native manager and real-consumer qualification separately;
  model data consent is not the missing implementation work.

[models]: https://drex.nace.ai/docs/reference/models
[evaluate]: https://drex.nace.ai/docs/api-reference/systemone
[questions]: https://drex.nace.ai/docs/guides/questions
[limits]: https://drex.nace.ai/docs/reference/limits
[terms]: https://drex.nace.ai/terms
[privacy]: https://drex.nace.ai/privacy
[general-terms]: https://www.nace.ai/policies/terms-of-service
[general-privacy]: https://www.nace.ai/policies/privacy-policy
[pricing]: https://drex.nace.ai/docs/reference/pricing
[retries]: https://drex.nace.ai/docs/guides/errors-and-retries
[answers]: https://drex.nace.ai/docs/guides/reading-answers
[product]: https://www.nace.ai/drex.md
