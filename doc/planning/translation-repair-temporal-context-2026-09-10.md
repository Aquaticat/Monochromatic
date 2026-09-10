# Temporal and participant source context

## Scope

Task 19 is in progress.
The verified production code remains `ba01babda`.
No temporal-context production change has been made and no full-entry pass is active.
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

## Active first-writer context probe

`proc_7375` is `translation-repair-temporal-writer-context-probe-20260910`.
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
Read actual prose,
list structure,
date and participant roles before deciding the producer remedy.
Compile success alone is not output-quality evidence.
