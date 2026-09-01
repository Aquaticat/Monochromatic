# Translation repair history: 2026-08-23 to 2026-08-24, segment 2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

DIAGNOSIS DISCIPLINE,
since this went wrong twice in one session.
The first reading was that XIEPT2 could not fill its own gaps,
refuted by the hourly time course.
The second was that the provider was degrading,
refuted by the 429 body quoted here.
Both were stated before anyone read a response body.
The body was one tool call away the entire time.

## The largest entries: the frozen build `#196` asked for is one invocation wide

Landed 2026-08-24 in `c9fc220a0`.

`#196` recorded three ways out and ranked none,
and its first was to run an oversized entry as a SEQUENCE of attempts against a frozen build,
noted as costing nothing to build and needing the build to stop moving.
It also carried a warning against acting yet:

> DO THIS ONLY AFTER THE CURRENT LANDINGS SETTLE.
> The point of the first option is a stable digest,
> and it is worth nothing while fixes are still going in.

That warning rests on a premise that reading the code refutes.

### The build already stops moving, for exactly as long as one invocation

`corpus-pass.ts` computes `digestPipeline({ dir: import.meta.dirname, },)` once,
before the processing loop,
and every cache the run opens is namespaced by that digest in `slice-cache-namespace.ts`.
Nothing landing in this repository can move it under a running loop.
The slices a capped attempt bought are still this generation's when the next attempt opens the cache.

So the sequence never needed a frozen build in the operator's sense,
and it never needed the landings to settle.
What actually prevented it was scheduling,
and only scheduling:
the loop ran `for (const entry of pending)` over a list built before it started,
so a capped entry was visited exactly once
and the invocation moved on to other entries for up to the three-day soft budget.
XingZ60 got one 420-minute attempt per invocation
and every further attempt required a relaunch,
which re-read `HEAD`,
rebuilt,
and moved the digest if anything had landed in between.
That is the loop `#196` described as needing discipline to escape.
It needs a queue instead.

### What landed

The list became a FIFO queue.
An attempt that did not settle is pushed to the BACK,
so a large entry can never spend the budget
before every other entry has been tried once:
coverage of the corpus is what a first attempt buys.

### The stop condition is the half that needed care

`corpus-pass.ts` had already written the hazard down,
in the note beside `resumableIds`:

> NO PROGRESS GUARANTEE IS CLAIMED HERE,
> and one used to be:
> this said a cap-abort always completes at least one new slice,
> which is false.

An abort can land before the first persistence,
and the slices a lane deliberately leaves uncached,
the unfilled and the unheard,
produce no cache entry however long they took.
A retry-until-settled loop would therefore spend three days on an entry that never moves,
which is worse than the cap it replaced.

So an attempt earns another only on MEASURED progress:
`countCachedSlices` before and after,
across every lane sharing the entry's directory,
since progress is progress whichever lane made it.
Equal counts stop the entry and log `STALLED`.

### Two cases where the obvious reading is backwards

Both are about a cache count that FELL,
and both carry tests.

A SETTLED entry discards its slice cache on the way out,
in `pass-entry.ts`,
after the artifact write.
Inferring progress from the count alone
would read the one outcome the whole pass exists to reach
as the sharpest possible stall.
Settlement is therefore an input to the verdict,
never inferred from it.

A count that FALLS but stays above zero means the lane discarded an older build's cache,
so every slice left was bought by the attempt just finished.
The plain difference reads negative,
and taking it would drop the entry
precisely when it had begun paying for a fresh generation.

GFP-proven both ways.
Returning the plain difference fails the reset case alone;
removing the stall branch fails both stop-condition cases.
607 unit tests pass,
zero lint findings,
types clean.

### What this does not settle

The cap itself is untouched,
and so are `#196`'s other two ways out.
Raising the cap by slice count and cutting the per-slice round count
are still unmeasured against each other,
and the second changes quality,
so it stays last under the standing instruction.
Neither is needed to make an oversized entry settle now:
a single invocation can give one entry attempt after attempt against a build that cannot move.

What is owed is a live run.
The queue is proven at the unit boundary and by mutation,
not yet at the user boundary,
and the entry that would prove it is the one that costs thirteen hours.

## Aged out of the working handover on 2026-08-25

