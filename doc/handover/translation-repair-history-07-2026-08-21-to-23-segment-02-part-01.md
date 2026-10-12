# Translation repair history: 2026-08-21 to 2026-08-23, segment 2, part 01

Part 01 of [Translation repair history: 2026-08-21 to 2026-08-23, segment 2](translation-repair-history-07-2026-08-21-to-23-segment-02.md),
whose index lists every part in order.

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
