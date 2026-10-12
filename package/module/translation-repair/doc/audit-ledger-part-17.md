# Audit ledger, part 17

Part 17 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Found while fixing, continued

### X2: a scripted gather-stage test's seat rotation depends on its prompt text

Status:
fixed in `87acdb4d9`:
`attestCitedReferences` takes the optional `fanOut` `pairBlocksWithRoster` takes,
threaded to both of its gathers,
and the four scripted cases ask the whole bench.
Checked by shifting the hash's offset basis:
three shifted offsets failed the pre-fix tests (2,
4 and 2 failures),
the fixed tests passed under the two offsets run against them,
and the control survived every run.
The window's own tests pass under any offset,
rightly:
another offset is another valid rotation.
`stage-fanout-window.ts` picks the seats to ask by an FNV-1a hash of the prompt modulo the roster size,
so rewording a fixture changes which scripted seat is heard;
`reference-attest.unit.test.ts` and `reference-attest-confirm.unit.test.ts`
failed against a passing HEAD on a reworded fixture
until phrases matching HEAD's rotation were chosen.
A test that depends on which seat is heard should pin the rotation rather than inherit it from its text.

### X3: comments and TSDoc quoting corpus text or handles in source files

Status:
the method quote fixed in `a96bf1f4a`,
which also replaced a TSDoc example naming the method;
the rest waits on the owner's end-of-project sanitization.
`reference-attest-match.ts:18-19,29-30,48-50`,
`translate-suicide-drop.ts:4-21` (quotes a method,
a date and handles),
`rendering-glossary-phrasing.ts:56,76-79`,
`archive-original-note.ts:37-53`,
`markdown-blocks.ts:13`,
`bilingual-pair-bound.ts:25`,
`bilingual-line-clause.ts:19`,
`corpus-run/run-config.ts:106`,
`image-asset.ts:45`,
`image-reading-stage.ts:98`;
and in untouched tests,
names in comments and test names
(XingZ60 32,
hakureico 23,
Toka_ls 6,
gqt 6,
Yumao 5,
aiyysk 3,
lintong 3,
羽毛 3,
Ling 2,
Hanasaka 1),
Yumao and 羽毛 as string literals.
The owner defers sanitization to the project's end;
the method quote in `translate-suicide-drop.ts` is the one the reader-protection rule covers now.

### X4: the consolidation producers' repair turn re-checked revisions without the declared names

Status:
fixed with the sixteenth addendum.
`consolidate-produce.ts` validated each proposal with `subject.declared`
and passed no `declared` to `repairInvalidCandidates`,
so a revision that dropped a declared name passed the re-check.

### X5: neither slice key named the archive dispute

Status:
fixed with the sixteenth addendum.
`translateSliceKey` and `consolidateSliceKey` hashed the texts but not the dispute note,
so a slice judged under accepted claims could resume a record settled for the same texts undisputed,
and with the archive as incumbent on an unresolved dispute the texts would be identical.

### X6: the translate lane's refusals keep an archive the floor refuses

Status:
fixed in `6445a2e35` (guard `ee3a551e3`;
mutation checked with a control,
three mutants caught).
`translate-slice.ts` gates its alignment,
quote-loss and declared-name refusals on the slice having archive wording,
not on that wording passing the floor,
so a replacement refused there ships the floor-refused archive as the lane's text
(shihai4h2 slice 14 kept a 1665-code-point archive against a 102-character source);
the consolidation then refuses it as a standing.
The disputed case no longer does this;
the floor-refused case needs the stage's eligibility on the record.
Measured 2026-09-28 over 975 run logs (`~/temp/agent/audit-glossary-fix/x6-census.mjs`):
of 1,771 translate refusals,
up to 47 were followed by the consolidation refusing that slice's standing,
46 for a link the original carries and 1 for the untranslated pronoun;
"up to" because the census cannot tell which lane the refused standing came from.
The slice now asks `validateTranslatedSlice` the consolidation's standing question from the same inputs
(`translate-archive-floor.ts`),
and a refused archive is kept by no refusal:
the judges' replacement goes on,
the record carries `translate-archive-ineligible`,
and a log line gives the rule's reason.
A first fixture put a link in the original,
which re-paired the section as an insertion and failed for the wrong reason;
the guard uses the pronoun floor,
which reads only the text.
Rides inside the translate cache version 15 with a written account.
The 47 measures the symptom,
not the fix's reach,
which is unmeasured on the agreement path:
where the repair lane also left the archive,
a kept archive made the lanes agree and shipped with no floor,
leaving no consolidation line,
and such slices now go through the contest and the consolidation.
An original the grammar cannot read (`unknown`) lifts the refusals too,
as the consolidation refuses that standing alike.
Not a launch factor:
no TianqiChen666 run refused anything in the translate lane.

