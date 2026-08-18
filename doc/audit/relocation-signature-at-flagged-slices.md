# The relocation `#107` describes, measured in one settled entry

Read 2026-08-18 from `GLaDOSister.json`,
the first entry settled by the targeted flagged pass.
One entry decides nothing.
What it does is show the mechanism `#107` names,
in numbers,
at exactly the slices a structural probe flagged before the pass ran.

NO CORPUS TEXT IS REPRODUCED HERE.
Everything below is character counts and ratios.

## What the probe said, before any of this existed

`displacement-probe` flagged this entry with two relocation candidates
and a document baseline of 2.739 English characters per source character:

```text
high 3, low 2, surplus 254, deficit  91
high 3, low 4, surplus 254, deficit 100
```

Read plainly:
slice 3 carries far more English than its source accounts for,
and slices 2 and 4 carry less than theirs do.

The incumbent archive bears that out:

```text
slice  source chars  incumbent chars  ratio   against baseline 2.739
    2           266              638   2.40   slightly under
    3            42              369   8.78   more than three times over
    4           112              207   1.85   well under
```

## What the pipeline did to those slices

Both lanes shipped a replacement at all three,
and the character deltas are the finding:

```text
slice   incumbent   repair shipped   delta    translate shipped   delta
    2         638              648     +10                  610     -28
    3         369              128    -241                  120    -249
    4         207              458    +251                  434    +227
```

Slice 3 lost about 240 characters and slice 4 gained about 240,
in both lanes, within a dozen characters of each other,
and they are separate judgements rather than one echoed twice:
across the whole entry they disagree about slices 0 and 5.

NO TEXT ACTUALLY MOVED, and the first reading of this document said it did.
Checked by asking how many 40-character windows of the newly shipped text at slices 2 and 4
also occur in slice 3's incumbent wording:
the answer is ZERO, in both entries, in both lanes.
The content at the deficit slices is NEWLY WRITTEN,
not the surplus slice's wording carried across.
Length arithmetic looked like movement and was not evidence of it.

The test detects verbatim reuse rather than paraphrase,
so it rules out relocation of the text
and cannot rule out relocation of the meaning.

Afterwards the ratios sit near the document baseline where they were far from it:

```text
slice   incumbent ratio   repair ratio   translate ratio
    3              8.78           3.05              2.86
    4              1.85           4.09              3.88
```

Slice 3 came back to the baseline from more than three times it.
Slice 4 overshot,
from well under to somewhat over,
which is worth noticing rather than explaining away.

## It replicates in the second entry, with the archive discarded rather than moved

`lintong` settled next and the probe flagged the same shape,
`high 3, low 2, surplus 281` and `high 3, low 4, surplus 281`:

```text
slice  source  incumbent  ratio   repair shipped  ratio   translate shipped  ratio
    2      43         25   0.58              138   3.21                 131   3.05
    3      55        439   7.98              449   8.16                 189   3.44
    4      41         39   0.95              121   2.95                 115   2.80
```

THE DEFICIT SLICES WERE FILLED IN BOTH ENTRIES AND BOTH LANES,
from ratios of 0.58 and 0.95 back to about 3, against a document baseline near 2.8.

THE SURPLUS SLICE WAS TREATED DIFFERENTLY BY THE TWO LANES HERE.
Translate rewrote it from 439 characters to 189, keeping ZERO of its 150 windows from the incumbent.
Repair left it at 449, ten characters longer, keeping 167 of 410 windows.
So after the repair lane, `lintong` still carries its surplus at slice 3
AND newly written content at slices 2 and 4.
On `GLaDOSister` both lanes drained the surplus, keeping 2 and 1 windows of about 85.
Two entries are not a pattern; the difference is recorded so a third can confirm or refute it.

## What this does and does not settle

IT SETTLES THAT THE FLAGGED SLICES ARE WHERE THE ARCHIVE IS DISCARDED.
A structural probe that never sees the pipeline's output
predicted which slices would be replaced,
and every one of them was,
in both entries and both lanes,
with the surplus slice's wording largely or entirely rewritten rather than carried anywhere.

IT DOES NOT SETTLE WHETHER THE MOVE IS REPAIR OR DAMAGE,
and that is the whole of `#107`.
The pipeline pulled a passage back to the slice whose source carries it.
If the archive's translator moved that clause deliberately, for flow across a paragraph break,
then this undid a legitimate choice and no per-slice instrument could have known.
If it drifted by accident, this fixed it.
Telemetry cannot tell those apart,
because both look identical from inside one slice.

WHAT WOULD ANSWER IT is a human reading of these specific passages,
which is a much smaller ask than a general damage sheet:
the flagged slices in this pass number sixteen,
against the twenty items the last damage sheet carried.

## The critics are NOT what condemns the archive here

`#107` is titled for per-slice JUDGING condemning the archive,
and the natural reading is that critics file more claims where a relocation makes the incumbent
look wrong.
Counted from `chunkCritics[].claimAttributions` over the two settled entries,
that reading FAILS:

```text
             slices   source chars   claims   per slice   per 100 chars
flagged           6            559       71        11.8            12.7
unflagged         9            778      118        13.1            15.2
```

FLAGGED SLICES ATTRACT FEWER CLAIMS, not more,
on both denominators,
while shipping a replacement 100 percent of the time against about 72 percent elsewhere.
The busiest slice in either document is `GLaDOSister` slice 1, unflagged, with 30 claims.

SO THE TWO THINGS COME APART, and that is the finding.
Whatever makes a flagged slice always ship,
it is not that the critic stage complains about it more.

THE REMAINING CANDIDATE is the preserve-or-replace judgement in the translate lane,
which weighs a fresh translation of the slice against the incumbent wording.
A slice whose incumbent carries content its own source does not account for
loses that comparison almost by construction,
because the fresh translation matches the source and the incumbent visibly does not.
That is a DIFFERENT MECHANISM from the one `#107`'s title names,
and it predicts exactly what was observed:
replacement without extra criticism.

WHAT WOULD TEST IT: read the per-slice selection records rather than the critic claims,
and ask whether the incumbent's margin of defeat is larger at flagged slices.
That reading needs no new run.

SIX FLAGGED SLICES IS NOT A RESULT.
Both entries carry the same flag shape, at 2, 3 and 4,
so this is close to two observations rather than fifteen.
It is recorded now because it points the remaining analysis somewhere different,
and because a story that only ever gains confirmation is not being tested.

## Read this against the replacement rate, not instead of it

The rate reading on the same entry is
1.0000 on flagged slices against 0.7143 on the rest,
pooled over both lanes.
That is direction only:
three flagged slices per lane,
and three of three is the largest number the instrument can print.
The lengths above are the more informative half of the same observation,
because they say WHAT changed rather than only that something did.
