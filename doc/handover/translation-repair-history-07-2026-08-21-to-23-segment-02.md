# Translation repair history: 2026-08-21 to 2026-08-23, segment 2

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

`dogesir_` settled at 00:58:55Z in the `#163` boundary run.
The far-longer
precondition DID NOT REPRODUCE,
and the cause is upstream rather than random.

WHAT CHANGED,
with the control run first because the obvious alternative is a
corpus change:

-   `corpusSha` is identical across the two runs,
    `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
    Same archive,
    same source.
-   Sliced SOURCE characters are identical,
    1196 in both.
    The Chinese side is
    sliced the same way.
-   Sliced ARCHIVE characters fell from 3475 to 1818.
    The whole archive is 3716
    characters,
    so 1898 of them now sit OUTSIDE the paired region.

So the English side lost 1657 characters from the sliced set while the Chinese
side did not move at all.
That is `#157`,
whose declined blocks now leave the
slice.

THE CONSEQUENCE FOR `#163`.
Slice 3 still carries the same 114-character
Chinese,
but its archive rendering is now 226 characters,
1.98 times,
where the
08-18 run had 1766 characters at 15.49 times.
The ratio tail is gone,
the note
stays silent,
and it is CORRECT that it stays silent:
there is no longer a
disproportion to report.

This narrows an earlier reading without overturning it.
`contest-size-note.ts`
records that both far-longer trips were page-only content rather than
displacement,
established by profiling the document and finding no donor slice.
That holds.
What it did not say is that the surplus was English the pairing had
no business pulling into the slice at all,
so the right fix was never to have a
judge reason about it.
`#157` does that at the pairing.

ALSO SEEN,
and it tightens a margin `#163` already called thin:
at slice 2 the
TRANSLATE lane produced 2170 characters against a 232-character source,
9.35
times.
That is a PRODUCED candidate closer to the 10 endpoint than the 9.27 the
earlier census recorded as its maximum.
It carries `block-count-gap`,
which is
excluded from the ratio-tail reasons,
so no note fired.
The judges caught it
without one:
five of six chose repair and four marked translate `unsupported`.

WHAT IS STILL DECIDABLE.
`wangzihao980` slice 3 is the FAR-SHORTER case,
102
Chinese characters against 66,
and `#157` cuts in the opposite direction there:
removing unpaired English makes a slice's English side SHORTER,
which can only
make a far-shorter tail more reachable,
not less.
That entry has not started
yet and is now the whole of the remaining verification.

Nine of the ten slices reached the lane contest.
Slice 5,
at 276 characters
against 244,
was not contested and appears in `comparison` but not in
`laneSelection`.

### Corpus-wide tail census: the extreme archive ratios are gone, in BOTH directions

Run while waiting on `wangzihao980`,
over every settled artifact on disk
(`${HOME}/temp/agent/163-tail-census.mjs`,
ids and ratios only).
It reports
ratio tails on the ARCHIVE side per artifact,
dated by the artifact's own
timestamp.

THE AGGREGATE IS CONFOUNDED AND IS NOT THE EVIDENCE.
43 artifacts,
10
far-longer and 5 far-shorter overall;
15 settled on 2026-08-22 or later with
zero of either.
But the recent set is mostly two-to-four-slice entries settled
by verification runs,
while the older set holds the long ones,
so entry size
alone could produce that split.

THE PAIRED SAME-ENTRY COMPARISONS ARE THE EVIDENCE.
Three entries settled both
before and after the pairing work,
and every one lost its tail:

-   `Zha_Ke`:
    maximum archive ratio 94.51 to 5.15,
    far-longer 1 to 0.
-   `dogesir_`:
    15.49 to 3.40,
    far-longer 1 to 0.
-   `lintong`:
    7.98 to 3.75,
    far-SHORTER 1 to 0,
    slice count 5 to 3.

A CORRECTION TO WHAT THIS FILE SAID EARLIER TODAY.
The `dogesir_` section
reasons that `#157` cuts TOWARD the far-shorter tail,
since removing unpaired
English shortens a slice's English side.
`lintong` refutes that:
its
far-shorter case cleared as well.
The pairing work is not directional in the
way that argument assumed,
because it changes the slicing itself rather than
only trimming one side,
so a ratio can move either way.
Treat the far-shorter
prediction for `wangzihao980` as OPEN,
not as favoured.

ATTRIBUTION IS LIMITED TO WHAT WAS MEASURED.
The census shows the effect,
not
which commit caused it:
`#131`,
`#157` and `#159` all landed in that window.
Only `dogesir_` carries a specific mechanism,
and it is `#157`'s signature:
sliced archive characters fell 3475 to 1818 while sliced source characters held
at exactly 1196.

WHAT THIS MEANS FOR THE SIZE NOTE.
Its far-longer half now serves no case that
still occurs in anything settled here,
and its far-shorter half has lost its
only demonstrated instance outside `wangzihao980`,
which has not settled yet.
Do not act on that until it does.
The note costs nothing when silent,
so there
is no urgency in removing it,
and the question is whether it earns the policy
text it adds to every contest message.

## 2026-08-23: the boundary verification's answer, and the gap it found

`wangzihao980` settled and the pass exited 0.
The far-shorter precondition
REPRODUCED,
twice,
so this half of `#163` is a real verification rather than a
vacant one.

