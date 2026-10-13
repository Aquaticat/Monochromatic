# Audit ledger: process mistakes, docs that grow or go stale

Docs left stale after the state they describe moved,
docs that grew past reading,
and the first split of them,
cut by size and named by number.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## M17: a file split at the line cap, with comments elsewhere still naming the old file

Status:
corrected in `e52de1f23` (four references,
one more than first counted).
`pass-entry.ts` was split at its line budget and the write order moved to `pass-entry-persist.ts`,
yet `published-page-check.ts`,
`verify-published.ts` and a `publish-fixed.unit.test.ts` case name still
credit `pass-entry.ts` with it.
A reader sent there finds no write at all.
Prevention:
every split runs `rg` for the backticked old filename across `src`,
tests and `doc`,
and each hit that names a moved responsibility is repointed in the same commit.

## M20: docs naming a log line the code never writes

Status:
corrected,
2026-09-27 (E4).
The README and the corpus-pass runbook both said dropped addresses reach the run log at `info`
under `publish: dropped destination`;
no such line exists,
and the real one is at `warn`,
reading `entry <id>: page drops source destination <address>`.
Prevention:
before a doc names a log line,
a message or an output line,
`rg` the source for the exact string and copy it from there.

## M55: the handover's next steps still called a read page unread

Status:
happened 2026-09-28,
found 2026-09-29 while fixing D28,
and fixed the same day.
TianqiChen66621's page was read against the source on 2026-09-28,
its class was fixed,
and the pass log recorded both,
but the current snapshot's "What to do next" still said the page was not yet read
and still listed reading it as a next step;
its "Where the work stands" had no checkpoint after 2026-09-24,
and its repository state named a tip from 2026-09-16.
A session starting from the handover would have read the page again,
or taken the checkpoint of 2026-09-24 for where the work stands.
The document map's current status (D28) had stopped the same way three weeks earlier.
Prevention:
a page read,
an owner ruling built or a change of plan updates the snapshot's "What to do next" in the same sitting,
before the next piece of work,
and its newest checkpoint when the next steps change;
the map's "Current status" moves with them when what it states has changed.
The prevention doc's "Current-state docs" holds the rule,
and its launch checklist asks for it.

## M60: account paragraphs that pointed at the paragraph before them, and a status B24 left stale

Status:
happened 2026-09-29 in B24's fix commits,
corrected in B26's.
Two cache-account paragraphs,
one each in `translate-document-contract.ts` and `consolidate-key.ts`,
ended "Same cache check as the paragraph before",
a reference by position that B26's own paragraph,
added after them,
would have repointed.
B24 also left B21's status naming only families one and two as read.
Prevention:
`mistake-prevention.md`,
"References in code and docs";
closing a B21 family updates B21's status in the same commit.

## M163: docs appended to with no bound, the ledger to 41,252 lines

Status:
found on 2026-10-12 (UTC) when the owner asked why the Markdown files ran to a million tokens
and ruled that a Markdown file holds at most 1,000 lines,
or up to 2,000 where the lead records why 1,000 is too tight.
Every entry,
run and checkpoint had been appended to one file each:
the audit ledger stood at 41,252 lines,
the OpenRouter pass log at 26,295,
the handover snapshot at 9,344,
and 38 translation-repair docs past 1,000 lines held 143,715 lines between them.
No agent could read one of them whole,
and nothing measured their length.

The docs were split twice.
The first split is M165's mistake and was replaced;
the second files each doc's sections by subject,
phase or span of dates,
as "Docs that only grow" in `mistake-prevention-docs-and-references.md` describes.

Prevention:
`doc-line-limit.unit.test.ts` fails on any package doc,
the package README or repository-level translation-repair doc past its bound,
so a doc is split when it nears the limit,
not after it has grown past reading.

## M165: the lead split the long docs by size and numbered the pieces

Status:
happened on 2026-10-12 (UTC),
replaced on 2026-10-13 (UTC).
Told that a Markdown file holds at most 1,000 lines (M163),
the lead wrote a script that cut each of the 38 long docs at whichever heading came before the limit
and named the pieces `<stem>-part-01.md` onward,
203 files in commit `a2eb509e92`.
The cut fell wherever the count ran out:
one ledger family was spread over several files that also held the next family's opening,
a day of the pass log ended mid-run in one file and resumed in another,
and no file name said what its file held.
The lead checked that every line survived in order and that no cut fell inside a fence,
and took that for a correct split.
The owner rejected it:
"At least we should make sure the splits make logical sense.
'On Headings' is a small guarantee,
but not enough",
and "naming them part-NN is like saying we don't care".
The lead also wrote into the ledger and the prevention doc,
as the rule,
the layout the owner then rejected.

While building the replacement the lead capped a verification command's output several times
(`head --lines 400`,
an `awk` filter on the line number,
`tail --lines`,
a `sed --quiet` line range,
and `cut` on result lines),
which the shared facts forbid because a capped listing hides what comes after the cap,
and once let the split verifier print its whole failure list to the console
where the report file it had already written was the thing to read.

Fixed by the second split:
each doc's files were planned by hand or by a reader who read the stretch being cut,
ledger entries are filed by the family the prevention doc already gives them,
logs are filed by date and clock span,
and stretches with no heading had headings added at their real shifts of subject before any cut.

Prevention:
a split is designed from what the text is about,
never from a line count;
a file name that would need a counter means the boundary is wrong.
The rule and its guard are under "Docs that only grow" in `mistake-prevention-docs-and-references.md`.
A check that a transformation lost nothing is not a check that its result is what was asked for.
