# Signals the pipeline emits and nobody reads

Measured 2026-08-13 across all 92 entries at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`, both sides of each.

`#71` was found because the artifact had been recording
 `alignment structure-mismatch` for weeks and nothing read it.
That is a pattern rather than an incident, so every signal the deterministic
 core emits was censused at once, and the census found a second defect.

## Census one: what the deterministic core emits over the 92-entry corpus

```text
PARSE findings, both sides of 92 entries
    95  html-comment-skipped
     3  invisible-line-masked

FOOTNOTE graph findings
    15  unresolved-reference        across 2 files

ALIGNMENT findings
     7  structure-mismatch          across 7 entries
     3  sections-merged
```

## The footnote graph was wrong, and nothing was reading it to notice

10 of those 15 unresolved references were FALSE.
`shihai4h/page.en.md` carries ten references and ten definitions, and a raw
 scan of the text finds every one of them, yet the graph reported
 `definitions: []` and called all ten references unresolved.

Cause: `parseDocument` built the node list from FLATTENED children and the
 footnote graph from the RAW ones.
Every definition in that file sits inside a disclosure container, so
 `flattenContainers` promoted them for the node list while the graph, walking
 the unflattened tree, saw a container where a definition should be.

The same disagreement corrupted identifiers.
`buildFootnoteGraph` names blocks `block/N` by position in the list it walks,
 so every id it emitted after a container named a different block than the one
 the document exposes under that name.

Fixed by flattening once and sharing the result.
After the fix: 5 findings across 1 file, all real.
`XingZ60/page.en.md` carries 5 references and 0 definitions while its Chinese
 side resolves 9 of 9, which is consistent with that translation being
 incomplete.
Corpus totals are 107 references against 102 definitions, and no graph
 identifier names a block that does not exist.

Nothing reads `footnoteGraph` outside `parse-document.ts`, which is why a
 deterministic detector could be wrong about 10 of its 15 outputs without
 anyone noticing.

## The alignment mismatch finding is a false alarm 6 times out of 7

Seven entries emit `structure-mismatch` and take the proportional fallback.
Only ONE of them actually mispairs:

```text
  Aniloviraw    chunks  1/1   equal counts, leading kinds differ   pairs by index
  Hangmster     chunks  1/1   equal counts, leading kinds differ   pairs by index
  interrgned    chunks  5/5   equal counts, leading kinds differ   pairs by index
  noname        chunks  4/4   equal counts, leading kinds differ   pairs by index
  yingying      chunks  1/1   equal counts, leading kinds differ   pairs by index
  XIEPT2        chunks  8/9   counts differ                        pairs by index
  XingZ60       chunks 15/13  counts differ                        SLIDES
```

Five of the seven have EQUAL chunk counts and differ only in the leading node
 kind of the first chunk, which is what the mirrored test also checks; the
 proportional fallback then pairs them by index anyway and no harm is done.
`XIEPT2` has unequal counts and still pairs by index.
Only `XingZ60` slides.

So the blast radius for genuine mispairing is one entry, and this is the right
 way to have established it.
An earlier check used HEADING counts as the proxy and got the right answer for
 the wrong reason: chunk counts are what the aligner compares, and they differ
 from heading counts because content before the first heading forms a chunk.

Anyone gating on `structure-mismatch` would discard six good entries to catch
 one bad one.

## Alignment never drops content

Checked separately, since a merge could in principle leave blocks in no pair:
 across all 92 entries, every block on both sides belongs to some pair.
`XIEPT2`'s extra target chunk is merged rather than lost.

## Four settled repairs shipped broken footnotes, and the detector was right there

The point of the fixed graph is that it can now be trusted, so it was pointed
 at the pipeline's own output: parse each settled entry's input translation and
 its `repairedText`, and compare the two graphs.

56 entries examined, 4 broken, 0 healed:

```text
Dethelly       refs [1]     -> [1]      defs [1]     -> [1 2]    orphan-definition 2
Futajuhuacha   refs [1 2]   -> [1 2]    defs [1 2]   -> [1 2 2]  duplicate-definition 2
Y1Ran          refs [1 2 3] -> [2 3]    defs [1 2 3] -> [1 2]    unresolved-reference 3
                                                                 orphan-definition 1
gqt            refs []      -> [1]      defs []      -> []       unresolved-reference 1
```

