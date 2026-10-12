# Translation repair history: segment 1.2, part 02

Part 02 of [Translation repair history: segment 1.2](translation-repair-history-06-2026-08-19-to-21-segment-01-part-02.md),
whose index lists every part in order.

## CORRECTION: `no-region` means the panel said no, not that a quote failed to anchor

The fixed-build re-run settled on 2026-08-20 and refuted the mechanism recorded above.

THE EQUIVALENCE,
over every settled artifact carrying issues:

```text
issue rows examined                     574
no-region rows                          251
accepted rows                           323
accepted AND no-region                    0
not accepted AND carrying a region        0
```

`no-region` is exactly `status !== 'accepted'`,
with no exception in either direction.
It is not a downstream consequence of anything.
An issue the adjudication panel does not accept has no repair region
because nothing should repair it.

SO THE CHAIN RECORDED EARLIER IS WRONG IN ITS MIDDLE.
It read:
critic quotes a nearby block,
the quote cannot anchor,
`quote-not-found` doubles,
`no-region` more than doubles,
nothing is left to edit.
The first two steps are real and the quote fix addressed them.
The step from `quote-not-found` to `no-region` does not exist.

WHAT ACTUALLY MOVED,
and it moves the same way on both entries:

```text
panel acceptance     baseline   window   fixed
  saurikissa            63%       35%      28%
  lintong               79%       70%      57%
```

The window makes the adjudication panel accept fewer claims,
which is what the window is FOR:
it tells the panel that wording explained by a neighbouring passage is not a defect.

THE QUOTE FIX DID NOT RESTORE ACCEPTANCE,
it lowered it further.
That is coherent rather than surprising.
With the critic no longer quoting next door,
its claims are better formed and survive
to be judged,
and the panel then rejects them on the merits
instead of their dying earlier and invisibly at anchoring.

`quote-not-found` did respond to the fix,
at `saurikissa` 16 down to 7,
below the baseline's 9.
It is a real but much smaller effect than the acceptance change,
and it was never the thing driving the collapse.

### What this leaves open, stated plainly

Whether the rejections are RIGHT.
Acceptance falling from 63% to 28% is the window working as designed
or the window suppressing real defects,
and no count distinguishes those.
It is the same shape of question as `doc/planning/which-lane-ships.md`:
a judgement about meaning,
which telemetry cannot settle.

WHAT WOULD SETTLE IT:
reading a sample of claims the baseline ACCEPTED and the
windowed run REJECTED,
and asking whether the neighbouring passage really does
explain them.
That is a reading of settled artifacts and needs no quota.

### The panel's own votes, with the roster controlled

The acceptance change is not a threshold artifact.
The individual panellists vote differently:

```text
saurikissa panel votes    supported   unsupported   supported share
  baseline                      402           124              76%
  fixed                         230           212              52%
```

ROSTER CONTROLLED FIRST,
because a rate read over a shrunken roster says nothing:

```text
                    critic stages   voices heard   min per stage   claims   claims per voice
  baseline                     11             65               5       94               1.45
  window                       11             65               5       83               1.28
  fixed                        11             64               5       79               1.23
```

Sixty-five,
sixty-five and sixty-four voices,
never fewer than five at any stage.
The critics raise slightly fewer claims,
and the panel supports far fewer of them.
The second effect is much the larger.

So the window acts where it was aimed:
on the judgement of whether a claim is supported,
made by panellists who can now see the neighbouring passage.

## Pre-registered reading for the panel-rule run

Recorded 2026-08-20 BEFORE the run settles,
so the reading cannot be fitted afterwards.
Build under test carries `3da812110`,
which makes a panelist voting unsupported on
relocation grounds quote the nearby wording that holds the content.

### The state it has to move

```text
lintong      accepted   79%  70%  57%      supported votes  85%  74%  72%
saurikissa   accepted   63%  35%  28%      supported votes  76%  58%  52%
                     baseline window fixed                baseline window fixed

rosters, read first    lintong  30 / 29 / 30 heard, min 6 / 5 / 6
                    saurikissa  65 / 65 / 64 heard, min 5 / 5 / 5
```

The supported-vote share is the metric,
not the acceptance share:
it is the panelists' own judgement rather than the threshold applied to it,
and it declines monotonically on BOTH entries across all three arms.

### What each outcome means

```text
supported share rises toward baseline on both entries   the rule wording was the cause
rises on one entry only                                 not enough; one entry is one sample
flat or falling                                         wording is NOT what drives the
                                                        rejections; next suspect is the
                                                        non-literal translation policy (#44)
```

### One claim to correct while recording this

The marginal-rejection finding is `saurikissa` ONLY.
That entry has eight of thirty-two rejections decided by a single vote,
against one of fourteen in its baseline.
`lintong` has ZERO one-vote rejections in every arm.
So "a quarter of rejections turn on one vote" describes one entry,
not the pipeline,
and a reading of the new run must check both entries before repeating it.

