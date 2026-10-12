# Preventing this package's mistakes

The audit of 2026-09-27 and 2026-09-28 recorded every mistake made while fixing this package
as an M entry in [the audit ledger](audit-ledger-part-49.md#process-mistakes-in-this-audit),
and every defect found while fixing as an X entry.
The ledger is the record,
in the order things happened.
This page is the same knowledge grouped by family:
for each family,
what went wrong,
the one rule that prevents it,
and what enforces the rule.
Where a test or the type checker enforces it,
that is named;
where only a habit does,
the habit is named as such.

Read the checklist before any run launches,
and the family that matches what you are about to do before you do it.

## Parts

This document is kept in parts of at most 1000 lines each,
split at its headings;
the list gives their order and the sections each part holds.
New text goes into the part holding its section,
and a part that would pass the limit is split into a new part listed after it.

- [Part 01](mistake-prevention-part-01.md)
  - Before a run launches
  - Shell commands
  - Guards that cannot fail
  - Searches and censuses that miss
  - Claims without their evidence
  - Current-state docs
  - Commit messages
- [Part 02](mistake-prevention-part-02.md)
  - References in code and docs
  - Dates and clock times
  - Cached decisions
  - Tests touching the real world
  - Tests on the real clock
- [Part 03](mistake-prevention-part-03.md)
  - Copies of shared code
  - Text by code point
  - Words inside words
  - Which fold for which question
  - Checks on the bytes that ship
  - Which seats a quorum counts
- [Part 04](mistake-prevention-part-04.md)
  - Lint and edits
  - Tasks,
    builds and bulk output
  - Questions to the owner
  - Sheets every model reads
  - What each sheet is shown
  - Defaults that stand in for an input
  - Messages a marked class carries
  - Fields carried as strings
  - Counts a finding states
- [Part 05](mistake-prevention-part-05.md)
  - Labels a message names
  - Paired marks
  - Exits an outcome rule reaches
  - Refusals inside a composed operation
  - Checks on one part of a composed text
  - Checks that vouch for a whole block
  - Text that shows nothing
  - Records of more than one round
  - Structure read off the parse
  - What a catch charges
  - Work no floor can check
  - Loops that copy what they built
- [Part 06](mistake-prevention-part-06.md)
  - Numbers read back from text
  - Command lines
  - Tables keyed by text
  - Durations on the system clock
  - Globals a case replaces
  - Readers of the package's own log lines
  - Pairing by position
  - Offsets and positions
  - Provider fields read by their documentation
  - Two layers reading one refusal
  - One field carrying two kinds of text
  - Counts in printed text
  - Modules without a test of their own
- [Part 07](mistake-prevention-part-07.md)
  - Guards a census wants gone
  - Files a later run reads back
  - File names derived from an input
  - Lists that must name every member of a type
  - Output decided by arrival order
  - Escapes and the layer that reads them
  - What a failing check prints
  - Quotes a judge gives back
  - Work merged from parallel briefs
  - How an agent waits
  - Docs that only grow
