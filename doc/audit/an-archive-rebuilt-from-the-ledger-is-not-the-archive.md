# An archive rebuilt from the ledger is not the archive

Date: 2026-08-19.
Zero quota: every number here comes from settled artifacts and the pinned corpus.

## What went wrong

`findIntroducedRepetitions` decides whether the pipeline ADDED a repetition by counting a
phrase in the archive and in the shipped document.
The archive is therefore the denominator of every verdict it gives.

Two settled runs predate `#128`,
so their artifacts carry no `archiveText`.
To read them, a scratch instrument rebuilt the archive by joining `incumbentText`
across the per-slice delivery ledger.
That reconstruction is not the archive.
It covers only the SLICED regions.

For `lintong` the gap is exact and measurable:

```text
whole page.en.md at the pinned commit   1057 characters
artifact preparation.targetChars        1057 characters
ledger reconstruction                    925 characters
unsliced remainder                       132 characters
```

A phrase living in those 132 characters is invisible to the reconstruction,
so a repetition the AUTHOR wrote is scored as one the PIPELINE introduced.

## What it made me record that was false

The handover recorded that the check reproduces "the known `lintong` duplication",
identified as a phrase of six words and thirty-three characters,
archive once and shipped twice.

Against the real archive that phrase occurs TWICE in `page.en.md` itself.
It is the author's own repetition.
The pipeline neither introduced nor removed it.

```text
phrase 6w/33ch:90bddeb5   archive 2   baseline repair 2   new repair 2   faithful
```

Re-reading all five settled entries against their true archives gives a different pool
than the one recorded:

```text
BASELINE, true archives
  lintong        repair 0    (the ledger reading said 1)
  saurikissa     translate 1  4w/27ch:11f6602e   the only real finding in the pool
  dogesir_       0 both lanes
  GLaDOSister    0 both lanes
  wangzihao980   0 both lanes
```

The recorded claim of a finding in `dogesir_` is also stale:
it was measured before the content-word gate landed,
and that finding carries one content word,
so the gate drops it.

## The production path was never affected

`assembleRepair` passes `archiveText: targetText`,
and `targetText` is the whole incumbent document:
the same value the function uses as `incumbentText` and splices slices over.
The artifact agrees, since `preparation.targetChars` equals the whole file length.

So the shipped check has always counted against the whole archive.
Only the offline reader was wrong.
That is the good direction to be wrong in,
and it is worth stating plainly rather than leaving the reader to infer it.

## What the corrected reading actually shows

The instrument does fire on real introduced repetition,
just not on the phrase previously claimed:

```text
NEW RUN, true archives
  lintong        repair 1    6w/27ch:29296d3a   archive 1, shipped 2, REAL
  saurikissa     0 both lanes
```

`29296d3a` is new.
The baseline repair document contains it once.
The run under the relocation window contains it twice.
That run also carried the anchoring hole,
so the same attribution caveat applies:
the difference is measured, the cause is not yet isolated.

## Gate A was answering a different question

`window-gates.mjs` derives its phrases from a BASELINE SIGNATURE:
two occurrences in the baseline repair document and one in the baseline translate document.
It never consults the archive.

That signature does not identify introduced duplication.
It equally identifies a phrase the TRANSLATE lane dropped a copy of,
which is the failure the gate's own header calls the worse one.

Measured against the archive, every phrase gate A derived is faithful in the new run:

```text
phrase             archive  base-repair  new-repair   gate A said        truth
6w/33ch:90bddeb5      2          2           2        STILL DUPLICATED   faithful
4w/15ch:00abe124      1          2           1        ok                 no longer repeated
3w/13ch:8e291bbe      1          2           1        ok                 no longer repeated
```

So the gate's single FAULT is a false alarm,
and its two passes understate what happened:
two genuine duplications are gone rather than the document merely being left alone.

ATTRIBUTION, STATED CAREFULLY.
The run these numbers come from carried the relocation window AND the `NEARBY_RULE` hole
fixed in `afc7854b4`,
and that hole changed WHICH SLICES were edited at all by collapsing quote anchoring.
So "the window removed two duplications and added one" is more than one confounded
A/B over two entries can support.
What is established is that the documents differ in this way.
Isolating the window needs the re-run on the fixed build.

Both phrases the window fixed sit below the production content-word gate,
which requires two words of at least five letters.
Fifteen characters over four words and thirteen over three cannot clear it.
The instrument is therefore deliberately blind to short repetitions,
which is the tuning that took an earlier reading from five findings to one real one.
That trade is now measured rather than asserted.

## The rule this leaves behind

A derived denominator needs the same scepticism as a derived measurement.
When an instrument reconstructs one of its own inputs,
check the reconstruction against the real input before trusting any verdict built on it,
and prefer a length equality that must hold if the reconstruction is complete.
Here `targetChars` was in the artifact the whole time and would have caught it at once.
