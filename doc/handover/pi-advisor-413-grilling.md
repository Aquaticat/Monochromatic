# Issue #413: Advisor hedging design interview

## Request and current state

The user requested resolution of GitHub issue #413 with `/grill-me` and `/grilling`,
 explicitly requiring critical examination of its acceptance criteria.
Do not implement until the user confirms shared understanding.
Implementation is not the only possible resolution: reframing or declining hedging remains open.

No implementation changes or verification runs have occurred in this interview.
The first decision round is pending.

## Evidence

`gh issue view 413 --json number,title,body,comments,labels,state,url` returned an open issue
 with no comments.
Its proposed behavior is delayed speculative default-model execution,
 first valid result wins,
 and cancellation of the other call.
Explicit model requests remain exact and hedging starts disabled.

`gh issue list --state all --search 'repo:Aquaticat/Monochromatic is:issue 408 409 411 412'
 --limit 100 --json number,title,state,body` returned all listed prerequisites as open:

- #408: operation attempt ledger and aggregate usage.
- #409: configured default preference and session-health fallback.
- #411: progress rendering derived from the ledger.
- #412: failure-aware same-model recovery.

`doc/planning/pi-advisor-recovery-policy.md:3` records acceptance for issue tracking,
 not a final implementation contract for this interview.
Its option F proposes first-valid selection.
Its recommended implementation order puts operation accounting and serial recovery before hedging.

Current source confirms that this is not merely a missing hedge timer:

- `package/pi-plugin/advisor/src/advisor-selection.ts:34` describes highest expected-cost selection;
   the function delegates default ranking to the shared selector.
- `package/pi-plugin/advisor/src/advisor-completion.ts:29` limits the current completion sequence
   to two provider-boundary calls on the same model.
  The second follows a successful terminal response without text.
- `package/pi-plugin/advisor/src/advisor-completion.ts:246` rejects provider errors,
   aborts,
   and unsupported tool use.
  `responseHasText` at line 385 only checks for a text block unequal to the empty string.
  This is not a semantic review-quality assessment.
- `package/pi-plugin/advisor/src/advisor-deadline.ts:88` computes an absolute deadline
   from operation start and configured timeout.
- `package/pi-plugin/advisor/src/tool.ts:118` does not consume its progress callback.
  Line 158 returns details without top-level usage;
   line 372 retains only the returned response's usage in details.
- `package/pi-plugin/advisor/src/config-schemas.ts` has no hedge,
   model-preference,
   or session-health configuration fields.

These are source observations,
 not evidence that concurrent scheduling or cancellation has been verified.
The historical provider failures in
 `doc/troubleshooting/pi-advisor-long-session-provider-failure.md`
 do not establish which winner policy the user wants.

## Acceptance criteria that need scrutiny

- First completion turns model preference into a launch preference,
   unless the racing models are explicitly approved as interchangeable reviewers.
  Transport success and visible text do not establish equivalent review quality.
- The issue body asks for a different provider,
   while its checklist only prefers one.
  Distinct provider identifiers do not by themselves establish independent infrastructure.
- One speculative branch does not necessarily mean one additional provider request:
   both branches can contain retries.
  Any dispatch bound must include recovery and distinguish plugin calls from adapter-internal retries.
- Canceling a race loser must not count as evidence that its model is unhealthy.
- Caller cancellation and deadline expiry terminate the operation;
   a branch-local provider abort is not the same event.
- Immediate winner delivery and complete loser accounting can conflict.
  Abort delivery,
   terminal settlement,
   available usage,
   and actual provider billing must be distinguished.
  Current provider behavior has not been investigated in this interview.
- Branches may have different model-derived context budgets.
  A first-result policy could also select a result based on less evidence.

## Decision tree

Root decision pending:
 what outcome should justify replacing an unfinished preferred review?

Candidate policies to discuss:

- Permit first-completion replacement only among user-approved interchangeable reviewers.
- Preserve the preferred reviewer until failure or the operation deadline.
- Permit any eligible fallback to replace the preferred reviewer merely by finishing first.

Recommendation for the first round:
 permit a race only among explicitly approved interchangeable reviewers,
 not every model that happens to be scoped and output-eligible.
No automatic quality equivalence is proposed.

After that answer,
 recompute the frontier rather than asking speculative configuration questions.
Possible dependent decisions include:
 approved participants,
 whether all completed perspectives should be retained,
 what starts the delay clock,
 provider-diversity requirements,
 retry/concurrency bounds,
 winner and cancellation precedence,
 accounting finalization,
 and the integration scope of still-open prerequisite issues.

## Independent review

Advisor was asked to challenge the first-completion premise and prerequisite scope.
It highlighted quality substitution,
 retry multiplication,
 late accounting,
 and misleading health penalties for canceled losers.
Its issue-number mapping was inconsistent with the fetched issue bodies.
Use the verified mapping in the Evidence section,
 not that part of the Advisor response.

## Worktree boundaries

Initial unrelated changes:

- `doc/troubleshooting/module-test-unhandled-rejection.md`
- `mise.lock`
- `doc/handover/module-test-explainer.md`

Leave those changes untouched.

## Next action

Ask the root winner-policy question with concrete behavior,
 per-option tradeoffs,
 and a full recommendation ranking.
Wait for the user's answer before determining the next decision frontier.
