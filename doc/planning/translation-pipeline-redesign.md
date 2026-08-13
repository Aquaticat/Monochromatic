# Producing a translation rather than repairing one

Written 2026-08-13 for `#70`.
This is a PROPOSAL. Nothing here is decided, and it lives in `doc/planning/`
for that reason.

The goal it serves is decided:
 `doc/decision/translation-repair-output-goal.md` records that the pipeline
 yields a good translation of the ORIGINAL,
 even where the translation fed in does not make sense.

## Why the shape that exists cannot reach that goal

Every stage is defect-driven.
Critics find defects in the input translation,
 a panel adjudicates them,
 an editor rewrites the accepted ones through a deterministic apply gate,
 checkers confirm the rewrites.
The unit of work is a defect, and a defect is a claim ABOUT EXISTING TEXT.

A passage with no translation has no existing text to make a claim about.
It can only enter as an omission filed against text that is not there,
 which is what the corpus already shows happening.

## What the corpus actually contains

`XingZ60`, thirteen aligned section pairs, rebuilt with the corrected parser:

```text
pair  3    62 blocks / 4641 chars    1 block  /    22 chars
pair 10    76 blocks / 3483 chars    5 blocks /   719 chars
pair  6     7 blocks /  763 chars    2 blocks /   105 chars
pair  7    18 blocks /  613 chars   20 blocks /  9551 chars
pair  5    20 blocks / 2908 chars   62 blocks / 14080 chars
```

Pair 3's entire English side is the string `## Memories by Friends`.
A heading, with 4641 characters of memorial essay untranslated beneath it.
The current pipeline treats that as a translation with defects in it: the
 critics compare a long original against a heading, file omission after
 omission, the panel accepts them, and the editor writes English one accepted
 issue at a time, with no stage aware it is translating rather than repairing.

Corpus-wide, 60 of 172 aligned pairs differ in block count.

The gap runs BOTH ways, and that is the part earlier framings missed.
Pair 7 holds 613 characters of original against 9551 of translation.
Five to fifteen times is not English being wordier than Chinese, so either those
 sections carry content the original does not, or section alignment is pairing
 the wrong ones.
Any proposal that only answers "translate what is missing" answers pairs 3, 10
 and 6, and says nothing about pairs 7 and 5.

### Pairs 7 and 5 are mispairing, and no entry carries unsupported content

Settled 2026-08-13 by rebuilding the pairing outside the production fallback.
This section CORRECTS the paragraph before it.

Pairs 7 and 5 do not exist under correct pairing. Both are products of the
 proportional-by-character fallback that `XingZ60` triggers, recorded as `#71`.
Pairing `XingZ60`'s sections by index instead leaves one real coverage gap,
 76 blocks against 14, and two untranslated tail sections of 915 and 1459
 characters. The five-to-fifteen ratio is an artifact of the aligner rather than
 a property of the translation.

So the branch resolves to MISPAIRED, and the "carries content the original does
 not" reading is refuted.

The corpus-wide check agrees, and it needed the right unit to say so. Measuring
 every entry except `XingZ60`, over the 271 pairs where both sides are present:

```text
  equal block count           180
  source has MORE blocks       38
  target has MORE blocks       53

  source >= 3x target blocks   11
  target >= 3x source blocks    0
```

Not one pair in the corpus carries three times the blocks on the translation
 side. The extreme asymmetry runs in exactly one direction, and it is the
 coverage-gap direction every option already addresses.

CHARACTER COUNTS CANNOT ANSWER THIS QUESTION, and reading them first gave the
 opposite answer. The same sweep in characters reports 255 pairs with the target
 longer and 83 at more than three times the source, which reads like widespread
 unsupported content. It is not. Chinese carries far more meaning per character
 than English, so over the 246 paired sections holding more than 100 source
 characters the expansion is:

```text
  p10 1.72    median 2.91    p90 3.76    max 16.84
```

A three-times character ratio is the MEDIAN translation, not an anomaly. A
 character threshold below about 3.8 flags ordinary work as suspect. Block
 counts are script-independent, and they are the unit this question needs.

The 11 extreme source-heavy pairs sit in exactly two entries, and both are
 genuine partial translations rather than alignment faults:

