# Audit ledger: the consistency pass, voices lost and places left unlocated

Paths written `src/...` in this record name the layout before 2026-10-18,
when the package `package/module/translation-repair` was split into the packages under `package/translation-repair`.
`doc/audit/translation-repair-package-split-map-2026-10-18.json` gives each file's current path.

The consistency pass of the run `TianqiChen66625` lost voices and left a chosen place unlocated.
The round n170 read the run and found why (`s241/notes-n170.md`,
which the lead wrote from n170's report,
since the tool refused n170's own Write of the report),
the lead ruled on each finding on 2026-10-15,
and the round n171 built the rulings.
This file holds the findings and what n171 fixed:
replies refused for the way they named a label (B639),
a run-off whose result the log never stated and a re-ask whose failure it hid (B640),
a carry choice that split and was not run off (B641),
a chosen place that no quote located (B642),
and an abandonment line that counted the wire and called it delivered characters (B643).
It also holds two defects that n171 introduced and found while fixing the lint findings of its landing:
a blank quote that hung the pass (B644),
and word edges that did not read a combining mark (B645).
The fifth finding of n170,
the empty truncations of the `minimax` seat,
needed no change beyond B639:
the seat sent a `max_tokens` of 10,822 and was cut with no answer and 40,377,
46,009 and 41,654 characters of reasoning,
and the vote was lost to the label rule on the re-ask and not to the truncation.

The rounds landed on 2026-10-18.
n171 landed with n166,
n168 and n169 in the tests `555bb74aa0` and the code `29d6064708`,
with lint red at that commit by the message's own account (21 errors and 46 warnings,
all in files n171 added or changed).
The follow-up `71b0057920` (tests) and `0199690299` (code) fixes the lint findings and the two defects named here.
The consistency cache version moved from 4 to 5 in `29d6064708`,
since the rulings change what the pass asks and decides.
The blankness scan that the landing gate then failed is B646,
filed in
[Audit ledger: the source scans and the coverage census](audit-ledger-source-scans-and-coverage-census.md).
The lead's read of the run that these findings corrected is M226,
filed in
[Audit ledger: process mistakes, claims and commit messages](audit-ledger-process-claims-and-commit-messages.md).

Written on 2026-10-18 (UTC) from the notes of n170 (`s241/notes-n170.md`),
the briefs of n171 and n173 (`prompts/prompt-n171-consistency-voices.md`),
the four commit messages named in this file and the headers of the files they added.
n171 returned no hand-back file,
so its red logs,
its corpus measure and its replays are not among the sources,
and this file states none of them.
The brief asked n171 to rebuild the three ballots of the second group in a test
and to report which span the locator finds;
the header of `src/consistency-span-agreement.ts` states the answer,
and no report of it is among the sources.
Log lines are `L` followed by the number of the line in `corpus-pass-TianqiChen66625.log`.
The labels Q1 to Q5 are the notes' own and are no ledger ids.
No line numbers of source files are cited,
since the tree has since moved.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B639: replies that named the winning label in another form were refused

Found on 2026-10-15 by n170,
in the log and the stored replies of the run `TianqiChen66625`
(`s241/notes-n170.md`,
Q1).

Outcome written on 2026-10-18.
Red `555bb74aa0`,
fixed in `29d6064708`;
the fix is the round n171.

What the run showed:
seven replies of the consistency pass were refused for the way they wrote a label,
and six of them named the option that won anyway.
The labels are `OCCURRENCE n` (a shown place) and `CANDIDATE n` (a carry candidate).
`mercury` answered `Occurrence 3` and `Occurrence 2` (L 9533 and L 9572),
`glm` answered `"3"` twice (L 9538 and L 9577),
`minimax` answered `"2"` and then,
on the re-ask,
`Candidate 2` (L 9626 and L 9625),
and later `Candidate 2` and then `Candidate 1` (L 9640),
and `Kimi` answered `Candidate 4` and then,
on the re-ask,
`"4"` (L 9650).
The first ask of the run was refused by the same rule for the re-asks of `minimax`,
which answered `Occurrence 1` after its empty truncations.
The pass of `TianqiChen66624` ran the same guard code and had nine such refusals
(`mercury` `"1"` and `Occurrence 4`,
`glm` `"1"` and `"3"`,
`minimax` `Candidate 1`).
Over both passes the seats lost were `minimax` 7,
`mercury` 6,
`glm` 5 and `Kimi` 1,
and the asks were the first ask 10,
the run-off 4 and the carry choice 5.

