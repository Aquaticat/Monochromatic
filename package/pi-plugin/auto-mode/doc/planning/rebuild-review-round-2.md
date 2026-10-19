# Auto-mode review round: aggregation, follow-ups, and observation

## Settled prerequisites

Q1 B admits any valid unique leading probability. Q4 A retains the genuine human request separately.
Use only public Pi plugin APIs and preserve the end-user experience through the least-degrading fallback.
Later extensions changing arguments after review are an accepted limitation, not work to defend against.
Built-in contents remain deferred and implementation remains stopped.

Fresh-rule fallback after failed startup relevance classification follows the accepted minimal-degradation rule:
retain all freshly parsed rules for ordinary review; do not ask solely because relevance filtering failed.
The prior parser probe counted 213 authored rules with a 214-rule positive control.
That measurement excludes future built-ins and other instruction sources; final request capacity is unmeasured.

The public-only disposable consumer passed 18 assertions, including deliberate limitation cases.
Its qualified configuration supports prepared parallel review and per-tool sequential reviews.
This is finite evidence, not a claim that every Pi host configuration is covered.

## Questions for this round

### Q7: How should different admitted rule answers combine?

Each rule has already been assessed with the whole operation and instruction context. This question concerns code
combining those answers, before a group verdict is established. Established group verdicts remain terminal.

Example: Rule A returns Approve; rule B returns Deny. Or rule A returns Ask while rule B returns Deny. Both answers
have a unique leading probability.

#### A: Deny takes precedence (recommended)

Either example produces Deny. Otherwise Ask takes precedence over unresolved answers; unresolved answers prevent
approval. Approve and not-applicable are the remaining clear answers.

- Pro: A permissive answer cannot cancel a separate prohibition. The reducer has a direct, inspectable result.
- Con: An incorrectly interpreted prohibiting rule can block the group even when other answers are permissive.

#### B: Refine mixed Deny outcomes first

Deny combined with Approve, Ask, or unresolved answers keeps the group unresolved for focused review.
Deny with only other Deny or not-applicable answers can terminate; exhausted unresolved review goes to the human.
Selecting B opens a separate conflict-reconciliation decision after this round.

- Pro: Mixed answers get another chance to expose a mistaken rule interpretation before the group is denied.
- Con: Different rules can correctly return different outcomes. This spends review budget on ordinary combinations
and delays a valid denial.

Ranking: A > B, because different rules can impose independent restrictions; their answers need not agree. B remains
available if avoiding mistaken denials matters more than immediate reduction.

### Q8: What if every effective rule returns not-applicable?

Every rule received a valid admitted answer. No rule is missing or tied, and there is no Deny or Ask. Built-in
contents remain deferred; this decision must also work without inventing a particular built-in.

Example: An ordinary read finishes first-pass review with every effective rule marked not-applicable.

#### A: Approve when all answers are clear (recommended)

The read proceeds. Any combination containing only Approve and not-applicable can approve, including all
not-applicable.

- Pro: Preserves autonomy when review finds no applicable restriction; adds no unrequested permission requirement.
- Con: An erroneous all-not-applicable classification can miss a relevant rule.

#### B: Require at least one Approve

The read does not auto-approve solely from all-not-applicable answers. The system must obtain a positive applicable
assessment or explain that remaining approval requirement to the human.

- Pro: Requires an affirmative rule assessment before automatic execution.
- Con: Introduces a new positive-permission requirement and can interrupt harmless actions even when every existing
rule was fully answered.

Ranking: A > B, because it matches the accepted autonomy baseline and treats complete not-applicable answers as
resolved evidence. B buys a positive-permission gate at the cost of additional interruptions.

### Q9: What lets focused follow-ups resolve an earlier rule uncertainty?

This question concerns an individually unresolved rule under either Q7 choice, such as a tied distribution.
It does not resolve conflicts among already admitted rule answers; Q7 B opens that separate later decision.
Follow-ups must ask something new and focused, preserve all evidence, and stay within three review batches.
No established group Ask or Deny is reconsidered. Question generation details follow this choice.

Example: The rule says tests may modify only disposable fixtures and must not transfer data externally. Its first
answer ties. Useful follow-ups concern fixture confinement and external transfer.

#### A: Focused facts, then rule reconciliation (recommended)

Batch 1 ties. Batch 2 assesses the focused distinctions. Batch 3 evaluates this same rule using the new attributed
findings; code then combines its admitted answer with the other rules.