-   `XIEPT2`, 8 pairs, the widest holding 1605 source characters against 20.
-   `shi_Yumiaoya`, 3 pairs, the widest holding 1203 source characters against
    12.

Their English pages carry headings with no bodies beneath them, `## Experience`
 followed immediately by `## Departure`, confirmed in the raw bytes.
`parseDocument` reads them correctly as `kind: "heading"` nodes; the sections
 are empty because the translator left them empty. That is the case `#69`
 already decided: the pipeline must yield a good translation even when the
 translation fed in does not make sense.

WHAT THIS CHANGES FOR THE OPTIONS. The claim that a proposal answering only
 "translate what is missing" says nothing about pairs 7 and 5 no longer holds,
 because pairs 7 and 5 are an aligner defect with its own fix in `#74`. Every
 remaining asymmetry in the corpus is a coverage gap.

The two sweeps are CONSISTENT despite different totals. This one finds 91 of
 271 both-sides pairs differing in block count, a rate of 33.6%, against the
 earlier 60 of 172, a rate of 34.9%. The totals differ because the sweeps cover
 different entry sets, but the underlying rate is the same to about one point,
 so neither reading contradicts the other. Carry this one forward because it
 names its method: `alignDocumentSections` at the pinned corpus SHA, counting
 `nodes.length` per side, `XingZ60` excluded as the known mispairing.

## The options

### Option A: route barely-covered sections to a translate stage

Keep the loop. Add a classifier that measures coverage per aligned section and
 sends the sparse ones to a translator instead of to the critics.

Pros:
 smallest change;
 every existing measurement stays valid for the sections that still take the
 repair path;
 the translate stage is needed under every option, so none of the work is
 wasted.

Cons:
 needs a coverage threshold, which is a number someone has to defend, and
 choosing one is the question the user rejected as an X/Y problem;
 the boundary is where the damage is worst, since a section just above the line
 gets the omission-storm treatment;
 says nothing about pair 7.

### Option B: translate every slice, then select against the existing text

Every slice gets a fresh translation from the editor ensemble.
The existing translation joins as one more candidate.
The judges already built for candidate selection choose per slice.

Pros:
 no threshold anywhere, so nothing has to be defended at a boundary;
 one mechanism covers absent, partial, wrong and good input alike, which is
 exactly the decided goal;
 good human translation survives by WINNING selection rather than by not being
 touched, so preservation becomes a measured outcome instead of an assumption;
 handles pair 7 without special-casing: a fresh translation competes with an
 overlong one, and the translate prompt already carries the user's decision that
 accurate translator additions are kept;
 selection, judging and the apply gate already exist and are already measured.

Cons:
 most expensive by far, a full translation per slice per editor model;
 risks discarding good human translation whenever judges are weak, and judge
 quality has never been measured on this question;
 loses the minimal-edit property that makes a repair auditable, since every
 slice is rewritten by construction;
 the introduced-defect differential needs a BEFORE text, and a from-scratch
 translation has none, so that instrument would need rebuilding.

### Option C: fill coverage gaps first, then repair the completed draft

Two phases. A coverage check finds source content represented nowhere in the
 target and translates it into place. The existing repair loop then runs over
 the completed draft.

Pros:
 the trigger is a question about TEXT, not a ratio, so no threshold has to be
 defended;
 the repair loop and every measurement built around it survive intact;
 degrades gracefully, since a missed gap leaves a section exactly as it is
 today;
 the second phase sees a complete draft, which is the state all its instruments
 assume.

Cons:
 the coverage check is the cross-lingual absence question, and that is precisely
 what produced five of round three's eight false positives, so the pipeline's
 correctness would rest on the hardest unsolved sub-problem in it;
 two model passes over everything;
 says nothing about pair 7.

## Ranking

B > C > A.

**B over C** because C builds on the sub-problem that has already defeated this
 project once. Deciding whether source content is represented anywhere in a
 translation is the same judgement that made five accepted issues false
 positives, and a coverage check that misses is invisible: the section simply
 stays untranslated and nothing reports it. B never asks that question. It
 replaces detection with selection, and selection is built, measured, and
 auditable through its own telemetry.

