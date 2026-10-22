# Audit ledger: the polish gate's claims and the order of reason and vote

Sheets that withheld a claim the judges needed,
and ballots whose reply shape asked for the choice before the reason.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B731: the polish gate chose a rewording over an accepted repair claim it was never shown

Status:
fixed on 2026-10-21 (UTC),
red `b09097e067`,
fix `5419332cef`,
cache versions `4b9fc9e645`,
source scans `2e5c2f82c1`.
Found in the read of `CuspariaKLSY21` and `zheermao21`
(finding 2,
class A1 narrowed).

What the code did:
the repair panel's accepted claims reach a later sheet only through `archiveDisputeNote`,
and `disputesArchive` admits an addition at any severity but another accuracy claim only at a settled severity of major or worse.
A claim accepted at minor severity therefore reached no sheet after the repair lane.
Stored evidence of `CuspariaKLSY21` slice 0 (the hunger line):
chunk 0 holds one adjudicated issue,
status `accepted`,
severity `minor`,
with two `accuracy/mistranslation` claims,
each supported 4 and unsupported 0,
and listed in `resolvedIssueIds`.
The polish gate of that slice settled polished 3 and base 1 between "could not have a good meal" (the translate wording)
and "couldn't get a proper meal",
on a sheet that carried no claim and no dispute note,
so the accepted claim that "good meal" softens the source was not before the judges.
The answer to the question the brief put,
whether the slice had an accepted repair claim the gate sheet did not show,
is yes.

The fix:
`accepted-repair-claims.ts` in `archive` reads every accepted claim of a chunk's issues at the severity the panel settled
(`acceptedRepairClaimsOf`),
leaves out the claims the slice's dispute note already carries (`acceptedRepairClaimNotesOf`),
and writes a block headed `REPAIR PANEL CLAIMS ACCEPTED`
that says the claims are claims to check against the original and not facts
(`acceptedRepairClaimsNote`).
`repairClaimEvidenceOf` returns the disputes and the notes read off the same chunks.
`ConsolidationSubject` and `ConsolidationPolishGateSubject` carry `acceptedRepairClaimsNote`,
`buildConsolidationPolishGateMessages` renders it after the dispute block and counts it in the choice of the block fence,
and the corpus pass threads it from the repair lane's chunks to the polish round.
`consolidateSliceKey` appends `repair-claims` and the note only when a slice has one,
so a slice without accepted claims keeps its key.
The red cases failed with a fence of length 0 and a sheet without the block.

Decisions taken in this session:
- No severity filter.
  The block lists every accepted claim at the severity the panel settled;
  a filter at minor would have repeated the reading that hid the claim.
- The producers and the slate do not see it.
  The producers wrote against the claims,
  and the judges' own reasons in slice 0 cite the hunger line,
  so the evidence file found no measured slate that lacked it.
  Only the polish gate,
  the one judge that chose between a producer's text and its rewording with no claim in view,
  reads it.
- A claim the dispute note already carries is not named twice.

Open to the owner's veto:
showing the producers and the slate the same block,
which changes more sheets and every cache version they feed.

Not measured:
whether the judges then decide differently.
A red case shows the evidence reaches the sheet;
it cannot show the models choose otherwise,
which needs a rerun measured against run-to-run spread.

Cache account:
`CONSOLIDATE_CACHE_VERSION` 28 to 29,
with the tie rule of B730 and the reason order of B732.
The key of a slice with accepted claims differs by itself;
a slice without them was settled by the old tie rule,
which is why the number moves.

## B732: the contest, select and review ballots asked for the choice before the reason

Status:
fixed on 2026-10-21 (UTC),
red `8202d858a6`,
fix `e5bc27f9f0`,
cache versions `4b9fc9e645`,
source scans `2e5c2f82c1`.
Owner ruling of 2026-10-21,
"Reason first everywhere",
extending the ruling of 2026-09-27,
"Reason before vote",
from the panel verdict to the other ballots and verdicts
(`design-commitments-rulings-of-2026-10-21.md`).

What the code did:
only the panel verdict and the two consistency schemas declared the reason first.
Every other ballot declared its choice first,
so a decoder held to the schema could write the vote before it had reasoned.

