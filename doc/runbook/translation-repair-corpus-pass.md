# Running a translation-repair corpus pass

A pass reads the pinned corpus,
sends slices to two model providers,
writes one settled artifact per entry,
and publishes a mirrored tree of fixed English pages.
It costs real money and real subscription allowance,
and a long one runs for hours.

This document is the procedure.
`package/module/translation-repair/README.md` is the reference for what each knob means,
and `doc/handover/translation-repair-run-continuity.md` is the record of how the supervisors
and their guards came to be the way they are.
Neither is ordered,
and neither can be followed from top to bottom by someone who has not run one before.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](translation-repair-corpus-pass-part-01.md)
  - What this proves
  - Why this is a runbook rather than a script
  - Setup
  - Steps
- [Part 02](translation-repair-corpus-pass-part-02.md)
  - What to check
  - Restore
