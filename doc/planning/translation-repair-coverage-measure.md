# Measuring test coverage in `module-translation-repair`

Recorded 2026-08-25,
after the measure that scoped `#231` turned out to be measuring something else,
and after three further attempts each answered a different question than the one
asked.

`PKG` says a package is unfinished until its tests cover every exported code
path,
and `TCV` says that means enumerating implementation branches rather than
counting green suites.
This package is large enough that the enumeration has to be mechanical,
so the question becomes which mechanical measure actually answers it.

## Four attempts, and what each one really measured

### Module reachability with barrel edges counted

`#208` and `#209` built the import graph,
marked a module reached when a test named one of its exports,
propagated along import edges,
and reported what was left.

It reported `unreached that export something: 0` on 2026-08-25,
which reads as complete coverage and is not.

`#231` had just added eleven `corpus-run/` helpers to barrels,
and a barrel re-export is an import edge like any other.
Naming any one helper in a test marked the barrel reached,
and the barrel then reached everything it re-exported.
The measure improved because the graph got denser.

It is also too coarse independently:
a module counts as reached when ONE of its exports is named,
so `gatherRelabelCases` stayed invisible because `locateSlice` beside it in
`probe-relabel-case.ts` had a test.

### Per-function naming

Ask instead whether any test names each exported function,
skipping barrels because a barrel's re-export list is not its own API,
and stripping comments from the test sources
because a function named only in an `@example` block is not exercised by it.

That reports 118 exported functions no test names.
The number is correct and it is not a gap list:
a helper reached through a caller whose own cases drive its branches is covered
in the sense `TCV` means.

### One-hop caller split

Splitting those 118 by whether their DIRECT callers are tested reported 25
gaps.
That number is wrong twice over.

It matched call syntax, `fn(`,
which cannot see a function handed to a stage as a value.
That form is the normal one for wire guards here,
so `isTranslateReportWire` looked dead while three modules pass it as
`validate:`.

And one hop is the wrong depth.
Six helpers hang off `repair-chunk.ts`,
which no test names;
but `repair-translation.ts` calls it and IS tested,
so a two-hop chain carries tests to all six.

### Transitive reachability with barrels excluded

The measure that answers the question:
seed on modules whose own exported function a test names in CODE,
walk import edges,
and drop barrel modules from the graph entirely,
since a re-export is not a use and counting it is exactly what broke the first
attempt.

Run on 2026-08-25:

```text
non-barrel modules            : 509
  seeded (own export in tests): 410
  reached transitively        : 469
  UNREACHED                   :  40
unreached modules that export a function: 1
```

The other 39 are operator entry scripts that export nothing and run on import,
so no test can reach one by importing it,
and `PKG`'s "every exported code path" is vacuously satisfied for them.

## What is actually left

Two items, both small, and neither is what the earlier numbers suggested.

-   `writeWidthReport` in `corpus-run/editor-width-report.ts`
    is the one exported function whose module no test path reaches.
    It is live production code:
    `corpus-run/editor-width-probe.ts` calls it at line 227,
    and that probe is an entry script no test imports.

-   `unitSourceChars` in `group-source-first.ts`
    is referenced nowhere in the monorepo
    beyond its own declaration and the `document-barrel.ts` re-export.
    It is dead,
    and the ruling `#80` set applies:
    wire it up or delete it.
    Writing a test for it would be worse than leaving it,
    because a test makes dead code look load-bearing.

The remaining 118 directly-unnamed functions need reading rather than sweeping.
Each is reached through a caller,
and whether `TCV` is met depends on whether that caller's cases drive the
branches,
which no import-graph measure can see.

## Reading whether one branch is covered

Recorded 2026-08-25,
while working the functions no test names directly.

The four attempts recorded here all answer one question,
"is this module reached".
None answers what `TCV` asks,
which is whether a case drives a particular BRANCH,
and reading the caller's cases by eye answers it badly:
a case can execute a branch while asserting nothing that branch decides.

Mutate the branch and run the suite.
If nothing fails,
no case asserts what that branch decides,
whatever the import graph says.
This is `GFP` pointed at code that already exists rather than at a new guard,
and it costs one build plus one suite run per branch,
about two minutes in this package.

