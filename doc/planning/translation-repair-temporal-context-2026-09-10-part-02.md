# Temporal and participant source context, part 02

Part 02 of [Temporal and participant source context](translation-repair-temporal-context-2026-09-10.md),
whose index lists every part in order.

## Completed existing-English comparison check

`proc_3b2b` completed `translation-repair-selection-baseline-probe-20260910` in 58 seconds.
Script:
`~/temp/agent/probe-repair-selection-baseline-20260910.mjs`.
Plan:
`~/temp/agent/repair-selection-baseline-plan-20260910.out`.
Log:
`~/temp/agent/repair-selection-baseline-probe-20260910.log`.
Report:
`~/temp/agent/repair-selection-baseline-probe-20260910/report.json`.

This adds only the existing English before repair to the completed source-evidence whole-chunk treatment.
Source evidence,
candidate wording,
authorship,
fallbacks,
system criteria and original judge window remain fixed.
The existing English is comparison context for what was already carried,
not independent factual authority.
Every offered candidate is an actual changed text,
not the unchanged baseline;
no model identity is disclosed through this comparison block.

The probe calls only the stock whole-chunk selector,
with at most twenty-four requests and the same 360000/1200000 ms bounds.
The offline plan checks both the candidate-sheet transformation and recovery-message preservation.
No new writing or invented composite is introduced.
The actual whole-chunk selector chooses GLM-5.3's correct-disclosure candidate at weight five over six ballots,
not by fallback.
Its group-name mutation remains the separate task 21 blocker.
The run logged 0.00079041 USD on Bedrock,
one OpenRouter call reporting zero,
and two unpriced Hyper plus one unpriced Synthetic call.
The daily helper ran afterward.

## Implemented packet and evidence boundaries

Task 22 implements the measured cluster review unit in `panel-stage.ts`,
re-exported from `repair-stages.ts`.
All packets and local claim/group maps are materialized before the first panel call.
`mapOverlapped` with overlap one bounds packet execution;
no vote creates another packet or generation round.
Every packet uses the unchanged electorate and independent resolver/tally.
The union of heard identities is reporting only,
never a quorum basis.

`repair-evidence-role.ts` supplies the measured current-coverage versus factual-evidence distinction
in critic and panel context blocks.
The panel accepts optional `documentSourceText`;
local critic quote anchoring remains unchanged.
The three red packet guards fail on the old implementation in `06d120f74`.
Implementation `53a249bb1` and subsequent fixture/formatting commits are locally verified through `5c10ed0eb`.
The full suite ends `unit exit 0` in `~/temp/agent/cluster-panel-final-unit-20260910.out`.
The built public stage reproduces thirty cached stock-window requests with zero misses
and exactly twenty-one measured issue decisions:
`~/temp/agent/cluster-panel-runtime-replay-20260910.out`.
Ordinary no-context critic/panel prompts remain byte-identical in
`~/temp/agent/panel-prompt-parity-20260910.out`.

Task 23 threads same-entry source evidence from `repair-slice-settle.ts`
through the cache key,
twin key,
purchase,
repair chunk,
panel and existing repair selectors.
An unchanged full source equal to the current slice is not redundantly supplied by the corpus caller.
A changed document outside the local window changes the repair key.
It does not change initial translation-writer prompts.

`repair-selection-evidence.ts` supplies the measured nearby/document evidence to both selector granularities.
Whole-chunk selection also receives the existing English before repair from its known untouched fallback.
This is comparison context,
not an extra candidate or independent factual authority.
`editor-envelope-context.ts` extracts the existing bounded English-context helper to preserve the module line budget.

The three red evidence/key guards in `6b8921898` fail before implementation `05c736e4e`.
Additional guards exercise the actual prepared-document and editor-stage handoffs,
not only helper strings.
Build,
types,
zero-warning lint and the complete suite pass through `8adb77fb9`.
`~/temp/agent/evidence-handoff-unit-20260910.out` ends `unit exit 0` at line 9125;
post-format focused tests also pass.
`~/temp/agent/repair-selection-parity-20260910.out`
proves the compiled regional and whole-chunk prompts match the measured treatments.
No-context regional prompts remain unchanged.

