# Audit ledger, part 15

Part 15 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Repair lane, continued

### L14: smaller items

Status:
(a) to (d) fixed;
(e) closed:
seven sites a census artifact,
two faithful refrains.

#### L14(a): the resolution checker sheet carried none of the panel's evidence

Status:
fixed in `fe0fc1f13`,
guarded red first in `01a2dc31f`.
The sheet showed the ORIGINAL,
the REVISED TRANSLATION,
and each claim's category,
severity and summary.
The panel that accepted each issue also read the DECLARED NAMES block with its rules,
the cited references,
and the claim's own quotes.
Checker `worse` ballots strip an edit (L3) and roll a rewrite back (L11),
so a checker that could not see a declaration could count a declared handle kept as written as damage.
The M32 step came first:
`buildResolutionMessages` is the whole sheet
(`runCheckerStage` sends `plan.messages` unchanged),
and it took no identity or reference parameter,
so no other path could have carried either.

The fix (`resolution-sheet-evidence.ts`):
the declared names before the documents,
with `DECLARED_IDENTITY_RULES` and one checker line
(a revision moving a declared rendering away from its declared value is worse);
the cited references after the revised translation,
with a checker line that a referenced detail is never a reason for worse
and that the references never reopen an accepted issue,
since the panel judged with them and the reference screen already voided attested additions;
and each claim's quotes,
JSON-encoded,
the TRANSLATION side labelled as the text before this revision.
The encoding is measured need:
349 of 45,860 claim quotes over 266 artifacts span more than one line
(`~/temp/agent/audit-glossary-fix/l14-summary-newlines.mjs`).
Rules ride with their blocks,
as on the introduced-defect probe (H8),
so a page declaring nothing and linking nowhere reads the rules it always did.
The stage,
the repair proof and its worse-vote recheck,
and the refinement recheck all forward both contexts.

Guards:
`resolution-sheet-evidence.unit.test.ts` (the builder)
and `checker-evidence-threading.unit.test.ts` (each caller,
both directions).
Two guard defects surfaced while greening them.
The threading control's fixture had a heading,
and preparation writes the archive's rendering of a heading into the identity context,
so the control page declared a name and its checker sheet was rightly shown the block
(`ab7ad54f0`;
a `prepareDocumentPair` probe confirmed the heading-less fixture yields neither context).
The mutation check (24 mutants,
control surviving) left one survivor:
a fence chosen without the declared names,
because the fence case gave the references the longer run of equals signs,
and a fence clearing that run cleared the identity's too;
one sheet per context now carries the run alone (`b507cbf28`),
and both fence mutants are caught.
Cache:
rides inside repair 34 and refine 5,
checked on 2026-09-28:
the only slice-cache file not older than 04:26 UTC on 2026-09-27 is the consolidation entry written that minute.

Scope kept out,
as a candidate rather than bundled:
the probe's sheet also carries the neighbouring window and community renderings,
and the checker sheet carries neither;
and the audit's finding also named the text before the revision,
which the claim quotes now carry only where a claim quoted it.
The panel's measured regression from adding sheet content (`NEARBY_RULE` in `adjudicate-prompt.ts`)
says sheet additions need evidence first.

#### L14(b): editors write neighbouring text into an envelope

Status:
fixed in `49d3c285b`,
guarded red first in `8408e8864`.
The audit reported editors writing neighbouring text into a region and the chunk judges choosing it
(CuspariaKLSY11 slice 3,
shihai4h2 slice 28),
and that neither shipped.

What was measured (`~/temp/agent/audit-glossary-fix/l14b-census.mjs` and its siblings):
56 of 6,222 chunk candidates over 266 artifacts carried a sentence of 12 characters or more
more often than the slice's archive English did,
in 43 of 2,476 rounds;
the judges selected such a candidate 3 times;
and Carena0442 slice 14 on carena-rerun-20260902 (a schema 9 build) shipped two such sentences
through a repair-lane win,
so "neither shipped" does not hold for the family.
Some of the 56 are noise:
URL and link fragments the sentence splitter cut at a period,
and one blockquote line accounts for 9.
The editor sheet shows the whole TRANSLATION and the whole ORIGINAL (rendered 2026-09-28),
so a rule about text outside the region asks for nothing the editor cannot check.

