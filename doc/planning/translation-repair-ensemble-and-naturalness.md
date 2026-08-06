# Ensemble editing and the naturalness refinement lane

Proposal, not a ratified decision.
Written after the round-two gate failed at 0.740 to 0.800 against a 0.9 bar.

## Why these two are one design

They look like separate asks and share a mechanism.

The editor is the only stage where a single model decides alone.
Critics, panel, and checkers are all ensembles;
`RepairModels.editorModelId` is one `SyntheticModelId`,
and `runEditorStage` passes `modelIds: [editorModelId,]` to `gatherStageVoices`.
User directive:
no single model should control any part of the pipeline.

The naturalness lane needs candidate generation with independent judging,
because a rewrite has no defect to anchor to and the generator must not approve its own work.

Both therefore need:
propose N candidates, judge them independently of whoever produced them, select one or fall back.
Build that once.

## What the round-two grading actually asks for

Precision cannot see repair quality.
Four of the 37 true positives carry notes saying detection was right and the repair was poor:
"the claim doesn't make sense for English grammar. If there is a better way, that should be proposed.",
"but is there a better way?" twice,
and "I suspect this one is hard to fix".
Those score as successes today.

So the editor is a measured weak point,
and spending the strongest model plus an ensemble there is aimed at the right target.

## Shape

Three immutable versions, each with its own provenance:

```text
T0  original translation
T1  accepted issue repairs        diff(T0,T1) confined to accepted issue envelopes
T2  naturalness refinement        diff(T1,T2) confined to one recorded paragraph
```

Every change in the shipped text traces to exactly one of:
an accepted issue repair, or an accepted paragraph refinement with recorded gate results.

Paragraph containment is provable deterministically.
Semantic preservation is not provable by an LLM panel,
so it is an acceptance policy, never called a proof.

## Selection component, shared

Inputs:
a set of candidates, each tagged with the model that produced it;
the evidence the judges need;
a fallback.

Rules:
a model never judges its own candidate;
judges vote through the existing `gatherStageVoices` quorum machinery;
a tie or a failed quorum returns the fallback unchanged.

For the editor the fallback is the unedited chunk.
For the refinement lane the fallback is that paragraph's exact `T1` text.

This means a stage can always decline.
Declining is the conservative outcome and must never read as failure.

## Editor ensemble

`editorModelId: SyntheticModelId` becomes `editorModelIds: readonly SyntheticModelId[]`.
Each editor sees the identical sheet and proposes operations.
Judges score candidate patched chunks on:
did it apply the accepted issues,
is it faithful to the source,
is the English grammatical and natural.

Open question, needs a decision before building:
judge per envelope or per chunk.
Per envelope is finer and lets the best fix of each issue win independently,
but a chunk assembled from several models' operations is a text no model wrote or checked as a whole.
Per chunk keeps coherence and wastes good individual fixes.
Recommendation:
per chunk first, because coherence is the thing the naturalness work exists to protect,
and revisit only with evidence that per-envelope wins.

## Naturalness lane

Runs AFTER the accuracy repair, never in parallel, and only on `T1`.
Per paragraph, a rewriter may return an improved candidate or decline.

Gates, all of which must pass:

-    structural invariants:
     Markdown structure, links, URLs, footnote markers, block type, names, handles, numbers, dates,
     and foreign-language phrases survive unchanged
-    three-way semantic check against source, `T1`, and candidate:
     propositions, negation, modality, chronology, and emotional stance preserved
-    content ledger:
     built before rewriting, and especially load-bearing for repaired omissions,
     where fluency rewriting silently compresses inserted clauses
-    independent judging, excluding the generator
-    final regression check on the text that will actually ship

Poetry, quotations, tables, and code are routed away or abstained on,
which is also the fix for round-two false positive 26.

## Contract breakages this creates, all of which must be handled

-    `RepairIssueRecord.resolved` promises checkers confirmed the fix in the shipped text.
     False if checking happens before refinement.
     Recheck against the shipped text.
-    `changedOutcomes` and `anyChanged` in `repair-translation.ts` miss refinement-only changes
     if the lane is bolted on after they are computed.
-    `SliceCache` entries predate the lane, so a cached slice would bypass it.
     The cache key or schema must be versioned.
-    The `blocked-non-translation` path must keep returning the original untouched.
-    A refinement-only change has no representation in `issues` and needs its own record type.

## Measurement

Keep defect precision as it is, with refinements excluded, and publish a separate scorecard:
refinement precision,
naturalness win/tie/loss against `T1` by blinded pairwise comparison,
semantic regression rate,
issue-retention rate,
refinement yield,
and repair acceptability.

Excluding refinements from defect precision must not leave them unmeasured.

Use the round-two graded items as regression fixtures:
the poetry, `总是`, and conjunction false positives are hard negatives for detection,
and the four "is there a better way?" items are repair-quality fixtures.

## Attribution warning

Round three changes the roster, the editor, the checker set, the quorum rule,
the adjudication policy, and adds this lane.
The user accepted that bundle explicitly.
A precision delta will therefore not be attributable to any single change,
and the round-three verdict must say so rather than implying otherwise.
