# Signals the pipeline emits and nobody reads

Measured 2026-08-13 across all 92 entries at pin
 `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`,
both sides of each.

The section-alignment finding was made because the artifact had been recording
 `alignment structure-mismatch` for weeks and nothing read it.
That is a pattern rather than an incident,
so every signal the deterministic
 core emits was censused at once,
and the census found a second defect.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](translation-repair-unread-signals-part-01.md)
  - Census one:
    what the deterministic core emits over the 92-entry corpus
  - The footnote graph was wrong,
    and nothing was reading it to notice
  - The alignment mismatch finding is a false alarm 6 times out of 7
  - Alignment never drops content
  - Four settled repairs shipped broken footnotes,
    and the detector was right there
  - Census two:
    what a run records across the 56 settled entries
  - Quote anchoring discards 398 critic claims,
    and the cause is still unknown
  - The rejected-value family is small,
    and checked so nobody re-opens it
  - The refiner goes silent on whole entries
  - Dropped merge opinions do not explain the duplicate issues
- [Part 02](translation-repair-unread-signals-part-02.md)
  - The recurring wall:
    outcomes are recorded,
    causes are not
  - What still reads nothing
  - The quote-anchoring re-open alarm was a pooling artifact,
    and the closure stands
  - The wall came down on one of the four
  - The second wall came down,
    and the client was never the problem
  - The third wall is the same shape after all,
    and I said it was not
  - Census of the findings nobody reads,
    pass13
  - A signal that was read and said the wrong thing,
    and one that did not exist (2026-08-26)