### Still true regardless of how this run lands

`no-region` is `status != accepted`,
over 574 rows with no exception,
so nothing about this run can revive the anchoring story.
The question is only whether the panel's judgement is right,
and the four-critic inserted-clause case says it is sometimes wrong.

## The panel-rule run settled: the wording is not the lever, and the window is a TRADE

Read against the reading pre-registered before it landed.

### The pre-registered outcome, and it is the negative one

```text
supported votes    baseline   window   +quote fix   +panel evidence rule
  lintong               85%      74%          72%              65%
  saurikissa            76%      58%          52%              51%

rosters                lintong   30 / 29 / 30 / 29   min 6 / 5 / 5 / 5
                    saurikissa   65 / 65 / 65 / 65   min 5
```

Flat to falling on both entries,
which is the outcome recorded as
"wording is NOT what drives the rejections".
Every rule added made panel support monotonically worse,
and `lintong`'s rejections tripled from five to fourteen.

SO THE PANEL RULE WORDING IS NOT THE LEVER,
and no further rewording of it is worth
buying.
`#44`'s non-literal translation policy is the next suspect,
as recorded.

### But the window is NOT simply a loss, which the first reading of this would miss

Resolutions and damage across all four arms,
both entries pooled:

```text
arm                resolved   adjacent + document + severed
baseline                 46                              2
window                   24                              2
+quote fix               31                              0
+panel evidence          29                              2
```

Half the repairs,
and no difference in damage the instruments can see.
On its own that reads as a straight loss.

CONTENT REMOVED AT SHIPPED SLICES SAYS OTHERWISE,
on `saurikissa`:

```text
baseline          210 words removed
window             23
+quote fix         55
+panel evidence    62
```

The baseline deletes three to nine times as much text as any windowed arm,
and over-removal is the exact damage `#107` was filed about.
So the window trades repairs for restraint rather than simply losing repairs.

### What is actually undecided

Whether those two hundred and ten words deserved deleting.
If they were genuine additions the baseline is right and the window is over-cautious.
If they were relocated content the window is right and the baseline was damaging the text.
No count answers that,
and the damage instruments cannot:
they report zero to two events per arm,
which is a null from a probe too underpowered to show a difference of this size.

WHAT IS KNOWN TO BE WRONG,
in the window's direction:
four critics independently reported one inserted clause,
rejected two votes to three,
where neither neighbouring block mentions the inserted content at all.
That rejection had no relocation available to justify it.
So the window's rejections are not uniformly correct,
and its restraint is bought partly with false negatives.

### The honest position

`#107` is not a clean win and not a clean loss.
It halves repairs and it roughly quarters over-removal.
Choosing between those needs someone to read the removed passages,
which is the same wall `doc/planning/which-lane-ships.md` reaches
and the same wall the rejection question reaches.
Three independent lines of work now end at one judgement about meaning.

## Two findings that are worse together than apart

Noted 2026-08-20 while looking for a lane discriminator.

FIRST,
from `#107`'s work:
the repair lane deletes the archive's specifics.
Ninety-seven of two hundred and sixteen distinctive words on `saurikissa`,
and two hundred and fifty-five of one thousand two hundred and forty-eight
pooled over eleven pre-window entries.

SECOND,
from `doc/audit/incumbent-almost-never-wins-a-contest.md`:
on CONTESTED slices the translate judge replaces the archive thirty-seven times in
thirty-nine,
94.9%.

Each was recorded on its own and neither is new.
Put together they name one question:
the component that almost always prefers a fresh rendering
is the same component that would have to notice a rendering saying LESS.

If it cannot,
then nothing in the pipeline catches content loss AT DECISION TIME.
The content-survival check catches it at assembly,
after the choice is made,
and reports rather than acts.

THIS IS BIGGER THAN THE LANE QUESTION IT CAME FROM.
`#130` needs it to decide whether a per-slice judge between the lanes is viable,
but the answer bears on every slice the translate lane has ever replaced.

`#84` BUILT THE HARNESS FOR THIS AND ITS RESULT IS NOT RECORDED ANYWHERE.
`judge-fidelity-probe` constructs a damaged twin of a real archive slice,
word for word identical except one deletion or one spliced insertion,
and runs both directions and both ballot positions,
so a status-quo reflex scores half and only a judge that reads scores all four.
Two defect kinds,
because a deletion makes the faithful candidate the LONGER one
and an insertion makes it the SHORTER one,
so passing both is the only way to show it is not just preferring length.

Running it is the next thing,
and its reading is pre-registered:

```text
near 100%                     the judge reads for coverage; per-slice option viable
near 50%                      it keeps what it is given; the option is dead
deletion high, insertion low   it prefers more text rather than reading
```
