# Issue #413: Advisor hedging design interview

## Request and current state

The user requested resolution of GitHub issue #413 with `/grill-me` and `/grilling`,
 explicitly requiring critical examination of its acceptance criteria.
Do not implement until the user confirms shared understanding.
Implementation is not the only possible resolution:
 reframing or declining hedging remains open.

No implementation changes or verification runs have occurred in this interview.
The first decision round received a correction to its quality premise.
The winner policy remains undecided.

## Evidence

`gh issue view 413 --json number,title,body,comments,labels,state,url` returned an open issue
 with no comments.
Its proposed behavior is delayed speculative default-model execution,
 first valid result wins,
 and cancellation of the other call.
Explicit model requests remain exact and hedging starts disabled.

`gh issue list --state all --search 'repo:Aquaticat/Monochromatic is:issue 408 409 411 412'
 --limit 100 --json number,title,state,body` returned all listed prerequisites as open:

- #408:
   operation attempt ledger and aggregate usage.
- #409:
   configured default preference and session-health fallback.
- #411:
   progress rendering derived from the ledger.
- #412:
   failure-aware same-model recovery.

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

- First completion turns model preference into a launch preference.
  The user states that the default reviewer has no guarantee of good quality.
  Do not infer a quality endorsement from default status or require an equivalence tier.
  Transport success and visible text are operational properties,
   not semantic quality guarantees.
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

User correction to Q1:

> We do not guarantee the default reviewer is of a good quality.

The agent withdrew its recommendation for an explicit interchangeable-quality tier.
That recommendation treated default status as an endorsement unsupported by the current cost selector.
Do not replace the withdrawn tier with another implicit quality guarantee.

The correction does not itself select concurrency,
 returned-result priority,
 or the disposition of late reviews.
The next root question is what outcome the user wants from overlapping reviews,
 without a quality-based privilege for the initial reviewer.

Keep these decisions separate:
 when a usable result is delivered,
 whether remaining work continues,
 and whether additional completed reviews are retained.
After each answer,
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

A second independent review checked the user's correction.
It confirmed that absence of a quality guarantee does not establish reviewer equivalence
 or settle first-completion behavior.
It also confirmed that the withdrawn quality-tier recommendation must not remain active.

## Worktree boundaries

Initial unrelated changes:

- `doc/troubleshooting/module-test-unhandled-rejection.md`
- `mise.lock`
- `doc/handover/module-test-explainer.md`

Leave those changes untouched.

## Next action

Ask the root delivery-policy question without assuming default quality.
Do not bundle delivery time with cancellation or retention of another review.
Wait for the user's answer before determining the next decision frontier.
