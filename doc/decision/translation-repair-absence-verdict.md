# What counts as proof that a passage was never translated

Decided 2026-08-23. The owner delegated this one: the standing instruction is maximum quality,
which determines the answer without a preference being needed.

## The question as posed was wrong

It offered four options, A through D, as alternatives.
Three of them are not alternatives at all.

-   A, ask a roster whether the whole translation carries the passage, is the only one that
    PRODUCES an absence verdict. Nothing else here can.
-   C, require corroboration beyond the matcher's refusal, is a FILTER on a verdict.
    It cannot decide anything on its own, and it costs nothing to apply to A's output.
-   B, fix alignment, improves the CANDIDATES both of the others operate on.
    It is upstream of the question rather than an answer to it.
-   D, park both landings, is the only genuinely exclusive option, and maximum quality rules it
    out: entries measured this session run at 0.37 and 1.88 English characters per source
    character against a corpus median of 2.65, so the gaps are real and large.

## Decision

Take A as the verdict, gate insertion on C's corroboration, and land B as well.

-   THE COVERAGE ROSTER SUPPLIES THE VERDICT. It never consults the pairing, so the mispairings
    this question was opened over cannot reach it, and one mechanism answers both scales.
-   NO INSERTION WITHOUT DETERMINISTIC CORROBORATION. The roster must call the passage absent
    AND the page must be measurably too short to hold it. A false insertion duplicates text in
    a memorial page, which is the expensive error; a missed insertion leaves a gap the archive
    already had.
-   ALIGNMENT WORK LANDS TOO, because it decides which passages are ever asked about.

## Why the roster is trusted with it

Measured 2026-08-23, over six entries:

-   It notices a deleted rendering. Absence votes appeared on 8 of 9 targeted cuts, where the
    cut removed exactly the spans the roster itself had anchored on.
-   It does not simply react to damage. An equally sized cut taken where the roster had not
    pointed produced absence votes on 0 of 9.
-   It reproduces. The targeted arm returned identical verdicts on two runs, and the coverage
    path holds no cache, so the agreement was bought rather than replayed.

## Why corroboration is required anyway

English characters per source character, whole page, over all 92 pairs:
p5 1.42, p25 2.28, p50 2.65, p75 3.00, p95 4.52.

The three entries where the roster refused to call any candidate covered rank 2, 11 and 12
from the short end. The three where it called passages carried and noticed their deletion rank
55, 77 and 80. No overlap.

Two independent signals, one of which consults no model, agreeing on every entry measured.
Requiring both loses nothing that was measured and guards the case where they disagree,
which is exactly the case nobody has seen yet and therefore the one to be careful about.

## Both scales land

The recorded case against paragraph scale is "at most one of twenty-two, and plausibly none",
drawn entirely from `mikaela_khara`. That entry ranks 77 of 92 for translation completeness,
so it was the wrong place to learn what block candidates are made of.
On `shi_Yumiaoya`, rank 2, the roster called 7 of 8 blocks absent with 4 to 6 of 6 voices.

Block candidates remain the noisier population and the merge-versus-omission ambiguity is
sharpest there, which is precisely what the corroboration gate is for:
a merge leaves the content somewhere in a page of normal length,
so a merged pair fails the length test even when the roster is unsure.

## Addendum: local destination corroboration and publication refusal, 2026-08-27

The current-build `Toka_ls` output falsified one premise of page-wide shortfall:
a page of ordinary aggregate length does not imply every passage was merged somewhere.
Verbose translations elsewhere hid an entirely absent linked paragraph naming death date,
time, cause, location and age.
The artifact recorded source-only slice 13 as `not-corroborated`, bought no translation,
and published a known `gap-remains` page.

The decision is therefore refined:

-   The whole-document coverage roster must call source-only passage `absent`.
-   Independent deterministic corroboration is either remaining page-wide shortfall budget
    or a destination carried by that passage and absent from whole target page.
-   `carried`, `partly-carried`, `split` and `inconclusive` all refuse insertion.
-   Any passage still unfilled makes corpus entry fail before contest, artifact and publication.
    A known omission is evidence for retry or diagnosis, never settled output.

The destination path reuses `dropped-destinations.ts`, including Markdown definitions,
bare addresses and trailing-slash equivalence.
It cannot repair a link-free omission hidden by aggregate length;
the publication refusal makes that residual class loud rather than silent.

Implemented in commits `c151e57ca` through `598401349`.
Unit cases cover both corroborators and all coverage verdict classes;
pass-level cases prove evidence reaches translation,
the linked passage reaches page,
and an unresolved gap writes neither page nor artifact.
Removing publication guard, pass handoff, destination corroborator,
coverage-absence conjunct or archive normalization makes its named guard test fail.
Logs: `~/temp/agent/gfp-toka-gap-*.log`.
The widened current production roster still needs live absence-control revalidation
before this addendum closes production readiness.

## What this supersedes

`doc/planning/translation-repair-open-decisions.md` question 28, whose ranking was A > C > B > D
and which framed the four as exclusive. The wiring gate recorded on `#106` is released by this
decision, and the stopgap copy in `doc/handover/translation-repair-history.md` is replaced by this file.
