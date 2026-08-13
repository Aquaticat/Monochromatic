# Two features were built and never wired, and what to do about the aligner

Measured 2026-08-13 against the current build, at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
This is a PROPOSAL. Nothing here is decided, and nothing has been landed.

## Verdict, in short

SUPERSEDED IN PART, 2026-08-13. Read "The aligner cannot leave two headings
 unpaired, and that breaks attempt five" before acting on anything here.
`alignHeadings` is NOT a working aligner: pairing two headings that share
 nothing scores `0`, while leaving both unpaired scores `-2 * GAP_PENALTY`, so
 it can never withhold a pair on any evidence. Attempt five's penalty is bounded
 by exactly that quantity and so cannot fix it. The rest of this section is the
 original verdict, kept because the unwired finding and the blast radius still
 hold.

`alignHeadings` is a working section aligner that nothing calls, so `#71` is
 still live: production merges source sections from the front and slides
 `XingZ60` by two.

The fix is a chunk-label adapter plus ONE new scoring term, a penalty applied
 when exactly one side of a candidate pair is a preamble chunk, valued strictly
 between zero and `-2 * GAP_PENALTY`. `headingAffinity` itself stays untouched,
 which is what keeps the shared-name signal intact.

Validated across 92 corpus entries: 90 identical to production, 2 changed,
 0 regressed. `XingZ60` becomes correct and `XIEPT2` becomes better than
 production. Four of five invented cases pass; the fifth, a middle gap in a
 document sharing no evidence anywhere, is undecidable rather than wrong.

Ranked B > C > A. BLOCKED on `#70`: the fix produces three unpaired sections
 corpus-wide that need a destination, and it invalidates the slice cache
 totally.

The derivability probe is the OTHER unwired feature, and it is blocked on
 nothing. Wiring it is additive, adding a third recall figure beside strict and
 lenient without changing either, so it can be decided on its own and is the
 cheaper of the two to act on.

Everything below is supporting evidence, including four prototype attempts
 that were wrong. The attempt history is kept deliberately: attempt three
 passed the entire corpus and was still wrong about its own mechanism, which is
 the most transferable thing here.

## The finding

`alignHeadings` in `align-sections-order.ts` is a Needleman-Wunsch aligner that
 allows gaps on either side. It is exported from `index.ts`, covered by
 `align-sections-order.unit.test.ts`, and carries the gap-placement fix from
 `110fc3909`.

It is called by nothing. A search across the repository finds it in its own
 definition, its own test file, and the `index.ts` re-export, and nowhere else.
`chunk-document.ts` does not use it.

The pipeline aligns at `repair-translation.ts`, which calls
 `alignDocumentSections` from `chunk-document.ts`. That function still does
 what `#71` describes: on a structure mismatch it aligns proportionally by
 character fraction and MERGES adjacent source sections to force the counts to
 match.

So the record in `doc/handover/translation-repair.md` saying the section
 aligner now pairs `XingZ60` correctly is true of `alignHeadings` and false of
 the production path. The fix was built, tested, committed and never connected.

## The evidence, side by side

`XingZ60` carries 14 source headings against 12 target headings, and the two
 absent sections are at the END.

What the production path produces today, after merging source sections 0
 through 1 and 2 through 3 into the first two pairs:

```text
  ## 参与救助          || ## Introduction
  ### 其一：伊良子       || ## Engagement in Trans Aid
  ### 其二：铃语        || ## Memories by Friends
  ### 其三：绘都        || ### Irako
  ### 其六：Mikä       || ### Ann
  ### 其七：wing       || ### Shinonome
  ### 其八：白毛 suki    || ### Mikä
```

What `alignHeadings` produces on the same input:

```text
  简介            || Introduction              affinity 0.00
  参与救助          || Engagement in Trans Aid   affinity 0.00
  友人的回忆         || Memories by Friends       affinity 0.00
  其一：伊良子        || Irako                     affinity 0.00
  其二：铃语         || Lingyu                    affinity 0.00
  其三：绘都         || HiYku                     affinity 0.00
  其四：无常         || Ann                       affinity 0.00
  其五：东云         || Shinonome                 affinity 0.00
  其六：Mikä       || Mikä                      affinity 1.00
  其七：wing       || wing                      affinity 1.00
  其八：白毛 suki    || Baimao suki               affinity 1.00
  其九：空白         || __                        affinity 0.00
  其十：锦心         || (gap)                     affinity 0.00
  致曾划过夜空的流星     || (gap)                     affinity 0.00
```

That is correct, and it is checkable independently of the affinity scores.
Three pairs are pinned by shared Latin names at affinity 1.00, and three more
 are confirmed transliterations that the aligner scored at zero and got right
 from order alone: 铃语 is the pinyin of Lingyu, 东云 is the Japanese reading
 Shinonome, and 伊良子 is Irako. The two gaps land on the two sections that
 genuinely have no translation.

The merge is the mechanism. Collapsing two source sections into one pair shifts
 every later pair by one, so two merges shift by two, which is exactly the
 offset `#71` recorded.

## Blast radius, re-measured on the current build

`#71` asked for this to be re-measured, since the earlier corpus-wide gap
 figure was computed from the same suspect pairing.

```text
  92 entries aligned, 284 pairs produced
  7 entries fall back to proportional alignment

  Aniloviraw   source 1 chunks,  target 1 chunks
  Hangmster    source 1,         target 1
  yingying     source 1,         target 1
  noname       source 4,         target 4
  interrgned   source 5,         target 5
  XIEPT2       source 8,         target 9
  XingZ60      source 15,        target 13
```

Five of the seven have EQUAL counts, where proportional assignment lands on
 index pairing anyway. The remaining two were inspected pair by pair:
 `XIEPT2` pairs correctly (`遇见` with Meeting, `阴影` with Shadow, `事故` with
 Accident, and so on), and only `XingZ60` is wrong.

So the blast radius is one entry, which confirms the earlier session's count by
 a different route. The defect is narrow but total on the entry it hits: every
 critic call there compared the wrong original against the wrong translation.

## Options

### Option A: leave it

Pros:
 no change, no cache invalidation, no restart, and the defect is confined to
 one entry of 92.

Cons:
 that entry produces confident wrong output rather than no output, so its
 issues are noise, its repairs damage correct text, and its probe agrees
 because it was handed the same wrong source;
 the aligner that would fix it is already written, tested and paid for.

### Option B: wire `alignHeadings` into `alignDocumentSections`

"Wiring" needs qualifying, because the two functions speak different units.
`alignHeadings` returns `sourceIndex` and `targetIndex` over the HEADING arrays
 it was given, while `alignDocumentSections` returns pairs of CHUNK objects
 carrying text ranges. Something has to carry indices across.

That something is mechanical rather than inferential, and it was checked rather
 than assumed. `chunkByHeadings` starts a fresh chunk at every heading node and
 puts anything before the first heading in a preamble chunk, so chunk count
 equals heading count plus one whenever a document does not open with a
 heading. Measured over all 184 documents at this pin, that correspondence
 holds EXACTLY:

```text
  184 documents, correspondence exact 184, off 0
```

So heading index `h` maps to chunk index `h + 1` when a preamble exists, and to
 `h` when it does not.

Pros:
 reuses a function that exists, is tested, and carries the gap-placement fix,
 against a heading-to-chunk mapping proven exact on every document at the pin;
 handles a gap ANYWHERE in the sequence rather than only a trailing one;
 produces explicit unpaired sections, which is what `#71` asks for when a
 section cannot be paired confidently.

Cons:
 NOT pure wiring: the adapter must still pair the preamble chunks with each
 other and build pair objects for gap steps, which is small but is new code
 with its own failure modes;
 unpaired sections need a destination, and that is exactly the open question in
 `#70`, so this cannot land without answering it;
 alignment feeds every later stage, so it invalidates the slice cache and costs
 a pass restart.

### Option C: stop merging from the front, pair by index, leave the tail unpaired

