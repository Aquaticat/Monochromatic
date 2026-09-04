# Translation repair: the production readiness signal, and what it rests on

Proposal for the owner, written 2026-08-26 ahead of the `AskUserQuestion` call that `#219` prescribes.
The signal is the owner's cue to disable branch protection temporarily so the corpus text committed along
the way can be sanitized (`doc/handover/translation-repair.md`, "Corpus exposure is not a blocker").
This document is the evidence behind the question and the decisions the question bundles apart.

## What "ready" rests on

-   The whole-package audit (`#236`) is closed on a measured tally:
    every register entry carries a FIXED, CLOSED, folded or tracked marker, 3 BLOCKER, 28 MAJOR, 35 MINOR
    (`doc/audit/translation-repair-package-audit.md`, "Closing tally").
-   Every MAJOR (`#237` to `#257`) and every MINOR group landed with a guard shown to fail when its fix is removed.
-   Whole-suite `buildAndTest` after `4c070f729`: 819 PASS, 0 FAIL, exit 0.
-   All 38 built commands a `mise.toml` task invokes carry their `import.meta.main` guard (measured, not assumed).
-   The provider resilience the owner asked for is verified live:
    both keys are required, a half-dark roster is loud (`SEAT` lines end every command), and the two
    calibration arms of 2026-08-26 ran the full ten-model roster with 304 and 302 of 312 voices heard.
-   The three measurements the queue held open are paid:
    `#213` (overlap), `#230` (recovery rate: 3 of 4 re-asked answers came back) and `#229` lever 1
    (arm C, below).

## What is known and not done

-   Guards recorded as owed inside FIXED blocks are proven by the type check or by measurement rather than by
    a mutation: repair-8's typography half, consolidate-5, probes-10 and probes-11, calibrate-5 and calibrate-8,
    repair-2, document-11, slices-5 and slices-8.
    They are coverage debts, not defects, and each entry says so.
-   The straggler window decision (`doc/decision/translation-repair-straggler-grace.md`) stands at 180000 ms;
    arm C is read and the move is the owner's call (question 4).

## Sanitization inventory

-   Tracked tree, measured 2026-08-26 with the standalone scanner against the built deny-list of 10206 corpus
    sentences (`~/temp/agent/deny-rules.txt`, from `doc/decision/corpus-deny-list-for-forbidden-strings.md`):
    zero findings over the whole worktree walk.
    The probe was proven able to fire first: one rule written into a throwaway file fired as `rule=0` both when
    named explicitly and through the same `--all` walk from inside the worktree.
    The deny-list subtracted the 8 corpus sentences the tree already held on 2026-08-25, so the zero means no
    further sentence of 24 or more characters has entered the tracked tree since.
-   History: the branch carries 2342 commits beyond `main` (merge base `88ba0ae2e`, first commit 2026-07-16),
    and `main` carries 657 the branch lacks.
    Corpus text quoted in earlier commits and later removed lives only in that history.
