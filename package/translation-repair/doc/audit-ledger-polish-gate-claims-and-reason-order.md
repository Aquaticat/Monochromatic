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

Note of 2026-10-22 (UTC):
the key names in this entry are the names of the day.
B762 renamed several of them in the reply,
and its entry lists the current names.

Consequence found in the same change:
five cases of `archive-composite-revision.unit.test.ts` failed on the new sheet text,
and are recorded as B734.

## B762: sixteen answer schemas declare their properties in an order Hyper does not keep

Status:
fixed on 2026-10-22 (UTC),
guard written red on 2026-10-21 (UTC) `d5562122314a`,
fix `a40de882b5`.

Found while the order of reason and vote (B732) was being checked against the replies of the two logs.
Charm Hyper returns the keys of a tool call in alphabetical order:
200 of 227 multi-key objects in zheermao22,
and 102 of 103 vote replies in CuspariaKLSY22
(a reply whose keys were already in alphabetical order cannot show it).
NeuralWatt,
OpenRouter and Synthetic follow the declared order.
So on Hyper the ruling of 2026-10-21,
"Reason first everywhere",
holds only where `reason` sorts before the choice,
and in most ballots it does not.

Does the repo sort:
no.
`canonicalPromptValue` digests the messages for the uniqueness check and never reaches a request body,
`buildAnthropicBody` and `renderToolSystemPrompt` place the schema as declared,
and no other path reorders a schema or a reply.
Whether Hyper sorts the schema it sends the model or the reply the model wrote is not known from the stored replies,
and no probe of it was made.
The only order that holds on every provider is one where declared order and alphabetical order agree.

The guard:
`source-scan/src/schema-property-order.unit.test.ts` reads every object literal that is the value of a `properties` key
in non-test source,
and names the file,
the line,
the declared order and the alphabetical order.
Its fixture case passes first and shows each form:
bare and quoted keys,
a sorted member,
a one-key member,
a spread,
a computed key,
an object that merely holds keys and a test file.
The package-wide case was red with sixteen findings and is green now.
The task `source-scan:source-scans` lists the file.

The sixteen schemas,
as they were declared and the order they have now:
- `adjudication/adjudicate-wire.ts:234`:
  `verdicts`,
  `groups` must read `groups`,
  `verdicts`.
- `adjudication/adjudicate-wire.ts:247`:
  `claim`,
  `reason`,
  `vote`,
  `severity` must read `claim`,
  `reason`,
  `severity`,
  `vote`.
- `adjudication/candidate-select-wire.ts:362`:
  `reason`,
  `best`.
- `adjudication/critic-wire.ts:158`:
  `summary` before `sourceQuote`.
- `adjudication/introduced-defect-wire.ts:741`:
  `region`,
  `verdict`,
  `category`,
  `severity`,
  `evidence`,
  `omittedText`,
  `reason`.
- `archive/absolute-naturalness-review-wire.ts:120`:
  `reason`,
  `findings`,
  `acceptable`.
- `archive/archive-block-review-wire.ts:314`:
  `finding`,
  `disposition`,
  `sourceQuote`,
  `replacementText`.
- `archive/coverage-wire.ts:406`:
  `reason`,
  `quote`,
  `coverage`.
- `artifact/page-title-lexicon-wire.ts:286`:
  `title`,
  `rendering`.
- `consistency/consistency-choice.ts:80`:
  `reason`,
  `choice`.
- `consistency/consistency-wire.ts:387`:
  `reason`,
  `quotes`,
  `choice`,
  `keep`.
- `lane-contest/contest-ballot-wire.ts:138`:
  `reason`,
  `unsupported`,
  `dropped`,
  `choice`.
- `rendering-audit/rendering-audit-wire.ts:341`:
  `verdict`,
  `findings`.
- `repair/edit-wire.ts:124`:
  `region`,
  `newText`.
- `repair/refine-wire.ts:130`:
  `paragraph`,
  `newText`.
- `translate-floor/translate-repair-wire.ts:220`:
  `resolution`,
  `translation`,
  `explanation`.

What changed:
the declared order of each of the sixteen is now its alphabetical order,
and the reply instruction of each sheet that lists the keys lists them in that order.
Every reader destructures by property name,
so a reordered reply changed nothing in a reader.

Reordered only,
nothing renamed,
because no ruling fixes their order:
- the panel verdict (`adjudication/src/adjudicate-wire.ts`):
  `groups` then `verdicts`,
  and each verdict reads `claim`,
  `reason`,
  `severity`,
  `vote`.
