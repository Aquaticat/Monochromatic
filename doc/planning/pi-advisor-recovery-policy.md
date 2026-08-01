# Pi Advisor recovery policy

Status:
proposed,
 not decided.

## Goal

Increase review completion across variable providers without silently replacing an explicit model,
 imposing a global context cap,
 or giving each retry a fresh deadline.

## Constraints

- The first attempt keeps the model-aware compaction context.
- Explicit model selection can retry the same model but cannot switch models silently.
- Default selection can use configured fallback order and session health.
- Every provider and model attempt shares one `timeoutMs` deadline.
- Caller cancellation and provider abort remain terminal.
- Usage and diagnostics include every attempt.

The continued-session Qwen request tokenized to `172314` input tokens.
Adding the configured `16384` output reserve produced `188698`,
 below the documented `262144` context.
That one HTTP 400 does not establish a stable context ceiling.
The same session also had larger successful Luna and Spark requests than later failed requests.

## Option A: Failure-aware same-model recovery

Policy:

- Let Pi's provider adapter retry one transport,
   HTTP 408,
   HTTP 409,
   HTTP 429,
   or HTTP 5xx failure while honoring `Retry-After`.
- Retry one successful no-text response with lower reasoning effort rather than repeating the identical request.
- Retry one recognized context-limit response unchanged because backend routing can vary.
- Return repeated context rejection with request metrics instead of inventing a global cap.
- End at the shared operation deadline.

Pros:

- Preserves explicit model choice and full first-attempt context.
- Directly addresses transient transport failure,
   variable context rejection,
   and reasoning-only responses.
- Uses retry controls already exposed by Pi's `SimpleStreamOptions`.

Cons:

- Can consume another provider request and more of the operation deadline.
- Requires a strict classifier so authentication,
   quota,
   billing,
   and deterministic request errors fail immediately.
- Lower reasoning can change review depth.

## Option B: Health-aware serial fallback for default selection

Policy:

- Replace highest-cost default selection with configured preference order.
- Record each model's last success,
   latency,
   failure class,
   and consecutive failures for the current session.
- Put failed models on a class-specific cooldown.
- Continue to the next healthy model only for default calls and within the original deadline.

Pros:

- Removes manual model switching after a provider failure.
- Avoids immediately choosing a model that just failed.
- Keeps explicit model semantics predictable.

Cons:

- A fallback can differ in quality,
   latency,
   and cost.
- Session health starts empty after a new Pi process.
- Configured ordering needs a clear default and status display.

## Option C: Provider-aware context negotiation

Policy:

- Use exact tokenizers where available and calibrated conservative estimates elsewhere.
- Preserve complete evidence entries,
   the latest compaction summary,
   and latest task evidence.
- Reduce context only after repeated context rejection for that operation or from an explicit configured limit.
- Record the attempted token budget and omitted entries.

Pros:

- Improves budget correctness without a low global character cap.
- Keeps more evidence on providers that accept it.
- Makes any adaptive reduction local and observable.

Cons:

- Tokenizer adapters add model-specific maintenance.
- Provider framing can differ from the public tokenizer.
- Some context errors do not report an enforced limit.

## Option D: Attempt ledger and progress rendering

Policy:

- Record model,
   attempt,
   reasoning level,
   context size,
   start and end times,
   stop reason,
   diagnostic,
   and usage.
- Aggregate top-level tool usage across all attempts.
- Emit bounded `onUpdate` progress for model,
   attempt,
   elapsed time,
   retry reason,
   and fallback state.

Pros:

- Makes long reviews and retry decisions auditable.
- Uses Pi's existing tool update callback and top-level tool-result usage field.
- Supplies the evidence needed to tune policy from observed outcomes.

Cons:

- Does not by itself make a provider succeed.
- Attempt history needs a compact renderer.

## Option E: Task-scoped evidence mode

Policy:

- Add an explicit mode that sends the latest compaction summary,
   current task evidence,
   relevant diff,
   and recent messages instead of the complete compacted session.
- Keep full-session mode as the default until task boundaries are reliable.

Pros:

- Can improve relevance and reduce repeated unrelated history.
- Reduces latency and input cost when the review is narrowly scoped.

Cons:

- Automatic task-boundary inference can omit a requirement or earlier decision.
- Building a trustworthy diff and evidence packet requires additional provenance.
- It does not address provider instability by itself.

## Option F: Hedged default reviews

Policy:

- For default calls only,
   start a second model after a configured delay if the first has not completed.
- Return the first valid review and cancel the other call.

Pros:

- Reduces tail latency when one provider stalls.
- Tolerates one unavailable provider without serially waiting for its deadline.

Cons:

- Can bill both requests even when one is cancelled.
- Doubles concurrent provider load and context transmission.
- Makes the selected reviewer nondeterministic.

## Ranking

Ranking:
A > B > C > D > E > F.

A ranks over B because same-model recovery helps explicit and default calls,
 while B helps only default selection.
B ranks over C because observed provider variability caused manual switching even when requests fit documented windows.
C ranks over D because correct context negotiation can prevent failures,
 while D primarily exposes them.
D ranks over E because measured attempt evidence is required before safely changing context policy.
E ranks over F because task scoping avoids duplicated provider spend,
 while hedging can bill two full reviews.

## Recommended implementation order

1. Build an internal review-operation module with an attempt ledger and one absolute deadline.
2. Add provider-native transient retry and lower-reasoning no-text retry.
3. Add configured default order and session-health fallback.
4. Add exact-tokenizer adapters and entry-aware context negotiation.
5. Wire aggregate usage and `onUpdate` rendering to the attempt ledger.
6. Evaluate task-scoped mode from recorded review quality.
7. Keep hedging opt-in unless measured tail latency justifies duplicate requests.

Existing issues cover usage accounting (`#408`),
 health-aware selection (`#409`),
 context budgeting (`#410`),
 and progress rendering (`#411`).
Failure-aware same-model recovery needs separate tracking if this proposal is accepted.
