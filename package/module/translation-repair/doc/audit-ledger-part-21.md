# Audit ledger, part 21

Part 21 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B27: a quorum counting seats the router refused (B21, family five)

Status:
fixed,
2026-09-29.
The short-bench rule
(`doc/decision/translation-repair-short-bench-share.md`)
sizes a gather's quorum on the seats a wet provider serves.
Family five asked where a threshold derived from a gather still counted the whole bench.

#### The census

Every quorum-sizing line in the package's source was read
(`f5-sites.txt` in `~/temp/agent/audit-glossary-fix/`,
157 lines,
18 of them calls or mentions of `rosterQuorumSize` or `reachableQuorum`),
and each threshold was asked which seats its denominator counts.
Outside its own file,
`rosterQuorumSize` had 8 calls when the census read them,
and has 7 since the fix removed the archive block review's.
The gather itself (`stage-quorum.ts`),
the windowed rounds,
the select minimum
and the naturalness verdict rebuilt from its recorded basis
all take `reachableQuorum`.
The first round's window (`firstRoundWindow`) sizes a round before any seat is lost,
and `shortBenches` uses the whole bench's quorum to say what short means;
both count the whole bench by design.
Reference attestation takes its majority over the voices heard,
the vote tally over the ballots cast,
and insertion admission over the reachable seats coverage asked.
The checker bench width is a roster floor,
and the non-translation finding compares characters,
not seats.

#### What was wrong

`runArchiveBlockReviewStage` held its anchored voices to `rosterQuorumSize` over the whole bench,
while the same function's outage test had taken `reachableQuorum` since the short-bench rule.
On a bench whose reachable seats fell short of the whole bench's quorum,
a block every reachable seat anchored in the original was left unresolved:
it skipped its naturalness read
and carried a finding naming the whole bench's quorum as the number required.
The archive's own text ships either way,
so the defect cost evidence rather than wording.

Two sentences claimed what a short bench cannot do.
The seat reader's wait line said it waits "rather than seating a bench that cannot settle",
and its function's TSDoc said the same;
the run client contract said "a phase that settles on nobody"
and named `run-seats.ts`,
from which the reading had moved to `run-seats-read.ts`.
Since the short-bench rule,
a short bench decides on a share of the seats a wet provider serves,
or is an outage below two of them.

#### Exposure

Under `~/temp/agent/`,
1,404 stored logs and JSON files name the stage,
which is the control that the store is live,
and 10 carry the review's uncorroborated-claim finding,
which is the control that its findings reach stored files.
5 carry the unresolved finding:
2 are test output
(`audit-tests/it-blocks.json`,
`gfp-20260902/anchor-test.log`),
and 3 are replays or a probe from 2026-09-10
whose benches heard 7 of 11 seats,
so at least 7 were reachable and the quorum stays 6 under the fix.
No stored file outside the test output carries the review's short-bench finding.
The defect was latent.

#### The fix

One `reachableQuorum` is computed from `gather.unreachable` before the outage test,
and both the outage test and the participation threshold read it.
The wait line now says "rather than seating a bench short of its quorum",
the TSDoc says when a bench the phase leans on would sit short of its quorum,
and the contract names `run-seats-read.ts` and `pass-reseat-hook.ts`
and says what a short bench decides.
Red `dd6d22874`,
fix `a3c83b333`,
boundary case `b968cbdc6`.

#### Mutants and caches

The red case seats eight reviewers with five refused,
asserts from the exported helpers that the reachable seats fall below the whole bench's quorum
and meet the reachable share,
and asserts the review gather recorded the short bench.
The mutation batch (`b27-mutants.json`) caught ignoring the refusals,
but a boundary mutant turning the threshold's `<` into `<=` survived:
no case held anchored voices exactly at the quorum.
The boundary case has exactly the first quorum's worth of reviewers anchor,
and the rerun caught both mutants,
with the comment control surviving both times.
The archive block review keeps no cache (B26),
and the seat reader's line is a log.
The full suite passed on `b968cbdc6` with no failing case.

### B28: sheets missing a block their role needs (B21, family six)