-   Slice 3:
    Chinese 102,
    archive 66,
    0.65 times,
    `target-far-shorter`,
    note FIRED.
    Candidates 186 and 182.
-   Slice 4:
    Chinese 141,
    archive 88,
    0.62 times,
    `target-far-shorter`,
    note FIRED.
    Candidates 167 and 171.
    In the 08-18 run slice 4 was the 8.71
    times FAR-LONGER case;
    under the current pairing it is far-shorter.

Two of five contested slices fired,
against the 1.7 percent the design measured
over the older corpus.
The rate on this entry is not the corpus rate,
but it is
worth knowing that a single entry can carry two.

THE NOTE REACHES THE JUDGES AND THEY ACT ON IT,
at slice 4:
translate won four
votes to one,
two judges marked repair `unsupported` or `dropped`,
the
consolidation gate was ASKED,
and the fuller text shipped.

AT SLICE 3 THE UNDER-RENDERING SHIPPED ANYWAY,
and the reason is structural
rather than a judge ignoring evidence:

    laneSelection  settled-neither
    consolidation  terminal=no-standing-text, gate=not-asked, shipped=unchanged

No lane won,
so there is no standing text,
so the gate is never asked and the
archive stands.
The archive is the 66-character rendering the note flagged.
The
judges did NOT endorse it:
two of six marked BOTH candidates as `dropped`,
which
is a rejection of the candidates,
not an endorsement of the incumbent.
The
fallback simply happens to be the shortest of the three.

SO THE GAP IS THIS.
`settled-neither` means "neither candidate is better",
and the pipeline reads it as "keep the archive".
At a slice where the archive is
measurably under-rendering,
those are different claims,
and nothing currently
separates them.
The size note is the only thing in the system that knows the
incumbent is short,
and it is shown to judges who cannot vote for or against the
incumbent at all:
`LaneChoice` is `repair`,
`translate` or `neither`,
and the
archive is not a candidate.

That is worth stating plainly,
because it also explains why the far-shorter half
of `SIZE_NOTE_POLICY` cannot do what it says.
It instructs a judge to "put the
DROPPED question to that rendering in particular",
and at slice 3 that rendering
is the one the ballot has no way to name.

WHAT THIS DOES NOT SHOW.
Nothing here says the archive at slice 3 is wrong,
only
that it is short and that no candidate beat it.
Deciding it is wrong needs the
passage read,
which is a separate act.
The finding is that the mechanism cannot
currently distinguish the two cases.