What was not measured:
the class the audit described,
neighbouring ORIGINAL content re-translated into a region in new words.
A verbatim census against the adjacent slices' archive English found none,
and its positive control failed:
at CuspariaKLSY11 slice 3 the selected candidate repeats no sentence and no 4-word phrase,
and shares none with the neighbouring slice,
so string matching cannot see that class,
and the zero is not evidence of its absence.
The fix rests on the audit's reading of that class and on the measured verbatim family.

The fix:
the editor sheet says a region carries only what the ORIGINAL says at that place,
and that a sentence the TRANSLATION already carries outside it,
or content a NEARBY ORIGINAL passage says,
goes in only where the ORIGINAL says it again,
as a refrain the TRANSLATION rendered once;
the faithfulness test both editor selections read says the same of candidates.
Conditioned on the ORIGINAL because the omission rules say to translate ALL of the missing content,
and a refrain the archive rendered once is such content.
Mutation check:
the unwired editor rule,
the rule without its condition,
and the dropped judge line are each caught;
the control survived.
Cache:
rides inside repair 34,
same check,
same result.

Candidate kept out:
prefer,
among indecision fallbacks,
a patch that repeats no sentence.
Its one measured case is XingZ631 slice 37,
where the indecision fallback carried a repeat,
the repair was lost,
and the slate endorsed the standing text.

#### L14(c): `selectChunkPatch` wording on declines

Status:
fixed in `e7e530564`,
guarded red first in `ebe1c8ffd`.
The chunk selection used the shared promise
"the caller keeps text it already trusts when you decline".
A decline names no candidate and counts as no vote:
the existing English is kept only when every judge declines (`rejection`),
and a round the naming judges cannot decide (`indecision`) sends the editor patch that landed the most edits
on to the checkers (`pickFallbackCandidate`).
The audit called this latent,
with no chunk round holding a majority of declines.
Measured,
that was wrong:
over 2,476 chunk rounds in 266 artifacts,
656 had at least one decline,
14 had declines outnumbering the ballots naming a candidate,
10 of those were read as indecision (TianqiChen66621 chunk 17:
4 declined,
1 named),
4 selected a candidate the minority named,
and none had every judge decline
(`~/temp/agent/audit-glossary-fix/l14c-census.mjs`).

The vote rule stays.
A decline as an abstention that does not count is the measured policy for the consolidation gate's `neither`
(`doc/planning/the-third-rendering.md`),
and the fallback repairs because the panel ruled its issues real (`editor-candidates.ts`).
The chunk sheet now states that rule (`CHUNK_DECLINE_CONSEQUENCE`),
and both behaviours it states are pinned (`chunk-decline-consequence.unit.test.ts`).
The shared promise stays for the envelope selection,
where any declined round leaves the envelope unedited,
so a round that declines keeps the trusted text there.
Mutation check:
the unwired constant,
the dropped unanimity,
the unstated fallback,
and an indecision that keeps the existing English are each caught;
the control survived.
Cache:
rides inside repair 34,
same check,
same result.

#### L14(e): a repaired text repeating a sentence no recorded stage wrote

