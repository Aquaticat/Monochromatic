# Batched axioms with a three-call assessment ceiling

## Accepted requirements

On 2026-10-01,
the user allowed at most three decision-model calls per eventual decision,
with termination as early as possible.
This supersedes the previous two-client-call ceiling for future designs,
not the frozen contracts of completed experiments.
The preparation-inclusive five-second total deadline remains unchanged.

The user clarified that questions within a Drex call run in parallel without affecting one another.
Use parallel,
non-interacting question evaluation as the planning premise.
The earlier assumption that questions necessarily influence one another is withdrawn.
Do not create a new admission blocker from that unsupported assumption.

These requirements do not authorize production cutover,
adopt Drex,
select confidence thresholds,
or turn model estimates into authority.
Jev input consent through the approved Gateway route remains settled.
Drex evaluation inputs retain their public/synthetic plus verified public-policy scope.

## Consequence: parallel breadth before additional rounds

A model call is a batch of narrow questions,
not one question,
one source,
or one effect.
Most independent semantic work can fit in the first call.
The second and third calls exist for information dependencies between batches,
not because the action has several effects.

The intended control flow is:

1.  Collect code-owned facts and evaluate fixed rules.
    Stop with zero model calls when they already settle the outcome.
2.  Ask the broad set of currently known,
    decision-relevant semantic axioms in one batch.
    Do not split independent questions merely to serialize them.
3.  Re-evaluate the deterministic rules as soon as that batch returns.
    Stop if the outcome is settled.
4.  Use another call only for a remaining relevant question whose inputs or necessity depended on the prior answers,
    or an eligible transport retry.
    Repeat the stop check after each response.
5.  Stop by the third call or the original deadline,
    whichever applies first.
    Unresolved required evidence follows the existing manual/headless path;
    it never becomes automatic approval.

The call ceiling applies once to the entire reviewed action,
not separately to each source,
effect,
provider,
or batch.
An initiated call counts even if it fails,
is cancelled,
or returns too late.
A transport retry consumes one of the same three slots
and requires remaining time under the original deadline.
A missing,
malformed,
or uncertain semantic answer is not a transport failure.
Cancellation does not authorize another attempt.
The existing at-most-one automatic transport retry remains;
the new ceiling does not silently allow a retry for every batch.
Q11's accepted distinction between client calls and Gateway-internal attempts remains explicit.
Three client calls are not a verified three-inference or three-charge limit inside that gateway.

Do not launch all three calls speculatively.
That spends the budget before early termination can save the calls.
Parallelism belongs inside the batch when questions are already independent.

## What the first batch can ask

Use stable question identities bound to source,
effect,
predicate definition,
and original assessment snapshot.
The model does not decide whether a source is authoritative;
code establishes that separately.

Suppose the supplied source says:

> Read `/work/project/.env` locally and send `/work/project/README.md` to the named collector.

For code-established effect candidates,
the first batch can ask these independent relations together:

- Does this source request the local read of `.env` contents?
- Does this source explicitly prohibit that read?
- Does this source request sending `.env` contents to that collector?
- Does this source explicitly prohibit that transfer?
- Does this source request sending `README.md` contents to that collector?
- Does this source explicitly prohibit that transfer?

The independent references are true/false,
false/false,
and true/false respectively.
The model supplies estimates for those claims,
not the reference labels or a final verdict.
In particular,
false permission-relation evidence is not true prohibition evidence.

Other already-defined semantic axioms can occupy the same batch:
policy applicability,
conditions in approved prose,
and qualified inspected-form effect estimates allowed by Q13 B.
Do not delegate Bash parsing,
filesystem facts,
human-origin authentication,
source priority,
or grant creation to the model.

Calls two and three are adaptive,
not fixed follow-up checklists.
Construct their question sets and wording from the actual action,
governing instructions,
current evidence,
and preceding answers.
A later batch can concern a newly identified semantic effect,
resource,
condition,
or unresolved relationship.
Different assessments should ask different follow-ups when their remaining uncertainty differs.

Qualify the question-construction and selection process and the meanings of its axioms,
not an exhaustive bank of every future literal question or a fixed answer tree.
Dynamic questions remain narrow claims that code can consume;
they are not disguised final-verdict requests.
Do not send a first-round answer as an instruction telling the model what to conclude next.
Repeated paraphrases,
voting,
and retrying uncertainty until it becomes approval remain excluded.

## What earliest termination means

Code may stop once unresolved relevant estimates cannot change the applicable rule outcome.
This is deterministic partial evaluation of the governing rules,
not a request for the model to announce confidence in its final decision.
The rule evaluator needs conservative dependency tracking,
not enumeration of every truth assignment to hundreds of questions.
Unknown applicability or a missing dependency stays potentially outcome-changing
unless code establishes why it cannot affect the result.

