# The third rendering, part 05

Part 05 of [The third rendering](the-third-rendering.md),
whose index lists every part in order.

## The expansion band does not survive a wider population

`#163` proposed guarding the ratio of English characters to Chinese characters,
on a band of 2.09 to 4.24 drawn from the 24 shipped consolidations of the band pair,
and owed a re-measurement on a wider population before it decided anything.

Measured over every paired slice of the pinned corpus as the ARCHIVE carries it,
1259 slices across 92 pairs, at no quota cost.

### What the archive's own ratios look like

Prose slices, 1048 of them:
minimum 0.01, fifth percentile 1.06, first quartile 2.40, median 2.96,
third quartile 3.52, ninety-fifth percentile 5.11, maximum 521.86.

Line-structured slices, 211 of them, are not a separate distribution worth its own band:
median 3.06 against prose's 2.96, and a ninety-fifth percentile of 4.33 against 5.11.
Item 3 of the task asked whether verse needs checking separately.
On this measurement it does not.

### The proposed band would fire on a quarter of the corpus

281 of 1048 prose slices fall outside 2.09 to 4.24, which is 27 percent.
190 sit below the low end and 91 above the high end.
Across everything it is 328 of 1259.

A guard firing on one slice in four is not naming a failure mode.
The band was drawn from 24 observations of a stage that had already selected for a decided slice,
and it does not describe the population it would run over.

### Where the tail actually starts

Sweeping the cutoffs over the same 1259 slices:

-   Below 2.09 flags 223, below 1.5 flags 107, below 1.0 flags 26,
    below 0.8 flags 15, below 0.7 flags 14, below 0.5 flags 6.
-   Above 4.24 flags 105, above 6 flags 44, above 8 flags 30,
    above 10 flags 23, above 15 flags 15, above 20 flags 11.

So a band around 0.8 to 10 flags roughly 38 slices, three percent,
which is a set small enough to read one by one.
The furthest outliers are the ones the task wanted found:
`shihai4h#53` at 521.86, `Zha_Ke#1` at 94.78, three `windward0032` slices between 55 and 85,
and at the other end three `shi_Yumiaoya` slices at 0.01 to 0.02.

WHAT THIS DOES NOT SETTLE. Whether those outliers are mis-sliced or are correctly paired
passages the archive simply left mostly untranslated is a reading, not a ratio,
and the flagged set is now small enough that the reading is affordable.
The action on a breach is still undecided,
and `#71` records what recording a finding and never acting on it costs.

### The shape of the outliers, and a second instrument

Reading the 38 slices a 0.8 to 10 band would flag, by SHAPE rather than by wording:

At the short end the source carries many blocks and the target carries one.
`shi_Yumiaoya#2`, `#3` and `#4` pair 11 to 15 Chinese blocks against a single English HEADING
of twelve to fourteen characters.
At the long end the source carries one block and the target carries several:
`shihai4h#53` pairs a 21-character HTML block against 28 blocks and 10959 characters,
and `windward0032#0`, `#8`, `#10` and `#14` each pair a bare Chinese heading
against an English heading plus its body.

So under nearly every outlier is a block-count disparity, which is unit-free
and does not fire on a passage that is faithful but terse.

Measured over the same 1259 slices, 1104 of them, 88 percent, carry EQUAL block counts.
A gap of more than one flags 43 slices, more than two flags 15, more than three flags 9.

The two instruments are complementary rather than nested.
Of the 38 ratio outliers, 17 also carry a block gap above one, and 21 do not.
Of the 43 block-gap flags, 26 sit inside the ratio band.
Their union is 64 slices, five percent, which is the candidate set worth reading.

CAVEAT, and it matters before anything is built on these numbers:
this is the RAW archive slicing.
`prepareDocumentPair` was called with no `blockPairings`,
so the LLM-assisted pairing stage `#131` shipped has not run over these slices.
That stage exists to reconcile exactly this kind of disparity,
so some of the 64 are already handled in a real pass and the guard would never see them.
The measurement bounds the population from above.