Moved verbatim from `doc/handover/translation-repair.md` when it reached its two-thousand-line cap.
Nothing here was edited on the way across.

## The writer calibration's coverage report, verified live (2026-08-24)

Both calibrations gained a silence report earlier the same day
and neither new reporting path had ever run.
The finished 40-round writer run and the 29-round editor run
were both settled by the binary that preceded it.

A 3-slice writer calibration into `~/temp/agent/producer-coverage-vub-2026-08-24` closed that gap.
It printed:

```text
  WROTE NOTHING AT ALL: qwen3.8-max, minimax-m3, gemma-4-26b-a4b-it, deepseek-v4-pro-0813,
  deepseek-v4-flash-0731. No candidate of theirs reached any slate, so the table covers 5 of 10 seats.
```

All five Hyper-only seats named,
the denominator right,
and no spurious "wrote and was never voted on" group,
since all five Synthetic writers drew ballots.
Charm Hyper was dry throughout,
so the run also exercised the retry path:
`select: retry round 1 for 6 lost voices`,
three times,
before settling the slice.

The standing itself settles nothing at 3 rounds and says so in its own last line.
That was not what the run was for.

## The settled artifact speaks one vocabulary, as generation 3 (`#94`, 2026-08-24)

`withdrawnChunkIndices` sat beside `withdrawnSliceCount` in the same record,
about the same things.
`#99` is what that class of confusion costs.

Renamed,
at 351 sites:

-   `shippedChunkIndices` becomes `changedSliceIndices`.
    Not `shippedSliceIndices`:
    the incumbent ships whenever the archive wording stands,
    so "shipped" reads ambiguously,
    while both arrays name slices whose returned text DIFFERS from the archive.
-   `withdrawnChunkIndices` becomes `withdrawnSliceIndices`.
-   `chunkCritics` becomes `sliceCritics`,
    with `ChunkCriticRecord`,
    `ChunkCriticView`,
    `buildChunkCriticRecords` and `decodeChunkCritics`.

`chunkIndex` is NOT in this change.
It gets its own change and its own verification,
which landed as `#204` below.
The claim recorded here that it reaches cache keys was WRONG,
and is corrected in that section:
it reaches none of the six cache-key builders.

### Why the version moved, and why the symbols did not

A key rename is a shape change,
and `artifact-schema-version.ts` states that a version which does not move on one
is the failure that field exists to end.
So the pass writes generation 3.

`artifact-v2-build.ts` passes `lanes.repair` and `lanes.translate` through whole as `result`,
so the internal field names ARE the wire keys.
There was no internal-only step to land first:
holding the bytes still would have meant a mapping layer built only to be deleted by the next change.

The 63 `V2` symbols at 808 sites across 63 files did NOT follow the integer.
`V2` there names the TWO-LANE shape,
not the number,
and the contract file now says so.
Renaming that family to something version-free is worth doing and is tracked separately.

### How both generations are read

`artifact-key-vocabulary.ts` holds three key names per generation and nothing else.
`parseSettledArtifactV2` reads the recorded version,
selects one table,
and threads it two hops to `parseLanesV2` and the two evidence parsers.
`attribution-read.ts` does the same for `sliceCritics`,
treating an unversioned artifact as generation 1.

No artifact is ever tried under two spellings.
A generation 3 stamp over generation 2 keys is refused,
which is correct:
it is not a generation 3 file.

Generation 1 keeps its own spelling on disk,
read and written.
Nothing writes that generation any more,
and re-spelling it would strand the files it left behind in exchange for nothing.

`assertResumableSchemaGeneration` moved with the writer,
so a run directory of generation 2 artifacts is now foreign to a resuming pass.
That is what the guard is for.

### Verified

Suite exit 0,
lint 0 warnings and 0 errors,
types clean,
build clean.

GFP on the new spelling guard:
making the writer emit `shippedChunkIndices` under a generation 3 stamp
built cleanly and failed the suite at the `hasOwn` check,
which is the failure a fixture-only suite could never produce.

At the boundary,
through the shipped bundle,
over the six real generation 2 artifacts in `~/temp/agent/vub-run1-20260821`:
all six read,
all six generation 3 twins read,
and the two parses are identical on every interpreted field.
They differ only inside `lanes.*.raw`,
which is the file's own record passed through unread
and so carries the file's own spelling by design.
All six mislabelled files,
generation 3 stamp over generation 2 keys,
were refused.