### X7: windowed stages re-ask a seat the router refused

Status:
fixed with guard `9466786dc`,
fix `84a6caa02`.
`stage-windowed-rounds.ts` put every seat that never answered back on its pending list,
a refused one included,
so the lane contest,
pairing,
the gate,
the naturalness review and the polish gate
re-asked a seat no wet provider served in every retry round
(a four-seat fixture asked it four times).
`stage-quorum.ts` fixed the same defect on 2026-09-09 (`hulicaijia`);
this path never got it.

### X8: windowed stages size quorum over the seated bench

Status:
fixed with E3 in `29baade8f` (red guards `a6cbd8fc5`):
`runWindowedRounds` re-sizes its quorum with `reachableQuorum` before every round,
and the five stages beside the naturalness review carry `stage-short-bench` in their findings.

Found as:
`runWindowedRounds` takes `heardNeeded` from `rosterQuorumSize` over the seated bench
and never applies `reachableQuorum`,
though the 2026-09-09 addendum of `doc/decision/translation-repair-short-bench-share.md`
says the reachable share sizes every gather.
A windowed stage whose reachable seats cannot meet the bench quorum spends its retry rounds and closes short
without the `stage-short-bench` finding the gathers carry.

### X9: code indented against its nesting, which no check reads

Status:
fixed in `632ef5fbc` and `f7b766fa4`;
enforcement is issue #577.
`runCriticBenchmark`'s inner attempt,
its `try` body and its retry block sat two to three levels too deep
for about 190 lines of `benchmark.ts`;
a test body in `repair-translation.unit.test.ts` dropped two spaces for about 60 lines,
and the stall case in `stream-idle-guard.unit.test.ts` left an argument and its assertions too shallow.
All were lint-clean:
the dprint TypeScript plugin was retired for `oxlint-plugin-stylistic`,
which has no indentation rule.
A heuristic scan of the 1666 source files flagged 35 lines,
the rest being template-literal ends
(`~/temp/agent/audit-repair/indent-scan.mjs`).
The trailing-comma drift in some test files is not a finding:
`package/config/oxlint/src/overrides.ts` lets tests lay out calls freely and no config enables `comma-dangle`.

### X10: a slice carved through an element can never settle, and the stages disagree on `unknown`

Status:
fixed in `a499a2fc2` (red guard `f4736eed4`,
whose fixture was corrected in the fix;
mutation checked).
The carve was not the cause:
NIGHT81473140 slice 22 holds the whole element,
an opener and a self-closing component with an expression attribute on one line and the closer on the next,
and the document and the slice both parse it whole.
The lone-container masker (`mask-container-tags.ts`) paired whole tag lines only,
so it blanked the closer as unpartnered and left the opener with no end;
it now pairs against openers and closers of the same names anywhere in the slice (`inline-container-tags.ts`)
and masks only a tag line left unpaired.
The deterministic carve of all 92 entries now has 0 of 1,259 slices whose source or translation the slice grammar refuses.
The stages still disagree on `unknown`,
which after this fix means an original the grammar refuses whole,
where the page would fail the upstream compile as well;
none occurs in the pinned corpus,
and no change is made there.
The first red guard used a fixture that is not valid MDX even whole (a `span` on the opener line),
so it failed for a reason other than the defect;
the fix commit replaced it with the entry's shape
and the mutation check (pre-fix masker,
rebuilt) showed the corrected case failing.