Pros:
 smaller change than B, confined to the mismatch branch;
 verified to produce the correct pairing for `XingZ60`.

Cons:
 hard-codes the assumption that surplus sections are trailing, which `XingZ60`
 happens to satisfy and nothing guarantees;
 duplicates in a special case what `alignHeadings` already does in general;
 needs the same answer from `#70` about unpaired sections, so it buys no
 simplification where it matters.

## Ranking

B > C > A.

**B over C** because both need the same decision from `#70`, both invalidate
 the same cache, and both have to build pair objects for unpaired sections, so
 C's smaller diff buys less than it looks like it should. What separates them
 is that B inherits a general gap-placement rule and a test suite, where C
 rests on a trailing-surplus assumption that holds on the single entry it was
 checked against.

The margin is narrower than it first appeared. B's advantage was originally
 written as "wiring rather than new logic", which was wrong: the heading-to-
 chunk adapter is new code, even though the correspondence it rests on is exact
 corpus-wide. If the adapter turns out to be more than a few lines in practice,
 C deserves a fresh look rather than deference to this ranking.

**C over A** because A is the only option that produces a confidently wrong
 pairing. C is never worse than index pairing, and index pairing is already
 what 86 of 92 entries get.

## What has to be settled first

-   `#70`, unchanged: an unpaired source section needs a destination. Wiring
    the aligner does not answer it, it surfaces it explicitly instead of hiding
    it behind a merge.
-   Whether to restart the running pass for this. Alignment feeds every later
    stage, so the invalidation is total rather than partial, which is the
    strongest case for a restart seen so far.

## A note on how this was missed

The handover records the second productive question of the previous stretch as
 whether a built feature actually FIRES, and names typography restoration as
 the case. The same question applied to the aligner would have caught this one:
 `110fc3909` improved gap placement, its tests passed, and the improvement
 reached nothing.

A committed fix with a passing test suite is not evidence that the pipeline
 uses the code it fixed.

## The same check, run systematically

The aligner was found by asking whether a built feature fires. Asking it of
 every module rather than one turns up two more cases.

Method: walk imports from the real entry points, `repair-translation.ts` and
 the `corpus-run/` drivers, and do NOT traverse the barrel files. Barrels
 re-export without depending, so a traversal that walks through them reports
 every module reachable, which is the first answer this produced and it was
 worthless. The control that makes the result meaningful is
 `align-sections-order.ts`, which is independently known to be uncalled and
 must therefore appear.

```text
  155 source modules, 146 reachable, 8 unreachable

  align-sections-order.ts     imported by nothing but barrels
  heading-affinity.ts         imported only by align-sections-order.ts
  derivability-probe.ts       imported only by recall-barrel.ts
  derivability-wire.ts        imported by derivability-probe.ts and recall-barrel.ts
  probe-barrel.ts             re-export layer
  recall-barrel.ts            re-export layer
  refine-barrel.ts            re-export layer
  sheet-barrel.ts             re-export layer
```

Four are pure re-export layers and are fine. The other four are two features.

### The derivability probe is also unwired

`runDerivabilityProbe` was added in `616264bdb`. Its own header describes what
 it is for: an ensemble audit of whether deleted sentences are fully derivable
 from the Chinese source, whose only power is to EXCUSE a partial restoration,
 with the median deliberately rounded toward more derivable so the burden of
 proof sits on the excuse.

Nothing calls it. `recall-benchmark.ts`, the driver behind the
 `recall-benchmark` task, imports its dependencies individually rather than
 through a barrel and never mentions derivability. The restoration judge beside
 it IS reached; the derivability probe is not.

The consequence is specific rather than cosmetic: recall measurements charge a
 partial restoration against the pipeline even where the deleted sentence was
 not derivable from the source, which is exactly the case this probe was built
 to excuse. Any recall figure taken so far was computed without it.

Whether that is a defect or a deliberate pause is not something the code says.
It is raised here rather than answered.

### Why this shape of defect is invisible

All three features are exported from `index.ts`, so a consumer outside the
 package could import them and nothing looks dead. All three have passing unit
 tests, so coverage does not fall. Neither `tsc` nor the linter objects to an
 export with no internal consumer, because that is the normal shape of a public
 API.

The cheap guard is the walk above, rooted at the entry points and refusing to
 traverse barrels. It takes a second to run and would have caught `110fc3909`
 the day it landed.

### The same check one level finer, which found nothing serious

Modules can fire while the values they produce go unread, which is how the
 footnote graph hid. Checking every field of the two central types for a reader
 outside its declaring file:

```text
  ChunkRepairOutcome, 16 fields: one with no reader
    nonTranslationContradicted

  RepairDocument, 6 fields: one with no reader
    documentHash
```

`nonTranslationContradicted` is a false alarm, and worth writing down as one.
The value is stored by `repair-chunk.ts` and read by nothing, but the FEATURE
 fires: `chunk-critic-phase.ts` branches on `screening.contradicted` and
 `non-translation-evidence.ts` dismisses contradicted votes at the point the
 evidence is computed. Only the persisted copy is unread, which makes it
 provenance rather than a defect.

`documentHash` is genuinely dead. `parseDocument` hashes the full document text
 on every call and nothing outside its own test ever reads the result. Drift
 detection, the obvious candidate purpose, uses the per-span `nodeHash`
 instead.

Left in place, on measurement rather than on caution. Over a 33451-character
 entry, five timed runs of a hundred iterations each:

```text
  parseDocument        median 13.077 ms   band 12.931 to 13.179
  hashContent alone    median  0.048 ms   band  0.048 to  0.049
```

The hash is 0.4% of a parse. Removing it would change a published type for no
 measurable gain, so it stays until something else touches that type.

So the finer-grained pass turned up no second aligner. That is the useful
 outcome: the unwired-MODULE check earns its keep, and the unread-FIELD check
 did not, at least on these two types.

## What the three unpaired sections actually are

`#70` blocks this proposal, and it is stated as "an unpaired source section
 needs a destination". That is abstract. There are exactly three of them at this
 pin, and they are not one problem:

```text
  XingZ60  ### 其十：锦心          915 chars, 12 body lines, opens with an
                                   HTML <details> disclosure block
  XingZ60  ## 致曾划过夜空的流星    1459 chars, 22 body lines, prose
  XIEPT2   (To-Do)                    7 chars, ZERO body lines
```

The `XIEPT2` one needs no decision. It is a seven-character placeholder with no
 body, sitting in the English where the Chinese has a section. There is nothing
 to translate into it and nothing to lose by leaving it unpaired, so it does
 not belong in the same question as the other two.

That leaves TWO genuinely untranslated sections, 2374 characters between them,
 both in ONE entry. So `#70`'s blast radius is a single document's trailing
 pair, not a corpus-wide policy.

The 915-character one is also the "915 characters against nothing" shape the
 handover cites as unrepairable. Worth knowing that its body opens with an HTML
 disclosure block rather than prose, so whatever policy is chosen has to survive
 markup and not only sentences.

None of this decides the question. It shrinks it: the choice is what to do with
 two trailing sections of one entry, with a placeholder that can be dropped from
 consideration entirely.

## How big the change actually is

This document called Option B "small", then "clearly NOT small", then "small"
 again, as later sections corrected earlier ones. None of the three carried a
 number. Here is the enumeration instead, so nobody has to weigh adjectives:

-   `chunkUnits`, one label plus a preamble flag per chunk. 13 lines in the
    prototype.
-   `pairScore`, the structure veto plus the existing affinity. 6 lines.
-   One constant for the penalty.
-   Replacing the `structure-mismatch` branch in `alignDocumentSections`.
-   AND a signature change to `alignHeadings`, which is the part every earlier
    estimate missed.

That last one is not optional and was nearly written down wrong. `alignHeadings`
 takes two `readonly string[]` and calls `headingAffinity` at three points
 inside itself. It has no scoring hook. So the structural term cannot reach it
 without either giving it one or passing units instead of strings, and its 10
 existing test cases have to be reviewed against whichever is chosen.

