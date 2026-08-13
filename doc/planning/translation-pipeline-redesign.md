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
-   What pairs 7 and 5 actually are. Whether the translation carries unsupported
    content or the sections are mispaired changes which option even applies, and
    the settled artifacts cannot answer it because they predate the parser fix.
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

## What exists already

`translate-wire.ts` and the `translate-probe` task are committed, called by
 nothing, and carry both policies the user settled on 2026-08-12: accurate
 translator additions are kept, and declared names are authoritative. The prompt
 offers the existing translation as evidence and as wording worth keeping where
 it is right, never as the thing being corrected, which is the anchoring the
 introduced-defect probe was moved to the same day.