### And live, end to end

One entry through the real pipeline,
`gaoyanger` into `~/temp/agent/gen3-vub-2026-08-24`,
exit 0 in 975 seconds:

```text
TALLY gaoyanger status=SETTLED slices=2 repairStatus=repaired repairIssues=4 repairAccepted=3
repairResolved=3 repairChanged=1 translateChanged=1 documentsDiffer=1 selection=contested
```

Read back off disk:
stamped generation 3,
all three current keys present,
zero older keys,
and its own reader accepts it.
`verify-published` then agreed:
`1 of 1 pages carry every wording their artifact promised, at the length it implies`.

Charm Hyper was dry for this too,
so five of the ten seats lost their voice at every stage
and the entry settled anyway on the five that answered.
That is the resilience the owner asked for,
observed rather than asserted.

## The stamped index is `sliceIndex`, as generation 4 (`#204`, 2026-08-24)

Pass two of the vocabulary rename,
and it was not the mechanical sed the plan described.
Two recorded premises were wrong,
and each was corrected by measuring before acting.

### It reaches no cache key

`chunkIndex` appears in zero of the six cache-key builders.
The keys hash positional arrays,
and `repair-slice-key.ts` records
that the slice index was removed from the key at version 26.
The earlier note in the `#94` section is corrected above.

### The name was already taken, by a different concept

`sliceIndex` already existed:
122 occurrences in 19 files,
meaning POSITION in `prepared.slices`,
with `neighbouringSource`,
`neighbouringIncumbent` and `slicePictures` throwing on a non-position.

A blanket rename collapses two concepts into one name
and recreates exactly the defect `#99` was opened on.
The attempt surfaced as two `TS2451` redeclarations in `translate-document.ts`
and would have been SILENT everywhere else.
It was reverted whole with `git checkout -- package/module/translation-repair/src` and split in two:

1.  `sliceIndex` to `slicePosition`,
    122 sites in 19 files,
    freeing the name.
    Commit `6a3b24533`.
2.  `chunkIndex` to `sliceIndex`,
    1734 sites in 194 files.
    Commit `49e5a41cd`.

Reading what broke,
rather than trusting the count,
is what caught this.

### The wire moved too, and generation 3 is a mixture

`artifact-v2-project.ts` maps the index explicitly,
so holding the wire still was available here
in a way it was not for the arrays.
It was rejected:
a file spelling one half the new way and the other half the old way
is the defect this work exists to end.

So `artifact-key-vocabulary.ts` gains a fourth field and a fourth row,
and generation 3 becomes what it always was on disk:
a MIXTURE.
Confirmed against the one real generation 3 artifact:
its `result` spells `sliceCritics` and `changedSliceIndices`,
and every one of its twenty-odd index keys spells `chunkIndex`.

`parseSettledArtifactV2` now names the generations it reads in a list
rather than a chain of comparisons,
and five parsers plus one lane envelope
take the vocabulary rather than naming a key.

### Verified

Suite exit 0,
lint 0 warnings and 0 errors,
types clean,
build clean.

Three guards GFP-proven,
each shown to fail with the guard removed and then restored:

-   Collapsing the generation 3 mixture into the current table
    fails the vocabulary dispatch cases and the cross-generation equality,
    and makes the one real generation 3 artifact unreadable.
-   Making the writer spell the ledger index the old way while stamping generation 4
    fails the end-to-end settle in `pass-entry.unit.test.ts`.
-   Letting a ledger row tolerate both spellings
    fails the case pinning that a relabelled body is refused.

At the boundary,
through the shipped bundle,
all 42 real two-lane artifacts under the agent scratch root read with no refusals
and no blank indices:
41 of generation 2 over 492 ledger rows,
and 1 of generation 3 over 4.

That null result has a positive control.
Each file read under a generation it does not carry is REFUSED,
and each refusal names exactly the key the wrong table asked for:
generation 3 read as 4 refuses at `lanes.repair.delivery[0].chunkIndex`,
read as 2 refuses at `lanes.repair.result.shippedChunkIndices`,
generation 2 read as 4 refuses at the same delivery key,
and read as 3 refuses at `lanes.repair.result.changedSliceIndices`.