Found as (this first diagnosis blamed the carve and was wrong):
NIGHT81473140 slice 22 of the deterministic carve opens a `<blockquote>` that closes in a later slice,
so the strict grammar refuses the original (`end-tag-mismatch` at 1:1) and the verdict is `unknown`.
The producers read `unknown` as a pass (`translate-floor.ts` keeps any voice not `invalid`;
`translate-repair.ts` lets it stand with a `translate-unvalidated` finding),
while every gate reads it as a refusal (`translate-stage.ts` keeps the incumbent off the slate;
`lane-contest-eligibility.ts`,
`consolidate-lane-offer.ts`,
`consolidate-standing-verdict.ts`
and `consolidation-polish-round.ts` accept only `valid`),
and a candidate that mirrors the cut fails the strict grammar itself and is refused as unparseable.
The slice can therefore never settle,
and the entry stopped;
since the owner's ruling of 2026-09-27 ("Keep archive,
ship") no wording passing the rule keeps the archive there,
so the entry ships with the slice on its `DEFECTS` line,
but the slice is never improved.
The root is the carve cutting an element;
once carving keeps elements whole,
`unknown` means an original the upstream MDX compile would also refuse,
where refusing is right.
One slice of 1,277 in the replay;
no run has reached it (no settled artifact exists for the entry).

### X11: the consolidation run shape omitted the slate judges

Status:
fixed in `c5ac38345` (red guard `01c8bbad8`;
mutation checked with a control,
the dropped-judges mutant caught).
`9a7d48354` split the slate judges and the gate from the writers on 2026-09-02
and left them out of `consolidateRunShape`,
so a settlement another judging bench reached would resume under a bench that never judged it.
The run shape now carries the judges beside the writers.
Every consolidation key moved inside version 20,
under which no slice-cache file had been written
(checked 2026-09-28:
the newest is the TianqiChen66620 consolidation entry at 04:26 UTC on 2026-09-27).
The other run shapes carry every bench they ask:
the translate lane's its writers and judges,
refine's its refiners,
judges and checkers,
the lane contest's its one bench.
The same commit also folded `checkerSelfCertificationPermitted` into the repair run shape where refused;
that half was wrong and `6d9b361b4` took it out again (M37).

### X12: the lane contest, the preparation and the picture readings never re-seat under a hold

