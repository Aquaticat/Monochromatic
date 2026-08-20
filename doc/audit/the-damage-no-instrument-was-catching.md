# The damage no instrument was catching

Date: 2026-08-20.
Zero quota: settled artifacts and the pinned corpus.
No corpus text: counts only.

## What happened

On `saurikissa` slice 4 the baseline repair lane replaced a hundred and thirty-six words
with twenty-one.
What it deleted was the concrete detail of a life:
what she wore, what she collected, how she kept it.
This is a memorial page.

EVERY INSTRUMENT IN THIS PACKAGE MISSED IT.
The document lost seventy characters out of four thousand four hundred and seventy-nine,
because the editor wrote generic prose where the detail had been.
So the length looks fine, the structure is intact,
nothing repeats, nothing is severed, no footnote breaks,
and the page has simply stopped being about a particular person.

## Measuring it properly

Hand-picking eight words to search for proves nothing, so:

DISTINCTIVE WORD = at least six letters, used at most twice in the archive.
Rare long words carry specifics: objects, places, names.
Common words survive any rewrite and say nothing about whether meaning did.

`saurikissa`, 216 distinctive words in the archive:

```text
REPAIR lane          kept   share    lost
  baseline            119   55.1%      97
  window              197   91.2%      19
  +quote fix          193   89.4%      23
  +panel evidence     181   83.8%      35
```

The baseline repair lane loses ninety-seven of them.
The relocation window cuts that to nineteen.

`lintong`, 35 distinctive words, same direction and much smaller:

```text
  baseline             25   71.4%      10
  window               27   77.1%       8
  +quote fix           30   85.7%       5
  +panel evidence      30   85.7%       5
```

## What this settles

`#107` IS VINDICATED, and not marginally.
The window exists to stop the pipeline deleting content on the theory that it is an
unsupported addition, and on the metric that measures exactly that it moves the repair
lane from 55% to 91% retention.

The earlier reading, that the window merely "halves repairs at no visible benefit",
was made with instruments that cannot see this damage class.
Half those repairs were deletions of things worth keeping.

## What it costs, stated against the same measurement

Both rules added on top of the window made retention WORSE:

```text
window            91.2%
+quote fix        89.4%
+panel evidence   83.8%
```

The panel-evidence rule also lowered panel support further
(`lintong` 72% to 65%, `saurikissa` 52% to 51%)
having been added to raise it.
It fails on both metrics it could be judged by,
so it is reverted rather than kept on the argument that made it seem reasonable.

ONE RUN PER ARM. The direction agrees on two metrics and two entries,
which is why this is acted on; the exact percentages are not to be quoted as stable.

## A caveat that matters for the lane question

The TRANSLATE lane retains 46% to 54% on `saurikissa` in every arm.
That is NOT comparable to the repair lane's number and must not be read as worse damage.
The translate lane writes a fresh rendering from the Chinese,
so it may express the same detail in different English words,
and a rare-word test cannot tell re-wording from deletion.

The repair lane edits the incumbent, so a lost distinctive word there
IS a detail removed or blurred.
The instrument is sound for the repair lane and only suggestive for the translate lane.
`doc/planning/which-lane-ships.md` must not use these numbers to rank the lanes.