Four different corruptions:

-   `Dethelly` gained a definition nothing references.
-   `Futajuhuacha` had a definition duplicated.
-   `Y1Ran` lost a reference and a definition, from different footnotes, so one
    reference now points nowhere and one definition is orphaned.
-   `gqt` had a footnote reference INVENTED in a document that carried no
    footnotes at all, pointing at a definition that has never existed.

Three further entries changed footnote counts while staying internally
 consistent: `Huasheng` lost a matched pair, `XIEPT2` gained one, `hakureico`
 gained two. Those are not corruption on this measure, and whether a repair
 should be inventing or removing footnotes at all is a separate question.

Every one of the four passed the integrity check and shipped, because integrity
 is `downgradeCount`, which counts only MDX grammar downgrades. Breaking a
 footnote leaves the grammar perfectly valid.

This is the whole thesis in one measurement: the pipeline computes a
 deterministic detector for exactly this damage, on every document, and never
 consults it.

### What was done about it

`footnoteBreakCount` now joins `downgradeCount` in the candidate integrity
 gate: a patched chunk may carry no more footnote findings than the chunk it
 replaced.
Comparison rather than an absolute count, so a chunk holding a dangling
 reference the translation arrived with is still repairable.

Two limits, both deliberate and neither hidden:

-   The gate is CHUNK-scoped, like every other measurement beside it, so it
    sees damage a patch does within one chunk. A definition deleted in one
    chunk whose reference lives in another passes, because neither chunk's own
    count rises. `Y1Ran` may be exactly that shape. Catching it needs a
    document-scoped check, which is not built.
-   The measurement that found this compared WHOLE documents, so it does not
    prove each of the four would have been refused by a chunk-scoped gate. It
    proves the damage is detectable by a detector already running.

Both rest on the graph being right, which until 2026-08-13 it was not: it would
 have reported ten false breaks on `shihai4h` and could not see a definition
 inside a container at all.

## Census two: what a run records across the 56 settled entries

Taken 2026-08-13 from `node_modules/.monochromatic/translation-repair-runs`,
 collapsing each finding's parenthesised payload so kinds group.
Each pair is occurrences, then how many entries carry the kind at least once.

```text
    509  55  refine-skip block/0          43  16  group-index-out-of-range
    461  54  refine-skipped               41  18  refine-selected
    405  54  editor-candidates            34   7  stage-quorum-unmet
    405  54  editor-envelope-select       32  15  refine-recheck-passed
    405  54  editor-chunk-select          30  21  ambiguous-quote
    253  51  refine-skip block/1          24   8  missing-verdict
    137  44  refine-skip block/2          12   6  quote-outside-blocks
    225  45  quote-not-found              10   9  refine-declined
    129  33  empty-quote                   7   3  unknown-regrade-severity
    129  36  refine-candidates             5   5  alignment structure-mismatch
     64  30  refine-skip block/3           4   3  alignment sections-merged
```

The tail below those runs to single figures: `no-quotes`, `unknown-severity`,
 `unknown-vote`, `duplicate-check`, `missing-check`, `refine-rolled-back`,
 `non-translation dominance`, and the per-quorum `non-translation votes stand`
 lines.

Most of it is ordinary bookkeeping. Two families are not.

## Quote anchoring discards 398 critic claims, and the cause is still unknown

`quote-not-found` 225, `empty-quote` 129, `ambiguous-quote` 30,
 `quote-outside-blocks` 12, `no-quotes` 2.
Each one is a critic claim that never reached adjudication.
Confirmed at the call site rather than inferred from a TSDoc example:
 `repair-stages.ts` pushes the reason and returns an empty array, so the claim
 is dropped.

The buckets are different failures and must not be pooled.
`empty-quote` is a malformed model response,
 `ambiguous-quote` is a quote found more than once,
 and only `quote-not-found` is a location miss.

For that last bucket there is a mechanism the code cannot currently see.
The corpus soft-wraps its prose, so a paragraph holds line breaks that are not
 paragraph breaks. A critic quoting across a wrap returns a space where the
 document holds a line break. `locateQuote` searches byte-exact first, then
 falls back to `normalizePunctuation`, whose map covers curly punctuation,
 CJK corner brackets and U+00A0. Line breaks are deliberately absent from it,
 so both searches miss.

