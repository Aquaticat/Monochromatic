# Preventing mistakes: docs and references

Rules for the docs themselves:
current-state docs,
references in code and docs,
dates and clock times,
and how long a doc may grow.

Part of [Preventing this package's mistakes](mistake-prevention.md),
which lists every file of this record.

## Current-state docs

What happened:
the document map's current status still described the pipeline of 2026-09-06 three weeks later,
and said no new pass was authorized while passes kept running (D28);
the handover index put the kill-and-relaunch rule in a README section that had moved;
and the day after TianqiChen66621's page was read,
the current snapshot still listed reading it as a next step (M55).
The scan B102 added gave this doc a section of its own,
and "Copies of shared code" went on saying nothing fails on a shared module without its own test (ledger B103).
A batch's state file listed two agents as running after the session that launched them had ended,
their folders unwritten since 2026-10-06 (UTC) and nothing handed back,
and four days passed before a merge showed their patches missing (ledger M140).

The rule:
a page read,
an owner ruling built
or a change of plan updates the current snapshot's "What to do next" in the same sitting,
before the next piece of work,
and its newest checkpoint when the next steps change;
the map's "Current status" moves with them when what it states has changed.
A status paragraph carries the date it was written,
and points at a record by its name and date,
not by its place in a file that grows.
A state file's "running" line carries the check that proved it
(an agent's id answering,
or a folder written since);
after a session break,
each agent's folder times are checked before the line is trusted.
A change that adds a guard searches this doc for sentences calling the gap open
(`rg --line-number 'Nothing yet|is open' package/translation-repair/doc/mistake-prevention.md`,
and the guard's subject by name)
and rewrites each in the same change.

What enforces it:
habit,
and step 7 of the launch checklist;
no test can tell a current paragraph from a stale one.

## References in code and docs

What happened:
588 task-list numbers stood in the package's source,
tests,
docs and task descriptions as if they were references,
seven of them in lines the commands print (D22).
One number named different tasks in different sessions,
and on GitHub each named an unrelated issue,
so no reader could recover any of them.
Several sat beside claims the work they named had since overtaken.
The repository-level docs carried 1,206 more (D26),
and the current handover's open-work list was task numbers
naming two pieces of work recorded nowhere else.
Two cache-account paragraphs written for B24 said "same cache check as the paragraph before",
which names nothing once a paragraph is added between them (M60),
and a census found hundreds more references by position in the package and the living docs (D33),
five of them pointing the wrong way after the text around them moved.
A read-only agent's comments named a guard as "the check just made" (T8,
twenty-fourth batch),
and a search for that shape found five more code pointers by sequence in the tests
("the next check",
"the NEXT check down",
"the next line can show",
"the previous case",
"reaching the next line"),
which D33's scan does not read.
A trial fix's comment named its check as "the check below",
and the position scan turned the suite red before the change landed (M111).
Six case names and a comment cited "the fidelity cluster",
"the group cluster" and the like,
names a writer gave its own work that no ledger entry holds (ledger B333).

The rule:
a reference names something a later reader can open:
a ledger entry,
a doc heading or path,
a file or symbol,
a commit,
a date,
or the finding itself in words,
and never a position
("above",
"the paragraph before",
"the case before this",
"the next check",
"the check just made"),
which a later insertion silently repoints.
A group of work is cited by the name the ledger gives it
(an entry,
or a numbered batch of a section),
never by a name a writer made for it.
Open work goes in the ledger,
not only on a task list.
A GitHub issue is cited only after `gh issue view` shows it is the one meant,
and is added to the guard's list in the same commit.
Before a citation is rewritten,
the claim beside it is checked against the code,
since the work it named may have changed that claim,
and the number is read in the task record of the session that wrote it,
since the same number names different work in another.
An owner's words keep their number verbatim,
checked against the transcript or the file the owner wrote in,
and are listed in the guard.

What enforces it:
`package/translation-repair/source-scan/src/task-list-numbers.unit.test.ts`,
which fails on a sign followed by one to four digits
anywhere in the package's source,
tests,
docs,
README or `mise.toml`,
and in the living repository-level docs `package/translation-repair/source-scan/src/living-docs.test-fixture.ts`
locates,
unless it is a listed issue or sits inside a listed owner quotation,
and on a listed issue or quotation that no longer occurs;
it fails too on a number written after the word "task" (D31)
outside the listed takeover-era stretches,
which keep that tracker's numbers under their notes.
`package/translation-repair/source-scan/src/position-references.unit.test.ts` (D33) reads the same texts
and fails on "above" or "below" after any word that marks no comparison,
bound or placement,
unless what follows compares or names,
on a reference verb or a parenthesis around one,
on a sequence noun before "before this" or "after it",
on "earlier in this file" and its kin,
and on "the former" and "the latter",
outside its listed exemptions,
and on an exemption that no longer names a reference.
Its first version read positions only after a listed noun
and passed a couple of hundred after nouns the list lacked;
a guard built on a word list is measured against a broader scan before it closes an entry.
Nothing enforces the sequence form:
of the 33 lines in `src` matching "just" before a verb of reading or making,
or "the previous",
"preceding",
"next" or "following" before a line,
check,
statement,
block,
call,
case or loop,
the five fixed ones pointed at code;
the other 28 name a document's lines or blocks,
a parser's input
or a run's order,
which a word list cannot tell apart from a pointer.
A reviewer reads new comments and case names for them.

## Dates and clock times

What happened:
owner answers given between 00:00 and 04:00 UTC were dated by the local day before,
the voting rulings in 40 places (D12);
clock times were copied as `git log` and `find` print them,
in local EDT with no zone,
157 of them in 17 files,
and the scan that found them skipped 14 more written with seconds (D25).

The rule:
a date or time is read from its source's own timestamp and written in UTC with its zone.
Transcripts and run logs print UTC;
`git log`,
`find` and `stat` print local time,
so they run under `TZ=UTC` with a local-format date.
An owner answer is dated by the UTC day of its transcript entry.
A range states its zone once,
after its second end;
a time whose zone cannot be recovered says so in words.

What enforces it:
`package/translation-repair/source-scan/src/clock-time-zones.unit.test.ts` for clock times,
over the package's comments,
docs and README,
the decision records and the current handover;
dates by habit,
with the D12 census as the way to check them.

## Docs that only grow

What happened:
the audit ledger,
the OpenRouter pass log and the handover snapshot were appended to at every finding,
run and checkpoint and never split,
until the ledger held 41,252 lines and 38 translation-repair docs together held 143,715 (ledger M163).
No reader could open one whole,
and an agent reading one spent its context on it.
The first split cut each doc at the heading before the limit and numbered the pieces,
so a file held whatever happened to fall inside its count and its name said nothing (ledger M165).

The rule:
a Markdown file holds at most 1,000 lines,
as the owner ruled on 2026-10-12;
up to 2,000 only where the lead records why 1,000 is too tight.
A doc past the limit keeps its path as an index:
what a reader needs first,
then a contents list saying what each file holds.
Each file beside it holds one thing a reader would look for,
a subject,
a phase of the work or a span of dates,
and is named `<stem>-<what it holds>.md`.
The name and the sentence under the file's title are true of everything in the file.
A name that needs a counter,
"other" or "continued" means the boundary is wrong:
move the boundary.
A dated log is filed by date span,
a reference doc by topic,
a record of phases by phase;
a ledger entry goes into the file of its family,
which is the family this page files it under.
A stretch with no headings is read and given headings at its real shifts before it is cut.
Files may be small;
none is padded or merged to even out sizes.
New text goes into the file whose subject it belongs to;
a file that nears the limit is divided by a narrower subject or a shorter span,
and the index lists the new files.
A reference definition stands in every file whose links use it.
A guard that reads a record reads its index and every file that says it is part of it.

What enforces it:
`doc-line-limit.unit.test.ts` reads the package's docs,
its README and the repository-level translation-repair docs,
fails on any past its bound,
fails on a file named by a counter or a bare number,
and fails on a file that names a record whose index does not link it;
`withFiles` in `living-docs.test-fixture.ts` gives each living-docs guard a record's index and the files that say they are part of it.
Whether a boundary makes sense is the writer's reading;
no test judges it.