What changed,
in the order the reply is written:
- the contest ballot (`lane-contest/src/contest-ballot-wire.ts`):
  `reason`,
  `unsupported`,
  `dropped`,
  `choice`,
  then `archive` where the contest wants one.
  Three sheets share it:
  the lane contest (`lane-contest-wire.ts`),
  the consolidation gate (`consolidate-gate-wire.ts`)
  and the polish gate (`consolidation-polish-gate-wire.ts`).
- the select ballot (`adjudication/src/candidate-select-wire.ts`):
  `reason`,
  then `best`.
- the absolute naturalness review (`archive/src/absolute-naturalness-review-wire.ts`):
  `reason`,
  `findings`,
  then `acceptable`.
- the coverage judge (`archive/src/coverage-wire.ts`):
  `reason`,
  `quote`,
  then `coverage`.
- the archive block review (`archive/src/archive-block-review-wire.ts`):
  `finding`,
  which is its reason,
  then `disposition`,
  `sourceQuote` and `replacementText`.

Left as they were,
each for a stated reason:
- the introduced-defect wire:
  its `reason` is empty on a verdict that finds no defect,
  which a reason-first order would contradict,
  and the probe is in shadow mode.
- the rewrite wire (`translate-repair-wire`):
  its `explanation` follows the translation it explains.
- the rendering audit:
  a verdict,
  then findings that carry a reason each.
- the resolution,
  restoration judge,
  derivability and reference attestation wires:
  they carry no reason of the ballot kind.
- the typed decision select (`candidate-select-decision.ts`):
  it carries no reason.
Already reason first:
the panel ballot (`adjudicate-wire`) and both consistency schemas.

Parser order:
every reader destructures by property name,
so the order of fields in a reply is read-independent;
`provider/src/schema-prompt.ts` restates the schema in the system prompt,
so the new order reaches the model there as well.
The tests that pin the order are `reason-before-vote.unit.test.ts` in `lane-contest`,
`consolidate`,
`adjudication` and `archive`,
all over `reason-order.test-fixture.ts`:
each asks that the schema declares and requires the reason first and that the rendered instruction names it first.
The red cases failed on the schema order and on the instruction text.
Four tests that matched the old instruction text through `GATE_MARKER`
and two schema pins in `repair` follow the new text.

Decisions taken in this session:
- Analysis fields keep their relative order between the reason and the choice,
  so the lists of unsupported and dropped content are written after the reason and before the vote.
  The alternative,
  lists first and then reason and vote,
  follows the claim,
  reason,
  vote order of the panel;
  both satisfy the ruling,
  and the choice was made to keep the ruling's wording literal (the reason is first).
- The archive block review's `finding` counts as its reason.

Open to the owner's veto:
the order of the analysis fields between the reason and the choice,
and the list of wires left as they were.

Risks,
not measured:
a reason first can move votes,
as the ruling of 2026-09-27 noted,
and no bench measures it;
a reply cut short by the completion cap now loses its choice and keeps its reason,
where it used to lose its reason and keep its choice.

Cache account:
the number moves for every version whose sheets carry one of these ballots.
`CONSOLIDATE_CACHE_VERSION` 29 (gate sheets,
naturalness review,
coverage sheet),
`LANE_CONTEST_CACHE_VERSION` 14,
`TRANSLATE_SLICE_CACHE_VERSION` 23 and `SLICE_CACHE_VERSION` 41 (select ballot and coverage sheet),
`REFINE_CACHE_VERSION` 12 (select ballot of the objection correction).
The consistency,
page title and pairing versions stay:
the consistency schemas were already reason first,
and the other two sheets do not carry these ballots.
The archive block review has no version of its own.

Consequence found in the same change:
five cases of `archive-composite-revision.unit.test.ts` failed on the new sheet text,
and are recorded as B734.

## B805: the polish writers were never shown the claims the polish gate judged them against

Status:
fixed on 2026-10-22 (UTC),
red `e4a796cae6660ae4c2ffc952351b83b66e90cd18`,
fix `27db2c256c512c9d2b25c7da15b0e1e8c1868760`,
cache version `CONSOLIDATE_CACHE_VERSION` 29 to 30.
Found in the read of the corpus pass for `zheermao22` (class K3) and fixed in `w263`.
It widens B731,
which gave the claims to the polish gate alone.
Widened again before landing,
with red `7e7f5c16bb959c963cad51dfae64974f57f4a3c1`
and fix `c18194a50c933cb8e019381d6c3d5c354d20da46`,
to the dispute note and to the judges of the writers' rewrites (see "The widening before landing").

