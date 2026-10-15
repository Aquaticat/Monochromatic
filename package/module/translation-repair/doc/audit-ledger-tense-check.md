# Audit ledger: building the tense check

The record of building the tense candidates:
what the review of the tense records and sheets found loose,
and what was fixed.
Findings of those reviews that belong to a named family are filed under that family.
It also holds the rule that quoted words keep their speaker's tense (B627),
which the house tense rule lacked until n161.
The read of a page that missed that defect is M220,
filed in
[Audit ledger: process mistakes, claims and commit messages](audit-ledger-process-claims-and-commit-messages.md).
The entry B627 was written on 2026-10-15 (UTC) from the hand-back of n161 (`s232/handback-n161.md`),
the lead's notes of that day and the text of `src/english-usage-policy.ts` at `277145a862`,
where the two constants it quotes are declared.

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

## B627: quoted words shipped in the past, because the house tense rule had no exception for them

Found on 2026-10-15 by the lead,
in the read of `TianqiChen66624`.

Outcome written on 2026-10-15.
Red `5fe3173cc5`,
fixed in `277145a862`;
the fix is the round n161.

What a reader of the page would have seen:
the last message of `TianqiChen666` (source lines 71 to 75),
which she wrote in her own present,
told in the past,
in two passes (`TianqiChen66623` and `TianqiChen66624`),
while the human archive and her other quoted words on the page keep the present.
The read of the first pass that missed it is M220.

The cause:
the house rule on tense,
which every tier of the writers and judges shows,
listed what the person said among the life told in the past and made no exception for her own words quoted.

The lead ruled on 2026-10-15:
quoted speech keeps its speaker's tense,
and every sheet that states the tense rule carries the exception.

Fixed by n161.
The rule is the constant `QUOTED_WORDS_RULE` in `src/english-usage-policy.ts`:

> Words quoted as someone wrote or said them (a letter,
> a message,
> a quoted line,
> a blockquote of their words) keep the tense the speaker used,
> because they are the speaker's own voice and the past belongs to the narration around them.
> A quotation moved into the past is a defect to hold against a rendering,
> and keeping its present is never a tense inconsistency.

The one-sentence form is `QUOTED_WORDS_REMINDER` in the same file,
for a sheet that tells a reader to move a line of the life to the past:

> Words quoted as someone wrote or said them keep the speaker's own tense,
> so moving a quotation to the past is a defect and keeping its present is not a tense inconsistency.

Where each stands:
- `src/house-policy.ts` appends the rule as the last sentences of the bullet that opens "Tense is chosen once and held."
  (the opening of the bullet is unchanged and pinned by tests),
  so every tier that inherits `HOUSE_POLICY_BLOCK`,
  `JUDGE_POLICY_BLOCK` and `CONTEST_POLICY` shows it.
  It appends the reminder at the end of the tense paragraph of `JUDGE_POLICY_TAIL` and of `MEASUREMENT_POLICY_TAIL`.
- `src/consolidate-wire.ts`,
  `src/translate-wire.ts` and `src/consistency-carry-writer-sheet.ts` end the "ONE TENSE,
  IN THIS ORDER" line with the reminder,
  after "Never let one sentence start in one tense and finish in another."
- `src/editor-selection-sheet.ts` ends the selection criterion about tense with the reminder.
- `src/polish-gate-house-rules.ts` ends the tense paragraph of `POLISH_GATE_HOUSE_RULES` with the reminder.
  That sheet also carries `JUDGE_POLICY_BLOCK`,
  so the reminder stands twice there,
  and a test pins exactly two.
  `src/consolidation-barrel.ts` exports `POLISH_GATE_HOUSE_RULES` so that the built test reaches the text.
- `src/house-form-corrections.ts` now reads
  "the past tense for the life of a person who has died (never for quoted words)".

