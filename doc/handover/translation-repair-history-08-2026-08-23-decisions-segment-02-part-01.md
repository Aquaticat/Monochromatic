# Translation repair history: 2026-08-23 decisions, segment 2

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

Waiting for a spawned run by `PID=$(pgrep -f 'some-probe'); while kill -0 "$PID"; do sleep; done`
fails two ways at once.

FIRST,
`pgrep -f` matches on the WHOLE command line,
and the agent's own `bash -c` wrapper contains
the pattern,
because the pattern is part of the command being run.
So the pgrep frequently returns
the wrapper's own pid rather than the probe's,
and the wait ends the moment that shell exits,
which
is immediately.

SECOND,
a mise task with `depends = ["build"]` spends its first half-minute building.
A pid captured
too early belongs to a transient build-phase process that exits on its own,
so the waiter reports
completion while the probe has not started.

WHAT WORKS:
wait for the real interpreter process to appear,
match it precisely,
and confirm it
before arming.

```bash
# The node process, never the wrapper: filter the agent's own shell out.
pgrep -af 'coverage-probe.mjs' | grep -v 'bash -c'
```

Then check the pid with `ps -o args= -p "$PID"` and confirm the command line is the one expected
before waiting on it.
`kill -0 "$PID"` alone proves a process exists,
never that it is the right one.

## `#106` option A: the carried verdicts are self-consistent, which is not yet an answer

Ran the coverage probe over one entry at the current wire,
`mikaela_khara`,
cap 16,
into `~/temp/agent/106-coverage`.
Sixteen block-scale verdicts persisted:
`carried` 15,
`partly-carried` 1,
zero absence votes and zero unanchored,
reproducing the recorded block-scale null on a fresh run.

Graded those verdicts with three deterministic signals,
no model in the loop.
The question option A exists to answer is whether an anchored quote RENDERS the source passage
or merely exists somewhere in the translation.

-   REUSE,
    one span offered as evidence for two different blocks: 0.
-   INVERSION,
    a later block anchored earlier in the page than an earlier one:
    0 of 15 adjacent pairs.
-   THINNESS,
    evidence short enough that it cannot be rendering its source block:
    0 of 16.
    The shortest is 2.08 English characters per source character;
    the spread runs 2.08 to 6.78.

So the degenerate failure is not what is happening here.
The evidence spans are block-sized,
distinct per block,
and walk the page in block order.

### The first version of that grader reported a finding that was not one

It keyed reuse by span and pushed the block label once per evidence quote,
but each row carries one quote per voter,
so six voters agreeing on one span registered as six offers and tripped the `length > 1` test.
Every group it printed was one block repeated.
Corrected by counting DISTINCT blocks per span,
which reads 0.

Same shape as the fabricated `neither shipped: 2` earlier in this work:
an analysis script that reports a number nobody checked it could produce correctly.
Every detector now runs a positive control on a planted case before it reads the run,
and the reuse detector additionally runs a negative control proving
within-block agreement does not trip it.

### What this does NOT establish

The controls prove the DETECTORS can fire.
They do not prove the COVERAGE PROBE can vote absence at all,
which is the actual question behind the unanimity.
A wire that never returns `absent` produces exactly this reading on a complete translation
and on a defective instrument alike,
and one entry could simply be well translated.

The control that separates them:
take a case the roster voted `carried` on,
delete THE ROSTER'S OWN EVIDENCE SPAN from the translation,
and ask again about the same source passage.
The rendering the roster pointed at is then provably gone.
Voting `carried` again,
anchored on some other span,
is the contamination hypothesis demonstrated;
flipping to absent or partial is the wire shown able to see absence,
which makes the null benign and answers `#106`.

Damage cannot be chosen without asking first:
coverage candidates are by construction the passages the aligners REFUSE to pair,
so nothing outside the roster's own answer says which target text renders them.

## `#106` ANSWERED for the block scale: the coverage wire can vote absence

Ran `coverage-control-probe` over `mikaela_khara` at the current wire,
roster of six,
118 seconds.
Three cases reached `carried` with deletable evidence and were damaged:

