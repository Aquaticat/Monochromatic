# Answers to the translation-repair decision sheet

Decided 2026-08-16 by the repository owner, on the seven questions drafted in
`doc/planning/translation-repair-open-decisions.md`.
That document holds the questions, the evidence behind each, and the options with their pros and cons.
This one holds only what was chosen, what it means in code, and what it moves.

Two answers carry an explicit ordering instruction rather than only a choice, and both are recorded with the
decision they attach to: measure `#84` before widening rosters, and land `#83` before the critic stage is
kept on the strength of evidence it does not yet produce.

Item numbers throughout are LOCAL TASK TRACKER ids, not GitHub issue numbers.
The two namespaces collide; see `AGENTS.md` rules XNS and XN2.

## Producing roster width: keep three, widen on evidence

Question 1, answer D, with "do `#84` first".

The producing roster stays at three until `#84` measures judge quality on preserve-or-replace.
Widening happens afterwards and on those numbers, not before them.

This overrules the drafted ranking, which put a named constant first on the argument that widening was already
decided and only its size was open.
The owner's reading is that the measurement comes first regardless, so there is nothing yet to name.

What it means concretely:

-   No `PRODUCERS_PER_ROLE` constant is introduced now.
-   `#91` stays blocked on `#84` rather than on this question.
-   The bench numbers already gathered stand as the cost side of a decision whose quality side is missing:
    two producers to six multiplies calls by 1.7 and tokens by 1.8.
-   Nothing measured says a wider roster decides worse. That remains untested rather than refuted.

## Transcribed images: send the image, fall back to protecting the block

Question 2, answer B with an A fallback: "best effort, fallback to A whenever an image's OCR doesn't make sense".

Supply the image to the translators and judges so the transcribed text has a source that can be CHECKED.
Where the reading does not make sense, protect the block structurally instead: keep it out of translation and
splice it back unchanged.

This is the only answer on the sheet that asks for a capability the pipeline does not have, and it carries a
prerequisite the sheet named as a con: the provider roster must actually hold models that read images.
That is a research question with a measurable answer and it is settled before any transport is built, not
assumed.

What it means concretely:

-   Establish first whether the configured roster has vision-capable models. If none does, option B cannot run
    and the fallback becomes the whole behaviour until the roster changes.
-   The image path is already in the markdown, so locating the asset is path resolution rather than a new
    corpus reader.
-   "Does not make sense" needs a stated rule rather than a judgement call, since it decides which of two
    behaviours a block gets. The population is small and enumerated: 8 target-only blocks over 6 entries, plus
    one merged case, `shihai4h`, at 102 source characters against 1665.
-   The paired-quote ratio guard from option A is still needed for `shihai4h`, because no target-only rule
    will ever see it: it is aligned as an ordinary pair.

## Critics: keep them as evidence, remove every early return

Question 3, answer B, with "land `#83`".

Critics stay in the translate path, supplying named defects to the judges rather than deciding anything.
Every early return is removed, so a critic can no longer block a document or return the original target and
discard translated slices that already succeeded.

The sheet's own con against B was that the numbers justifying the spend do not exist until `#83` lands.
The instruction to land `#83` answers that directly: produce the numbers, then keep paying with the evidence
in hand.

What it means concretely:

-   `#86` is decided rather than open.
-   `repairChunk` must stop returning its input unchanged when non-translation votes stand, and the
    document-level dominance check must stop returning the whole original target.
-   `#93` is confirmed as a defect on this answer. An empty critic roster is a misconfiguration here, not an
    intended configuration, because critics are kept. The guard can read an empty list.
-   `#83` is blocked by `#89`, so landing it means landing the driver's outcome and cache first.

## Self-certifying checkers: a half, matching selection

Question 4, answer A.

A checker's verdict on text it helped write counts for half, the same discount selection already applies.

The sheet was explicit that consistency is the only argument for this number, and that the arithmetic which
justifies a half in selection does not transfer: selection needs weight 2 to carry a candidate, so half-weight
self-votes cannot, whereas resolution checking tallies verdicts about one claim and nothing in the arithmetic
picks a number. The choice is made on consistency with that understood.

What it means concretely:

-   `#91` takes a half for self-certification.
-   The number is a stated preference rather than a derived one. Anything later measuring self-preference
    directly, which `#84` may, is grounds to revisit it.

## Replacement rate: widen the judged window and re-read it

Question 5, answer E.

Widen the judged window on slices where the archive's layout differs from the original's, then re-read the
replacement rate.
This separates "the archive is worse" from "the archive is laid out differently", which is the question under
the 73 percent replacement figure.

What it means concretely:

-   `#108` is authorized, and its cost is the repriced one: three arms rather than two, with the candidate
    slate produced once and judged repeatedly, roughly 1760 exchanges over the flagged slices plus matched
    unflagged controls.
-   `#109`, splitting `runTranslateStage` into producing and judging halves, is a prerequisite rather than a
    detour, because a two-arm comparison resamples the candidates and cannot measure the window.
-   None of A to D is chosen by this. Option E was ranked first precisely because it runs before that choice
    and changes what the choice is made on.

## Thin-roster slices: cache anything examined at all

Question 6, answer B.

The rule as it already stands: zero voices is not cached, one voice is.

What it means concretely:

-   No code change, no schema field, no cache version bump. The 150 slices already on disk stay valid.
-   A slice decided by a thin roster resumes indistinguishably from one decided at full strength unless a
    reader goes looking in `findings`. That is accepted, on a measured population of 34 slices in 7 entries,
    all in the lane where thinness means no improvement was attempted rather than nothing inspected.

## Non-translation denominator: delegated

Question 7, delegated.

Taking the drafted delegation answer: option B now, option C held until `#96` can carry an unexaminable
verdict. That ordering costs nothing, because C keeps B's denominator.

What it means concretely:

-   The ratio keeps reading over the SLICES, which is what the code already does, and the contract text stops
    calling the denominator the document's characters. This is documentation of existing behaviour, not a
    behavioural change.
-   `XIEPT2`, which produces no slices at all and settles as a clean unchanged document having examined
    nothing, keeps doing so for now. Reporting it as unexaminable is option C, and it waits on `#96`.
-   Revisit when `#96` lands.

## What the answers move

Unblocked and authorized: `#86` decided, `#108` authorized behind `#109`, `#91`'s self-certification weight
settled, `#104` settled as documentation.

Ordering the owner set: `#84` before any roster widening; `#89` then `#83` before the critic spend is
justified by its own numbers.

Still blocked on measurement rather than on a decision: roster width, which waits on `#84`.