An approval must still satisfy all mandatory prerequisites and finalization checks.
A permissive relation does not permit stopping before a relevant higher-priority prohibition or approval requirement.
Unknown instruction coverage is not empty coverage.
Unspecified policy behavior remains unspecified,
not an invented default grant.

A fixed block can terminate before inference.
An irrelevant unresolved estimate need not delay a settled outcome.
If all remaining routes require unavailable evidence,
manual review can occur before exhausting the three slots.
Do not wait for the third call merely because a slot is unused.

The original policy,
action,
branch,
source,
file,
grant,
signal,
and deadline observations remain bound across batches.
An intervening change invalidates the pending assessment;
it does not restart a fresh three-call budget invisibly.
Finalization remains necessary after any inference-based approval.

## Drex 1.5 capacity and evidence

The [question guide][questions] accepts up to 512 questions about one state.
Its batching example reports fewer input tokens than separate calls and matching answers,
with some numerical variation.
This supports batching as an intended use case.
The user's parallel-evaluation clarification is not replaced by speculation about cross-question reasoning.

The [model reference][models] names `drex-v1.5`,
released 2026-09-28.
It specifies a 131,072-token state limit and a 139,264-token state-plus-longest-question limit.
Long inputs now stay on the 1.5 route rather than being handed to 1.0.
The [limits reference][limits] separately caps serialized state plus questions at 1,048,576 bytes.
Question count,
byte count,
state tokens,
and longest-question tokens are different constraints.

The [reading guide][answers] defines `noul` as the model's probability of yes.
Independent evaluation does not establish statistical independence of prediction errors.
Do not multiply marginal scores into an invented joint confidence,
count questions as independent votes,
or renormalize permission and prohibition into complements.

512 is a capacity ceiling,
not a requirement to fill a batch.
Include the relevant rule dependencies and stop planning unnecessary questions.
If they exceed a call's capacity,
construct the remaining relevant batch dynamically while slots and time remain,
or defer to manual review;
never silently drop required prohibition or coverage checks.

The [retry guide][retries] recommends a 60-second client timeout for general API use.
That recommendation does not override our five-second total assessment deadline.
Parallel questions do not eliminate transport,
queueing,
encoding,
or finalization time.
Measure the whole intended batch and total assessment;
neither 512 questions nor three allowed calls guarantees that they fit.
The documented endpoint returns a complete answer object,
not a per-question stream.
The caller's stop opportunity is after each completed batch or cancellation,
not after an inaccessible intermediate answer inside the batch.

## Qualification implications

The scheduler can be tested without any provider calls:
zero-call fixed outcomes,
one-call completion,
dependent follow-ups,
shared retry accounting,
capacity overflow,
missing answers,
late responses,
and changes between batches.
Use positive controls that make an unresolved relevant axiom change the result,
then show that unrelated unresolved axioms do not postpone it.

Fresh Drex 1.5 evaluation should use the intended batched shape,
not automatically repeat the old request-versus-prose two-call layout.
For a finite qualification experiment,
freeze its input cases,
independent references,
question-construction procedure,
selection criteria,
bands,
limits,
and stop conditions before model calls.
Generated follow-up wording and selected questions can depend on observed answers;
retain those realized questions with their selection reasons.
Freezing an experiment's procedure does not freeze every eventual decision's question list.
Keep completed Drex 1.0 and Jev experiments historical.
No historical threshold is adopted for the new model or format.

Parallel question isolation is the supplied design premise,
not a reason to launch a new expansive interference investigation.
Runtime checks still need to establish exact `drex-v1.5` in the answering response,
not merely the request or model catalogue,
complete answer-ID coverage,
whole-batch timing,
and semantic quality on the requested workload.

## Implementation direction

Keep scheduling inside the assessment Module's Implementation,
behind the existing effect-contract Interface.
Its provider Adapter accepts the common immutable state and named questions;
it returns validated scalar evidence,
not a policy action.
The Interface should expose the final assessment outcome and factual evidence,
not force callers to manage three stages.
This is a proposal,
not permission to add production code now.

## Agent guidance proposal

Proposed tooling guidance,
without editing protected `AGENTS.md`:
settled provider consent is not a recurring gate;
batch independent work and create evidence receipts at meaningful acceptance or irreversible boundaries,
not every intermediate edit.
Qualify adaptive follow-up construction rather than requiring a fixed question list or exhaustive question tree.

[questions]: https://drex.nace.ai/docs/guides/questions
[models]: https://drex.nace.ai/docs/reference/models
[limits]: https://drex.nace.ai/docs/reference/limits
[answers]: https://drex.nace.ai/docs/guides/reading-answers
[retries]: https://drex.nace.ai/docs/guides/errors-and-retries
