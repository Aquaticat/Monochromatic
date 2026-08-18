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

ABOUT 240 CHARACTERS LEFT SLICE 3 AND ABOUT 240 ARRIVED IN SLICE 4.
Both lanes did it,
within a dozen characters of each other,
and they are separate judgements rather than one echoed twice:
across the whole entry they disagree about slices 0 and 5.

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

## What this does and does not settle

IT SETTLES THAT THE MECHANISM IS REAL AND VISIBLE.
A structural probe that never sees the pipeline's output
predicted which slices would move,
and the pipeline moved them,
in the predicted direction,
in both lanes.

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

## Read this against the replacement rate, not instead of it

The rate reading on the same entry is
1.0000 on flagged slices against 0.7143 on the rest,
pooled over both lanes.
That is direction only:
three flagged slices per lane,
and three of three is the largest number the instrument can print.
The lengths above are the more informative half of the same observation,
because they say WHAT changed rather than only that something did.
