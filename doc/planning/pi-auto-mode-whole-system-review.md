# Auto-mode whole-system review

## Scope and status

The user requested a review of the whole auto-mode design on 2026-10-15,
including whether replacement is preferable to continued repair.
This is a review and proposal, not authorization to delete or rebuild the implementation.
The source snapshot is `02078ea5f8cf60434695a4c5a92ed23b7b6f9d9f`.
The unrelated working-tree `mise.lock` change is outside the review.
Production edits are paused during the review.

## Review work

- [ ] Reconcile accepted requirements, historical decisions, and legacy behavior.
- [ ] Trace host integration, capture, retained provenance, and decision-context selection.
- [ ] Trace assessment questions, caching, transport budgets, and probability consumption.
- [ ] Trace policy, confirmation, cancellation, and exact prepared-operation execution.
- [ ] Assess test coverage at the actual consumer and identify unsupported completion claims.
- [ ] Compare repair, replacement of the decision core, and rebuilding around the legacy caller.
- [ ] Publish evidence, limitations, a ranked recommendation, and concrete acceptance checks.

## Current constraints

The latest accepted preparation-inclusive assessment budget is 15 seconds,
shared across at most three sequential bundles of at most three parallel calls.
The average USD 0.001 cost target was removed.
The model estimates meanings and probabilities;
deterministic code resolves policy and the final operation decision.
The current operating cutoff is a uniquely leading selected-option probability of at least 0.60.
It is not a calibrated correctness guarantee.

The legacy recent-context selection keeps the larger of the latest five visible messages
and the complete span from the latest user message.
Selected message contents remain complete.
Local retention for provenance does not require disclosing every retained receipt on each assessment.
The user chose to keep this migration lesson in auto-mode documentation,
without adding a general `AGENTS.md` rule.

An established applicable prohibition blocks execution.
Uncertain assessment can request original human confirmation for the exact prepared group.
Cancellation, stale inputs, and unavailable approval UI do not confer permission.
The existing reviewed source owners and execution controls are candidates for retention,
not assumed correct solely because their local tests pass.

## Evidence already reproduced

The built legacy context tests pass the message-window,
complete selected content,
hidden/system-message omission,
and compaction projection controls.
The 15-second change passed rebuilt type, transport, wire, bundle, budget, preparation,
lifecycle, and dependency checks.
These successes do not establish end-to-end native usability.

The unchanged native workspace replay sent 617 questions across four planned requests.
Its third request contained 4538472 serialized bytes and returned HTTP 400
with `context_length_exceeded`.
The response did not report the token count or effective serving limit.
The native wire includes all governing-source content and the original provider request,
then repeats selected source text inside question instructions.
Scratch-only representation experiments are not the selected remedy for incorrect context scope.

## Findings and recommendation

Review in progress.