Status:
closed at all 9 sites,
7 a census artifact and 2 faithful refrains (classified 2026-09-28);
found while measuring L14(b).
In 9 slices the repaired text carries a sentence more often than the archive English
while no chunk candidate of the slice does and no repair region's replacement carries it:
6 whose rounds were chunk and envelope selection
(Mio12-20260910,
Mio16-20260916 and Mio21-20260916 slice 14,
Mio20-20260916 slice 15,
TianqiChen66613 slice 12,
XingZ626 slice 44),
2 with a refinement round (XingZ628 slice 53,
XingZ631 slice 54),
and 1 refined without an accuracy patch (XingZ6010 slice 38).
At Mio12-20260910 slice 14 the repeated sentence is 12 characters,
absent from the archive English and from both candidates,
and the repaired text is 36 characters longer than the selected candidate,
so a step after selection wrote it (`~/temp/agent/audit-glossary-fix/l14b-origin.mjs`,
`l14b-mio.mjs`).

What that step did (`l14e-lines.mjs`,
`l14e-all.mjs`,
`l14e-substr.mjs`):
at all 9 sites the repaired text holds more lines than the archive English and the selected candidate
(1 or 3 lines becoming 11 to 17,
and 76 becoming 91 or 92),
so a later step set the text on more lines
(first written here as the ORIGINAL's lines;
the ORIGINALs of the two sites this entry names hold 3 lines and 1,
and the step is the semantic wrap,
`wrapReplacementText`:
both repaired texts equal their own wrap,
and wrapping TianqiChen66613's selected candidate gives its 13 lines,
`l14e-original-wrap.mjs`),
and the "repeated sentences" are short verse fragments (a single word and a comma,
a four-word line)
that the census's sentence rule counts only once they stand on their own lines.
Counted as substrings,
7 of the 9 carry the fragment exactly as often as the archive English or the candidate:
nothing was said twice,
and the census,
not a stage,
made the repeat.
Two carry a fragment more often:
TianqiChen66613 slice 12 (archive 1,
candidate and repaired text 2)
and XingZ6010 slice 38,
refined without an accuracy patch (archive and candidate 0,
refined text 4).
Neither ORIGINAL repeats a line of text (`l14e-source.mjs`;
only markup lines repeat),
which left a refrain within a line open while the slice's own ORIGINAL was not in the artifact.
Rebuilt from each run's own preparation
(`rebuildPreparation`;
each rebuilt slice's archive text equals the run's recorded row,
`l14e-original-structure.mjs`),
both ORIGINALs repeat a phrase within a line,
counted as the most repeated Han runs (`l14e-original-ngrams.mjs`):
at TianqiChen66613 slice 12 a four-character phrase stands twice,
matching the candidate's and the repaired text's two where the archive has one,
and at XingZ6010 slice 38 a three-character adverb opens a clause four times,
matching the refined text's four where the archive and the candidate have none.
Both are the ORIGINAL's own refrain,
rendered as often as the ORIGINAL says it;
how the archive English renders each refrain was not read.
No rule follows:
the refine sheet needs none about saying something twice,
since its only case turned out faithful.
Lesson for any later census of repetition:
count substrings as well as split sentences,
since setting a text on its lines changes what a sentence splitter sees.

#### L14(d): model-written and quoted text rendered raw on line-based sheets

Status:
fixed in `3be658509`,
guarded red first in `25d549aea`,
with every line end pinned in `bfc458ad3`;
found while fixing L14(a).
The panel sheet renders each evidence quote raw after `- evidence (SIDE): `,
and both the panel and checker sheets render each claim summary raw.
349 quotes and 3 of 23,714 summaries over every artifact carry a line break,
so their later lines stand as unlabelled lines between claims.
None opened a `CLAIM`,
`GROUP`,
`ISSUE` or `REGION` line in the artifacts measured,
but a quote or summary may,
and a forged opening line renumbers every ballot after it.
The same raw summary split the filing log lines (`claim-filers.ts`),
so every line after the first lost its chunk tag,
and the grading sheet rendered quotes raw where the repair sheet folded them.

