# The critics are shown the wrong paragraph

Found 2026-08-20 by reading one entry's source and translation end to end,
after the owner said to stop asking and measure, and not to hesitate to read the corpus.
No corpus text here: slice indices, lengths and ratios only.

## What reading `saurikissa` showed

Its Chinese and English say the same things in the same order.
The slicer still paired them wrongly, because the ENGLISH SPLITS A PARAGRAPH THE
CHINESE KEEPS WHOLE: a request for advice sits inside the previous Chinese paragraph
and stands alone in English. Everything after that point runs one block out of step.

Reading each pair the critics were actually given:

```text
slice 3    Chinese: a two-clause reply          English: a four-line passage that
                                                 belongs to the PREVIOUS Chinese block
slice 5    Chinese: a one-line quotation        English: a passage about eyeglasses
slice 6    Chinese: uniform, collections        English: travel, a cat
slice 7    Chinese: travel, a cat               English: relationships
slice 8    Chinese: relationships               English: a death, and grief
slice 9    Chinese: two quoted exchanges        English: the third day after a death
```

SIX OF ELEVEN SLICES PAIR UNRELATED PARAGRAPHS.
The artifact records `alignmentFindings: 0`.

## This explains almost everything chased this week

A critic shown English that genuinely is not in the Chinese beside it
files an unsupported-addition claim and is RIGHT to.
The panel accepts it and the editor removes the passage.
Every stage behaves correctly on the input it was handed,
and the result is that content the original DOES carry leaves the page.

It also explains why `#107`'s relocation window helps:
when the pairing is off by one block, the correct source IS the neighbour,
so showing the neighbours hands the critic the right text by accident.
THE WINDOW IS A WORKAROUND FOR MISPAIRING, not a fix for it,
and its measured benefit should be read that way.

It explains the panel accepting less under the window, the judges declining a lane
contest, and the repair lane deleting the specifics of a life. One cause underneath.

## How widespread

Chinese is denser than English, so a correctly paired slice sits in a narrow band of
character ratios. Against each entry's own median, at a 2.5x threshold either way:

```text
  lintong             4 slices   median 2.36   outliers 3
  saurikissa         10 slices   median 4.10   outliers 4
  wangzihao980        6 slices   median 1.49   outliers 2
  Chinatsu_Suzuki    12 slices   median 2.58   outliers 4
  GLaDOSister        10 slices   median 2.47   outliers 1
  dogesir_           10 slices   median 2.43   outliers 1
  Acheron, AmbeR_the_anpa, Anilovr, Arita        outliers 0

  POOLED             15 of 80 slices        18.8%
```

THIS UNDERCOUNTS. On `saurikissa` the ratio test flags four slices and reading found
six. A pair can be completely mismatched and still have an ordinary ratio, which is
exactly what happens when two adjacent paragraphs are similar in length. Treat 18.8%
as a floor.

## What follows

FIX THE PAIRING, and everything downstream is measuring something different.
Judging any stage, lane or rule on runs made with mispaired input is judging it on
noise, and several conclusions recorded this week rest on exactly that.

THE REPAIR LANE IS NOT TO BE DISCARDED over this, per the owner on 2026-08-20:
some entries were translated by a person, and those translations contain passages done
right and better than a fresh rendering. The incumbent is evidence and a starting point
worth preserving where it is right, which is what
`doc/decision/translation-repair-output-goal.md` already decided.
The defect here is that the pipeline cannot currently tell where it IS right,
because it is comparing it against the wrong paragraph.
