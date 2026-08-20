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

## It is not stale artifacts, and it is not `#98`

TWO CANDIDATE EXPLANATIONS, both checked and both wrong.

NOT STALE. `align-blocks.ts` landed 2026-07-26, nearly a month before these runs, and
it is wired into subdivision through `group-aligned.ts` and `slice-pair.ts`, whose own
comment says pairing by shared index "was tried and is wrong". The run settled TODAY
mispairs `saurikissa` exactly as the older ones do.

NOT `#98`. That holds the SECTION-level shortcut, where equal chunk counts pair by
index and report nothing. `saurikissa` has one section on each side, so its section
pairing is correct. The drift is INSIDE the section, between paragraphs, which is
`alignBlocks`' job.

## Why the block aligner cannot see it

Its scoring is, by design, language-neutral: block kind, shared script-neutral tokens,
and a plausible length ratio. On this entry:

KIND CARRIES NOTHING, because every block on both sides is a paragraph, so the
kind-match score is constant across every candidate pairing.

TOKEN OVERLAP CARRIES ALMOST NOTHING, because the tokens it counts are Latin words,
digit runs and component names. Chinese and English paragraphs of ordinary prose share
none. `AirPods` is the rare exception.

LENGTH RATIO IS ALL THAT REMAINS, and one weak signal cannot hold a monotone walk on
course across eleven blocks.

THE ANCHORS EXIST AND IT CANNOT READ THEM. This entry carries transliterated names on
both sides throughout: a friend's name, three place names, a subculture's name, and a
person referred to by a Latin initialism. Every one is a strong pairing signal and
every one is invisible to a matcher comparing Latin tokens, because the Chinese side
is not Latin.

## The fix is one already written down for headings

`#71` proposed exactly this for the section aligner: "a matcher that scored heading
similarity, including transliteration and shared Latin substrings". The same matcher is
what the BLOCK aligner needs, and for the same reason.

That makes transliteration-aware scoring a shared dependency of `#71`, `#98` and this,
rather than three separate alignment tasks, and it moves it ahead of every stage-tuning
question: no prompt, window, panel rule or lane choice can be judged on runs whose
critics were shown the wrong paragraph.

## Settled with correct pairing

Two runs on the corrected build, 2026-08-20.

FIRST RUN found two defects in the pairing code itself, which is what a live run
is for. `saurikissa` paired 16 of 16 and settled cleanly; `lintong` collapsed
from five slices to one, because all six models paired one translation block
with two originals and the reader refused every reply. A translation may MERGE
paragraphs exactly as it may split them, and the reader forbade the mirror of the
case it allowed. Separately, pairing was bought on every resume, which
`pass-entry`'s own test caught.

SECOND RUN, with merges carried and the pairing cached:

```text
                    slices   alignment findings   pairing
  saurikissa             9                    0   16 pairs, 6 of 6 voices usable
  lintong                3                    0    9 pairs, 6 of 6 voices usable
```

`lintong`'s nine pairs over seven original and five translation blocks is more
pairs than target blocks, which only a merge can produce.

### What moved

```text
                    resolved   accepted   archive retention
  saurikissa
    baseline              23       63%          55.1%
    window                 6       35%          91.2%
    paired                34       44%          78.2%
  lintong
    baseline              23       79%          71.4%
    window                18       70%          77.1%
    paired                18       83%          71.4%
```

`saurikissa` resolves more than any earlier arm, and `lintong`'s panel accepts a
larger share than any earlier arm.

### What this does NOT show

ARCHIVE RETENTION FELL against the window arm, and that is not evidence either
way. `doc/decision/translation-repair-output-goal.md` decides the output is
judged against the ORIGINAL, never against the input translation, and retention
counts archive words. The window scores 91% partly by resolving six issues: an
arm that resolves thirty-four necessarily diverges more from the incumbent, and
a rare-word test cannot separate "removed what it should not have" from
"repaired a great deal correctly".

So the pairing work establishes that every stage now reads the paragraph it
should. It does not establish that the output is better, because that is a
source-anchored judgement and nothing here makes one. It is the same wall
`doc/planning/which-lane-ships.md` reaches.
