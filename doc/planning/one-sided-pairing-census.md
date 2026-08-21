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

## The sweep is deliberate, and that constrains the fix

`group-aligned.ts`, which is the grouper production actually uses through `slice-pair.ts`,
states the rule in its own region header:

> Unpartnered blocks are NOT dropped.
> A block the counterpart lacks joins the run being built, so the slice still covers it
> and a critic still reads it in context.
> Dropping it would hide whatever it contains, trading a false positive for a silent false negative,
> which is the worse failure:
> the run's text is sliced from first to last offset,
> so leaving a block out of the run would not even remove it from the text,
> only from the record of what the slice was built from.

That last clause is the constraint.
A run's text is the span from its first offset to its last,
so removing a block from the run's LIST changes only the record, never the text.
Any fix that just filters the list makes the artifact lie
while the judge still sees the same characters.

The unwired `group-source-first.ts` and `reflow-orphans.ts` already carry the concept the fix needs,
and state the cost honestly:

> A REGION WITH NO PAIRED UNIT LEAVES ITS BLOCKS UNCOVERED.
> That is text the archive has and the original does not, so no slice NEEDS it:
> assembly writes nothing there and the document keeps it byte for byte.
> What it costs is review, since no lane ever reads it.

So uncovered is not the same as deleted.
`splice-slices.ts` writes replacements over slice spans in offset-descending order,
and text between spans is never touched.

## The fix that follows from those two facts

Close the run at the unpaired block rather than extending across it.

At `Zha_Ke`, the run for source block 1 would end at `en[1]`,
the next run would begin at `en[4]`,
and `en[2]` and `en[3]` would fall between runs: covered by no slice, written by no lane, kept byte for byte.
The judges would then be shown 41 characters of source against 180 characters of standing English,
a ratio of 4.4.
That is just ABOVE the 2.1 to 4.0 slice band the bed showed, not inside it,
and the difference matters:
a legitimate pair sitting above the band top is why any size fence built on this
needs margin rather than being set at the band edge.

What this costs is exactly what `reflow-orphans.ts` already names:
the letter is never read by any lane, so nothing improves it and nothing checks it.
That is the right trade for a memorial letter the source never mentions.
Improving it is not what this pipeline was asked to do;
preserving it is.

WHAT STILL HAS TO BE DECIDED, and it is not settled by this document:
whether to close the run at EVERY unpaired target block
or only at ones above some size,
since a one-block orphan of thirty characters joining its neighbour is harmless
and closing the run there produces more slices than the budget wants.
`Zha_Ke`'s `en[2]` is 34 characters and its `en[3]` is 2909.

## The pairing schema already distinguishes a split from page-only content

The obvious worry about closing the run at every unpaired target block is a translation
that renders one Chinese paragraph as two English ones.
Freeze the second half and a lane rewriting the first half duplicates the content.

`readBlockPairing` in `pair-blocks-wire.ts` settles it.
Repeats are legal on both sides, and the comment says why:

> A translation may SPLIT one original across several blocks, which repeats the original,
> and it may MERGE several originals into one block, which repeats the translation.
> Both happen in this corpus.
>
> AN EARLIER VERSION REFUSED THE MERGE, on the reasoning that a passage renders one place.
> A live run refuted it: on `lintong` all six models independently paired one translation block
> with two originals, every reply was refused, and the entry fell back to scoring
> and collapsed to a single slice.

So a split rendering is expressible as `{source:1,target:1},{source:1,target:2}`,
and the roster has the vocabulary to say it.
A target block left unpaired is therefore a statement that no source block accounts for it,
not an artifact of a schema that could not express the split.
No size threshold is needed for correctness.

## The invariant this fix has to amend, deliberately

`assertSliceCoverage` in `slice-coverage.ts` checks BOTH sides,
and it exists because of a real incident:

> WHAT IT COST ON 2026-08-20: `lintong`'s closing paragraph, a friend's last message and its date,
> reached no slice while its English sat in a slice's incumbent.
> The repair lane, shown English with no original behind it,
> deleted the rendering of one clause and left a bare blockquote marker in the shipped text.
> Nothing reported anything; the entry settled with zero alignment findings.

Leaving target blocks uncovered would throw `SliceCoverageError` today, and it should.
The enemy that invariant was built against is SILENCE, not absence.

So the fix does not weaken it, it sharpens it.
Today a target block must be in some slice.
After, a target block must be in some slice OR in an explicit declined-by-pairing list,
and anything in neither still throws.
That turns "reached no slice" from a silent loss into a recorded decision,
and it is the same list the artifact finding needs, which is `#135`.

## Scope, stated so the next session does not widen it

TARGET SIDE ONLY.
Unpaired SOURCE blocks, which is `XIEPT2`'s direction,
keep being swept exactly as they are today.
Their correct treatment is the anchored unit,
and `#106` holds that pending evidence telling omission apart from merging.
Nothing measured here changes that.

## What landed, and what it deliberately does not do

Commits `86b5adca4`, `1186624fe`, `16cb04266`, `440faf7b4`, `1f7366ad8`, `bb7308c67`.
Written and committed before being built, because the consolidation bed's `dist` is frozen
between runs 8 and 9 and rebuilding it would destroy the only clean band pair there is.

`src/declined-target-runs.ts` reads which translation blocks a supplied pairing accounted for nowhere.
`groupNodesAligned` skips such a block AND CLOSES THE RUN AT IT,
so the block's bytes fall between two slice spans rather than inside one.
`assertSliceCoverage` takes the same list and now requires a target block to be in a slice
OR in that list, so a block in neither still throws,
and a declined block that turns up in a slice throws as its own named fault.
`document-preparation.ts` emits `alignment target-unclaimed` naming the blocks and their character mass,
into the same `alignmentFindings` channel that was empty on `Zha_Ke`.

Three restrictions, each one load-bearing.

ONLY A SUPPLIED PAIRING DECLINES.
`alignBlocks`, the scorer fallback, emits `target-only` steps too,
and those report where a heuristic ran out rather than a decision.

ONLY A PAIRING THAT PLACED EVERY ORIGINAL DECLINES.
`pairBlocksAcrossRoster` returns no pairs at all when no voice was usable,
and the caller passes that straight through.
Without this gate an empty pairing would declare every translation block declined
and take a whole section out of review in one step.
The cost is that an entry with a genuinely untranslated passage,
which arrives as a `source-only` step,
gets no declines at all.
The fix simply does not apply there, and that is the correct direction to fail in:
the harm being prevented is a memorial letter being deleted,
and the harm of not applying it is a slice staying exactly as wide as it is today.

TARGET SIDE ONLY, as stated already.

## The check still owed

Build, `lint:types`, `test:unit`, and GFP on the new guard.
Then the live one: `verify-157-live.mjs` in agent scratch runs the BUILT grouper
over `Zha_Ke`'s real blocks and the pairing the roster actually returned on 2026-08-20,
and asserts no run's span covers the letter.
Until that has run, this section describes intent rather than behaviour.