The fix (`sheet-line-text.ts`):
a summary is one sentence of prose and folds onto one line with `flattenSpace`
(moved there from `introduced-defect-screen.ts`,
since the probe wire now needs it and the screen imports the wire);
a panel quote is evidence and keeps its lines,
each later one indented under its evidence item by `indentContinuation`,
so 99 percent of panel quotes stay byte-identical;
the grading sheet folds quotes as the repair sheet did;
the checker JSON also escapes NEL,
LS and PS,
which `JSON.stringify` leaves raw.
The helper treats LF,
VT,
FF,
CR,
NEL,
LS and PS as line ends and CR LF as one;
none of the 45,860 quotes carried VT,
FF,
NEL,
LS or PS
(`~/temp/agent/audit-glossary-fix/l14-unicode-breaks.mjs`),
so those are covered for the class,
not for a seen case.
Mutation check:
20 mutants over each fold,
the indent,
CR LF and each line end,
all caught,
with the control surviving in a separate run
(the first spec's control pattern opened and closed the region,
so the harness skipped it).
Cache:
rides inside repair 34 and refine 5,
same check,
same result.

## Docs and comments against code

Probe scripts:
`~/temp/agent/audit-docs2/`
(`backticks.mjs`,
`repo-wide.mjs`,
`examples.mjs`,
`owner-quotes.mjs`,
`hygiene.mjs`,
`class-dates.mjs`,
`pairing.mjs`).
Roster values were computed from `src/corpus-run/run-config.ts` itself:
`RUN_ROSTER` 9 seats,
`RUN_READER_MODELS` 6,
7 wide seats,
8 late judges.
Paths in this section are package-relative.

### D1: the README says the editor roster check still requires disinterested judges

Status:
fixed in `4397d7d2a`.
`README.md:301-303`;
`repair-contract.ts:224-229` says the 2026-08-15 ruling removed that requirement,
and the check refuses only repeats,
no editor,
or judge capacity short of the minimum weight.

### D2: the schema generation the pass writes is misstated in three places

Status:
Markdown fixed in `4397d7d2a` (generations 1 and 2 use the chunk spelling,
3 is mixed);
the two `.ts` comments fixed in `a25f09b2e` on 2026-09-28,
found open while writing the status page's open list:
V14 now says it is what the pass writes,
and the older history says where versions 10 to 14 are recorded.
`doc/configuration.md:326`,
`:334`,
`:352` say generation 4 and three generations;
`artifact-schema-version.ts:34` says V7;
`corpus-run/artifact-two-lane-contract.ts:36` says V12.
The pass writes V14 (`corpus-run/artifact-two-lane-build.ts:260`,
`corpus-run/pass-schema-guard.ts:426`)
and reads generations 1 to 14.
`artifact-schema-version.ts:42-90` stops its history at version 9.

### D3: pull-request runs are documented through a variable nothing reads

Status:
fixed in `4397d7d2a` (two probe variables were also missing);
two repo docs outside the package still name the variable (D18).
`doc/configuration.md:293-295` names `TRANSLATION_REPAIR_CORPUS_DIR` and an uncommitted fork;
production reads `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` and `TRANSLATION_REPAIR_CORPUS_COMMIT`
(`corpus-run/corpus-pin-override.ts`),
documented nowhere in the package.
`doc/configuration.md:5` claims every knob is listed and omits six.

### D4: the OpenRouter checker substitute is misnamed

Status:
fixed in `4397d7d2a`,
then superseded by `f10de5198`,
which replaced the substitute with the measured order.
`doc/design-commitments.md:177` says gemma-4-26b-a4b-it;
`corpus-run/run-seats.ts:113` has `google.gemma-4-e2b`.

### D5: the removed preparation layer is described in the present tense

Status:
fixed in `4397d7d2a`;
the `.ts` comments still describing it,
which this entry counted as two,
ran through eight source files
and were rewritten under D16 (`5a5079549`),
and the two fields kept only for it were removed under D20 (`89a15887a`).
`doc/seats-and-calibration.md:50-239` names about fifteen identifiers,
four artefacts and two mise tasks removed in `cbedea357`;
`:124` claims a bootstrap build dependency `mise.toml` no longer has.
`blockPairingQuestion`,
`blockPairingProtocol` and `prepareBlockPairing` survive.