What the code did:
B731 threaded `acceptedRepairClaimsNote` from the repair lane's chunks to `runConsolidationPolishRound`,
where it was handed to the polish gate and to nothing else.
The same round called `runRefineStage` with no note,
so the writers of the polish rewrote the base without the claims,
and the gate then judged their rewording against claims they had never seen.
A claim accepted at minor severity,
which `disputesArchive` does not pass on as a dispute,
thus reached the judges and not the hands that could act on it.
The repo rule is that what a writer is shown,
the judges of its text are shown;
B731 applied it in one direction.

The fix:
`buildRefineMessages` and `runRefineStage` take `acceptedRepairClaimsNote`,
and the polish round passes the one it already holds to the gate.
The note is the one `acceptedRepairClaimsNote` of the archive package writes (B731);
no second builder was written.
The sheet shows it fenced under `REPAIR PANEL CLAIMS ACCEPTED`,
as the gate's sheet does,
with a fence chosen against it as well,
and says that the accepted claims are claims and not facts,
to be checked against the ORIGINAL and corrected only where it supports one.
The baseline policy of a round that carries claims no longer says that nobody has claimed anything wrong,
and names a paragraph a supported claim shows to be wrong as a clear improvement.
The repair lane's own refinement passes no note,
and its sheet is byte for byte what it was
(`refine-prompt.unit.test.ts`,
"LEAVES THE SHEET UNCHANGED WHEN NO CLAIMS WERE ACCEPTED").
The dispute rule is untouched:
a claim still disputes the archive only at the severity `disputesArchive` admits
(the owner's "Major+ accuracy",
2026-09-27).

Red and green:
`refine-prompt.unit.test.ts` reads the sheet for a note carrying a line of the old fixed fence and an instruction,
and for a round with objections and claims together.
`consolidation-polish-apply.unit.test.ts` reads every `refine_report` sheet of a polish,
with a control slice that has none.
`consolidate-driver.unit.test.ts` reads the writers' sheets through the real driver.
`rendered-sheets-context.unit.test.ts` gained the third block,
`REPAIR PANEL CLAIMS ACCEPTED`,
and names the sheets that must carry it (`polish gate`,
`polish refiner`),
so a sheet that loses the block cannot take its only mention of the heading with it;
the fixtures render a `polish refiner` sheet and give the gate sheet the note.
`sheet-translators-notes.unit.test.ts` lists the new sheet among the writers.
Five cases failed before the fix and pass after it;
the controls (a slice with none,
an empty and an absent note) passed throughout.

Cache account:
`CONSOLIDATE_CACHE_VERSION` moves from 29 to 30.
The consolidation key already appends the note when a slice has one,
so the key does not change when the writers' question does,
and a settlement stored at 29 for a slice with claims holds a polish written without them.
Runs `zheermao22` and `XingZ6017` log `START tip=2a336603bf`,
which holds the commit that set 29 (`4b9fc9e645`),
so records may stand at 29.
No slice-cache directory was searched.
The pinned `consolidateSliceKey` literal in `consolidate-key.unit.test.ts` follows the new version;
no test names the constant.
`REFINE_CACHE_VERSION` stays at 12:
the repair lane's refine sheet is unchanged.
The lane-contest,
translate slice and repair slice versions stay,
since none of their sheets is a polish writer's.

The widening before landing:
the first version of this entry left two items open,
and the parent session closed both before the branch landed,
open to the owner's veto.
- The dispute note (`archiveDisputeNote`) reached the polish gate and not the polish writers.
  The gate is shown it (`consolidation-polish-gate-wire.ts`,
  the block `ARCHIVE RENDERING DISPUTED`),
  so the writers must see what they are judged against:
  `runRefineStage` takes `archiveDisputeNote`,
  `buildRefineMessages` shows it fenced under that heading with the instruction to treat it as quoted review data,
  and the polish round passes the one it already holds to the gate.
  Where a slice has a dispute note and no other claim,
  the baseline policy names the block headed `ARCHIVE RENDERING DISPUTED`;
  where it has both notes,
  it names both blocks.
  A note that is absent or empty builds the sheet that was built before.
  This matters beyond a claim at minor severity:
  `acceptedRepairClaimNotesOf` leaves out a claim the dispute note already names,
  so on a slice whose accepted claims the dispute note all names,
  the writers saw no note at all.