-   `pair 0 block 6`:
    `carried` to `absent`,
    absence votes 0 to 6,
    cut 6 spans of 112 chars.
-   `pair 0 block 7`:
    `carried` to `partly-carried`,
    absence votes 0 to 0,
    cut 6 spans of 75 chars.
-   `pair 0 block 9`:
    `carried` to `absent`,
    absence votes 0 to 5,
    cut 6 spans of 74 chars.

Two of three flipped to a unanimous or near-unanimous absence verdict
once the spans the roster itself had anchored on were deleted.

THE INSTRUMENT IS NOT BLIND.
The recorded block-scale null,
ninety-six answers with not one vote for absence,
therefore describes the translations rather than the wire.
The wire returns `absent`,
and returns it with every voice,
when the rendering is actually gone.

Read beside the deterministic grading of the same entry
(no cross-block evidence reuse,
no order inversions,
no evidence too thin to render its source),
the `carried` unanimity is benign on the measured entry:
the spans are block-sized,
distinct per block,
in document order,
and their removal is detected.

### What one case shows and what it does not

The middle case is worth keeping in view.
Deleting the anchored spans moved it to `partly-carried` with no absence votes at all,
which is what a passage partly rendered somewhere else in the page should produce.
That is the wire discriminating,
not failing:
it declined to call absent something it could still partly find.

Breadth is a separate claim.
This is one entry and three cases,
which is enough for REACHABILITY,
the question the control was built to settle,
and not enough to say the corpus carries everything.
A reachability control needs one unambiguous flip,
not a sample.

### The objection still open when this was recorded

A wire that answered `absent` after ANY deletion would produce the same flip
and would be as useless as one that never votes absence.
The middle case argues against that (a 75 character cut produced no absence votes),
but it is not a size-matched cut taken from somewhere the roster did not point at.
`coverage-control-decoy.ts` exists to make exactly that cut:
same document,
same passage,
same run,
same number of characters,
taken as late in the page as it fits so the frontmatter and title are not what gets deleted.
A sound wire keeps saying `carried` under it.

### A background waiter reported completion while the probe was still running

Third false finish in this work.
The `until ! pgrep` waiter exited immediately with an empty log
while `ps -o args=` showed the probe alive under the pid captured at launch.
Do not trust a waiter's completion notification;
confirm against `pgrep -af '<runner>.mjs' | grep -v 'bash -c'` and the pid before reading a result as final.

## `#106` option A is DONE: the wire reads the passage, so the null is about the corpus

The paired control settles the objection the first run left open.
Same entry,
same roster,
run again with both cuts made per case:

-   `pair 0 block 6`:
    targeted cut `carried` to `absent`,
    0 to 6 absence votes;
    DECOY of the same 112 characters at offset 10545:
    `carried`,
    0 absence votes.
-   `pair 0 block 7`:
    targeted `carried` to `partly-carried`,
    0 to 0;
    decoy of the same 75 characters at 10582:
    `carried`, 0.
-   `pair 0 block 9`:
    targeted `carried` to `absent`,
    0 to 5;
    decoy of the same 74 characters at 10583:
    `carried`, 0.

Absence votes appeared on two targeted cuts and on NONE of the three decoys.
The wire is not answering the damage;
it is answering the question.

### The decoy cut ordinary prose, checked rather than assumed

All three decoys land in the same tail region,
which invites the reading that they deleted a footer
the roster never cared about.
Classified the region structurally,
without printing any of it:
offset 10545 of a 10657 character page covers ONE PROSE LINE of 111 characters plus a trailing blank.
Not a heading,
not a list,
not links,
not html.
So the decoy deleted a real body sentence of comparable size and the roster still said `carried`.

### It replicated, and the path has no cache

The targeted arm returned the same three verdicts on both runs.
`coverage-stage.ts`,
`coverage-verdict.ts` and `coverage-control.ts` contain no cache of any kind,
so the second run bought its own answers.
Two independent runs agreeing on all three,
including the `partly-carried` middle case,
is the discrimination holding rather than a coin landing the same way.