### D6: stale constants and counts in the docs

Status:
Markdown fixed in `4397d7d2a`;
`corpus-run/run-config.ts:785` fixed in `79b749388`
(the comment was right when written on 2026-07-26,
at a 90 minute cap,
and went stale at each raise).
`doc/pictures.md:89` says 8 MiB (7 MiB since 2026-08-22,
`image-reading-stage.ts:120`);
`doc/configuration.md:18` says a run without the Synthetic key throws (every key is optional,
`corpus-run/run-providers.ts:94-130`);
`doc/configuration.md:201` says a stalled entry drops after its second try (its first,
`corpus-run/entry-reattempt.ts:214-223`);
the picture reader count is four or five in `README.md:353`,
`doc/pictures.md:54`,
`doc/slice-context.md:316` and `image-reading-stage.ts:17,21` (six);
`README.md:109` says 20 Synthetic slots across four models (two models,
10);
`README.md:287` misdescribes stage quorum retries (`stage-quorum.ts:337-376`);
`doc/seats-and-calibration.md:458` says ten editors (nine);
`corpus-run/run-config.ts:785` says a 90 minute entry ceiling (420);
`doc/provider-availability.md:67,114,121` frames two providers (four meters).

### D7: the OpenRouter routing description is stale

Status:
fixed in `4397d7d2a`.
`doc/configuration.md:73,81-85` and `doc/roster-changes.md:25-31`
against `model-cards.ts:209,320-328` and `openrouter-catalog.ts:98-100,263`.

### D8: comments name functions that never existed

Status:
fixed in `8ce84fb73`,
which also fixed D16's `SLICE_SPELLED_KEYS` part.
`image-reading-pair.ts:393` names `runStageRound` (`runGatherRound`);
`declined-target-runs.ts:44` names `pairBlocksAcrossRoster` (`pairBlocksWithRoster`);
`artifact-key-vocabulary.ts:19,47,104` miscounts its keys and misdates a table.

### D9: examples call the wrong function or pass keys it does not take

Status:
fixed in `d43933e6e` (red guard `d181e7c9b`,
`tsdoc-example-scan.unit.test.ts`),
which scans every source file's `@example` against the function it documents.
Mutation check:
dropping the callee report,
the key check,
a required key from a source example,
or counting defaulted keys as required was each caught;
the control survived.
The scan flags an example only when it never names its function,
since an example may pass a predicate by name rather than call it.
Wrong callee or keys:
`contributor-translation-guard.ts:22`,
`corpus-run/displacement-probe.ts:110`,
`delivery-coherence.ts:174,245`,
`editor-ensemble.ts:314`,
`consolidate-slice-buy.ts` (`buyConsolidationAttempt`),
`corpus-run/artifact-two-lane-read-naturalness-seat.ts:98`,
`corpus-run/pass-archive.ts:28`,
`restore-typography.ts:94-105` (no `@param` for `mask`).
These omit a required key:
`apply-patch.ts:194` and `editor-ensemble.ts:472` (`preservation`),
`corpus-run/artifact-two-lane-consolidate.ts:446` (`sliceIndex`),
`corpus-run/artifact-two-lane-read-contest.ts:68` (`keys`,
`generation`,
`comparison`),
`corpus-run/artifact-two-lane-read-rows.ts:52,140,278` (`keys`),
`corpus-run/band-order.ts:140` (`settledPerBand`),
`corpus-run/bench-sample.ts:81` (`pin`),
`corpus-run/pass-entry-artifact.ts:56` (`pageAssembly`),
`corpus-run/pass-entry.ts:586` (`publishDir`,
`declinedDir`),
`corpus-run/rendering-audit-settled-input.ts:282` (`runSetDir`),
`corpus-run/title-reference-locate.ts:411` and `corpus-run/title-reference-marks.ts:193` (`rendering`),
`document-readings.ts:74` (`readOcr`),
`front-matter.ts:320` (`openLength`),
`lane-slice-text.ts:196` (`notApplicableHere`),
`pair-agreement.ts:175` (`pairings`,
`needed`,
`pairingShape`),
`refine-eligibility.ts:224` (`minimumChars`),
`refine-slice-settle.ts:460` (`refineContributors`),
`repair-chunk-verdict.ts:108` and `repair-refine-step.ts:95` (`declaredNames`),
`repair-contract.ts:254` (`role`),
`sample-manifest.ts:166` (`generation`),
`slice-cost-log.ts:189` (`signal`),
`stream-drain.ts:191` (`label`).
The probe checked `function` declarations only,
not arrow functions,
methods or types.