The competing explanation was ruled out first: if the critic prompt re-wrapped
 the text, a space-joined quote would be faithful to what the model was shown
 and the fix would belong at the rendering boundary instead.
`critic-prompt.ts` interpolates `sourceText` and `targetText` raw, so the model
 saw the line breaks and collapsed them itself.

### What was done about it

Telemetry only, in `a6bbeca50`. `quote-not-found` now carries a suffix naming
 what a soft-line-break collapse would have produced:
 `[line-break-collapsible]` for a unique hit, `[line-break-ambiguous]` for one
 that lands twice, nothing at all when the quote is genuinely absent.
No claim changes fate. `SLICE_CACHE_VERSION` went to 9 because findings are
 part of the cached payload.

Counting outcome TRANSITIONS rather than "does it locate now" is the point.
Collapsing line breaks makes the haystack more uniform, so some misses will
 become ambiguous rather than located, and a fix that traded silent discards
 for silent ambiguity would look like a win in a naive count.

Admitting those quotes was NOT done, and is blocked rather than merely
 deferred. A repair anchored to a quote spanning a wrap replaces several lines
 with one, which is exactly the line-structure question left open in
 `doc/planning/naturalness-lane-reach.md`. Landing it quietly would decide that
 question without asking.

### How much of the 225 the wrapping explains, bounded before the telemetry lands

Two attempts, one worthless and one usable. Both are recorded because the
 worthless one looks convincing.

The first compared the newline rate among quotes that DID locate (1.03% of
 5458 target anchors) against the rate a 41-character window covers a newline
 when slid across the same prose (28.06%). A 27-fold deficit, and meaningless.

It fails twice over. The corpus wraps at semantic boundaries, so lines are
 short (median 49 characters against a median quote of 41) and quotes are
 line-locked: 29.7% of located quotes are EXACTLY whole lines, 39.9% start
 flush after a line break and 46.0% end flush before one. A uniform-random
 window is not what a critic produces. Worse, the sample is survivors only, so
 "located quotes rarely contain newlines" is what BOTH explanations predict:
 critics rarely crossing wraps, and cross-wrap quotes failing and vanishing
 from the sample.

The second test avoids survivors entirely. If wrapping causes misses, entries
 whose prose wraps more should miss more, and the miss rate is computed against
 attempts rather than against successes:

```text
  54 entries with at least 10 anchoring attempts; median line length per entry
  spans 12 to 149 characters, so the split has room to show an effect

  prose mostly wrapped (share > 0.72)   26 entries   4.5% of attempts missed
  prose less wrapped   (share <= 0.72)  27 entries   3.1% missed

  median line <= 54                     27 entries   4.2% missed
  median line >  54                     26 entries   3.6% missed
```

Both splits move in the direction the mechanism predicts, and neither moves
 far. Treating the less-wrapped rate as the non-wrap baseline attributes
 roughly a quarter of the misses in the wrapped group to wrapping, so the
 expectation to hold going in is that soft wrapping explains a MINORITY of the
 225, not the bulk of them.

That is a bound, not an answer: the split is coarse, and entries that wrap more
 may differ in other ways. The suffix landed in `a6bbeca50` measures it
 directly, one failed quote at a time, and is the figure to believe.

### What the direct measurement says so far, against that prediction

At 3 settled entries `pass13` has produced 13 `quote-not-found` findings and
 NONE of them carries either suffix. The telemetry is confirmed live, because a
 bare reason can now only be produced by the line that always calls
 `lineBreakSuffix`.

Thirteen is enough to test the quarter:

```text
  if the true wrap share were   probability of seeing zero in 13
    25%                            2.4%
    20%                            5.5%
    15%                           12.1%
    10%                           25.4%
     5%                           51.3%

  one-sided 5% upper bound: true share <= 20.5%
```

So the prediction above is REJECTED at the conventional level.

### CLOSED at 30 misses: soft wrapping is not a material cause

The count reached the pre-registered threshold with none suffixed:

```text
  observations   5% upper bound on the true wrap share
      13              <= 20.5%
      17              <= 16.1%
      25              <= 11.2%
      30              <=  9.5%     <- threshold, 10% now rejected at 4.24%
```