### What `#106` option A now says

Four readings,
all pointing the same way on the measured entry:

-   no evidence span serves two blocks,
-   no block's evidence sits out of document order,
-   no evidence is too short to be rendering its source,
    the thinnest being 2.08 English characters
    per source character,
-   deleting a rendering is detected and deleting an equal amount of unrelated prose is not.

The block-scale null,
ninety-six answers with not one vote for absence,
is therefore a statement about the translations rather than about a wire that cannot say no.
Question 28's premise stands on measurement now instead of on an ambiguity.

STILL GATED ON THE OWNER,
unchanged:
do not wire `groupSourceFirst` into `subdivideChunkPair`,
and do not emit insertion pairs from `alignDocumentSections`.
That is a decision about what the pipeline should DO with a reachable absence verdict,
and this only establishes that the verdict is reachable.

Breadth remains the honest limit:
one entry,
three damaged cases,
sixteen graded verdicts.
Enough to settle reachability,
which needs one unambiguous flip and its negative control,
and not enough to claim the corpus carries everything.

## `#94`: its stamp-versus-position claim was stale, and the one real instance is fixed

`#94`'s 2026-08-23 addition says NOTHING ASSERTS THE INVARIANT ANYWHERE and that it holds
by the coincidence that every production caller passes a running counter.
That is wrong.
`slice-indexing.ts` already exists,
exports `assertSliceIndexing` and
`reindexSlicePair`,
and is called at `document-preparation.ts:373` and `splice-slices.ts:358`.
It has its own unit test file,
and `slice-pictures.ts` documents relying on it in three places.
So the invariant is enforced at preparation,
which is exactly where the task proposes putting it.

A consequence worth stating:
a corpus census of stamp against position over all 92 pairs reads
zero mismatches,
but that null is GUARANTEED by the assertion rather than independent of it,
since `prepareDocumentPair` would have thrown.
It is not extra evidence.

### The one path that really did stamp wrongly

`corpus-run/probe-relabel-case.ts` carved slices with `baseIndex: index`,
where `index` is the PAIR index rather than a running count of slices already carved.
Every section therefore restamped from its own number:
pair 1's first slice claimed 1,
which pair 0's second slice already held.

Measured over the first twelve corpus entries,
before and after:

-   BEFORE:
    4 of 12 entries carry duplicate stamps and a stamp that is not its position.
    `Chinatsu_Suzuki` is the worst,
    18 slices with 6 stamps duplicated and 16 off position.
-   AFTER:
    0 duplicate,
    0 non-positional.
-   Slice TEXT is byte-identical between the two on every entry,
    which is what `baseIndex` touching only `chunkIndex` predicts.

It was inert rather than wrong:
this probe finds its slice by text (`.includes(before)`)
and returns only `holder.source.text` and `holder.target.text`,
so no stamp was ever read.
That answers the task's open question about whether it reports against shifted slices.
It does not.

FIXED by stamping from the finished order through `reindexSlicePair`,
which exists for precisely this and whose own TSDoc says the preparation
must never trust the arithmetic it handed out,
and by calling `assertSliceIndexing` on the result.
This probe deliberately bypasses `prepareDocumentPair` in order to re-carve exactly what the run
carved,
so the bypass was also skipping the invariant every other slicing is held to.

GFP:
`assertSliceIndexing` was run against the pre-fix stamping of `Chinatsu_Suzuki`
and refuses it with `SliceIndexingError`,
so the guard catches the defect it now prevents.

A first attempt used a `reduce` with a spread accumulator and was rejected by
`oxc(no-accumulating-spread)`.
The rule was right:
carve,
then stamp by final position,
is both linear and the shape the codebase already had a function for.

### Process note: a file was overwritten before it was read

While building what turned out to be a duplicate of `slice-indexing.ts`,
that existing file was overwritten with `cat >` without being read first.
Recovered whole with `git checkout --` because it was committed and the worktree was clean.
The rule this breaks is to look at the target before overwriting;
the reason it cost nothing is that the tree was clean,
which is not a defence,
only luck.
Check `git status` and read the path before writing to a name that might exist.

