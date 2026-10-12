# Translation repair history: 2026-08-21 to 2026-08-23, part 02

Part 02 of [Translation repair history: 2026-08-21 to 2026-08-23](translation-repair-history-07-2026-08-21-to-23-segment-01-part-01.md),
whose index lists every part in order.

## 2026-08-22, still later: `#163`'s estimator was chosen by measurement, and the floor it implied was refuted

Three things were settled here,
all at zero quota,
because deterministic pairing
is pure local computation and the question is about the ESTIMATOR rather than
about the pairing.

### The exclusion is not circular, which the source had to say

`displacement-class.ts` computes its baseline over slices that are class
`translated` and at least `MIN_RATIO_SOURCE_CHARS` long,
then derives both
`residual` and the high-slice flags FROM that baseline (`slice.ratio >=
baseline.expansion * HIGH_FACTOR`).
So excluding `highIndices` from the baseline would be circular and would need a
fixpoint.

The contamination actually measured is a different set.
It uses the absolute predicates:
block disparity above one,
ratio below 0.8,
or
ratio above 10.
None of them reads a baseline,
so excluding what they flag is a plain filter and
terminates in one pass.
This distinction decides the design and is the reason the guard can be written
at all.

### The centre should be a median, measured on 89 entries

The shipped estimator is a POOLED ratio,
the sum of translated characters over
the sum of original characters,
so the longest slices decide it.
That is why `Zha_Ke` reads 16.85 at document aggregate,
and why the
minimum-length filter had to be added.

Scored by how far each centre moves when the flagged slices are removed,
over
the 22 entries that carry contamination:

-   pooled:
    median move 0.168,
    seven documents change baseline source
-   median of per-slice ratios:
    median move 0.086,
    two documents change baseline source

The median is about half as sensitive and flips its fallback decision two times
instead of seven.
It also leaves 82 of 89 documents able to trust their own expansion,
against 80
for the pooled ratio.

Switching from shipped (pooled,
uncleaned) to proposed (median,
cleaned) moves 7
of 89 documents across the document/corpus-reference boundary,
five of them
gaining a document-specific baseline they were previously denied.
Median baseline shift is 0.110.

### The minimum-count floor was proposed, measured, and refuted

Instability falls monotonically with the number of clean eligible slices:
median
move 0.334 at one to three slices,
0.271 at four to six,
0.132 at seven to
twelve,
and 0.017 at thirteen or more.
That reads as an argument for refusing a document its own baseline when it has
too few slices.

It is wrong,
and the split-half probe says why.
Splitting each document's clean slices into alternating halves and comparing the
two centres estimates the estimator's own noise without needing a ground truth
the corpus does not have.
Against that,
the corpus reference costs whatever `|own - 2.86|` is.

-   two to three slices:
    own error 0.315,
    reference error 0.605
-   four to five:
    0.164 against 0.583
-   six to eight:
    0.243 against 0.333
-   nine to twelve:
    0.165 against 0.240
-   thirteen or more:
    0.092 against 0.215

The document's own centre wins at EVERY count,
and 60 to 70 percent of
individual documents are better served by it in every band.
Thin documents are noisy,
but 2.86 is more wrong than they are,
so a floor would
trade a noisy estimate for a biased one.
No floor is added.

### What is not yet settled

The calibration NUMBERS still wait on the roster sweep,
which is ordered by
baseline exposure and so has delivered its high-exposure head first.
Band and tail endpoints must not be read off a partial prefix.

The sweep does NOT pass a `pairingCache`,
so its roster pairings are not
persisted and re-reading them would re-buy every round.
Any later probe that needs roster-paired per-slice numbers has to be folded into
a sweep that caches,
rather than run beside this one.

### The false-citation section was itself false, measured from the transcript

Earlier revisions of this section claimed advisor guidance in this session was
never obtained,
then corrected that claim four times,
each correction replacing
one attribution with another.
All of it was wrong,
in the same direction,
and the primary record settles it.

Measured 2026-08-22 from the session transcript at
`/home/user/.claude/projects/-var-home-user-Monochromatic/e94557c6-4127-423c-9303-371e578fb92f.jsonl`,
214701 lines,
reading counts and line numbers only because that file carries
corpus passages.
It holds 254 advisor calls.