Thirty `quote-not-found` findings, 23 source and 7 target, and not one carried
 either suffix. The point estimate was zero and the ceiling 9.5%.

AMENDED ONE HOUR LATER, and the amendment matters more than the number. At 33
 misses one IS suffixed, `quote-not-found (source) [line-break-collapsible]`,
 meaning a quote that collapsing soft line breaks would have located uniquely.
So the mechanism fires in practice, and "not one" expired exactly as two
 earlier universal claims about accumulating data did.

The bound LOOSENS with a positive observation rather than tightening:

```text
  1 of 33, point estimate 3.0%
  one-sided 95% upper bound  <= 13.5%   (was <= 9.5% at 30 with zero)
```

THE VERDICT IS UNCHANGED and now rests on the point estimate rather than on a
 zero. At 3.0%, admitting wrap-spanning quotes recovers about 7 of the 225
 misses in the settled population. Seven claims is not worth a behaviour change
 that also decides the line-structure question, and the change would still
 replace several lines with one.

What changed is the honesty of the claim, not the decision: this is "a small
 real effect", not "no effect".

THE SAMPLE WAS CHECKED BEFORE THE NULL WAS TRUSTED, because a lightly-wrapped
 sample would produce this result for an uninteresting reason. It is not
 lightly wrapped: the 7 settled entries have a median wrapped-prose share of
 69%, against 69% for the other 85 entries in the corpus. Individual shares run
 from 0% to 97%, so the medians matching is the relevant comparison.

VERDICT. The mechanism is real and is proven by unit test: a quote spanning a
 soft wrap, returned with a space, fails both the exact and the
 punctuation-normalized search. Its INCIDENCE in practice is about 3%, with a
 one-sided 95% ceiling of 13.5%. Admitting wrap-spanning quotes would therefore
 recover roughly 7 of the 225 misses in the settled population, so the
 anchoring change is not worth making.

The telemetry stays. It costs nothing, it is what closed this, and it will
 notice if a future corpus wraps differently.

CONSEQUENCE BEYOND THIS ISSUE: the line-structure question in
 `doc/planning/naturalness-lane-reach.md` now governs ONE change, the
 naturalness lane, rather than two. That decision got simpler rather than more
 valuable, reversing what was recorded earlier.

### What the misses are NOT, which narrows what they can be

With wrapping ruled out, the next candidate was a pipeline bug rather than
 model behaviour: that the text a critic is SHOWN differs from the text
 `locateQuote` SEARCHES. Any divergence there would defeat quotes wholesale and
 would be ours to fix.

There is none. `repair-chunk.ts` parses `documents` from exactly the
 `sourceText` and `targetText` it then passes to the critic phase, and both
 travel together into `runChunkCriticPhase`. `RepairDocument.text` is the
 original source byte-for-byte rather than the masked variant, so masking does
 not separate them either.

So the remaining candidates are all model behaviour: paraphrasing instead of
 quoting, eliding with an ellipsis, quoting across the chunk boundary it was
 shown, or inventing text. Those cannot be told apart without the failing
 quote, which nothing retains.

That is worth stating positively rather than as another dead end. The expensive
 branch, a systematic defect in our own plumbing, is eliminated. What is left is
 a telemetry gap with a known and cheap remedy.

The direction matters for the decision this feeds. If soft wrapping explains
 little, the anchoring lead closes, and the line-structure question in
 `doc/planning/naturalness-lane-reach.md` governs one change rather than two.

### The side split varies by entry, so do not compare a sample to a population

The quote-family findings carry a side, `source` or `target`, and across all 56
 settled entries `quote-not-found` is almost exactly even, 112 against 113.

At 7 settled entries `pass13` shows 17 source against 3 target. Under an even
 split that is about a 0.26% outcome, which looks like a pipeline change and is
 not one.

The controlled comparison is the same entries in both runs, and it dissolves
 the effect:

```text
                          pass13    old run, SAME 7 entries
  quote-not-found source     17        12
  quote-not-found target      3         6
  empty-quote source          6         7
  empty-quote target          4         3
```

Those seven entries were ALREADY source-skewed in the old run, 12 against 6,
 while the corpus overall was even. The same holds for `empty-quote`, whose
 corpus-wide skew of 112 source against 17 target is driven by entries outside
 this sample entirely.