### And live, end to end

One entry through the real pipeline,
`gaoyanger` into `~/temp/agent/gen4-vub-2026-08-24`,
exit 0:

```text
TALLY gaoyanger status=SETTLED slices=2 repairStatus=repaired repairIssues=9 repairAccepted=7
repairResolved=7 repairFindings=55 repairChanged=1 translateStatus=complete translateChanged=2
documentsDiffer=2 pageChanged=1 pageSilent=0
```

Read back off disk:
stamped generation 4,
`sliceIndex` the only index spelling anywhere in the file,
zero of the three older array keys,
and its own reader accepts it with all four ledger rows carrying a numeric index.
`verify-published` then agreed:
`1 of 1 pages carry every wording their artifact promised, at the length it implies`.

Charm Hyper was dry for this too,
so five of the ten seats had no voice at any stage
and the entry settled anyway on the five that answered.

## The read-any-generation dispatch never learned generation 3 (`#206`, 2026-08-24)

Found sweeping for stragglers of the rename above,
and it is the more interesting find.

`readSettledArtifact` in `artifact-read.ts` is the barrel's entry point for reading an artifact
of any generation.
It compared the recorded version against version 1 and version 2 and nothing else,
so a generation 3 or 4 body fell through to the final throw
and was reported as a generation nothing reads.

THE COMMENT ABOVE THAT THROW CALLED ITSELF UNREACHABLE and named this exact drift:
"the day a generation is added to that list and forgotten here".
`#94` added generation 3 to `KNOWN_ARTIFACT_SCHEMA_VERSIONS` and did not add it here,
so every generation 3 artifact has been refused by this path for as long as the generation existed.

### What it did not cost

Nothing inside the package calls it.
The pass reads through `parseSettledArtifactV2` directly,
and `verify-published`,
`assertResumableSchemaGeneration` and the attribution reader all bypass it.
So no run was affected and no artifact was misread.
A consumer of the barrel would have been.

### The fix, and why the list moved

`TWO_LANE_GENERATIONS` now lives in `artifact-v2-contract.ts` and is exported,
because TWO places decide something about the family:
the reader that accepts a body,
and the dispatch that chooses that reader for a file.
Those two lists drifting apart is not a refusal but a WRONG ANSWER.
The final throw is re-commented as reachable rather than as unreachable.

GFP-proven:
restoring the drifted form,
naming the first generation alone,
fails the new case,
which reads the same list and requires the two-lane reader to have ANSWERED
for every generation in it.

### The straggler class

Four names the bare-word rename could not reach,
because each carries a prefix or suffix:
`_chunkIndex`,
`earlierChunkIndex`,
`laterChunkIndex` and `byChunkIndex`.
None reaches the wire,
and no artifact on disk carries any of them.
A rename measured by counting a bare word will always leave this class behind;
the sweep that finds it is a case-insensitive search for the token as a SUBSTRING.

## The 53 indirectly-reached modules, branch by branch (`#209`, 2026-08-24)

`#208` closed the tier no test reached at all.
This is the next one:
the 53 modules the suite reaches only through a caller.
`TC2`'s question there is not whether the module is reached
but whether each implementation branch has a test,
or only the happy path does.

The shape of the gap is the same every time.
`parseSettledArtifactV2` calls `assertIndexSetsMatchLedger` on every valid artifact fixture in the suite,
thousands of times,
always down the arm where nothing was wrong.
That is coverage of the caller.
The refusal branches are what the module exists for,
and no valid fixture can reach one.

Ranked by branch density,
measured with a brace-and-keyword count over each module.
The measurement lives in the session scratchpad;
the ranking is reproduced here because it is what the remaining work is ordered by:

```text
branches  code lines  exports  module
      31         239        1  align-headings-optimal.ts              DONE
      20         164        3  corpus-run/artifact-v2-read-set-relations.ts  DONE
      16         138        2  preservation-tokens.ts                 DONE
      14         131        1  lane-slice-sets.ts                     DONE
      12         127        2  translate-skeleton.ts                  DONE
      12         121        2  corpus-run/artifact-placement.ts       DONE
      12         118        5  corpus-run/artifact-v2-project.ts      DONE
      11         237        3  corpus-run/artifact-v2-read-consolidate-parts.ts  DONE
       9          66        1  stream-recurrence-watch.ts             DONE
       9         250        1  refine-slice-settle.ts                 DONE
       8          91        1  translate-retry.ts                     PROBED, already defended
       8         122        1  fidelity-splice.ts                     DONE
```