## The settlement that cannot be counted, and the two opposite verdicts it hides

`#165` asked for a count before deciding whether the consolidation should buy a
 second judging the way the translate lane does.
Taking that count found something that outranks it.

`consolidate-settle.ts` assigns `terminal: 'slate-kept-standing'` on a single
 condition,
`decided.origin !== 'fresh'`.
That condition is true in two opposite cases.
It is true when the panel could not agree,
or rejected every candidate,
and the slice keeps its standing text because nobody chose anything.
It is also true when the panel deliberately read the standing text as the best
 rendering on the slate and picked it.
One says the judges failed.
The other says the judges succeeded and the archive won.
The record calls both the same thing.

Where the distinguishing fact lives,
measured rather than assumed:

-   NOT in the artifact.
    A consolidation slice carries exactly these fields,
    read off `Acheron.json` from the run in flight:
    `chunkIndex`,
    `terminal`,
    `shipped`,
    `rewrapped`,
    `demoted`,
    `verdicts`,
    `gate`.
    There is no `decided` field,
    so `decision` and `origin` never reach it.
-   In the cache record,
    which carries `decided` with `origin` and `decision` among its keys.
    That is where it cannot be read for this question,
    because `consolidationWorthResuming` deliberately refuses to persist a
    `slate-kept-standing` settlement carrying one of the two retried declines.
    The mitigation and the measurement want opposite things from one record.
-   In the log,
    but only as free text.
    The decline path logs the judge's own reason and `keeping the incumbent`.
    The enum name is computed one line earlier in `translate-judge.ts`,
    and it is used only in the `TranslateAbsenceError` thrown when the incumbent
    is absent,
    so on the keep path it is never written anywhere that outlives the run.

So the count `#165` asked for is not available from either durable output.
The first action is to make the decision observable,
not to count.

### What the log does show, so far

Run 1 had settled one entry and was working a second when this was read.
Across both,
`translate stage:` appears 14 times:
5 under `consolidateDocument` and 9 under `translateDocument`,
with none unattributed,
which is the check that the filter did not silently drop lines.

Of the 5 consolidation judgings,
4 were fresh wins,
and 1 declined for a winner short of the minimum vote weight.
Acheron contributed 3 judgings and the entry in flight contributed 2.
This is far too small to answer whether a retry is cheap.
It is recorded only so the finished run can be compared against it.

### Options, ranked

-   **Record `decision` and `origin` on the artifact's consolidation slice.**
    Durable,
    measurable across every future run without a log,
    and it separates the two verdicts for every consumer rather than only for
    this count.
    Against it:
    an artifact schema change,
    so `parseSettledArtifactV2` and its refusal tests move with it.
-   **Split the terminal into two names,
    one for a deliberate keep and one for a decline.**
    Makes the distinction impossible to miss,
    adds no field,
    and reads correctly at a glance.
    Against it:
    every consumer switching on the terminal moves with it,
    and it still does not say WHICH decline it was.
-   **Log the enum on the keep path.**
    One line,
    and no schema change.
    Against it:
    it leaves the fact in a log no consumer reads and no run keeps,
    and does nothing about the conflation itself.

Ranking:
the artifact field,
then the terminal split,
then the log line.
The field beats the split because it leaves the terminal vocabulary alone while
 adding the fact that is actually missing,
and because it carries which decline it was rather than only that there was one.
The split beats the log line because it puts the distinction in the durable
 record where consumers read it,
while a log file is deleted with the run.

This is not only a measurement gap.
A consumer deciding what to show a reader cannot currently tell a passage the
 judges endorsed from one they could not rule on,
which puts it in `#166`'s scope as well as `#165`'s.

## What the pairing re-measurement actually costs

`#163` records its remaining item as "re-measure the 64 WITH the pairing
 applied",
and calls it free.
It is not free,
and the number is worth having before anyone schedules it.