- the critic (`adjudication/src/critic-wire.ts`):
  `sourceQuote` before `summary`.
- the page title lexicon (`artifact/src/page-title-lexicon-wire.ts`):
  `rendering` then `title`.
- the rendering audit (`rendering-audit/src/rendering-audit-wire.ts`):
  `findings` then `verdict`,
  and the six fields of a finding in alphabetical order
  (`candidateFocus`,
  `candidateLocator`,
  `category`,
  `reason`,
  `sourceFocus`,
  `sourceLocator`).
  The scan cannot read the finding schema,
  which is built from a list,
  so `rendering-audit-wire.unit.test.ts` pins it.
- the editor's rewrite (`repair/src/edit-wire.ts`):
  `newText` then `region`.
- the refinement rewrite (`repair/src/refine-wire.ts`):
  `newText` then `paragraph`.

Renamed,
because a ruling fixes the order and the old name sorted elsewhere
(old name to new name,
and why):
- the select ballot (`adjudication/src/candidate-select-wire.ts`):
  `reason` to `assessment`.
  `reason` sorts after `best`,
  `assessment` before it.
- the absolute naturalness review (`archive/src/absolute-naturalness-review-wire.ts`):
  `reason` to `assessment`,
  and `acceptable` to `isAcceptable`.
  `acceptable` sorts before `assessment`,
  so the choice is named as the question it answers and now sorts after `findings`.
- the archive block review (`archive/src/archive-block-review-wire.ts`):
  `finding` to `assessment`,
  with `replacementText` before `sourceQuote`.
  `finding` was its reason and sorts after `disposition`.
- the coverage judge (`archive/src/coverage-wire.ts`):
  `reason` to `assessment`,
  and `quote` to `copiedSpan`.
  `quote` sorts before `reason`,
  and `copiedSpan` is the span copied from the translation,
  which sorts between the reason and `coverage`.
- the choice-only consistency ballot (`consistency/src/consistency-choice.ts`):
  `reason` to `assessment`.
- the consistency ballot (`consistency/src/consistency-wire.ts`):
  `reason` to `assessment`,
  and `quotes` to `candidateQuotes`.
  `quotes` sorts after `choice`,
  and the quotes are the analysis the choice rests on.
- the contest ballot (`lane-contest/src/contest-ballot-wire.ts`):
  `reason` to `assessment`,
  `choice` to `verdict`,
  and `archive` to `verdictOnArchive`,
  with `dropped` before `unsupported`.
  `choice` sorts before the two lists and `archive` before the reason;
  `verdictOnArchive` sorts after `verdict`,
  so the archive answer stays behind the lane answer.
  The schema spreads the archive member in,
  which the scan skips,
  so `contest-ballot-wire.unit.test.ts` pins its place.
- the introduced-defect wire (`adjudication/src/introduced-defect-wire.ts`):
  `reason` to `verdictReason`,
  and the rest in alphabetical order
  (`category`,
  `evidence`,
  `omittedText`,
  `region`,
  `severity`,
  `verdict`).
  The ruling of B732 keeps this reason last,
  and `verdictReason` sorts after `verdict`.
- the rewrite wire (`translate-floor/src/translate-repair-wire.ts`):
  `explanation` to `translatorNote`.
  The ruling of B732 keeps the explanation after the translation,
  and `translatorNote` sorts after `translation`,
  where `explanation` sorted before `resolution`.

Names chosen,
and why:
- `assessment` is the reason wherever a ballot gives its reason first.
  It sorts before every other key of those ballots,
  and one name serves the select ballot,
  the naturalness review,
  the archive block review,
  the coverage judge,
  both consistency ballots and the contest ballot.
  The panel verdict keeps `reason`,
  which already sorts where the ruling wants it,
  because a stored record spells it.
- `verdict` is the vote of the contest ballot and `verdictOnArchive` its archive answer.
  `verdictReason` is the reason that comes last in the introduced-defect wire.
  The three share a stem,
  so a reader sees which answer a key belongs to.
- `isAcceptable` is a yes or no and reads as the question.
  `candidateQuotes` and `copiedSpan` say whose words the field holds.
  `translatorNote` says who writes the explanation and where it goes.