The cause:
the refusal site (`src/chat-json-outcome.ts`) runs the caller's guard,
and every guard compared the written label to the shown ones exactly.
The run-off used `usableChoiceFor({ labels })` in `src/consistency-choice.ts`,
whose rule is `labels.includes(ballot.choice)`,
the carry choice used the same function,
and the first round used `isUsableConsistencyBallot` and `namesShownOnce` in `src/consistency-wire.ts`
for the choice,
the `keep` labels and the quote labels.
The sheets gave only a placeholder,
the labels appeared only in the headers of the fences,
and the response format held the choice as a plain string with no `enum`.
When a re-ask failed too,
`src/nudged-reask.ts` returned the first outcome,
so the log showed the first reply only (B640).

The lead ruled on 2026-10-15:
a reply that names exactly one shown label in another form
(case,
a bare number,
`Occurrence n`,
`Candidate n`,
surrounding white space)
counts as that label,
stored in its canonical form,
for the choice,
the keep labels and the quote labels;
an ambiguous or unknown name is still refused;
the sheets name the exact labels the reply may use,
and the response format lists them as an `enum`;
the re-ask's own failure is logged beside the first.

Fixed by n171.
`src/consistency-label-form.ts` (new) reads a name against the shown labels:
case,
white space around and inside the name,
and a bare number all count,
whether the name is the label or only the number the label ends in;
a name that stands for none of the shown labels,
or for two,
is refused,
and so is the word of another sheet
(a choice among candidates is shown places too,
so `Occurrence 2` there would name a place and not a candidate).
The label a reply is stored under is the shown one,
in the sheet's own form.
`src/consistency-label-sentence.ts` (new) writes the sentence
that names the exact labels in each sheet that asks for one
(`src/consistency-sheet.ts`,
`src/consistency-carry-choice-sheet.ts`),
and the reply formats list the labels as an `enum`
(`src/consistency-choice.ts`,
`src/consistency-wire.ts`).
The lint fixes of `0199690299` read white space and digits through the shared predicates
and no longer through regular expressions.

Test:
`src/consistency-label-forms.unit.test.ts`,
`src/consistency-label-sheets.unit.test.ts`,
`src/consistency-label-sentence.unit.test.ts`
and `src/corpus-run/pass-consistency-label-forms.unit.test.ts`,
with the refusal fixture `src/corpus-run/consistency-refusal.test-fixture.ts`
and the rendered sheets of the carry (`src/rendered-sheets-carry.test-fixture.ts`).
The tests commit `555bb74aa0` is red at its own commit by design,
and the code commit carries the fix.
The red logs of n171 are not among the sources.

Recurrence:
`mistake-prevention-inputs-defaults-and-values-read-from-text.md`,
"Two layers reading one refusal".

## B640: the log never stated what a run-off came to, and hid the failure of a re-ask

Found on 2026-10-15 by n170 (`s241/notes-n170.md`,
Q2),
and misread by the lead's first read of the run (M226).

Outcome written on 2026-10-18.
Red `555bb74aa0`,
fixed in `29d6064708`;
the fix is the round n171.

What the run showed:
the first ask of group 1 tied at 1,
1 and 1 of 3 usable.
The run-off heard 2 of 4 in its first window (L 9551,
"no quorum"),
the retry asked the other two (L 9552),
and 2 of 2 were heard (L 9562);
the recovery round of L 9563 to L 9579 asked again for the two refused seats whose votes were surplus.
The artifact's `runOff` holds `Qwen` O3,
`Kimi` O3,
`minimax` O3 and `deepseek` O2,
and the winner is OCCURRENCE 3 by 3 of 4.
That matches the owner's rule of 2026-10-11 in `doc/design-commitments.md`.
The log printed the first window's "no quorum" and no line for the run-off's final result,
so a reader of the log alone drew the wrong conclusion,
as the lead's read did.

Fixed by n171.
`runOffResultLine` in `src/corpus-run/pass-consistency-run-off-line.ts` (new)
writes one line after the run-off's final count:
how many of the choices heard were usable,
the quorum they were held to,
and the winner or the reason for none
(`the run-off counted 4 usable of 4 heard (quorum 2): OCCURRENCE 3 won`).
The voice-lost line now names the failures of both answers when a re-ask fails too,
not only the first's (`src/nudged-reask.ts`).