## `#106` BREADTH: the block-scale null was a fact about ONE ENTRY, not about the wire

Ran the absence control over six entries carrying coverage candidates,
chosen off a zero-quota census of all 92 pairs which found 26 such entries.
Two clean groups came back,
and the second is the one that matters.

### Group one: damage is detected, and only the right damage

-   `mikaela_khara`:
    HELD.
    2 of 3 targeted cuts produced absence votes (6 of 6,
    5 of 6);
    the middle case moved to `partly-carried`.
    Decoys:
    0 of 3.
-   `TianqiChen666`:
    HELD.
    3 of 3 targeted (5 of 6,
    6 of 6,
    6 of 6).
    Decoys:
    0 of 3.
-   `Futajuhuacha`:
    HELD.
    3 of 3 targeted (2,
    6,
    5 votes).
    Decoys:
    0 of 3.

Across the three:
absence votes on 8 of 9 targeted cuts and on 0 of 9 equally sized cuts
taken where the roster had not pointed.

### Group two: the roster refuses to call the passage covered WITH NOTHING DAMAGED

-   `shi_Yumiaoya`:
    8 of 8 candidates.
    Seven read `absent` with 4 to 6 absence votes,
    one `split`.
-   `Aniloviraw`:
    3 of 3 read `absent`,
    5 to 6 absence votes.
-   `XingZ60`:
    4 of 4 not covered;
    section 13 `absent` with 5 votes,
    sections 12 and 14 and one block `partly-carried`.

Fifteen of fifteen undamaged candidates on those entries were NOT called covered.
Not one refusal in the whole run was an anchoring failure:
the count of `evidence-not-locatable` across all six entries is zero.

`XingZ60` also REPRODUCES its recorded section-scale verdicts:
section 12 reads `partly-carried`,
which is exactly what `#106` records for it
(0 full,
5 partial),
and section 13 reads `absent` as recorded.
Section 14 drifted from `absent` to `partly-carried` with one absence vote.

### What this changes

`#106` records,
of `mikaela_khara`,
"ninety-six answers from six models,
NOT ONE VOTE FOR ABSENCE was cast on sixteen passages the block aligner refuses to pair",
and `#100` refuses paragraph-scale landing on that evidence:
"at most one of twenty-two,
and plausibly none".

THAT WAS A FACT ABOUT ONE ENTRY.
It is not a fact about the wire,
which votes absence
near-unanimously the moment it is shown a different page,
and it is not a fact about the corpus.
`mikaela_khara` is a well translated entry whose block candidates really are covered;
`shi_Yumiaoya` and `Aniloviraw` are not,
and the same wire says so without being prompted.

So the paragraph-scale evidence base needs re-deriving over a spread of entries
before it can carry the weight `#100` puts on it.
This does NOT decide question 28 and nothing has been wired:
`groupSourceFirst` stays unwired and `alignDocumentSections` still emits no insertion pairs.

### What is NOT established

Whether those absence verdicts are CORRECT.
They could be genuine omissions or the aligner
mispairing,
and this control does not tell them apart.
The argument that they are omissions rather than merges is that a merge puts the content
somewhere in the translation,
which is what `carried` reports,
while `absent` claims it is nowhere.
That is reasoning,
not a measurement,
and checking it means reading those passages against their source.

### The instrument said "not damageable" for two opposite reasons

The first breadth run printed one line for both,
and half the entries hit it,
so half the run was unreadable.
A roster that never called a passage covered is the wire
voting absence on undamaged text,
the strongest reading available;
a quote that cannot be found in the page is an anchoring failure that says nothing about coverage.
Fixed in `02a65109f`:
every refusal now carries its reason,
the undamaged verdict and its
absence votes,
and the control no longer throws when nothing was damageable,
because a page
offering nothing to cut is a result rather than an empty run.
It still cannot HOLD on zero rows,
since holding is a claim about what damage does.

## The absence verdicts are corroborated by a signal that consults no model