So the side distribution is an entry property, and comparing a 7-entry sample
 against a 56-entry population measures which entries were drawn rather than
 what the pipeline did. Compare the same entries, or do not compare.

This is the second finding in one session to dissolve the same way; the other
 was a `needs-human` share that looked like a threefold shift and turned out to
 be one entry. Both were caught, but both were nearly written down.

### A gap this exposed

The failing quote is not retained anywhere. Artifacts keep adjudicated issues
 only, 2650 accepted plus 1033 rejected plus 415 needs-human, and a claim
 discarded at anchoring never becomes one. So the incidence of each mechanism
 cannot be measured from the existing 56 entries at all, only from a pass run
 after the suffix landed. A recorded signal that omits the evidence needed to
 act on it is the same failure this document is about, one layer down.

## The rejected-value family is small, and checked so nobody re-opens it

Every `unknown-` finding carries the value the model actually sent, so the
 census can read them off rather than guess. Over the same 56 entries there are
 nine in total:

```text
  4  unknown-regrade-severity ()
  2  unknown-regrade-severity (massive)
  1  unknown-regrade-severity (small)
  1  unknown-severity (minor,)
  1  unknown-vote (support)
```

Severity accepts `neutral`, `minor`, `major`, `critical`.
So four are the model omitting the field, three are it inventing a word outside
 the vocabulary, and one is an invented vote.

The ninth is the interesting one. `minor,` is a VALID severity rejected for a
 trailing comma, which is the same shape as the Kimi-K3 channel-marker defect:
 a good answer lost to a formatting artefact rather than to disagreement.
It is one occurrence out of 4098 adjudicated issues, so it is recorded rather
 than acted on. Should this family grow, punctuation trimming before the
 vocabulary check is the cheap half of the fix.

## The refiner goes silent on whole entries

Recorded in full in `doc/planning/naturalness-lane-reach.md`, because it bears
 on a decision waiting there. In summary: `stage-quorum-unmet` is 34
 occurrences and every one is `refiner 0/1`, which is the artifact stating the
 roster size itself. The partition is exact, 29 entries heard from it always
 and 7 never, so the cause is entry-determined.

ALREADY FIXED, and the census predates the fix. That population ran to
 2026-08-11, and `eb21ffa6b` on 08-12 took the lane from one refiner to three.
Quorum is two now, so a single lost voice cannot empty the stage, and `pass13`
 shows every `refine-candidates` finding at `3/3 heard`. The finding stands as
 a description of the old population and not of the current pipeline.

`quorumMet` itself is read where it matters. `restoration-judge.ts` and
 `derivability-probe.ts` both mark a seed unjudged rather than accept a
 minority verdict. The other eight callers of `gatherStageVoices` do not read
 it, relying on their own downstream guards.

## Dropped merge opinions do not explain the duplicate issues

`group-index-out-of-range` is the adjudication panel naming a cluster number
 that does not exist; `adjudicate-wire.ts` drops that merge opinion and records
 the finding. A dropped merge opinion leaves claims unmerged, which looked like
 a candidate mechanism for the duplicates in
 `doc/planning/duplicate-accepted-issues.md`.

Measured over the same 56 entries, split by whether an entry carries any
 dropped merge opinion:

```text
  entries WITH a dropped merge opinion   16 entries  1503 accepted  36.8% duplicate
  entries WITHOUT                        40 entries  1147 accepted  35.1% duplicate
```

No effect, and no monotone relation inside the affected group either: the entry
 with the most dropped opinions has a lower duplicate rate than several
 carrying one. The hypothesis is refuted.

The duplicate rate here is higher than the 21.5% recorded in the planning doc
 because the key is looser. This measurement groups on an issue's first
 target-side span, where the planning doc required every span to match. They
 count one phenomenon at two strictnesses, and neither contradicts the other.

## The recurring wall: outcomes are recorded, causes are not

This document is a census of signals the pipeline EMITS. Four separate
 investigations in one session stalled on the opposite problem, and they stall
 the same way, so it is worth naming as one thing rather than four.

-   ~~`quote-not-found` records that a quote failed to anchor, and discards the
    QUOTE.~~ FIXED 2026-08-13 in `b8c678e0a`: the finding now carries a bounded
    preview of the needle. The 225 misses already recorded stay undiagnosable,
    but future ones name the quote that missed. See "The wall came down on one
    of the four".