Test:
the tests commit `555bb74aa0` names
"one log line for a run-off's result and the re-ask's own failure logged beside the first".
No further list of the cases is among the sources.

Recurrence:
`mistake-prevention-messages-labels-and-counts.md`,
"Log lines that report nothing done".

## B641: a carry choice with no strict majority was not run off

Found on 2026-10-15 by n170 (`s241/notes-n170.md`,
Q2).

Outcome written on 2026-10-18.
Red `555bb74aa0`,
fixed in `29d6064708`;
the fix is the round n171.

What the run showed:
the fourth place of group 1,
the carry choice for OCCURRENCE 4,
was asked at L 9662 and heard 3 of 4 at L 9678:
`glm` chose CANDIDATE 3,
`deepseek` CANDIDATE 5 and `mercury` CANDIDATE 1.
`carryChoiceOf` in `src/consistency-carry.ts` found no strict majority,
and a split carry choice was not run off,
while the owner's rule of 2026-10-11 runs off a tie among contests.

The lead ruled on 2026-10-15:
a carry choice with no strict majority is run off among its tied leaders,
as the owner's rule does for contests ("run off the tied finalists"),
with the quorum,
the window and the label rules of the bench's run-off,
and a second split keeps the page as it stands.
The ruling is the lead's adoption of the owner's rule for this ask,
open to the owner's veto.

Fixed by n171.
`src/corpus-run/pass-consistency-carry-choose.ts` finds the candidates tied for first
when the choices reached the quorum and none has a strict majority (`carryRunOffFinalistsOf`),
asks them again,
counts the answers against the finalists only with the run-off's own quorum,
and records the run-off with its ballots;
a second split keeps the page as it stands,
and the pass logs how the run-off ended in words.
The artifact reader recounts a recorded carry run-off
(`src/corpus-run/artifact-two-lane-read-consistency-carry-recount.ts`,
with a unit test of the carry run-off reading).

Still owed:
the brief asked for the adoption to be recorded in `doc/design-commitments.md`,
open to the owner's veto,
and that file holds no record of it in the tree this entry was written from.

Recurrence:
`mistake-prevention-sheets-quorums-and-outcome-rules.md`,
"Which seats a quorum counts".

## B642: a chosen place whose judges quoted nested spans was located by none

Found on 2026-10-15 by n170 (`s241/notes-n170.md`,
Q3).

Outcome written on 2026-10-18.
Red `555bb74aa0`,
fixed in `29d6064708`;
the fix is the round n171.

What the run showed:
group 2 of `TianqiChen66625` chose OCCURRENCE 1 by 2 of 3
(`Kimi` O1,
`minimax` O1 with a keep of O2,
`mercury` O2).
The three judges quoted three different spans of the English of OCCURRENCE 1:
`Kimi` from "She wanted",
`minimax` from "stay beside",
and `mercury` from "wanted to stay".
`majorityText` in `src/consistency-majority.ts` needs one identical folded text from a strict majority,
`agreedWordsOf` found none,
`locatedRendering` gave `unlocated: no-agreement` in `src/consistency-count.ts`,
and `winnerOf` gave `none: chosen-unlocated`.
The group was lost.
The span of `Kimi` also lacks the page's "also" and stands nowhere on the page.
`TianqiChen66624` carried the same group because its three ballots quoted the same span.

The lead ruled on 2026-10-15:
a chosen place is located by the longest of its quotes that stands once in its English
and that a strict majority of the quotes naming that place contain;
the risk,
that a shorter span may leave words a judge meant to carry,
is recorded.

Fixed by n171.
`src/consistency-span-agreement.ts` (new):
a candidate span is one of the place's quotes,
read in the fold,
that a strict majority of the usable ballots' quotes of that place contain,
itself included,
at the edges of words;
a ballot that gave no quote of the place counts against every candidate.
The place is located by the longest candidate that stands exactly once in its English,
and a candidate that stands nowhere or more than once is passed over for the next longest.
Two candidates of one length are told apart by their code points,
so the same ballots always give the same span.
The risk is in the TSDoc of the file:
the span located is the longest one a majority can stand behind,
so it can be shorter than the words a judge meant to carry,
and the header states that the first place of group 2 is located from "wanted",
leaving out the "She also" that a judge's quote began with.
The owner may veto the rule.