- Pro: Handles arbitrary authored rules without pretending the chosen subquestions exhaust their meaning. Keeps the
link from evidence to rule explicit.
- Con: Uses the final batch for reconciliation, leaving one batch of subsidiary questions in this example. A final
tie still reaches the human.

#### B: Code combines an explicit decomposition

Code declares fixture confinement and no external transfer as the complete conditions for this rule, then uses their
admitted answers to discharge it. Rules without a justified complete decomposition remain unresolved.

- Pro: Can resolve represented rules after the focused batch without a separate reconciliation call.
- Con: Requires complete code-owned decompositions. Treating arbitrary prose as an exhaustive checklist would
silently change the rule.

#### C: Every follow-up decides the whole rule

The new question examines a concrete distinction, such as the actual fixture target, but still asks for this rule's
disposition for the entire group. Its answer updates that unresolved rule assessment, with previous evidence
retained.

- Pro: Avoids child-to-parent inference and leaves another batch available for a different focused whole-rule
question.
- Con: Provides less separation between subsidiary findings and the final interpretation; needs a precise update
contract to prevent generic paraphrasing or silent evidence replacement.

Ranking: A > C > B. A makes subsidiary evidence and final interpretation separately inspectable; C saves a
reconciliation round but makes that distinction less explicit. C handles arbitrary prose without the exhaustive code
decomposition B requires.

### Q10: Does the review request budget include Span 02 observations?

Luna owns decisions; Span 02 observes the same requests without changing execution. The existing review allowance is
at most three batches with three calls per batch, including retries. Budget scope must be decided before exact
shadow scheduling.

Example: A review uses all nine allowed primary requests. Mirroring each request would add nine Span 02 requests.

#### A: Primary budget, separately counted shadow (recommended)

The nine primary requests remain allowed. Up to nine corresponding shadow requests may also be sent, under
separately specified scheduling and accounting.

- Pro: Preserves the complete primary review allowance and complete comparison coverage.
- Con: The existing nine-request bound no longer bounds all provider traffic; shadow work needs its own resource
limits.

#### B: One combined request budget

Nine primary requests leave no slots for Span 02. Primary review takes priority; shadow observations use only
remaining budget.

- Pro: Preserves the existing request ceiling across providers.
- Con: The hardest reviews can lose all comparison evidence, precisely where shadow results may be useful.

Ranking: A > B, because it preserves both primary review and comparison evidence with explicit separate accounting.
B is preferable only if the combined provider-request ceiling is itself the priority.

### Q11: Must unfinished shadow observations survive a restart?

Shadow work must not delay the tool decision or own execution. This concerns delivery state, separate from ordinary
diagnostic logs. The current logger does not provide durable acknowledgements or a replay queue.

Example: Pi closes after the primary result is recorded but before its Span 02 comparison completes.

#### A: Persist unfinished observations for replay (recommended)

A later session can resume the unfinished observation with the original request identity. Attempts remain
distinguishable; shutdown does not wait for the remote comparison.

- Pro: Preserves comparison coverage across ordinary shutdown and restart.
- Con: Requires persistent delivery state, duplicate-attempt handling, and recovery. Provider failure can still
prevent eventual completion.

#### B: Best effort within the current session

Cancel unfinished shadow work on shutdown and record the missed observation. A later session does not replay it.

- Pro: Keeps observer lifecycle and storage simpler, with no replay obligation.
- Con: Shutdowns, busy sessions, and cancellations can systematically remove comparison evidence.

Ranking: A > B, because the observer exists to retain comparison evidence and replay can preserve it without
delaying primary execution. B is simpler but accepts persistent gaps.

### Q12: Should complete decision evidence expire automatically?

Decision records include model-visible inputs, outputs, rule bindings, and fallback reasons. Existing guidance
prefers compression or archiving over unexplained deletion, but has not selected an age limit. Shared logger
ownership remains unchanged.

Example: A past decision is being investigated after its session has long ended. The complete inputs are needed to
reconstruct why it was made.

#### A: Retain until explicitly removed (recommended)

Keep complete evidence, compressing or archiving inactive files. Age alone does not delete it; storage-pressure
behavior is a separate choice.

- Pro: Supports later investigations without guessing a useful retention duration.
- Con: Retains potentially sensitive context and consumes storage until removal or a pressure policy intervenes.

#### B: Automatically expire by age