-   ~~`schema-mismatch` records that a model reply failed to parse, and
    `attemptStageCall` discards the `rawText` the outcome carries.~~ FIXED
    2026-08-13 in `256520df7`. See "The second wall came down, and the client
    was never the problem".
-   Accepted issues record their claims but NOT which critic raised each one.
    So `#65` cannot ask whether a duplicated issue is independent
    corroboration, because independence means "different critics" and the
    artifact cannot say.
-   The refiner's silences recorded `refiner 0/1` and no reason, so the cause
    was only recoverable once a live run was watched.

The shape is identical every time: the pipeline records WHAT happened and drops
 WHY, so any question about cause needs a fresh run rather than the artifacts
 already paid for. Each of those runs costs days.

The four cases share one remedy: retain the reason alongside the outcome at the
 point the outcome is recorded, truncated where the payload is large. That was
 first written here as "cheap", which is a claim with a number behind it, so
 here is the number:

```text
  56 artifacts, 15362 KiB total, median 274 KiB each

  failed quote text        255 x 120B =  30 KiB
  truncated model replies   34 x 500B =  17 KiB
  critic id per claim     5453 x  28B = 149 KiB

  TOTAL                                 196 KiB  = +1.3%
```

So the whole remedy costs about a hundredth of what the artifacts already
 occupy, and the largest single part is the critic attribution that `#65`
 needs.

One correction while measuring this: the same paragraph originally justified
 caution by saying artifacts "already carry full repaired text", implying that
 is the bulk. It is not. `repairedText` totals 240 KiB across all 56 artifacts,
 under 2% of the 15362 KiB; the bulk is the 5453 recorded claims and their
 quoted spans. The caution was pointing at the wrong thing.

Raised here rather than acted on, on scope rather than on cost. It would change
 what `#65`, `#72` and `#75` can be answered from, so it belongs in a priority
 conversation rather than in a commit landed overnight.

## What still reads nothing

`alignment.findings` is turned into scorecard text and recorded, and reaches no
 stage that could act on it.
`footnoteGraph` was in that position until 2026-08-13 and no longer is:
 `footnoteBreakCount` reads it, and the chunk-integrity gate refuses a patch
 raising the break count.
The quote-anchoring findings are recorded, and now carry a diagnosis, but
 nothing acts on them either.
Whether any of these should is a design question this document does not settle.

## The `#72` re-open alarm was a pooling artifact, and the closure stands

Fired 2026-08-13 by the run monitor: "`pass13` `#72` VERDICT AT RISK: 8 of 58
 wrap-explained. The closure assumed about 3%; this is nearer 10%."

The figure is arithmetically right and the conclusion is wrong. It pools two
 populations that the artifact tree keeps separate:

```text
  artifacts     39 quote-not-found   1 collapsible    2.6%
  slice-cache   19 quote-not-found   7 collapsible   36.8%
  pooled        58                   8              13.8%
```

`#72` was closed on the SETTLED-ARTIFACT population, and that population reads
 2.6% here against the roughly 3% the closure assumed. It is the same number.
The closure stands and needs no re-taking.

This is the third time this session that a share computed over the wrong
 population produced a false alarm, after the needs-human share and the
 quote-side split. The tell is identical each time: a rate that moves by a
 factor of three or more between a small reading and an established one, where
 the small reading silently spans a different set of things.

THE MONITOR SHOULD BE FIXED RATHER THAN THE DOCUMENT. It globs every `.json`
 under the run root, so it will keep pooling `slice-cache` with `artifacts` on
 every future check, and every future firing will overstate the same way.

### The slice-cache reading is a real leading indicator, not noise

36.8% against 2.6% is not a rounding difference, and it deserves an explanation
 rather than a dismissal.

The likely one is timing rather than behaviour. `artifacts` holds SETTLED
 entries and `slice-cache` holds slices of entries still in flight, so the cache
 is a window onto work that has not yet reached an artifact. If those 7
 collapsible failures settle as they stand, the settled share rises and `#72`
 genuinely would need re-taking.

Held as a WATCH ITEM rather than a finding, for two reasons. The cache total is
 19 observations, which is small enough that a couple of entries dominate it.
And the direction is not established: nothing here shows a cached failure
 reaching an artifact unchanged, which is the step the inference needs.