The breadth run left one thing unestablished:
whether those absence verdicts are CORRECT.
A deterministic page-level measurement settles it without reading a passage.

English characters per source character,
whole page,
over all 92 pairs as `readCorpusFile` sees them:
p5 1.42,
p25 2.28,
p50 2.65,
p75 3.00,
p95 4.52.
Chinese becoming English expands,
so a page far below that band is missing content by arithmetic.

The six entries the control ran on separate completely along that ratio:

-   `shi_Yumiaoya`,
    absent on 8 of 8:
    ratio 0.37,
    the SECOND SHORTEST translation of 92.
-   `Aniloviraw`,
    absent on 3 of 3:
    ratio 1.88,
    rank 11.
-   `XingZ60`,
    not covered on 4 of 4:
    ratio 2.00,
    rank 12.
-   `Futajuhuacha`,
    HELD and carried:
    ratio 2.79,
    rank 55.
-   `mikaela_khara`,
    HELD and carried:
    ratio 3.09,
    rank 77.
-   `TianqiChen666`,
    HELD and carried:
    ratio 3.11,
    rank 80.

No overlap.
The three entries where the roster refuses to call anything covered are the three
most under-translated of the six,
at ranks 2,
11 and 12 from the short end;
the three where it calls passages carried and notices their deletion sit at 55,
77 and 80.

SO THE ROSTER IS NOT INVENTING ABSENCE.
It votes absent exactly where an independent
character count says the English cannot hold the content,
and carried where the English is
the length a full translation would be.
That is the correspondence check `#106` asked for,
obtained without a model and without
quoting a line of the corpus.

Note on two different character counts for the same entry:
`git show | wc -c` reports 9795 source and 1630 English for `shi_Yumiaoya`,
while `readCorpusFile` reports 3935 and 1458,
since the reader strips frontmatter.
The pipeline's own reader is the one used here.
Both put the entry at the extreme low end
(0.17 and 0.37 against a p5 of 1.42),
so the reading does not turn on which is used.

### What this means for option C

Question 28's option C proposes inserting only where absence is corroborated by more than the
matcher's refusal,
naming "the target document is shorter than the source by about that
section's size" as the corroboration.
Measured at PAGE scale that corroboration and option A's
model verdicts agree on all six entries.
That is evidence for A's verdicts being trustworthy,
and it is also the first evidence that C's underlying signal is real rather than tuned,
though C would still need it at SECTION scale,
where it was only ever tried on two entries.

## DECIDED 2026-08-23, delegated by the owner: what proves a passage was never translated

The owner declined question 28 as posed,
saying the standing instruction is maximum quality and
so the answer does not need them.
They are right that it was the wrong question:
it offered A through D as alternatives and three of them are not.

-   A,
    ask a roster whether the whole translation carries the passage,
    is the only one that PRODUCES an absence verdict.
    Nothing else here can.
-   C,
    require corroboration beyond the matcher's refusal,
    is a FILTER on a verdict.
    It decides nothing alone,
    and costs nothing applied to A's output.
-   B,
    fix alignment,
    improves the CANDIDATES both of the others read.
    It is upstream of the question rather than an answer to it.
-   D,
    park both landings,
    is the only genuinely exclusive option,
    and maximum quality rules it out:
    entries measured today run at 0.37 and 1.88 English
    characters per source character against a corpus median of 2.65.

DECISION:
take A as the verdict,
gate insertion on C's corroboration as well,
and land B.

-   THE COVERAGE ROSTER SUPPLIES THE VERDICT.
    It never consults the pairing,
    so the mispairings
    this question was opened over cannot reach it,
    and one mechanism answers both scales.
-   NO INSERTION WITHOUT DETERMINISTIC CORROBORATION.
    The roster must call the passage absent
    AND the page must be measurably too short to hold it.
    A false insertion duplicates text in a
    memorial page,
    which is the expensive error;
    a missed one leaves a gap the archive already had.