Status:
fixed in every phase:
lane contest,
picture readings,
insertion admission and preparation.
Contest:
prep `4bd530922`,
red guards `5acdd36c6`,
fix `2a0ee0272`
(mutation checked with a control,
seven mutants caught).
`contestHooksFor` (`corpus-run/pass-contest-reseat.ts`) re-reads the late judges while a hold runs
and keeps them once it ends;
`contestDocumentLanes` seats and keys each slice on them (`shapeFor`),
so a slice nobody re-seated keys as before and no cache version moves.
The three copies of the hold-and-memo re-seat are now one,
`reseatHookFor` (`corpus-run/pass-reseat-hook.ts`):
the consolidation hook moved onto it in `09839c622` and the lanes hook in `df601d839`,
after `f60abcb15` pinned that each lane keeps its own seating.
The migrations were mutation checked with a control,
followed by the full suite (0 FAIL,
1264 PASS):
eight mutants caught,
one of them only after `87c3d7aaf`.
The translate hook reading under the lanes phase survived the first run,
since no case told the phases apart;
`87c3d7aaf` does,
under the one view of all sixteen that separates them
(Hyper and OpenRouter dry:
the lanes phase finds the editors and refiners short,
the translate lane nothing).
`awaitBenchQuorum` lost its last caller with them and was removed in `c2e74caeb`,
with the `run-seats-read.ts` comment that said every driver asks it.
Pictures:
prep `3ef2e210d`,
red guards `fcd16ce66`,
fix `d69db363a`.
`picturesHooksFor` (`corpus-run/pass-pictures-reseat.ts`) re-reads the readers while a hold runs;
`readDocumentPictures` reads and keys each picture by them,
and `readSeatedPictures` builds one hook per call,
since each call reads the seats afresh.
The picture key has no version and already folded the readers.
Mutation checked with a control,
then the full suite (0 FAIL,
1266 PASS):
four mutants caught,
two survived.
The hook reading under another phase survived because no view tells the pictures,
lane contest
and consolidation phases apart;
`1fa856e0d` asserts each hook's logged re-seat line with its exact phase,
which caught all four phase mutants and a helper logging no phase.
The seam dropping the hook survived because no test drives a pass seam:
X14.
The census counts holds after the pictures reading under the pictures,
so its 11 in 3 logs is an upper bound:
the sighted pairing and the archive review run after the readings on the preparation's reading.
Insertion admission:
prep `c087e6e33`,
red guards `2fbb7ec24`,
fix `105e81220`.
`decidePassInsertionAdmission` asked every source-only candidate of the roster the lanes read.
`insertionHooksFor` (`corpus-run/pass-insertion-reseat.ts`) re-reads the roster under a hold
under its own `insertion admission` phase,
which leans on the wide bench as the preparation does,
and `admitPassInsertions`,
the seam `runPassEntry` now calls,
wires it (split out to keep `pass-entry.ts`
under its line cap,
and so a test drives the wiring:
X14).
The coverage stage caches nothing.
Mutation checked with a control,
then the full suite (0 FAIL,
1271 PASS):
four mutants caught,
one survived,
the new phase leaning on another bench,
since only some phases' benches were pinned;
`c2adcfdbf` pins the whole table,
which caught it and a lane contest bench mutant.
Preparation:
prep `aa635056a`,
red guards `f891b358e`,
fix `92556ba44`,
guards completed in `d00123df3`.
`preparePassEntry` asked its attestation,
every section and block pairing round
and every archive block review of the roster read before it.
`preparationHooksFor` (`corpus-run/pass-prepare-reseat.ts`) re-reads the roster under a hold
under the `preparation` phase,
and `runPassPreparation`,
the seam `runPassEntry` now calls,
wires it.
One `beforeItem` hook reaches every site that asks:
`prepareDocumentPairWithRoster` reads it before the section round
and before each section's block round,
`repairArchiveBlocks` before each block,
and `attestPassReferences` (`corpus-run/pass-attest-references.ts`) before the attestation,
only when the original links somewhere.
The pairing keys fold the roster that answers (X13),
so a re-seated round is keyed by it.
The first mutation run (control survived) caught six mutants and left four more alive besides the attestation site.
The pairing fixture never bought a section round,
its hook handed one constant roster
so a block round reusing the section round's seating passed,
and the seam fixture left no archive block unclaimed.
The phase table mutant survived only because the spec left out `corpus-run/run-seats-wait.unit.test.ts` (M41).
`d00123df3` rebuilt the pairing and review guards on a hook alternating two disjoint rosters,
requiring every call to ask the roster last handed over and each round to be reached,
and added a seam case whose archive carries an unclaimed block.
The attestation had no guard a fixture could reach,
since `preparePassEntry` read the linked pages off the web.
`attestPassReferences` now takes the round out of it with a required hook
(`keepBench` in `bench-seating.ts` for a caller with none,
since the repo models absence without nullish unions),
and `preparePassEntry` takes an injected reference reader,
as it takes `readPictures`,
so a case drives the whole preparation and requires every call to ask the roster the hook hands over.
The second run,
with a control,
caught all fourteen mutants,
including the attestation wiring,
an unlinked original still asking,
and the injected reader ignored;
the full suite then passed (0 FAIL,
1278 PASS).
All four call sites are guarded.
The one wiring a type guards rather than a test is omitting `beforeItem` at `attestPassReferences`,
which fails the type check;
replacing it with `keepBench` is the tested mutant.