One type-check was started before changed built declarations were ready and emitted TS2353.
The after-build type-check passes;
future public-API verification must rebuild before checking tests that import built declarations.
Proposed instruction clarification:
`CM6` should mention this ordering when public APIs change.
No `AGENTS.md` amendment was made.

The implementation-review advisor request timed out;
no endorsement is attributed to that call.
Verification rests on the named tests,
parity checks and public-stage replay.

A read-only census of the unchanged pinned corpus finds ninety-two source pages;
`XingZ60` is largest at 16733 UTF-16 characters and 41720 bytes.
The census is `~/temp/agent/original-evidence-size-20260910.json`.
This is size evidence,
not proof of model comprehension or a new truncation policy.

## Completed compiled full-path check remains insufficient

`proc_ccdb` completed `translation-repair-temporal-implemented-path-probe-20260910` in 971 seconds.
Script:
`~/temp/agent/probe-temporal-implemented-path-20260910.mjs`.
Plan:
`~/temp/agent/temporal-implemented-path-plan-20260910.out`.
Log:
`~/temp/agent/temporal-implemented-path-probe-20260910.log`.
Report:
`~/temp/agent/temporal-implemented-path-probe-20260910/report.json`.

It executes actual `repairChunk` on frozen `.frozen-dist-8adb77fb9`,
without intercepting prompts.
The same-entry original is supplied through the implemented argument.
Completed prompt stores are merged into a new disposable store;
conflicting records stop setup instead of silently overwriting a response.
The bound remains one slice,
120 JSON requests,
360000 ms per exchange and 1200000 ms globally.
The run returned after eighty-three JSON calls.
It retained the second friendship item but removed the disclosure item,
and changed the group name to source script plus an explanatory gloss.
This does not complete task 23 or task 19.

The actual regional slate contained only deletion and a duplicate second-friendship item;
no correct disclosure draft survived from the two usable editors.
The regional selector declined that slate.
The whole-chunk slate contained those flawed drafts and a composite retaining the old incorrect disclosure.
It tied and used the existing indecision fallback.
Thus this result is not a selector silently discarding an available correct candidate.
Evidence:

- `~/temp/agent/temporal-implemented-path-results-20260910.out`
- `~/temp/agent/temporal-implemented-slates-20260910.out`
- `~/temp/agent/temporal-implemented-decisions-20260910.out`

The run logged 0.00506431 USD on Bedrock,
nine OpenRouter calls reporting zero,
and twenty-two unpriced Hyper plus thirty-three unpriced Synthetic calls.
The daily helper ran afterward.
Task 21 remains separate and no full Mio pass is active.

## Completed category-conflict diagnostic

The admitted packet contains the correct `accuracy/mistranslation` claim about disclosure direction
and two `accuracy/addition` claims scoped to that same item.
This may steer authors toward removing a documented event rather than correcting its actor.
The hypothesis is not yet a diagnosis or justification for production filtering.