-   BOTH SCALES LAND.
    The case against paragraph scale,
    at most one of twenty-two and plausibly
    none,
    came entirely from `mikaela_khara`,
    which ranks 77 of 92 for completeness and was
    therefore the wrong place to learn what block candidates are made of.
    The corroboration gate is what makes paragraph scale safe:
    a merge leaves the content
    somewhere in a page of normal length,
    so a merged pair fails the length test.

This releases the wiring gate recorded on `#106`.

### Where the decision lives

`doc/decision/translation-repair-absence-verdict.md`,
which carries the reasoning and the
measurements behind it.
The summary here is a pointer;
that file is the record.

The first two attempts to write it were refused by the harness classifier,
through a shell
heredoc and through the file-writing tool.
The owner granted the permission and it landed.

### The corroboration gate is built and GFP-proven, 2026-08-23

`coverage-corroboration.ts`,
exported through `translate-barrel.ts` beside the coverage stage.
This is the half of `doc/decision/translation-repair-absence-verdict.md` that consults no model:
the roster must call a passage absent AND the page must be measurably too short to hold it.

`CORPUS_EXPANSION = 2.65` is the CORPUS MEDIAN,
re-derived in CODE POINTS over all 92 pinned
pairs,
which is what the code counts:
p5 1.42,
p25 2.28,
p50 2.65,
p75 3.00,
p95 4.52.
Code points and UTF-16 units give identical percentiles here,
so the constant is stable under
either counting.

Per-page shortfall against that median,
on the six entries the absence control ran over:

-   `shi_Yumiaoya` source 3935,
    english 1458,
    expected 10428,
    SHORT BY 8970
-   `Aniloviraw` source 879,
    english 1653,
    expected 2329,
    SHORT BY 676
-   `XingZ60` source 16733,
    english 33451,
    expected 44342,
    SHORT BY 10891
-   `Futajuhuacha` source 2282,
    english 6369,
    expected 6047,
    over by 322
-   `mikaela_khara` source 3451,
    english 10629,
    expected 9145,
    over by 1484
-   `TianqiChen666` source 2422,
    english 7530,
    expected 6418,
    over by 1112

The first three are exactly the entries where the roster refused to call any candidate covered.
The last three are exactly the entries where it called passages carried and noticed their
deletion.
NO THRESHOLD WAS FITTED:
the corpus median separates them as it stands.
This answers the objection recorded against option C,
that a threshold tuned on two entries is
a threshold tuned on nothing.

`admitWithinShortfall` spends the shortfall as a BUDGET rather than testing each candidate
alone.
A page is short by a definite amount,
and admitting candidates whose renderings would
together exceed it writes in more English than the page is missing.
On `shi_Yumiaoya`,
short by
8970 with 8 block candidates,
that is the difference between restoring a page and rewriting one.
A candidate too large is skipped and smaller later ones still admitted,
so one large candidate
cannot veto every later one.

`codePointCount` moved out of `translate-alignment.ts` into `code-points.ts` rather than being
copied.
The refusal guard and this gate both divide one of these counts by another,
and a copy
that drifted would let the two disagree about the same page while both looked right.

GFP,
each mutation built and run separately,
then restored:

-   Removing the `Math.max(0, ...)` floor fails exactly `FLOORS at zero` and `REPORTS a page of
    ordinary length as not short`,
    at -1.1 and -191.1.
    Ten others pass.
-   Removing the budget check fails exactly `ADMITS nothing into a page of ordinary length`,
    `STOPS at what the page is actually missing` and `SKIPS a passage too large`,
    each admitting
    every candidate.
    Nine others pass.
-   Counting UTF-16 units instead of code points fails exactly `COUNTS code points`,
    at 5.3
    against 2.65,
    which is precisely double:
    the surrogate pair counted twice.
    Eleven pass.

Restored,
all twelve pass.
Commit `7511369c5`.

A FIXTURE ERROR THE SUITE CAUGHT,
worth recording because it is the interesting boundary:
the
oversize candidate was first written at exactly the page's own source length,
so its rendering
cost exactly the whole budget and was ADMITTED.
That is correct behaviour,
a candidate exactly
filling the budget fits,
and the fixture rather than the code was wrong.
The fixture now uses
twice the source length and carries a comment saying why.