The prototype sidestepped this by reimplementing Needleman-Wunsch, 36 lines,
 which is why the prototype looked smaller than the change. A prototype that
 copies the thing it means to modify does not measure the modification.

So: bounded and enumerable, roughly 20 lines of new logic plus an interface
 change to a tested function. Not "small" without qualification, and not the
 pure wiring the first version of this document claimed.

## Verification notes

Both load-bearing claims were checked at the level the recommendation needs,
 not at the level that was convenient.

The aligner claim rested on `alignHeadings` producing the right HEADING
 pairing, which does not by itself prove that wiring it fixes a CHUNK-level
 aligner. The heading-to-chunk correspondence was therefore measured
 separately, and is exact on all 184 documents at the pin.

The derivability claim rested on a search for the word "derivability", which
 would miss a consumer importing a symbol whose name lacks it. Re-run against
 `runDerivabilityProbe`, `SeedDerivability` and `DERIVABILITY_RESPONSE_FORMAT`
 specifically, the only consumer outside the module's own files is
 `recall-barrel.ts`, and neither `repair-benchmark.ts` nor
 `restoration-judge.ts` mentions it at all.

## Prototyped, and four of the five attempts were wrong

The ranking above left one thing open: whether the heading-to-chunk adapter is
 a few lines or enough code to change the answer. It was built against the
 already-exported `chunkByHeadings` and `alignHeadings`, with no package change
 and no rebuild, and compared to `alignDocumentSections` across all 92 entries.

Comparing by chunk INDEX is useless here and was the first mistake: a merged
 pair reports its first chunk's index, so the merge that is the whole defect is
 invisible. Every result below compares the first non-blank LINE of each side.

### Attempt one: pair preamble with preamble, then offset by one

Fixes `XingZ60`, breaks FIVE entries. When one side has a preamble and the
 other does not, the separate preamble rule shifts everything after it, so
 `XIEPT2`, `interrgned` and `noname` all slide by one, and `Hangmster` and
 `yingying` have a correct single pair split into two gaps.

### Attempt two: give the preamble an empty label and let the aligner place it

Fixes `XingZ60`, breaks `XIEPT2`. Better, and still wrong, for a reason worth
 keeping: `headingAffinity` scores only shared Latin tokens of three or more
 characters, so between a Chinese heading and its English translation the
 affinity is ZERO. With every score zero the alignment is decided entirely by
 the gap-placement tiebreak, and `110fc3909` put gaps at the end. `XingZ60`
 needs its gap at the end. `XIEPT2` needs one at the front, because the English
 carries a `(To-Do)` preamble the Chinese has no counterpart for.

A tiebreak cannot be right for both. The aligner needs a signal.

### Attempt three: let the label carry the structure

Heading DEPTH and preamble-ness are free, deterministic, and already present.
Feeding them in as a token the existing affinity can see:

```ts
const DEPTH_TOKEN = ['hdga', 'hdgb', 'hdgc', 'hdgd', 'hdge', 'hdgf',];
const PREAMBLE_TOKEN = 'pream';

// One label per chunk: a preamble chunk cannot look like a heading chunk, and
// two headings agree on structure only at the same depth.
function chunkLabels({ document, },) {
  return chunkByHeadings({ document, },).map(function toLabel(chunk,) {
    const first = firstNonBlankLine({ text: chunk.text, },);
    const depth = headingDepth({ text: first, },);
    return (depth === null)
      ? PREAMBLE_TOKEN
      : `${DEPTH_TOKEN[depth - 1]} ${headingTextOf({ line: first, },)}`;
  },);
}
```

Result over all 92 entries: 90 identical to production, 2 changed, 0 regressed.

```text
  XIEPT2
    production  ## 经历=(To-Do) | ## 遇见=## Meeting | ## 阴影=## Shadow | ...
    prototype   x=(To-Do) | ## 经历=## Experience | ## 遇见=## Meeting | ...

  XingZ60
    production  ### 其一：伊良子=## Engagement in Trans | ### 其三：绘都=### Irako | ...
    prototype   ### 其一：伊良子=### Irako | ### 其二：铃语=### Lingyu | ...
```

`XingZ60` becomes correct. `XIEPT2` becomes MORE correct than production: the
 English `(To-Do)` preamble is left unpaired instead of absorbing `经历`, and
 `经历` pairs with `Experience` where it belongs. Three unpaired sections are
 produced corpus-wide, all of them real.

### What this changes about the options

Option B is confirmed as the right direction and is more than wiring, in a way
 that is now measured rather than guessed: it needs the chunk-label adapter
 above AND a structural component in the affinity. Both are small, and the
 combination is a strict improvement on every entry at this pin.

The structural token as prototyped rides inside the label string, which works
 because affinity is shared-token based, but is a hack. A real change should
 give `headingAffinity` the depth explicitly rather than smuggling it through
 text.

Option C is now clearly worse than it looked. Its trailing-surplus assumption
 is exactly what attempt two implemented, and `XIEPT2` is the counterexample
 sitting in the corpus: a gap that belongs at the FRONT.

So the ranking stands at B > C > A, and the margin is wider than the earlier
 correction suggested, not narrower. The blocker is unchanged: three unpaired
 sections still need the destination `#70` owes them.

## Correction: attempt three is fragile, and the "strict improvement" claim was wrong

Attempt three was tested only against the corpus, which contains gaps at the
 front and at the end and nowhere else. Run against invented cases covering
 positions the corpus does not have, it fails:

```text
  gap at the END                          correct
  gap at the FRONT                        correct
  gap in the MIDDLE                       WRONG, gap slid to the end
  middle gap WITH a shared Latin name     WRONG, and it ignored the name:
                                          paired 老猫 with Mocha and left
                                          the real Mocha unpaired
  heading depth changed in translation    correct
```

The cause is the structural token itself. `headingAffinity` divides shared
 tokens by the smaller token count, so adding a depth token to every label
 saturates the score:

```text
  WITH the depth token          WITHOUT it
  hdgb 小猫  vs hdgb Kitten  1   小猫   vs Kitten  0
  hdgb 老猫  vs hdgb Mocha   1   老猫   vs Mocha   0
  hdgb Mocha vs hdgb Mocha  1   Mocha vs Mocha   1
  hdgb 老猫  vs hdgb Kitten  1   老猫   vs Kitten  0
```

Every same-depth pair scores 1.00, so a genuine name match is worth exactly as
 much as an unrelated heading at the same depth. The signal the aligner was
 supposed to gain is destroyed by the mechanism meant to deliver it.

Without the token the same middle-gap case aligns correctly, gapping the middle
 source section and pinning the tail on the real name match at affinity 1.00.

So attempt three's corpus wins were not earned. `XingZ60` needs its gap at the
 end, which is where the tiebreak already puts it, and `XIEPT2` came out right
 only because saturation happened to make heading-to-heading pairing beat
 heading-to-preamble pairing. Neither depended on structure being informative.

### Why this cannot be fixed by feeding labels

`XIEPT2` needs the aligner to refuse to pair a preamble chunk with a heading
 chunk. Affinity returns a value between zero and one, and a zero-affinity
 PAIRING still scores better than a gap, which costs `GAP_PENALTY`. So a label
 can never express "these must not pair", only "these are unrelated", which is
 what every cross-language heading pair already scores.

Saturating the good pairs to 1.00 is the only way to express the preference
 through labels, and that is precisely what destroys the name signal.

The real change is therefore to `headingAffinity` or to the aligner: structural
 incompatibility has to be expressible, as a mismatch penalty or a hard
 constraint, separately from textual similarity.

### What this does to the options

Option B is still the right direction and is now clearly NOT small. It needs
 the chunk-label adapter, plus a structural term in the scoring that does not
 ride on the shared-token count. That is a design change to the affinity
 function, not wiring.

The ranking B > C > A is unchanged, because C is still the trailing-surplus
 assumption that `XIEPT2` refutes and A is still confidently wrong on
 `XingZ60`. What changes is the cost of B, which should not be presented as
 cheap.