Found as:
The fifth stage of the H5 family.
`runPassContest` reads its judges once and `contestDocumentLanes` has no per-slice hook,
so a dry-out inside the contest leaves every later slice on the judges read before it,
and nothing waits out the hold either:
the per-slice wait `e17d0c487` added on 2026-09-07 reached the lanes and the consolidation only.
The preparation (pairing,
archive review) and the picture readings read their benches once too.
Measured 2026-09-28 over 4,122 run logs (`~/temp/agent/audit-glossary-fix/phase-hold-census.mjs`),
holds that began inside each phase,
counted from its seat reading to the next phase's:
lane contest 222 in 12 logs,
preparation 25 in 4,
pictures 11 in 3
(consolidation 983 in 25,
lanes 353 in 42,
translate lane 115 in 14,
all three now re-seating).
With the consolidation hook re-seating,
`awaitBenchQuorum` has no production caller left,
and `corpus-run/run-seats-read.ts` still says every driver asks it before each chunk.

### X13: the pairing keys carry no roster

Status:
fixed in `fea6e4688` (red guards `e9caf3f27`;
mutation checked with a control,
three mutants caught).
Both keys fold the roster that answers,
last,
after a separator and the word `roster`;
the block round passes its roster through `blockPairingQuestion`,
and the block key goldens were recaptured
under a fixture roster.
Every pairing key moved inside version 3,
under which nothing was written.
The full suite after the mutants found one more test deriving pairing keys itself
(`corpus-run/pass-footnote-lifecycle.unit.test.ts`),
fixed in `b84c2384c` (M39).

Found as:
The same defect X11 fixed in the consolidation key.
`blockPairingQuestionKey` (`block-pairing-question-key.ts`) and the section round's `roundKey`
(`prepare-section-round.ts`) hash the version and the texts only.
The pipeline digest the pairing caches are opened under covers the static roster,
since any change to `corpus-run/run-config.ts` rebuilds `dist`,
but not a dry reading's subset:
`pass-entry.ts` seats `preparationSeats.roster`,
and a section paired by a subset resumes on the full bench under the same generation and key.
Both rounds persist once any voice was usable (`usable > 0`),
so a one-voice answer is kept as well.
Neither the keys' TSDoc nor `doc/decision/llm-assisted-block-pairing.md` rules that pairing is roster-independent.
Pairing answers live beside the slice caches (`slice-cache/<entry>/pairing.*.json`);
version 3 was set in `d614a0c1d` at 04:30 UTC on 2026-09-28,
after the newest slice-cache file (04:26 UTC on 2026-09-27),
so none was written under 3 and the roster can ride inside it.
It must land before the preparation half of X12,
or a re-seated section resumes the old bench's answer.

### X14: no test drives a pass seam