Status:
fixed,
2026-09-29.
The full suite passed on `b01129566`,
the entry's last commit,
with no failing case among 1347 passing groups.
The census rendered every model-facing sheet the rendered-sheets fixtures build (38)
and asked which shared blocks each carries
(`~/temp/agent/f6-sheets/`:
`constants.ts` over every exported string constant of 80 characters or more,
`shared-lines.ts` over every line of 60 or more on two sheets or more,
grouped by the sheets carrying it,
and `context-presence.ts` over the fixture's identity and reference lines).
The fixture decides what context a builder is given,
so every gap a parameterized block showed was traced to the production caller before it counted.

#### Roles

Writers write English that may ship:
the translate writer,
the consolidation writer,
the editor,
the refiner,
the translate repair turn,
and the archive block review,
whose reviewers write replacement text.
Wording judges choose among wordings:
the lane contest,
both gates,
and every selection slate,
the typed decision included.
Claim judges file or weigh claims against a rendering:
the critic,
the panel,
the resolution judge,
coverage,
the rendering audit,
the naturalness review,
and the introduced-defect probe.
The page-title lexicon writes the English every passage uses for a title the original names,
under the house rules.
Readers extract or align and write nothing that ships:
the picture readers,
reference attestation and its confirmation,
and section and block pairing.
The restoration judge and the derivability probe are measurement probes.

#### Findings fixed

- The archive block review lists the apparatus kinds without the shared narrative bound
  (`NARRATIVE_DETAIL_IS_NOT_APPARATUS`);
  its own sentence names biography,
  events and dialogue,
  and leaves out a method,
  a time,
  a cause and a characterization.
  S5's fix put the bound on every sheet that files,
  votes on or writes against the archive.
- The introduced-defect probe excuses dropped wording as page apparatus without the bound,
  the misreading the bound was written to stop (class one hundred eight).
- The archive block review and its correction slate carry neither the declared names nor the cited references,
  though both exist when `pass-prepare.ts` calls `repairArchiveBlocks`
  (the reference context is built before the call,
  and the declared-name lines are passed to preparation beside it).
  The review judges archive wording against the original,
  which `slice-context.md` says every such sheet does with the references beside it,
  and the house rules it carries tell it to read a pronoun line and footnote vocabulary in a DECLARED NAMES block it never sees.
  Of 381 stored run logs under `~/temp/agent/` in which the review ran,
  95 are entries citing at least one reference,
  and 73 of those reached a correction slate,
  the path on which a detail a cited page states could be removed.
  The review's outcome findings reach stored files too rarely
  (2 files hold any)
  to count what the slates chose.
- Coverage finds "a fact,
  a name,
  a number" of a Chinese passage in the English
  without the declared names its house rules point to,
  so a passage anchored mainly by a declared name can read as uncovered.
  Preparation holds the identity where `pass-insertion-admission.ts` calls the stage.
- The page-title lexicon writes shipped title renderings under house rules that say to use vocabulary a note line in the DECLARED NAMES block establishes,
  and to give a work its official English title,
  and gets no such block:
  it runs before preparation,
  which built the identity lines inline,
  so the web lookups bought for the works the original names never reached it.
  No stored production run records a lexicon round:
  the 27 files under `~/temp/agent/` that log one are this audit's own full-suite logs,
  and no slice-cache file has been written since the lexicon's cache version was set.
- The refine slates carry the house rules and none of the declared names,
  though `refine-stage.ts` holds them and hands them to the refiner,
  which is told a handle survives exactly:
  the judges choosing among its rewrites could prefer one that respells a declared handle or changes a declared pronoun.
  This one was read as sound in the first pass of this entry,
  which checked the refine slates for the apparatus bound only.
- The rendered-sheets fixtures rendered 13 of their 38 sheets naming the DECLARED NAMES block without it:
  the editor,
  the translate and repair slates,
  the typed decision and the rendering audit,
  which production gives the names,
  the three refine slates,
  which it did not,
  and the house rules and the restoration judge,
  which rightly carry none.
  A guard reading the rendered sheets could not tell a sheet that lacks the block from one the fixture left bare,
  which is how the coverage,
  lexicon and refine gaps went unseen.

The narrative bound:
red `f8f5ec907`
(every rendered sheet listing the kinds carries the bound),
fix `678b1d725`.
The archive review's editorial-context line now states the shared bound,
keeping its own sentence for biography and quoted dialogue,
and the probe's apparatus excuse carries the bound after it.
The probe runs inside the repair and refine slice caches,
so both key files record the change riding inside versions 34 and 5:
no slice-cache file was written after 04:27 UTC on 2026-09-27,
where a control from midnight that day finds 494.

The declared names and references:
red `590a98921`,
fix `06c6d22ad`.
`pass-prepare.ts` passes both through `repairArchiveBlocks` to the review,
whose sheet,
correction slate and naturalness read now carry them;
the slate's first criterion removes a claim supported neither by the original nor by a page it cites,
since earlier criteria outrank later ones.
A retention may anchor in one cited page's own text
(`isArchiveReferenceQuoteAnchored`,
the source anchor's fold and minimum);
`referencePageTexts` in `reference-line-head.ts` cuts each line's head and address
and skips the attested lines,
each of which quotes the archive back,
and the lookup's failure notes,
whose wording the lookup now writes from constants in the same module.
The mutation batch (`b28-mutants.json`,
fourteen mutants over the anchor,
the page reader,
every thread,
the criterion and both bounds)
caught all fourteen,
and its comment control survived.
The full suite passed on `06c6d22ad` with no failing case.

Coverage:
red `1176f4584`,
fix `628d8ff53`.
`pass-insertion-admission.ts` passes the identity preparation holds to the coverage stage,
whose sheet carries it as a DECLARED NAMES block ahead of the passage,
with the shared declared-identity rules and one line saying a name the English writes in its declared form states the name the passage writes.
The coverage probe and control keep asking without it:
they measure the sheet over seeded passages.

The page-title lexicon:
red `2516419a4`,
fix `7bf2db51a`.
`page-identity-lines.ts` assembles the identity lines in one place,
which preparation reads,
and so does the preparation pass for the lexicon,
with every context line but the lexicon's own:
the work-title lookups and the names other entries declare.
The lexicon sheet shows them with the declared-identity rules,
its cache key hashes the identity it showed,
and the page-title cache version's account records why the change rides inside version 1.

The three sheets' role lines,
the one line each adds after the shared declared-identity rules,
became named constants in `355aaf84f`,
matching the literals they replaced character for character,
so a case can require a line without copying its wording.
A mutation batch over the coverage and lexicon threads
(`b28-coverage-lexicon-mutants.json`,
23 mutants)
caught 15,
and the comment control survived with 7 real survivors:
the follow-up coverage sheet without the rules,
both sheets choosing a fence without the identity,
both role lines dropped,
the lexicon's identity without other entries' names or read off the original in place of the archive,
and the shared assembly without its notes or its pronoun line.
`d37228134` added a case aimed at each,
with `sheet-fence.test-fixture.ts` reading the fence a sheet opened a block with,
so the fence cases need not ask `selectFence` for the answer,
and cases on the archive review's role line and fence,
which the first batch never mutated.
The rerun
(`b28-survivor-mutants.json`,
15 mutants:
those 7,
the archive review's role line and both of its fence inputs,
and three more parts of the assembly and its order)
caught all 15,
and its comment control survived.

The refine slates:
red `d24ba1401`,
fix `02adee08f`.
`buildRefineSelectionContext` takes the identity and shows it in every mode,
ahead of the references,
and the stage passes it.
The entry comes from `declared-names-evidence.ts`,
the repair slates' labelled entry moved out of `repair-selection-evidence.ts`
(a probe over the built index finds the shared label equal to the repair literal it replaced),
which the archive correction slate now reads in place of the bare heading,
since its criteria never mention names.
The refine key already hashes the identity,
and refine version 5's account records the change riding inside it.
The mutation batch
(`b28-refine-mutants.json`,
7 mutants:
the stage's thread,
the names in the context,
the correction mode without them,
the shared entry returning nothing,
and the repair,
archive and translate slates without the names)
caught all 7,
the translate slate's on a rerun after its pattern was corrected for the move's indent,
and its comment control survived.

The fixture and a guard:
`8aaedecf5` moves the translate slate's evidence assembly unchanged into `translateSlateEvidence`
(the 78 lines at the previous commit,
dedented,
equal the new function's array body),
and `a271f6f8a` renders every sheet with the context production gives it:
the repair and translate slates and the typed decision through the evidence functions production calls,
and the editor,
the rendering audit and the refine slates with what their callers pass.
`rendered-sheets-context.unit.test.ts` then requires every rendered sheet naming the DECLARED NAMES block to carry the fixture's names,
and every sheet naming CITED REFERENCES the fixture's references,
with the house rules and the restoration judge exempt by name and reason,
and a case failing on a stale exemption.
With the editor's context taken out of the fixture,
the guard names the editor;
the fixture restored,
it passes.

The cache-account audit
(`mise run cache-account-audit`)
reports every source commit since the seven versions were set riding inside all seven,
the archive review and coverage changes among them,
since no slice-cache file has been written since.

#### Read and left as they are

The editor and the resolution judge act on issues the critic and panel classed,
and both of those carry the kinds and the bound.
The refiner and the refine slates judge against the current text,
where dropping a gloss is "dropped",
so the apparatus bound adds nothing there;
what the refine slates lacked was the declared names,
fixed in `02adee08f`.
The translate slates label the names with the bare heading,
since their own criteria state the declared-name rules
(`translate-selection-sheet.ts`).
Production passes the translate slates,
the repair slates and the editor the declared names and references,
and the rendering audit the declared names
(`translate-judge.ts`,
`editor-ensemble.ts`,
`repair-editor-stage.ts`,
`corpus-run/rendering-audit-settled-buy.ts`);
the first pass of this entry cited `rendering-audit.ts` for the last,
which passes whatever subject its caller builds.
The readers,
the attestation and the pairing sheets carry no house rules,
and write nothing that ships.

### B29: silent fallbacks (B21, family seven)

Status:
fixed,
2026-09-29,
with one gap left open and named under its own heading.
The full suite passed on `e396ceb67`,
the entry's last commit touching source,
with no failing case among 1355 passing groups.

A silent fallback is a value the code supplies where the caller held a real one:
a parameter default read as "none",
a caught error turned into nothing,
a nullish fallback substituting another text.
The census read all three,
and the permissive gate defaults and string accumulators found beside them.

#### Census

Parameter defaults:
`~/temp/agent/f7-fallbacks/default-census.ts`
(esbuild and acorn over the package's non-test source)
found 144 functions whose destructured first parameter defaults a key,
and listed every call leaving one out.
Most are test seams
(a transport,
a clock,
a poll interval)
that production never passes.
The floor-inputs prototype
(`floor-scan-probe.ts`,
over the package's own oxc parse,
which keeps the types)
then read defaulted and optional keys alike:
89 functions let a caller leave out an input that decides what a floor refuses or what a sheet shows,
over 162 calls.

Caught errors:
`catch-census.ts` read 142 catch clauses;
15 neither log nor rethrow,
and 14 of those return or record the caught error for their caller.
One dropped it
(`openrouter-chunk-scan.ts`).

Nullish fallbacks:
623 `??` uses,
101 substituting something other than a literal.
Read one by one,
they are sentinels,
map lookups,
the documented seating fallback
(no fresh reading leaves the roster the driver was given standing,
`repair-checker-reseat.ts`,
`standingSeating`),
and text fallbacks each commented at its line
(the archive's front-matter shape,
else the source's,
for a new insertion;
the first rendering an answer was seen under).
None is silent.

Gate defaults:
12 gate parameters default to the permissive answer
(`eligible`,
`incumbentEligible` twice,
`standingValid`,
`standingMayShip` four times,
`standingEligible` twice,
`choiceMayShip` twice).
Every production call states them;
only the judging-window trial,
a measurement file,
leaves `incumbentEligible` out.

#### Findings fixed

- Reference attestation decided on a lone voice:
  the extraction's votes-needed was `rosterQuorumSize` of the voices heard,
  which is one when one is heard,
  and a confirmation hearing one voice confirmed alone,
  against `MIN_STAGE_VOICES`
  (no stage is decided by a single model).
  Red `7d28373e7`,
  fix `e903f4a15`:
  `attestationVotesNeeded` floors the count at `MIN_STAGE_VOICES`,
  and a confirmation hearing fewer keeps the extraction's details with a warning and a finding.
  Over the stored rounds
  (944 extractions,
  205 confirmations)
  none heard exactly one voice,
  and the attestation keeps no cache
  (`corpus-run/pass-attest-references.ts`).
- The final polish dropped the slice's disputed wordings:
  `applyFinalPolish` held them on its subject and never passed them,
  so a polish landing on one,
  in all but whitespace,
  shipped past the standing verdict,
  the lane offer and the producers' floor that had each refused it.
  Red `907572336`,
  fix `6df19b319`,
  riding inside consolidation version 20.
- The chunk's checker check left the refiners out,
  though its TSDoc said it refused a checker who refines
  and the other three callers pass them;
  and the bench read again at the checker stage was read for quorum alone,
  so a re-seat naming this chunk's editor would have had it grade its own rewrite.
  Red `645b60fbc`,
  fix `6c9e948e2`
  (`assertBenchAgainstWriters`).
  Neither reached a run:
  `corpus-run/run-seats.ts` asserts every derived bench against the static editors and refiners.
- Two writers' sheets displayed candidates without their break counts,
  which `renderedBreakPrompt` defaults to none:
  the consolidation writer,
  shown both lanes' texts,
  and the translate follow-up writer,
  shown the candidates the judges declined;
  the gates,
  the lane contest and the slate judges pass theirs.
  Red `b34848d40`,
  fix `0335bd489`,
  riding inside consolidation version 20 and translate version 15.
- The translate producer left `pageText` to its default;
  the value was the same,
  and `e97c46e88` states it,
  matching the floor after the repair turn.
- Three names were exported by two files each
  (`settleTranslateSlice`,
  `withoutComments` under one signature for two comment grammars,
  `wordsOf`),
  which conflated the census's first read and names two functions alike in every `fn.name` logger tag.
  Red `f51407716`
  (`exported-function-names.unit.test.ts`),
  fix `c9e78d56b`.
- `whitespaceTokensOf` and `handleReading` grew strings a character at a time,
  the accumulator rebuild RG2 in `AGENTS.md` rules out for text.
  Pinned `c360b4c01`,
  rewritten `13adce419` to slice by index.
- `openRouterChunksOf` swallowed a parse error with `void error`,
  the only such line;
  `07d4a4504` reads the failure as data through `parseModelJson`.

#### The guard

`628404247` adds `floor-inputs-stated.unit.test.ts`,
and `39e61d6d0` extends its key set to the gate flags
(the corrective comment on that commit fixes its count of them to twelve).
It fails on a production call leaving a floor input or gate flag out,
unless the call is named with its reason
or sits in a named measurement file.
Nine calls are named:
the dispute note,
which reads no stand-in eligibility;
three lane-contest eligibility calls,
since front matter carries no dispute
(`0bf3305ba` pins that the repair lane raises no issue there)
and the contest verdict decides only persistence and the log,
while the consolidation re-reads every contested standing against the disputed wordings;
the seeded-error benchmark twice;
the library entry,
which takes no cited references;
the artifact rebuild,
which re-carves recorded slices;
and the translate slice's stage input,
whose literal states all seven inputs it forwards.
Fourteen measurement files are named as files.

The mutation batch
(`b29-mutants.json`,
15 mutants over every fix and both guards)
caught 13.
The two survivors were gaps in cases written this day:
a negative assertion that searched for a label the empty lane never carries,
and an astral case that exercised the other branch's offset.
`c0738cda9` closes both,
and a rerun caught each.

`fba7ec063` adds two more scans,
so the catch and accumulator rules are not left to review:
`caught-errors-kept.unit.test.ts` fails on a catch clause that binds nothing,
discards its error with `void`,
or neither logs,
rethrows nor names it;
`text-accumulators.unit.test.ts` fails on a `let` begun as text and grown inside a loop,
with `roman` in `corpus-run/ordinal-style.ts` named,
since it reads a fixed table.
Three mutants
(`b29-guard-mutants.json`)
were each caught.

The one unreadable call the scan names rests on a literal it cannot read,
`translateSliceInput`'s returned stage input.
A batch dropping each of that literal's seven inputs
(`b29-stage-input-mutants.json`)
caught four
(the identity,
the dispute note,
the disputed wordings,
the pictures)
and left the cited references,
the attested lines and the declared names unpinned.
`709c0d3d4` adds a case reading all three off the stage input,
a rerun caught each,
and `1aa472e32` names the pinning tests in the exemption's reason.

The cache-account audit
(`mise run cache-account-audit`)
reports every source commit since the seven versions were set riding inside all seven,
this entry's among them,
since no slice-cache file has been written since:
386 source commits since the oldest of the seven was set
(refine version 5,
`30e66051e`),
60 of them named by an account.

#### The rendering audit's cited references

The settled rendering audit showed its auditors the declared names the producers had
and not the cited references
(`corpus-run/rendering-audit-settled-input.ts`),
which by that module's own reasoning lets an auditor mark a reference-backed rendering wrong.
Artifacts record no references,
so the audit reads them the way the pass does.
Red `45ef57b2e`,
fix `4b02cff72`:

- The audit sheet carries the references in a fenced block
  under `CITED_REFERENCE_AUDIT_RULE`,
  its own wording rather than the critics' copy,
  which names a TRANSLATION the audit never shows
  and an accuracy/addition label its wire rejects.
  The rule names the CANDIDATE and the unsupported-addition category,
  says a CANDIDATE leaving out what only a reference states has omitted nothing,
  and keeps reader protection above the references.
  A page linking nowhere gets no block,
  so its sheet reads as audits did before.
- Every subject carries its whole page original,
  and `withCitedReferences` reads each bought page once
  through `RUN_OUTSIDE_READS.references`,
  the reader the pass uses,
  and reads nothing when nothing is bought.
  The reader is required,
  so no unit test can fall back on the environment's key (ledger X19).
- `auditOne` takes the references as a required input,
  records `referencesKind`,
  and keys `textIdentity` on a references digest
  that is absent when none were shown,
  so a row shown none keys exactly as the rows written before this,
  all of which were shown none.
- The references are a tagged value,
  `SettledReferences`:
  `cited` with the lines,
  `none` where the page links nowhere,
  or `unread` with the count of links
  where the page links pages and the read returned nothing,
  which `citedReferenceBlock` does for every linked page when no key is set.
  The first version recorded both empties as `none`,
  the silent fallback this entry is about,
  which a review of the fix caught.
  Red `37c4adbe6`,
  fix `e396ceb67`:
  `withCitedReferences` tells the two apart by the page's own links
  (`citedReferenceUrlsOf`)
  and warns on an unread page,
  and an unread row keys as one shown none,
  since it was shown the same texts.
  A batch of 5 mutants
  (`b29-refs-unread-mutants.json`)
  caught all 5.
- The attested lines are not shown,
  a quality call recorded here and open to veto:
  they name archive details,
  and the CANDIDATE under audit is often a fresh rendering.

Exposure,
measured by `b29-audit-refs-exposure.ts`
through the pass's own `citedReferenceUrlsOf`:
34 of the 92 originals at the run pin link at least one page the reader would read,
67 links in all;
in the settled archive,
`zheermao101` links one page in both run sets,
and `Aniloviraw` links none.

The mutation batch
(`b29-audit-refs-mutants.json`,
13 mutants over the sheet block,
its fence and rule,
the row's references,
kind and digest,
the per-page read and pairing,
the subject and the input module)
caught all 13.

Beside it,
the audit sheet showed DECLARED NAMES over an empty fence
when handed an empty identity string,
unlike the references block;
no caller passes one.
Red `a174c5d66`,
fix `2beaca02f`.

#### Open

- A Han character beyond the first plane that pinyin-pro cannot read passes through the handle reading as written.
  No pinned original or stored artifact carries one
  (ledger B21's census).

#### Fallbacks T8's coverage found unreachable

T8's batches read each cold nullish fallback for reachability before writing a case,
and remove the ones no input reaches,
since one would substitute a value silently the day an invariant broke.
Each is replaced by code that has no such branch,
or by `nonNullishOrThrow` where the type needs narrowing,
so a broken invariant throws.

- `placeTally` read an unloaded bundle's sources with `?? []`;
  `requireMapFor` refuses every unloaded bundle with no map first
  (`5e27208c7`).
- `parseNaturalnessConfirmations` fell back to `-1` for a confirmation's round position
  and read a missing decisive round as a different roster;
  each confirmation is now matched to its round in one step that refuses a confirmation matching none
  (`a564eccc7`).
