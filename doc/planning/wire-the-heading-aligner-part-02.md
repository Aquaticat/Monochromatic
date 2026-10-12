# Two features were built and never wired, and what to do about the aligner, part 02

Part 02 of [Two features were built and never wired, and what to do about the aligner](wire-the-heading-aligner.md),
whose index lists every part in order.

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
