# Temporal and participant source context

## Scope

Task 19 is in progress.
The verified production code is `134a2e20c`.
The bounded forward-heading window is implemented;
its existing repair-path output verification failed the wording goal and is being diagnosed.
No full-entry pass is active.
Task 20's non-persisted audit accuracy is deferred,
not a prerequisite to this work or the next Mio page reading.

## Actual evidence

The pinned Chinese source's preamble paragraph ends with `还曾：`.
The next heading introduces the primary-school friend story,
and the paragraph following that heading dates the reconnection to April 2022.
It identifies Bei Yan Yun Yi as the person who came out to Mio.
The source does not place this disclosure in childhood or state reciprocal disclosure during that reconnection.

Mio12's accepted repair wording instead says:

> She came out to her best friend in primary school.

The current `neighbouringSource` call for prepared slice position four includes
source slice three's childhood/SRS prose and slice five's heading,
but not slice six's dated paragraph.
This was reproduced in `~/temp/agent/Mio12-temporal-context-20260910.out`.
The implementation in `package/module/translation-repair/src/fidelity-window.ts`
budgets physical adjacent slices,
although its historical comments discuss neighboring sections.

The actual old translation slate does not contain a corrected date-and-participant alternative.
Its selected candidate drops the list entirely;
other candidates repeat the ambiguous or reversed bullet.
The lane contest selects repair to preserve the archive's list.
Evidence:

- `~/temp/agent/Mio12-temporal-lane-20260910.out`
- `~/temp/agent/Mio12-temporal-contest-20260910.out`

This is a missing-input hypothesis,
not evidence that a stronger rejection gate or an additional corrective generation round is needed.

The caller trace is in `~/temp/agent/temporal-window-callers-20260910.out`.
`repair-slice-settle.ts` includes both neighboring texts in its cache key
and `repair-chunk.ts` threads one shared window through critics,
judges and editors.
`translate-stage-repair.ts` passes neighboring evidence to judging,
but its initial `produceTranslateSlate` call does not pass either neighbor field.
Therefore a window change alone must not be described as improving initial translation-writer inputs.
If the measurements support wider evidence,
verify and measure the producer boundary as well as the selector boundary before choosing the complete remedy.

## Matched experiment

`~/temp/agent/probe-temporal-context-20260910.mjs`
rebuilds the exact Mio12 preparation from its stored artifact and pinned source.
It asserts that the intervening slice contains only headings
and that the next source paragraph begins with the April 2022 date.

The controlled main slate preserves the accepted prose,
normalizing the independently fixed group-name defect identically across all alternatives.
Only the first bullet varies:

- Archive wording with childhood attachment and Mio as discloser.
- `from primary school`,
  fixing the temporal attachment while retaining Mio as discloser.
- Reconnection with the primary-school friend,
  with that friend coming out to Mio.
- Reciprocal disclosure at reconnection,
  which the source does not state.

These are controlled alternatives,
not historical model outputs;
no model authorship is attributed to them.
The production shared candidate-selector builder and ordinary translation criteria are reused.
The fixed judges are the original responding judges from Mio12's translation selection for this slice.
These per-seat observations are not a production-window tally.

The direct-source positive control runs first.
It uses the actual dated Chinese paragraph and its archive translation,
changing only the disclosure sentence into matching date/direction alternatives.
If no judge chooses the source-correct control,
the harness stops before purchasing the main comparisons.
Null results must be interpreted against each judge's control response.

Main contrasts keep candidate texts,
original slice and system instructions identical:

- Current physical source and archive neighbors.
- Original neighboring source plus the next body paragraph,
  with neighboring archive held fixed.
- The same widened source plus the corresponding archive paragraph.

This separates the effect of source evidence from paired English context.
It does not yet choose a global traversal algorithm,
expand picture authority,
change the corpus,
or authorize translating every neighboring passage into the current slice.
All controlled candidate texts compile as MDX before the live run;
compiled provider code is never executed.

## Completed selector-input measurement

`proc_1eda` completed `translation-repair-temporal-context-probe-20260910` in 186 seconds.
Plan:
`~/temp/agent/temporal-context-plan-20260910.out`.
Log:
`~/temp/agent/temporal-context-probe-20260910.log`.
Report:
`~/temp/agent/temporal-context-probe-20260910/report.json`.