The lesson is the one this document keeps repeating in a different form. A
 change measured only against the corpus is measured against the cases the
 corpus happens to contain, and a prototype that passes there can still be
 wrong about the mechanism it claims to use.

## Attempt five resolves it: structure as a soft penalty, not a veto

Two more attempts, and the fourth is the answer.

### Attempt four, a hard veto, is wrong about the corpus

Refusing outright to pair a preamble chunk with a heading chunk fixes `XingZ60`
 and `XIEPT2` and REGRESSES four entries: `Hangmster`, `interrgned`, `noname`
 and `yingying`.

All four have the same shape, and it is a shape the corpus has every right to:
 one side keeps content in a preamble where the other gives it a heading. On
 `interrgned` the Chinese opens with prose about tangled threads and the
 English titles that section `## Line`. Pairing them is CORRECT.

So "preamble and heading are structurally incompatible" is simply false here.
A translation may add or drop a heading for the same content.

### Attempt five, a soft penalty, threads every case

The distinction is not that the pairing is forbidden, it is that a better
 global alignment may exist. That is what a penalty expresses and a veto
 cannot.

The working range follows from the algorithm rather than from tuning. Pairing
 across a structure boundary costs the penalty; refusing costs two gaps, one on
 each side. So the penalty must sit strictly between zero and
 `-2 * GAP_PENALTY`:

-   above `-0.7`, `Hangmster` still pairs its lone heading with the lone
    English preamble instead of dropping both;
-   below zero, `XIEPT2` prefers gapping its `(To-Do)` preamble and matching
    all eight headings straight across.

Swept from `-0.1` to `-0.69`, every value gives the same corpus result:

```text
  92 entries: 90 identical to production, 2 changed, 0 regressed
    XingZ60  now correct
    XIEPT2   now better than production: the (To-Do) preamble is left
             unpaired and 经历 pairs with Experience
```

And on the invented cases that broke attempt three:

```text
  gap at the END                          correct
  gap at the FRONT                        correct
  gap in the MIDDLE, no evidence          slides to the end, see below
  gap in the MIDDLE, name pins the tail   CORRECT: 老猫 unpaired, Mocha pinned
  heading depth changed in translation    correct, still paired in order
```

The name signal survives because heading-to-heading scoring is untouched. Only
 the structure boundary carries the new term, so an exact shared name still
 outscores everything around it.

### The one case that stays unsolved, and why that is acceptable

A gap in the middle of a document whose headings share NO evidence cannot be
 placed. Every arrangement scores identically, so the tiebreak decides and puts
 it at the end. That is not a defect of this design; it is the absence of
 information. Placing it correctly would need a signal nobody has yet, such as
 comparing section bodies rather than headings.

Worth stating plainly because the earlier claim that Option B "handles a gap
 ANYWHERE" is still too strong. It handles a gap anywhere EVIDENCE reaches, and
 falls back to the end-of-document prior otherwise.

### What Option B now means, concretely

-   A chunk-label adapter, since `alignHeadings` speaks heading indices and
    `alignDocumentSections` speaks chunk objects. The correspondence is exact
    on all 184 documents.
-   One new term in the scoring: a penalty between zero and `-2 * GAP_PENALTY`
    when exactly one side of a candidate pair is a preamble chunk.
-   No change to `headingAffinity` itself, which is what keeps the name signal
    intact.

That is small, it is bounded, and it is now measured against 92 real entries
 plus five invented ones rather than argued for. The blocker is unchanged:
 three unpaired sections corpus-wide still need the destination `#70` owes
 them.

## Wiring the derivability probe: where it goes

The aligner is blocked on `#70`. The derivability probe is not blocked on
 anything, so its touch points were traced too.

`repair-benchmark.ts` already computes two recall figures side by side:

```text
  judgeRestored   verdict === 'restored'
  judgeLenient    verdict === 'restored' OR verdict === 'partial'
```

Strict counts only full restorations; lenient forgives every partial. The probe
 exists to sit between them, forgiving a partial ONLY where the deleted
 sentence was not derivable from the Chinese source, so the editor is not
 charged for failing to invent information the source never carried.

Three touch points, all in code that already has the shape for it:

-   `runRestorationJudge` is already an injectable default parameter on the
    benchmark, so `runDerivabilityProbe` can arrive the same way rather than
    being reached for globally.
-   The dispatched record already carries `seedJudgments` keyed by seed id;
    derivability is keyed the same way and would sit beside it.
-   The count itself is one more filter next to the two above.

The important property is that this is ADDITIVE. A third figure appears next to
 strict and lenient; neither existing figure changes. So wiring it does not
 invalidate any recall number taken so far, it explains the gap between the two
 that are already reported. That materially lowers the risk of acting on it,
 and it is why this half of `#74` can be decided independently of `#70`.

The cost is provider capacity: the probe is an ensemble, so it adds a fan-out
 per partial seed on every recall run. Its own design already limits the
 exposure, since an unjudged seed defaults to `derivable` and therefore excuses
 nothing.

### Sized, and at the current scale it is not worth wiring

The benefit was asserted before it was measured. Measuring it closes the
 question the other way.

The probe's ONLY power is to excuse a partial restoration. So its ceiling is
 the number of partials, and the last recall run
 (`recall-scorecard.json`, 2026-08-10) has:

```text
  judged seeds     27
  restored         23
  PARTIAL           1

  strict rate    85.2%   (23/27)
  lenient rate   88.9%   (24/27)
```

The strict and lenient rates sit 3.7 points apart, and that entire gap is ONE
 seed. A third figure between them cannot exist: with one partial the probe can
 only reproduce 85.2% or 88.9%, never anything in between.

So the earlier claim here, that recall figures are "pessimistic by an unmeasured
 amount", is now measured. The amount is at most one seed. Wiring an ensemble
 fan-out to move a single seed is a poor return, and this half of `#74` should
 be deferred rather than acted on.

WHAT WOULD CHANGE IT: a larger recall run. Nine entries and 27 seeds is a small
 population, and partials are the rare class within it. If a future run produces
 partials in double figures, the probe starts earning its calls and this
 conclusion should be re-taken rather than inherited.

## The block-count gap re-measured, which `#71` required

`#71` asked for the corpus-wide block-count gap to be re-measured, on the
 grounds that the figure was computed from the same suspect pairing and so
 measured alignment quality as much as translation coverage. It matters because
 `doc/decision/translation-repair-output-goal.md` rests on it.

Measured against the current build over all 92 entries:

```text
  aligned chunk pairs          284
  differing in block count     103   (36%)

  the decision record cites     60 of 172   (35%)

  XingZ60, the only mispairing entry, contributes 12 of the 103
  excluding it                  91 of 271   (34%)
```

THE DECISION'S EVIDENCE SURVIVES. The rate is 36% against the recorded 35%, and
 removing the mispaired entry entirely leaves 34%. The absolute counts differ
 only because the record measured 56 settled entries and this measures all 92.

TWO OF ITS THREE CITED EXTREMES ARE ARTIFACTS, and one is not. The record cites
 `XingZ60 76 against 5` and `XingZ60 62 against 1`, both of which come from the
 entry whose pairing slides, so those specific numbers describe the defect
 rather than the corpus. `XIEPT2 24 against 1` comes from an entry that pairs
 CORRECTLY, so it is genuine evidence of a barely-translated section.

That is the useful distinction: the phenomenon the decision was taken about is
 real and survives independently of the aligner defect, while two of the
 headline numbers illustrating it should be replaced with ones from correctly
 paired entries when that record is next touched.

`XIEPT2` alone supplies three: 24 against 1, 18 against 1, and 18 against 2.

## The aligner cannot leave two headings unpaired, and that breaks attempt five

Found 2026-08-13 by a source-level review, and confirmed against both the code
 and the corpus. This CORRECTS the verdict at the top of this document, which
 called `alignHeadings` a working aligner that nothing calls. It is not working.

### The arithmetic

`alignHeadings` scores three transitions per cell, in `align-sections-order.ts`:

```text
  paired     = scores[diagonal] + headingAffinity(source, target)
  sourceGap  = scores[above]    - GAP_PENALTY
  targetGap  = scores[left]     - GAP_PENALTY
```

`headingAffinity` returns a value in `[0, 1]` and never goes negative.
`GAP_PENALTY` is `0.35`.

So pairing two headings that share NOTHING scores `diagonal + 0`, while leaving
 both of them unpaired scores `diagonal - 0.70`. `Math.max` therefore prefers
 the unsupported pairing every single time, no matter how little evidence exists.
There is no value of `GAP_PENALTY` above zero that changes this, because the
 comparison is between `0` and `-2 * GAP_PENALTY`.

### Why this is fatal rather than cosmetic

`headingAffinity` scores only shared Latin tokens of three or more characters.
A Chinese heading and its CORRECT English translation usually share none, so
 the affinity of a correct pair is legitimately `0.00`.

The algorithm therefore cannot distinguish "correct pair, no shared tokens" from
 "wrong pair, no shared tokens". Every zero-evidence path through the table ties
 at the same score, and which pairing emerges is decided by the traceback's tie
 order, which tries source gap, then target gap, then pairing. That order is a
 PRIOR about where omissions fall, not a result computed from the headings.

### Confirmed by probing `alignHeadings` directly

An earlier version of this section cited the `#70` corpus sweep, which found 0
 unpaired sections across 92 entries and 284 pairs, as independent confirmation.
That was a CONFLATION and is withdrawn: the sweep ran `alignDocumentSections`,
 the production path, which never calls `alignHeadings` at all. It confirms the
 proportional fallback pairs everything, which was already known and is what
 `#71` is about. It says nothing about the arithmetic.

The claim needs the actual function, so here it is on the actual function. The
 count that matters is MUTUAL gaps, meaning a source and a target both left
 unpaired where they could have been paired together, since a length difference
 forces surplus gaps no matter what the scores say:

```text
  equal length, zero affinity (3v3)            pairs 3   mutual gaps 0
  equal length, one strong anchor misplaced    pairs 3   mutual gaps 0
  unequal 5v3, zero affinity                   pairs 3   mutual gaps 0
  middle omission with anchors either side     pairs 3   mutual gaps 0
```

Never once. Every gap it emits is the forced surplus of a length difference,
 and it never CHOOSES to withhold a pairing on evidence. That is what the
 arithmetic predicts, and `#71` requires the opposite.

The second row is the more damaging one. A perfect anchor at affinity `1.00`
 sat at source 0 and target 2, and the aligner ignored it and paired by position
 instead, because reaching the anchor costs four reciprocal gaps at `-1.40`
 against a gain of `1.00`. So a fixed scalar penalty does not merely fail to
 withhold pairs, it discards the strongest evidence the affinity function can
 produce.

### What it does to attempt five

Attempt five adds a soft structural penalty strictly between `0` and
 `-2 * GAP_PENALTY`. That is bounded by exactly the quantity at issue, so it
 cannot make mutual gaps competitive with a zero-evidence pairing either.
It fixes `XingZ60` by encoding the prior "omissions occur at the END", which is
 true of `XingZ60` and is not a general fact. A middle omission still slides an
 anchor-bounded region.

The 90-identical, 2-changed, 0-regressed validation does not catch this, because
 92 corpus documents mostly do not contain middle omissions, and the invented
 middle-gap case was recorded as "undecidable rather than wrong". It is worse
 than undecidable: the aligner answers it confidently and the answer is a
 coin-flip fixed by traceback order.

This is the same failure as attempt three. That one was defeated by a saturating
 term destroying the name signal and passed all 92 entries anyway. The lesson
 repeats: corpus-wide agreement measures how rare the hard case is, not whether
 the algorithm handles it.

### The shape a correct fix needs

Do not combine affinity, structure and gaps into one clamped scalar. A fixed
 scalar penalty cannot work: displacing an anchor by two positions requires four
 reciprocal gaps, costing `1.40`, which defeats even a perfect affinity of `1`.

Score lexicographically instead, comparing in this order:

-   Trusted heading anchors, maximised. A trusted anchor is a high-affinity
    candidate UNIQUE on both its source row and its target column, so a repeated
    name never becomes a hard anchor.
-   Unpaired sections, minimised.
-   Remaining weak affinity, maximised.

That ordering gives the semantics the signal actually has: `0` means no
 information rather than mismatch, a sure name cannot be outvoted by an
 accumulation of gap penalties, and weak evidence can position a gap that is
 already required without manufacturing new ones.

Ties must NOT be broken arbitrarily. A pairing is safe only when it is the only
 possible partner for that source across all optimal paths, the only possible
 partner for that target, and neither item can be a gap on another optimal path.
Everything else is `ambiguous` and is withheld from the critics rather than
 guessed. That is what `#71` asked for and what nothing currently does.

The return type has to change to carry this, from parallel indices with `-1`
 sentinels to a discriminated union of `paired`, `source-only` and `target-only`,
 so a caller cannot accidentally index a gap and pair it.

### Tests that would actually falsify the design

The existing suite cannot, because it asserts on `alignHeadings` in isolation and
 its unequal-length case expects the gaps to fall at the END, which encodes the
 prior rather than testing it.

-   Drive `alignDocumentSections` on a structural mismatch and assert the CRITIC
    INPUTS, not the aligner's internal steps.
-   Middle source omission, with anchors on both sides of a zero-evidence region:
    assert the region comes back ambiguous rather than shifted.
-   Middle target insertion, mirroring it.
-   Reciprocal gaps with equal counts, one source-only before an anchor and one
    target-only after: catches algorithms that minimise gaps before respecting
    anchors.
-   Long displacement, an anchor needing several reciprocal gaps: catches a fixed
    scalar penalty drowning sure evidence.
-   All-zero unequal sequences: assert NO confident pairs, rather than asserting
    gaps land at the end.
-   Repeated Latin token across several headings: assert it is not a hard anchor.
-   Affinity saturation, `alpha beta` against `alpha` and against `alpha beta`:
    if both score the same, affinity cannot support "high means surely".
-   Exact coverage: every input appears exactly once as paired or unpaired, and
    no unpaired item reaches a critic.

### Consequence for the ranking

Option B is still the right destination but it is BIGGER than this document
 estimated. It is not an adapter plus one scoring term. It is a new scoring
 model, a changed return type, an ambiguity path through
 `alignDocumentSections`, and a test suite that exercises the production entry
 point. The estimate of "one constant and a mismatch branch" was wrong.

Option C, pair by index and leave the tail unpaired, gains ground on this
 finding. It is honest about having no evidence, where B-as-designed was
 confidently wrong. C remains a prior about tails, but it is a STATED prior
 rather than one hidden in a traceback tie order.

## Attempt six: lexicographic scoring, prototyped and validated

Built 2026-08-13 after the structural defect was found. This is the first
 attempt that satisfies every case, including the two that defeated attempts
 three and five.

### The algorithm

Three changes to `alignHeadings`, none of them to `headingAffinity`.

FIRST, the score becomes a lexicographic triple instead of one clamped scalar:

```text
  [ trustedAnchorAffinity   maximised
    gapCount                minimised
    softAffinity            maximised ]
```

A transition contributes `[trusted ? affinity : 0, 0, affinity]` when pairing
 and `[0, 1, 0]` when gapping. Gaps never contribute negative heading evidence,
 which is what makes an affinity of `0` mean "no information" rather than
 "mismatch".

SECOND, a TRUSTED anchor is a candidate at or above a threshold that is also the
 STRICT maximum of both its row and its column. Strictness on both axes is what
 stops a name repeated across several headings from anchoring anything.

THIRD, and this is the part that satisfies `#71`, a pairing is emitted only when
 it is FORCED. Run the table forwards and backwards, then a transition lies on
 some optimal path exactly when `forward[cell] + transition + backward[next]`
 equals the optimal score. A pair is emitted only when it is the sole partner
 for its source across every optimal path, the sole partner for its target, and
 neither side could instead be a gap. Everything else returns as `ambiguous`.

