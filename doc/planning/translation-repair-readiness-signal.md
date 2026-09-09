# Translation repair: the production readiness signal, and what it rests on

Proposal for the owner,
written 2026-08-26 ahead of the `AskUserQuestion` call that `#219` prescribes.
The signal is the owner's cue to disable branch protection temporarily so the corpus text committed along
the way can be sanitized (`doc/handover/translation-repair.md`,
"Corpus exposure is not a blocker").
This document is the evidence behind the question and the decisions the question bundles apart.

## What "ready" rests on

-   The whole-package audit (`#236`) is closed on a measured tally:
    every register entry carries a FIXED,
    CLOSED,
    folded or tracked marker,
    3 BLOCKER,
    28 MAJOR,
    35 MINOR (`doc/audit/translation-repair-package-audit.md`,
    "Closing tally").
-   Every MAJOR (`#237` to `#257`) and every MINOR group landed with a guard shown to fail when its fix is removed.
-   Whole-suite `buildAndTest` after `4c070f729`:
    819 PASS,
    0 FAIL,
    exit 0.
-   All 38 built commands a `mise.toml` task invokes carry their `import.meta.main` guard (measured,
    not assumed).
-   The provider resilience the owner asked for is verified live:
    both keys are required,
    a half-dark roster is loud (`SEAT` lines end every command),
    and the two calibration arms of 2026-08-26 ran the full ten-model roster with 304 and 302 of 312 voices heard.
-   The three measurements the queue held open are paid:
    `#213` (overlap),
    `#230` (recovery rate:
    3 of 4 re-asked answers came back) and `#229` lever 1 (arm C,
    below).

## What is known and not done

-   Guards recorded as owed inside FIXED blocks are proven by the type check or by measurement rather than by
    a mutation:
    repair-8's typography half,
    consolidate-5,
    probes-10 and probes-11,
    calibrate-5 and calibrate-8,
    repair-2,
    document-11,
    slices-5 and slices-8.
    They are coverage debts,
    not defects,
    and each entry says so.
-   The straggler window decision (`doc/decision/translation-repair-straggler-grace.md`) stands at 180000 ms;
    arm C is read and the move is the owner's call (question 4).

## Sanitization inventory

-   Tracked tree,
    measured 2026-08-26 with the standalone scanner against the built deny-list of 10206 corpus
    sentences (`~/temp/agent/deny-rules.txt`,
    from `doc/decision/corpus-deny-list-for-forbidden-strings.md`):
    zero findings over the whole worktree walk.
    The probe was proven able to fire first:
    one rule written into a throwaway file fired as `rule=0` both when
    named explicitly and through the same `--all` walk from inside the worktree.
    The deny-list subtracted the 8 corpus sentences the tree already held on 2026-08-25,
    so the zero means no further sentence of 24 or more characters has entered the tracked tree since.
-   History:
    the branch carries 2342 commits beyond `main` (merge base `88ba0ae2e`,
    first commit 2026-07-16),
    and `main` carries 657 the branch lacks.
    Corpus text quoted in earlier commits and later removed lives only in that history.
-   Outside the repository,
    corpus-bearing and never committed:
    run directories under `~/temp/agent/` and `~/translation-repair-runs-*`,
    including `<runs dir>/rendering-audit-settled/*.json` (document spans and model prose in every row's `report`),
    calibration logs,
    and the deny-list itself.

## The decisions the question keeps apart

Each is its own question,
because answering "yes" to all of them in order must be reachable.

1.  Readiness:
disable branch protection now and sanitize,
or name what is still missing.
2.  Calibration overlap default:
`TRANSLATION_REPAIR_SLICE_OVERLAP` stays opt-in at 1,
or the editor calibration defaults to overlapping slices (only `editor-calibrate` carries the dial today;
    `producer-calibrate` gets the same dial as follow-up work if the default moves).
    Measured on matched arms:
    overlap 4 ran the same 1.74 h of calls in 24.19 min instead of 43.19,
    voices 302 against 304 of 312 (one run per arm;
    the run-to-run band is unmeasured).
3.  Corpus pass slice overlap:
the pass's drivers run slices sequentially by a recorded rationale (`lane-contest-driver.ts`:
    "the client's limiter grants one stream per model,
    so contesting two slices at once queues behind the same slot rather than doubling throughput";
    `translate-document.ts`:
    "aggregate concurrency beyond one stream per model collapses throughput on this plan").
    The calibration arms contradict the first premise under the same limiter,
    and the second predates the multi-provider routing.
    Building the dial into the pass is a design change;
    the proposal is to measure it on the pass the same way before any default moves.
4.  Straggler window:
keep 180000 ms or move it.
Measured on arm C (overlap 1,
300000 ms,
the same four slices) against arm A (overlap 1,
    180000 ms):
    53.87 min against 43.19 (+24.7%),
    voices never heard 5 against 8,
    grace cuts 4 against 6,
    all `qwen3.8-max`.
    Two rounds spent 214 s and 263 s in grace,
    the two voices the longer window bought back;
    four rounds burned the full 300 s and were cut anyway.
    About 5.3 min of wall clock per voice bought while slices run one at a time;
    under overlap the wait is what overlap fills,
    so a longer window under overlap 4 is the unrun arm that would reprice it.

## The owner's answers (2026-08-26)

1.  Readiness:
"Not yet.
You didn't even look at its actual output."
The signal rested on process gates;
    the output itself,
    the published pages and the shipped text,
    had not been read.
    That reading comes first,
    and readiness is not claimed again until it is recorded.
2.  Overlap default:
measure the run-to-run band first,
by repeating arm A.
DECIDED later the same day,
on arms A2 and D:
    `editor-calibrate` defaults to overlap 4.
3.  Pass overlap:
build the dial into the pass and measure it there;
the default stays 1 until measured.
4.  Window:
run arm D (overlap 4 at 300000 ms) before moving it.
DECIDED later the same day,
on arm D:
the calibration runs under 300000 ms together with overlap 4;
    the pass keeps 180000 ms until `#261`.
    Record:
    `doc/decision/translation-repair-calibration-overlap.md`.

## Since the answers (2026-08-26, updated the same day)

WHAT THE REJECTION CHANGED.
The signal had rested on process gates;
the deliverable is the published page,
and none had been read by the session that put the signal.
`#259` opened as the gate that now precedes any re-signal:
read pages against source and archive,
trace every defect into the artifact (slice,
lane,
ballots) before filing it,
and have a second reader (sol,
whole files attached) read each page too.
The advisor checkpoint on that plan (16:00Z) added the hard entries this project's own history names (`Toka_ls`,
`XIEPT2`,
`XingZ60`) to the sample,
since eight short entries answer only whether the output is publishable on easy input.