Where the names live:
only the reply is renamed.
The wire types,
their guards,
the response formats,
the reply instructions and the one function per reply that maps it to the internal shape carry the new names.
The internal shapes,
the cache files,
the stored ballots,
the artifacts and the ledgers keep the old spelling,
so a record written before reads as it did and no reading under two spellings (as B107 did) is needed.
The mapping functions are
`readConsistencyBallotWire` and `readConsistencyChoiceWire` (`consistency`),
the readers in `lane-contest-wire.ts`,
`consolidate-gate-wire.ts` and `consolidation-polish-gate-wire.ts`,
the introduced-defect screen,
`candidate-select-count.ts`,
`coverage-verdict.ts`,
`archive-block-selection-evidence.ts`,
the naturalness review stage and `translate-repair.ts`.
A reader of a log meets both spellings:
the reply text says `assessment` where the stored ballot says `reason`.

Tests:
`reason-before-vote.unit.test.ts` in `lane-contest`,
`consolidate`,
`adjudication` and `archive` still pass over `reason-order.test-fixture.ts`:
each asks that the schema declares and requires the reason first and that the rendered instruction names it first.
The scripted replies of the consistency,
contest,
select,
coverage,
introduced-defect and rewrite tests,
and the fixtures of `provider`,
`repair` and `run`,
spell the new reply keys.
Two pins are hand-written because the scan cannot read the schema:
the finding schema of the rendering audit and the archive member of the contest ballot.
`source-scan:source-scans` is green with no allow-list.

Cache account:
the key of each version below hashes the version,
the shape of the run and the texts,
not the sheet,
so a record written under the old reply instruction would be served under the new
and the number moves wherever a sheet carries a renamed or reordered schema
(as B732 did).
- `CONSOLIDATE_CACHE_VERSION` 29 to 30:
  the contest ballot of both gates,
  the naturalness review,
  the coverage judge,
  the select ballot and the introduced-defect check over a polish.
- `LANE_CONTEST_CACHE_VERSION` 14 to 15:
  the contest ballot.
- `TRANSLATE_SLICE_CACHE_VERSION` 23 to 24:
  the rewrite wire,
  the select ballot and the coverage judge.
- `SLICE_CACHE_VERSION` 41 to 42:
  the panel verdict,
  the critic,
  the introduced-defect check,
  the select ballot,
  the coverage judge and the editor's rewrite.
- `REFINE_CACHE_VERSION` 12 to 13:
  the refinement rewrite,
  the select ballot and the introduced-defect check.
- `PAGE_TITLE_CACHE_VERSION` 4 to 5:
  the page title lexicon reply.
Stay:
`CONSISTENCY_CACHE_VERSION` 6,
because only the reply is renamed,
what a stored answer must contain is what it was,
and its key digests the exact sheet,
whose reply instruction changed;
`PAIRING_CACHE_VERSION` 3,
since no pairing sheet carries a schema of this change.
The rendering audit has no version:
the only callers of `runRenderingAudit` are the probe runners
`probe/src/corpus-run/audit-sensitivity-run.ts` and `rendering-audit-settled-buy.ts`.
Evidence:
`cache-account-audit` read eight versions,
and `git log` shows the five slice versions and the consolidate version last set in `4b9fc9e645` on 2026-10-21 (UTC),
the page title version in `28f4b8fc75`.
It found 0 slice-cache records under this worktree's runs directory,
and no control that finds records was run,
so that absence shows nothing.
The pass that writes records runs in another worktree that this change did not read,
so whether a record stands at the old numbers is not known and none of the changes rides inside an old number.
No record has been written at any new number.

Known limits:
- Whether Hyper sorts the schema it sends the model or the reply the model wrote was not probed.
  The decision here is that declared order equals alphabetical order,
  which holds on both readings.
- The scan reads literal `properties` objects in non-test source.
  A schema built by spread or `Object.fromEntries` needs a pin of its own.
- The reason of the rewrite wire and the introduced-defect wire stays after the content it explains,
  by the rulings of B732,
  so a reply cut short by the completion cap still loses it first.
- A key named for its sort position is a cost to the reader of a log,
  who now meets two names for one field.
- Whether a ballot written reason first moves votes is not measured.

Open to the owner's veto:
the names chosen and the decision to rename rather than probe Hyper.

The rule for next time:
a ruling about the order of keys in a reply is checked against a provider that reorders them,
and what the reply order depends on is stated beside the ruling.
A key is named for its role so that it sorts where the ruling puts it,
and a schema is declared in the order its keys sort.
Recurrence:
`mistake-prevention-sheets-quorums-and-outcome-rules.md`,
"Ballots give their reason first".
