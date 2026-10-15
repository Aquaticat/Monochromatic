# Audit ledger: building the tense check

The record of building the tense candidates:
what the review of the tense records and sheets found loose,
and what was fixed.
Findings of those reviews that belong to a named family are filed under that family.

Split on 2026-10-14 (UTC) out of `audit-ledger-tense-check-and-consistency-pass.md`,
which had reached 994 lines and held the tense check and the consistency pass in one file.
Entries keep their ids and their text.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B433: tense records and sheets the review found loose

Red `dd4d201aa2`,
fixed in `9f936b2c2a`.

The same review found five more.
The pass republish read `info.yml` for every artifact it replays,
where the other replays read it only for generation 15 and later,
so a damaged file beside a generation 14 artifact left its page unrepublished;
`readSettledEntryInfo` is now the one gate.
A damaged `info.yml` threw the parser's own error,
which names no entry and quotes the person's metadata;
it now throws `EntryInfoParseError`,
which names the entry and where the parser stopped,
quotes nothing and carries no cause.
A `died` of a kind that is neither text nor a finite number
(a truth value,
a list,
a record,
a number that is not finite)
switched the feature off without a word;
it is now logged once per entry.
The contest and gate sheets chose the tense block's fence without the block's own lines,
which can hold a longer run of `=` than any text they came from.
The `died` identity line interpolated the raw value;
it is now a JSON string,
byte-identical for every date the corpus records,
so no key moved.
The reader accepted records the writer never writes:
an empty list,
empty groups,
any label;
it now requires the labels the slice's sheet gave,
once each and in order,
and the labels live in `tense-candidate-labels.ts`.

Measured on the pinned corpus:
89 of the 92 `info.yml` files record `died` as a date string and 3 record none;
the detector finds 113 candidates on 41 of the 89 pages that record a death.

Kept by the lead under the owner's instruction of 2026-10-11:
the unreadable-`died` warning sits in the entry reader;
a blank `died` and a top-level one stay silent;
aliases match with case folded;
an alias joined by a slash stays one name;
the detector reads top-level paragraphs only;
the keys name no detector version,
since a change to the detector moves the version of each stage it reaches by the cached-decisions rule.
Changed by the lead's decision,
in work still open when this entry was written:
a damaged `info.yml` is logged and the entry ships with no death recorded,
by the owner's rule that a run always ships;
the window-trial instrument shows the tense block as the pass does.

## B441: a damaged info.yml stopped its entry and refused its replays

Red `a08a6634b7`,
fixed in `62a07ceeb9`.

Found on 2026-10-12 (UTC) by the lead's decision on B433,
against the owner's rule that a run always ships.
`readEntryInfoRecord` threw `EntryInfoParseError` for an `info.yml` that refused to parse,
so `preparePassEntry` stopped the entry before any paid call and its page did not ship,
and `readSettledEntryInfo` threw for the carve,
the audit and the republish of its artifact.
The reader now answers an `unreadable` record carrying the refusal,
which names the entry and where the parser stopped and quotes none of the file,
and warns when given a logger;
every consumer reads any record that is not `read` as no death,
so the entry goes on exactly as one whose `info.yml` records none.
`entryInfoFindingsOf` puts the refusal on the preparation's findings,
which the artifact records,
so a reader tells an unreadable record from an absent one with no new generation 15 key.
The replays read it the same way,
since the run recorded no death,
and warn only where the caller passes a logger:
the republish does,
the carve and the audit stay silent as their pinned output requires.
No cache key moved,
since the keys fold in an ended life only when there is one.
Changed by the lead's decision,
in work still open when this entry was written:
a `died` of a kind that is neither text nor a finite number,
which B433 logs,
also puts a finding on the artifact.