### D10: owner quotes not in the record

Status:
fixed in `7b2d382bc`;
the first cites the paraphrase's decision record,
the second quotes in full.
`provider-name.ts:11` quotes the owner in the first person where the records hold a paraphrase;
`translate-runoff-tie.ts:25` truncates "prefer the best valid proposal,
else fail the slice at once".

### D11: status and hygiene

Status:
Markdown fixed in `4397d7d2a` except the ALL-CAPS paragraphs it did not touch (D19);
`seat-tally.ts:326` fixed in `59fb991c7`,
which gives the decision-seat tally its real reason
(the `SEAT` lines and the dark-seat report).
`doc/status.md` puts its history under the current heading,
names a consolidation cache generation 14 that collides with artifact schema generation 14,
says `assertFinalSelectionSettled` remains (removed in `1ba8f713a`),
and calls a 2026-08-26 audit current evidence.
ALL-CAPS emphasis across the docs,
lines over 120 characters in `doc/slice-context.md` and `doc/status.md`,
positional references (`doc/configuration.md:328`,
`doc/status.md:105,123`),
an italic (`doc/status.md:428`),
unbackticked model ids,
double blank lines,
mixed list markers in the README.
`seat-tally.ts:326` cites an untracked script.

### D12: class dates and clock times

Status:
fixed in `3a1706795` (every Markdown clock time carries a zone,
checked in `4397d7d2a`).
The owner answered "Major+ accuracy" and "Slate's choice" at 01:59:59 UTC on 2026-09-27,
and six places carried the local day before it.
Of the four dates named here,
class one hundred seventy-eight's was right
(its run began at 20:12 UTC on 2026-09-26),
and the class seventy-seven site carries no date to correct.
A census of every owner-answer date against the transcript timestamps was deferred here to the docs audit,
and ran on 2026-09-28.

The census read every owner-side entry in both package sessions' transcripts:
typed messages,
messages queued while the agent worked
(stored as `queued_command` attachments,
which a first reader missed until the known 01:59:59 UTC answer failed to appear),
and AskUserQuestion answers.
The Codex prompt history holds no owner prompt between 00:00 and 04:00 UTC.
Every entry in that window,
where the local (EDT) day is the day before,
was matched to the docs that date it:
by quotation where a doc quotes the owner
(323 dated sites carry a quotation)
and by topic where it does not.
Corrected in `d01d359d1`:

-   The voting rulings of 2026-08-15,
    00:47 to 01:44 UTC
    (no full-roster retry target,
    self-judging at reduced weight,
    the one-model rule,
    the 60 s grace,
    producing roles,
    the re-ask of an invalid candidate),
    dated 2026-08-14 in 40 places:
    27 in source,
    the ensemble-voting,
    straggler-grace and ineligible-standing records,
    a planning doc,
    the README,
    `doc/slice-context.md`
    and this ledger.
-   The answers of 2026-09-27 01:59 UTC,
    dated 2026-09-26 in 6 places the first fix missed because it touched only package files:
    two answer lines and two addendum headings in the ineligible-standing record
    (the addenda were committed at 02:28 UTC that day),
    one test name,
    and the current handover.