`prepareDocumentPair` applies only a pairing it is HANDED.
A pairing exists for an entry only where a real pass has already bought one,
because the stage `#131` shipped is LLM-assisted.
So the re-measurement is free exactly to the extent that the flagged entries
 already have a cached pairing on disk.

Measured,
with the instrument first validated against the recorded numbers:

-   The union is 64 slices,
    spread across 29 entries.
-   Cached pairings exist anywhere under the agent scratch root for 5 entries.
-   Of those 5,
    exactly 1 is among the 29.
-   So 1 of 64 slices is re-measurable at zero quota,
    and 28 entries would need a fresh pairing call.

VALIDATING THE INSTRUMENT FIRST MATTERED.
A fresh reimplementation of the two flags returned a union of 88 rather than 64,
because it used a Han-character denominator where the recorded measurement used
 plain string length,
and because it skipped a slice with no Han characters before the block-gap flag
 could see it,
which silently dropped 5 gap flags.
Re-running the original script reproduced every recorded number exactly:
1259 slices,
1104 with equal block counts,
43 flagged by a block gap above one,
38 ratio outliers,
17 in both.
A number that does not reproduce is an instrument fault until proven otherwise.

### How to run it, and when

No source change is needed.
`prepareDocumentPairWithRoster` is exported from the built
 `dist/final/node/index.mjs`,
so a scratch script can pair the 28 entries and re-measure without touching the
 package.

It must NOT run while a corpus pass is alive.
A pairing sweep buys provider concurrency of its own,
and `doc/troubleshooting/synthetic-aggregate-concurrency-stall.md` measured
 every backend degrading above roughly seven aggregate streams.
The sweep is therefore queued behind the `#138` verification,
not blocked by it.

## What the settled-artifact consumers actually read

`#166` asked whether a graded sheet drawn from an accepted repair-lane issue
 describes text a later stage replaced,
which would make the precision number describe a draft rather than a publication.
The answer is no,
for a reason nobody had checked:
those consumers cannot read a current artifact at all.

### The schema split as measured

Every artifact the current pipeline has written carries `artifactSchemaVersion: 2`.
Across every run directory under the agent scratch root,
every settled artifact is version 2 and none carries a top-level `issues` array;
the count was 24 when measured and 25 once `Zha_Ke` settled.

`artifact-probe-read.ts` reads `artifact.issues`,
and filters each record on `record.repairDisposition === SHIPPED_DISPOSITION`.
`artifact-repair-read.ts` and `repair-sheet.ts` key on the same field,
which `repair-record.ts` defines as the string `shipped`.
THE PATH MOVED,
and an earlier revision of this section said the fields were gone.
They are not.
Version 2 carries both at `lanes.repair.result.issues[]`,
measured across 28 version 2 artifacts:
0 carry a top-level `issues` array,
27 carry the nested one,
holding 871 records whose `repairDisposition` reads `shipped` 432 times,
`no-region` 427 and `not-selected` 12.

So the readers find nothing because they look at `artifact.issues`,
which version 2 does not have,
and not because the data stopped being written.
That makes the port a re-pointing rather than a reconstruction,
which is much cheaper than this section first recorded.

Version 1 artifacts do carry both fields,
which is the positive control this claim needs:
an uncapped sweep of every artifact directory under the agent scratch root found
 164 distinct version 1 artifacts carrying `issues` arrays,
the largest with 405 records.
The raw file count is 492,
because three identical worktree-copy payloads hold the same run.
The reader was never broken.
The artifact moved out from under it.

### Why the word was accurate when it was written

`repairDisposition: 'shipped'` is documented as the disposition of a repair
 that the returned document carries,
and `repair-record.ts:351` is its only writer.
In the version 1 pipeline that claim was exactly true,
because the repair lane's returned document was the publication:
no stage ran after it.

Two stages run after it now.
The lane contest chooses between the repair lane,
 the translate lane and the incumbent,
and the consolidation can replace whatever the contest settled on.
A field written before either runs cannot describe what either decided.

### What the naive port would cost