THE CAUSE IS A CONTENT BLOCK TYPE.
`advisor` is recorded as a
`server_tool_use` block,
never a `tool_use` block.
An enumeration that walks `tool_use` blocks therefore reports zero advisor
calls for a transcript holding 254,
while reporting every other tool
truthfully.
That is exactly the shape of the claim each correction rested on:
"only Bash,
`ToolSearch` and `TaskUpdate` were called".

POSITIVE CONTROL,
and the reason this is cause rather than theory:
the probe
that found it made the same mistake first,
filtering `.type=="tool_use"` and
returning 0 against a file it then reported 254 for under
`.type=="server_tool_use"`.
Same file,
same session,
two filters,
and only the second one can see the call
type in question.
The null was an artefact of the filter,
not a fact about the session.

WHY SUMMARIES KEEP LOSING THEM.
Advisor calls cluster immediately before
compaction.
Across the 105 compaction boundaries that have a preceding call,
the median gap
is 24 lines and 61 percent sit within 25 lines of the cut.
The guidance places a call where work completes,
and compaction cuts where work
completes,
so the call most likely to fall outside a summary is the one whose
findings the next segment is about to act on.

WHAT THE COMMITS ACTUALLY FACED,
counted as advisor calls preceding the line
where each commit first appears:

-   `d79d999c3`,
    the first correction:
    248 before it,
    nearest 198 lines back.
-   `39108d02c`,
    Commit A of `#163`:
    248 before it,
    nearest 915 lines back.
-   `81f2a9173`,
    the second correction:
    249 before it,
    nearest 74 lines back.
-   `2008ccc17`,
    opening Commit B:
    250 before it,
    nearest 316 lines back.
-   `0c19e2461`,
    the third correction:
    251 before it,
    nearest 219 lines back.
-   `8a83da109`:
    253 before it,
    nearest 53 lines back.

So "no advisor call preceded the `#163` guard" and "no advisor call preceded
Commit B either" are both false,
and the sentences they were written to correct
were true when first written.
The four corrections each deleted a true attribution.

THE STANDING RULE,
REPLACING THE ONE THIS SECTION USED TO CARRY.
The old rule
said never to write that an advisor said anything unless that call appears in
the current transcript.
That rule produced the four false corrections,
because a compacted transcript
does not show the call and the summary standing in for it cannot see the block
type.
Replace it with:

-   A summary's tool inventory is not evidence of absence.
    It enumerates
    `tool_use` blocks,
    and `advisor` is not one of those.
-   To settle whether a call happened,
    read the jsonl and count
    `server_tool_use` blocks named `advisor`.
    Counts and line numbers only:
    that file carries corpus passages.
-   Occurrence and wording are separate claims.
    A summary that dropped a call
    also dropped what it said,
    so an attribution written after a compaction can
    be right that the call happened and wrong about its content.
    Check the
    second the hard way,
    by what the surrounding work could not have produced
    alone.
-   Corrections stay recorded rather than amended away,
    because the false
    sentences were pushed and a reader of the history would otherwise carry
    them forward.
    That part of the old rule survives,
    and this section is
    itself an instance of it.

The advisor call at transcript line 213023,
219 lines before `0c19e2461`,
produced three findings about how the `#163` boundary verification could
quietly fail rather than about the note itself:

-   A cache hit at a tail slice would replay a ballot cast BEFORE the note
    existed,
    so the verification would read pre-note judges while crediting the
    outcome to the note.
    `laneContestRunShape` covers `modelIds` and
    `identityContext`,
    never policy text,
    and a repair-unchanged candidate is
    byte-identical to the archive across runs,
    so the collision is plausible
    rather than theoretical.
    RESOLVED:
    the store is `slice-cache/` INSIDE
    `TRANSLATION_REPAIR_RUNS_DIR`,
    so a throwaway runs dir is fresh by
    construction and every ballot this run reads it also wrote.
-   The tails must reproduce before ballots mean anything.
    If the repair lane
    changes `dogesir_#3` this time instead of returning the archive,
    no note
    fires and the run verifies nothing,
    which is a finding to record rather
    than a failed verification.