The probe is bounded to twenty-four requests,
six concurrent,
360000 ms per exchange and 1200000 ms globally.
Completion caps remain the client's measured defaults.
No provider SDK,
reasoning-budget field or extra production writing round is introduced.

All six judges select the date-and-direction-correct positive control.
With current physical neighbors,
only one chooses the correct main candidate;
others prefer childhood attachment,
Mio as discloser,
mutual disclosure,
or decline the slate.
Adding the next source paragraph moves four of six to the correct wording.
Adding the corresponding archive paragraph also yields four correct choices,
with a different abstaining judge.
The widened arms select no incorrect alternative;
the other replies abstain over shared list/coverage objections.

Some judges misread "not expected to render this" as prohibiting existing summaries supported by context.
The reported candidate texts,
not every rationale assertion,
are the evidence of correct choice.
These are matched per-seat results,
not a production selection or unanimity requirement.

The run logged 0.00062544 USD on Bedrock,
four OpenRouter calls reporting zero,
and four unpriced Hyper plus twelve unpriced Synthetic calls.
The daily helper ran afterward.

## Completed first-writer context probe

`proc_7375` completed `translation-repair-temporal-writer-context-probe-20260910` in 376 seconds.
Script:
`~/temp/agent/probe-temporal-writer-context-20260910.mjs`.
Plan:
`~/temp/agent/temporal-writer-context-plan-20260910.out`.
Log:
`~/temp/agent/temporal-writer-context-probe-20260910.log`.
Report:
`~/temp/agent/temporal-writer-context-probe-20260910/report.json`.

It captures actual first-writer requests from `produceTranslateSlate` on frozen `ba01babda`,
including the existing answer-character bound and 360000 ms exchange bound.
The offline plan now asserts the actual `translation_report` schema name;
a mistaken schema-name assertion failed before any live call.

Qwen,
Kimi and Mercury each receive the current no-neighbor baseline,
physical neighbor context,
and context including the next body paragraph.
System instructions and current source/archive bytes stay fixed.
Both contextual arms use the same instruction that context clarifies references and already-carried details,
adds no neighboring-passage coverage obligation,
and cannot license unsupported facts.
Only context width differs between those arms.

The run permits nine calls,
three concurrently,
with a 1200000 ms global bound.
It buys no structural send-back or follow-up generation.
The writer treatment did not fix the observed bullet.
Qwen and Kimi both keep Mio as the discloser with the childhood attachment in the wider arm;
Mercury's wider reply fails schema validation.
Some baseline and physical-context drafts also omit the required list,
duplicate the administrator detail or change the established group name.
Those are not successful outputs merely because they compile.
No initial-translation-writer context change is integrated from this experiment.

The run logged three OpenRouter calls reporting zero cost
and six unpriced Synthetic calls.
The daily helper ran afterward.

## Implemented heading boundary

The fixed-slate source evidence supports a bounded context change for existing consumers.
The independent advisor recommended forward-only extension:
a heading governs the body after it,
whereas looking backward past a heading can pull in the prior section's body.
That correction to the proposed symmetric traversal was adopted.

`1bdf5d17c` adds failing guards.
The old implementation fails the dated-body,
media-body and unknown-node body cases.
`e086402a6` adds `fidelity-window-positions.ts`
and makes both language views use its shared positions.

The rule preserves immediate neighbors and adds at most one body slice
when the immediate following source slice is positively heading-only.
It does not traverse backward,
skip media,
walk past another heading,
or cross metadata.
Nonempty unknown-node content consumes the single body position;
empty content and mixed heading/body slices stop extension.
Stamped result indices remain distinct from array positions.

The initial full suite exposed an older fixture that cast incomplete objects to `ChunkPair`
without the required `nodes` fields.
`f8fd0555d` supplies parsed structural nodes instead of weakening the production type contract.
Formatting and early-return cleanup follow through `134a2e20c`.
The final build,
types,
zero-warning oxlint and full unit suite pass.
`~/temp/agent/heading-window-check-unit-20260910.out` ends `unit exit 0` at line 9065.

The frozen build is
`package/module/translation-repair/node_modules/.frozen-dist-134a2e20c`.
The actual reconstructed Mio12 window now byte-matches the measured widened source and archive contexts.
This is checked by the next probe's offline plan,
not inferred from the before-state code.