The version 2 analogue of that field is `lanes.repair.delivery[].delivery.kind`,
and mapping one onto the other is the obvious port.
It would be wrong at every row this repository can measure.

On the artifacts carrying both a lane contest and a consolidation,
6 rows claim `replacement-shipped`,
and the text of 0 of them reached the page.
The contest alone had already chosen another lane at 5 of the 6,
and the consolidation then overrode 4 rows including the one the contest had kept.
That population is 2 artifacts,
so it establishes the mechanism and its direction rather than a rate.
The corroborating figure is the consolidation override rate recorded for the band pair,
8 of 10 decided slices in run 8 and 7 of 8 in run 9.

### The failure mode this leaves today

A reader that finds no records does not mislead;
it returns nothing.
The danger is that nothing is indistinguishable from a clean result:
an introduced-defect probe reporting no damage over zero shipped records
 reads exactly like one reporting no damage over every shipped record.

`artifact-probe-read.ts` anticipated this and already carries the discriminator,
`shippedRecords`,
documented so a run whose probe never fired is distinguishable from one that had
 nothing to ship.
`probe-telemetry-report.ts:120` prints it and `score-probe.ts:180` sums it,
so the zero is reported rather than hidden.
What no reader does is treat that zero as a refusal,
which is what the port must add.

### Decided that every consumer names the question it asks

Two different questions are worth answering,
and the split is what `#166` exists to fix.

The lane-scoped question is whether a lane's own output carried a given repair.
It stays.
Roster decisions rest on lane attribution,
and a consumer that could only see the page could no longer tell which voice
 earned a result.

The shipped-scoped question is whether the text reached the page.
It is added beside the lane-scoped one rather than replacing it.

Neither is a default.
Every consumer names the question it asks in its own identifier rather than in a
 comment,
because the defect being repaired here is a name that asserted more than the
 value meant.

### Decided that the shipped text is derived once

A single reader answers the shipped-scoped question for one slice,
and every consumer calls it rather than walking the artifact itself.

It cannot simply read `shipped.text`.
Measured on the settled artifacts,
`shipped` carries a `text` key only where the terminal is `consolidated`.
Where the terminal is `slate-kept-standing` or `no-standing-text`,
`shipped` carries a bare `kind` of `unchanged` and no text at all.

So the reader walks the deciders in the order they ran:
a `consolidated` terminal yields `shipped.text`;
any other terminal yields the standing text,
which is whatever the lane contest settled on;
an artifact with no consolidation yields the contest result directly;
and an entry with no contest yields the incumbent.

### Still owed

The port itself is queued behind the source freeze,
with `#167` and `#168`.
It carries three parts:
the shipped-text reader,
the renaming of every consumer that currently implies a page-level claim,
and the zero-denominator refusal.

`#66` recorded that the probe named neither damage that shipped.
That answer was reached on version 1 artifacts,
where the reader could see records,
so it is not void.
It is also not evidence about anything the two-lane pipeline has produced,
and it should not be cited as if it were.

## Sizing the audit error

`#166` item 1 called `rendering-audit-settled-input.ts` wrong as it stands
 without sizing it.
Sized now,
against `laneSelection.slices[].verdict` on every artifact whose contest settled.

The audit derives every subject from `lanes.translate.delivery` alone.
Of 6 contest slices across 2 artifacts,
5 are subjects whose translate-lane text is not what shipped:
1 where the repair lane won the contest,
1 that settled neither,
and 3 where the translate lane won and the consolidation then replaced it.
`Acheron` is wrong at 3 of 4 slices and `Weideriche_` at 2 of 2.

The audit therefore describes shipped text at 1 of 6 slices.
The population is 2 artifacts,
so this is mechanism and direction rather than a rate,
and it is the whole population that exists.

### Two fields named verdict

Sizing that error produced a wrong number first,
which is worth recording because the mechanism will catch the next reader too.

A settled artifact carries two fields spelled `verdict` at sibling paths.
`comparison[].verdict` is `SliceLaneVerdict` from `lane-comparison.ts:39`,
a string union naming which lanes changed the slice.
`laneSelection.slices[].verdict` is `ArtifactContestVerdictV2` from
 `corpus-run/artifact-v2-contest.ts:29`,
