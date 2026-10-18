# Preventing mistakes: sheets, quorums and outcome rules

Rules for what each model is shown,
which seats a quorum counts,
and how a stage reaches and records its outcome.

Part of [Preventing this package's mistakes](mistake-prevention.md),
which lists every file of this record.

## Which seats a quorum counts

What happened:
the short-bench rule moved every gather's quorum onto the seats a wet provider serves,
and the archive block review's outage test moved with it,
but the same function's second threshold,
the anchored voices a review needs,
stayed at the whole bench's quorum (ledger B27).
A short bench whose every reachable seat anchored its quote was left unresolved
and skipped its naturalness read.
Two sentences kept saying a short bench cannot settle,
which the rule had made false.
And two short-bench cases refused two seats of four,
which leaves a quorum,
since the quorum is half the bench rounded up;
each failed at its own premise before reaching the stage (M86).
And B80's first case expected one refusal from every roster seat,
where the gather asks a window of quorum plus one,
so it would have failed with the fix in place.

A refinement recheck that heard no checker,
or one of three,
passed the rewrite,
since it rolled back only on a tally saying `worse`
and dropped the checker stage's own `stage-quorum-unmet` finding with the rest (ledger B141).
A gate that passes on nobody objecting first reads,
through the stage's own account,
that enough voices answered,
and carries that stage's findings with its verdict.

The same day the damage probe shipped a rewrite after hearing none or one of three probers (ledger B160),
and the recheck passed an issue that two of three heard checkers skipped,
counting its one ballot against no quorum (ledger B161).
A per-issue threshold on a gather's ballots takes the quorum the gather closed on,
and positive evidence is read before silence wherever a rollback carries no report.

The recheck then took that quorum by rebuilding the gather's short-bench finding
for every count of refused seats and matching its wording,
since nothing else carried the number (ledger B214).
A gather returns the quorum it closed on,
and a reader takes that field,
never a number read back out of a finding or sized a second time.

The damage sample recorded a region no prober answered for as silent,
which is the human grade's negative reference (ledger B298).
No answer is never written down as an answer:
an unheard region is printed as unheard and left off the sheet.

The rule:
when a rule changes what a quorum counts,
census every threshold derived from a gather,
not only the gather:
every `rosterQuorumSize` call,
every "half the bench",
every count compared with a bench size,
and every sentence saying what a short bench can do.
A threshold on voices a gather produced takes the `reachableQuorum` the gather closed on,
computed once and shared by every test in the function;
only a size taken before any seat is lost
(the first round's window)
or the definition of short itself counts the whole bench.
A threshold is a floor a count reaches,
so a case holds the count exactly at it,
or a boundary mutant survives.
A short-bench fixture is sized from `rosterQuorumSize` read in the code:
a bench is short only when fewer seats are reachable than half the bench rounded up.
A case counting what a gather's voices did counts the seats its scripted client was asked,
recorded as each is asked,
never the roster.

What enforces it:
`archive-block-review-stage.unit.test.ts` holds a bench with most seats refused,
asserting from the exported helpers that the case discriminates,
and a count exactly at the quorum;
the gather,
the windowed rounds,
coverage,
the select minimum and the naturalness review each hold a refused seat
(`stage-quorum.unit.test.ts`,
`stage-windowed-rounds.unit.test.ts`,
`coverage-stage-reachable.unit.test.ts`,
`candidate-select.unit.test.ts`,
`absolute-naturalness-review-stage.unit.test.ts`).
`stage-quorum.unit.test.ts` also holds the quorum the gather returns,
on a bench every seat of which answers and on the same bench with most seats refused,
and `repair-edit-stages.unit.test.ts` the same number as the checker stage hands it on.

## Sheets every model reads

What happened:
the rendered-sheets fixture said it rendered every model-facing sheet and held fifteen,
so the Canadian spelling guard never read the picture readers' "summarise" (X17).

The rule:
a new sheet is rendered by the rendered-sheets fixtures in the commit that adds it,
and sheet text is built by a named function or constant,
never inline where it is sent.

What enforces it:
`rendered-sheets-census.unit.test.ts` fails when a `build…Messages` function goes unrendered;
sheets built without that naming need their own entry by hand.

## What each sheet is shown

What happened:
two sheets listed the apparatus kinds without the bound that says what apparatus never is;
the archive block review and its slate,
coverage,
the page-title lexicon and the refine slates carried house rules that point to a DECLARED NAMES block,
and never got one,
though each caller held the names (ledger B28).
The lexicon ran before preparation,
which built the identity lines inline where nothing else could read them.
The refiner was told a handle survives exactly,
and the judges choosing among its rewrites were not.
The fixture rendered 13 of its 38 sheets naming the block without it,
so no guard reading the rendered sheets could tell a sheet that lacks the block from one the fixture left bare,
and the fence each new block needed and the follow-up coverage sheet went untested until a mutation batch.
The rendering audit,
which reads settled renderings after a run,
was shown the declared names and never the cited references the critics and panels had read (ledger B29),
and the rule it needed could not be the critics' copy:
that one names a TRANSLATION the audit never shows and a category its wire rejects.

The relabel probe's arm that claims no issue list is known sent the production disclosure with an empty list,
which under a rendered disclosure writes a list's heading into the prompt (ledger B283).
An arm that claims a thing is absent sends the form production sends when it is absent.

The rule:
a sheet whose rules name a block carries that block wherever its caller holds it.
Adding a block to a sheet threads it from where production holds it
(`pass-prepare.ts`,
`pass-insertion-admission.ts`,
the stage)
in the same change,
and a case drives the caller and reads the model call.
What a writer is shown,
the judges of its text are shown,
and so is any instrument that audits the text afterwards:
the names,
the references and the bounds.
A rule shown with a block names the texts and the categories of the sheet it sits on.
A block a sheet encloses goes into the texts its fence is chosen against,
and every branch of a sheet
(a first ask,
a follow-up)
carries the same blocks.
Context read by more than one sheet is assembled once and read by each
(`page-identity-lines.ts`,
`declared-names-evidence.ts`,
`translate-slate-evidence.ts`),
never rebuilt inline beside a caller.
The rendered-sheets fixtures give each sheet what production passes it,
through the functions production calls where there are any.

What enforces it:
`rendered-sheets-context.unit.test.ts` fails on a rendered sheet that names the DECLARED NAMES block or CITED REFERENCES without carrying the fixture's,
unless it is exempt by name with its reason,
and on an exemption gone stale;
the caller cases
(`pass-prepare-archive-review-context`,
`pass-insertion-admission-identity`,
`pass-prepare-lexicon-context`,
`refine-identity-threading`)
fail when a caller stops threading the names;
`sheet-fence.test-fixture.ts` lets a case read the fence a sheet opened a block with.
A sheet whose rules name no block,
and a caller whose fixture passes a block production does not,
are outside what these can see.

## A rule a sheet states about tense and what it does not cover

What happened:
the house rule on tense listed what the person said among the life told in the past,
and named no exception for words quoted as she wrote them.
The last message of `TianqiChen666`,
written in her own present,
shipped in the past in two passes,
and the read of the first pass said the tense held,
because it read the narration only (ledger B627,
M220).

The rule:
a sheet rule that moves text into another form names what it does not cover.
For tense,
words quoted as someone wrote or said them keep the speaker's tense,
and keeping their present is never a tense inconsistency.
Every sheet that states the tense rule carries that exception:
the full rule where the house policy is shown (`QUOTED_WORDS_RULE`),
and the one-sentence reminder beside every instruction to move a line of the life to the past,
in the house block's words or in the sheet's own (`QUOTED_WORDS_REMINDER`).
Both are built by named constants in `english-usage-policy.ts`,
never inline where they are sent.
A new sheet with a tense instruction carries the reminder in the commit that adds it.
A sheet that carries no tense rule gets none,
as the pairing sheets,
the reference attestation,
the picture readings and the derivability sheets do;
a tense rule added to one carries the exception.

What enforces it:
`sheet-quoted-tense.unit.test.ts` renders every sheet of the rendered-sheets fixture and fails on
a sheet that carries the house rule without the rule sentences,
an instruction to move a line of the life to the past with neither the reminder nor the rule beside it,
a polish gate text without the reminder twice,
and the list of house corrections of form without "(never for quoted words)".
Each marker must be found in at least one sheet,
so the checks are not vacuous.
A tense instruction written in words that no marker of the test holds is outside what it can see,
and its marker is added to the test by hand.

## Exits an outcome rule reaches

What happened:
the owner's rule to keep wording that cannot ship and ship the slice reached the judge's decline exit,
and not its empty-slate exit beside it,
so a slice whose archive wording the floor refused and whose translators proposed nothing usable stopped the entry (ledger B39).

The rule:
a rule that changes what an outcome does (ship,
stop,
keep) lists every exit that produces that outcome:
each throw of the error class that carries it and each caller that rethrows it,
and states for each whether the rule applies and why.
Each exit it applies to has a case.

What enforces it:
habit and review;
an exit the rule missed can show in the coverage census as a rethrow no test reaches,
as this one did.

## Refusals inside a composed operation

What happened:
the footnote relabel renames the archive's labels and then moves its definitions into the original's order.
The move threw when the moved definitions would parse differently,
and the pass reads every rewrite refusal as keeping the archive unchanged,
so a sound rename was kept back with it,
under a message blaming the rename;
the move's other refusals (prose among the definitions,
a container across them) leave the definitions standing with a note and the rename applied.
A bounded probe over generated pages reached the throw 156 times in 2,000 (T8's eighteenth batch).
A fix for a span checked against the first of two nodes sharing an id made the anchor validator throw,
where every other defect it finds comes back as a rejection,
and a caller's gate turns any rejection into a named refusal of the claim;
the throw bypassed both,
and the whole suite on `9ff566830` went red on a caller's case (ledger B129).

The refine stage read its resolver's operations and not the findings returned beside them,
so a rewrite naming a paragraph the sheet never showed left no trace (ledger B142);
and an OCR reader that exited cleanly and wrote no transcript made the reading reject with `ENOENT`,
which the reading pair does not contain (ledger B148).
A caller of a function that returns operations beside findings reads both,
or says why it drops the findings.

A rewrite the atom gate refused reached an info line alone,
so the stage read as a refiner that proposed nothing (ledger B162).
A refusal is a finding on the stage that refused,
worded without the values it compared.

A refusal added to the walk builder,
for a pairing naming a block its section lacks,
came out of the artifact rebuild as a throw,
where the rebuild answers every other carve that departs from the run's as `moved`.
A republish then said only the class name,
and two instruments that walk every settled artifact would have stopped on one (ledger B170).
A refusal added inside a step is followed to every caller of the operation the step sits in,
and where that operation already answers a misfit as data,
the new refusal becomes that answer.

A reading pair's contract said every reader failure but an abort is contained,
and its deterministic reader was awaited with no catch,
so a full scratch device ended the entry (ledger B184).
The slice census converted a recorded pairing itself
and stopped on the refusal the rebuild answers as `moved` (ledger B196).
A contract that says a failure is contained is read against every await inside it,
and an instrument that walks every artifact answers a misfit as the operation it mirrors does.

The refine stage applied each rewriter's operations and read only what the patch applied,
so a rewrite the patch refused as unchanged left no finding (ledger B216),
the third time this stage read one part of a result and not the part beside it (ledger B142,
B162).
And the grouping returned its runs without a translation block no run could take,
saying nothing,
so the page was refused a layer up as a block that reached no slice (ledger B219).
A caller of a function that returns what it applied beside what it refused reads both,
or throws on the refusals its construction rules out;
and a step that cannot place something refuses it there,
by name.

A refusal added so that a dropped translation block would be loud left its whole page refused,
where the archive's own bytes could be kept:
the block is carried as unplaced and named in a finding,
and the refusal class is gone (ledger B247).
A block still held at a seal crossed it and was refused as a layout fault;
it becomes unplaced at the seal (ledger B248).
A step that cannot place a part keeps the part as it stands where that is sound,
and refuses the whole only where nothing can be kept.
One voice's reply nested thousands of markers deep exhausted the parser's stack inside the translate stage,
and the engine's own error left the stage and took every other voice's candidate with it (ledger B301).
Text one voice wrote is bounded before a parser that descends once per level reads it,
and every reader of that parser has its refusal.
The bench draw reports the original page's failure ahead of the English page's,
and no case mixed a read failure with a parse failure until review asked for one (ledger B353);
its pair step's skip line stays without a case,
since a bounded probe over 6,000 generated pairs reached it in none of the 5,773 that passed the step.
A precedence between a step's refusals has a case for each mix of them.

The rule:
a step that can refuse on input a page can carry refuses as its sibling refusals do,
leaving the steps that held applied,
and a throw stays only for a broken invariant.
A module whose contract returns its refusals as data
refuses a new case as data too,
under a kind of its own;
a fix that turns such a refusal into a throw changes the contract,
and runs the whole suite,
every caller's cases with it,
before it is committed.
Before a step's throw is kept as unreachable,
a bounded probe over generated input counts what reaches it,
beside a count of what passed the step,
so a null is read from a probe that exercised the path.

What enforces it:
the reorder and pass relabel cases on the unmovable definition;
habit and review for the probe,
whose counts the batch's ledger record states.

## Checks on one part of a composed text

What happened:
the archive block review read each revision's footnotes against the archive as it came,
while the pass splices every revision it accepts into one page,
so two blocks each dropping one marker of a note passed alone
and together shipped the note with nothing referencing it (ledger B80).
The check's own comment called a footnote a relation between blocks,
and the check still read one block's change at a time.
The attestation looked for a quote in a whole reference line,
the package's own head and failure notes included,
so a quote of a page's address verified as if the page had said it (ledger B104).

The rule:
a check guarding a relation between parts of a text
(a marker and its note,
a label and what it names,
a link and its anchor)
reads each part's change in the text the changes already accepted leave,
never in the input the composition started from,
and the composition applies its changes in an order that keeps every later part's place.
Its case pairs two changes each harmless alone and harmful together,
and asserts both premises before the composed refusal.
A check that looks for a source's words in text the package composed
reads only the part that carries those words
(`referenceLinePageText` for a reference line),
never the heads,
addresses or notes the package wrote around them,
and every reader of that composition goes through the same cut.

What enforces it:
`corpus-run/archive-block-repair.unit.test.ts` holds the two-marker case,
and `reference-attest-verdict.unit.test.ts` the address and failure-note quotes;
habit and review elsewhere,
since no scan tells a relation check from a check on one part.

## Checks that vouch for a whole block

What happened:
the archive review's apparatus check accepted a block when any line declared contributors,
or when the block opened with a label,
a picture or a comment and ended with a closed one,
so prose beside the apparatus would have passed as apparatus with it (ledger B81).
The pinned archives held no such block,
which a census showed before the check was tightened,
so the looseness had decided nothing yet.

A report printed the first 400 units of a candidate and no word that it was cut,
so a reader took the opening for the whole (ledger B279).
An excerpt shown as evidence says that it is one,
and how much of the whole it shows.
A corpus read's failure text was cut at its cap and the kind and remedy appended with no mark,
so a cut path read as whole (ledger B373):
a cut followed by more text ends in a mark inside its cap.

The rule:
a check that vouches for a whole block's kind
reads every part a reader sees,
never one part,
the block's first characters
or its edges.
It reads the block as the page shows it:
comments blanked and a comment left open refused,
invisible lines skipped by `rendersAsNothing`,
and markup read by the parser rather than by a leading character.
Its case pairs each accepted shape with the same shape beside prose,
and a census over the pinned archives counts what it accepts before and after a change,
by block id.

What enforces it:
the stage test's apparatus case holds each shape beside prose and alone;
habit and review elsewhere.

## Records of more than one round

What happened:
the judges' retry kept the findings of every ask it made,
and the translate stage's follow-up round one level up returned its own record alone,
so a slice settled at depth two could not say its first slate was declined (ledger B41).

The rule:
code that runs a stage again and returns one result carries every earlier round's findings into it,
earliest first,
with a finding naming each new round and why it was asked,
on the returning path and the raising path alike.
Its test compares the whole record around that finding.

What enforces it:
habit and review;
the stage case and the B39 case fail if the depth-two layer drops a round again.

## Work no floor can check

What happened:
where the floor could compare nothing
(an original no grammar reads),
the translate stage still bought translators and judges,
kept the archive off the slate on the floor's `unknown`,
and let a candidate stand on the same `unknown`,
so an admitted insertion wrote a rendering nobody could check into the page,
and on a slice the archive translates every call bought nothing
(ledger B43).
The consolidation asked its writers there too,
and the floor refused all they wrote
(ledger B45).

Commands bought work before a check they could have made for nothing:
the verify probe asked the whole roster and then refused a sheet already taken (ledger B282);
the width probe bought its control for a draw holding no slice (ledger B299);
a calibration drew the corpus for a roster of one seat (ledger B305);
and a setup check printed that the plan was in order over a corpus yielding no entry (ledger B306).
The settled rendering audit named its runs directory only after buying every subject,
so a directory it could not name cost the whole roster's calls (ledger B312).
State known at the start is checked before anything is drawn,
gathered or bought.

The rule:
a stage that buys work a deterministic check must pass asks first whether the check can pass anything on that input,
through the definition the check itself reads
(`floorReach`,
`translate-floor-ground.ts`),
and settles without buying where it cannot:
on the archive where there is one,
unfilled where there is none.
Past that question,
a verdict the caller has ruled out is read through a narrowing that raises
(`requireComparedVerdict`),
never through a branch that keeps a candidate on it.

What enforces it:
habit and review;
`translate-stage.unit.test.ts`,
`translate-document.unit.test.ts` and `consolidate-driver.unit.test.ts` count the calls on a blind slice,
and `translate-floor-ground.unit.test.ts` pins the reach and the floor to one reading.
