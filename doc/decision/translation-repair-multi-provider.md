# Translation repair: two providers, and the quota reader that was never wired

Decided by the owner on 2026-08-24 across four rounds of questions.
Supersedes the single-provider assumption throughout `package/module/translation-repair`.
Reverses part of the GLM-4.7-Flash seat measurement,
and changes the premise of two findings:
that the checker-side self-certification discount is unreachable in production,
and that checker width changes no verdict.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](translation-repair-multi-provider-part-01.md)
  - Why
  - Providers
  - Routing
  - Roster
  - Still to measure
  - What has landed
- [Part 02](translation-repair-multi-provider-part-02.md)