an object discriminated on `kind` naming who won.
Only the contest field answers a question about shipping.

Reading `row.verdict.kind` against the string form yields `undefined` on every
 row,
which is not an error and not an obviously wrong answer.
The first probe written to size the audit error did exactly that,
and reported 142 of 142 slices wrong.
The correct read gives 5 of 6.

It was caught by a positive control rather than by review:
the probe printed the distribution of the field it was reading,
and every one of 142 rows fell in a single bucket.
That is now the standing rule for artifact probes here.
A probe prints the distribution of what it reads before its headline number is
 trusted,
because two probes in one session returned a false total from a wrong field path
 and neither threw.

Filed as `#170`,
queued behind the source freeze.

## What `slate-kept-standing` actually merges

`#165` said the terminal merges a decline with a deliberate keep.
Read at the branch that assigns it,
it merges three states,
and the sole-candidate case is the one that most distorts a count.

### The condition and what reaches it

`consolidate-settle.ts:379` assigns the terminal on one test,
`decided.origin !== 'fresh'`,
under a comment reading that the judges choosing the incumbent ends it.
That comment describes one of the three cases the condition admits.

Judges heard a slate and chose the archive.
`decision` is `judged` and `origin` is `incumbent`.
This is a real endorsement of the standing wording,
and the only case the comment describes.

The slate carried nothing but the incumbent.
`decision` is `sole-candidate`,
`judgesAvailable` is 0 and `ballots` is 0.
No judge spoke,
so nothing was endorsed.
The capture holds this case live on `Zha_Ke`.

Judges heard a slate and refused it.
`decision` is `declined-indecision` or `declined-rejection`,
which `translate-judge.ts:439` assigns when the panel could not agree or rejected
 what it saw.
`Acheron` slice 0 took this path,
its winner short of the minimum vote weight.

### Why the count cannot be taken

A tally of `slate-kept-standing` adds an endorsement of the archive to a slice
 where no judge spoke and a slice where the judges refused to speak.
Those answer opposite questions about roster quality.
A roster that endorses the archive is working;
a roster that cannot agree is not;
a slate with one candidate measures the producing stage rather than the judges.

`translate-judge.ts:442` already carries the reasoning,
in a comment saying a decline is not a keep where there is nothing to keep.
The judge separates them.
The settlement collapses them one call later.

### The ranking changes

`#165` previously ranked an artifact field over a terminal split.
Reading the surrounding code reverses that.

`consolidate-settle.ts:424` already splits the gate side of the same question
 into three named terminals,
`consolidated`,
`wrap-erased-difference` and `gate-kept-standing`,
under a comment saying they are kept apart because they answer different
 questions about the roster.
Splitting the slate side the same way is the design this file already states,
not a new mechanism.
An artifact field would record the discriminator beside a terminal that still
 reports one state for three.

The split is three terminals in place of one,
distinguished by the `decision` the judge already produced.
`slate-kept-standing` stays for the endorsement,
so the name keeps meaning what it says.
Nothing forbids the new spellings:
`forbidden-strings.append.local.txt` carries no entry for `slate`,
`declined` or `sole`.

Cost counted rather than guessed:
`slate-kept-standing` occurs in 7 files,
4 under `src` and 3 tests,
and the artifact schema and its version 2 reader move with it.

Queued behind the source freeze.

## The order the frozen queue lands in

Five tasks are queued behind the source freeze,
and three of them change the same artifact contract.
Landing them one at a time would migrate the schema three times,
and would write `#166`'s shipped-text reader against a terminal vocabulary
 `#165` is about to change.

The order,
decided rather than left to whichever is picked up first.

One coordinated schema change lands first,
bundling `#165` and `#170` and any field rename `#166`'s port needs.
`#165` splits `slate-kept-standing` into three terminals.
`#170` renames `comparison[].verdict`,
which collides with the contest field of the same name.
Both touch the version 2 reader and its guards,
so they share one migration and one set of absence rules for older artifacts.