The return type becomes a discriminated union of `paired`, `source-only` and
 `target-only` rather than indices with `-1` sentinels.

### The cases that killed the earlier attempts

-   MIDDLE OMISSION with anchors on both sides. Anchors hold, and the
    zero-evidence middle returns ambiguous instead of sliding. Attempt five
    shifted it.
-   LONG DISPLACEMENT, an anchor needing three reciprocal gaps on each side.
    The anchor survives. Under the old scalar those six gaps cost `2.10` and
    would have crushed an affinity of `1.00`.
-   ALL-ZERO UNEQUAL sequences. No confident pair anywhere, where the current
    aligner confidently pairs by traceback order.
-   REPEATED NAME across several headings. Ties break strictness, so it never
    becomes a hard anchor.
-   EQUAL LENGTH with zero evidence anywhere. Still pairs by position, which is
    what keeps the corpus from moving.

### Blast radius, measured over all 92 entries

```text
  identical pairings to the current aligner   89
  changed                                      3
  entries with an ambiguous section            3, holding 20 sections
```

The three that change are exactly `XingZ60`, `interrgned` and `noname`, all of
 which already emit an alignment finding today. Not one of the 85 cleanly
 aligned entries moves.

On `XingZ60` every essay section pairs correctly. The three romanised-name
 anchors score `1.00` and pin the alignment; the zero-affinity pairs ahead of
 them follow by monotonicity; the untranslated tail sections and the one
 unmatched target heading come back ambiguous rather than being absorbed. That
 is the outcome `#71` asked for.

### The consequence that still needs a decision

`interrgned` and `noname` go from 4 and 3 pairs to ZERO. Both have unequal
 heading counts with no shared-name evidence anywhere, so nothing is forced and
 everything is honestly ambiguous.

That is the stated requirement working as designed, since `#71` holds that a
 wrong pairing is worse than no pairing. It is also a coverage LOSS: those two
 entries get critic work today, wrongly paired, and would get none.

So the blocker named earlier has grown rather than gone. It is no longer three
 unpaired sections needing a destination, it is 20 sections across 3 entries,
 and two entire entries that the pipeline would decline to process. Whether
 ambiguous sections should fall back to positional pairing, route to a
 translate stage, or simply be reported is the decision that gates landing this,
 and it belongs with `#70` because option B answers it differently from A and C.

## Correction: the blast radius was measured against the wrong function again

The attempt-six section reported "89 of 92 identical to the current aligner".
That compared `lexAlign` against `alignHeadings`, which production never calls.
It is the same conflation withdrawn earlier in this document, made again one
 section later, and it is withdrawn too.

Re-measured against `alignDocumentSections`, the production path, mapping
 heading indices to chunk indices:

```text
  identical pairing   86
  changed              6
  pairs removed 20, pairs added 8

  Hangmster    prod  1 -> lex  0
  XIEPT2       prod  8 -> lex  8   but all 8 differ
  XingZ60      prod 13 -> lex 12
  interrgned   prod  5 -> lex  0
  noname       prod  4 -> lex  0
  yingying     prod  1 -> lex  0
```

### And that measurement is ALSO mostly an artifact, which is the real finding

Five of those six changes are not disagreements about which sections match.
They are my adapter mishandling an ASYMMETRIC PREAMBLE: one side has content
 before its first heading and the other does not, so chunk index and heading
 index differ by one on one side only.

Counted across the corpus:

```text
  both sides have a preamble chunk    35
  neither side has one                52
  asymmetric, one side only            5
```

The five asymmetric entries are `Hangmster`, `XIEPT2`, `interrgned`, `noname`
 and `yingying`. Those are EXACTLY the five non-`XingZ60` movers, name for name.

That is the headline, and it reframes `#71`. Five of the seven entries that fall
 back to proportional alignment do so because of an asymmetric preamble, not
 because a section is missing. `XingZ60` is the only entry whose fallback is
 caused by a genuine heading gap, and `Aniloviraw` is neither.

So the aligner work splits in two, and the halves are different sizes:

-   The SCORING fix, attempt six, addresses `XingZ60`. One entry.
-   The ADAPTER, deciding what a preamble on one side pairs with when the other
    side has none, addresses five. It is the larger half and this document has
    consistently treated it as the mechanical part.

`Hangmster` shows why it is not mechanical. Its Chinese side is a single
 heading-led chunk and its English side is a single preamble chunk. They are
 plainly the same content and production pairs them, which is right. A rule that
 pairs preamble only with preamble would refuse that pairing and lose the entry.

## The affinity function saturates, so `TRUST` is vestigial

Probed directly:

```text
  'alpha beta' vs 'alpha beta'          1.00
  'alpha beta' vs 'alpha'               1.00
  'alpha'      vs 'alpha beta'          1.00
  'alpha'      vs 'alpha gamma delta'   1.00
```

`headingAffinity` divides shared tokens by the SMALLER token count, so a
 single-token heading scores `1.00` against any heading containing that token,
 however long. There is no gradation above zero to threshold on.

Consequences for attempt six:

-   `TRUST = 0.5` never binds. Every candidate with any shared token clears it.
    UNIQUENESS on both axes is carrying the entire design, alone.
-   A bare romanised name can anchor the whole document on one coincidence, and
    it does so at full confidence. Probed: a lone `Mochi` heading anchors to a
    `Mochi and friends` heading and forces every other section to gap.
-   The repeated-name case passes for the right reason but by a narrow margin.
    When the same token appears in several headings the affinities TIE at
    `1.00`, strictness fails on both axes, and everything returns ambiguous.
    That is safe, but it is uniqueness doing the work, not the threshold.

Whether to fix this in `headingAffinity`, by dividing by the LARGER token count
 so partial overlap scores below 1, is a separate decision. It would change what
 every existing test asserts, and this document's rule has been that
 `headingAffinity` stays untouched.

MEASURED, rather than left as an open hazard: saturation causes no corpus-wide
 harm at this pin. A false single-token anchor would pull an entry away from
 production's pairing, and under attempt seven only `XIEPT2` and `XingZ60`
 differ, both for reasons that are understood and neither involving a spurious
 anchor. So the hazard is real in principle and absent in this corpus, which
 makes it a reason to keep the uniqueness rule strict rather than a reason to
 change the affinity function now.

## The prototype, inlined so it survives

Kept verbatim rather than described, because this session's repeated lesson is
 that subtle scoring bugs survive 92-entry validation.