Re-read both populations separately when `pass13` settles more entries. The
 comparison that matters is artifact-share then against artifact-share now, and
 it is the only one that speaks to the closure.

### It fired again on the settled population, and it was one entry

The fixed monitor, counting `artifacts` alone as it should, alarmed at 12
 settled entries: 8 of 59 wrap-explained, 13.6%, against the roughly 3% the
 closure assumed. On the right population, with the pooling bug gone.

It is still a false alarm, and the reason is the one this session keeps
 relearning:

```text
  Futajuhuacha        7/20     35%
  Aniloviraw          1/6
  every other entry   0/33

  all 12 entries      8/59     13.6%
  excluding the top   1/39      2.6%
```

Seven of the eight hits are ONE entry. Drop it and the share is 2.6%, which is
 the closure's number to within noise. `#72` stands, again.

The watch item recorded when the pooling bug was fixed did predict this
 correctly in one respect: the in-flight `slice-cache` hits were 7 of 19, and
 they settled into `artifacts` unchanged, so the cache was a genuine leading
 indicator of what would land. What it led to was an outlier, not a population
 shift.

#### The guard that generalises all three false alarms

Three alarms this session, three different surface causes, one shape:

-   `needs-human` at 31%, which was `AmbeR_the_anpa` alone.
-   Wrap-explained at 13.8%, which was `slice-cache` pooled with `artifacts`.
-   Wrap-explained at 13.6%, which was `Futajuhuacha` alone.

A threshold on the share cannot separate these from a real shift, and the
 second and third cases prove that fixing one surface cause does not stop the
 next. The rule that does separate them is stated once and applies to all:

A share is a POPULATION signal only if it survives dropping its largest single
 contributor.

The monitor now computes both figures and alarms only when BOTH clear the
 threshold. It reports the excluded-top share on every progress line too, so the
 concentration is visible before it becomes an alarm rather than after.

#### Left open, and worth a look when the pass ends

`Futajuhuacha` really is 35% wrap-explained where every other settled entry is
 near zero. That is a fact about one entry rather than about the pipeline, but
 nothing here explains WHY one entry's critic quotes should fail line-break
 collapse at ten times the corpus rate. Cheap to check once the pass stops:
 whether that entry's target text is wrapped differently from the rest.

## The wall came down on one of the four

The recurring wall says outcomes are recorded and causes are not. One of its
 four instances is now fixed, and what forced it is worth keeping, because the
 wall had been recorded twice without anything changing.

WHAT FORCED IT was a concrete blocked question rather than the principle.
`Futajuhuacha` runs at 35% wrap-explained where every other settled entry is
 near zero. Trying to explain that:

-   The obvious hypothesis, that the entry is wrapped differently, is REFUTED.
    At 8.3 intra-paragraph line breaks per thousand characters it is
    unremarkable: `AkiraComplex` is 18.0, `Aniloviraw` 16.7 and `Anilovr` 14.4,
    all with zero or one wrap-explained miss, and `Dethelly` is higher again at
    8.9 with none.
-   The next hypothesis, that its critics quoted longer spans, CANNOT BE TESTED
    from the artifacts. Reconstructing the anchoring over every claim span in
    all 12 settled entries found 1027 target spans and every single one located
    exactly, with none needing a collapse and none missing.

That second result is the wall itself, stated precisely. Claims that FAIL
 anchoring never become issues, so they never reach the artifact, so the only
 quotes an artifact carries are the ones that succeeded. The failures are
 counted and their text is gone.

THE FIX is one call site. `lineBreakSuffix` already had the needle in scope, so
 the finding now appends a bounded preview: line breaks collapsed so a finding
 stays one line, truncated at 60 characters so a paragraph-length quote cannot
 swamp a scorecard line.

WHY IT IS SAFE for consumers, checked rather than assumed. The only non-test
 reader of `unresolvedReasons` is `unresolvedCountOf`, which takes `.length`;
 the field is documented as feeding prompt iteration, which is exactly the use
 the needle serves; and findings already carry variable payloads by convention,
 as `stage-quorum-unmet (${shortfall})` and `duplicate-check (${check.issue})`
 do. Nothing groups them by string equality.