### `#100` landing 5 is built and GFP-proven, 2026-08-23

An untranslated section now becomes a pair the lane can WRITE into,
rather than only a finding
saying nothing could be done.
Two commits:
`a0f3210b5` for the aligner half,
`382f15f89` for the
emission half.

THE ALIGNER HALF.
The DP scan collects,
per source row,
the target COLUMNS at which that row is
skipped on an optimal path,
rather than only whether it can be skipped.
A column is a place:
skipping at column `c` means the section belongs before target unit `c`.
`InsertionAnchor` is three answers,
never a nullable index:

-   `proven`,
    no optimal alignment pairs it and every optimal alignment skips it at one place.
-   `may-pair`,
    some optimal alignment matches it against existing translation,
    so what it says
    may already be on the page and writing it in would duplicate content.
-   `several-boundaries`,
    nothing pairs it but the optimal alignments disagree about where it
    sits,
    so writing it in risks filing real content under the wrong section.

The first refusal is a DUPLICATION and the second a MISFILING.
A nullable index reports them as
the same event.

BOTH REFUSING ARMS ARE MEASURED REACHABLE,
not defensive:

-   `['Whiskers', 'Mittens', 'Boots']` against `['Sunbeam']` yields `may-pair` on all three.
-   `['Whiskers', 'Mittens', 'Whiskers']` against `['Whiskers']` yields boundaries `[0, 1]` on the
    orphan,
    since which side of the one surviving translation it belongs to is undetermined.

The DP fill and scan moved to `align-headings-optimal.ts`;
`align-headings-forced.ts` was at 283
of its 300 code lines.

THE EMISSION HALF applies the corroboration gate at chunking,
where both whole texts are in hand.
Measured on ONE fixture pair differing only in translation length:

-   at 1.17 English characters per source character,
    the missing section is anchored at offset
    106,
    which is exactly where its following heading `## Paws` begins;
-   at 4.16,
    the identical gap is refused as `page-not-short`.

Four named refusals,
since they want opposite remedies:
`may-pair`,
`several-boundaries`,
`page-not-short`,
`beyond-shortfall`.

A DEFECT FOUND IN MY OWN GATE while writing it:
`pageIsShort` was first derived as
`admitted.size > 0`,
which reads "the page is not short" whenever the FIRST candidate exceeds the
whole shortfall,
even though the page is genuinely short.
That is the same two-meanings collapse
the refusal union exists to prevent,
reintroduced by the code filling it in.
It now measures
`pageShortfall` directly.

GFP,
each mutation built and run separately,
then restored:

-   Removing the size signature fails exactly `REFUSES THE SAME MISSING SECTION when the page is
    not short`.
-   Removing the alignment signature fails exactly `NAMES WHY IT REFUSED`,
    and also trips the
    pre-existing `REFUSES sections it cannot pair rather than merging them proportionally`,
    so two
    independent guards catch it.
-   Anchoring at the following section's END rather than its START fails exactly `ANCHORS A
    MISSING SECTION FOR INSERTION`,
    which proves the offset assertion is real rather than
    trivially satisfied.

Restored,
all cases pass.

WHAT LANDING 5 DELIBERATELY DOES NOT DO.
An entirely untranslated page still short-circuits
before the aligner reaches it and gets no anchors.
That path needs an explicit body-insertion
boundary and must not default to offset zero,
since front matter may occupy it.
The aligner
itself already answers this case correctly,
proving column 0 for every section of an empty
target;
what is missing is the offset that column 0 means in a document with front matter.

A FIXTURE LESSON worth keeping:
the first attempt used Chinese headings with English
translations sharing no characters,
and the aligner correctly refused all of them as ambiguous,
so no insertion could be reached at all.
The insertion path is only exercisable on the `XingZ60`
shape,
headings carrying romanised names,
because that is the only shape where the aligner has
evidence to anchor on.
That is a property of the corpus,
not of the fixture.

### `#100` landing 4 core is built and GFP-proven, 2026-08-23

