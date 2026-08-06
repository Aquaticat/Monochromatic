# Grading round three of the translation-repair precision gate

Round three asks TWO questions and hands you TWO files to answer them in.
This is the first round with a second sheet,
so the ordering below is not a formality:
grading them out of order changes what the first number measures.

## Before you start

Both sheets quote UNLICENSED corpus text.
They live outside the repo,
under `node_modules/.monochromatic/translation-repair-runs/`,
and must never be committed.

The files are named after the draw seed:

```text
grading-sheet-milestone-three-precision-round-three.md
repair-sheet-milestone-three-precision-round-three.md
sample-manifest-milestone-three-precision-round-three.json
```

A `-preliminary` suffix means a scratch draw taken before coverage filled.
Those are meant to be redrawn and are not the gate.

The manifest is not for you to read.
It records which issue sat at which sheet position,
which is the only way a grade you write can be matched to what the pipeline
thought about the same item.
It is written in the same instant the sheets are,
because re-running the draw does not recreate it:
the draw is deterministic in its seed but not in its pool,
and the pool grows with every entry that settles.
Keep it beside the sheets;
without it the repair grades cannot be scored against anything.

## Step 1: grade the detection sheet, and only that

Open `grading-sheet-...-round-three.md`.

Each item asks one question:
is this accepted issue a REAL translation defect,
or a false positive?
Replace `[ ]` with `Y` or `N`.

Add rationale freely after the letter.
Both earlier rounds carry rationale that nothing else reproduces,
and it is read:
round two's notes are what raised the repair-quality question in the first
place.
Either form parses:

```text
### 3. grade: [Y]  (Y = real defect · N = false positive)
### 4. grade: [Y, but the warmer word would be "naps"]  (Y = ...)
### 5. grade: N. The original does quote this.  (Y = ...)
```

If you cannot decide, say so instead of guessing:

```text
### 6. grade: [Not enough context to grade]  (Y = ...)
```

Answers that name no verdict are counted as DECLINED,
kept out of both the numerator and the denominator,
and reported separately.
A declined item is more useful than a coerced one.

DO NOT OPEN THE REPAIR SHEET YET.
Seeing a proposed correction makes an alleged defect look more real,
which moves these grades.
Round one and round two were both graded without any correction visible,
so reading the repair sheet first would compare round three against them
through a different instrument,
and the change of instrument would show up as if the pipeline had improved.

## Step 2: grade the repair sheet

Open `repair-sheet-...-round-three.md` only once step one is finished.

Item numbers match the detection sheet exactly.
For every item you graded `Y` there,
answer whether the text the pipeline produced actually fixes it:

```text
- repair grade: [ ]  (Y = fully fixes this defect and breaks nothing nearby · N = it does not)
```

`Y` means the returned wording resolves the defect AND introduces no new error
nearby.
A better phrasing existing does not make it `N`;
if you want to say so, write it as rationale after the letter.

Leave items blank where you graded `N` for detection:
there was no defect to fix,
so the question has no answer.

Some items carry no grade box at all.
That is deliberate, and the sheet says which case it is:

-   `not-selected`:
    a repair was written, but the unchanged text won its slice.
-   `withdrawn`:
    a repair was written, but the whole page was blocked as non-translation.
-   `no-region`:
    no targeted repair exists for that issue at all.

Those count against COVERAGE rather than against repair quality,
and the sheet shows what was attempted anyway so the attempt is visible.

Two things worth knowing while you read:

-   A `SHARED` line means one edit was written for several accepted issues at
    once, and names the other sheet items it repeats under.
    You will meet the same before-and-after text there.
    Judge it against the claim of the item you are on.
-   A `NOTE` about a naturalness pass means a later stage rewrote the slice,
    so the edit shown is not the final wording.
    The sheet then prints the slice as actually returned;
    grade THAT.

## Step 3: get the numbers

```bash
mise run //package/module/translation-repair:score-agreement -- \
  --sheet /ABSOLUTE/path/to/grading-sheet-milestone-three-precision-round-three.md
```

Pass an ABSOLUTE path.
The task runs with the package directory as its working directory,
so a repo-relative path resolves somewhere unintended.

It prints three precision readings and, when blind pre-grades were recorded for
the draw, the agreement rate against them:

```text
PRECISION items=50 scored=47 realDefects=37 strict=0.740 excluded=0.787 lenient=0.800 unscored=10,12,17
```

-   `strict` counts a declined item as a false positive.
-   `excluded` drops declined items from the denominator.
-   `lenient` counts a declined item as a real defect.

The gate bar is 0.9.
Earlier rounds by the same tool:
round one 0.560 / 0.636 / 0.680,
round two 0.740 / 0.787 / 0.800.

Output carries counts and sheet positions only,
never a quote or your rationale,
so it is safe to paste anywhere the sheets themselves are not.

## Step 4: score the new-defect probe against your repair grades

This round added a probe that asks whether a repair BROKE something nobody had
raised.
It runs in shadow mode:
it recorded verdicts and changed nothing about what shipped,
because until your grades exist there is no way to know how often it is wrong.

```bash
mise run //package/module/translation-repair:score-probe -- \
  --repair-sheet /ABSOLUTE/path/to/repair-sheet-milestone-three-precision-round-three.md \
  --manifest /ABSOLUTE/path/to/sample-manifest-milestone-three-precision-round-three.json
```

Absolute paths again, for the same reason.
Run without the two flags to see the probe's own counts and no comparison.

The line that matters is the second one:

```text
AGREEMENT joined=41 probeFlagged=6 refutedByHuman=5 sharedWithHuman=1 flaggedUnscored=0 unflaggedFailures=9
```

`refutedByHuman` is the only clean number there.
Those are items where the probe claimed the repair introduced damage and you
graded `Y`, which says the repair breaks nothing nearby.
You read the same wording and disagreed,
so each one is a correct repair that a gate would have thrown away.

`sharedWithHuman` is NOT the opposite of that and must not be read as
confirmation.
Your `N` fires both for a repair that did not fix its target and for one that
broke something,
and the sheet has no way to separate those,
so agreement there might be about a different defect entirely.
`unflaggedFailures` is an upper bound on what the probe missed, for the same
reason.

If `refutedByHuman` is a large share of `probeFlagged`,
the probe is not fit to block anything and the honest move is to leave it
recording.
If it is near zero, the probe is finding damage the pipeline currently ships.
Either way the decision about whether it should ever gate is yours;
you declined the four options offered and named a better one that has not been
written down yet.

## What this round cannot tell you

Round three changed many things at once:
the roster, the editor ensemble, the checker set, the quorum rule, the
adjudication policy, the house policy, the naturalness lane, and the
resolution-credit rule.
A precision delta will not be attributable to any single one of them.
Say so in the verdict rather than implying otherwise.
