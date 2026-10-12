# Two features were built and never wired, and what to do about the aligner

Measured 2026-08-13 against the current build, at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
This is a PROPOSAL. Nothing here is decided, and nothing has been landed.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](wire-the-heading-aligner-part-01.md)
  - Verdict,
    in short
  - The finding
  - The evidence,
    side by side
  - Blast radius,
    re-measured on the current build
  - Options
  - Ranking
  - What has to be settled first
  - A note on how this was missed
  - The same check,
    run systematically
  - What the three unpaired sections actually are
  - How big the change actually is
  - Verification notes
  - Prototyped,
    and four of the five attempts were wrong
  - Correction:
    attempt three is fragile,
    and the "strict improvement" claim was wrong
  - Attempt five resolves it:
    structure as a soft penalty,
    not a veto
  - Wiring the derivability probe:
    where it goes
  - The block-count gap re-measured,
    which `#71` required
- [Part 02](wire-the-heading-aligner-part-02.md)
  - The aligner cannot leave two headings unpaired,
    and that breaks attempt five
  - Attempt six:
    lexicographic scoring,
    prototyped and validated
  - Correction:
    the blast radius was measured against the wrong function again
  - The affinity function saturates,
    so `TRUST` is vestigial
  - The prototype,
    inlined so it survives
  - What the ambiguous sections actually cost
  - Attempt seven:
    the preamble as an empty-labelled unit,
    which now works
  - The wiring attempt,
    and the risk the blast radius did not measure
  - Landed,
    and re-measured against the whole corpus rather than inherited
  - The block-count gap,
    recomputed on the corrected pairing