VERDICT FOR `#163`:
the estimator and the note are LANDED and the note is
verified to reach judges and to move an outcome where a lane wins.
The
far-longer half now serves no case that still occurs (WRONG,
corrected below:
it serves a case at 185x that the note's floor hides).
The far-shorter half is
demonstrated live,
and it exposed the `settled-neither` fallback rather than
being consumed by it.

## 2026-08-23: the throw-assertion sweep finished, and what finishing it turned up

`#127`,
`#180` and `#163` are all closed.
This section is the durable record of the finish,
because until it was written the gate numbers and the one real defect the sweep caught
lived only in commit messages and task descriptions,
which is precisely the state that produced the false-citation chain recorded earlier in this file.

### What landed

`9f61dc1aa` converted the last 24 throw assertions across nine test files:
`sheet-binding` 6,
`splice-slices` 5,
`select-candidate` 4,
`publish-fixed` 2,
`probe-telemetry` 2,
`bench-draw` 2,
`score-probe` 1,
`run-config` 1,
`damage-region-v2` 1.

`ab507eb76` then did the three that had been written down as named follow-ups rather than folded in
silently,
plus one absence check sitting beside them.

Gate on both,
run the same way each time:
`lint` 0 warnings 0 errors,
`lint:types` exit 0,
suite 531 PASS / 0 FAIL / exit 0,
identical to the pre-conversion baseline.

### The sweep caught one real defect, which is the whole argument for having run it

`spliceShuffledIndices` raises `SliceIndexingError`,
not `SliceSpliceError`.
`spliceSlices` delegates to `slice-indexing.ts`,
a module the test never names,
and the message-only assertion had been passing all along while the wrong class was thrown.
Nothing inside the test's own file could have revealed this:
the message matched,
and the message was all the old assertion read.

That failure doubles as the positive control the rest of the batch needed.
A wrong class does not pass quietly here,
because every error class in this package extends `Error` directly with no shared intermediate base,
so no sibling class can satisfy `toBeInstanceOf` by accident.

### Two assertions that were skipped for a property of the converter, not of themselves

`run-config:282` and `:295` assert `API_KEY_VAR`,
an identifier rather than a quoted string,
so the converter refused them by design and reported them.
They were never exceptions to the sweep's rule.
Both raise `RunConfigError`,
traced to the single `throw` in `run-config.ts`.

`publish-fixed:599` had been recorded as permanently out of scope,
because it rejects Node's `readFile` and Node raises no class of ours.
That reasoning stopped one step early.
The test claims the publisher wrote no page at all,
and a bare `.toThrow()` passes for ANY read failure,
so a page written unreadably would have satisfied a test whose name promises absence.
There is no class to assert,
so the discriminator is the code:
it now asserts `toHaveProperty('code', 'ENOENT')`.

### The runner's verdict lines count suites, not tests

Running one file and counting `] PASS ` returned 1 for `publish-fixed`,
which reads like a file that ran almost nothing.
It is not.
The runner emits one verdict per `describe` and concatenates every `it` name into that single line.
Read the names inside the line,
or read the exit code,
before concluding a run was empty.
This is `TLY` one level up:
the count disagreeing with the exit code is the count's bug.

### What is open

`#181` is the only thing the verification opened,
and it is a DECISION item rather than a fix item:
`settled-neither` ships the archive with the gate unasked,
including at a slice where the size note fired.
Three shapes are recorded on the task and none should be built before the shape is chosen.

The measurement that does not need the decision,
and which the task's own text sanctions:
how often does `settled-neither` coincide with a tripped incumbent tail across settled artifacts?
One entry gave 1 of 5 contested slices,
and one entry is not a rate.
The two readers that between them read both halves are
`~/temp/agent/163-ballots.mjs` and `~/temp/agent/163-tail-census.mjs`.

The alignment cluster,
`#68`,
`#90`,
`#91`,
`#94`,
`#98`,
`#100` and `#106`,
stays where it was.
`#98`,
`#100` and `#94` gate on `#106`,
and `#106` gates on question 28 in `doc/planning/translation-repair-open-decisions.md`.

## 2026-08-23: settled-neither measured across every ballot-carrying artifact

`#181` was opened on one slice of one entry and framed around the size note.
The measurement says the note is incidental to it,
and that the path is roughly six times more common than the note-flagged case that revealed it.

Instrument:
`~/temp/agent/181-join.mjs`,
joining `laneSelection` ballots against the archive-side ratio tail per slice,
over every artifacts directory on disk.
Enum names,
ids,
counts and ratios only.

### The base is wider than one entry

43 artifacts across 16 run directories.
Ten settlements carry ballots,
covering eight distinct entries:
`Acheron`,
`dogesir_`,
`gaoyanger`,
`keyword233`,
`lintong`,
`wangzihao980`,
`Weideriche_`,
`Zha_Ke`.
37 contested slices in total.

`Zha_Ke` does carry ballots,
which had been the open question about it.
It contributes four contested slices and no `settled-neither` at all,
so it widens the denominator rather than adding a second coincidence.

### The numbers

    contested slices carrying ballots     37
    verdicts                              lane-won 31, settled-neither 6
    incumbent ratio tail tripped           2
    BOTH                                   1

    of tripped slices, settled-neither    1 of 2
    of settled-neither slices, tripped    1 of 6

`settled-neither` is 6 of 37 contested slices,
about 16%,
and only one of those six involves a flagged incumbent.
The other five carry ordinary archive ratios,
1.31,
1.98,
2.62,
3.31 and 3.40,
all well inside the 0.8 to 10 band.

The outcome is deterministic,
6 of 6:
every `settled-neither` slice records `terminal=no-standing-text`,
`gate=not-asked`,
`shipped=unchanged`.

It is concentrated by entry.
`dogesir_` takes this path on 4 of its 9 contested slices,
44%;
`wangzihao980` on 1 of 5;
`Acheron` on 1 of 4;
the remaining five settlements never do.
A per-entry rate is therefore not the corpus rate,
and one entry can dominate it.

### The gate is not failing; nothing owns the question

Read from source rather than inferred.
`src/consolidate-driver.ts:88` lists `no-standing-text` in `SETTLED_WITHOUT_A_GATE`,
reasoning that these terminals never reached a judge
and that none of them changes on a second asking of the same slate.
`src/corpus-run/would-ship-text.ts:178` says `no-standing-text`
asks what a slate must beat and correctly answers "nothing" on a decline.
`src/corpus-run/artifact-v2-consolidate.ts:58` records that this terminal carries the empty string as its text,
because the contest chose neither lane so nothing stands.

The gate compares a consolidation against standing text,
and on this path there is no consolidation to compare.
So the gap is not in the gate.
It is that no stage owns the question "is the archive itself acceptable?"
when both candidates are rejected.
The lane ballot cannot ask it,
because `LaneChoice` is `repair`,
`translate` or `neither`
and the archive is not a candidate.
The gate does not ask it,
by the design above.
Nothing else looks.

This does not establish that the archive is wrong at any of the six slices,
only that nothing evaluated it.

### What the measurement did to the options

The option that led before the measurement,
asking the gate anyway when the incumbent trips a ratio tail,
addresses 1 of the 6 observed cases and leaves five untouched.
The measurement demoted it to last.
The full re-ranking and its reasons are on `#181`,
which stays a decision item.

### One further observation, confounded, recorded so it is not lost

`Zha_Ke` settled twice,
in `vub-run1-20260821` and `vub171-20260822`,
at identical slice sizes both times.
Slices 0 and 1 swapped terminals between the runs:
c0 `consolidated` then `gate-kept-standing`,
c1 `gate-kept-standing` then `consolidated`.
`gaoyanger` likewise settled differently in `publish-vub-20260822` and `vub-run1-20260821` at the same sizes.

This is NOT evidence of non-determinism.
The pipeline changed between those runs,
`#171`'s naturalness cache among other things,
so run identity and code identity are confounded.
What it does establish is that a gate outcome is not a stable property of an entry across pipeline versions,
so nothing should treat a recorded terminal as one.
Settling it would need the same entry re-settled twice on ONE pipeline version,
which costs a pass and has not been authorized.

## 2026-08-23: the far-longer tail is alive, and the note's own floor is why nobody saw it

This corrects two claims recorded earlier the same day,
in "2026-08-23:
#157 removed the far-longer case #163's note was built to catch"
and in the `#163` verdict beneath it.
Both said the far-longer half of the size note serves no case that still occurs.
It serves one at 185 times,
in an artifact settled after `#157` landed.

### How it surfaced, which is the part worth keeping

Checking whether `#68`'s document-scale repetition check existed turned up `src/assembly-repetition.ts`,
already built,
already wired into both assemblers,
already measured.
Reading what it had FOUND rather than whether it existed
is what led here.

`vub171-20260822`'s `Zha_Ke` artifact carries 866 `introduced-repetition` findings.
The token shape is the diagnosis:
all 866 are exactly 12 words,
archiveCount 0,
shippedCount 2.
Twelve is `MAX_PHRASE_WORDS`,
so that is one long verbatim span duplicated in a lane's assembled document,
reported once per 12-word window.

In the artifact,
`comparison` chunk 2 holds incumbent 56 characters,
source 56 characters,
and a `translateText` of 10381.
The translate lane ran away on a 56-character slice and emitted 185 times its length,
looping.

The runaway did NOT ship.
That slice settled `slate-kept-standing`,
`gate=not-asked`,
`shipped=unchanged`,
so the archive's 56 characters stood.
The instrument caught it and the downstream guard held.

### The defect

`contest-size-note.ts:162` returns the empty string when the source is under
`MIN_RATIO_SOURCE_CHARS`,
which is 80 (`displacement-ratio.ts:97`),
BEFORE it looks at any candidate.
So the judges deciding that slice were never told a candidate was 185 times its source.

`sliceImplausibility` is not floored:
it returns `target-far-longer` at 56 against 10381.
The suppression exists only in the note the judges read.

The floor's stated justification is that "a ratio over a twenty-character line reports rounding".
That holds for `target-far-shorter`.
It does not hold for `target-far-longer`,
where 56 against 10381 is a runaway,
not rounding.
One floor is applied symmetrically to a rule that needs it asymmetrically.

### Measured over every settled artifact

Instrument:
`~/temp/agent/182-floor-census.mjs`,
ids and ratios only.

    far-longer candidates across every settled artifact   40
    the note TOLD judges about                             3
    the 80-char floor SILENCED                            37

    distinct slices silenced                              11
    distinct entries                 saurikissa, Zha_Ke, zheermao101

The floor inverts the instrument.
Silenced ratios include 185.4,
137.0,
100.8,
99.1,
94.5,
69.7,
23.8 and 19.2.
The three it does report are 15.5,
15.5 and 10.1,
the three mildest in the population.
The note is quiet exactly where the evidence is strongest.

### What the earlier conclusion actually got wrong

The earlier census was not wrong about what it measured.
It compared the ARCHIVE side against the source,
grouped by artifact date,
and its numbers stand.
It was wrong about what those numbers licensed concluding:
one side of a comparison does not settle a question about both sides.
The far-longer tail had moved to the candidate side,
where that census never looked.

`#182` carries the fix shape,
its measured cost,
and the two questions still open before building.

### The floor fix, landed and verified against the shipped function

`cf1c547c7`.
`contest-size-note.ts` now applies its source-length floor to
`target-far-shorter` alone;
`target-far-longer` is reported at any original length.

GFP,
done the cheap way rather than by juggling files:
the tests import from `dist`,
so writing the new surplus case and running it BEFORE rebuilding
runs it against the pre-fix build.
It failed there with `expected '' to include 'SIZE NOTE'`,
and passes after the rebuild.
Both shortfall cases pass either way,
which is the point of an asymmetric floor.

The test that used to sit in that spot asserted silence for an 800-character rendering
of a 79-character original.
That is 10.1 times,
exactly the shape the note exists to surface,
so the suite had been pinning the defect in place.

Verified by asking the shipped `contestSizeNote` itself,
with the three labels `lane-contest-wire.ts` passes,
over every comparison row on disk (`~/temp/agent/182-verify.mjs`):

    eligible rows          267
    note fired before        6
    note fires now          23   (8.6%)

The 23 rows are 9 distinct slices across 5 entries,
`saurikissa`,
`zheermao101`,
`Zha_Ke`,
`wangzihao980` and `dogesir_`,
counted more than once because several entries were settled in more than one run directory.
`vub171-20260822`'s `Zha_Ke` chunk 2,
the 185x runaway,
is among them.

Gate:
`lint` 0 warnings 0 errors,
`lint:types` exit 0,
suite 531 PASS / 0 FAIL / exit 0,
identical to baseline.

`displacement-class.ts:361` keeps its blanket floor deliberately.
It excludes short slices from SETTING the document baseline,
which is right in both directions:
a twenty-character slice should not get to define what normal expansion is.

#### Whether the fix reaches a judge, and why no key bump was needed

Verifying `contestSizeNote` proves the function speaks.
It does not prove a judged round will carry the note,
because the lane contest caches its ballots across runs
and #163 threaded the note with an explicit no-cache-bump decision,
taken when the note moved 2 rows rather than 23.
So the fix could have been inert exactly where it matters.

It is not,
and the reason is structural rather than lucky.
`pass-entry.ts` opens every cache with `generation: pipelineDigest`,
`openNamespacedCache` (`slice-cache-namespace.ts:462`) resumes only when `cached === generation`
and calls `discardNamespace` otherwise,
and `digestPipeline` digests the executable files under `dist/final/node`.
The lane contest owns its own prefix and marker,
because `LANE_CONTEST_NAMESPACE` and `EVERY_SLICE_NAMESPACE`
both read out of `CLAIM_BY_ROLE` in `slice-cache-claims.ts:56`,
so the discard is its own files rather than another lane's.

Editing `contest-size-note.ts` changed the built bundle,
which is not inferred:
the guard test failed against the un-rebuilt `dist` and passed after the rebuild,
which is direct evidence those bytes moved.
Different bytes mean a different digest,
a different generation,
and a discarded contest cache.
The 9 newly covered slices are re-judged with the note on the next run.

THE GENERAL RULE THIS ESTABLISHES,
worth keeping for every later behaviour change:
a change to executable source needs no manual cache bump,
because the digest covers it.
A cache key bump is needed only when the INPUT to a stage changes
while the code computing it does not,
which is what #173 and #178 were about:
a window or an incumbent that the key never covered.

## 2026-08-23: the naturalness lane's auditor was blind to neighbours, and now is not

`#68`'s last open item,
closed.

`refine-slice-settle.ts` called `runIntroducedDefectProbe` with no window,
and no window was in scope anywhere in that file.
The accuracy lane's probe has had one since `#107`.
So one lane's auditor reasoned about a slice alone
while the other's reasoned about a slice in context,
and any difference between their findings could have been the lanes differing
or the windows differing,
with no reading of the numbers able to separate the two.

WHY IT MATTERS MOST FOR THIS LANE SPECIFICALLY.
The naturalness lane rewrites for fluency.
The commonest fluent rewrite of a paragraph
that repeats what the paragraph next door already said
is to drop the repetition.
Judged alone that is a deletion.
Judged with the neighbour visible it is the redundancy it was.
So the lane whose characteristic edit needs the neighbour most
was the one that never had it.

### What was threaded, and the one judgement call in it

The chain is `repair-translation.ts:541` to `refineSettledSlices`
to `runRefinePhase` to `settleRefinedSlice`.
The phase already receives `slices`,
so it computes the window itself with `neighbouringSource` and `neighbouringIncumbent`,
the same helpers the accuracy driver uses,
rather than carrying it on `RefinedSliceSettlement`,
which is the cached type and is better kept lean.

THE JUDGEMENT CALL WAS WHICH INDEX TO ADDRESS BY.
`neighbouringSource` throws on a position the entry does not have,
and the phase loop already tolerates an outcome with no prepared slice behind it:
`sourceText` and `incumbentText` both fall back rather than fail.
A window that threw where those fall back
would turn a tolerated shape into a crash.
So the window is computed only when `prepared` is present,
which means the lookup found an element,
which means the index is an integer inside the array
and neither helper can throw.

It addresses by the stamped `chunkIndex`,
like everything else in that loop.
That agrees with the position
because `document-preparation.ts:272` stamps `baseIndex: slices.length`,
a running counter over emitted slices,
so a prepared slice's stamp IS its position.

### An invariant nothing asserts, found while doing it

`refine-phase.ts` reaches its slice by `slices[outcome.chunkIndex]`,
array position indexed by a stamped value.
`repair-refine-step.ts` in the same feature builds a Map from `chunkIndex` to text
and looks up through it,
which is correct whether or not the two agree.
Two files of one feature therefore disagree about whether the identity is a position or a stamp.

Production is safe today,
measured rather than assumed:
`document-preparation.ts:272` and `seed-detection.ts:118`
both pass a running counter as `baseIndex`,
and `slice-pair.ts:288` re-indexes the one path that used to leak a section index.
`corpus-run/probe-relabel-case.ts:197` passes the PAIR index instead,
which is the shape `seed-detection.ts:106` records as having been silently wrong before.
That one is a probe rather than a production path.

Nothing asserts the invariant anywhere,
and `#99` records that `chunkIndex` does not carry one meaning across the codebase.
Recorded on `#94`,
which owns lane index contracts.

### Cache

`refineSliceKey` now covers both window sides,
labelled,
so a source-only and an incumbent-only window carrying identical text cannot share a key.
That is `#126` exactly,
which found the unlabelled version of this hazard at the accuracy key.
Absent and empty key alike,
because `introduced-defect-wire.ts:418` renders no nearby block for either,
so a document-edge slice is asked what a caller without the parameter asks.
`REFINE_CACHE_VERSION` moves to 2
for the documented reason that it moves when the probe's question moves.

DELIBERATE COST:
the next resume rebuys refinement for every cached entry.

### Gate

Written first and proven able to fail,
per GFP.
`refine-window-threading.unit.test.ts` run against the pre-fix build
failed with `expected '' to include 'ZQPREVSRC'`,
an empty window half,
which is the defect itself;
its lone-slice control passed in the same run,
so the assertion discriminates rather than always failing.
Both pass after the rebuild.

Suite 532 PASS / 0 FAIL / exit 0,
up one suite from the 531 baseline for the new file.
`lint` 0 warnings 0 errors,
`lint:types` exit 0.

Two lint findings during the work were both mine and both fixed:
an inserted block had landed between the key's TSDoc and its declaration,
and the test accumulated offsets with a spreading `reduce`.
The offsets are now found by searching the assembled document for each unique paragraph,
which cannot disagree with the text it describes the way a parallel running total can.

## 2026-08-23: one duplication reported as 866 findings, now reported as one

`#183`,
closed.
Commit `b0295583c`.

`assembly-repetition.ts` grows repeats from fixed-length windows,
longest first,
and suppresses any phrase contained in one already reported.
That rule handles shorter-inside-longer and nothing else.
Growth stops at twelve words,
so a passage longer than that spans many windows of exactly twelve,
none of which contains another,
so none suppresses any other.

### What the reporting shape was costing

Measured on `Zha_Ke` in `vub171-20260822`:
one duplicated span of about 877 words arriving as 866 findings.
That was 866 of the corpus-wide 947,
so any rate,
trend or threshold read off `introduced-repetition`
described one slice of one entry rather than the corpus.

### The rule, and why it is about occurrences rather than adjacency

Two windows are one passage when the second occurs
in exactly the places the first does,
each advanced by one word.
Adjacency alone is not evidence:
two unrelated repeated passages can abut,
and merging them would report a span the document never said.
Two unrelated repeats do not repeat in the same places,
so the occurrence test cannot join them.

### Two findings the tests turned up that the plan had not

Both were found by a test failing,
not by reading the code.

A PASSAGE SAID THREE OR MORE TIMES MAKES A SECOND ARTIFACT.
In `P P P` the join between copies occurs twice,
so the tail of one copy followed by the head of the next is itself a repeat.
Suppressing it needs the covered ranges merged into a union:
the join straddles the seam between two adjacent ranges
and is contained in neither alone.
The first attempt tested containment against single ranges and did nothing.

SUPPRESSING SUCH A SPAN OUTRIGHT TURNS ONE FINDING INTO ELEVEN.
Its pieces reappear at every shorter length,
because the containment rule can only suppress against a span it was given.
So what SUPPRESSES and what is REPORTED are two different lists.
Every span suppresses;
only spans no earlier span accounts for become findings.
That is now explicit in the code as `covering` beside `found`,
and in the returned `GrownSpan.accountedFor`.

### The re-measurement, with a positive control

Run over the same stored artifacts with the pre-fix code and then the fixed code.

The pre-fix code reproduced the recorded counts exactly,
866,
73 and 6,
which is the control:
without it a lower number afterwards would not have been evidence,
since the harness might simply have been measuring something else.

    vub171-20260822       Zha_Ke  866 -> 2
    vub-run1-20260821     Zha_Ke   73 -> 53
    readable-20260820     Zha_Ke    6 -> 6
    win107-adj-20260820   lintong   1 -> 1
    win107-panel-20260820 lintong   1 -> 1
    corpus-wide total             947 -> 63

CORRECTING THE FIRST CORRECTION MADE IN THIS SECTION,
which was wrong the other way.
That pass scanned three hardcoded run directories,
reported 945 -> 61,
and called the recorded 947 an overcount.
947 was right for the corpus;
only its per-directory split was not.
`readable-20260820` holds 6 rather than 8,
and the two unaccounted findings are one apiece
in `win107-adj-20260820` and `win107-panel-20260820`,
both on `lintong`.
Rescanned over every directory under the scratch root,
22 of which hold artifacts,
the corpus-wide figure is 947 -> 63.

Neither `lintong` finding moves,
for the same reason `readable-20260820` does not:
a lone repeat has nothing to merge with.
The fix only ever collapses a run of windows over one passage,
so a corpus with no runaway in it reads the same before and after,
which is itself the check that the change is narrow.

63 is the number to carry forward.
It describes the corpus rather than the reporting shape.
`readable-20260820` is unchanged because all six of its repeats
are shorter than the window,
so nothing merges;
`vub-run1-20260821` falls by a fifth,
which is real merging
on top of genuinely distinct short repeats.

### On exporting internals

The barrel had been withholding `wordsOf` and `countPhrases`
with a comment arguing that a barrel decides what is public.
The owner overruled that during this work:
export them and mark `@internal`.
Done,
and the new span helpers follow the same rule,
which is what let the span module get direct tests
against the built bundle the way everything else here is tested.
`@internal` is a MODIFIER tag and takes no content;
the explanation goes in prose above it.

## #184: why no runaway guard saw a 185x emission

### The classification: a gap, not a regression

Both #119 and #120 are DONE and neither regressed.
Every guard they built is structurally unable to reach this event,
for three independent reasons,
each measured rather than read off the code.

FIRST,
LENGTH.
Both repetition detectors are gated behind `MIN_CHARS_FOR_VERDICT`,
which is `MIN_WINDOWS_FOR_VERDICT * WINDOW_STRIDE`,
131072 characters.
The volume bound from #156 is 32000.
The emission was 10381 characters:
7.9 percent of the repetition bar and 32.4 percent of the volume cap.
No guard could form a verdict at all.

SECOND,
SHAPE.
The guards detect a loop,
and this is not a loop.
It is one span of 5032 characters said exactly twice,
at offsets 135 and 5188,
covering 48.5 percent of the emission,
and then the generation stopped on its own.
Every detector rests on the premise stated in `stream-recurrence-watch.ts`:
"a genuine loop never stops,
so it always crosses the bar eventually."
This one stopped.

THIRD,
PHASE,
and this is the finding worth keeping.
The ratio detector samples 64-character windows on a 32-character grid.
The duplication's period is 5053,
which is not a multiple of 32,
so the two copies never land on the same grid offsets.
Measured on the real emission:

    stride 32, the detector's own grid   323 windows, distinct 1.0000, none seen twice
    stride  1, every offset            10318 windows, distinct 0.5184, 4969 seen twice

The duplication is plainly there at stride 1 and perfectly invisible at stride 32.
Lowering the length bar would not have helped:
the detector would still have called this text healthy at any length,
because on its own sampling grid the text genuinely never repeats.

The recurrence detector misses it for a related reason of its own.
Its comment guarantees a sliding search only for periods up to 2048,
the room left in the buffer,
and its decision record accepts
"any period shorter than the buffer", 4096.
The [1024,
3072] interval in the same comment bounds something else:
the LENGTH of a back-to-back duplicated block that can produce hits.
A period of 5053 is past all three numbers,
so the earlier copy has scrolled out of the buffer before the later one arrives.

### How the probe was validated before any of that was believed

The first run reported "neither detector fires" and the positive control ALSO failed,
which under QPC means the run said nothing at all.
Two controls were added before any conclusion was drawn:
a tight loop,
which flags by recurrence at exactly 131072 characters,
and varied prose,
which stays healthy at 1173015 characters.
Only then did the null on the real text become evidence.

A second null was caught the same way.
`countPhrases` was called with `phraseWords` where the parameter is `length`,
and returned an empty map for every input,
including the document
already known to carry 871 repeated phrases.
Zero everywhere is a harness result,
not a measurement.

### One hypothesis raised and refuted

The word instrument sees the duplication clearly:
1800 words,
918 distinct 12-word phrases,
871 of them repeated.
The obvious explanation was that the two copies differ in whitespace,
so words match while characters do not.
Flattening every whitespace run to one space and re-measuring refutes it:
distinct stays at 1.0000 and no period appears.
The cause is phase,
not whitespace.

### The seam the fix needs already exists and is deliberately unused

`watchRunaway` accepts `contentCap`,
defaulted to `CONTENT_OVERRUN_CAP`.
Nothing in the pipeline passes one.
`stream-drain.ts` says so in as many words,
and gives the reason:
threading it "would mean a parameter through this function and every caller,
and the measurement says one bound clears every role by more than twice."

That rationale answers a different question than the one #184 asks.
It is about whether a ROLE that legitimately emits more should raise its own bound.
It is not about a bound relative to the SOURCE,
which is the only kind that can tell a long legitimate passage
from a 56-character line that produced 10381.

### What that settles of the four questions the task said to answer first

MID-STREAM OR AFTER:
mid-stream,
and the mechanism is already there.
The watch already counts produced characters per channel
and already accepts a per-call bound,
so a producer that knows its source length
can pass `sourceChars * limit` and nothing on the retry path changes.
That matters because #120 found six defects in the retry layer,
and this shape does not touch it.

WHAT RATIO:
`sliceImplausibility` already answers this and is already tested.
`IMPLAUSIBLE_MAX_RATIO` is 10,
the largest legitimate observed was 9.27,
and this emission is 185.4,
past the endpoint by more than eighteen times.
The predicate compares `targetChars / sourceChars` on the original,
which is exactly the comparison a producer-side bound needs.

STILL OPEN:
what happens after refusal,
and whether the multiplier
used for a live bound should equal the endpoint used for a settled judgment.
A live bound cuts a call that might still have recovered,
while the settled predicate judges finished text,
so they need not be the same number.

### The census that sets the bound

Measured over every artifact in all 22 run directories:
947 candidate emissions,
772 of them freshly produced,
each against `alignment.sourceCodePoints`,
which is the denominator a live guard has at call time.
The repair lane's slices carry no alignment record,
so this covers the translate lane only.

BY SOURCE LENGTH,
the tail is entirely a short-source effect:

    source   0..64    n=340  p50 3.31  p90 19.24  max 270.02
    source  64..128   n=379  p50 3.17  p90  4.70  max  96.13
    source 128..256   n=185  p50 2.92  p90  3.81  max  17.63
    source 256..1024  n= 43  p50 3.75  p90  4.09  max   4.36

The median barely moves,
2.92 to 3.75 across every bucket:
a correct translation is about three times its Chinese source at any length.
Only the tail moves,
and only where the denominator is small enough
for one runaway to produce an enormous quotient.

THE LEGITIMATE MAXIMUM,
taken as the largest ratio the judges actually SELECTED,
because a candidate that lost is not evidence of a legitimate size.
Among 144 shipped fresh emissions:

    270.0x  source  41  produced 11071   vub171-20260822/Zha_Ke c1
    183.2x  source  56  produced 10259   vub171-20260822/Zha_Ke c2
    136.0x  source  41  produced  5576   readable-20260820/Zha_Ke c1
    135.6x  source  41  produced  5559   vub-run1-20260821/Zha_Ke c1
     99.8x  source  56  produced  5591   vub-run1-20260821/Zha_Ke c2
     98.2x  source  56  produced  5497   readable-20260820/Zha_Ke c2
      9.4x  source 232  produced  2170   163b-verify/dogesir_ c2
      5.2x  source  64  produced   335   vub-run1-20260821/Acheron c1

Six runaways,
then a full order of magnitude of empty space,
then everything else.
The largest legitimate shipped ratio is 9.4,
which independently corroborates the 9.27 recorded in `contest-size-note.ts`
from a different census over 11 settled artifacts.
Two measurements taken different ways agree on where legitimate output stops.

### What bound that supports

Scored as `produced > max(floor, source * K)` against the shipped fresh emissions:

    floor  512  K  8   cuts 7 of 144 shipped,  44 of 772 produced
    floor  512  K 12   cuts 6 of 144 shipped,  43 of 772 produced
    floor 1024  K 16   cuts 6 of 144 shipped,  39 of 772 produced
    floor 1024  K 24   cuts 6 of 144 shipped,  32 of 772 produced
    floor 2048  K 16   cuts 6 of 144 shipped,  36 of 772 produced

Every setting from K 12 to K 24 cuts the same six,
and those six are the runaways.
The bound is insensitive across that whole range,
which is the same flat-tail argument `MAX_INCUMBENT_TO_SOURCE_RATIO` was set on.

CHOSEN:
floor 1024,
K 16.
K 16 because the codebase already carries 16 for the sibling incumbent-to-source ratio,
so the pipeline holds one number rather than two that mean nearly the same thing.
It sits above the settled endpoint of 10 on purpose:
a live cut ends a call that might still have recovered,
while `sliceImplausibility` judges text that is already finished,
so the live bound must be the looser of the two.
Floor 1024 keeps the bound away from short sources,
where three times a 22-character heading is 66 characters
and any proportional bound would be far too tight to be safe.

At that setting the recorded event is cut at 1024 characters rather than 10259,
which is where the saving is.

### Three ratio instruments already exist, and none watches production

    MAX_INCUMBENT_TO_SOURCE_RATIO  16     incumbent vs source, guards PAIRING, runs after the stage
    IMPLAUSIBLE_MAX_RATIO          10     target vs source, judges SETTLED text for the size note
    CONTENT_OVERRUN_CAP            32000  absolute, live, per call

The missing one is produced against source,
live,
per call.
That is what #184 adds,
and the three neighbours are what calibrate it.

### What happens after a refusal, settled by what already happens

No new policy is needed.
`stage-round.ts` turns any stream error into `voice: { heard: false }`,
a silence recorded for that model,
and the ensemble absorbs it.
An overrun is already handled this way,
so a source-relative cut costs the offending model its candidate for that slice and nothing else.
#88's hand-back is a different level:
it covers a slice the whole stage returned invalid,
not one voice among several.

### The fix, and where it was threaded

`produced-volume-bound.ts` holds the bound and what it rests on.
The translate producer computes `producedVolumeBound({ sourceChars })` for each slice
and hands it to the call as `maxAnswerChars`.

THREADED ALONG THE PATH `exchangeTimeoutMs` ALREADY TRAVELS,
which is what keeps this small and keeps it away from the retry layer:
producer,
`stage-quorum`,
`stage-round`,
`stage-call`,
the client,
the transport,
the drain.
Optional at every hop,
so a caller that knows nothing about its input size
is policed at the module default exactly as before.
Nothing on the retry path changed,
which matters because #120 found six defects there.

The `stream-drain.ts` comment that explained why nothing passed a bound
is rewritten in the same commit,
so the code no longer contradicts its own record.

### What the tests prove, and how they could fail

Both controls ride in one run over the same fixture:
an 8192-character answer,
well under the 32000 default so only a per-call bound can end it.

    with maxAnswerChars 2048   overrun at 2210 content chars, 4608 raw chars pulled
    with no bound named        completed, 8590 content chars, 17522 raw chars pulled

The bounded call ends having pulled a quarter of the bytes,
and the unbounded one drains the identical fixture whole,
so the refusal is the bound doing the work rather than anything about the fixture.
That case proves the LAST hop and no other.
It hands `maxAnswerChars` straight to `drainBody`,
so it says nothing about whether the producer computes a bound,
nor whether the hops between forward one.
A sentence claiming otherwise stood here and was wrong.
`#185` built the test that earns the claim
and recorded which hops each test actually pins.

GATE:
suite 536 PASS / 0 FAIL / exit 0,
`lint` 0 warnings 0 errors,
`lint:types` exit 0.

### What this does not cover

The repair lane.
Its slices carry no alignment record,
so the census could not measure a produced-to-incumbent ratio for it
and no bound is passed on its calls.
Every observed runaway was in the translate lane,
so this is a scope statement rather than a known gap,
but a repair-lane runaway would still be policed only by the absolute default.