Sheet texts on tense left unchanged,
because they already agree:
`src/tense-candidate-block.ts` ("a quotation the rule leaves alone"),
`src/consistency-sheet.ts`,
`src/consistency-carry-choice-sheet.ts`,
`src/present-tense-text.ts` (which blanks quoted speech before the candidates),
`src/rendering-audit-prompt.ts` and `src/obligatory-differences.ts`.
The pairing sheets,
the reference attestation,
the picture readings and the derivability sheets carry no tense rule,
and none was added.
The page title lexicon sheet carries the rule.

Test:
`src/sheet-quoted-tense.unit.test.ts` (new) renders all 52 sheets of the rendered-sheets fixture and checks that:
every sheet that carries the house rule shows the rule sentences;
the three inherited blocks hold them;
every sheet with an instruction to move a line of the life to the past shows the reminder or the rule;
every instruction written in a sheet's own words,
a marker the house block does not hold,
stands beside the reminder;
the polish gate text carries the reminder twice;
the list of house corrections of form says "(never for quoted words)";
and each marker is found in at least one sheet,
so the checks are not vacuous.
Red on the build before the fix:
three suites failed
(the house rule sentences missing in every sheet that carries the rule,
the reminder missing beside every move-to-the-past instruction,
and the form-list exception missing).
The guards that remove the text fail 6 rows for the house bullet,
3 for the judge and measurement tails,
3 for each of the translate,
consolidate,
writer,
editor-selection and polish-gate texts,
and 3 for the form corrections.
Two guards first passed with the text removed:
the reminders in the translate,
consolidate,
writer,
polish-gate and tail texts,
because those sheets also carry the full rule.
The test now checks every instruction in a sheet's own words for the reminder itself,
and checks the polish gate text directly.

What followed from the change:
- The text of the sheets is part of the key of the caches that hash the sheet,
  and the caches that do not hash it moved (B623).
- The roster is asked from a bench rotated by the hash of the prompt,
  with a window of quorum plus one seats (`src/stage-fanout-window.ts`),
  so the new text moved the order that voices answer in and which seats stand in a round's window.
  Ten tests that had pinned the old order or seats failed in the whole suite,
  all green in the run of n159.
  n161 made each independent of the rotation,
  and wrote the reason in a comment,
  without loosening what it checks about content:
  `src/corpus-run/audit-sensitivity-print.unit.test.ts` names the three voices in the order the report lists them;
  `src/deep-reply-floors.unit.test.ts` reads the slate entries in roster order;
  `src/corpus-run/editor-calibrate-lane.unit.test.ts` and `src/corpus-run/editor-calibrate-run.unit.test.ts`
  check six distinct seats that all belong to the new `SEATS_THAT_CAN_EDIT` list in `src/roster-seats.test-fixture.ts`,
  which is weaker on which seats than before,
  by necessity,
  and the review of n161 was asked to show that each still fails when its behaviour breaks;
  `src/corpus-run/judge-fidelity-probe-run.unit.test.ts`,
  `src/corpus-run/probe-verify-run.unit.test.ts`,
  `src/corpus-run/probe-verify-collect.unit.test.ts`,
  `src/corpus-run/probe-relabel-pair.unit.test.ts`,
  `src/corpus-run/producer-calibrate-round.unit.test.ts`,
  `src/corpus-run/roster-bench-round.unit.test.ts` and `src/corpus-run/translate-probe-run.unit.test.ts`
  compare ballots,
  claims,
  claimants or renderings sorted by model,
  through the new fixture `src/model-order.test-fixture.ts` (`sortedByModelId`,
  in code-point order);
  and `src/corpus-run/pass-consistency.unit.test.ts` finds the ballot of the first seat asked by its seat,
  and takes the lost voice of the first round from the late judges that the script makes throw.

Corpus effect:
none to measure,
since the change is in the text of sheets and no run has read it;
the replays of both stored runs read clean on the build (B624).

Recurrence:
`mistake-prevention-sheets-quorums-and-outcome-rules.md`,
"A rule a sheet states about tense and what it does not cover",
and `mistake-prevention-tests-clocks-and-arrival-order.md`,
"Orders and seats that a prompt hash decides".