Status:
fixed;
every pass seam is driven by a test
(contest,
consolidation,
insertion admission,
preparation,
lanes and pictures).
The insertion admission seam (`admitPassInsertions`,
X12) is driven the same way in `2fbb7ec24`,
and the preparation seam (`runPassPreparation`,
X12) in `f891b358e` for the pairing
and `d00123df3` for the archive review.
`runPassContest`,
`runPassConsolidation`,
`readSeatedPictures` and `runPassEntry` wire each phase's hook
and bench into its driver,
and none had a test,
so a seam dropping its hook survived every guard
(the picture seam mutant in X12).
`76142da2c` exports the contest and consolidation seams,
and `6371fd9ff` drives each against a client
whose view turns Synthetic dry after the phase's own reading,
under a hold:
only a wired hook keeps the seat the dry-out took from being asked,
and a control whose view never changes shows that seat is asked otherwise.
Mutation checked with a control:
both seam mutants caught.
Lanes:
the hooks were spread into `runDocumentLanes` inside `runPassEntry`,
which no test drives.
`f2c329781` gives them a seam,
`runPassLanes` (`corpus-run/pass-lanes.ts`),
which takes the `readLanesSeats`
result whole,
and `30e57c62b` drives it on a real reading:
no lane call may ask a seat the dry-out took
from either lane bench.
Mutation checked with a control,
then the full suite (0 FAIL,
1280 PASS):
the seam dropping both hooks,
the translate re-seat alone and the per-slice hook alone were each caught.
Pictures:
`readSeatedPictures` reached the pinned corpus (`gatherEntryPictures`)
and shelled out to `dwebp` and `tesseract` (`readImageWithOcr`) with no way to hand either in,
and its one seam,
`visualEvidenceReader`,
replaces the whole reading,
hook and all.
`36aeeaa6c` adds an optional `pictureSources` input (`PassPictureSources`) replacing only those two,
and `f865f524a` drives the entry's picture reader over stand-in bytes and OCR.
The first mutation run caught three mutants and left two alive (M42 again):
the stage seating the roster instead of the readers,
since under a constant hold the hook re-seats every picture
and the first seating is never asked,
and the OCR ignoring the stand-in,
since the readers are asked either way.
`35684e182` adds a case with no hold and requires the stand-in OCR to have read;
the rerun,
with a control,
caught all five,
and the full suite passed (0 FAIL,
1281 PASS).

### X15: the pairing keys are not injective

