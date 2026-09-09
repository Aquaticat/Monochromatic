# Issue #413: Advisor hedging design interview

## Request and current state

The user requested resolution of GitHub issue #413 with `/grill-me` and `/grilling`,
 explicitly requiring critical examination of its acceptance criteria.
Do not implement until the user confirms shared understanding.
Implementation is not the only possible resolution:
 reframing or declining hedging remains open.

No implementation changes or verification runs have occurred in this interview.
The first round corrected a quality premise.
The second round established bounded collection after the first usable result.
The user accepted a configurable 30-second collection grace capped by the original operation deadline.
The user also explicitly requested just-in-time,
 operation-local exclusion of providers reporting exhausted credits.

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

The agent next offered immediate first-result delivery or waiting for all started reviews until the deadline.
The user rejected that binary:

> None of them:
> kill straggler after a while (of already getting at least 1 usable result),
> if not killed,
> return all reviews altogether.

Adopt bounded collection rather than first-result winner selection:

- Hold the first usable result while pending reviewers receive a grace period.
- Return all usable completed reviews together when every started reviewer settles.
- If reviewers remain pending when the grace period expires,
   cancel them and return all usable reviews collected by that cutoff.
- Start the collection clock at the first usable result.
  With the issue's initial reviewer and one fallback,
   another usable result finishes collection immediately.
- Preserve the original operation deadline before any usable result exists.
  This is inherited behavior,
   not a new decision established by the second answer.

The first-result grace is distinct from the launch delay for speculative work.
Do not silently treat the user's straggler grace as a value for the original hedge-launch delay.
No implementation is authorized until the design interview receives shared-understanding confirmation.

Round 3 asked for collection grace duration and deadline precedence.
The user answered:

> I'll go with whatever you recommend this round.

Accepted policy:

- Default collection grace is 30 seconds,
   configurable.
  This is an initial policy choice,
   not a measured optimum.
- The original operation deadline remains absolute.
- Collection ends at the earlier of grace expiry and original deadline.
- At either cutoff,
   cancel pending calls and return all usable reviews already collected.
- Caller cancellation stops the operation immediately.

Retain delayed launch and one fallback as the issue's working scope,
 rather than expanding to simultaneous or wider review fan-out without need.
Later decisions include scoped participant selection,
 provider-diversity requirements,
 recovery bounds,
 available-usage finalization,
 returned-review formatting,
 and integration of still-open prerequisite issues.
Recompute the frontier after the user's answers.

## Added requirement: exhausted provider credits

The user reported this Advisor failure during the interview:

```text
advisor Consulting advisor hyper/deepseek-v4-flash-0731 with question
advisor: provider call failed for hyper/deepseek-v4-flash-0731 on attempt 1:
402: {"message":"You're out of credits. Add more at https://hyper.charm.land","type":"billing_error","code":null}
```

The user explicitly requested:

> Also implement:
> JIT,
> If a provider is out of credits,
> block the provider for this call.

Accepted implementation requirement:

- Detect exhausted credits from the actual request outcome,
   not an eager credit-balance preflight.
- Block further dispatches to every model on the affected provider
   within the same Advisor operation,
   including recovery and fallback dispatches.
- Keep other providers eligible.
- Do not persist this provider exclusion into later Advisor calls.
- Preserve exact explicit-model semantics;
   an explicit request does not switch to a different provider or model.
- Keep completed usable reviews and failure diagnostics.
- Add regression coverage using the reported `402` and `billing_error` response shape.

This is user-reported evidence,
 not a claim that this interview reproduced the provider failure.
The current adapter's structured-error and string-error paths still need investigation.
Do not generalize every HTTP 402 or every billing failure to exhausted credits without classification evidence.
No top-up or other billing mutation is authorized or needed.

Track this as an independently verifiable implementation task alongside collection behavior.

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

Investigate current provider failure,
 cancellation,
 and accounting representations before the next design frontier.
Read current Pi API documentation and source before prescribing integration behavior.
Do not repeat settled collection decisions or ask permission for the authorized credit-exhaustion block.
Obtain shared-understanding confirmation before implementation.