`#166`'s port lands second,
against the vocabulary that change leaves behind.
It carries the shipped-text-per-slice reader,
the renaming of every consumer implying a page-level claim,
and the zero-denominator refusal.
Writing it first would bind it to terminals that no longer exist.

`#167` and `#168` are independent of all of that and land in any order.
`#167` bounds the semantic wrap away from line-structured slices.
`#168` lowers the transport ceiling to 7 MiB.
Neither reads the artifact contract.

Nothing here starts before run 2 finishes,
which is `#138`'s deliverable and the only thing that lifts the freeze.

## The `pairIndex` rename is not the comparability change it was deferred as

`#98` left `AlignmentFinding.pairIndex` documented rather than renamed,
and `chunk-document.ts:89` records the reason:
the scorecard renders it into a finding string that 56 settled artifacts share,
so renaming it would be a comparability change.

Both halves of that are wrong,
and the real hazard is a third thing neither names.

### No scorecard renders it

The render is `document-preparation.ts:206`,
into `prepared.alignmentFindings`,
which `document-preparation.ts:109` declares as `readonly string[]`.
Neither `scorecard.ts` nor `repair-scorecard.ts` mentions `pairIndex`.

### Renaming the field cannot change any string

The template writes the literal word `pair` and interpolates the value:

```ts
// package/module/translation-repair/src/document-preparation.ts
return `alignment ${finding.kind} (pair ${String(finding.pairIndex,)}: ${finding.detail})`;
```

`alignment structure-mismatch (pair 0: ...)` is byte-identical whatever the
 TypeScript field is called.
The field name never reaches an artifact.
So the rename is a rename,
and it is free.

### What is actually a comparability change is the word `pair`

Two producers write that word over two different numbering spaces.

`chunk-document.ts:385` sets `pairIndex` to `step.sourceIndex` or
 `step.targetIndex` for a refusal,
which is an index on the refused chunk's own side.
`chunk-document.ts:290` sets it to zero for a whole-document observation.
Both render as `structure-mismatch (pair N: ...)`.

`document-preparation.ts:300` renders `target-unclaimed (pair N: ...)` from the
 loop at `document-preparation.ts:242`,
where N is a real pair index.

So a reader meeting `(pair 0: ...)` cannot tell which numbering space the zero
 lives in,
and the two families are told apart only by the kind word beside it.
Changing that word is what the settled artifacts would notice.

### How many artifacts carry one

5 of 56 version 1 artifacts in the settled payload carry an alignment string,
which reproduces the count `#71` recorded.
The heads are `structure-mismatch (pair 0` five times,
`sections-merged (pair 0` three times and `sections-merged (pair 1` once.
1 of 25 version 2 artifacts carries one,
`target-unclaimed (pair 0`.

A first probe reported 0 of 164 for the version 1 side,
because it looked for a key whose name mentions alignment and these are prose
 strings inside a findings array.
No key in any of the 56 mentions alignment at all.

### What this changes

The rename leaves `#98` and joins `#170`,
which is the same defect class:
one name over two meanings,
caught only when a reader takes the wrong one.
The field rename is free and needs no migration.
The rendered word is the part that costs comparability,
and it is worth paying,
because a refusal reporting a side index as a pair index is the reading that
 sends someone to the wrong section.

Queued behind the source freeze.

## Correcting the consumer inventory

Two claims recorded against `#166` are wrong,
and both were mine.

### The six files exist

The correction filed on `#166` said `draw-entry-load.ts`,
`score-probe.ts`,
`probe-telemetry-report.ts`,
`probe-relabel-*.ts`,
`score-attribution.ts` and `score-crosscheck.ts` do not exist.
All of them do,
in `package/module/translation-repair/src/corpus-run/`.

The listing that produced the claim ran without recursion in the top-level
 `src`,