- The judges of the writers' wording,
  the rewrite judges of the refine selection,
  were not shown the accepted claims either.
  `buildRefineSelectionContext` takes both notes and carries them as evidence under the gate's headings,
  the dispute first and the claims after,
  after the declared names and the cited pages.
  The select wire prints each evidence block as its label,
  a fence chosen against everything the sheet encloses,
  the text and the fence again,
  which is the shape every other select sheet gives `ARCHIVE RENDERING DISPUTED`
  (`translate-slate-evidence.ts`).
  `runRefineStage` hands both notes to the context and to the writers' sheet from one place,
  so the writers and the judges cannot disagree about whether a slice has them.
- The judges' criteria could not have used the notes unqualified.
  The comparative question asked that a candidate "say exactly what the CURRENT text says",
  and a rewrite made to a supported claim does not.
  The polish gate's policy is not qualified in that way,
  and its notes carry their own sentence that a candidate correcting a supported claim is not departing from the original.
  The select criteria are stricter,
  so where either note is shown the first criterion allows a correction that an accepted claim the ORIGINAL supports asks for,
  the third allows a candidate that makes such a correction,
  the task says so,
  and the objection mode's criterion about what a candidate may change names a supported claim beside a supported objection.
  Without either note the wording is what it was,
  and the control cases pass throughout.
- The repair lane's own refinement passes neither note,
  so its writer sheet,
  its judges' sheets and `REFINE_CACHE_VERSION` are unchanged.
  The floor-input scan lists that omission with this reason (`floor-inputs-stated.unit.test.ts`).

Red and green of the widening:
`refine-prompt.unit.test.ts` reads the writer's sheet for a dispute note carrying a line of the old fixed fence and an instruction,
for both notes together,
and for an absent and an empty note.
`refine-selection-notes.unit.test.ts` reads the evidence of both modes,
its order,
the criteria,
and the rendered judge sheet with a fence longer than the run in the note.
`refine-stage.unit.test.ts` reads the rewriter's sheet and each of the four judges' sheets in both modes,
with a control that is asked the same and carries neither heading.
`consolidation-polish-apply.unit.test.ts` and `consolidate-driver.unit.test.ts` read the writers' and the rewrite judges' sheets through the real polish and the real driver,
with a disputed slice and an undisputed one.
`rendered-sheets-polish.test-fixture.ts` renders the `polish refine slate` and the `polish refine objection slate`
and gives the polish gate and the polish refiner the dispute note beside the claims;
`rendered-sheets-context.unit.test.ts` names the four sheets that must carry both blocks
and scans every sheet naming `ARCHIVE RENDERING DISPUTED`.
Six of the new cases failed in the repair package,
one in the consolidate package,
two through the real driver and two in the rendered-sheets scan before the fix and pass after it.
A test written in the red commit read the fence of the second block from the wrong line,
and the fix commit corrects it.

Cache account of the widening:
no further bump.
Main holds `CONSOLIDATE_CACHE_VERSION` 29 (read off `origin/main` on the day of the merge) and this branch moved it to 30,
so one bump serves the landing.
The judges' question and the writers' dispute note are one more change to what a slice with a note is asked,
and the key already carries both notes
(`repair-claims` and `dispute` in `consolidateSliceKey`),
so a settlement stored at 29 holds a polish chosen without them and 30 recomputes it.
`REFINE_CACHE_VERSION` stays at 12:
the repair lane passes neither note,
and a context built without them is equal to the one built before
(`refine-selection-notes.unit.test.ts`,
"BUILDS THE SHEET IT BUILT BEFORE WHERE NO NOTE IS GIVEN").

Not measured:
whether a rewrite made to a claim now wins more often with the judges who can read the claim.
The sheets are tested,
not the votes,
and a vote needs a keyed rerun measured against run-to-run spread.

Open to the owner's veto:
the dispute note to the writers and the judges,
the judges' qualified criteria,
and the single cache bump.
Reverting the first two is the two optional parameters of `buildRefineSelectionContext` and `buildRefineMessages`.

Recurrence:
`mistake-prevention-sheets-quorums-and-outcome-rules.md`,
"What each sheet is shown":
a block added to a judge's sheet is threaded to the writer of the text it judges in the same change,
and to every other judge of that writer's text.