-   Outside the repository, corpus-bearing and never committed: run directories under `~/temp/agent/` and
    `~/translation-repair-runs-*`, including `<runs dir>/rendering-audit-settled/*.json` (document spans and
    model prose in every row's `report`), calibration logs, and the deny-list itself.

## The decisions the question keeps apart

Each is its own question, because answering "yes" to all of them in order must be reachable.

1.  Readiness: disable branch protection now and sanitize, or name what is still missing.
2.  Calibration overlap default: `TRANSLATION_REPAIR_SLICE_OVERLAP` stays opt-in at 1, or the editor calibration
    defaults to overlapping slices (only `editor-calibrate` carries the dial today; `producer-calibrate` gets
    the same dial as follow-up work if the default moves). Measured on matched arms: overlap 4 ran the same 1.74 h of
    calls in 24.19 min
    instead of 43.19, voices 302 against 304 of 312 (one run per arm; the run-to-run band is unmeasured).
3.  Corpus pass slice overlap: the pass's drivers run slices sequentially by a recorded rationale
    (`lane-contest-driver.ts`: "the client's limiter grants one stream per model, so contesting two slices at
    once queues behind the same slot rather than doubling throughput"; `translate-document.ts`: "aggregate
    concurrency beyond one stream per model collapses throughput on this plan").
    The calibration arms contradict the first premise under the same limiter, and the second predates the
    multi-provider routing. Building the dial into the pass is a design change; the proposal is to measure it
    on the pass the same way before any default moves.
4.  Straggler window: keep 180000 ms or move it. Measured on arm C (overlap 1, 300000 ms, the same four slices)
    against arm A (overlap 1, 180000 ms): 53.87 min against 43.19 (+24.7%), voices never heard 5 against 8,
    grace cuts 4 against 6, all `qwen3.8-max`. Two rounds spent 214 s and 263 s in grace, the two voices the
    longer window bought back; four rounds burned the full 300 s and were cut anyway. About 5.3 min of wall
    clock per voice bought while slices run one at a time; under overlap the wait is what overlap fills, so a
    longer window under overlap 4 is the unrun arm that would reprice it.

## The owner's answers (2026-08-26)

1.  Readiness: "Not yet. You didn't even look at its actual output."
    The signal rested on process gates; the output itself, the published pages and the shipped text, had not
    been read. That reading comes first, and readiness is not claimed again until it is recorded.
2.  Overlap default: measure the run-to-run band first, by repeating arm A. DECIDED later the same day, on
    arms A2 and D: `editor-calibrate` defaults to overlap 4.
3.  Pass overlap: build the dial into the pass and measure it there; the default stays 1 until measured.
4.  Window: run arm D (overlap 4 at 300000 ms) before moving it. DECIDED later the same day, on arm D: the
    calibration runs under 300000 ms together with overlap 4; the pass keeps 180000 ms until `#261`.
    Record: `doc/decision/translation-repair-calibration-overlap.md`.

## Since the answers (2026-08-26, updated the same day)

WHAT THE REJECTION CHANGED. The signal had rested on process gates; the deliverable is the published page, and
none had been read by the session that put the signal. `#259` opened as the gate that now precedes any
re-signal: read pages against source and archive, trace every defect into the artifact (slice, lane, ballots)
before filing it, and have a second reader (sol, whole files attached) read each page too. The advisor
checkpoint on that plan (16:00Z) added the hard entries this project's own history names (`Toka_ls`, `XIEPT2`,
`XingZ60`) to the sample, since eight short entries answer only whether the output is publishable on easy input.

WHAT THE FIRST READING FOUND, on four older-build pages (`doc/audit/translation-repair-output-reading-20260826.md`):
six defect classes no gate measured. Three became code that is landed in source and awaits the build the
running arms forbid: `#263` (a refiner that answered every ask reported as silent; recurred on arm A2 on two
seats), `#264` (invisible-variant punctuation, U+2011 for the hyphen, folded at every lane's intake; U+2019
measured as the archive's own convention and kept), `#265` (a source hyperlink absent from the page, now a
`DESTINATIONS` line per entry with the addresses in the run log). The other three (name rendering where the
source uses an alias, lexical ambiguity introduced by a change, coverage misdiagnosis) are recorded in the
reading and re-read on the fresh pass before anything is built for them.

WHAT THE MEASUREMENTS SAID. Arm A2 (`#260`) put the run-to-run band at 37% of wall clock on an unchanged
build, driven by provider speed (stream sum 9294 s against 6312 s). Normalized as wall clock over stream sum:
A 0.41, A2 0.38, C 0.43, B 0.23. So question 2's overlap effect stands (six bands wide) and question 4's
window cost is unmeasured at this scale rather than the +24.7% one pair of runs suggested. Arm D (`#262`) is
running as this is written. Question 3's dial is designed (`#261`) and waits for the fresh pass to launch,
because the pass task builds what it runs and a driver edit present at launch would ship into the reading.

WHAT COMES BEFORE ANY RE-SIGNAL, in order: arm D read; whole suite and the guard-failure rounds on the three
landings; the fresh pass at production defaults over ten entries (`XingZ60` second); each page read twice and
traced; a spot re-read on the fixed build if the reading finds publishability blockers; then this document
gains a section that says what the pages showed, and `#219` is put again.

## The owner's words on the goal, 2026-09-04

Asked when a supervised sweep over all 92 entries should launch, the owner answered:

> We never ever need a all 92 entries launch. If you believe it's ready for all 92 entries launch after
> reading the artifacts, that means we had reached the goal of making it production ready.

So the deliverable is the pipeline's readiness, judged by reading its artifacts and pages, and no 92-entry
sweep is planned or budgeted. The 2026-09-03 OpenRouter budget arithmetic that priced such a sweep
(`doc/planning/translation-repair-openrouter-2026-09-03.md`) is an upper bound on what the corpus would
cost if it were ever run, not a plan. The readiness signal is put when a reading of the artifacts would
let the sweep launch, whether or not it does.

## What the 2026-09-04 pages showed

Six passes settled and verified 1 of 1 each (`doc/planning/translation-repair-openrouter-2026-09-03.md`,
sections dated 2026-09-04): Toka_ls on Synthetic plus OpenRouter (81 min, 3.56 USD); Hangmster, BI4PBV
twice and two keyword233 arms, about 8.6 USD in all. The R3 order runs end to end on OpenRouter alone,
the Kimi-K3 withhold held through every stage including the picture readers, the spend ceiling fired live at
zero, and the Toka_ls re-read (`doc/planning/translation-repair-toka-ls-reading-2026-09-02.md`, "Re-read on
a published page") finds every 2026-09-02 finding fixed or consistent with a decision since.

WHAT THE SAME READING FOUND THAT NO GATE HAD: three defects, each fixed the same day with a guard shown to
fail neutralised, and each a shape the corpus carries beyond the entry that showed it.

- The photo reference reader took single-quoted paths only; four source pages double-quote theirs. The
    first BI4PBV pass read no pictures and logged nothing about it (`5e013d24b`, `4ff42e627`).
- The semantic wrapper split a one-line `PhotoScroll` element before its `/>` on the shipped Hangmster
    page; sixteen source-page elements across eleven entries share the comma-and-space shape
    (`66345a092`, in markdown-lint).
- OpenRouter's ModelRun endpoint timed out one MiniMax M3 call in five and the client called each a cut-off
    reply; at least five voices were lost after the ladder's five attempts (`f17feba12` names the failure;
    the seat question is the owner's, since ModelRun is the model's only zero-data-retention endpoint for
    a schema request).

THE READING I PUT ON THAT, as the owner asked for a belief rather than a gate: not yet ready for a launch
over the whole corpus. Not because any pass failed, but because three of six passes over four entries each
surfaced a defect class the earlier readings had not, and the corpus's variety (four entries with one
quoting, eleven with another spelling, fifty with pictures) has been sampled at two picture-bearing entries.
The rate of new findings per pass is what has to fall before the belief is honest. What would make it fall:
one pass each over an entry with double-quoted paths that the fix has not yet run on (`yulianNyanner`,
`Arita` or `MTF_0615`) and one with the comma-shaped one-line element, both read the same way; the ModelRun
seat decided; and the picture gather's straggler wait re-read once those passes have run three-reader
pictures. Each of those is a pass and a reading, not a build.