WHAT THE FIRST READING FOUND,
on four older-build pages (`doc/audit/translation-repair-output-reading-20260826.md`):
six defect classes no gate measured.
Three became code that is landed in source and awaits the build the running arms forbid:
`#263` (a refiner that answered every ask reported as silent;
recurred on arm A2 on two seats),
`#264` (invisible-variant punctuation,
U+2011 for the hyphen,
folded at every lane's intake;
U+2019 measured as the archive's own convention and kept),
`#265` (a source hyperlink absent from the page,
now a `DESTINATIONS` line per entry with the addresses in the run log).
The other three (name rendering where the source uses an alias,
lexical ambiguity introduced by a change,
coverage misdiagnosis) are recorded in the reading and re-read on the fresh pass before anything is built for them.

WHAT THE MEASUREMENTS SAID.
Arm A2 (`#260`) put the run-to-run band at 37% of wall clock on an unchanged build,
driven by provider speed (stream sum 9294 s against 6312 s).
Normalized as wall clock over stream sum:
A 0.41,
A2 0.38,
C 0.43,
B 0.23.
So question 2's overlap effect stands (six bands wide) and question 4's
window cost is unmeasured at this scale rather than the +24.7% one pair of runs suggested.
Arm D (`#262`) is running as this is written.
Question 3's dial is designed (`#261`) and waits for the fresh pass to launch,
because the pass task builds what it runs and a driver edit present at launch would ship into the reading.

WHAT COMES BEFORE ANY RE-SIGNAL,
in order:
arm D read;
whole suite and the guard-failure rounds on the three landings;
the fresh pass at production defaults over ten entries (`XingZ60` second);
each page read twice and traced;
a spot re-read on the fixed build if the reading finds publishability blockers;
then this document gains a section that says what the pages showed,
and `#219` is put again.
## The owner's words on the goal, 2026-09-04

Asked when a supervised sweep over all 92 entries should launch,
the owner answered:

> We never ever need a all 92 entries launch.
> If you believe it's ready for all 92 entries launch after reading the artifacts,
> that means we had reached the goal of making it production ready.

So the deliverable is the pipeline's readiness,
judged by reading its artifacts and pages,
and no 92-entry sweep is planned or budgeted.
The 2026-09-03 OpenRouter budget arithmetic that priced such a sweep in
[`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
is an upper bound on what the corpus would cost if it were ever run,
not a plan.
The readiness signal is put when a reading of the artifacts would let the sweep launch,
whether or not it does.

## What the 2026-09-04 pages showed

Six passes settled and verified 1 of 1 each,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under its 2026-09-04 sections:
Toka_ls on Synthetic plus OpenRouter in 81 minutes and 3.56 USD,
then Hangmster,
BI4PBV twice,
and two keyword233 arms,
about 8.6 USD in all.
The R3 order runs end to end on OpenRouter alone,
the Kimi-K3 withhold held through every stage including the picture readers,
the spend ceiling fired live at zero,
and the Toka_ls re-read in
[`translation-repair-toka-ls-reading-2026-09-02.md`](translation-repair-toka-ls-reading-2026-09-02.md)
finds every 2026-09-02 finding fixed or consistent with a decision since.

WHAT THE SAME READING FOUND THAT NO GATE HAD:
three defects,
each fixed the same day with a guard shown to fail neutralised,
and each a shape the corpus carries beyond the entry that showed it.

-   The photo reference reader took single-quoted paths only;
    four source pages double-quote theirs.
    The first BI4PBV pass read no pictures and logged nothing about it,
    fixed in `5e013d24b` and `4ff42e627`.
-   The semantic wrapper split a one-line `PhotoScroll` element before its `/>` on the shipped Hangmster
    page;
    sixteen source-page elements across eleven entries share the comma-and-space shape,
    fixed in `66345a092`,
    in markdown-lint.
-   OpenRouter's ModelRun endpoint timed out one MiniMax M3 call in five and the client called each a
    cut-off reply;
    at least five voices were lost after the ladder's five attempts.
    `f17feba12` names the failure.
    The seat question is the owner's,
    since ModelRun is the model's only zero-data-retention endpoint for a schema request.

THE READING I PUT ON THAT,
as the owner asked for a belief rather than a gate:
not yet ready for a launch over the whole corpus.
Not because any pass failed,
but because three of six passes over four entries each surfaced a defect class the earlier readings had not,
and the corpus's variety has been sampled at two picture-bearing entries.
That variety is four entries with one quoting,
eleven with another spelling,
and fifty with pictures.
The rate of new findings per pass is what has to fall before the belief is honest.
What would make it fall:
one pass each over an entry with double-quoted paths that the fix has not yet run on,
`yulianNyanner` or `Arita` or `MTF_0615`,
and one with the comma-shaped one-line element,
both read the same way;
the ModelRun seat decided,
which it now is:
the catalog ignores `modelrun` and `parasail` for MiniMax M3 since `d55d83082`,
and CoreWeave serves it alone under zero data retention,
4 of 4 conformant at a third of ModelRun's price;
and the picture gather's straggler wait re-read once those passes have run three-reader pictures.
That re-read is done,
recorded in the planning log under "The picture gather's wait":
the gather has no window,
the normal spread between first and last reader is 11.6 seconds at the median,
and the one case worth a window cost six minutes on a single picture.
Each of those is a pass and a reading,
not a build.

## What the luxuanwen3 re-run of 2026-09-04 showed

Run on the containment and withheld-standing build `592562992`,
OpenRouter alone,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under its luxuanwen3 re-run section of 2026-09-04.
Two of the morning's fixes held:
the archive-shaped front matter passed every gate,
and the withheld-standing rule stopped the entry at the first slice nothing valid could fill,
34 minutes and 2.01 USD in,
where the pass before had run 63 minutes to the page guard.

WHAT IT FOUND:
a fourth defect class of the day,
and the first one the corpus carries in eight entries that no pass had touched.
Where the archive rewrote a link destination,
`twitter.com` to `x.com` here and Chinese Wikipedia to English Wikipedia in two others,
the deterministic floor owed both URLs,
so the archive's own paragraph was ineligible and no candidate could pass.
Behind it,
a scheduler defect:
the deterministic refusal was classed resumable and the pass reattempted the entry at once.
Both are recorded there;
the destination rule is the owner's decision,
asked 2026-09-04,
and the reattempt is fixed.

THE READING:
unchanged,
not yet ready,
and the reason is sharper.
The rate of new classes per pass has not fallen:
this pass found one in a shape the census can enumerate,
8 of 93 entries,
which means the next passes should be chosen by census rather than by convenience.
What would move the belief now:
the destination rule decided and luxuanwen3 shipped under it;
one pass over a second entry from the census read the same way,
shihai4h or the Wikipedia shape SS3B_0016;
then the two passes the preceding section asked for.

## What the luxuanwen3 re-run on the either-rendering build showed (2026-09-04, 12:43 UTC)

Run on `82888d43b`,
OpenRouter alone,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The luxuanwen3 re-run on the either-rendering build".
The rule held at every slice:
the moved link passed in every lane,
consolidation settled all nine slices,
and nothing was reattempted.
The publisher refused the page 56 minutes and 4.24 USD in,
because its own destination check still read the source alone.

WHAT IT FOUND:
not a new class in the corpus but a gap in the fix itself,
the kind a reading of the decision record should have caught before the run.
The record said the publisher was unchanged,
and that was the defect.
Fixed and guarded the same hour in `1c9663666`;
the fix also surfaced two tests still asserting the old rule,
which the full suite had not been run against since the rule landed.

THE READING:
unchanged,
not yet ready.
A defect found in the pipeline's own fix counts against the rate the same as one found in the corpus.
What would move the belief is unchanged from the preceding section:
luxuanwen3 shipped and read under the rule,
SS3B_0016 shipped and read,
then the two passes the census section asked for.

## What the two runs on the publisher fix showed (2026-09-04, 13:51 UTC)

luxuanwen3 and SS3B_0016 on `e66da50ef`,
OpenRouter alone,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The two runs on the publisher fix".
Both settled and both pages verify:
luxuanwen3 in 60 minutes and 4.65 USD with the original's link renderings,
SS3B_0016 in 56 minutes and 5.12 USD with the archive's `Railfan` rendering and the finding that names it.
The either-rendering rule and its publisher held end to end on the two shapes that had refused before.

WHAT IT FOUND:
one defect in the corpus's own conventions the pipeline did not know.
The neutral pronoun this corpus writes in three spellings reached the page untranslated twice on SS3B_0016,
endorsed by judges who read it as the original's neutral Ta,
because the pronoun counter read only `TA` and the house rule never said what English makes of it.
Sixteen of the seventeen archives that face it write they.
It is a class rather than an instance:
seven more sources write `Ta` or `ta` for their subject.

THE READING:
not yet ready,
and closer.
Two entries shipped and read clean apart from that one class,
and the class was measurable from the corpus before any run.
What would move the belief:
one entry whose subject is `ta` throughout shipped and read under the pronoun fix,
then the double-quoted-paths pass and the comma-shaped one-line pass the earlier sections ask for.

## What the Uekawakuyuurei attempt on the pronoun build showed (2026-09-04, 15:03 UTC)

The entry never reached its text:
its own pictures stopped it in two minutes,
as they had on every earlier roster,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The Uekawakuyuurei run on the pronoun build".
A painting whose canvas clears the presence gate as noise is read by three models that truthfully report no text,
and the screen took every such report for a refusal.

WHAT IT FOUND:
a class measurable from the logs already on disk,
8 of 64 entry-and-picture pairs over 5 pictures in 3 entries,
which made three entries unshippable on any roster.
Fixed and guarded in `d6ffc4812`;
the rule is clause six of [`when-an-image-reading-makes-no-sense.md`](when-an-image-reading-makes-no-sense.md).

THE READING:
not yet ready.
Two classes found in one afternoon by two entries is the rate the belief is tracking,
and both were in the pipeline's own screens rather than in the corpus.

## What Uekawakuyuurei on the picture-fix build showed (2026-09-04, 15:25 UTC)

Shipped in 53 minutes and 3.84 USD,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "Uekawakuyuurei on the picture-fix build".
Both of the day's fixes held on a page:
the three pictures that had stopped the entry on every roster were confirmed textless on the first ask,
and the subject the source calls `ta` is rendered they or them or their twenty-one times,
with no bare pronoun left.
The page is publishable.

WHAT IT FOUND:
nothing new in the pipeline's screens.
The balance ran out under consolidation,
which is not a pipeline finding,
but it did exercise the every-provider-dry path live for the first time:
the run settled on its lane-contest winners rather than holding or erroring,
with the refusals counted per seat.

THE READING:
closer,
still not ready.
Three entries have now shipped and read clean on the day's rules,
luxuanwen3,
SS3B_0016 and Uekawakuyuurei,
and the last of them found no new class.
What would move the belief:
a double-quoted-paths entry not yet run,
which is `yulianNyanner` or `Arita` or `MTF_0615`;
the comma-shaped one-line entry;
and one entry whose consolidation runs unstarved end to end on this build,
which no run has yet done.
All three wait on the OpenRouter top-up.
The balance reads about 0.36 USD.

## What 2026-09-06 changed before the next page

Synthetic and Hyper are wet again and the owner said not to wait on OpenRouter,
so the passes no longer wait.
Before the first page,
two defaults that had never shipped a page became the configuration every shipped page ran:
the pass keeps four slices in flight (`doc/decision/translation-repair-pass-overlap.md`),
and the writer rounds wait 180000 ms
(`doc/decision/translation-repair-straggler-grace.md`,
decision of 2026-09-06).
The production launch is now the plain invocation in the runbook with no dial set,
which no earlier page had been read under.
The owner's rule of the same day,
always kill and relaunch,
is in the package README and the runbook.

THE READING:
unchanged,
still not ready,
since no page has been read on this build.
What would move the belief:
`yulianNyanner`,
running since 20:21 UTC on the plain invocation;
`Arita`,
the other double-quoted-paths entry never run;
and one consolidation that completes unstarved,
which the refilled meters make possible for the first time since 2026-09-02.

## What the first plain-invocation run showed (2026-09-06, 20:21 UTC)

No page.
`yulianNyanner` stopped at consolidation after 28.6 minutes and 742 calls,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The first plain-invocation run".

WHAT IT FOUND:
the fifth class,
in this package.
The slice floor parsed the original under the strict MDX grammar without masking HTML comments,
which the document reader has masked since the corpus was first read,
so every slice whose original carries a translator note was an original that could not be read,
and the floor's `unknown` is inadmissible at both gates.
17 of 92 sources carry a comment;
none of the three shipped pages did.
Fixed in `259708e79` with guards shown to fail first.

THE READING:
not ready,
and the rate has not reached zero.
The first entry with a source shape no shipped page had (translator notes) found a class at once,
which is the pattern of 2026-09-04:
a class per new shape,
none on a repeat.
Of the 92 sources,
the shapes no shipped page has carried are now:
HTML comments (17,
fixed today and relaunched),
and whatever the next reading finds.
What would move the belief is unchanged:
`yulianNyanner` on the fix,
running since 21:03 UTC;
`Arita`;
one unstarved consolidation.

## What the first page on the plain invocation showed (2026-09-06, 21:03 UTC)

Shipped in 44.9 minutes at zero USD,
3.9 points of the Synthetic week and 64 Hyper credits,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The third launch".
The consolidation completed unstarved,
which closes the third item the 2026-09-04 snapshot left open.
The class-five fix held:
every one of the fourteen source comments is an English comment in its place,
and no slice was withheld.
The page repairs the archive in four places the reading could name
(the `desc`,
a lyric syllable,
a school year,
a dropped attribution)
and carries both `PhotoScroll` shapes intact.

WHAT IT FOUND:
the sixth class,
in this package.
Two different source headings ship as the same English heading because a source comment saying
"the English word for this title is dysphoria" reached every slice as an identity-context line with no position,
and seven of eight consolidation judges bound "this title" to the wrong heading.
Fixed in `459b2007f` and `7a01c9048`:
comment lines name the heading they sit under,
the sheets say what that means,
and the publisher refuses a page on which two distinct source headings read the same,
a floor measured to refuse nothing on the 92 archives.
Guards shown to fail first,
the floor by inversion (5 `FAIL` neutralised,
0 restored).

THE READING:
not ready,
and closer in one respect and not in another.
Closer:
the plain invocation shipped a page whose only defect a deterministic floor now refuses,
and the two remaining gates of 2026-09-04 (unstarved consolidation,
a new source shape) are met.
Not:
the class-per-entry rate is still one on a new shape,
and this entry has not yet shipped clean.
What would move the belief:
`yulianNyanner` on the class-six build,
read clean;
then `Arita`;
then an entry whose source shape no shipped page has carried,
which the readiness question should name from the corpus rather than meet by accident.

## What the page on the class-six build showed (2026-09-06, 22:10 UTC)

Shipped in 39.4 minutes at zero USD,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The fifth launch".
The class-six fix held where it was aimed:
five distinct headings,
and the judges reasoning from the note's anchor.

WHAT IT FOUND:
the seventh class,
in this package,
and one the earlier readings had missed:
the page mixes straight and curly apostrophes because only the repair lane's replacements pass through the
typography restoration,
and the `Uekawakuyuurei` page of 2026-09-04 carries the same mix.
Fixed in `bc42fe330` and `b669363b6` at the would-ship reading,
guard shown to fail first.
Two wording findings are recorded for the judges,
one with a house-policy example added.

THE READING:
not ready.
Three pages of one entry on one day,
each finding a class the one before did not show,
and the seventh was on a page already read once.
The reading method is also the finding:
a mechanical property of a page (one apostrophe convention) went unmeasured through four shipped pages,
so the seven steps gain one,
measuring the page's typography against the archive's,
before the next belief is written.
What would move the belief:
`yulianNyanner` on the class-seven build,
read clean including the count of straight apostrophes;
then `Arita`.

## What the page on the class-seven build showed (2026-09-06, 23:11 UTC)

Shipped in 44.1 minutes at zero USD,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The sixth launch".
The class-seven fix held where it was aimed:
no straight apostrophe inside a word,
the headings distinct,
every comment in place.

WHAT IT FOUND:
the eighth class,
in this package,
and made by the seventh's fix:
the typography restoration curled the JSX string literal of a blockquoted component line,
and the page compiles nowhere.
The log had named it as a warning (`destinations-mdx-downgraded`) and nothing refused.
Fixed in `2079c8c99` and `ba91c5587`,
floor first:
the publisher refuses a would-ship page the MDX grammar cannot parse,
and the restoration no longer reads markup or code as prose.
19 of 92 sources carry the shape.

THE READING:
not ready.
Four pages of one entry on one day,
and the eighth class was introduced by the fix for the seventh,
which is the reason the rule is fix first,
relaunch,
read again,
rather than ship.
A floor that reads the whole page as a document now stands where none did,
so this shape of defect cannot ship again whatever causes it.
What would move the belief:
`yulianNyanner` on the class-eight build,
read clean including the component line and the count of straight quotes after a letter;
then `TLL1122`,
the first read page with a footnote,
which the shape census of 2026-09-07 in the planning log names as the largest shape no read page has
carried;
then `Arita`.

## What the page on the class-eight build showed (2026-09-07, 00:12 UTC)

Shipped in 51.2 minutes at zero USD,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The seventh launch".
The class-eight fix held where it was aimed:
the component line straight,
the page parsing,
no downgrade finding,
and the quotes as the archive writes them.

WHAT IT FOUND:
no defect class.
One U+2026 on a three-dot archive,
the third convention glyph after the two quote forms,
restored in `e3471dc0b` by the same reading the quotes use.
Two consolidation standings withheld by the line-structured rule,
which is a floor doing what it is for.
The two wording findings of the earlier readings settled the archive's way by the judges.

THE READING:
not ready,
but the first page of the day that moves the belief forward rather than sideways.
Four pages of one entry found four classes and the fourth page found none;
the entry is one shape,
and the census names the shapes no read page has carried,
footnotes first.
What would move the belief:
`TLL1122` on this build,
read clean by every step including the footnote's reference and definition;
then `Arita`;
then the second tier.

## What the TLL1122 page showed (2026-09-07, 01:11 UTC)

Shipped in 30.1 minutes at zero USD,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The TLL1122 page".
The first read page with a footnote:
the reference and the definition both in place,
the definition rendered fuller than the archive's and closer to the source.

WHAT IT FOUND:
no defect class.
Trailing whitespace and em dashes on the page are measured against the corpus and are its own habit.

THE READING:
not ready,
and the first new shape that found nothing on its first page.
Seven shapes are still on no read page,
and the run order from here is the census's,
recorded in the planning log under "The run order after TLL1122":
`Huasheng` (containers,
bold,
an inline tag),
then a math pair or a second footnote entry,
then `Arita`.
What would move the belief:
`Huasheng` read clean,
its `<details>` block whole on the page.

## What the Huasheng attempt showed (2026-09-07, 01:44 UTC)

Killed under the rule at 02:56 UTC,
70 minutes in,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The Huasheng pass killed".

WHAT IT FOUND:
the ninth class,
in this package:
the slice floor cannot read a slice that owns one half of a container,
because `container-extents.ts` gives the opener to the first block inside it and the closer to the last,
and the strict grammar refuses either half alone.
The class-five pattern for containers,
which 30 pinned pages carry.
Fixed in `ed7f82de9`,
guard shown to fail first:
a lone tag is masked before the strict parse and carried as an atom,
so a candidate that drops it fails the floor.

THE READING:
not ready.
The first entry with a container found a class before its first page,
as the first entry with a comment did;
the shapes the census names are finding what the pipeline's own screens never met.
What would move the belief:
`Huasheng` on the class-nine build,
its `<details>` block whole on the page and both footnote conventions read.

## What the Huasheng relaunch showed (2026-09-07, 03:09 UTC)

Stopped by its own gate at slice 21 at 05:21 UTC,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The Huasheng relaunch stops at slice 21".
The ninth class held where it was found:
both container halves passed the lane contest.

WHAT IT FOUND:
the tenth class,
and the first that is a design question rather than a defect:
the slice floor requires a candidate to carry the archive's block sequence,
the archive split a `<br/>` poem into five paragraphs where the source has two,
and every producer followed the source,
so nothing was valid and the entry stopped.
34 of 92 archives carry more top-level blocks than their source.
Four options are recorded with a ranking;
the owner decides.

THE READING:
not ready.
The owner answered A at 08:38 UTC;
it is landed bounded to split-only pages (`b46dd9210`,
`doc/decision/translation-repair-block-floor.md`),
which covers Huasheng and 21 entries like it and leaves 12 under the page-as-floor rule.
The Synthetic week is dry and Hyper alone serves the seats it has;
whether a page from that roster is read as readiness evidence is recorded with the next launch.
What would move the belief:
`Huasheng` on the class-ten build,
then the census's next entries.

## What the third Huasheng launch showed (2026-09-07, 08:43 UTC)

Ended at the publisher at 11:14 UTC after 150 minutes with no page,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The third Huasheng launch ends at the publisher".
The ninth and tenth classes held where they were found:
the container halves passed and the poem shipped from its slate.

WHAT IT FOUND:
the eleventh class,
a decided rule again:
`directory-id-name` refuses a page whose visible name is the directory id,
and for 椛笙 every correct romanisation is the directory id.
7 of the 22 archives that name the directory do so because the id is a rendering of the name.
Four options are recorded with a ranking;
the owner decides.

THE READING:
not ready.
The owner answered at 11:30 UTC with the pinyin check and the alias exemption,
landed in `912dbe2dc`;
under it every directory-named archive at the pin stands and a bare folder name still falls.
Hyper alone carried the last pass at about 800 credits and 1275 remain;
Synthetic is dry and OpenRouter uncharged,
so one more pass of this size is what the meters allow.
What would move the belief:
`Huasheng` on the class-eleven build,
read whole.

## What the fourth Huasheng launch showed (2026-09-07, 15:43 UTC)

Settled at 20:48 UTC after 305 minutes with a page,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The fourth Huasheng page".
The ninth,
tenth and eleventh classes held on the entry that found them:
the container arrived whole,
the poem kept the original's shape,
and the directory name stood beside its Latin aliases.

WHAT IT FOUND:
the twelfth class,
not at the publisher but in the meters:
Hyper's daily limit,
"try again in 2h25m18s",
read by the ladder as no wait and by the router as a 60 s concurrency hold,
2,693 refused attempts over 2h53m while the balance read wet.
Fixed on `translation-repair-class12` at `31e67a100`,
landing with the fourth provider.
Also seen for the first time:
the block-floor decision's cost,
an archive-added footnote whose anchor the source-shaped paragraph does not carry.

THE READING:
closer.
Every class found on a read page has been closed and re-read on the same entry,
and the fourth Huasheng page carries no refusal vocabulary,
no typography residue and every destination.
What is not yet on record:
a page judged by a wet roster,
since this one settled on Hyper's return after four chunks with nobody heard;
a page from the second tier (`hakureico` or `yuki418330012`) and from `Arita`;
and a pass with the fourth provider in the order.
What would move the belief:
the next entry on the landed build,
four providers,
read whole.

## What the three hakureico launches of 2026-09-07 showed (21:00 to 22:00 UTC)

The first two were killed under the rule before a page:
the first for seating two unmeasured Gemma sizes (`645c8787b` unseats them),
the second for the owner's order decision (`a317f4e03`,
Bedrock ahead of Hyper).
The third settled at 22:00 in 13.3 minutes,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The first hakureico page".

WHAT IT FOUND:
the thirteenth class.
Hyper's daily limit named a return in 538 s and the twelfth class held it out for exactly that,
in one line where the fourth Huasheng pass had spent 2,693 attempts;
but with Bedrock wet nothing waited,
the translate lane and the consolidation ran on the two Bedrock seats,
and the page shipped without the source's two footnotes.
Fixed at `752bf9a9b`:
a phase whose benches cannot reach quorum waits out the shortest named hold once.
Also on record for the first time:
Bedrock in production for its two shared seats (224 calls,
0.24 USD),
and three repairs read faithful against the source.

THE READING:
closer,
and the same shape as before.
Every class found on a read page has been closed on the entry that found it,
and each pass on a fresh build finds the next one at a seam the last did not reach:
the twelfth at the meters,
the thirteenth at the first phase boundary after a hold.
What would move the belief:
the fourth hakureico page,
read whole,
with its footnotes and with `waited=` on every seats line.

## What the sixth hakureico launch showed (2026-09-08, 00:38 UTC)

The sixth launch (23:38 UTC on `49aca5770`,
`google.gemma-4-e2b` seated as a judge,
Bedrock ahead of Hyper) settled in 60.2 minutes and shipped the page with both footnotes and their definitions,
read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The sixth pass settles".
`verify-published` matched,
every read-page check held,
zero error lines,
no class found on the page.

WHAT IT FOUND:
not a class,
a wall.
Hyper's balance reached 0 two minutes into consolidation and OpenRouter's 0.01 USD answered 402 in the same instant;
the fourteenth class marked both once
(fourteen lines,
no 60 s cycle,
where the fifth pass had cycled)
and the pass finished its fifteen remaining slices on Bedrock's seats,
every naturalness review `quorum-not-met` and recorded as evidence,
three slices consolidated of eighteen.
That is the designed behaviour for a spent balance,
since there is no hold to wait out,
and the page is whole;
but the consolidation of those fifteen slices was a two-seat reading and says so on every settlement.

THE READING:
every class found on a read page is closed on the entry that found it,
and the twelfth,
thirteenth and fourteenth were each seen working in production on this entry
(one held line on the third pass,
six `waited=0ms` readings with nothing to wait for on this one,
fourteen payment marks and no cycle).
This pass found no new class at any seam.
What keeps the belief where it is:
the consolidation ran short of quorum,
so the hakureico page that would move it is one consolidated by a whole bench,
which needs a provider besides Bedrock.
Hyper is at 0 and stays there,
OpenRouter at 0.01 USD until the owner tops it up,
and Synthetic's week is at 0 percent with a five-hour window that refills
(2750/2750 at the tally,
wet at one reading of six).
A launch on Bedrock alone seats three of the wide bench's quorum of four,
and would read `quorum-not-met` from its first review,
so the next launch waits for one of those meters to move;
a launch of all 92 entries now would consolidate nothing.

## What the seventh and eighth hakureico launches on Bedrock alone showed (2026-09-08, 01:49 and 02:19 UTC)

Both launched on the owner's words that one wet provider is normal operation,
to read what the pipeline does in the state production is in tonight:
Synthetic's week at 0 percent,
Hyper at 0 for good,
OpenRouter at 0.01 USD,
Bedrock alone.
Read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The seventh hakureico launch on Bedrock alone" and "The eighth pass settles in 4.4 minutes".

THE SEVENTH stopped INCOMPLETE at the pictures in 20 seconds:
no picture reader had a Bedrock seat,
and the seats line printed `readers=4 withheld=none` with none reachable.
Two things landed on it,
neither a design decision:
the seats line now names every short bench with or without a hold (`c4a9682fe`),
and the two Gemma sizes whose transcriptions every seated reader corroborated on nine pictures
read pictures through Bedrock,
by a reader-seat rule written in the planning log (`f7f9c9136`,
addendum in
[`translation-repair-roster-seating-2026-09-01.md`](../decision/translation-repair-roster-seating-2026-09-01.md)).

THE EIGHTH,
on that build,
passed its pictures on the two Bedrock readers and settled in 4.4 minutes for 0.22 USD:
a page with five slices rewritten by the one reachable translator,
each chosen by three judges of nine
(the contest asks a minimum ballot weight,
not a majority),
zero repairs
(no editor or refiner has a Bedrock seat;
92 writer rounds heard nobody),
every consolidation slate declined under `quorum-not-met`,
and no footnote.
Every line the pass printed said so:
`repairStatus=unchanged translateStatus=unfilled` on the tally,
`short of quorum` before every phase.
The page went to `fixed/` and `verify-published` matched it.

THE READING:
no new defect class on either launch,
and the fifteenth thing found is not a defect but a question.
The sixth pass's page,
made by a whole bench,
had fourteen changed slices,
three consolidated,
both footnotes;
the eighth's,
made by one writer and three judges,
has five and none,
and both are `SETTLED`.
The pipeline distinguishes them only in the findings.
Whether a pass whose editor,
refiner and translator benches have no reachable seat should ship a page,
or stop INCOMPLETE and leave the entry for a pass that has them,
is the owner's decision,
and the readiness belief waits on it:
under the first answer the pipeline is what it is on one provider and the reading stands where the sixth pass left it;
under the second there is one more floor to build,
in the shape of the thirteenth class's wait,
before a single-provider night ships nothing it should not.
Until the answer,
no launch on Bedrock alone,
and no launch at all until a meter besides Bedrock's moves.

## What the ninth hakureico launch on four wet providers showed (2026-09-08, 11:27 UTC)

Launched on `061b46c0b` the minute OpenRouter was topped up,
every provider wet and every bench whole,
to buy the reading the sixth pass owed:
a consolidation by a whole bench.
Read in [`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
under "The ninth pass settles in 83 minutes on a whole bench".

THE PASS settled in 83 minutes with zero errors:
six seats lines all wet,
no shortfall line,
no hold,
no `quorum-not-met`;
both pictures corroborated by five and six readers;
16 of 18 slices changed;
the contest 12 to translate,
2 to repair,
2 to neither on nine ballots;
the consolidation on all 16 contested slices with nine judges,
7 of them consolidated;
both footnotes;
every read-page check held;
no defect class.
It spent the remainder of Synthetic's week and all of Hyper's day,
0.32 USD on Bedrock and 0.45 USD on OpenRouter,
whose first paid calls came in the last five minutes after Hyper's meter read dry.
At 12:52 UTC:
Synthetic and Hyper dry,
Bedrock 198.39 USD,
OpenRouter 199.56 USD;
those two together reach every bench at every phase,
measured on the merged build.

THE SIXTEENTH THING is a question,
like the fifteenth.
The front matter now reads `name: Kagurazaka Chika`,
the translate lane's faithful rendering of 神楽坂千歌,
chosen 6 ballots to 3 over the archive's `Hanasaka` and endorsed 9 of 9;
the body keeps `Hanasaka` and the letter's signature `Kagurazaka Hanasaka`,
because the declared-name guard takes its forms from the archive's front matter and refused the same judges'
`Chika` on slice 4.
The guard exempts the front-matter slice on purpose
("metadata unrepairable" otherwise),
so each rule did what it says,
and the page carries two renderings of one name that no rule reads together.
Whether the archive's display name is editorial and stays,
whether the body follows a corrected front matter,
or whether the page only reports the disagreement,
is the owner's decision.

THE READING:
the first page every phase of which ran on a whole bench,
and the page the pipeline was built to ship:
nine judges on every contested slice,
seven consolidated,
both footnotes,
nothing failing a check.
No code change is owed from this page.
The fifteenth class landed after the tally (`d74ef4a43`,
`977c242c1`),
so a single-provider night now stops INCOMPLETE at the lanes instead of shipping a one-writer page.
The readiness belief moves from "waits on the owner's answer" to this:
on a whole bench the pipeline produces the page it should,
and what remains before an all-entries launch is the name question above,
the translator-seat calibration for the E2B size,
the next entries (`yuki418330012`,
`Arita`) and the seven components no read page has met.
The production fact to carry:
one entry of 18 slices on a whole bench consumes a Synthetic week's remainder and a Hyper day,
so the next whole-bench pass either waits for the week to turn or runs on Bedrock and OpenRouter alone.

## What the owner decided on the front matter (2026-09-08, 13:15 UTC)

The sixteenth thing,
asked as the name question,
was answered with "We're not supposed to change front matter though?"
and then,
of three options,
"publish the archive's front matter as is;
render it only where the archive never translated it".
What the measurement behind the question showed is the larger finding:
13 of 127 shipped pages,
9 of the last 10 read,
carried a rewritten `desc`,
`alias` or `name`,
and no reading had diffed the front matter,
so pages read as "no class found" had changed the memorial's own words about the person.
Built in a throwaway as `20e5135a6` and merged after the E2B calibration ends
(planning log,
"The front-matter rule");
recorded in the front-matter guard decision's addendum of 2026-09-08.
Measured over the pinned corpus,
every one of the 92 archives stands,
so from here no page changes its front matter and the mechanical reading checks that it did not.

THE READING:
the belief after the ninth pass holds,
with one line changed.
The page the pipeline ships is the body the whole bench made under the memorial's own metadata,
and the read-page checks now cover the whole page rather than the body.
No further code is owed from the ninth pass.
What remains before an all-entries launch:
the E2B translator seat from the calibration in flight,
the next entries (`yuki418330012`,
`Arita`),
the seven components no read page has met,
and one relaunch of `hakureico` on the merged build to read a page whose front matter the rule kept.

## What the E2B calibration and the merge showed (2026-09-08, 16:07 to 16:18 UTC)

The 40-round producer calibration with `google.gemma-4-e2b` beside the nine measured writers printed its
standing at 16:07 UTC:
E2B 10.1 percent (30 of 298 disinterested ballots,
over 39 candidates),
z -1.40 against a pooled null of 12.8 percent with a Bonferroni threshold of 2.81,
94 of 94 asks usable,
streams p50 1.6 s.
By the rule of the 2026-09-01 seating it is not separated from the null
and takes the translator seat and the consolidation seat
(`169a86173`;
the seating decision's addendum of 2026-09-08).
The front-matter branch merged as `d11f36799`,
and `hakureico` launched at 16:18 UTC on `169a86173` into `~/temp/agent/hakureico10-20260908`,
logging `FRONT MATTER entry=hakureico authority=archive` on its first reading
and a seat line that counts the seated roster less Kimi-K3,
on Bedrock and OpenRouter alone.

THE READING:
the belief holds.
Every seat a Bedrock-only candidate could take by measurement has now been measured
(judge,
reader,
writer),
and a pass on Bedrock alone reaches a pair of translators,
though still no editor or refiner,
so the class-fifteen stop stands there.
What remains before an all-entries launch is unchanged:
the tenth hakureico page read under the front-matter checks,
`yuki418330012`,
`Arita`,
and the seven components no read page has met.

## What the tenth hakureico launch showed (2026-09-08, 16:18 to 16:55 UTC)

The tenth pass,
the first on the merged front-matter rule and the E2B seat,
logged `FRONT MATTER entry=hakureico authority=archive` on its first reading and then lost five
deepseek-v4-flash-0731 voices in the repair lane to replies whose JSON opening was written twice
(`{"best": 1{"best": 1, ...}`),
every one a reasoning stream from OpenRouter's Makora endpoint.
The ninth pass had lost six gpt-oss-120b voices through Bedrock to the same shape and the reading had counted them as provider weather.
That is the seventeenth class:
the reply ladder refused a readable answer.
Fixed as `8bf9deec0` (the object after the abandoned opening is read,
the guard still judges it,
the abandoned length is logged),
the tenth pass killed at 37 minutes under the rule,
and `hakureico` relaunched at 16:56 UTC on the fix into `~/temp/agent/hakureico11-20260908`,
reading every bench whole on Synthetic,
Bedrock and OpenRouter with eight translators and ten writers.

THE READING:
the belief holds,
and the count of things the read passes had waved through as weather is now two
(the front matter on 2026-09-08 morning,
the doubled opening this afternoon):
each was in the logs of a pass read as "no class found",
and each was found by reading the raw text behind a warning rather than the warning's count.
The next reading reads the raw text behind every remaining warning class before it calls the page whole.
What remains before an all-entries launch:
the eleventh hakureico page read under the front-matter and false-start checks,
`yuki418330012`,
`Arita`,
and the seven components no read page has met.

## What the eleventh hakureico launch showed (2026-09-08, 16:56 to 18:21 UTC)

The eleventh pass,
the first on the false-start reading,
ran 85 minutes on three providers until Synthetic's rolling week ran dry at 17:21,
then on Bedrock and OpenRouter.
Its log showed the front matter standing (`authority=archive`),
E2B writing and winning in the translate lane,
four doubled openings on Bedrock's gpt-oss-120b read past with no mismatch beside them,
and one voice lost in the lane contest to a reply the provider itself had marked failed:
`finish_reason=error`,
no content,
cost 0,
served by CoreWeave.
Seven such replies since 2026-09-03,
all through OpenRouter,
had each been read as the model's unparseable answer.
That is the eighteenth class:
the ladder counted a provider failure as a vote.
Fixed as `bb04656ef` (the error finish rides the retry ladder as the provider failure it is),
the eleventh pass killed inside its consolidation under the rule,
and `hakureico` relaunched at 18:21 UTC into `~/temp/agent/hakureico12-20260908` on Bedrock and OpenRouter
with seven translators and nine writers.

THE READING:
the belief holds,
and the count of things read passes had waved through as weather is three
(the front matter,
the doubled opening,
the error finish),
each found by reading the raw text behind a warning.
The error finish had sat in four logs read as "no class found" since 2026-09-03 under the `schema-mismatch` count.
What remains before an all-entries launch:
the twelfth hakureico page read under the front-matter,
false-start and error-finish checks,
`yuki418330012`,
`Arita`,
and the seven components no read page has met.

## What the twelfth hakureico launch showed (2026-09-08, 18:21 to 20:10 UTC)

The twelfth pass,
the first on the error-finish reading,
settled in 108 minutes on Bedrock and OpenRouter,
Synthetic's week returning at 19:48.
Its page passed the three checks:
the front matter is the archive's byte for byte with the artifact at schema 11 and `frontMatterAuthority: "archive"`,
E2B voted 18 times and won once across the translate stages,
eight doubled openings were read past with no mismatch beside them,
and no reply carried an error finish
(none occurred;
the eighteenth class's guard stands on its suite,
not on this pass).
`verify-published` matched at length,
destinations 0 and 0,
quotes and ellipses on the archive's conventions,
the blank line after the front matter back and the three-blank-line seam gone.
What its prose showed:
the page rewrote the letter the archive's note says is the English original
(five places,
on a ninth page that had rewritten it more),
while the two short quotes under the same kind of note ship verbatim.
That is not a class in the pipeline's reading of its inputs;
it is the archive-as-original rule (the owner's front-matter decision) not yet applied to a span,
and a design question for the owner.
Its log showed 81 voices lost at the straggler window against the ninth's 38,
on five readers and nine seats against six and ten,
with quorum held in every round;
no seat moved.

THE READING:
the belief holds.
Of the three things read passes had waved through as weather,
two are confirmed fixed on a settled page (the front matter,
the doubled opening) and the third was not exercised (no error finish occurred) and stands on its suite.
One design question is open (the letter).
What remains before an all-entries launch:
the owner's answer on the letter,
`yuki418330012` (running since 20:18 UTC),
`Arita`,
and the seven components no read page has met.

## What the yuki418330012 launch and the letter's landing showed (2026-09-08, 20:18 to 22:10 UTC)

The owner chose span authority for the letter and a decline for the whole-page note;
both landed (`439667ec3`,
`58f647ab9`) and were verified live:
`cheonwoomaeng` declined in 41 ms with its record written and no page,
and the thirteenth `hakureico` launch logged the sealed span `[3966, 4561)` under the letter's note.
The publication guard makes the seal a floor:
a page that does not carry the sealed bytes verbatim is refused,
so the fifteenth `hakureico` page,
when it settles,
proves the letter shipped as the archive has it by existing.

The `yuki418330012` page settled in 64.4 minutes on three providers and passed the three checks
(front matter the archive's,
30 doubled openings read past with no mismatch,
no error finish),
`verify-published` matched at length,
destinations 0.
The prose read found the nineteenth class:
the archive's footnote labels were renumbered against the original's,
the lanes followed the original's markers in the body,
the archive's definitions stood,
and the page's two markers point at each other's notes.
No guard sees it:
the footnote guard diffs unresolved,
orphan and duplicate findings,
and a swap is none of those.
Fixed upstream of every lane (`1ba94c27a`,
corrected by `ea07a1512` after the fourteenth `hakureico` launch showed a count mismatch aborting the reading where
the archive simply omits a note):
the archive is relabelled to the original's labels off the paired slices before the lanes run,
so label equality is the correspondence.
The read also found two regressions of correct archive renderings
(`自切` as self-harm where the archive had self-surgery,
`超天酱` as a made-up name where the archive named the game),
a bench that does not know the community's words;
that is a design question for the owner (a glossary),
not a class.

THE READING:
the belief holds,
and the count of classes the read passes find is not falling to zero:
two of the last three read pages each found one
(the letter,
the footnote swap),
each fixed the same day,
each a floor no earlier page could have exercised
(one archive note in the corpus seals a span,
one entry swaps its labels).
What remains before an all-entries launch:
the fifteenth `hakureico` and the third `yuki418330012` pages on `ea07a1512` (running since 22:08 UTC),
the owner's answer on the glossary,
`Arita`,
and the seven components no read page has met.

The third `yuki418330012` launch on `ea07a1512` showed the class has a second face:
the roster paired the two definitions by content,
which crosses when the archive has renumbered them,
the never-backwards rule refused six of eight voices,
and the pairing starved before the relabel could read it.
Fixed in `e5ff6c4f8` (definitions are order-free in the pairing,
the map is read off the paired definitions,
the archive's definitions move into the original's order);
the sixteenth `hakureico` and the fourth `yuki418330012` run on it since 22:36 UTC,
and their pages are what the reading waits on.

The fourth `yuki418330012` launch then showed the relabel applying a partial map (one definition pair agreed,
two `[^1]` notes on the archive);
`2da6e7f22` closes the map over the archive's labels first,
completing the one pair elimination forces and standing otherwise.
The seventeenth `hakureico`,
the fifth `yuki418330012` and the second `Arita` run on it since 22:42 UTC.

The fifth `yuki418330012` pass then relabelled and reordered as designed and stopped at a guard reading its
evidence byte for byte against a page the semantic wrap had broken at its clauses (the twentieth class,
fixed in `11143f681`);
the `Arita` page settled on `2da6e7f22`,
passed the three checks,
matched at length,
shipped its double-quoted component line verbatim and found no class.
The eighteenth `hakureico` and the sixth `yuki418330012` run on `11143f681` since 00:22 UTC.

The sixth `yuki418330012` pass stopped at the same guard on the folded reading over a partial voter's quote of an
unrelated sentence a lane had rewritten;
`d6db46519` makes the full votes' regions the only evidence and puts an interrupted entry's findings in the log.
The nineteenth `hakureico` and the seventh `yuki418330012` run on it since 01:35 UTC.

## What the seventh yuki418330012 launch showed (2026-09-09, 01:35 to 02:51 UTC)

The page settled in 76 minutes on `d6db46519`,
passed the three checks,
matched at length,
and carries each footnote marker at its own note under the original's labels and order:
the nineteenth class is closed on a read page,
and the twentieth with it,
since the carried credits line passed the guard under the semantic wrap on the full votes' evidence.
The two community-slang regressions stand on a second page (`cutting herself` for `自切`,
`Chōten-chan` for `超天酱`),
which is the glossary question.

THE READING:
the belief holds.
Two pages read since the letter question (Arita,
the seventh yuki) found no new class;
the seven launches between them found two,
each a guard or a pairing rule reading its evidence more strictly than the thing that produced it,
each fixed and closed on a page the same day.
What remains before an all-entries launch:
the nineteenth `hakureico` page (running since 01:35 UTC),
the owner's answer on the glossary,
and the components no read page has met.

## What the nineteenth hakureico launch showed (2026-09-09, 01:35 to 03:03 UTC)

The page settled in 88 minutes on `d6db46519` with the seal holding
(the letter byte for byte the archive's,
the artifact carrying the span),
passed the three checks and matched at length,
and carries a footnote reference with no note:
`“Mayday”[^1]` with no `[^1]` definition on the page.
The twenty-first class:
the translate lane's assembly guard withdrew a two-definition insertion whole for the one orphan among them,
and nothing read the composed page as one document.
`aedee7414` trims an orphan definition's own block out of a definitions-only replacement and reads the would-ship
page's footnote graph against the archive before the tally,
stopping the entry INTERRUPTED rather than shipping the page.
The twentieth `hakureico` runs on it since 03:21 UTC.

THE READING:
the belief holds,
and the count of classes a read page can still find is not yet zero.
Three pages read since the letter question found one class between them,
and it was of the same shape as the two before it:
a guard reading its evidence more coarsely than the thing it guards,
this time withdrawing two notes for one defect,
with no reading over the page the guards compose.
The page-level footnote guard closes the second face for every future page,
since a dangling reference now stops the pass instead of shipping.
What remains before an all-entries launch:
the twentieth `hakureico` page,
the owner's answer on the glossary,
and the components no read page has met.

## What the twentieth hakureico launch showed (2026-09-09, 03:21 to 04:28 UTC)

Stopped `status=ERROR` at the delivery reassembly invariant after 68 minutes:
the guard's trim worked and the ledger did not know about it,
so the shipped row for the definitions slice said the judges' two-definition text where the document carried one.
The second face of the twenty-first class,
fixed in `9abcbee50` by carrying the guard's trimmed text through both lane results into the ledger and
teaching the coherence rule what a definition trim is.
Three passes run on it since 04:39 UTC:
the twenty-first `hakureico`,
the second `gqt` and the second `Mio`.

THE READING:
the belief holds,
and the shape of the day's classes is now the same three times over:
a guard,
an invariant or a ledger reading its evidence by a rule the change beside it did not know.
The fix a class of this shape wants is the one taken each time,
the new fact carried to every reader of the old one,
with the relation between the two checked rather than trusted.
What remains before an all-entries launch:
the twenty-first `hakureico` page,
the `gqt` and `Mio` pages,
the owner's answer on the glossary,
and the components no read page has met.

## What the twenty-first hakureico launch showed (2026-09-09, 04:39 to 06:13 UTC)

Stopped INCOMPLETE at the page footnote guard after 93 minutes,
which is the guard working:
the trim read blocks at blank lines,
the bench wrote the two notes one line apart,
the trim saw one block and the assembly guard withdrew both notes and the reference,
and the page would have shipped the dangling `[^1]` a third time.
The third face of the twenty-first class,
fixed in `379122379`:
a definition line opens a block whether or not a blank line precedes it.
Three passes run on it since 06:20 UTC.

THE READING:
the belief holds,
and the guard added for the first face has already paid for itself,
refusing the page the second and third faces would have shipped.
Three faces of one class in one day is the cost of a reading that did not start from the parser's,
and the fix now shares the parser's rule.
What remains before an all-entries launch:
the twenty-second `hakureico` page,
the `gqt` and `Mio` pages,
the owner's answer on the glossary,
and the components no read page has met.

## What the twenty-second hakureico launch showed (2026-09-09, 06:20 to 07:46 UTC)

Stopped INCOMPLETE at the page footnote guard after 86 minutes,
the translate lane's trim working and the consolidation's own rendering of the two notes putting the orphan back:
the page the polish,
the consolidation and the per-slice contest compose was a document no guard assembled.
The fourth face of the twenty-first class,
fixed in `3620004db` (artifact generation thirteen):
the pass runs the assembly guard over the composed page and records the outcome as `pageAssembly`,
which every reader applies first.
Three passes run on it since 08:01 UTC.

THE READING:
the belief holds,
and the fourth face is the one the first three were symptoms of:
the page was never one document to any guard until now.
With the composition guarded and its outcome in the artifact,
a lane's trim,
a consolidation's rewrite and a contest's per-slice choice all meet one reading before the tally,
and the page footnote guard behind it should stay silent.
What remains before an all-entries launch:
the twenty-third `hakureico` page,
the `gqt` and `Mio` pages,
the owner's answer on the glossary,
and the components no read page has met.

## What the twenty-third hakureico launch showed (2026-09-09, 08:01 to 09:31 UTC)

The page settled in 90 minutes on `3620004db`,
passed the three checks,
matched at length,
and carries `“Mayday”[^1]` above its one note with no `[^2]` anywhere:
the twenty-first class is closed on a read page in all four faces,
the translate lane and the page-level guard each trimming the orphan,
the ledger and the artifact saying what the page carries,
and the seal holding beside it.
Two nits (a three-dot ellipsis on an archive with no ellipsis convention;
a wrap break after an emphasized exclamation mark),
no class.

THE READING:
the belief holds,
and for the first time since the letter question a `hakureico` page settled with nothing new found.
Three pages of the seven-launch day are read clean (Arita,
the seventh yuki,
this one);
what remains before an all-entries launch:
the `gqt` and `Mio` pages (running since 08:01 UTC),
the owner's answer on the glossary,
and the components no read page has met.

## What the fourth gqt launch showed (2026-09-09, 08:01 to 09:46 UTC)

The page settled in 105 minutes,
passed the three checks,
matched at length,
and rendered the level-3 heading,
the bold-led list and the italic paragraph as the archive has them,
with the source's footnote the archive dropped restored and the page guard silent.
And the page should not exist:
the archive's first line under the front matter says `(Original Language: Engish)`,
Ara wrote in English,
and the owner's rule declines the entry.
The recognizer read only the two Chinese wordings;
the twenty-second class,
fixed in `7bcea2dc4`,
and the fifth `gqt` declined in 146 ms.

THE READING:
the belief holds,
with a correction to its evidence:
a page read clean is not evidence when the entry should have been declined,
and the 2026-09-08 census that keyed the recognizer counted only Chinese notes.
The census is now over both languages and finds no fourth wording.
Three shapes go back to no read page (the level-3 heading,
the unordered list,
the emphasis);
`noname` runs for the heading since 09:50 UTC beside the fifth `Mio` and the second `hulicaijia`.
What remains before an all-entries launch:
those three pages,
the emphasis and list carriers after them,
the owner's answer on the glossary,
and the components no read page has met.

## What the first noname launch showed (2026-09-09, 09:50 to 11:45 UTC)

The page settled in 115 minutes,
passed the three checks,
matched at length,
rendered the three level-3 headings at the source's positions and the three links verbatim,
repaired the archive's broken photo path and its fullwidth colon,
and lacks the `## 简介` heading the source opens with and 84 of 86 archives carry.
The pairing had given the heading the paragraph's partner by source order,
and every later stage did what it could with a heading set against a paragraph;
the twenty-third class,
fixed in `efc9a4f3c`.
The bare URL the census credited to `noname` and `Mio` was the inner URL of an archive link target;
`shi_Yumiaoya` carries one as a `Banner` prop and `yingying` one as a footnote definition.

THE READING:
the belief holds,
with a correction to the census:
a shape is on a read page only when the page carries it,
and the regex that named `noname` a bare-URL carrier did not read link targets.
What remains before an all-entries launch:
the second `noname`,
the sixth `Mio` and the third `hulicaijia` on `efc9a4f3c` since 11:59 UTC,
the emphasis and list carriers after them,
the owner's answer on the glossary,
and the components no read page has met.
