# Writer calibration unit scope

Task 38 blocks paid writer calibration in task 35.
No writer model call has run.
The Git-resolution heap fix remains verified;
V4.1 judge admission is unaffected.

## Evidence that changes the launch decision

The existing deterministic forty-row sample was read completely.
It contains 4290 source characters and 11946 incumbent characters,
with no empty side.
Heading-only and media-only tasks are not automatically invalid,
and an imperfect incumbent is not mislabeled gold in the producer instrument.

However,
`windward0032#14` pairs only the ten-character Chinese heading
with an English heading and three body paragraphs,
849 characters in total.
Its corresponding body source is in sibling `#15`,
whose incumbent contains only the final English tail.

The actual frozen validator establishes the consequence:

```text
The PAGE AS IT STANDS is 4 blocks (heading (level 2), paragraph, paragraph, paragraph)
and your translation is 1 (heading (level 2)).
Every block of the PAGE AS IT STANDS has to appear in your translation,
of the same kind and in the same order.
```

A heading-only candidate is refused,
while the complete incumbent passes.
The `lintong#0` heading-to-heading positive control passes.
Evidence is `v41-writer-heading-floor-20260911.out`
and the owned workspace's `heading-floor-check.json`.
This is the production archive floor functioning as designed against an incorrectly scoped benchmark unit.

An initial review had conditionally recommended preserving the forty rows because all writers see the same input.
The concrete floor test disproved the necessary premise:
the instrument forces preservation of body content whose source is outside the supplied task.
The independent reviewer withdrew that recommendation after seeing this probe.
Equal inputs do not establish validity of the task being ranked.

## Constraints

- Preserve the production archive floor and legitimate English expansion policy.
- Preserve forty calibration tasks and the existing producer,
  contributor,
  self-vote and pooled-null rules.
- Do not repair this with added generation rounds,
  a single-entry exception or post-outcome row deletion.
- Recompose both source and incumbent siblings together;
  merely adding neighboring source as context can duplicate or omit output obligations.
- Keep source,
  incumbent,
  ranges,
  parent identity and any coalesced membership auditable before model calls.
- Distinguish mechanical containment in an aligned parent from an unproven semantic guarantee about every archive sentence.

The proposed `AGENTS.md` `QIV` clarification in
[the reviewed fixture record](translation-repair-reviewed-calibration-fixtures-2026-09-11.md)
now includes consumer contracts and output obligations within each input unit.
It is not applied to `AGENTS.md`.
The expected action is being performed:
paid execution is blocked while the actual floor/scope mismatch is corrected.

## Direction to investigate

Trace the current sample through `alignDocumentSections` and `subdivideChunkPair`.
Prefer units closed over their archive-floor obligations rather than independently subdivided source/target fragments.
A coalesced parent can dissolve the mismatch;
if it needs subdivision,
source and incumbent must be split together only at independently closed boundaries.
Preserve production-relevant size limits instead of silently replacing slice work with unbounded whole documents.

The revised deterministic population must yield forty ordered units,
with explicit provenance and a pre-call reading.
Keep valid heading and media controls;
report non-informative contests separately rather than padding or dropping rows after outcomes.

Required checks include the windward regression,
the valid heading control,
complete paired source/target coverage,
no duplicate obligations,
and a removal test proving the coalescing or paired-boundary guard matters.
Freeze the revised plan and runtime before paid execution.

## Paired-parent prototype

The pinned census contains 275 nonempty deterministic section pairs across the corpus.
The source code does not simply zip independent chunks:
`subdivideChunkPair` uses a scorer-based monotone block alignment when no corroborated pairing is supplied.
The observed mismatch comes from using that uncorroborated fine-grained result as a calibration task.

A prototype that retains complete paired parents and applies the existing deterministic spread
produces forty tasks with 20117 source characters and 51710 incumbent characters.
The largest selected task has 1983 source characters and 5016 incumbent characters.
The whole population's largest target parent is 17851 characters;
the spread samples stratum midpoints rather than forcing that extreme into the draw.

Design comparison:

- Whole paired parents:
  preserves complete paired extents without claiming unproved fine-grained correspondence;
  increases the measured input distribution and still needs parent-alignment review.