## Completed existing repair-path verification exposes an unresolved contract boundary

`proc_c166` completed `translation-repair-temporal-repair-path-probe-20260910` in 748 seconds.
Script:
`~/temp/agent/probe-temporal-repair-path-20260910.mjs`.
Plan:
`~/temp/agent/temporal-repair-path-plan-20260910.out`.
Log:
`~/temp/agent/temporal-repair-path-probe-20260910.log`.
Report:
`~/temp/agent/temporal-repair-path-probe-20260910/report.json`.

It runs the real `repairChunk` for the actual Mio12 slice,
using the stock role allocation under the original availability snapshot,
including critics,
panels,
editors,
selectors and checkers.
Those existing repair consumers already receive neighboring context.
The client retains normal routing,
completion caps,
quorum and author-defense policies.

The probe covers one slice,
at most 120 JSON requests,
360000 ms per exchange and 1200000 ms globally.
Reaching the request bound aborts the shared signal;
an incomplete run is not success evidence.
It reuses completed payloads only in a copied disposable cache.
No corpus edit or extra production generation round is introduced.

The process returned after forty-six requests and its text compiles,
but it did not produce a correct retained summary bullet.
It removed the entire list and changed `Harunome Hanbai` to source script plus `Harunome Studio`.
The paragraph ends with "and she also:".
This is not a successful wording repair or grounds for launching the full Mio pass.

The requests were six critics,
six panel calls,
three editors,
twenty-five candidate selections,
three resolution checks and three introduced-defect checks.
No precise temporal/participant claim survived in the returned issue set.
Two broad list-addition claims each drew four supporting votes,
one opposing vote and one ambiguous vote.
One wrongly describes even the administrator detail as absent,
although that detail is present in the current original.
All three editors remove the list.

The group-name claims also received authorization in the full packet,
with five supporting votes on several literal-name/gloss claims.
This responding panel differs from the earlier isolated group-name experiment;
do not attribute the difference to packet size or the heading-window change without a matched comparison.
Task 21 separately tracks full-repair name authority and blocks the next Mio pass.
No special glossary entry is authorized.

The run logged 0.00205745 USD on Bedrock,
three OpenRouter calls reporting zero,
and thirteen unpriced Hyper plus twenty-four unpriced Synthetic calls.
The daily helper ran afterward.

`~/temp/agent/replay-temporal-repair-path-20260910.mjs`
reproduces all forty-six completed calls with no provider client,
zero cache misses,
and identical repaired text.
Its captured exact requests and responses are in
`~/temp/agent/temporal-repair-path-replay-20260910.json`.
Summaries and decisions:

- `~/temp/agent/temporal-repair-path-summary-20260910.out`
- `~/temp/agent/temporal-repair-adjudication-20260910.out`
- `~/temp/agent/temporal-repair-editors-20260910.out`

## Next measured boundary

The critic's existing nearby-context rule permits only locating material carried across passages.
The panel's rule also concentrates on relocation.
A candidate's coverage obligations,
its editable target,
and the source evidence that can verify a current claim are different boundaries.
Treating "not required to translate" as "cannot support any current wording" defeats the supplied context.

The next hypothesis changes those existing context-purpose rules,
not the documents,
roster,
quorums,
response schema or production graph.
Nearby source may verify references,
time,
participants and details already asserted in the current target.
It adds no obligation to translate neighboring passages.
Nearby archive shows placement,
not factual authority.
Critic quotes remain anchored to the current documents;
when source evidence exists only nearby,
`sourceQuote` can be omitted while a current `targetQuote` anchors the claim.

The independent advisor supports this focused experiment and identifies a falsifier:
a compound claim may bundle a supported item with an unsupported one,
then continue authorizing deletion of the whole list.
Inspect propositions and actual tally outcomes,
not just whether one new temporal claim appears.
A fixed original panel packet tests the old claims only;
new critic claims need their own newly built panel packet before any end-to-end claim.
Task 19 remains in progress.
No new production prompt change has been made.

## Completed evidence-scope experiment