### What each landing proved, by mutation

Every module gets a mutation applied to the SOURCE,
rebuilt,
run,
and restored.
What matters is not that the suite went red;
it is whether the new cases were the ONLY thing that noticed.

`align-headings-optimal.ts`,
commit `5774615b8`.
Mutation G judged a pairing by its prefix alone,
replacing the backward-table term in `scanOptimalPaths` with a zero score.
16 failures,
including every new aligner case.

`corpus-run/artifact-v2-read-set-relations.ts`,
commit `299e2e6f3`.
Mutation A removed the position-by-position comparison from `assertListMatches`,
leaving a length check.
TWO failures,
both new,
and NOTHING ELSE in the suite noticed:
before this,
a lane recording the right indices in the wrong order was accepted,
and the ordering both contracts state was untested.
Mutation B made the whole-document refusal count as a guard withdrawal,
which two new cases and two existing `parseSettledArtifactV2` cases caught.

`preservation-tokens.ts`,
commit `c367d77a0`.
Mutation C added a colon to `SENTENCE_ENDS`,
the exact regression the module's comment says made a deleted contributor name invisible.
Caught by the new colon case and by one existing `applyPatchOperations` case.
Mutation D stopped dropping one-character Latin words.
ONE failure,
the new case,
and nothing else.

`lane-slice-sets.ts`,
commit `0c078ad36`.
Mutation E ran the archive rules BEFORE the disjointness pass.
Caught by the new ordering case and by one existing `buildLaneSliceTexts` case.
The ordering is contract:
a slice named by two lists disagrees with itself first,
so reporting which archive rule it breaks answers a question neither list has earned the right to ask.
Mutation F dropped the decided-at-once refusal,
caught by two new cases and two existing ones.

`validateNamedSets` and `NamedSliceSet` reach the barrel as `@internal` so the test can exercise the shipped bundle,
which is the standing ruling on internals rather than a new exception.

`translate-skeleton.ts`,
commit `e6d57da2c`.
Mutation G stopped a list saying whether it is ordered,
caught by three new cases.
Mutation H stopped a footnote DEFINITION contributing an atom,
so only the marker survived.
ONE failure,
the new case,
and nothing else:
a translation dropping the definition and keeping the marker passed every structural guard in the suite.
`blockDetail` reaches the barrel as `@internal` so a case can ask what an absent `ordered` field means,
which no Markdown input produces.

`corpus-run/artifact-placement.ts`,
commit `9244e8120`.
Mutation I made an unreadable digest unplaceable rather than legacy,
and mutation J let an artifact carrying no id skip the identity check;
the census already covered both,
which is the honest result and the reason the third was run.
Mutation K accepted uppercase hex as an object id.
ONE failure,
the new case,
and nothing else:
git writes lowercase,
so two spellings of one commit would have counted as two generations.

`corpus-run/artifact-v2-project.ts`,
commit `6aebccf27`.
Mutation L spread the live ledger record instead of rebuilding it through a literal,
caught by the new key-list case and by one existing `buildSettledArtifactV2` case.
Mutation M aliased `undecidedLanes` instead of copying it.
ONE failure,
the new case,
and nothing else:
the artifact outlives the run,
and a reader mutating what it read would have reached back into the builder's own comparison.

`corpus-run/artifact-v2-read-consolidate-parts.ts`,
commit `caf4ca0f2`.
Mutation N let text ship from a slice that settled on no change,
and mutation O read the ballot evidence lists as prose rather than as rendering names;
`parseConsolidationV2` already covered both,
which is the honest result.
Mutation P let an unchanged slice carry text it does not ship.
ONE failure,
the new case,
and nothing else.