The MQM-derived taxonomy in `issue-taxonomy.ts` lists those categories but does not define the distinction for models.
The [MQM Core typology](https://www.themqm.org/mqm-pillars/the-mqm-core-typology/)
describes mistranslation as inaccurate representation of source content,
and addition as content not present in source.
Its polarity-distortion example is categorized as mistranslation;
its addition example is unrelated material pasted from another translation.
This informs a possible project-specific distinction,
not a claim that MQM itself prescribes this pipeline's edit operations or forbids all category overlap.

`proc_88f8` completed `translation-repair-editor-category-conflict-probe-20260910` in 202 seconds.
Script:
`~/temp/agent/probe-editor-category-conflict-20260910.mjs`.
Plan:
`~/temp/agent/editor-category-conflict-plan-20260910.out`.
Log:
`~/temp/agent/editor-category-conflict-probe-20260910.log`.
Report:
`~/temp/agent/editor-category-conflict-probe-20260910/report.json`.

This diagnostic removes only the two overlapping addition diagnoses from the visible editor packet,
retaining the accurate participant claim and every other admitted name,
layout and wording issue.
The source,
target,
nearby context,
stock editor prompt,
five original edit regions and original preservation licenses remain unchanged.
It makes at most three calls with the existing 360000/1200000 ms bounds.
The real assembler and structure check process its outputs.
Both GLM editors now retain and correct the disclosure item,
explicitly placing the event at reconnection.
DeepSeek retains the old direction.
All retain the second friendship item and pass the structure check,
but group-name changes remain.
The matched GLM-5.3 result changes from deletion in the compiled run to a corrected retained item,
while the other admitted issues and adoption gate remain fixed.
This supports testing the category distinction,
not a hand-picked production filter.

The run logged two unpriced Hyper and one unpriced Synthetic call.
The spend and daily helpers ran afterward.
No production category filter,
new guard or generation round is added.

## Completed accuracy-category scope measurement

Task 24 completed at the classification and per-claim adjudication boundary.
The compiled run exposed a separate issue-merging defect,
recorded as task 25.
`proc_e0ee` completed `translation-repair-accuracy-category-scope-probe-20260910` in 301 seconds.
Script:
`~/temp/agent/probe-accuracy-category-scope-20260910.mjs`.
Plan:
`~/temp/agent/accuracy-category-scope-plan-20260910.out`.
Log:
`~/temp/agent/accuracy-category-scope-probe-20260910.log`.
Report:
`~/temp/agent/accuracy-category-scope-probe-20260910/report.json`.

The treatment defines a distorted rendering of a documented event as mistranslation,
not independent added information merely because its wrong assertion is not stated verbatim in the source.
Genuine independent extra information remains an addition.
The panel must check the claimed category as well as whether some problem exists.
The experiment changes only that explanatory criterion in critic and panel system messages.
It preserves source data,
name policy,
response schemas,
region/anchor rules,
stock roles and quorum handling.

A synthetic genuine-addition control runs first;
if it is not accepted as an addition,
the remaining arms are not purchased.
The fixed current disclosure-touching cluster is then reviewed under the category rule.
A new critic round uses actual anchoring,
and its disclosure-touching clusters go through the real panel and tally.
No editor or extra production generation round is part of the experiment.

The offline baseline reconstructs the compiled run's critics and disclosure cluster from cache,
asserting no cache misses or swallowed client errors.
The bound is forty-eight live requests,
360000 ms per exchange and 1200000 ms globally.
Inspect whether mislabeled addition diagnoses lose authorization,
the accurate actor correction remains actionable,
and new critics stop producing contradictory diagnoses before adopting any rule.
The genuine independent-addition control remains accepted at five-to-one.
The old fixed packet still authorizes the two mislabeled addition claims at four-to-two;
this is not a universal remedy for already-stored diagnoses.
With new critic output,
the disclosure-touching panel rejects the competing addition diagnoses
while accepting the actual participant mistranslation six-to-zero.
Some critics still emit addition diagnoses,
so the result is the admitted packet,
not a claim of unanimous classification.

The run made twenty-seven live calls and logged 0.00201981 USD on Bedrock,
four OpenRouter calls reporting zero,
and nine unpriced Hyper plus ten unpriced Synthetic calls.
The daily helper ran afterward.

## Genuine omission control and integration

`proc_545a` completed `translation-repair-accuracy-omission-control-20260910` in fifteen seconds.
All six critics locate the genuinely missing friend-return event as an omission;
one also raises an unrelated tense complaint.
The panel accepts the known omission six-to-zero.
This is not a claim that every incidental critic finding is correct.
Report:
`~/temp/agent/accuracy-omission-control-probe-20260910/report.json`.
The run logged 0.00097313 USD on Bedrock,
one OpenRouter call reporting zero,
and three unpriced Hyper plus six unpriced Synthetic calls.
The daily helper ran afterward.

The red guards in `469946abf` fail on the old critic/panel builders.
`029c0a886` adds `accuracy-category-policy.ts`
and integrates the exact measured category distinction and adjudicator check.
No response schema,
category enum,
quorum,
name policy,
claim filter or generation graph changes.
New prompt identity invalidates old raw replies for these questions;
old stored artifact interpretations are not rewritten.

Build,
types,
zero-warning lint and the full suite pass.
`~/temp/agent/accuracy-category-unit-20260910.out` ends `unit exit 0` at line 9130.
`~/temp/agent/accuracy-category-parity-20260910.out`
confirms both compiled system messages match the measured treatment
and their user evidence is unchanged.

## Completed compiled category-path check

`proc_948d` completed `translation-repair-temporal-category-path-probe-20260910` in 631 seconds.
Script:
`~/temp/agent/probe-temporal-category-path-20260910.mjs`.
Plan:
`~/temp/agent/temporal-category-path-plan-20260910.out`.
Log:
`~/temp/agent/temporal-category-path-probe-20260910.log`.
Report:
`~/temp/agent/temporal-category-path-probe-20260910/report.json`.

It executes the actual repair path on frozen `.frozen-dist-029c0a886`,
without prompt interception or claim filtering.
Stock roles,
source and current archive are unchanged;
completed caches are merged into a disposable store with conflict checks.
The limits remain one slice,
120 JSON requests,
360000 ms per exchange and 1200000 ms globally.
The run made 84 JSON calls,
including cache reuse:
nine critic,
36 panel,
three editor,
thirty candidate ballots and six checker calls.
It again deleted the disclosure and renamed the group to `Harunome Studio`.
The page fragment compiled,
but had no correct disclosure candidate.
Both GLMs deleted the first item;
DeepSeek replaced it with a duplicate of the second friendship item.
All their editor sheets contained the rejected addition diagnosis.

The panel actually supported the participant mistranslation six-to-zero
and opposed the overlapping addition diagnosis four-to-two.
`tallyVotes` then merged them into one accepted issue
and retained both claims as its members.
`regionBlock`,
`deriveEditableEnvelopes` and `buildLicensedQuotes`
consume every claim of an accepted issue.
Thus a rejected diagnosis became a confirmed editor instruction,
not because the panel had approved it,
but because the grouped status promoted it.

`~/temp/agent/temporal-category-path-replay-20260910.json`
reproduces all 84 calls from cache with zero misses and identical repaired text.
`~/temp/agent/temporal-category-editor-decisions-20260910.out`
records the actual instructions and editor replies.
Bedrock logged 0.00649678 USD;
six OpenRouter calls reported zero,
with 25 Hyper and 24 Synthetic calls unpriced.
The daily helper ran afterward.

## Preserve member verdicts through merging

Task 25 implements the preventive fix at the tally boundary,
where the effective configuration and per-member decisions are still known.
A majority same-defect vote relates diagnoses;
it cannot override their individual acceptance decisions.

- `d0afa0932` demonstrates the failure in the tally,
  editor instruction,
  envelope and deletion-license paths.
  Eight tests fail against the old build.
- `a625c1441` partitions a panel-approved merge by effective member status.
  Each partition retains its own claims,
  tallies and readings.
  First-member order stays stable.
- Any member reaching the existing source-defect status still blocks the entire panel-merged cluster.
  This deliberately heterogeneous blocked record preserves the protective-minority policy.
  A below-threshold or below-quorum source concern does not create a new block.
- `issue-merge-partitioned` findings preserve the original cluster identity
  and the resulting issue identities/statuses in the persisted stage findings.
  This records the partition relationship;
  it does not claim that artifacts newly store every merge ballot.
- `6be939ec0` exposes a second evidence loss:
  emission deduplication appended claims without their tallies/readings.
  `b6c49c2dd` unions known member evidence,
  keeps absent legacy readings absent,
  and refuses conflicting known records for a repeated claim.
  The existing representative identity/severity policy is unchanged.
- Formatting and diagnostic-inventory checks finish through `b9d3b2ea0`.
  The first full-suite failures were the inventory for the new identifier-only conflict error,
  not a reason to bypass the diagnostic policy.

An independent advisor reviewed the partition seam,
source-defect exception,
lineage,
cache isolation and deduplication risks before implementation.
No model prompt,
category enum,
quorum or generation graph changes in this repair.

## Verification of the authority boundary

Build,
types,
zero-warning lint and the complete suite pass.
`~/temp/agent/issue-authority-complete-unit-20260910.out`
ends `unit exit 0` at line 9135.

`~/temp/agent/verify-issue-authority-replay-20260910.mjs`
uses the compiled public critic/panel stages without a provider client.
`~/temp/agent/issue-authority-replay-20260910.json` records:

- The same 45 critic/panel calls and zero cache misses.
- All eighteen member claims and their exact tallies/readings retained.
- Six old issues become eight,
  with four accepted issues in both runs.
  The additional rejected records change issue-count denominators;
  old/new aggregate rates are not interchangeable.
- The actual editor sheet no longer contains the rejected disclosure-addition instruction.
- Uniform accepted,
  rejected and needs-human issue records are byte-identical to the old build,
  both with and without a panel merge.
- Actual old/new build digests differ.
  A disposable repair-cache positive control resumes the old outcome under its own digest;
  opening with the new digest returns no old outcome.
  The ordinary non-opt-in artifact-generation guard refuses the old artifact pool
  with `GenerationDriftError`.

Historical artifacts remain readable as historical results,
not current evidence or fresh repair authority.
Raw critic/panel responses can still be reused because current code retallies them.

## Completed compiled authority-path check

`proc_0dc5` completed `translation-repair-temporal-authority-path-probe-20260910`
in 204 seconds on frozen `.frozen-dist-b9d3b2ea0`.

Script:
`~/temp/agent/probe-temporal-authority-path-20260910.mjs`.
Plan:
`~/temp/agent/temporal-authority-path-plan-20260910.out`.
Log:
`~/temp/agent/temporal-authority-path-probe-20260910.log`.
Report:
`~/temp/agent/temporal-authority-path-probe-20260910/report.json`.

It ran the actual repair path without prompt interception or hand-picked claim filtering,
with a disposable cache containing completed raw replies from the category-path run.
The bound remained one slice,
120 JSON requests,
360000 ms per exchange and 1200000 ms globally.

All three editors now independently produce the same disclosure correction:
`- Her best friend from primary school came out to her.`
The regional selector adopts the sole distinct wording without a ballot,
retaining all three contributor identities.
The whole-chunk composite then wins four of six votes,
not a fallback.
The second friendship and administrator item remain.
`from primary school` identifies the friend,
not childhood as the time of disclosure.
The summary does not redundantly specify April 2022;
the dated source narrative remains the evidence for the reconnection.

The run made 78 JSON calls,
including reuse:
nine critic,
36 panel,
three editor,
24 candidate ballots and six checker calls.
`~/temp/agent/temporal-authority-path-replay-20260910.json`
replays all 78 with zero misses and identical final text.
`~/temp/agent/temporal-authority-slates-20260910.out`
records every editor draft and selection round.
`~/temp/agent/temporal-authority-boundary-20260910.out`
records valid strict grammar and preserved paragraph/list structure.
Bedrock logged 0.00050104 USD;
three OpenRouter calls reported zero,
with five Hyper and sixteen Synthetic calls unpriced.
The daily helper ran afterward.

Tasks 23 and 19 are complete at the compiled repair boundary.
All drafts still rename `Harunome Hanbai`,
and the selected result says `Harunome Studio`.
Task 21 is now in progress for that separate name-authority defect.
Its bounded probe and completion criteria are in
[reference-name authority](translation-repair-name-authority-2026-09-10.md).
Whole-page readiness remains false;
no full-entry run is active.