`proc_12b5` completed `translation-repair-evidence-scope-probe-20260910` in 476 seconds.
Script:
`~/temp/agent/probe-repair-evidence-scope-20260910.mjs`.
Plan:
`~/temp/agent/repair-evidence-scope-plan-20260910.out`.
Log:
`~/temp/agent/repair-evidence-scope-probe-20260910.log`.
Report:
`~/temp/agent/repair-evidence-scope-probe-20260910/report.json`.

The offline plan reconstructs real critic claims,
clusters and panel outcomes from twelve cached calls,
with zero misses and messages equal to the captured full-repair requests.
It checks the actual exchange field is 360000 ms.

The live experiment first applies the context-role treatment to the unchanged original panel packet.
It then runs the real critic stage under the critic treatment,
including exact quote anchoring,
and builds a fresh panel packet from surviving new claims.
The real panel stage and `tallyVotes` determine authorization in both panel runs.

Only existing user-message context-purpose rules change.
System instructions,
name policy,
source and target text,
neighbor text,
response schemas and stock role allocation remain fixed.
The first fixed-packet panel uses the same prompt-dependent original cohort;
the newly derived packet may select a different stock window,
which must not be misreported as a matched per-seat comparison.

The cap is fifty-four live JSON requests,
with a 1200000 ms global bound and shared abort on request exhaustion.
No editor calls or new production stages are bought by this experiment.
The run made twenty live requests.
On the fixed old packet,
both blanket list-addition claims moved from accepted to `needs-human`,
each with three supporting and three opposing votes.
That removes their authorization but is not unanimous rejection.

The new critic stage produced thirty-two anchored claims.
Several correctly identify the friend as the discloser to Mio,
and one explicitly places the reconnection disclosure in 2022.
They omit `sourceQuote` and retain exact target anchors,
so the suspected anchoring obstacle does not discard them.

The freshly derived panel accepts those precise claims,
but also accepts new blanket list-removal claims with five supporting votes.
It also accepts claims against the second friendship bullet,
whose supporting source section is outside the bounded window.
Thus the advisor's compound-claim/scope falsifier remains live;
the treatment alone is not sufficient.
No production prompt change is integrated from this result.

The run logged 0.00237755 USD on Bedrock,
two OpenRouter calls reporting zero,
and eight unpriced Hyper plus six unpriced Synthetic calls.
The daily helper ran afterward.

## Completed claim-extent and source-evidence experiment

`proc_9549` completed `translation-repair-claim-extent-probe-20260910` in 576 seconds.
Script:
`~/temp/agent/probe-repair-claim-extent-20260910.mjs`.
Plan:
`~/temp/agent/repair-claim-extent-plan-20260910.out`.
Log:
`~/temp/agent/repair-claim-extent-probe-20260910.log`.
Report:
`~/temp/agent/repair-claim-extent-probe-20260910/report.json`.

It keeps the new thirty-two-claim packet fixed,
reproducing the derived-panel baseline from seven cached requests with zero misses.
The baseline includes the unreadable DeepSeek-flash reply and its recovery attempt;
it is not filtered to usable responses.
An offline assertion initially mishandled the additional recovery user message.
The transformation now targets only the one original context-bearing user message,
preserves recovery instructions,
and separately asserts that no baseline client exception was swallowed.
The corrected plan passes before live calls.

The experiment factors two changes:

- Full current-entry Chinese source as additional factual evidence only,
  without expanding current editable or coverage scope.
  This source is 1755 characters;
  the experiment asserts its unchanged hash and an 8000-character input bound.
  No global whole-document context policy is adopted.
- A generic claim-extent rule:
  an unsupported item cannot prove that every item in its list or span is unsupported;
  narrow actual errors remain independently judgeable.

It measures each change alone and the combination,
with the completed scoped-window baseline retained as the comparator.
Name policy,
claim identities,
stock panel roster,
schemas,
nearby archive and actual tally rules stay unchanged.
The limit is fifty-four live requests,
360000 ms per exchange and 1200000 ms globally.
No critics,
editors or new production stages are added in this experiment.

The run made twenty-one live calls.
Claim extent alone still authorizes blanket removal.
Document evidence alone changes one blanket claim to `needs-human`,
but leaves false claims against the supported second-friendship bullet authorized.
The combined treatment again authorizes blanket removal.
The true participant correction remains accepted in all arms.
These results do not justify integrating either treatment as the remedy.