It overturned two readings on the day it was written.
`blankAgainst` looked uncovered,
since its only caller documents its own arm as unreachable;
removing the guard failed `translate-judge.unit.test.ts` too,
which hand-builds a slate the producer would never assemble.
And two new cases looked like they pinned the shape
`unchangedChunkOutcome` builds;
mutating that shape left them green,
because a run whose checkers refuse to confirm passes through the settlement
in `repair-chunk.ts` instead,
which builds its own outcome.

Measured this way on 2026-08-25:

-   Covered, so no case was written:
    `reanchorInsertions` on both arms,
    `anchorOffsets`' placed-nothing guard,
    `leavesOriginalUnplaced`'s second conjunct,
    `notApplicableRepair`'s finding,
    `placeInsertions`' shortfall label,
    `unchangedChunkOutcome`'s heard-critic count,
    `assembleRepair`'s shipped-slice count,
    and `applyCandidate`'s composite.

-   Uncovered, and closed by a case since:
    `assembleTranslation`'s two refusal dispositions beside alignment,
    the settlement's critic telemetry where nothing shipped,
    and `unchangedChunkOutcome`'s roster.

-   Uncovered and still open:
    `unchangedChunkOutcome`'s attributions,
    non-translation votes,
    and their standing.
    Reaching the exits that build those with a non-empty attribution list
    needs a scripted state this work has not found.

## What the sweep found, tier by tier

Recorded 2026-08-25,
after nineteen further branches were measured the same way.

Rounds run in batches of four or five,
each one mutating a branch,
rebuilding,
running the package suite and restoring.
A round costs about forty-five seconds here,
so a batch of five fits inside a single wait.

ONE BRANCH PER FUNCTION,
which bounds what a covered verdict means:
it says that branch is asserted,
not that the function is.
Breadth first was chosen deliberately,
since it finds the largest gaps soonest,
and a function whose representative branch came back uncovered is worth
deepening before one whose came back covered.

Covered, so nothing was written:
`codePointCount` excluding the surrogate range,
`wordsOf` pushing its final word,
`collapseSoftLineBreaks` requiring both neighbours,
`sharedNumber` on both its source check and its digit floor,
`sourceBytesOf` counting bytes rather than characters,
the slice cache key and its file name,
`isTranslateReportWire` refusing a blank,
and `extensionOf` lowercasing.

Uncovered, and closed by a case in `2302cf549`:
`reflowOrphans` clearing what it holds at an anchor,
`digitRuns` closing a run that ends the passage,
`unsupportedVariant` wrapping through ten,
all three decisions inside `buildLicensedQuotes`,
`pluralEntries` agreeing its noun,
`generationLines` printing the count,
and `unheardCacheDiscardFinding` naming its slice.

THE UNCOVERED NINE CLUSTER,
which is worth noticing:
seven of them are the ends of things.
The last digit run in a passage,
the wrap from nine to zero,
the empty quote,
the repeated quote,
the noun at one entry.
Cases get written against the middle of a function,
where the interesting behaviour is,
and the ends go unasserted while still being executed on every run.

## What not to do

Do not re-run module reachability with barrel edges counted.
Every barrel addition makes its answer better without making the package better.

Do not match call syntax when looking for callers.
A guard passed as `validate: isFooWire` is a caller,
and a scan for `isFooWire(` reports it as dead.

Do not read a first-try pass as evidence.
Every guard added under `#231` was proved by removing it,
rebuilding,
running,
and restoring,
per `GFP`.

Do not read a steady `] PASS ` count as evidence nothing broke.
The runner prints ONE `PASS` line per suite,
naming every child that passed,
and a separate `FAIL` line per child that did not.
A suite with one failing case still prints its `PASS` line naming the rest,
so the count held at 711 across a `GFP` round in which a case failed and the run
exited 1.
`TLY` already rules that the exit code decides;
this is what a count disagreeing with it looks like in this package.

Do not put two suites a single GFP round needs to read in one file.
`await describe` throws,
so a failure in the first suite aborts the file before the second runs,
and the round then proves nothing about the second.
`#231`'s second round hit exactly this.
