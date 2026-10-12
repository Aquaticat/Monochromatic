# Ending runaway calls on our side of the wire

Decided 2026-08-17 by the user,
on the observation that the provider does not
auto-terminate token degeneration.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](translation-repair-runaway-call-termination-part-01.md)
  - The decision
  - Why anything is needed at all
  - What was built
  - Both channels are scanned,
    and the thinking one matters most
  - Calibration
  - What is wired,
    and what proves it
  - What the first production traffic showed
  - What the progress line still cannot say
  - The detector catches short cycling and lets long cycling through
  - Two more things the reporting gets wrong,
    both shown at the boundary
  - The guard ends one runaway and the retry layer starts four more
  - What is still owed
  - The idle windows' premise,
    re-derived from first production traffic
  - The straggler grace's cut population,
    counted to the end of the pass
  - Both channels were scanned and one of them was never read
  - The size a cap should read,
    measured over 515 calls
- [Part 02](translation-repair-runaway-call-termination-part-02.md)
  - Correction:
    the silent-reasoning bound at 40,000 is unsound,
    and measured to be so
  - The census,
    re-measured over 602 calls,
    and the bound as shipped
  - Correction:
    10,000 was set on an unrepresentative population,
    and shipped at 32,000
