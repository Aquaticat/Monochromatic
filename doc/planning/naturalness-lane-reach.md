# How far the naturalness lane actually reaches

Measured 2026-08-13 across all 92 entries at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
This is a PROPOSAL. Nothing here is decided.

The lane was built guarded on purpose, so the question is not whether it is
 narrow but whether it is narrow for the reasons intended.

## The measurement, at production scope

Eligibility runs on SLICES, so it was measured on slices: align each entry,
 subdivide exactly as the pipeline does, and judge each slice's translation
 side.

```text
92 entries, 1243 slices, 2476 blocks

  ELIGIBLE                       297   12.0%

  skipped, not-a-paragraph       697
  skipped, multi-line            691
  skipped, too-short             670
  skipped, parse-degraded         94
  skipped, carries-markup         27
```

A first attempt measured whole DOCUMENTS instead and reported 6.7% eligible
 with 578 blocks lost to `parse-degraded`.
Both figures were wrong: at document scope one HTML comment anywhere
 disqualifies every block in the file, which is not what production does.
The slice-scope numbers are the ones to use, and `parse-degraded` is a sixth of
 what the document-scope run suggested.

So no hidden defect is suppressing the lane.
Three of the four large skip buckets are the filter working as designed.

## The one bucket worth questioning

`multi-line` skips any paragraph whose node text contains a newline.
Its stated rationale is that a newline can carry structure a single-line check
 cannot see.
Breaking those 702 multi-line PARAGRAPH blocks down:

```text
  carrying a structure marker (< | ]( ![ ` $ {)    45
  containing a markdown hard break                 37
  PLAIN PROSE that merely soft-wraps              620
```

Those 620 blocks run to a median of 212 characters, p90 413, max 1063: inside
 the 120 to 1200 window the lane already accepts.
By every criterion except the newline they are exactly what the lane exists
 for, and they outnumber everything it currently accepts.

Admitting them would take reach from 297 blocks to roughly 917.

## Options

### Option A: leave it

Pros:
 the guard is doing what it was written to do, conservatively;
 no change, no risk, no re-measurement of anything downstream.

Cons:
 the lane touches an eighth of the corpus when it could touch nearly half, and
 the excluded blocks differ from the included ones only by soft wrapping, which
 is an authoring habit rather than a property of the prose.

### Option B: admit soft-wrapped prose, keep excluding hard breaks and markers

Skip only when the paragraph carries a structure marker or a markdown hard
 break, both of which are already detected here.

Pros:
 triples the lane's reach on evidence rather than on a guess;
 the two exclusions that remain are the ones with a stated mechanism;
 `gateParagraphRewrite` still has to pass every protected atom, so the safety
 property the lane rests on is unchanged.

Cons:
 a rewrite returns one line where the document had several, so the lane starts
 changing line structure as well as wording, and nothing currently measures
 that;
 the introduced-defect probe would be judging three times as many regions,
 which costs provider capacity on a plan that already fails under load.

### Option C: admit them but preserve the wrapping

As B, plus re-wrap the rewritten paragraph to the original's line width.

Pros:
 keeps the diff to wording alone, which is what makes a repair auditable.

Cons:
 re-wrapping is a new deterministic stage with its own failure modes, and the
 corpus wraps inconsistently, so "the original's line width" is often not a
 single number.

## Ranking

B > C > A.

**B over C** because the wrapping problem is real but is not this decision's to
 solve: the corpus wraps inconsistently already, so a rewritten paragraph on
 one line is no more foreign to a file than the file is to itself. C adds a
 stage to protect a property the corpus does not hold uniformly.

**C over A** because A's conservatism is not free. It is declining to improve
 the majority of the prose the lane was built for, on a criterion that
 correlates with nothing about quality.

## What has to be settled first

-   Whether changing line structure counts as damage. The introduced-defect
    probe judges wording; nothing asks about layout, so today the question has
    no instrument.
-   Cost. Three times the eligible blocks means three times the refine calls
    and three times the probe calls, against a provider that already returns
    transient failures under load.