- Selective sibling merging:
  could retain more of the old granularity;
  block counts alone cannot establish all cross-language dependencies,
  so missing proof would leave hidden mismatches.
- Neighboring source context only:
  adds evidence without changing the sample indexes;
  it leaves output obligations assigned to the wrong task and is not a remedy for this defect.

Ranking:
whole paired parents > selective merging > context-only.
Whole parents establish mechanical containment without the additional correspondence proof selective merging needs;
selective merging could correct output assignment with proof,
whereas context alone cannot.
Whole-parent selection was the implementation candidate at this checkpoint,
but the production-envelope experiment subsequently rejected it.
The larger input distribution and remaining deterministic parent-alignment assumptions must be disclosed,
and the selected forty parents still require a complete source/target reading before calibration.
No semantic correctness label is assigned to the incumbents.

The windward parent covers source offsets 2069 to 2988 and target offsets 11101 to 13840.
Its source includes the body missing from legacy `#14`.
Its incumbent still has a genuine missing-footnote issue,
which is distinct from task scope and must not be called a clean reference.
The new draw does not happen to select that parent;
the regression will exercise it directly rather than inserting it into the sample by hand.

Private prototype records are `parent-census.json` and `parent-prototype.json`
in the owned writer workspace.

## Production-envelope correction

`scope-envelope.json` records the next measured boundary.
The whole-parent sample contains `hulicaijia` source section 7,
whose parent predicate is false while a legacy child is line-structured.
The parent Boolean therefore cannot replace every child Boolean.
The forty parent tasks have median source length 393 and maximum 1983;
Mio12's actual recorded preparation has median 87 and maximum 390 across its seventeen slices.
This comparison is descriptive,
not a universal production maximum.

Keeping only parents that fit both existing node-group budgets leaves 43 candidates.
Its forty-task draw has median source length 89 and target length 171,
mostly single-node parents.
Allowing either atomic side adds only three candidates.
This is not evidence that such filtering preserves representative coverage.
The unrestricted and shape-filtered whole-parent proposals are rejected.
Only a provenance type scaffold was committed at `53b7c7f1e`;
no runtime sampler or writer was changed to use either proposal.
The unreferenced whole-parent scaffold was removed after this correction.
Prepared-group interfaces should reuse existing preparation shapes rather than retain that abandoned type.

The chosen implementation direction is frozen production-prepared groups:

- Freeze a deterministic bounded parent pool before any pairing calls.
- Use existing configured block-pairing electorate,
  quorum and stage policy without translation-generation calls.
- Account for preparation calls separately.
  Abort the plan on an uncorroborated fallback instead of dropping its parent afterward.
- Consume complete production pairing groups and existing subdivision,
  including insertion,
  unclaimed-target and child-level line-structure semantics.
- Draw forty prepared units deterministically,
  then persist and exit before writing.
- Review those exact units with their surrounding source and target parents.
  Incumbents remain fallible baselines,
  not gold labels.
- Require a distinct reviewed-plan digest before generation.
  Rebuild from the frozen recipe provider-free and refuse any mismatch before provider creation.
- Record corpus,
  build,
  configuration and population identities,
  ballots,
  recipes,
  exact ranges/hashes/node membership,
  line flags and actual serialized prompt sizes.

Independent review supported this direction after examining the new measurements.
It does not add writer rounds or change the writer standing rule.
The old launcher remains blocked.
A fresh budget reading is required before paid preparation and again before writer generation.

## Pairing evidence interface

The production pairing stage returned counts and agreed relations,
but not the final per-seat outcomes needed to replay those relations independently.
`85f331192` adds regressions covering usable replies,
heard but out-of-range replies and missing voices.
`919e517e4` returns the existing `runWindowedRounds` outcomes unchanged on both result paths.
Prompts,
seat selection,
retry policy and the two-voice pair-agreement threshold are unchanged.
Preparation roster quorum remains a distinct condition from pair agreement.

The first green attempt exposed a test assertion mistake:
`toHaveProperty(path, value)` delegates to Chai's non-deep property comparison
in `package/module/test/src/expect-matchers-core.ts`.
The tests now compare `outcome.outcomes` with `toEqual`.
The original red failures were missing-property assertions;
the attempted green failures are not evidence of changed pairing results.
At `06862482e`,
build,
manual type checking,
zero-warning Oxlint and the full unit suite pass.
`writer-pairing-evidence-final-unit-20260911.out` ends with the actual `unit exit 0`.
The successful package formatter takes no appended file arguments;
its attempted file-argument form failed before Oxlint ran.