Test:
`src/consistency-span-agreement.unit.test.ts`.
The reader of the located span in a recorded artifact
(`src/corpus-run/artifact-two-lane-read-consistency-span.ts`) is changed in the same commit.
The defects found in the first version are B644 and B645.

Recurrence:
`mistake-prevention-text-comparison-and-structure.md`,
"Quotes a judge gives back".

## B643: the abandonment line counted the wire and called it delivered characters

Found on 2026-10-15 by n170 (`s241/notes-n170.md`,
Q4),
and misread by the lead's first read of the run (M226).

Outcome written on 2026-10-18.
Red `555bb74aa0`,
fixed in `29d6064708`;
the fix is the round n171.

What the run showed:
three streams of `Qwen` were cut at the straggler deadline (L 9497,
L 9661 and L 9680) with no answer and 49,293,
36,301 and 37,784 characters of reasoning.
The line said they had "delivered" 1,308,758 characters and so on.
That figure is the length of the raw stream,
framing included (`partialText.length` in `src/abandon-kind.ts` and `src/stream-drain.ts`),
about 27 times the reasoning.
The provider route sends a `max_tokens` of 20,894 (`src/synthetic-client.ts` and the model card),
and a completed `Qwen` call hit it (L 9498 and L 9499).
The runaway watch bounds the volume of the answer only (`src/stream-runaway-watch.ts`
records why a reasoning bound was refused),
and no answer arrived,
so nothing fired.
No tail sample exists,
since a cut stream is not stored.

The lead ruled on 2026-10-15:
the line reports the characters of the answer and of the reasoning,
and no reasoning bound is added,
since one was measured and refused.

Fixed by n171.
`describeAbandon` in `src/abandon-kind.ts` reads the characters of the answer and of the reasoning
that the stream counted,
carried on the cut error as `generatedChars`
(the commit changes `src/stream-cut.ts`,
`src/stream-drain.ts`,
`src/chat-contract.ts` and `src/stage-call.ts` beside it),
and prints `cut-mid-reply after N answer chars and M reasoning chars (K chars on the wire), first byte at Tms`.
Where the stream counted none,
it prints the wire length alone under its own name.
The comment in the code gives the run's figures as the reason.

Test:
the tests commit `555bb74aa0` names "answer and reasoning characters on the abandonment line".
No further list of the cases is among the sources.

Recurrence:
`mistake-prevention-messages-labels-and-counts.md`,
"Counts in printed text".

## B644: a blank quote hung the consistency pass

Found on 2026-10-18 by the author of the lint fixes that followed the landing,
in the span agreement of B642.

Outcome written on 2026-10-18.
Red `71b0057920`,
fixed in `0199690299`.

What a reader of a run would have seen:
a pass that did not end.
`containsWords` in `src/consistency-span-agreement.ts` asks whether the words of one quote stand in another.
The search for an empty text finds it at every offset and again at the end,
so the loop that steps one offset past each find never stops once the outer quote ends in a letter.
A reply whose quote folds to nothing passes intake,
so any judge could stall a run.

Fixed in `0199690299`:
an empty text is contained only in another empty one.

Test:
a case in `src/consistency-span-agreement.unit.test.ts` reads the candidates in a worker
that the shared hang stop ends:
at the red commit both readings report "hung" after the stop.

Recurrence:
`mistake-prevention-text-comparison-and-structure.md`,
"Text that shows nothing".

## B645: the word edges of the span agreement did not read a combining mark

Found on 2026-10-18 by the author of the lint fixes that followed the landing,
in the span agreement of B642.

Outcome written on 2026-10-18.
Red `71b0057920`,
fixed in `0199690299`.

What a reader of a run would have seen:
the edges of a word were read by the category of the letter or number beside them and read no combining mark.
The words "cafe" therefore counted as contained in "cafe" written with a decomposed accent,
which the fold leaves as it is,
and the located span cut a word in two.
The locator reads a mark as part of the word (`src/consistency-shown-edge.ts`),
and the span agreement did not.

Fixed in `0199690299`:
a word runs on through a combining mark,
using the locator's predicate,
so a decomposed accent after a match makes it part of a longer word.

Test:
a case in `src/consistency-span-agreement.unit.test.ts`.
The commit pins in a third case,
which passes,
the order of candidates by code points and not by UTF-16 units,
since the fix replaces the string spreads that the linter refuses.
Two of the three new cases fail at the red commit.

Recurrence:
`mistake-prevention-text-comparison-and-structure.md`,
"Words inside words".
