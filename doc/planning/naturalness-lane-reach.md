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

## The lane also fails silently on an eighth of the corpus

Found 2026-08-13, after the reach measurement, by censusing findings across all
 56 settled entries.

The refiner is a ONE-model stage, so its quorum is one voice and losing that
 voice loses the stage. Across 129 refiner invocations, 34 heard nothing:

```text
  entries where the refiner answered every time        49
  entries where the refiner answered NOT ONCE           7

  gqt              10 invocations, 10 silent, 0 rewrites selected
  chunchun_yudong   7 invocations,  7 silent, 0 selected
  Xu_Yushu          6 invocations,  6 silent, 0 selected
  cheonwoomaeng     5 invocations,  5 silent, 0 selected
  a2581911655       3 invocations,  3 silent, 0 selected
  hakureico         2 invocations,  2 silent, 0 selected
  TLL1122           1 invocation,   1 silent, 0 selected
```

The failure is per-ENTRY and total, not a sporadic dropout. Every affected
 entry finished with `status` of `repaired`, so no deadline abort explains it,
 and the affected entries span 1498 to 9351 target characters and 33 to 143
 minutes, so neither size nor duration separates them from the rest. Entries
 that are not affected report `1/1 heard` throughout.

So the lane's real reach is smaller than the 12.0% eligibility figure suggests:
 those blocks were eligible, were selected, and were then never rewritten,
 because the only model that could rewrite them never answered.

The cause is not recoverable from the artifacts. `attemptStageCall` collapses
 every loss (refusal, schema mismatch, transport failure, timeout) into
 `heard: false`, warns with the reason, and discards it. The finding records
 only `stage-quorum-unmet (refiner 0/1)`, and nothing reads that finding.

This bears on the decision rather than settling it. Whichever option is chosen,
 a lane that silently does nothing on an eighth of the corpus is worth less
 than its reach figure implies, and a one-model roster is why one loss costs
 the whole stage. Option B triples the eligible blocks but would triple them
 against the same single voice.

## What has to be settled first

-   Whether changing line structure counts as damage. The introduced-defect
    probe judges wording; nothing asks about layout, so today the question has
    no instrument.
-   Cost. Three times the eligible blocks means three times the refine calls
    and three times the probe calls, against a provider that already returns
    transient failures under load.
