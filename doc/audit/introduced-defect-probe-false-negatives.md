# The introduced-defect probe misses the damage that actually ships

Measured 2026-08-20 from settled artifacts alone.
Zero quota, and NO HUMAN GRADING, which is the point of the exercise:
`#66` had been recorded as waiting on graded regions,
and it did not need them.

## The ground truth was already in hand

Two pieces of damage were established earlier by reading shipped output,
not by grading a sheet:

-   `lintong` ships a farewell that offers the same thing twice,
    counted as two occurrences of each of two distinguishing noun phrases
    against one occurrence in the translate lane
-   `saurikissa` slice 7 ships a sentence severed after its preposition,
    spliced onto an unrelated independent clause

Both are damage the repair lane introduced.
Both are exactly what an introduced-defect probe exists to catch.

## What the probe said about them

```text
saurikissa chunk 7    probe records 3   regions 3   all three probers found nothing   claims 0
saurikissa chunk 8    probe records 2   regions 2   all three probers found nothing   claims 0
saurikissa chunk 9    probe records 4   regions 4   all three probers found nothing   claims 0
```

The full roster was heard on every one of them,
so this is not a quiet stage or a lost voice:
three probers looked at the region and each reported nothing.

Across the whole flagged pool:

```text
entry            probe records   regions   regions with any claim   all probers found nothing
lintong                     27        27                        3                         24
saurikissa                  27        28                        3                         25
GLaDOSister                 49        50                        3                         47
dogesir_                    42        42                       10                         32
wangzihao980                18        18                        0                         18
```

The probe is not silent in general, which matters:
it raised 3 corroborated claims on `lintong` and 10 claim-bearing regions on `dogesir_`.
It simply did not raise either of the two defects that reached the finished documents.

## The two misses have different causes, and only one is fixable at the probe

`saurikissa` SLICE 7 IS AN IN-SCOPE FALSE NEGATIVE.
The slice was edited, its regions were probed, the full roster answered,
and a sentence severed mid-clause is precisely a within-region defect.
Three probers reading a region containing a broken sentence reported nothing wrong with it.

`lintong` IS OUT OF SCOPE BY CONSTRUCTION, and this is the more important half.
The probe compares a region before and after the edit that touched it.
The duplication is not inside any one region:
slice 3's edit legitimately kept wording it was not asked to remove,
slice 2's edit legitimately wrote a new rendering,
and the damage is that the assembled document now says the same thing twice.
Every region is defensible on its own.
No region-scoped instrument can see it,
however many probers vote and however well they read.

## Why this matters more than a rate

`#57` built this probe as telemetry and `#60` measured its FALSE POSITIVES.
Neither asked the question this answers:
of the damage that actually reached a finished document,
how much did the probe name.
On the two cases where damage is established, the answer is none.

THE SCOPE FINDING IS THE SAME ROOT CAUSE AS `#107`.
A per-slice pipeline gets per-slice instruments,
and both go blind to anything that crosses a boundary.
`#107` widened what the critic, panel and editor are SHOWN.
The probe was not widened with them,
so the pipeline can now discuss a relocation while its damage instrument still cannot see one.

## What follows, in order

1.  The probe's window should match the stages it audits.
    It is handed regions; it should be handed the neighbouring slices' shipped text too,
    for the same measured reason `#107` gives, and with the same one-section bound.
2.  A DOCUMENT-SCALE repetition check belongs beside it rather than inside it.
    The `lintong` case is detectable with no model at all
    once the whole assembled document is in view,
    and `window-gates.mjs` already does exactly that by deriving repeated phrases.
    That derivation is the prototype; it wants to become a stage.
3.  Only then is a false-negative RATE worth computing,
    because a rate over an instrument with a known blind spot measures the blind spot.

## What this does not claim

TWO CASES ARE TWO CASES.
This is a floor on the false-negative rate rather than an estimate of it,
and the pool is five hand-picked entries that may serve this comparison only.
What it establishes is that the probe misses damage that ships,
and that one of the two misses is structural rather than a matter of tuning.