Status:
fixed in `692ebe3c0` (red guard `aee557392`,
section kind pinned in `c89bbda4f`),
as hardening:
measured,
no pinned input reaches the aliasing.
`pairingQuestionKey` (`pairing-question-key.ts`) now builds both keys from one JSON value of fixed shape
(version,
question kind,
both sides' texts,
pictures,
roster),
which JSON escapes injectively and which keeps a section key and a block key apart over the same texts.
The block goldens were recaptured,
and the two embedded NUL cases they had pinned to one key now differ;
three tests that joined the key by hand name its material and call the encoder instead (the M39 lesson).
Rides inside version 3:
checked again on 2026-09-28,
the newest slice-cache file is still from 04:26 UTC on 2026-09-27.
Mutation checked with a control:
nine mutants caught (the question kind,
roster,
pictures,
version,
sides swapped,
texts flattened,
and each key passing the other's kind or dropping its pictures),
after `c89bbda4f` pinned the section round's kind,
which no test had named;
the full suite then passed (0 FAIL,
1279 PASS).
The draw keys hash joined fields as well and need nothing:
`sample-draw.ts` fixes its seed and kind within each sort,
so two keys meet only when their ids do,
and `damage-sample.ts` separates with NUL,
which neither its fixed domain,
its seed (`DAMAGE_SAMPLE_SEED`,
an environment value,
or a literal) nor an id can carry.

Found as:
Both pairing keys,
`roundKey` (`prepare-section-round.ts`)
and `blockPairingQuestionKey` (`block-pairing-question-key.ts`),
joined the texts of both sides with NUL and marked the side boundary with one more NUL element,
so an empty text beside the boundary aliased across it:
original `[a, '']` against translation `[c]` and original `[a]` against translation `['', c]` hashed the same bytes,
as did a NUL inside a text across a block boundary,
and UTF-8 folded every lone surrogate into U+FFFD.
The block key's TSDoc named only an embedded NUL as its aliasing path,
and kept its layout so that every key without pictures kept its historical bytes;
X13 had moved every pairing key inside version 3,
so no historical bytes remained to keep.
Measured 2026-09-28 (`~/temp/agent/audit-glossary-fix/x15-empty-text-probe.mjs`):
over all 92 pinned pairs,
570 sections and 5,063 blocks,
the archive side normalized as the preparation reads it,
no section or block text is empty and none holds a NUL,
and no parser edge case tried (front matter alone,
a bare heading,
a thematic break,
an empty code block,
quote,
list item or footnote,
a comment,
a picture,
a component) yields an empty text,
since a node's text is its own non-empty span.

Found as:
Reading `prepare-section-round.ts` whole after its raw NUL bytes had hidden it from every line search (M40).
The golden file also cited a scratch baseline (`question-baseline-QWeptI`,
from `62cedf6fa`) that no longer exists;
the recapture removed that line.

### X16: a handle or a community's name varies in case across unanchored slices

Status:
measured 2026-09-28;
no floor,
decided for quality.
Found measuring H16:
on XingZ60's newest settled artifact a handle ships as `z60` and `Z60`,
and a community's name as `limelight` and `Limelight`,
on slices no archive English anchors.
Measured over the newest settled artifact of 39 entries (`~/temp/agent/audit-glossary-fix/x16-case-drift.mjs`):
of 279 Latin tokens the originals write that ship,
16 ship in two casings away from a sentence start,
and reading where each minority form stands (the character before it,
never the token) shows
most sit inside a URL or path,
or open a quoted line after `>` (XingZ60's `Z60` among them);
the mid-sentence ones are ordinary English words,
where casing follows grammar and titles.
Restricted to tokens that are not lowercase dictionary words (`x16-floor-reach.mjs`,
URLs left out):
73 ship,
7 ship in a casing the original never uses (on 6 pages),
and each is consistent within its page.
A deterministic floor forcing the original's casing cannot tell a person's handle,
which keeps its spelling (house rule:
HiYku,
wing,
Mikä),
from a brand an original types in lowercase,
whose English styling is capitalized;
it would enforce the wrong English as often as the right one.
The handle case is already a house rule every sheet carries,
so nothing is added.

### X17: the rendered-sheets fixture claims every model-facing sheet and holds fifteen

Status:
fixed in `9ebc80985` (production names `4429fd4b3` and `b98638490`,
spelling `ffc03346d`),
2026-09-28;
found wiring H16.
`rendered-sheets.test-fixture.ts` said it renders "EVERY MODEL-FACING SHEET" so a guard about what the models read
checks every sheet at once;
it held fifteen:
of the 24 `build…Messages` builders the package defines it rendered 14,
and it rendered none of the picture readers,
the other selection slates,
their decline texts or the typed decision.
The fixture now renders all of them,
split into four sibling fixtures under max-lines.
Rendering them from production text took names for four texts built inline where they are sent
(the picture reader's request,
the translate challenge task,
the archive slate's task and decline),
each moved byte for byte,
and exports for the rest.
The first read found one defect:
the picture readers' instruction said "summarise",
which en_CA writes "summarize";
the picture reading key hashes the instruction,
so no version moves.
The full suite then passed on `ffc03346d` (0 FAIL).
Prevention:
`rendered-sheets-census.unit.test.ts` scans `src` for every exported `build…Messages` function
and fails when no fixture renders it (over the old fixture it lists ten).
Sheets built without that naming
(the slates' tasks,
criteria and decline texts,
the picture readers,
the typed decision)
are not in the census;
a new one of those still needs its own entry.

### X18: the preparation dropped the attestation's findings when the archive was corrected

Status:
fixed in `d80f56866` (red guard `5f4863f32`),
2026-09-28.
`preparePassEntry` (`corpus-run/pass-prepare.ts`) has three ways out:
no unclaimed block,
an archive the review leaves standing,
and an archive corrected and prepared again.
The first two carried the reference attestation's findings;
the third rebuilt its findings
from the re-preparation,
the relabel and the review,
and dropped them.
The attestation's and the page title lexicon's findings now form one `evidenceFindings` list on every way out.
The guard drives all three returns and asserts each is reached (the M42 prevention):
its first fixture,
on a two-seat roster,
never reached the third,
since the correction slate kept the archive,
and the reach assertion said so before any verdict was read;
both seats wrote the one revision,
each vote for it weighs `SELF_VOTE_WEIGHT` (1/2),
and 1 falls short of `MIN_SELECTION_WEIGHT` (2) (`candidate-select-model.ts`);
on four seats,
as the older correction test uses,
the slate selects the revision.

Found as:
Reading the returns while wiring H16's lexicon findings into them.

### X19: a unit test bought a live web search and wrote the real lookup cache

Status:
fixed in `d82dfe559`,
2026-09-28.
`preparePassEntry` read three things outside the pipeline itself:
the work-title lookup and the cited references,
each with the Exa key from `process.env` and a cache under `~/.cache`,
and the corpus names at the pin.
The unit suite runs under the root `mise.toml`,
which decrypts `.env.local.json`,
so the key is set in every test process (checked as a boolean:
`TRANSLATION_REPAIR_EXA_API_KEY` is non-empty).
H16's red guard (`31c7d3f00`) prepared an original naming an invented title through that path:
the preparation bought one Exa search for it
and wrote the answer to `~/.cache/translation-repair/lookup/84fcabcd8c13….json` at 19:42 UTC.
The five other lookup records whose titles a fixture also names are corpus titles live runs bought.
The three reads now come through `PassOutsideReads` (`corpus-run/pass-outside-reads.ts`),
required by `preparePassEntry` and `runPassPreparation`;
the run hands over `RUN_OUTSIDE_READS`,
and every test hands over `NO_OUTSIDE_READS`
(`pass-outside-reads.test-fixture.ts`) or a reader of its own,
so a test that leaves the seam out does not compile.
`pass-outside-reads.unit.test.ts` drives the wiring:
each reader asked once about the original,
and what each returns reaching the sheets.
The footnote-lifecycle test had worked around the same hazard by asserting its original names no title;
that assertion gave way to the fixture.
The stray record could not be removed from this session (the removal was refused);
it holds only the invented title's search,
and the owner can delete it.
The fix left one caller supplying the run's readers itself:
`runEntryPipeline` handed `RUN_OUTSIDE_READS` to `runPassPreparation`,
so `settleEntry` took no readers
and `pass-entry.unit.test.ts` still prepared every entry through the key,
the real caches and the corpus clone,
until 2026-09-29 (M68).

### X20: the page-name glossary reads Markdown headings and not HTML ones

Status:
fixed in `ee39e2ba5` (red guard `84b9822d8`,
order and levels pinned in `197f8b811`),
2026-09-28.
`page-headings.ts` now holds the one Markdown and HTML heading reader the glossary and the page title spans share,
each heading placed where it stands,
and the glossary pairs each kind among itself under the same-count rule,
listed by where the original's heading stands,
so an HTML heading only one side carries costs no Markdown pair.
Over the 92 pinned pairs the built `pageNameLines` gains heading lines on `aiyysk` (2) and `mikaela_khara` (1)
and nowhere else (`~/temp/agent/audit-glossary-fix/x20-verify.mjs`).
Mutation checked with a control,
then the full suite (0 FAIL):
over X20 and H16's three earlier survivors,
nine of eleven mutants were caught at once;
the two left,
a heading the archive keeps in the original's words
and markers with no space after them,
had no fixture that could fail;
`801b09420` adds one for each,
and the rerun,
with its control,
caught both.

Found as:
Reading the glossary's heading reader beside the page title spans' while fixing H16.
`headingsOf` (`page-name-glossary.ts`) read ATX headings only,
so an archive's rendering of an HTML heading
never reached the sheets as a page name.
Measured at the pin (`~/temp/agent/audit-glossary-fix/x20-html-headings.mjs`):
3 of 92 pairs carry HTML headings with Han in the original,
13 headings;
on `aiyysk` (2) and `mikaela_khara` (1) the archive carries the same count of HTML headings,
so those three are pairs the glossary misses;
XingZ60's 10 against the archive's 6 pair nothing by the glossary's same-count rule either way.
No page has a line of seven or more `#`,
which `headingsOf` read as a heading and CommonMark does not,
so the shared reader,
which stops at six,
reads the corpus as the old one did.