-   "50% is okay here."
    and the half-roster quorum,
    2026-08-06 02:58 and 03:06 UTC,
    dated 2026-08-05.
-   The output goal,
    2026-08-13 01:50 UTC,
    dated 2026-08-12.
-   Not a zone slip:
    the current handover dated the cron ruling 2026-09-19;
    the owner said it at 17:41 UTC on 2026-09-17.

Checked and right,
among the window's rulings:
the 2026-08-14 cost standing (22:37 UTC),
the translate-better instruction (2026-09-25 02:22 UTC),
the Jev approval (2026-09-18 00:29 UTC),
the gpt-oss-120b cull (2026-09-24 00:39 UTC),
the gloss objection and the ballot-caster ruling (2026-09-26 02:02 and 02:03 UTC),
and the dictionary-terms and 治愈 rulings (2026-09-27 03:13 and 03:41 UTC).
Not verifiable:
owner rulings the docs date 2026-08-28 to 2026-08-30 and 2026-09-11,
days with no owner entry in any local transcript.
The archived history segments carry the local day for evening answers
and are kept byte for byte;
their index now says so.
The census commit's message said 44 and five places;
commit comment 202514782 corrects both counts.
The finding as first recorded:
four class dates match only the local day of their commit
(class seventy-seven,
one hundred seventy-six,
one hundred seventy-seven,
one hundred seventy-eight);
`corpus-run/run-seats-wait.ts:14-18` and `corpus-run/run-seats.ts:66-67` give clock times with no zone.

### D13: a setting documented as read by launch logs that nothing reads

Status:
fixed in `0df81f0c1`:
`corpus-pass` prints `CORPUS PIN OVERRIDDEN`
naming the clone,
the commit and each one's source whenever either comes from the environment;
`doc/configuration.md` said no launch line did until `f921e8f0e`.
`corpus-run/run-config.ts:875-879`:
the `RUN_CORPUS_PIN_SETTING` TSDoc says "for launch logs",
but nothing reads it,
so no launch line names where the corpus pin came from.

### D14: an invalid Hyper request rate is not refused

Status:
fixed in `f69912818` (red guard `2fc22b098`):
a set value that is not a positive number is a stated refusal.
`request-pace.ts:305` falls back to the default rate for an invalid `TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR`,
where every other dial refuses an invalid value.

### D15: probe variables exported empty are used as given

Status:
fixed in `ea0493bd5` (red guard `89caeda65`):
both read through `textSettingOf`,
which folds an exported-empty variable into its fallback as `artifact-pool.ts` does.
`corpus-run/damage-sample.ts:267` and `corpus-run/score-verify.ts:199` read their variables with `??`,
so an exported-empty `DAMAGE_SAMPLE_SEED` or `VERIFY_SHEET_BASENAME` is used rather than defaulted or refused.

### D16: stale comments on providers and removed features

Status:
fixed in `5a5079549`,
the fence test in `9f20342b1`;
the `SLICE_SPELLED_KEYS` part in `8ce84fb73` (D8).
`corpus-run/budget-sample.ts:14-27,54-55` says "both providers" (four);
`block-pairing-question.ts:41` and `block-pairing-protocol.ts:63` mention replay and receipt planning
that `cbedea357` removed;
the `SLICE_SPELLED_KEYS` TSDoc in `artifact-key-vocabulary.ts` says generation 3 writes the slice spelling
and its header compares generations 1 and 2 with 4.

The two block-pairing sites were a family,
not a pair (M35).
A search for the removed layer's vocabulary (receipt,
replay,
recipe,
retally,
qualification,
calibration pool)
found the same framing in `block-pairing-question-key.ts`,
`pair-blocks-read-outcomes.ts`,
`pair-blocks-stage.ts`,
`prepare-block-pairing.ts`,
`queried-block-pairing-details.ts` and `prepare-with-pairing.ts`,
and in two test names;
all were rewritten to say what the code does now.
`budget-sample.ts` now names the four meters (three endpoints and the Bedrock spend ledger)
and its `@throws` names `StatedRefusalError`.