```js
/** Affinity at or above which a unique candidate may anchor. */
const TRUST = 0.5;

/** Lexicographic compare: trusted desc, gaps asc, soft desc. */
function better(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return b[1] - a[1];
  return a[2] - b[2];
}

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const eq = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const NEG = [-Infinity, Infinity, -Infinity];

export function lexAlign({ sourceHeadings, targetHeadings, }) {
  const n = sourceHeadings.length, m = targetHeadings.length;

  const A = Array.from({ length: n, }, (_, i) => Array.from({ length: m, }, (_, j) =>
    headingAffinity({ source: sourceHeadings[i], target: targetHeadings[j], },)));

  // Trusted: at or above threshold AND the strict maximum of both its row and
  // its column, so a name repeated across headings never anchors.
  const trusted = Array.from({ length: n, }, () => Array(m,).fill(false,));
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < m; j += 1) {
      if (A[i][j] < TRUST) continue;
      const rowMax = A[i].every((v, k) => k === j || v < A[i][j]);
      const colMax = A.every((row, k) => k === i || row[j] < A[i][j]);
      trusted[i][j] = rowMax && colMax;
    }
  }

  const pairCost = (i, j) => [trusted[i][j] ? A[i][j] : 0, 0, A[i][j]];
  const GAP = [0, 1, 0];

  const F = Array.from({ length: n + 1, }, () => Array(m + 1,).fill(NEG,));
  F[0][0] = [0, 0, 0];
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (i === 0 && j === 0) continue;
      let best = NEG;
      if (i > 0 && j > 0) {
        const c = add(F[i - 1][j - 1], pairCost(i - 1, j - 1,),);
        if (better(c, best,) > 0) best = c;
      }
      if (i > 0) { const c = add(F[i - 1][j], GAP,); if (better(c, best,) > 0) best = c; }
      if (j > 0) { const c = add(F[i][j - 1], GAP,); if (better(c, best,) > 0) best = c; }
      F[i][j] = best;
    }
  }

  const B = Array.from({ length: n + 1, }, () => Array(m + 1,).fill(NEG,));
  B[n][m] = [0, 0, 0];
  for (let i = n; i >= 0; i -= 1) {
    for (let j = m; j >= 0; j -= 1) {
      if (i === n && j === m) continue;
      let best = NEG;
      if (i < n && j < m) {
        const c = add(pairCost(i, j,), B[i + 1][j + 1],);
        if (better(c, best,) > 0) best = c;
      }
      if (i < n) { const c = add(GAP, B[i + 1][j],); if (better(c, best,) > 0) best = c; }
      if (j < m) { const c = add(GAP, B[i][j + 1],); if (better(c, best,) > 0) best = c; }
      B[i][j] = best;
    }
  }

  const optimal = F[n][m];

  // A transition lies on SOME optimal path when forward + it + backward equals
  // the optimum. A pair is emitted only when it is forced on EVERY such path.
  const partnersOfSource = Array.from({ length: n, }, () => new Set(),);
  const partnersOfTarget = Array.from({ length: m, }, () => new Set(),);
  const sourceCanGap = Array(n,).fill(false,);
  const targetCanGap = Array(m,).fill(false,);
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      if (eq(F[i][j], NEG,)) continue;
      if (i < n && j < m && eq(add(add(F[i][j], pairCost(i, j,),), B[i + 1][j + 1],), optimal,)) {
        partnersOfSource[i].add(j,); partnersOfTarget[j].add(i,);
      }
      if (i < n && eq(add(add(F[i][j], GAP,), B[i + 1][j],), optimal,)) sourceCanGap[i] = true;
      if (j < m && eq(add(add(F[i][j], GAP,), B[i][j + 1],), optimal,)) targetCanGap[j] = true;
    }
  }

  const steps = [];
  for (let i = 0; i < n; i += 1) {
    const p = partnersOfSource[i];
    if (p.size === 1 && !sourceCanGap[i]) {
      const j = [...p,][0];
      if (partnersOfTarget[j].size === 1 && !targetCanGap[j]) {
        steps.push({ kind: 'paired', sourceIndex: i, targetIndex: j, affinity: A[i][j], },);
        continue;
      }
    }
    steps.push({ kind: 'source-only', sourceIndex: i, reason: p.size === 0 ? 'forced-gap' : 'ambiguous', },);
  }
  for (let j = 0; j < m; j += 1) {
    if (steps.some((s) => s.kind === 'paired' && s.targetIndex === j)) continue;
    steps.push({ kind: 'target-only', targetIndex: j, reason: partnersOfTarget[j].size === 0 ? 'forced-gap' : 'ambiguous', },);
  }
  return steps;
}
```

## What the ambiguous sections actually cost

The blocker has been stated as "unpaired sections need a destination" without a
 size attached, which made it sound larger than it is. Measured:

```text
  XingZ60       4 ambiguous, 11 paired,  5269 source chars
  interrgned    9 ambiguous,  0 paired,  4101 source chars
  noname        7 ambiguous,  0 paired,  1897 source chars

  entries with any ambiguity      3 of 92
  entries reduced to ZERO pairs   2
  ambiguous sections             20
  source characters they hold  11267
  corpus target characters    405915
  share of the corpus at stake  2.78%
```

So the destination decision governs 2.78% of the corpus, concentrated in three
 entries, two of which the pipeline would decline entirely.

That is small enough to change how blocked this is. The three candidate
 destinations can be ranked on their own merits rather than deferred to `#70`:

-   REPORT ONLY, doing no critic work on an ambiguous section. Pros: never
    manufactures a false issue, which is `#71`'s stated requirement, and is the
    honest answer when the evidence genuinely does not determine a pairing.
    Cons: two entries get no processing at all, and a reader seeing an empty
    result cannot tell it from a clean one without reading findings.
-   ROUTE TO A TRANSLATE STAGE, treating an unpairable source section as
    content needing translation rather than repair. Pros: matches the decided
    goal, that the pipeline yields a good translation even when the input does
    not make sense, and turns the two zeroed entries into useful work. Cons:
    only coherent under a design that HAS a translate stage, so it presupposes
    the `#70` outcome rather than standing alone.
-   POSITIONAL FALLBACK, pairing by index when nothing is forced. Pros: keeps
    today's coverage exactly, changes nothing for the 89 unaffected entries.
    Cons: it is what production already does, and it is what produced `XingZ60`,
    so it reintroduces the defect being fixed on precisely the sections where
    the evidence is weakest.

Ranking: ROUTE > REPORT > POSITIONAL.

ROUTE over REPORT because the goal document already decided that absent or
 broken input should still yield a translation, and REPORT leaves two entries
 unserved when a translate stage would serve them. The gap between them is
 conditional rather than absolute: REPORT wins outright if no translate stage
 is built, which is why this ranking is contingent on `#70` and the earlier
 blocking was not wrong, only oversized.

REPORT over POSITIONAL because POSITIONAL reintroduces exactly the defect under
 repair. It guesses hardest where evidence is weakest, and `#71` recorded that a
 wrong pairing is worse than no pairing because it manufactures issues rather
 than skipping work.

## Attempt seven: the preamble as an empty-labelled unit, which now works

Prototyped 2026-08-13 after the asymmetric-preamble finding. This SUPERSEDES
 the blast-radius figures in the correction above, which were measured with a
 naive offset adapter.

### The adapter

Build the alignable unit list as `(preamble ? [''] : []) ++ headings`.

That makes UNIT INDEX EQUAL CHUNK INDEX by construction, because
 `chunkByHeadings` emits the preamble as chunk 0 and then one chunk per
 heading. There is no offset arithmetic left to get wrong, and offset
 arithmetic is exactly what the previous adapter got wrong.

The preamble carries an EMPTY label. `headingAffinity` returns `0` against
 everything for it, including against another empty label, and it returns a
 finite `0` rather than dividing by a zero token count, which was checked
 rather than assumed.

This is attempt TWO from earlier in this document, which failed under scoring
 that could not withhold a pairing. Attempt six can, and that is what makes the
 same adapter work now.

### Blast radius, against production

```text
  identical pairing to alignDocumentSections   90
  changed                                       2
  entries reduced to zero pairs                 1
  entries with ambiguity                        2, holding 21 units

  XIEPT2    units  8v9    prod  8 -> lex  0    17 ambiguous
  XingZ60   units 15v13   prod 13 -> lex 12     4 ambiguous
```

`Hangmster`, `yingying`, `interrgned` and `noname` now match production
 EXACTLY, where the naive adapter reported all four as changed. That is the
 adapter defect gone rather than a scoring change.

The reason is worth stating because it validates the design. `interrgned` and
 `noname` have UNEQUAL heading counts, 5v4 and 4v3, which is why aligning on
 headings alone refused everything. Their CHUNK counts are equal, 5v5 and 4v4,
 because the preamble makes up the difference. With equal unit counts and no
 evidence anywhere, the aligner pairs by position, which is what production
 does, so they agree.

`Hangmster` is the case that a preamble-pairs-only-with-preamble rule would
 have lost: one heading-led Chinese chunk against one preamble English chunk.
As units they are `['## ...']` against `['']`, one against one, so the pairing
 is forced and it is correct.

### What it still refuses, and whether that is right

`XIEPT2` is the whole remaining cost: 8 source units against 9 target units,
 zero shared Latin tokens anywhere, so nothing is forced and all 17 units come
 back ambiguous. Production pairs its 8 sections and, per the inspection
 recorded earlier in this document, pairs them CORRECTLY.

