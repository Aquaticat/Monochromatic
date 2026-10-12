# Audit ledger

Every finding of the whole-package audit the owner asked for on 2026-09-27
("audit the whole translation-repair pkg for all the mistakes we've made and fix all of them",
"Mistakes made,
ever,
for this pkg,
not just today").
Each finding carries where it is,
the evidence,
the fix,
the guard,
and its status.
A finding leaves this ledger only when its fix and guard have landed,
and its lesson then lives in the prevention doc.

Probe scripts and their outputs stay outside the repository,
under `~/temp/agent/audit-<area>/`,
because they read the pinned corpus,
which is never committed.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](audit-ledger-part-01.md):
  entries C1 to G1
  - Community and fandom glossaries
  - Rendering glossaries
  - Canadian forms passes
  - Glossary entry-content mutation check
  - Glossary re-probe
  - Consolidation gate
- [Part 02](audit-ledger-part-02.md):
  entries S1 to S20
  - Rule text and sheet consistency
  - Runs
- [Part 03](audit-ledger-part-03.md):
  entries H1 to H16
  - History,
    classes 93 to 185
- [Part 04](audit-ledger-part-04.md):
  entries E1 to T4
  - History,
    classes 1 to 92 and before numbering
  - Floor replay over archives and settled pages
  - Test suite
- [Part 05](audit-ledger-part-05.md):
  entries T5 to T8
- [Part 06](audit-ledger-part-06.md)
- [Part 07](audit-ledger-part-07.md)
- [Part 08](audit-ledger-part-08.md)
- [Part 09](audit-ledger-part-09.md)
- [Part 10](audit-ledger-part-10.md)
- [Part 11](audit-ledger-part-11.md)
- [Part 12](audit-ledger-part-12.md):
  entries T9 to A18
  - Page assembly and the corpus-run driver
- [Part 13](audit-ledger-part-13.md):
  entries P1 to L3
  - Providers,
    routing and seating
  - Repair lane
- [Part 14](audit-ledger-part-14.md):
  entries L4 to L15
- [Part 15](audit-ledger-part-15.md):
  entries L14 to D21
  - Docs and comments against code
- [Part 16](audit-ledger-part-16.md):
  entries D22 to X1
  - Found while fixing
- [Part 17](audit-ledger-part-17.md):
  entries X2 to X20
- [Part 18](audit-ledger-part-18.md):
  entries X21 to B17
  - Recurring code families
- [Part 19](audit-ledger-part-19.md):
  entries B18 to B22
- [Part 20](audit-ledger-part-20.md):
  entries B23 to B26
- [Part 21](audit-ledger-part-21.md):
  entries B27 to B29
- [Part 22](audit-ledger-part-22.md):
  entries B30 to B41
- [Part 23](audit-ledger-part-23.md):
  entries B42 to B56
- [Part 24](audit-ledger-part-24.md):
  entries B57 to B71
- [Part 25](audit-ledger-part-25.md):
  entries B72 to B76
- [Part 26](audit-ledger-part-26.md):
  entries B77 to B82
- [Part 27](audit-ledger-part-27.md):
  entries B83 to B96
- [Part 28](audit-ledger-part-28.md):
  entries B97 to B107
- [Part 29](audit-ledger-part-29.md):
  entries B108 to B120
- [Part 30](audit-ledger-part-30.md):
  entries B121 to B135
- [Part 31](audit-ledger-part-31.md):
  entries B136 to B153
- [Part 32](audit-ledger-part-32.md):
  entries B154 to B170
- [Part 33](audit-ledger-part-33.md):
  entries B171 to B188
- [Part 34](audit-ledger-part-34.md):
  entries B189 to B205
- [Part 35](audit-ledger-part-35.md):
  entries B206 to B218
- [Part 36](audit-ledger-part-36.md):
  entries B219 to B231
- [Part 37](audit-ledger-part-37.md):
  entries B232 to B253
- [Part 38](audit-ledger-part-38.md):
  entries B254 to B271
- [Part 39](audit-ledger-part-39.md):
  entries B272 to B290
- [Part 40](audit-ledger-part-40.md):
  entries B291 to B301
- [Part 41](audit-ledger-part-41.md):
  entries B302 to B318
- [Part 42](audit-ledger-part-42.md):
  entries B319 to B334
- [Part 43](audit-ledger-part-43.md):
  entries B335 to B354
- [Part 44](audit-ledger-part-44.md):
  entries B355 to B372
- [Part 45](audit-ledger-part-45.md):
  entries B373 to B386
- [Part 46](audit-ledger-part-46.md):
  entries B387 to B400
- [Part 47](audit-ledger-part-47.md):
  entries B401 to B415
- [Part 48](audit-ledger-part-48.md):
  entries B416 to B442
- [Part 49](audit-ledger-part-49.md):
  entries B443 to M81
  - Process mistakes in this audit
- [Part 50](audit-ledger-part-50.md):
  entries M82 to M112
- [Part 51](audit-ledger-part-51.md):
  entries M113 to M125
- [Part 52](audit-ledger-part-52.md):
  entries M126 to M145
- [Part 53](audit-ledger-part-53.md):
  entries M146 to M63
- [Part 54](audit-ledger-part-54.md):
  entries M62 to M39
- [Part 55](audit-ledger-part-55.md):
  entries M38 to M13