Found while fixing:
`pair-blocks-wire.ts` and `pair-sections-wire.ts` said their fence guards against a run of backticks
and gave a backtick fence in their examples;
`selectFence` has fenced with `=` since `b111fc376`,
before either sheet was written.
The section sheet's fence test fed a fixture holding backticks only,
so a builder that ignored the content and fenced with a fixed `=====` passed it:
that mutant survived,
the block sheet's twin was caught,
and the control survived.
The fixture now carries a setext underline,
and the test first checks that the line it reads is the fence around that fixture;
the mutant is now caught by both files' runs.

### D17: the recovery round re-asks only the last round's unreadable seats

Status:
fixed with P2 (`005692e11`,
guard `3549b74be`);
the README described the old behaviour until the P1 documentation commit,
which now says what P2 does.
`stage-quorum.ts` set `unreadable = answeredBadly` each round,
so a seat that answered unreadably in an earlier round was not re-asked.

### D18: repo docs name a corpus variable nothing reads

Status:
fixed in `f921e8f0e`.
The variable belonged to the uncommitted fork the pull-request 386 runs used on 2026-08-29;
production has read `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` and `TRANSLATION_REPAIR_CORPUS_COMMIT`
since `b0a79eb66` (2026-09-01).
The runbook now names those;
the handover keeps its history with a note saying so.
`doc/runbook/translation-repair-corpus-pass.md:38` and `doc/handover/translation-repair-handover-2026-08-29.md:379`
name `TRANSLATION_REPAIR_CORPUS_DIR`.

### D19: ALL-CAPS emphasis left in untouched paragraphs

Status:
fixed in `069b4df46`.
Emphasis became sentence case,
bold where the stress carries meaning;
the three seat states `producer-silence.ts` prints became code spans in prose rather than labelled bullets.
A probe over every package Markdown file,
not only the files this finding named,
found four more in `doc/repetition.md` and four in this ledger,
fixed in the same commit.
Kept:
the owner's words quoted in `doc/status.md` and sheet text quoted in this ledger.
`README.md`,
`doc/configuration.md`,
`doc/design-commitments.md`,
`doc/pictures.md`,
`doc/provider-availability.md`,
`doc/roster-changes.md`,
`doc/seats-and-calibration.md`,
`doc/slice-context.md` and `doc/status.md` keep ALL-CAPS emphasis in paragraphs the D fixes did not reach
(the docs agent's report of 2026-09-27 lists the lines).

### D20: pairing fields kept only for the removed preparation layer

Status:
fixed in `89a15887a`,
found while fixing D16.
`BlockPairingOutcome.outcomes` (`919e517e4`,
2026-09-11) carried every asked seat's reply,
and `PreparedBlockPairing.evidence` with its type `PreparedBlockEvidence` (`536cd7445`,
2026-09-11)
said whether a section's relations came from the cache or the roster;
both were added for the receipt and replay layer `cbedea357` removed,
and after it only tests read them.
Removed by the criterion `cbedea357` itself used:
nothing a pass or probe reaches reads them.
The pairing cache stores `{ pairs, findings }` alone,
before and after,
so no cache version moves.
The tests that read the fields now assert heard and usable counts,
findings,
exact pairs and call counts;
the census of those tests first named four files,
and the type check named two more (M33).

### D21: log-line and status names in this ledger outside code spans

Status:
fixed,
found while fixing D19.
Eighteen lines of this ledger named a line or status the package prints
(`SPEND`,
`METERS`,
`SEAT`,
`TALLY`,
`DONE`,
`ERROR`,
`INCOMPLETE`,
`REFUSED`,
`SURVIVED`,
`[PASS]`,
`[FAIL]`)
as bare capitals,
where the other docs span them;
one of them was written on 2026-09-28 closing D11.
One line named a log file bare as well.
A probe over every package Markdown file found none outside this ledger.
