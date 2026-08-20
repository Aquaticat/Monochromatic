# The judge can see a candidate that says less

Measured 2026-08-20 with `judge-fidelity-probe`, the harness `#84` built and never ran.
Spends quota. No corpus text here: counts and mechanics only.

## Why it was worth running now

Two findings sat in the record separately.

The repair lane deletes the archive's specifics:
ninety-seven of two hundred and sixteen distinctive words on `saurikissa`,
two hundred and fifty-five of one thousand two hundred and forty-eight pooled over
eleven pre-window entries.

And on CONTESTED slices the translate judge replaces the archive
thirty-seven times in thirty-nine, 94.9%.

The component that almost always prefers a fresh rendering
is the same component that would have to notice a rendering saying LESS.
If it could not, nothing in this pipeline would catch content loss at DECISION time,
since the content-survival check runs at assembly, after the choice, and only reports.

## The result

```text
overall      16 of 16 chose the complete text
  deletion    8 of 8
  insertion   4 of 4
  alteration  4 of 4
```

## Why this is not a length preference or a status-quo reflex

The harness was built to make both of those score badly, and they do not survive it.

A DELETION makes the faithful candidate the LONGER one,
so a roster that simply prefers more text scores perfectly on deletions alone.
An INSERTION splices in a sentence from elsewhere in the same document,
so the faithful candidate is the SHORTER one and the length habit scores zero.
Passing both, eight and four, is what shows the judges are reading.

BOTH DIRECTIONS AND BOTH BALLOT POSITIONS are run over the same pair.
Preserving is right when the incumbent is the clean text and wrong when it is the
damaged one, so a judge that keeps whatever it is given scores half.
Sixteen of sixteen against a fifty percent null is one chance in sixty-five thousand.

The damaged twin is otherwise word for word the clean text,
so it cannot lose on fluency, register or house style,
only on saying what the original says.

## What it settles

THE JUDGE READS FOR COVERAGE. The 94.9% replacement rate is therefore not evidence of
carelessness: these judges demonstrably notice a candidate that omits a proposition.

`#130`'s per-slice option is VIABLE on this evidence.
Handing the judge the repair lane's text as one more candidate asks it a question it
has been shown able to answer.

## What it does not settle

SIXTEEN TRIALS. Decisive against the fifty percent null and not a precision estimate.

THE FIXTURES MOVE WHOLE SENTENCES. A quietly dropped qualifier inside a sentence is
the harder case and is not measured here; `#84` recorded that limit and it stands.

SELF-PREFERENCE IS STILL UNMEASURED, since neither candidate is written by a model on
the roster. In production both candidates ARE roster-written, which is a different
question from this one.

TWO OF SIX JUDGES DECLINED on one trial, holding that neither candidate covered the
original. That is conservatism rather than failure, and the ensemble verdict was still
correct, but a lane contest where both candidates are imperfect will meet it more often.
