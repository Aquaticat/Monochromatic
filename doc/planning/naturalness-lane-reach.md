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

## The lane failed silently on an eighth of the corpus, and that is already fixed

Found 2026-08-13, after the reach measurement, by censusing findings across all
 56 settled entries.

READ THE DATE BEFORE THE FINDING. The 56-entry population ran from 2026-08-06
 to 2026-08-11, when the refiner was a ONE-model stage: quorum was one voice, so
 losing that voice lost the stage. Every one of the 34 losses is recorded as
 `refiner 0/1`, which is the artifact stating the roster size itself.

`eb21ffa6b`, on 2026-08-12, took the lane from one refiner to three, under the
 title "give every fan-out stage a quorum a single voice cannot meet". Quorum is
 now two of three, so the failure below no longer empties the stage. The problem
 this section describes was fixed before it was found, and what follows is
 therefore a record of a resolved defect rather than an open one.

It is kept because the measurement still says something about the lane's real
 reach on the population every existing figure was drawn from, and because the
 cause is worth naming.

Across 129 refiner invocations, 34 heard nothing, and the partition by entry is
 exact:

```text
  entries that never invoked the refiner               20
  entries that invoked it and it answered              29   (95 invocations, 0 silent)
  entries that invoked it and it NEVER answered         7   (34 invocations, 34 silent)

  gqt              10 invocations, 10 silent, 0 rewrites selected
  chunchun_yudong   7 invocations,  7 silent, 0 selected
  Xu_Yushu          6 invocations,  6 silent, 0 selected
  cheonwoomaeng     5 invocations,  5 silent, 0 selected
  a2581911655       3 invocations,  3 silent, 0 selected
  hakureico         2 invocations,  2 silent, 0 selected
  TLL1122           1 invocation,   1 silent, 0 selected
```

The partition is what makes this a finding rather than a dropout rate. No entry
 sits in between: an entry either heard from the refiner on every invocation or
 on none. Independent per-call failure at 26% cannot produce that, so the cause
 is a function of the ENTRY, meaning its content or the prompt built from it,
 rather than transport flakiness.

The clustering rests on `gqt` at 10 of 10, `chunchun_yudong` at 7 of 7 and
 `Xu_Yushu` at 6 of 6. `TLL1122` had a single invocation, where "never
 answered" and "one dropped call" are the same observation, so the singletons
 carry no weight on their own.

Every affected entry finished with `status` of `repaired`, so no deadline abort
 explains it, and the affected entries span 1498 to 9351 target characters and
 33 to 143 minutes, so neither size nor duration separates them from the rest.

So the lane's real reach is smaller than the 12.0% eligibility figure suggests:
 those blocks were eligible, were selected, and were then never rewritten,
 because the only model that could rewrite them never answered.

The cause is not recoverable from these artifacts. `attemptStageCall` collapses
 every loss (refusal, schema mismatch, transport failure, timeout) into
 `heard: false`, warns with the reason, and discards it. The finding records
 only `stage-quorum-unmet (refiner 0/1)`, and nothing reads that finding.
The run logs that carried the warnings no longer exist, checked rather than
 assumed: a search over surviving task output finds `voice lost` lines only
 from `pass13`, minutes old.

It is recoverable from a live run, though, with no code change. The warning
 names the reason (`schema-mismatch` and similar), so `pass13` writes it as it
 happens, and its voice losses are being collected into
 `node_modules/.monochromatic/translation-repair-runs-pass13/voice-loss.log`.
Since the failure is entry-determined, `pass13` should reproduce it on the same
 entries and name the cause.

What this leaves for the decision, now that the roster is three:

-   The reliability objection to Option B is GONE. Tripling the eligible blocks
    no longer triples them against a single voice, because a lost voice no
    longer empties the stage.
-   Every reach and damage figure drawn from the 56-entry population still
    understates the lane, since a twelfth of its entries were refined on no
    voices at all. Numbers taken from `pass13` onward will not have that.
-   The cause is worth naming, because the model is still on the roster. Every
    schema-mismatch voice loss `pass13` has recorded is Kimi-K3, across the
    editor, critic, panel and refiner stages. The one non-Kimi loss is GLM-5.2
    exceeding its exchange deadline, a different mechanism. Schema mismatch is
    the same failure family as the channel-marker defect fixed at the parser
    earlier, so that fix did not close all of it. Tracked as `#75`.
-   THE LANE ITSELF IS HEALTHY NOW, which is the part that bears on this
    decision. `refine-stage.ts` retries to a FULL roster rather than to quorum,
    and at 3 settled entries every one of the 13 `refine-candidates` findings
    reports `3/3 heard`, with no `stage-quorum-unmet` for any stage. Kimi-K3
    lost the refiner voice three times and was retried back each time. So the
    losses cost an extra call, not a narrower ensemble, and the reach figures a
    future pass produces will not carry the silent-lane deficit the 56-entry
    population does.

So the open question is no longer whether the lane survives a lost voice. It is
 whether one model losing its voice this often is acceptable on rosters where it
 sits, which is a separate decision from this one and is not blocking it.

## What has to be settled first

-   Whether changing line structure counts as damage. The introduced-defect
    probe judges wording; nothing asks about layout, so today the question has
    no instrument.
-   Cost. Three times the eligible blocks means three times the refine calls
    and three times the probe calls, against a provider that already returns
    transient failures under load.