So the aligner refuses 8 pairings a human can verify are right. The affinity
 function cannot see it, because the headings are translations rather than
 shared names, and the aligner is honest about that.

Whether the refusal is a loss depends on what `XIEPT2` is. It is a PARTIAL
 TRANSLATION: 6 of its sections have an empty target body. Pairing it
 "correctly" therefore hands the critics Chinese prose against bare English
 headings, which produces omission claims for content that genuinely was never
 translated. That is the work `#69` decided should be a TRANSLATION rather than
 a repair.

Read that way, refusing to pair `XIEPT2` and routing it to a translate stage is
 the right outcome rather than a regression, and it argues for ROUTE over
 REPORT in the destination ranking.

### Revised cost of the destination decision

The earlier sizing said 3 entries, 20 sections, 2 entries zeroed. With the
 preamble adapter it is 2 entries, 21 units, and only `XIEPT2` reduced to zero.
`XingZ60` keeps 12 of its 13 pairs and loses only the one that was wrong.

### `XIEPT2` settled: refusing it costs nothing

The cost of attempt seven was stated as "refuses 8 pairings production gets
 right", hedged with "arguably". The hedge is removable, and this document has
 said two things about `XIEPT2` that needed reconciling: that it "pairs
 correctly", and that its figures are "not quotable". Both are true and they
 are about different questions.

PRODUCTION PAIRS IT CORRECTLY. Dumped pair by pair, all eight are genuine
 translations of each other: 经历 with Experience, 遇见 with Meeting, 阴影 with
 Shadow, 事故 with Accident, 送行 with Farewell, 未来？ with Future?, 梦醒 with
 Fact, and the postscript with Postscript. The `sections-merged` finding folded
 the target preamble into pair 0, and everything after it lines up.

AND EVERY ONE OF THOSE PAIRS IS EMPTY ON THE ENGLISH SIDE:

```text
  pair 0  经历      src 1600 ch / 17 blocks    tgt    7 ch / 1 block
  pair 1  遇见      src 1114 ch / 12 blocks    tgt    0 ch / 0 blocks
  pair 2  阴影      src 1160 ch / 23 blocks    tgt    0 ch / 0 blocks
  pair 3  事故      src  983 ch / 17 blocks    tgt    0 ch / 0 blocks
  pair 4  送行      src  576 ch / 14 blocks    tgt    0 ch / 0 blocks
  pair 5  未来？    src  592 ch / 13 blocks    tgt    0 ch / 0 blocks
  pair 6  梦醒      src  489 ch /  8 blocks    tgt    0 ch / 0 blocks
  pair 7  后记      src  479 ch / 17 blocks    tgt   75 ch / 1 block
```

The two pairs that technically carry target text carry 7 characters, which is a
 to-do marker, and 75, which is a contributor credit. The entry is 6994 source
 characters against 82 target characters.

So `XIEPT2` is not a translation with alignment trouble. It is an UNTRANSLATED
 document with headings. Every one of its eight correct pairings would hand the
 critics Chinese prose against nothing and collect omission claims for content
 that was never written, which is exactly the work `#69` decided should be a
 translation rather than a repair.

REFUSING IT THEREFORE COSTS NOTHING. The coverage the aligner gives up is
 coverage that produces noise.

That removes the last hedge from attempts six and seven together:

-   90 of 92 entries pair identically to production.
-   `XingZ60` keeps 12 of 13 pairs and loses the one that was wrong.
-   `XIEPT2` is refused, and it holds 82 characters of English.

The destination decision still stands, because with no translate stage
 `XIEPT2` gets nothing rather than getting translated. But the decision is now
 about ONE untranslated document, not about losing correct work, and it argues
 ROUTE over REPORT more strongly than before.

## The wiring attempt, and the risk the blast radius did not measure

Attempted 2026-08-13 and reverted deliberately. The scorer itself landed as
 `alignHeadingsForced`; what follows is about connecting it.

Replacing the proportional fallback in `alignDocumentSections` broke three
 `chunk-document.unit.test.ts` cases. One break is correct and two are a
 warning.

THE CORRECT ONE: a leading-kind mismatch with equal counts now PAIRS rather
 than reporting `structure-mismatch`. That is the spurious finding measured on
 `Aniloviraw`, whose report read "source 1 chunks, target 1 chunks" while
 calling the structures different. With one chunk on each side the old
 `mirrored` test could only fail on leading node kinds, so it was reporting on
 an asymmetric preamble and calling it structure.

THE WARNING: two cases produced ZERO pairs for the whole document. Their
 fixtures are synthetic and their headings share no tokens across the two
 sides, so nothing is ever forced, the aligner refuses everything, and under the
 ratified destination the entire document gets no critic work.

`90 of 92 identical` does not cover this, and it is worth being precise about
 why. That comparison ran over real corpus entries, whose headings carry
 romanised names and therefore share tokens; it also compared PAIRINGS rather
 than counting entries that ended with no pairing at all. A document with
 genuinely disjoint heading vocabulary, pure Chinese headings against pure
 English ones with no names anywhere, is the untested case. Its failure mode is
 the worst kind: the entry settles, reports findings, and has done nothing.

So wiring needs a FLOOR before it lands. Either the aligner forcing nothing at
 all falls back to the old path, or the entry blocks loudly. Silently settling
 an entry with zero pairs is the one outcome that must not be possible, and
 choosing between those two is a decision rather than an implementation detail.

The 92-entry comparison should also be re-run reporting zero-pair entries per
 side, which the original did not.

## Landed, and re-measured against the whole corpus rather than inherited

Wired 2026-08-13. The zero-pair risk raised when the first attempt was reverted
 is REAL AND BOUNDED, and this is a fresh measurement of the shipped code rather
 than the earlier 90-of-92 figure, which was taken with a different adapter and
 never counted entries that ended with no pairing at all.

Over every corpus entry carrying both sides at the pinned commit:

```text
  entries with both sides                     92
  pairs produced                             275
  sections refused                            21
  ZERO-PAIR entries                            1   XIEPT2
  entries pairing WITH some refusal            1   XingZ60
```

So 90 of 92 entries pair completely and refuse nothing. `XingZ60`, the defect
 that started this, now pairs by name and refuses only what it should.
 `XIEPT2` is the single entry that refuses everything, and that is the case the
 record already settled: it is a partial translation with six empty target
 bodies, so its "correct" pairing feeds critics Chinese prose against bare
 English headings and manufactures omission claims for content nobody
 translated.

Under `doc/decision/translation-repair-always-yields-output.md`, `XIEPT2` still
 settles, with its translation unchanged and a finding per refused section. It
 does no repair work, which is the honest outcome until a translate stage
 exists, and it never blocks.

The concern was worth raising and the answer was worth measuring: had disjoint
 heading vocabularies been common rather than singular, the same change would
 have quietly emptied a large part of the corpus.

## The block-count gap, recomputed on the corrected pairing

Measured 2026-08-13 on the shipped aligner, over all 92 entries carrying both
 sides:

```text
  pairs whose source and target block counts differ    85 of 275   30.9%
```

NOT DIRECTLY COMPARABLE with the earlier 60 of 172, and saying so matters more
 than the number. Those denominators describe different populations: 172 pairs
 came from a smaller settled set under the old proportional pairing, while 275
 come from every corpus entry under forced pairing. Reading a drop from 34.9% to
 30.9% out of them would be comparing two different questions.

What can be said is narrower and sounder. On pairings the aligner committed to
 only when they were forced, roughly three in ten pairs still differ in block
 count. That is now a statement about translation coverage rather than about
 alignment, which is what `#69` and `#70` needed and what the old figure could
 not provide.

ONE BIAS TO CARRY FORWARD: this population is self-selected toward confident
 pairings, because ambiguous sections are refused rather than paired. If
 ambiguity correlates with uneven coverage, and it plausibly does, the true gap
 is somewhat higher than 30.9%. A comparable figure would restrict both
 measurements to the same entries.