Per-claim participation differs from reported heard-panelist counts in two arms:
one reply uses severity words as votes,
and another omits verdicts for later claims.
The real resolver records `unknown-vote` and `missing-verdict` findings;
do not count these as valid support or opposition.
The combined arm has no such findings but still fails the intended authorization result.

The run logged 0.00470453 USD on Bedrock,
three OpenRouter calls reporting zero,
and ten unpriced Hyper plus two unpriced Synthetic calls.
The daily helper ran afterward.

## Completed editor responsibility experiment

Further voting-only prompt trials are not scheduled now.
The independent advisor recommends testing the existing editor's responsibility boundary
against actual assembled candidates.

`proc_b599` completed `translation-repair-editor-responsibility-probe-20260910` in 388 seconds.
Script:
`~/temp/agent/probe-editor-responsibility-20260910.mjs`.
Plan:
`~/temp/agent/editor-responsibility-plan-20260910.out`.
Log:
`~/temp/agent/editor-responsibility-probe-20260910.log`.
Report:
`~/temp/agent/editor-responsibility-probe-20260910/report.json`.

Both arms use the same newly derived accepted-issue packet,
including the true participant correction and false blanket claims.
This is not a comparison against old editor outputs that received different issues.
The production deduplication and envelope builders yield sixteen accepted issues and four edit regions.
The editor models are the unchanged stock trio.

The treatment replaces "reviewers confirmed" with a responsibility to verify fallible findings,
and rewrites the conflicting source-support rule rather than appending another exception.
The current source slice defines coverage;
the complete hash-checked original document supplies factual evidence;
only the current English edit regions may change.
It permits correcting an already-asserted fact's actor,
direction,
time or relationship without importing neighboring events or copying neighboring passages.
Name policy is unchanged and remains task 21.

The probe makes six calls maximum,
three concurrently,
with the existing response schema,
360000 ms exchange bound and 1200000 ms global bound.
It calls no panel or selector.
Every raw edit is resolved and applied through production `buildEditorCandidates`,
including the existing preservation gate.
It records complete assembled candidates,
rejected operations,
MDX compilation and the existing structure validator's result.
The validator is observed,
not added as a new publication gate.

The offline positive control applies a localized participant correction through the same assembler,
preserves all bytes outside its region,
and passes the existing structure check.
All three baseline editors remove the list and change the established group name.
All three treatment editors do the same;
one moves the administrator detail into the preceding region and deletes the list region entirely.
Every assembled candidate compiles,
but every candidate fails the existing archive block-shape check.
No candidate supplies the intended retained participant correction.
This falsifies the tested editor-responsibility treatment on this packet;
it is not integrated.

The run logged four unpriced Hyper and two unpriced Synthetic calls.
The per-provider spend and daily helpers ran afterward.
No reported dollar amount is treated as proof that unpriced service was free.

A further caller trace found that `editor-ensemble.ts` supplies no neighboring-source evidence
to either `selectPerEnvelope` or `selectChunkPatch`.
Per-envelope selection sees the current English region and a bounded English surroundings view;
whole-chunk selection sees only the current original as evidence.
Thus a successful new editor candidate will still require verification at those selection boundaries.
Do not claim the existing repair window already reaches every repair selector.

## Active accurate-claim diagnostic control

`proc_ec6f` is `translation-repair-editor-accurate-claim-probe-20260910`.
Script:
`~/temp/agent/probe-editor-accurate-claim-20260910.mjs`.
Plan:
`~/temp/agent/editor-accurate-claim-plan-20260910.out`.
Log:
`~/temp/agent/editor-accurate-claim-probe-20260910.log`.
Report:
`~/temp/agent/editor-accurate-claim-probe-20260910/report.json`.

This is a diagnostic positive control,
not a proposal to silently filter production claims.
The stock editor receives only the source-verified participant claim,
while the current source,
translation,
neighboring context,
stock editor models,
four edit regions and original preservation licenses remain unchanged.
Keeping the original licenses prevents a stricter gate from creating an apparent improvement.
Only the visible issue packet changes.

Three calls are allowed,
with a 360000 ms exchange bound and 1200000 ms global bound.
The real assembler and existing structure validator process each response.
Compare raw operations and assembled candidates against the completed stock-editor arm,
not just whether the process exits successfully.
No production prompt or admission-rule change is made.