## What the luxuanwen3 re-run of 2026-09-04 showed

Run on the containment and withheld-standing build (`592562992`), OpenRouter alone, read in
`doc/planning/translation-repair-openrouter-2026-09-03.md` ("The luxuanwen3 re-run, 2026-09-04"). Two of
the morning's fixes held: the archive-shaped front matter passed every gate, and the withheld-standing rule
stopped the entry at the first slice nothing valid could fill, 34 minutes and 2.01 USD in, where the pass
before had run 63 minutes to the page guard.

WHAT IT FOUND: a fourth defect class of the day, and the first one the corpus carries in eight entries
that no pass had touched. Where the archive rewrote a link destination (`twitter.com` to `x.com` here,
Chinese Wikipedia to English Wikipedia in two others), the deterministic floor owes both URLs, so the
archive's own paragraph is ineligible and no candidate can pass. Behind it, a scheduler defect: the
deterministic refusal was classed resumable and the pass reattempted the entry at once. Both are recorded
there; the destination rule is the owner's decision (asked 2026-09-04) and the reattempt is fixed.

THE READING: unchanged, not yet ready, and the reason is sharper. The rate of new classes per pass has not
fallen: this pass found one in a shape the census can enumerate (8 of 93 entries), which means the next
passes should be chosen by census rather than by convenience. What would move the belief now: the
destination rule decided and luxuanwen3 shipped under it; one pass over a second entry from the census
(shihai4h or SS3B_0016, the Wikipedia shape) read the same way; then the two passes the previous section
asked for.

## What the luxuanwen3 re-run on the either-rendering build showed (2026-09-04, 12:43 UTC)

Run on `82888d43b`, OpenRouter alone, read in `doc/planning/translation-repair-openrouter-2026-09-03.md`
("The luxuanwen3 re-run on the either-rendering build"). The rule held at every slice: the moved link passed
in every lane, consolidation settled all nine slices, and nothing was reattempted. The publisher refused the
page 56 minutes and 4.24 USD in, because its own destination check still read the source alone.

WHAT IT FOUND: not a new class in the corpus but a gap in the fix itself, the kind a reading of the decision
record should have caught before the run (the record said the publisher was unchanged, and that was the
defect). Fixed and guarded the same hour (`1c9663666`); the fix also surfaced two tests still asserting the
old rule, which the full suite had not been run against since the rule landed.

THE READING: unchanged, not yet ready. A defect found in the pipeline's own fix counts against the rate the
same as one found in the corpus. What would move the belief now is unchanged from the previous section:
luxuanwen3 shipped and read under the rule, SS3B_0016 (the Wikipedia shape) shipped and read, then the two
passes the earlier section asked for. Both entries are running on `e66da50ef` since 13:51 UTC.
