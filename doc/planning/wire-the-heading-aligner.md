# Two features were built and never wired, and what to do about the aligner

Measured 2026-08-13 against the current build, at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
This is a PROPOSAL. Nothing here is decided, and nothing has been landed.

## Verdict, in short

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

Everything below is supporting evidence, including three prototype attempts
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

## Prototyped, and the first two attempts were wrong

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

## Attempt four resolves it: structure as a soft penalty, not a veto

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
