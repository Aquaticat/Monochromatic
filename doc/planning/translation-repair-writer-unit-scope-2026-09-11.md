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
Whole-parent selection is therefore the implementation candidate for the next verified prototype.
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
