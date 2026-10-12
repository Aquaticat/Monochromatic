# Audit ledger, part 07

Part 07 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Test suite, continued

### T8: code no unit test runs, continued

How the rows closed,
by commit:
`21d3654d5` moved the plural word chosen inline into one `wordForCount` (`count-word.ts`),
with both arms cased there
(`eligible` 214,
222 and 230,
`pool-refusal` 201 and 202);
searching library source for that inline choice found it in eleven modules,
all moved,
with no output meant to change.
`8860dc52c`,
following B64,
reads the entry id back through `entryIdOfArtifact`,
and `assertArtifactProvenance`'s arm for a name without the suffix went with it,
since its callers now pass the `ArtifactFileName` type
(`provenance` 266-267).
`06fe7faae` replaced the fallbacks no input reaches with code that has no such branch,
or with `nonNullishOrThrow` where the invariant is the whole argument:
`eligible` 168 and 505 (every admitted entry is placed;
each generation is paired with its count once),
`generation` 413 and 415 (nano-spawn's own `SubprocessError` and its typed `exitCode`),
`pool-refusal` 319,
`provenance` 103 and 309 (the pool records tip and digest together,
so `assertArtifactProvenance` takes one `expected` record or none,
and the test for a tip checked alone went with the state it described),
`rebuild-rows` 101-102 and 116 (rows and slices read as pairs)
and `verify` 135-137.
`99eed862e` cased the reachable ones:
`eligible` 520-521 (a generation the required commit excludes),
`generation` 211-212 (a file named `.json` alone),
`placement` 88,
92 and 94 (an id recorded as null,
an array,
an object),
`project` 80-82 and 90-91 (a member that is not an object,
one with no kind)
and `rebuild-rows` 46,
50 and 89,
through the first direct test of `carveDivergence`,
which now takes the rows and slices it reads rather than the whole artifact and preparation.
The batch's control copy,
the artifact-placement test with the null-id case expecting `(absent)`,
failed on that case and its describe alone and was deleted.

The thirteenth batch's baseline is that census
(`99eed862e`,
`census-aoSuO0`):
library source holds 848 stretches over 1,747 lines in 308 files,
with 19 functions never called.
By the first construct
(`t8-triage-aosuo0.txt`),
the queue is 339 returns,
167 nullish fallbacks,
146 ternaries,
97 throws
and 99 others.
Two clusters tie at 21 stretches:
`lane` (7 files,
59 lines)
and `corpus-run/insertion` (7 files,
50 lines).
The tie goes to the most cold lines,
so the thirteenth batch takes `lane`.

B65 was fixed before the thirteenth batch began
(`e987110a1` to `6583c32c4`),
so the batch reads against a census taken after it:
the whole suite at `6583c32c4`
(`census-EiesJ9`,
1,464 passes,
taken clean)
reads against `census-aoSuO0`:
ran 0,
still cold 1,194,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 6.
Per-file counts compared between the two census files differ in one library source,
`slice-cache-store.ts`,
from 1 stretch to none
(the ENOTDIR catch B65 removed),
so library source holds 847 stretches over 1,745 lines in 307 files,
with 19 functions never called;
the unmapped `wording-key` chunk is renamed again,
6 stretches under each name.
By the first construct
(`t8-triage-eiesj9.txt`),
the queue is 339 returns,
167 nullish fallbacks,
146 ternaries,
96 throws
and 99 others,
and `lane` still ties `corpus-run/insertion` at 21 stretches with the most cold lines (59 against 50),
so the thirteenth batch takes `lane` against `census-EiesJ9`.

The thirteenth batch took the lane modules against `census-EiesJ9`
in four code commits,
`da74173a1` to `de9ced3f0`,
and one entry of its own,
B66.
Its census at `de9ced3f0`
(`census-lPGpK8`,
1,465 passes,
taken clean)
reads against `census-EiesJ9`:
ran 4,
still cold 1,180,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 5.
The 4 that ran are the two cluster sources the batch never edited,
`lane-contest-eligibility.ts` (3) and `lane-contest-key.ts` (1).
The 5 edited sources are the rest of the cluster,
and each "loaded it and left 0 cold stretches".
Library source went from 847 stretches over 1,745 lines in 307 files to 826 over 1,686 in 300:
the cluster's 21
(`lane-contest-driver.ts` and `lane-slice-sets.ts` 4 each,
`lane-contest-eligibility.ts`,
`lane-contest-stage.ts`,
`lane-slice-coverage-error.ts` and `lane-slice-text.ts` 3 each,
`lane-contest-key.ts` 1),
all seven files now at none,
and per-file counts compared between the two census files change in no other file.
Entry files keep 30 stretches over 754 lines,
and other packages' sources are unchanged at 61 files and 324 stretches.
The 6 not loaded are the unmapped `wording-key` chunk,
renamed again (`wording-key-W_GpcIy_.mjs`),
6 stretches under each name.
The bundles no test loaded are still 36,
carrying 38 sources over 13,322 lines,
as in `census-EiesJ9`.

How the rows closed,
by commit:
`da74173a1` and `65deb5167` (B66) cased the driver's rows for the claims and the note the judges are shown
(`driver` 426-429,
435-436 and 446-447)
and the repeat faults
(`slice-text` 334-340 and 342-348,
`coverage-error` 249 and 251).
`67225cfb4` replaced the fallbacks no input reaches with code that has no such branch:
`driver` 388-390 (`nonNullishOrThrow`:
`projectLanes` is the only producer of `ProjectedLanes`,
and its `compareLanes` builds the comparison from the repair ledger row by row),
`stage` 270 and 313 (a `SeatedBallot` type for the ballots the stage builds,
each from one seat's reply),
`slice-text` 220-225 with `coverage-error` 245 (a decision carries its wording as a string,
so the `typeof` check and its fault kind went)
and `slice-sets` 265,
286,
291 and 314 (each list paired with its indices once,
rather than looked up by position).
`de9ced3f0` cased the reachable ones:
`key` 296-300 (a dispute note keys apart from none,
and from another note),
`eligibility` 182 (a ballot choosing neither lane under eligibility),
367-371 (an original no grammar reads)
and 469-470 (front matter with no fence),
and `stage` 463-468 (a short bench).
By reading `settleVotes`,
which counts only the two lanes' votes,
keeping or dropping a neither ballot at `eligibility` 182 cannot change the choice,
so that case drives the line and cannot tell the two apart.
The same commit rebuilt the driver test's `metadataProjection` from whole rows,
where it had been cast from a partial shape against B63's rule,
and gave `catProjection` its TSDoc back from above `metadataProjection`'s.
The batch's control copy,
the contest key test with the dispute case expecting the same key as no note,
failed on that case alone and was deleted.

The fourteenth batch's baseline is that census
(`de9ced3f0`,
`census-lPGpK8`):
library source holds 826 stretches over 1,686 lines in 300 files,
with 19 functions never called.
By the first construct
(`t8-triage-lpgpk8.txt`),
the queue is 333 returns,
162 nullish fallbacks,
141 ternaries,
92 throws
and 98 others.
`corpus-run/insertion` leads alone
(21 stretches,
7 files,
50 lines,
ahead of `prompt` at 20),
so the fourteenth batch takes it.

The fourteenth batch took the insertion modules of `corpus-run` against `census-lPGpK8`
in four code commits,
`1af921d31` to `bc15e9a28`,
and one entry of its own,
B67.
Its census at `bc15e9a28`
(`census-o4RZ7w`,
1,466 passes,
taken clean)
reads against `census-lPGpK8`:
ran 0,
still cold 1,155,
cold since then 5,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 8.
The 8 edited sources are the seven cluster files,
each "loaded it and left 0 cold stretches",
and `mask-container-tags.ts` (B67),
which "left 4 cold stretches",
the 4 it had.
The 5 cold since then are `module-or-throw` code the batch brought in
(`nonemptyOrThrow` 1,
`getSize` in `size.ts` 4),
not loaded before,
so other packages' sources go from 61 files and 324 stretches to 63 and 329.
Library source went from 826 stretches over 1,686 lines in 300 files to 805 over 1,636 in 293,
with 17 functions never called where 19 were
(the two sort comparators the cases now call):
the cluster's 21
(`insertion-carried-shift.ts` 6,
`insertion-carried-decide.ts` 4,
`insertion-container-deficit.ts` 3,
`insertion-carried-anchor.ts`,
`insertion-carried-fold.ts`,
`insertion-container-halves.ts` and `insertion-referenced-definitions.ts` 2 each),
all seven files now at none,
and per-file counts compared between the two census files change in no other library file.
Entry files keep 30 stretches over 754 lines.
The 6 not loaded are the unmapped `wording-key` chunk,
renamed again (`wording-key-C7_uuYqL.mjs`).
The bundles no test loaded are still 36,
carrying 38 sources over 13,322 lines.

How the rows closed,
by commit:
`1af921d31` and `ad58185f7` (B67) cut a container half at the lone tag's own offset,
and the arm for a tag the text search could not find went with the search (`deficit` 184).
`0bae4490f` replaced the fallbacks no input reaches with code that has no such branch,
or with a narrowing that throws where the invariant is the argument.
In the carried fold,
positions were looked up again after the lookup that found them:
`pairedNeighbourToward` now returns each neighbour with its slice narrowed to a paired one,
the fold decision carries the carrier,
the receiver and the carried slice,
and `shiftSlices` takes them
(`decide` 215-218,
`fold` 153,
`shift` 80,
130 and 272-273);
the carried slice is read once with `nonNullishOrThrow`,
and the check that it is the recorded insertion went,
since the rows are built from the insertion slices at those positions
and a fold rewrites only a carrier's source (`decide` 226-229);
a carried passage always names evidence,
since `judgeCoverage` calls one carried only on a majority of full votes,
whose matched regions are the evidence (`decide` 146-149,
`nonemptyOrThrow`);
a typed `find` and `filter` read the placed regions' holders (`decide` 177);
and `abutting` takes the two chunks in either order,
reading the gap from the smaller end to the larger start,
so neither caller orders them by position and overlapping spans count as abutting
(`anchor` 237,
`shift` 139-144).
Outside the fold:
`halves` 117-118 and `definitions` 143 read the slice at an admitted position with `nonNullishOrThrow`,
and `definitions` 224 reads the referrer in the predicate that finds the label.
`bc15e9a28` cased the reachable ones:
`anchor` 198-201 (evidence in an archive paragraph no paired span holds),
`fold` 303 (the chained shape listed bath first,
both folding on the first pass,
the order the case's name already claimed),
`shift` 121 (a new mirrored shape where the carrier follows the passage)
and 124 (no paired slice on the carrier's far side),
`deficit` 172 (an archive half not writing the tag)
and 434-439 (two absent rows out of document order),
and `halves` 99-104 (admitted positions out of order),
through the halves admission's first direct test.
The batch's control copy,
the halves test with the finding naming the later admitted slice,
failed at that assertion alone and was deleted.

Reading the deficit also found B68:
it counts a container's blocks by blank-line split,
where the rule its prevention section states asks the parse.
B68 comes before the fifteenth batch,
whose baseline is the census taken after its fix.

B68 was fixed before the fifteenth batch began
(`8ec62ce62` and `19eb118ab`),
so the batch reads against the whole suite at `19eb118ab`
(`census-VmhQQH`,
1,467 passes,
taken clean),
which leaves library source at 805 stretches over 1,636 lines in 293 files,
with 17 functions never called,
as `census-o4RZ7w` did.
By the first construct
(`t8-triage-vmhqqh.txt`),
the queue is 321 returns,
162 nullish fallbacks,
134 ternaries,
92 throws
and 96 others.
`prompt` leads alone
(20 stretches,
2 files,
43 lines,
ahead of `pair` at 19),
so the fifteenth batch takes it.

The fifteenth batch took the prompt modules against `census-VmhQQH`
in five code commits,
`2d3b02c45` to `f7838ffb3`,
and one entry of its own,
B69.
Its census at `f7838ffb3`
(`census-OGAQiJ`,
1,468 passes,
taken clean)
reads against `census-VmhQQH`:
ran 0,
still cold 1,144,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 2.
The 2 edited sources are the cluster's two files,
each "loaded it and left 0 cold stretches".
Library source went from 805 stretches over 1,636 lines in 293 files to 785 over 1,593 in 291,
with 17 functions never called as before:
the cluster's 20
(`prompt-payload-store.ts` 16,
`prompt-uniqueness-client.ts` 4),
both files now at none,
and per-file counts compared between the two census files change in no other library file.
Other packages keep 63 files and 329 stretches,
and entry files 30 stretches over 754 lines.
The 6 not loaded are the baseline's unmapped `wording-key` chunk (`wording-key-C7_uuYqL.mjs`).
The bundles no test loaded are still 36,
carrying 38 sources over 13,322 lines.

How the rows closed,
by commit.
Which arm of a one-line stretch was cold is inferred from the stretch's width and the tests that existed,
since the census's bundle is not kept;
the batch's census is what shows each closed.
`2d3b02c45` and `a56cde819` (B69) gave each of the store's refusals a reason
and cased every one:
the read that fails on something other than absence (`store` 123-129,
with the cause arm of 66),
each field of the stored reply (177 to 199,
212,
221 and 223),
the envelope and the format version (277 and 279),
text that is not JSON (287-293,
now a narrow `try` of its own)
and a write the filesystem refuses (316-323).
The arm after the read for a symbol other than the absence sentinel went,
since `readPayloadText` returns no other (`store` 268-270).
`2d6237b3e` typed the prompt digest's input:
`canonicalPromptValue` is only handed the model id and the messages,
whose content is a string or a list of parts that are records of strings,
so its arms for null,
numbers,
booleans and anything else went (`client` 44,
48,
50 and 71-73).
Its keys now sort by UTF-16 code unit rather than `localeCompare`,
which follows the host's locale;
a scratch copy of both serializers over six requests
(text and vision content,
keys written in both orders)
printed "samples 6,
differing 0",
and its control showed the two orders disagree on `a` and `B`,
so digests the payload store already holds still name their records.
`d811fcf2b` gave the batch's new TSDoc blocks the blank-line form their files use,
which the edit tool had dropped.
`f7838ffb3` cased a stored refusal replayed whole (`store` 205)
and asserts every B69 refusal as `tallyErrorText` prints it.
The batch's control copy,
the store test with the format-version case expecting the `reply.text` reason,
failed that case alone and was deleted.

Two findings are left open for work of their own.
Ten more production orderings,
in eight files,
sort with `localeCompare`
(`corpus-run/bench-draw.ts`,
`select-candidate.ts`,
`aggregate-claims.ts` twice,
`corpus-run/coverage-census-baseline.ts`,
`corpus-run/coverage-census-report.ts`,
`corpus-run/coverage-census-print.ts`,
`corpus-run/sentinel-probe.ts`,
and `corpus-run/coverage-tally.ts` twice),
where `critic-attribution.ts` and `repair-stages.ts` already state the code-unit rule;
each is to be read for whether its order decides an outcome,
keys a record or only prints.
And blank lines inside TSDoc blocks are written empty in 570 source files,
with a single space or the indentation in 1,049,
and both ways in 266
(a scratch count over the package's 1,975 source files);
nothing enforces either,
and the edit tool writes them empty,
so one form per file with a source scan is queued.

By the first construct
(`t8-triage-ogaqij.txt`),
the queue for the sixteenth batch is 316 returns,
162 nullish fallbacks,
132 ternaries,
89 throws
and 86 others.
`pair` leads alone
(19 stretches,
9 files,
39 lines,
ahead of `slice`,
`archive` and `corpus-run/run` at 18),
so the sixteenth batch takes it.

The sixteenth batch took the pairing modules against `census-OGAQiJ`
in two code commits,
`b0924bd4d` and `c2974bea9`,
and no entry of its own.
Its census at `c2974bea9`
(`census-PgyHZ8`,
1,470 passes,
taken clean)
reads against `census-OGAQiJ`:
ran 1,
still cold 1,125,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 8.
The 8 edited sources are the cluster's files other than `pair-blocks-stage.ts`,
each "loaded it and left 0 cold stretches",
and the 1 that ran is that file's stretch,
which the report does not list
(`coverage-census-print.ts` prints only the rows that did not run)
but the per-file counts compared between the two census files place there.
Library source went from 785 stretches over 1,593 lines in 291 files to 766 over 1,554 in 282,
with 16 functions never called where there were 17:
the cluster's 19
(`pair-agreement.ts` 1,
`pair-blocks-read-outcomes.ts` 1,
`pair-blocks-stage.ts` 1,
`pair-blocks-steps.ts` 1,
`pair-blocks-wire.ts` 1,
`pair-definition-order.ts` 3,
`pair-media-adjacency.ts` 4,
`pair-sections-stage.ts` 3,
`pair-sections-steps.ts` 4),
all nine files now at none,
and per-file counts compared between the two census files change in no other library file.
The function no longer listed is the `prefix` callback of `pair-sections-stage.ts`
(baseline line 353),
which the contested-source case now calls.
Other packages keep 63 files and 329 stretches,
and entry files 30 stretches over 754 lines.
The 6 not loaded are the baseline's unmapped `wording-key` chunk (`wording-key-C7_uuYqL.mjs`).
The bundles no test loaded are still 36,
carrying 38 sources over 13,322 lines.

How the rows closed,
by commit.
Which arm of a one-line stretch was cold is inferred from the stretch's width and the tests that existed,
since the census's bundle is not kept;
the batch's census is what shows each closed.
`b0924bd4d` removed the arms no input reaches.
`bestVoted` is only handed the agreed pairs naming a source drawn from those same pairs,
so the top-ranked is read with `nonNullishOrThrow` (`agreement` 209).
The heard filter of `readBlockPairingOutcomes` is now a type guard,
so the loop's second heard check went (`read-outcomes` 110).
Each original's targets are held in a `Set`,
so a pair given twice names its block once,
and the in-loop carried check,
which followed a check that none was carried,
went (`blocks-steps` 166).
`blockAt` reads the block a pair names,
so the second lookup and its absent arm went (`definition-order` 253),
and a definition's opening label is read with `nonNullishOrThrow`
rather than dropping the pair from the relabel unsaid (263):
a block is zoned as a definition only for the parser's `footnoteDefinition` node,
whose text opens with its label.
That reading is measured as well:
a scratch probe (`definition-label-probe.mjs`) parsed every page of the pinned corpus,
the original,
the archive and the traditional-Chinese page of each of the 92 entries,
and read a label off each of their 158 definition blocks
(52,
50 and 56),
none unlabelled;
definitions indented by one and by three spaces,
lazily continued,
of two paragraphs and adjacent read a label too,
and a definition block whose text was shifted by one character read as unlabelled,
so the count could show one.
The media-adjacency reads of a pair's blocks (`media` 153)
and of a run's ends (205)
are range-checked upstream
(`readBlockPairing`,
or cached reads keyed by these blocks' text;
`unclaimedRuns` over `targetBlocks.length`),
so both use `nonNullishOrThrow`;
the owner is read as `[owner, ...others]` (269);
and the only symbol `mediaOwner` returns is the unresolved sentinel,
so the unknown-sentinel throw went (356).
In `pair-sections-steps.ts`,
targets,
previous and next hold one entry per original section (`sections-steps` 289,
290,
299 and 300),
so those fallbacks are `nonNullishOrThrow`,
and `scanNearest`,
which copied its answers so far at every section,
appends in one loop.
Both pairing readers' catches narrow through a helper in the repository's `require<Class>Refusal` form
(`requireSectionPairingRefusal` for `sections-stage` 191,
and `requireBlockPairingRefusal` to match it).
`c2974bea9` cased the reachable ones:
an index past the end on the translation side (`blocks-wire` 392-394),
each side's refusal now checked for its class and exact message;
a short bench on each stage (`blocks-stage` 234-245,
`sections-stage` 305-310):
five seats,
whose quorum is three,
with the router refusing all but the two a stage closes on,
the findings exactly as `shortBenchStageFinding` words them;
a source two voices pair one way and two another (`sections-stage` 353-355),
which keeps no pair and says so with the stage's own prefix;
two definition pairs sharing an original,
given with the later archive block first,
read as not crossing (`definition-order` 153);
and a pair given twice emitting its translation block once.
Both helpers are tested directly.
The short-bench cases share a new fixture,
`refusing-seats-client.test-fixture.ts`.

Three corrections came before `c2974bea9`.
Both short-bench cases were first written on a bench of four with two refused,
and failed at their own premise,
`expect(quorum.short).toBe(true)`:
`rosterQuorumSize` is half the bench rounded up,
so two of four is a quorum and that bench is not short (M86).
The rewritten out-of-range case first asserted each side's message alone,
dropping the class check the original side had,
though `readBlockPairingOutcomes` records only a `BlockPairingError` as an unusable reply
and rethrows any other class;
it was read before the commit and checks both (M85).
The fixture's first form used arrow functions and `async` without `await`,
which lint refuses outside a test file;
it follows `archive-selection.test-fixture.ts` (M87).
The batch's control copy,
the definition-order test with the shared-source case expecting `crossing: true`,
failed that case alone and was deleted.
With the tie-break on the archive side removed from `crosses`,
and with the targets held in a list rather than a `Set`,
each new case failed alone in its file,
and both guards were restored.

Two findings are left open.
`scanNearest` rebuilt a list inside a fold,
the quadratic shape rule ITR in `AGENTS.md` rules out,
and `text-accumulators.unit.test.ts` sees only text grown in a loop,
so the package's folds are to be read for a step that copies its accumulator,
with a source scan for the shape.
And `prepare-block-pairing.ts` keeps a `prefix` callback no test calls
(line 162 at `c2974bea9`),
the block-pairing counterpart of the one this batch cased;
it belongs to its own cluster.

By the first construct
(`t8-triage-pgyhz8.txt`),
the queue for the seventeenth batch is 310 returns,
157 nullish fallbacks,
130 ternaries,
86 throws
and 83 others.
Three clusters tie at 18 stretches:
`slice` (7 files,
112 lines),
`archive` (9 files,
36 lines)
and `corpus-run/run` (2 files,
18 lines).
The tie goes to the most cold lines,
so the seventeenth batch takes `slice`.

The first finding the sixteenth batch left open became B70 and was fixed before the seventeenth batch,
in four commits
(`42d7a0f08`,
`be0897f00`,
`f033d19e8`,
`66b77b040`);
the `prefix` callback stays open.
The seventeenth batch reads against the census at `66b77b040`
(`census-DapwaX`,
1,472 passes,
taken clean),
which reads against `census-PgyHZ8`:
ran 0,
still cold 1,104,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 7.
The 7 edited sources are B70's
(`apply-patch.ts` 2 cold stretches,
`archive-italic-title-restore.ts` 1,
`archive-stub.ts` 2,
`dropped-destinations.ts` 3,
`list-spread-restore.ts` 7,
`published-page-check.ts` 4
and `markup-atom-preservation.ts` 1).
Library source went from 766 stretches over 1,554 lines in 282 files to 765 over 1,547 in 282,
with 15 functions never called where there were 16:
compared file by file,
only `archive-italic-title-restore.ts` moved,
from 2 stretches to 1,
since `lastFirst`,
the comparator ordering its titles last first that no test called,
went with that splice.
By the first construct
(`t8-triage-dapwax.txt`),
the queue is 311 returns,
156 nullish fallbacks,
129 ternaries,
86 throws
and 83 others,
and the tie is unchanged:
`slice`,
`archive`
and `corpus-run/run` at 18 stretches each,
with 112,
36
and 18 lines,
so the seventeenth batch still takes `slice`.

The seventeenth batch took the slice modules against `census-DapwaX`,
18 stretches over 112 lines in 7 files,
in five code commits,
`774710cb0` to `3bc823c13`,
and found B71 on the way.
Its rows read three ways.

The unreachable ones went.
`slice-pair` 76,
a hand-written throw on an empty run,
became `nonNullishOrThrow`,
which still throws.
`slice-pair` 318-350,
a one-slice fallback for a section one side of which carries no blocks:
every caller takes its pairs from `alignDocumentSections`,
whose `chunkByHeadings` chunks each hold a node,
and a target is such a chunk or an insertion anchor,
so the function now returns early for an anchor and groups both sides otherwise.
The test that named the fallback ran through the grouping,
its translation being a bare heading;
it is reworded and now checks it gets one slice.
`slice-delivery-decide` 230-235,
`nonNullishAccepted`'s throw:
`decideDelivery` returns the document's text beside the delivery,
so the shipped row reads it there,
and the fault kind went with its sentence (`slice-delivery-fault` 270).
`slice-delivery-decide` 187-188,
a gap for a decision agreeing with an archive that holds nothing:
the coherence check refuses wording beside an absent archive and an empty decision there,
so `decideDelivery` now runs that check itself and the arm went.
`slice-delivery` 327-332,
a missing wording after the count check,
became `nonNullishOrThrow`,
and its fault kind and sentence went (`slice-delivery-fault` 294).
`slice-cost-read` 244 and 292 went with B71's one-pass reader.

The reachable ones have cases (`1845b72c2`):
declined and sealed blocks placed in a slice (`slice-coverage` 207-220,
410-417 and 441-449),
a withdrawn set naming a slice the lane never reached (`slice-delivery-decide` 112),
a wording naming another slice than its position's (`slice-delivery` 342-349),
a record calling the archive present at an anchor (`slice-delivery` 368-374,
`slice-delivery-fault` 302-306)
and a picture carrying no text (`slice-pictures` 208-215).
Both files' existing refusal cases asserted the class alone or a fragment of the message,
and every check in each file throws one class;
they now assert the refusal's structured fault whole.
One fixture put `acceptedText` beside a wording's outcome rather than in it,
so its outcome never changed;
it now sets the outcome.

One case was red on purpose:
the anchor refusal read "slice 1 is present of archive wording by its lane record and the other way by its prepared chunk",
and `3bc823c13` rewords it to say which record says what.

The batch's control copy,
the pictures test with its new case expecting `not read`,
failed that case alone and was deleted.
With each guard turned off in one build
(the digit check in `countField`,
the declined check,
the index and kind checks in `buildSliceDelivery`,
the withdrawn name in `decideDelivery`,
the no-text finding),
exactly the case covering it failed in each file,
and the tree was clean after the restore.
The sealed-blocks check was not turned off:
the session's permission classifier refused that edit,
so its case is unmeasured against a guard-off.
The write tool,
like the edit tool,
wrote a rewritten file's spaced TSDoc blank lines empty;
each was put back by line address before lint,
and `tsdoc-blank-lines.mjs` read every edited file's form after.

Three findings are open from this batch.
`armSliceCost` measures a slice as a difference of `Date.now()` readings,
the wall clock,
and the package does so for most of its elapsed times
(`performance.now()` in two files);
each site is to be read for whether it measures work,
which wants a monotonic clock,
or a budget the owner reads in wall time.
B78 has since closed that family,
reading every duration inside a process on a monotonic clock,
the budgets among them,
a call recorded there open to veto.
The package has about fifty number reads from text in 32 production files,
several on operator-typed variables;
each is to be read for an empty,
signed,
hexadecimal,
exponent or unsafe value read as a number nobody wrote.
B73 has since closed that family.
And `coverageSentence` and `blockPlacementSentence` print a count of one before a plural noun,
which the open family of counts before a fixed plural covers.

Its census at `3bc823c13`
(`census-vi1FHB`,
1,472 passes,
taken clean)
reads against `census-DapwaX`:
ran 8,
still cold 1,103,
cold since then 0,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 5,
each of the 5 loaded and left with 0 cold stretches.
Library source went from 765 stretches over 1,547 lines in 282 files to 747 over 1,435 in 275,
with 15 functions never called as before:
the cluster's 18 stretches and 112 lines,
its 7 files no longer listed.
Compared file by file,
the 8 that ran are the cluster's 5 in the two unedited files
(`slice-coverage` 4,
`slice-pictures` 1)
and 3 in other packages no commit here touched
(`with-timeout.ts` 1 and `create-logger.ts` 2,
whose `onTimeout` and `markEntryUnavailable` left the never-called list),
while the logger's `reportLoggerInternalError` (`error-format.ts` 31) left it too:
called this time,
its one cold stretch became 3 inside the same range,
so the reading counts none as newly cold.
Those three move with timing the suite does not fix
(a logger sink verification that timed out appears in this batch's lint output),
an inference not measured here.

By the first construct
(`t8-triage-vi1fhb.txt`),
the queue for the eighteenth batch is 306 returns,
156 nullish fallbacks,
127 ternaries,
77 throws
and 81 others.
Two clusters tie at 18 stretches:
`archive` (9 files,
36 lines)
and `corpus-run/run` (2 files,
18 lines).
The tie goes to the most cold lines,
so the eighteenth batch takes `archive`.