Commit `59d8a304e`.
A run of original blocks the translation never rendered becomes its own
INSERTION slice carrying the offset its rendering belongs at,
instead of being folded into a
neighbouring run.

WHY THE FOLD WAS WORSE THAN LOSSY.
A run's text is cut from its first offset to its last,
so
folding those blocks into a neighbour put them INSIDE that slice's span.
No later stage could
then tell a missing passage from part of the passage beside it,
and nothing downstream could
undo it.
Measured on a four-paragraph fixture whose translation drops the third:

-   before:
    one slice,
    source `[0,45)`,
    covering the untranslated paragraph inside it;
-   after:
    `[0,21)` paired,
    `[23,34)` INSERTION at target offset 66,
    `[36,45)` paired.

Offset 66 is exactly where the next rendered block begins.
`assertSliceIndexing` passes.

THE WALK CAN NAME THE PLACE,
unlike the heading aligner.
It is monotone by construction,
so its
steps ARE the cursor:
the anchor is simply where the block sits,
before the next rendered block
or after the last one at the tail.
`align-headings-optimal.ts` had to recover the same fact from
a DP table because the heading aligner emits one decision per source row and then every unclaimed
target row,
carrying no cursor at all.

THREE GUARDS,
each shown necessary by a test that fails without it rather than by argument:

-   A MERGE IS NOT AN OMISSION.
    Two originals rendered as one block arrive as a pairing plus a
    `continuesPairing` step,
    and the second IS on the page.
    Same predicate
    `declined-target-runs.ts` already uses,
    kept identical so two readings of "unplaced" cannot
    drift apart.
-   THE SCORER MAY NOT PROPOSE INSERTIONS.
    It scores kind,
    script-neutral tokens and length;
    facing four originals rendered as one block it emits one pairing and three bare `source-only`
    steps,
    indistinguishable from three originals nobody translated.
    THIS WAS FOUND BY A TEST,
    not predicted:
    the existing "never emits a run empty on one side" case failed,
    and the cause
    was the scorer's walk being read as absence.
-   A PAIRING THAT PLACED NOTHING makes no original absent.
    Without this guard every original read
    as unplaced,
    the unclaimed translation blocks had no run left to fold into,
    and they were
    DROPPED.
    That is the silent section loss the merge function's own comment records (10 of 920
    randomised pairings lost a section),
    reintroduced by my change and caught by the test that
    was left behind for it.

GFP,
each mutation built and run separately then restored,
each failing exactly one case:

-   merge guard removed:
    `NEVER PROPOSES AN INSERTION FOR A MERGE`
-   scorer guard removed:
    `never emits a run empty on one side`
-   nothing-paired guard removed:
    `KEEPS a section whose every run came out one-sided`
-   anchor reading backwards:
    `GIVES AN ORIGINAL NOTHING RENDERED ITS OWN RUN`

Two existing tests were pinning the old contract and now state the new one.

WHAT LANDING 4 STILL OWES:
the corroboration gate at BLOCK scale.
Section scale applies it in
`chunk-insertion.ts`,
where the whole page is in hand;
subdivision runs per section,
so the page
shortfall has to be spent as a budget across the whole document in document order.
The natural
place is the driver,
which already supports an insertion slice producing nothing:
landing 3 records an unfilled passage per slice rather than losing the entry.
Until that lands,
a block-scale insertion is proposed on the pairing roster's verdict alone.

The remaining hardening steps of the recorded algorithm (crossing refusal for an `A, B, A`
ownership sequence,
many-to-one ownership resolution,
materializing a target interval by complete
indices rather than by filtering) are separable from this core and unbuilt.

### Landing 4's corroboration gate landed too, 2026-08-23

Commit `d8f4ca002`.
A block-scale insertion now needs both signatures,
the same rule section
scale already obeys.

ONE BUDGET FOR THE WHOLE PAGE,
computed once in the driver rather than inside subdivision.
The
shortfall is a property of the page;
subdivision runs per section,
so spending the page shortfall
once per section would admit several times what the page is actually missing.