-   Running a `//package/module/translation-repair` mise task that BUILDS,
    while a pass is live,
    can destroy it.
    rolldown names chunks by content
    hash and the runner's stage chunks load on demand,
    so a rebuild can delete
    a chunk the live process has not yet imported.

    NARROWED BY MEASUREMENT AFTERWARDS,
    and this refinement outranks the
    sentence above it,
    which was stated broadly enough to cover every task in
    the package.
    `lint` and `lint:types` are LEAF tasks with no `depends`,
    so both are safe during a live pass,
    and `lint` writes only
    `dist/final/types/tsconfig.tsbuildinfo`,
    never a node chunk.
    Confirmed by
    reading the package `mise.toml` and by `mise tasks deps` against a positive
    control:
    `corpus-pass`,
    which declares `depends = ["build"]`,
    does print it,
    so an empty result for `lint` is a real absence rather than a broken probe.
    `test:unit` declares no `depends` either,
    which is why `buildAndTest`
    exists to sequence them:
    it does not rebuild,
    so running it against a stale
    `dist` passes vacuously rather than testing what was just edited.

    Editing `src/` mid-pass is safe:
    the generation stamp is a digest over
    `dist/final/node`,
    and never reads source.

## 2026-08-22, sweep complete: production pairing never manufactures a flag, and contamination outlives it

All 29 flagged entries were re-paired with the production roster,
the same six
voices a pass asks,
and none refused.
These are whole-population numbers,
so they can be read as final;
the earlier
partial-prefix figures in this file cannot,
since the sweep was ordered by
baseline exposure and delivered its high-exposure head first.

### Pairing quality is worth about a third of the flags

Deterministic pairing against production roster pairing,
summed over the 29:

-   slices 643 to 632
-   flagged 64 to 40
-   eligible 425 to 430
-   contaminating 36 to 35
-   fallback 218 to 202

So roughly 38 percent of the flags measured under deterministic pairing were
artefacts of the pairing rather than displacement in the document.

### Production pairing never ADDS a flag, which settles the open question

Seventeen entries lose flags,
twelve are unchanged,
and **no entry gains one**.
The question recorded earlier,
whether the 63 entries the sweep never re-paired
might sprout flags under roster pairing,
is answered in the direction that
matters:
roster pairing is uniformly equal or better at not manufacturing flags,
so the unswept entries cannot be hiding flags that only production pairing
would raise.

That is evidence about FLAG COUNT only.
It says nothing about whether an unswept entry's baseline moves,
so a false-fire
sample after the guard lands is still owed.

### Contamination is not fixed by better pairing

The total barely moves,
36 to 35,
and that near-equality is OFFSETTING rather
than stable:

-   five entries gain contaminating slices:
    `shihai4h` 1 to 2,
    `windward0032` 2
    to 6,
    `interrgned` 1 to 2,
    `cheonwoomaeng` 0 to 1,
    `lintong` 0 to 1
-   eight lose them:
    `zheermao101`,
    `gqt`,
    `Futajuhuacha`,
    `MizuharaNagisa`,
    `dogesir_`,
    `XingZ60`,
    `Huasheng`,
    `MeowBot233`

Nineteen of 29 entries still carry contamination under production pairing.
Reporting the total as unchanged would be wrong twice over:
it is not unchanged,
and the entries beneath it move in both directions.

This is the finding the guard rests on.
Better pairing removes flags that were never real,
and leaves the ones that are,
so the slices that survive must still be kept out of the baseline they would
otherwise define.

### The band is not what refuses documents

Under production pairing,
24 of 29 documents trust their own expansion,
and
those baselines run from 1.962 to 3.785,
median 2.970,
quartiles 2.431 and
3.166.
Every one of them sits inside `PLAUSIBLE_BASELINE_MIN` to
`PLAUSIBLE_BASELINE_MAX`,
so the band is not the thing turning documents away.
Six documents change baseline source between the two pairings,
three each way.

### What the guard now has to do

1.  Exclude flagged slices from baseline-setting.
    Non-circular,
    since the
    absolute predicates never read a baseline.
2.  Take the centre as a median of per-slice ratios rather than the pooled
    ratio,
    which the longest slices decide.
3.  Add no minimum-count floor,
    which was measured and refuted.
4.  Feed a named fault in `contest-ballot-wire.ts`,
    following the mechanism
    `#155` established,
    because `translate-validate.ts` and
    `consolidate-validity-floor.ts` are both size-blind and `#155` covers only
    the silent-original direction.
