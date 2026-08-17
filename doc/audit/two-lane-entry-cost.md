# What a two-lane entry costs, measured end to end on 2026-08-16

The measurement `#92` and `#114` both wanted and nothing had: BOTH lanes over whole real documents,
under the production roster, against `HARD_CAP_MINUTES` of 180. Earlier figures came from bench
calls, which price a slice but cannot say whether an ENTRY finishes.

## The headline

TWO OF FOUR ENTRIES NEVER FINISHED. They ran the full three hours and produced no artifact.

Extrapolated over the corpus, a full pass under this configuration costs roughly 120 to 133 hours,
settles 76 to 78 of 92 entries, and spends 42 to 48 of those hours on the 14 to 16 entries that
abort at the cap having produced nothing. That is about a third of the whole budget bought and
thrown away, and it exceeds the 72 hour soft budget, so one pass cannot reach the end of the corpus
even in principle.

## What was run

`mise run //package/module/translation-repair:corpus-pass -- --only
Aniloviraw,zheermao101,aiyysk,XingZ60`, into a throwaway runs directory outside the repo, at
`tip=e79bb338 pipeline=sha256-tree-v1:e327ca8b`, which is the same pipeline hash the plan check ran
at. Entries were picked by `page.md` blob size at corpus pin `a41fc607`, over a distribution whose
minimum is 120 bytes, first quartile 1481, median 2323, third quartile 4557 and maximum 41720.

The four cover the first quartile, the median, the second largest entry and the largest.

## What it reported, verbatim

```text
TALLY XingZ60     status=ERROR   ms=10800001 aborted=true error=Timeout: XingZ60 exceeded its 10800000ms deadline
TALLY zheermao101 status=SETTLED slices=15 repairStatus=repaired repairIssues=37 repairAccepted=22
                  repairResolved=20 repairFindings=133 repairChanged=8 translateStatus=complete
                  translateChanged=9 documentsDiffer=10 alignmentFindings=0
                  selection=pending-human-decision ms=3917494
TALLY Aniloviraw  status=SETTLED slices=5 repairStatus=repaired repairIssues=28 repairAccepted=12
                  repairResolved=11 repairFindings=72 repairChanged=5 translateStatus=complete
                  translateChanged=4 documentsDiffer=5 alignmentFindings=0
                  selection=pending-human-decision ms=2121755
TALLY aiyysk      status=ERROR   ms=10800001 aborted=true error=Timeout: aiyysk exceeded its 10800000ms deadline
DONE processed=2 of pending=4; artifacts=2/92 elapsed=27639265ms
```

Seven and a half hours of wall clock for two artifacts. Six of those hours went to the two entries
that aborted.

## The rate, and what it is safe to read off it

-   `Aniloviraw`, 1481 bytes, 5 slices, 35.4 minutes: 1433 ms per source byte, 7.07 minutes per slice.
-   `zheermao101`, 2323 bytes, 15 slices, 65.3 minutes: 1686 ms per source byte, 4.35 minutes per slice.

THE PER-BYTE RATE IS THE STABLE READ of the two, and only because the per-slice one is not: the
smaller entry cost MORE per slice than the larger, 7.07 minutes against 4.35, so slices are not
interchangeable units and a per-slice figure taken from one entry does not carry to another. The
per-byte figures agree within about 18 percent across the pair; the per-slice figures differ by 63.

THIS IS TWO SETTLED ENTRIES. Two points establish a range, not a law, and nothing here separates
size from whatever else differs between two documents. What the two ABORTS establish is firmer,
because a timeout is not an estimate: entries of 21455 and 41720 bytes do not finish in 180 minutes
under this configuration.

Per-slice cost is exactly what `slice-cost-log.ts` was added to measure, and it emits nothing for
this run because it landed after the launch. The next run answers it directly rather than by
division.

## Where the cap falls

At 1433 to 1686 ms per byte, 180 minutes is spent at roughly 6400 to 7500 source bytes.

Against the corpus that is 14 to 16 of 92 entries, 15 to 17 percent, that cannot finish. The two
that aborted are predicted to need about 10 hours (`aiyysk`) and 19.5 hours (`XingZ60`), against a
cap of 3.

## What this does not say

-   NOTHING PER SLICE. Both settled entries report the lanes differing on most slices
    (`documentsDiffer=10` of 15, and 5 of 5), and the window trial's negative control measured the
    per-slice preserve-or-replace decision as about 19 percent unstable between identical runs. The
    disagreement rate is worth noting; which slices disagreed is not evidence from one pass.
-   NOTHING ABOUT QUALITY. Both settled entries report `selection=pending-human-decision`, so this
    run priced the pipeline and decided nothing about the text.
-   NOTHING ABOUT A DIFFERENT ROSTER. This describes the configuration as launched, deliberately,
    including the `hf:zai-org/GLM-5.2` voice loss that `#105` addresses. It is the baseline any
    change to the roster or the deadline is measured against.

## What follows from it

The cap is not a safety margin that a few outliers cross. It is a wall that a sixth of the corpus
hits, and the budget it protects is spent in full by every entry that hits it. Three responses are
available and they are not exclusive:

1.  MAKE LARGE ENTRIES CHEAPER, which is where the per-slice telemetry points. If cost is dominated
    by slice count rather than slice size, the lever is slicing; if by voice loss and retries, the
    lever is `#105`.
2.  LET A LARGE ENTRY SPAN RUNS. The slice cache already resumes finished slices, so an entry that
    aborts has not necessarily lost its work; what is lost is the artifact, since nothing settles.
    Whether a partly settled entry can be resumed to completion across runs is the question this
    raises and does not answer.
3.  RAISE THE CAP, which trades one abort for a longer blocking run and does not survive
    `XingZ60` at 19.5 hours in any case.

Nothing here is decided. The measurement exists so the choice is made against numbers.