## Integration seams still to build

`prepareDocumentPairWithRoster`
in `package/module/translation-repair/src/prepare-with-pairing.ts` owns the block-round loop,
media-adjacent target normalization,
footnote-definition separation and pure `prepareDocumentPair` handoff.
A bounded parent-pool consumer needs the same block-round machinery without buying unrelated section rounds.
Prefer extracting that shared operation rather than copying its cold/warm policies into a new sampler.
No such extraction is implemented yet.
The transport-free interpretation helper is now being shared between live pairing and recipe replay;
its latest changes still need verification.

Production also changes the actual writer surface after subdivision.
`settleTranslateSlice` in `package/module/translation-repair/src/translate-slice.ts`:

- Uses `splitTargetOnlyRun` before the whole writing/judging stage.
- Derives absent/present mode from the target chunk variant,
  not its text length.
- Forwards production identity context,
  neighboring context,
  picture context,
  syntax and child-level line-structure governance.
- Returns `stageResult`,
  including slate and ballots,
  beside publication disposition.

The benchmark should consume this existing operation where possible,
not reproduce only a subset of its stage inputs.
Its post-stage guards do not replace input review or add translation-generation rounds.
Picture evidence and footnote relabeling must remain explicit in the preparation plan;
a prepared range alone does not supply unseen image text or reconcile differing footnote labels.
Do not substitute the entire `preparePassEntry` shell without further design:
it also invokes archive prose repair.
Allowing a benchmark peer to rewrite the incumbent during preparation would hide authorship
behind the incumbent producer label and undermine self-vote exclusions.
Preparation here buys correspondence evidence and may apply the existing pure footnote relabel;
it must not buy uncredited benchmark-baseline prose.
Native `producer-calibrate.ts` is still unchanged and unsafe to launch on the old sample.

## Pinned prepared-scope control

The provider-free control on frozen `06862482e` supplies a manually source-reviewed pairing recipe
for the known windward parent,
then invokes actual `prepareDocumentPair` and `validateTranslatedSlice`.
This is an isolated mechanism control,
not automatic acquisition or admission gold.

- Heading source 2069 to 2079 pairs with target 11101 to 11126 and passes the unchanged validator.
- Body source 2081 to 2419 pairs with target 11128 to 12232,
  including all of its incumbent body paragraphs,
  and passes the unchanged validator.
- Every source and target parent node appears exactly once across the prepared outputs.
- The old heading task still rejects the heading-only candidate.
- The independent `lintong#0` heading-only control passes.

The retained incumbent body is only a structural-contract witness,
not a claim of grammatical or factual perfection.
`prepared-scope-control.json` contains the exact outcome and membership arrays.
The bounded container used no network and made no model calls.
Its log is `writer-prepared-scope-control-20260911.out`.

Frozen runtime:
`node_modules/.frozen-dist-06862482e` under the translation package,
digest `sha256-tree-v1:a31c12b618bb4fd76a6f9c00af0ccab720364648a39907b6de62e0f32653c1e7`.
This snapshot adds pairing-seat evidence only;
it does not contain a safe new writer sampler.

## Current artifacts

The old `writer-plan.json` and its exact-forty equality proof are superseded as writer-admission evidence.
They remain valid records that the heap fix preserved old sampler behavior.
The old launcher now explicitly refuses `run` mode until task 38 supplies a verified replacement.
Its container budget probe worked at 2026-09-11 16:28:52 UTC:
all providers wet,
Synthetic weekly 15.19333446212121 percent,
five-hour 2750 of 2750,
Hyper 247 credits,
Bedrock USD 185.38 and OpenRouter USD 267.73.
The next paid launch requires a fresh reading.

Workspace:
`~/temp/agent/v41-writer-20260911.sEDtepyo`.
Full old sample reading:
`~/temp/agent/v41-writer-sample-reading-20260911.out`.
The inspected roster includes V4.1 exactly once;
`--candidates deepseek-v4.1-flash` does not duplicate an already seated identity.