**C over A** because C's trigger is a question about text and A's is a number.
 A's threshold has to be defended at exactly the boundary where misrouting costs
 most, and the user has already rejected reasoning in those terms. C also fails
 softly where A fails loudly: a missed gap under C leaves today's behaviour,
 while a misclassified section under A sends a mostly-good translation into a
 stage that rewrites it wholesale.

## What has to be settled before any of this is built

-   Judge quality on the new question. B stakes everything on judges preferring
    a good human translation over a fluent machine one. Nothing has measured
    that, and #31's judge crosscheck was deferred all the way back in
    milestone three.
-   What replaces the introduced-defect differential. It compares before against
    after, and B removes the before. The source-anchored damage question built
    on 2026-08-12 is the natural replacement, since it never needed the before
    text except to establish that the edit caused the change.
-   ~~What pairs 7 and 5 actually are.~~ ANSWERED 2026-08-13: they are
    mispairing, and no entry in the corpus carries unsupported content. Details
    in "Pairs 7 and 5 are mispairing, and no entry carries unsupported content".
    This no longer gates the decision.
-   Cost. B multiplies generation by the editor roster over every slice of every
    entry, against a provider that already fails transport under load.

## What the prototype did, run against pair 3

`translate-probe` was run over the section whose entire English side is the
 heading. All three editor models rendered it:

```text
source section              4641 chars, 62 blocks
existing English              22 chars, 1 block  ("## Memories by Friends")

hf:moonshotai/Kimi-K3      14177 chars produced
hf:zai-org/GLM-5.2         14275 chars produced
hf:zai-org/GLM-4.7-Flash   14534 chars produced
```

The output is a memorial essay in fluent English that preserves the structure
 the original carries: the `其二：铃语` heading, `<h3 align = "center">`,
 `<p style="text-align: center;">`, `<Hexagon>`, `<details>`, `<summary>`, and
 `<DottedNumber n="二"/>` with its Chinese numeral intact as a component prop.
Three voices of three were heard, and they agree closely on length.

That is the thing the repair loop cannot produce at all. It is not evidence the
 output is GOOD: nobody has read it against the original, the three renderings
 differ (`铃语` came back as both "Lingyu" and "The Bell's Whisper"), and one
 sample proves nothing about the corpus.

### Two findings the run produced by failing first

The FIRST attempt asked one call for the whole section and lost two voices of
 three, one to a six-minute timeout and one to schema-invalid output, then died
 on an uncaught deadline. Editors in this pipeline work on regions of median 75
 characters and at most 562, so that call was eight times larger than anything
 the stage has ever been asked for. The second attempt succeeded on the same
 size, so the limit is load-dependent rather than hard, and a translate stage
 has to treat a large unit as a risk to manage rather than a size to assume.

More structurally: `subdivideChunkPair` returned ONE slice for this section.
Slicing is driven by the pairing, and with a single 22-character target block
 there is nothing to subdivide against, so the whole 4641-character section
 arrives as one unit precisely where the work is largest. A translate stage
 needs subdivision driven by the SOURCE side. This is a concrete requirement
 under every option, and it is invisible from the repair path because a section
 with a real translation always subdivides.

### Read against the Chinese

The output was checked rather than admired. What holds up:

-   Structure survives intact, including the JSX components the archive uses.
-   The classical idiom pair 一家之言，姑妄听之；兼听则明，偏信则暗 came back as
    "What one person says, take with a grain of salt; listen to many and you see
    clearly, trust one side and you stay in the dark."
-   PRONOUNS, which is the highest-stakes question this corpus has. The subject
    had at least three personas with different gender identities and the source
    uses the neutral `TA` throughout. Every gendered pronoun in all three
    renderings, 5 in Kimi-K3, 4 in GLM-5.2 and 3 in GLM-4.7-Flash, refers to a
    DIFFERENT friend described in the same passage, never to the subject.
    Neutral forms carry the subject in every one: 45 in Kimi-K3, 11 in each GLM.
    Misgendering a trans person in their own memorial is the worst error this
    pipeline could make, and none of the three made it.

What does not hold up:

-   `铃语` is the essay's AUTHOR, named in the heading and again in the byline
    `<p style="text-align: center;">铃语</p>`. Kimi-K3 and GLM-5.2 render it
    "Lingyu"; GLM-4.7-Flash renders it "The Bell's Whisper", translating a
    person's name as prose. The identity block cannot help, since it declares
    the subject's names and not a contributor's.
-   GLM-4.7-Flash leaves `TA` untranslated 13 times. Faithful to the source's
    deliberate choice and opaque to an English reader; whether that is right is
    a policy question this proposal does not settle.

So the prototype clears the bar that matters most and fails on a name, which is
 the same class the declared-names rule already handles for subjects and does
 not yet handle for contributors.

## The section aligner turned out to need this decision too

Added 2026-08-12, after `#71`'s aligner was measured against the pin.

The aligner works. On `XingZ60` it pairs every section correctly, anchored by
 three headings whose Latin names match outright, and it reports the two
 genuinely untranslated sections as UNPAIRED rather than placing them somewhere.
Today's proportional fallback slides all of that by two.

Wiring it in is nonetheless blocked, and on this document's question rather than
 on any remaining code.
The pairable sections improve unambiguously.
The unpaired ones need a destination, and both destinations available today are
 ones the pipeline handles badly:

-   Pairing an unpaired section with an EMPTY target survives.
    `subdivideChunkPair` was run on exactly that and returned ONE slice carrying
    915 characters of original against nothing.
    That is the pathological shape recorded already: slicing is driven by the
    pairing, so a section with no translation cannot be subdivided and arrives
    whole, precisely where the work is largest, and the critics then file
    omission after omission against text that is not there.
-   Skipping the section is honest about what is known, and means source content
    reaches no stage at all.
    That contradicts `doc/decision/translation-repair-output-goal.md`, which
    decided the pipeline yields a good translation of the ORIGINAL even where
    the translation fed in does not make sense.

Under option B both disappear, because an unpaired section is simply a slice
 whose existing translation is empty, and every slice is translated regardless.
Under option C the coverage check is what fills it.
Under option A the section is exactly the sparse case the classifier routes.

So the aligner is a reason to settle this document sooner, not a separate
 decision.
The measurement is durable either way: it is recorded in `#71` and the
 tie-break defect it exposed is fixed and tested.

## What exists already

`translate-wire.ts` and the `translate-probe` task are committed, called by
 nothing, and carry both policies the user settled on 2026-08-12: accurate
 translator additions are kept, and declared names are authoritative. The prompt
 offers the existing translation as evidence and as wording worth keeping where
 it is right, never as the thing being corrected, which is the anchoring the
 introduced-defect probe was moved to the same day.

## The contributor-name gap, sized

Added 2026-08-13. The prototype above fails on `铃语`, the essay's author,
 because the identity block declares the SUBJECT's names and not a
 contributor's. That gap is worth sizing before it is designed around.

Searching the corpus for the pattern the prototype hit:

```text
  entries with contributor-named headings (其N：NAME)   1 of 92, 10 headings
  entries with centred byline paragraphs                2, 9 paragraphs
```

The detection is pattern-specific, so a contributor named some other way would
 not be counted. Taken as a lower bound, the exposure is one or two entries and
 roughly ten names.

So the gap is real and NARROW. It does not block option B: extending the
 declared-names block to contributors, or a rule that a heading of the form
 `其N：NAME` names a person rather than a topic, would cover the observed cases.

## `XingZ60` is carrying most of the hard cases at once

Worth stating because it cuts both ways. That single entry is:

-   the ONLY entry whose sections mispair, out of 92;
-   the source of both untranslated sections the aligner would leave unpaired,
    915 and 1459 characters;
-   the only entry with contributor-named headings, all ten of them;
-   the source of the two largest block-count gaps cited in
    `doc/decision/translation-repair-output-goal.md`, 76 against 5 and 62
    against 1.

A fix aimed at `XingZ60` therefore addresses a disproportionate share of the
 known hard cases, which makes it attractive.

The same fact is the warning: a design validated ONLY against `XingZ60` is
 fitted to one document. `XIEPT2` is the useful second case, since it pairs
 correctly while still carrying genuine coverage gaps of 24 against 1, 18
 against 1 and 18 against 2, so it exercises the translate path without the
 alignment defect confounding it.
