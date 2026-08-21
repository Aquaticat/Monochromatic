# One-sided pairing: what the corpus actually contains

Measured 2026-08-21 for `#157`, over all 92 bilingual entries in
`one-among-us/data/people`, with `parseDocument` from the built package.
Zero provider calls.
The script is `container-asymmetry-census.mjs`, kept in agent scratch;
it prints entry identifiers, counts, and character spans only.

`#157` asked for this measurement before any pairing code was read,
on the reasoning that a source-to-standing character ratio names the broken slices without running a lane.
It does.
It also names a second population the task did not anticipate.

## The expansion band is tight, and `Zha_Ke` is the corpus extreme

English dense characters divided by Chinese dense characters, whole page, over 92 entries:

```text
min 0.16   p10 1.74   p25 2.12   median 2.41   p75 2.68   p90 2.86   max 12.73
```

Half the corpus sits between 2.12 and 2.68.
That is what Chinese-to-English expansion looks like when both sides carry the same content,
and it agrees with the 2.1 to 4.0 band the consolidation bed showed at slice scale.

`Zha_Ke` sits at 12.73.
The next entry is `MizuharaNagisa` at 5.33, and the one after that `zheermao101` at 4.78.
So the bed did not stumble onto a typical asymmetric entry.
It hit the single most lopsided page in the corpus,
more than twice as lopsided as anything else.

## Seven entries carry unequal container counts, and two of them carry real mass

Containers are rare: 17 of 92 entries have any, and 10 of those have equal counts on both sides.
The seven with unequal counts, by the dense characters held in containers the other side does not have:

```text
Zha_Ke            EN-only   3652   containers zh=0 en=1   page zh=278   en=3540
shihai4h          EN-only   1634   containers zh=0 en=1   page zh=5225  en=24190
XingZ60           ZH-only   1066   containers zh=14 en=9  page zh=15701 en=27484
cheonwoomaeng     ZH-only    602   containers zh=2 en=1   page zh=2200  en=2657
Chinatsu_Suzuki   EN-only    582   containers zh=0 en=1   page zh=2085  en=5005
interrgned        ZH-only    258   containers zh=1 en=0   page zh=4429  en=11476
mikaela_khara     ZH-only    250   containers zh=2 en=1   page zh=3092  en=8781
```

`Zha_Ke`'s single English container holds 3652 dense characters
against a Chinese page of 278 characters total.
The container holds more than thirteen times the entire source page.
`shihai4h` is the only other entry where a one-sided container exceeds a thousand characters.

## The finding that changes the fix: containers are not the population

The two entries furthest from the band in the other direction carry no containers at all.

```text
XIEPT2         ratio 0.16   blocks zh=129 en=10   dense zh=6773 en=1060
shi_Yumiaoya   ratio 0.33   blocks zh= 54 en=10   dense zh=3683 en=1207
```

`XIEPT2` has 129 Chinese blocks and 10 English ones.
The Chinese page carries six times the English page's characters.
Whatever pairs those 129 blocks against those 10 is doing something at least as one-sided
as what happened at `Zha_Ke`, in the opposite direction,
and the `#154` container widening does not touch it,
because there is no container to widen.

This is the scoping result.
`#154` made `Zha_Ke`'s faithful candidates parse, which was worth doing,
but a fix for `#157` that keys on containers would leave the two worst block-count asymmetries in the corpus untouched.
The fix has to key on the pairing declining, not on the shape that happened to cause the decline at `Zha_Ke`.

## The mirror direction has never been looked at

Every piece of evidence gathered so far is from the EN-heavy direction:
the standing English holds content the Chinese source does not,
so a faithful candidate looks like an addition and a deleting candidate looks faithful.

`XIEPT2` and `shi_Yumiaoya` are the ZH-heavy direction.
There the source holds content the standing English never covered.
What a panel does when shown 129 blocks of source against 10 blocks of standing text is unmeasured.
The consolidation bed has never included either entry.