VERIFIED BY MUTATION, not by the suite passing. Removing the preview and
 rebuilding fails 24 assertions across the three test files, so the two new
 cases covering truncation and flattening are load-bearing rather than
 decorative.

THE OTHER THREE WALLS still stand: `schema-mismatch` discards `rawText`,
 accepted issues do not record which critic raised each claim, and refiner
 silences record no reason. Each is the same shape and each would take the same
 kind of change at the site where the discarded value is still in scope.

`Futajuhuacha` stays unexplained until a pass runs the new telemetry. That is
 the honest state: the instrument is built and has not yet been read.

## The second wall came down, and the client was never the problem

Two of the four recurring-wall instances are now fixed. This one carried a
 wrong diagnosis in the earlier entry, and the correction is the useful part.

THE EARLIER ENTRY SAID the client discards `rawText` and logs the sub-kind at
 debug. Reading the source, `synthetic-client.ts` does neither. It already
 returns `rawText` on every failure outcome AND a `detail` naming which of the
 three faults fired:

```text
  truncated thinking   output was truncated inside its thinking block
  unparseable          content is not valid JSON: <parser detail>
  guard rejected       content parsed as JSON but failed the caller schema guard
```

The loss is ONE CALL DOWNSTREAM. `attemptStageCall` in `stage-call.ts` had:

```text
  l.warn(`${stage} ${modelId}: ${outcome.kind}, voice lost`,);
```

`outcome.kind` is the flattened union tag. Both the sub-kind and the model text
 sat in scope, unread, on the same object. So the emitter was fine and the
 consumer threw the diagnosis away, which is a different fix from the one the
 earlier entry implied and a much smaller one.

WHAT IT NOW RECORDS: the sub-kind by name, plus a bounded, line-flattened
 opening of the model text. The opening is the diagnostic part. The Kimi-K3
 outage was a two-character channel marker prefixing otherwise valid JSON, and
 it explained 507 mismatches in a single pass; nothing shorter than the first
 few characters was needed to see it.

The refusal branch is covered too. A refusal and a parse failure call for
 different responses and both read as a bare lost voice before this.

VERIFIED BY MUTATION: restoring the bare-kind warning fails 9 assertions. The
 test harness needed a capturing logger to make that possible, because the
 existing cases asserted only that a voice was LOST and never read what the
 loss recorded, which is how a warning this uninformative survived having tests.

WHEN IT WILL BE READ, and this is NARROWER than the first version of this
 paragraph said. It claimed `#75`'s "74-and-counting voice losses become
 diagnosable", which reads as covering the losses already on disk. It does not.
 A warning is written once, at the moment the voice is lost, so the 74 losses
 `pass13` has already recorded stay bare permanently. Only losses recorded
 AFTER a fresh process starts carry the sub-kind and the opening. `pass13`
 cannot see the change at all, being a frozen module graph; the detached
 watcher resumes that run in a new process, so the resumed half onward is
 diagnosable and the already-recorded 74 are not recoverable.

The needle write-up in this document got the equivalent point right, saying the
 misses already recorded stay undiagnosable. The voice-loss write-up did not,
 and the two changes have identical reach.

### Both fixes make the run log corpus-bearing, which it was not before

The raw opening is model output on a translation task, so it is largely corpus
 prose, and the needle preview carries corpus text by construction. Before
 today the log recorded `schema-mismatch, voice lost` and `quote-not-found`,
 which name a fault and quote nothing.

As built this is safe. Both land only in run logs, which live outside git under
 `node_modules/.monochromatic` and are gitignored, exactly like the artifacts
 and grading sheets that have always held corpus text.

The constraint is on what happens NEXT, and it falls on this document. Reading
 those diagnoses and writing up what they say must not quote a needle or a raw
 opening here, because this file is committed, and must not paste log excerpts
 into `pi`/sol or any third-party model. `one-among-us/data` is unlicensed. The
 same discipline the grading sheets already carry applies: name the fault class,
 cite counts, quote nothing. `artifact-probe-read.unit.test.ts` states the rule
 for the quote fields it omits, and it is the same rule.

THE TWO REMAINING WALLS are accepted issues not recording which critic raised
 each claim, which blocks `#65` and `#68`, and that one is NOT this shape: the
 attribution is genuinely absent rather than discarded downstream, so it needs
 the claim to carry its speaker from the critic stage onward.