so it saw only the files beside `index.ts`.
The same mistake produced the empty grep it was meant to correct:
the first grep named the right files and searched the wrong directory,
and the correction then declared them absent for the same reason.
A file list is a search result,
and it fails the way `QRY` describes.

### The discriminator is read

That section also said nothing reads `shippedRecords`.
`probe-telemetry-report.ts:120` prints it in the `PROBE` line beside the entry
 count,
and `score-probe.ts:180` sums it across entries.
A run whose probe saw no shipped records already reports a zero rather than
 hiding one.
What no reader does is treat that zero as a refusal.

### What survives once the real files are read

The family reaches artifacts through `artifact-probe-read.ts`,
which reads `artifact.issues` and filters on `repairDisposition`.
`probe-relabel.ts` and `probe-relabel-artifact.ts` read `.issues` directly.
No version 2 artifact carries either field,
so the conclusion stands:
on a current artifact this family sees no records.

None of the ten files mentions `consolidat`,
`laneSelection` or `contest`,
so none of them accounts for either decider.

### The port has a pattern to follow rather than invent

`score-probe.ts:147` already carries the idea the port needs.
It collects `refinedIssueIds` for issues whose slice the naturalness lane
 rewrote after the probe ran,
commenting that the probe's verdict is about wording that did not ship.

That is the right concept applied one stage too early.
It watches a rewrite inside the repair lane and stops at the lane boundary,
while the contest and the consolidation can each replace the same text
 afterwards.
The shipped-scoped reader extends that set rather than introducing a new one.

## The freeze is lifted and `#171` is fixed

Written 2026-08-22.
This section supersedes every "queued behind the source freeze" line above it.
Nothing in this document is blocked on a freeze any more.
Where an ordering is still stated,
it is a design dependency and says so.

### What the freeze was for

Run 2 of the band pair executed the built `dist/`,
so rebuilding while it ran would have overwritten the code under a live pass.
That run finished on 2026-08-22,
and the freeze ended with it.

### What `#171` turned out to be

The naturalness lane ran after the accuracy pass had already persisted every
 slice,
and read no cache of its own,
so a resumed run replayed accuracy from disk and then bought the whole rewrite
 again.
Measured across the band pair,
that published different text at 7 of 18 repair-lane slices on identical
 inputs.

The fix gives the lane its own `refine.` namespace,
keyed on the slice and on the definitions of the whole assembled document,
because those are collected across every slice and a neighbour settling
 differently changes what this rewriter is shown.
Landed as `fda817aaf` with tests in `0f781c687`.

### Why the alternative was refuted rather than out-ranked

Folding refinement into the existing slice record would require a resumed slice
 to SKIP the lane,
and the only marker available to skip on is `refined`.
That flag is set on exactly one path,
where a rewrite both changed the text and kept every confirmed issue,
so it reads false both where refinement declined and where refinement never
 ran.
Skipping on it would still rebuy the lane at precisely the slices that flipped
 between the two runs,
which is where the divergence came from.

This is worth recording as a shape rather than as one task's detail.
A flag that records an OUTCOME cannot stand in for a record that a QUESTION was
 asked,
because the outcome collapses "asked and declined" into "never asked".

### What the order is now, and why

The order is unchanged,
but it rests on design dependencies rather than on a freeze.

    1.  `#170` and `#165` together, as one coordinated schema change.
        `#165` splits `slate-kept-standing`,
        which changes the terminal vocabulary,
        and `#170` renames three names that each carry two meanings.
        Doing them separately means changing the same schema twice.
    2.  `#166`, the shipped-text reader and the consumer renaming.
        It depends on the terminal vocabulary `#165` settles,
        so writing it first would bind it to names about to change.
    3.  `#167` and `#168`,
        which touch neither the schema nor the reader.

### What still stands between here and a reproducible pipeline

The fix is proved by unit tests and shown to fail without its resume,
but it has not been exercised through the CLI over a corpus entry.
That verification is `#172`,
and it runs first,
because every item above it is queued behind a pipeline whose reproducibility
 is claimed rather than measured.