`stream-recurrence-watch.ts`,
commit `670a552d6`.
THE STRONGEST RESULT IN THIS TIER,
and the one that came from measuring rather than reading.
The runaway watch's own tests already prove this detector's headline claims,
so a duplicate file would have restated them.
Before writing anything,
two diagnostic mutations asked what the suite actually defends:
setting the consecutive-hit threshold to 1 was caught,
and REMOVING THE TRAILING-BUFFER TRIM LEFT THE WHOLE SUITE GREEN.

That trim is a correctness rule,
not an optimisation.
It decides how far apart two copies of a passage may be before the earlier one stops counting.
A reasoning trace in this pipeline restates whole candidates verbatim,
so one quoted near the start and again near the end is ordinary work,
and without the trim the early copy stays findable forever
and the second quotation reads as a loop that kills a healthy voice.
The new case is exactly that pair of distant quotations,
and re-running the same mutation after it landed produced one failure:
the new case,
and nothing else.

### A runner behaviour worth knowing before reading any of this

A failing `await describe(...)` REJECTS,
and a rejected top-level await ends the module.
Later `describe` blocks in the same file never run.
So a mutation report naming two failures out of five suites is not evidence the other three passed:
they may not have executed.
Read a GFP result as "these cases fired",
never as "only these cases were affected",
unless the failing suite is the last one in its file.

### Two barrels split on the way

Adding `@internal` exports so the tests could reach the shipped bundle
pushed two files past the 300-line budget,
and both were split by audience rather than shortened.
`corpus-barrel.ts` gave up the version 2 READER family to `artifact-read-barrel.ts`,
leaving 252 lines against 52.
`index.ts` gave up the stream-watching family to `stream-barrel.ts`,
leaving 265 against 41.
`index.ts` composes both,
so no importer sees either seam.

### The eleventh landing: the join rule that hides a seeded deletion

`fidelity-splice.ts` holds one export,
`spliceOutSentence`,
and one importer,
`fidelity-damage.ts`,
whose own cases ask whether a seeded sentence disappeared.
Every join rule answers that identically,
including no join rule at all,
so the whitespace decision the module exists for was invisible to the suite.

PROBE W1 confirmed it before a line of test was written.
Removing the line-break precedence from the private `survivingRun`,

```ts
  if (lineBreaksIn({ run: before, },) !== lineBreaksIn({ run: after, },)) {
    return (lineBreaksIn({ run: before, },) > lineBreaksIn({ run: after, },))
      ? before
      : after;
  }
```

left only the two boundary rules and the length tiebreak,
and the whole suite stayed green at 653 verdicts,
exit 0.

WHAT THAT BRANCH DECIDES.
A paragraph cut from the middle of a page
sits between a paragraph break and whatever follows.
Without the rule the longer run wins,
so a two-character `\n\n`
loses to a three-space gap and two paragraphs collapse onto one line
with a triple space at the join.
That is precisely the typographic edit-mark the module note says it exists to prevent,
and it would let a damaged candidate lose a fidelity trial on tidiness
rather than on the coverage the trial means to test.

Sixteen cases landed in `src/fidelity-splice.unit.test.ts`,
one rule each:
both arms of the line-break comparison,
both boundary rules and the order they are asked in
(the only observable case is a cut that reaches both ends at once),
the length tiebreak and its equal-weight fallback,
the ideographic and no-break spaces the Chinese half of the corpus separates with,
first-occurrence-only removal,
and the two runs of length zero.

GFP:
re-applying probe W1 fails exactly the two line-break cases
and the suite aborts at 654 PASS / 3 FAIL,
exit 1.
Restored,
rebuilt,
back to 654 / 0.

### `translate-retry.ts`: probed, already defended, no file written

Probes V1 and V2 were both caught by existing `runTranslateStage` cases.
Recorded here rather than left as a gap:
the module is reached indirectly,
and its branches are covered through its caller.

### Suite size across the eleven landings

636 suite verdicts before `#209`,
654 after the eleventh,
with exit code 0 each time and the FAIL count read off the runner's own `] FAIL ` prefix.

Eight mutations were caught by the NEW CASES ALONE,
which is the part that says a gap existed rather than a rule being restated:
the index ordering comparison,
the one-character-token rule,
the footnote definition atom,
the lowercase-only object id,
the undecided-lanes copy,
the unchanged slice carrying text,
the trailing-buffer trim,
and the line-break precedence in the splice join.