## What this does not yet measure

Page scale, not slice scale.
An entry can sit inside the band overall and still contain one badly paired slice,
which is exactly what the bed found at `Zha_Ke#1` before the page ratio was known.
The per-slice ratio needs slicing to have run, so it costs either a lane run or a pairing cache.
Page scale is the cheap screen that names which entries to look at first;
it is not a substitute for the slice-scale census.

## Candidates this suggests for the bed

The consolidation bed currently runs 13 slices drawn from entries in the band.
`XIEPT2` and `shi_Yumiaoya` are the two entries most likely to produce a one-sided pairing
and neither has ever been run.
Adding one of them is the cheapest way to find out whether the ZH-heavy direction
fails the same way the EN-heavy one did.

## The pairing was not wrong, and `#157`'s stated cause is refuted

Measured 2026-08-21, after the census, from the pairing cache
`~/temp/agent/readable-20260820-pairings/Zha_Ke/pairing.efaf7d6f...json`
and the prepared artifact `~/temp/agent/readable-20260820/artifacts/Zha_Ke.json`.
Zero provider calls.

`#157` recorded that block pairing declines and then falls through to
`groupNodesAligned`'s monotone scorer, which never declines,
so an explicit refusal becomes a confident guess.
That is not what happened here.

The roster's recorded pairing for `Zha_Ke` is four correspondences:

```text
source 0 -> target 0     source 1 -> target 1
source 2 -> target 4     source 3 -> target 5
```

The Chinese page has four blocks and the English six.
Targets 2 and 3 appear nowhere.
The roster paired every source block and DECLINED TO PAIR the two English blocks
that carry content the Chinese does not have,
which is exactly the behaviour `#71` asked for.

Block sizes, dense characters, from the current parser:

```text
zh[0]  43  ->  en[0]   89   ratio 2.1
zh[1]  41  ->  en[1]  180   ratio 4.4
zh[2]  53  ->  en[4]   53   ratio 1.0
zh[3] 114  ->  en[5]  242   ratio 2.1
unpaired:      en[2]   34
unpaired:      en[3] 2909   (blockquote, the letter)
```

Every paired ratio sits in or near the corpus band.
The pairing stage produced a good answer.

## The slicer swept the declined blocks back in

The prepared artifact holds four delivery rows, one per SOURCE block,
and three of them carry exactly the English block the pairing named:

```text
chunk 0  source raw   43  incumbent raw  110  = en[0] exactly
chunk 1  source raw   41  incumbent raw 3875  = en[1] + en[2] + en[3]
chunk 2  source raw   56  incumbent raw   56  = en[4] exactly
chunk 3  source raw  116  incumbent raw  282  = en[5] exactly
```

Chunk 1 is the exception, and it is the exception by 3664 characters.
Normalized, its standing text is 3044 characters
against 180 for the block the pairing actually named,
so 93 percent of what the judges were shown at `Zha_Ke#1`
is the two blocks the roster had already declined to pair.

The raw ratio is 3875 over 41, which is the 94.5 the bed reported.
The dense ratio is 75.9.
Either way it is an order of magnitude outside the band every other slice sits in.

## What this changes

The fix `#157` proposed, making a declined pairing produce silence instead of a guess,
would not have prevented this, because the pairing already produced silence.
The defect is downstream:
slicing assigns every target block to some slice
whether or not the pairing named it,
so a block the roster deliberately left out reaches a judge anyway,
attached to whichever slice happens to be adjacent.

That is `#90`'s subject, "slicing sizes source runs by the incumbent,
and does not slice one-sided sections at all",
observed doing damage for the first time.

Nothing in the settled artifact records any of this.
`alignmentFindings` is empty,
and the only place the declined pairing survives is a cache file beside the run.
That is `#135`, and it is what made this take a pairing cache and a parser to reconstruct
rather than a single read of the artifact.