Delete evidence older than a user-selected duration. Choose the duration in the next round; no numeric limit is
assumed here.

- Pro: Bounds how long old context is retained and reduces accumulation.
- Con: A later investigation may lose its only reconstructable record. Compression cannot recover expired data.

Ranking: A > B, because it follows the recorded preference for preserving investigation evidence. B provides
automatic data minimization but permanently limits retrospective diagnosis.

### Q13: When evidence storage reaches its limit, preserve old records or new capture?

Compression and inactive-file archiving happen before pressure handling. The eventual byte limit should follow
measured record volumes; this question chooses behavior at that limit. Neither option blocks tool execution because
logging is full.

Example: The evidence store is full, existing records are within the chosen retention policy, and another decision
needs to be recorded.

#### A: Preserve old evidence; report capture gaps (recommended)

Keep existing records, stop accepting new full records while full, and report that new evidence is being lost.
Resume capture when space is available.

- Pro: Does not automatically destroy retained investigation evidence.
- Con: New decisions can lack complete diagnostic records until capacity is restored.

#### B: Prune oldest inactive records; keep capturing

Delete the oldest inactive records needed to admit new ones, visibly record the retention gap, and continue capture.
Active files are not removed.

- Pro: Keeps recent decisions reconstructable within a bounded store.
- Con: Pressure can remove older evidence even before its age policy would expire it.

Ranking: A > B, because existing guidance favors preserving investigation evidence over automatic deletion. B favors
continuous recent evidence at the explicit cost of losing older records.

## Dependent work after the answers

- Q7 and Q8 determine the reducer truth table and when a partial response set can establish a terminal verdict.
- Q7 B additionally opens conflict reconciliation among admitted rule answers; Q9 concerns individual-rule uncertainty.
- Q9 determines focused-question generation, evidence bindings, and whether reconciliation reserves a batch.
- Q10 determines the feasible shadow concurrency and preemption policies; do not assume an extra network slot.
- Q11 determines persistent replay ownership, cancellation accounting, and recovery fixtures.
- Q12 and Q13 determine the retention mechanism; numerical limits need measured record volume and a later decision.
- Ask explanations must use recorded operation evidence and question bindings.
  The Decisions API does not return free-form rationale; do not infer reasons from probabilities.
- Current public probes leave custom global execution modes, dynamic loadouts, nested grouping,
  real TUI cancellation, and session transitions unqualified. Apply the accepted graceful-fallback rule.

## Evidence and response

The disposable consumer is `~/temp/agent/pi-public-plugin-probe-20261019/probe.mts`;
`results.json` records each assertion, and `mise run lint:types` plus `mise run probe` pass.
Its denial candidate aborts the active run; that observed mechanism is not an adopted product decision.
The [active plan](ground-up-rebuild.md) retains the stages and source inventory.
Use the [verified visual review](ground-up-rebuild-review.html#frontier) to compare and prepare one response.

The response form passes all 22 selectable option paths, nine navigation targets, four scenarios,
four manual-decision branches, empty and populated replies, literal text preservation, selection, and keyboard use.
Both themes pass at desktop width and 390 pixels without page overflow or browser errors.
Every measured control meets the 48-pixel minimum.
Inspected captures contain only PNG image chunks:

- Round overview: [light](ground-up-rebuild-review/round2-frontier-light.png),
  [dark](ground-up-rebuild-review/round2-frontier-dark.png).
- Q7: [light](ground-up-rebuild-review/round2-q7-light.png), [dark](ground-up-rebuild-review/round2-q7-dark.png).
- Q8: [light](ground-up-rebuild-review/round2-q8-light.png), [dark](ground-up-rebuild-review/round2-q8-dark.png).
- Q9: [light](ground-up-rebuild-review/round2-q9-light.png), [dark](ground-up-rebuild-review/round2-q9-dark.png).
- Q10: [light](ground-up-rebuild-review/round2-q10-light.png), [dark](ground-up-rebuild-review/round2-q10-dark.png).
- Q11: [light](ground-up-rebuild-review/round2-q11-light.png), [dark](ground-up-rebuild-review/round2-q11-dark.png).
- Q12: [light](ground-up-rebuild-review/round2-q12-light.png), [dark](ground-up-rebuild-review/round2-q12-dark.png).
- Q13: [light](ground-up-rebuild-review/round2-q13-light.png), [dark](ground-up-rebuild-review/round2-q13-dark.png).
