# Audit ledger: what each sheet shows

Sheets that lacked a block their role needs to judge or write.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B28: sheets missing a block their role needs (B21, family six)

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

### Roles

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

### Findings fixed

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

### Read and left as they are

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

## B283: the `issues-absent` arm of `probe-relabel` sent the production disclosure with an empty list

Fixed in `abb506b7b`,
with its case,
which the agent ran red in its worktree.

Found by the move B282 records.
The arm that claims no issue list is known sent the production disclosure with an empty list,
which under a rendered disclosure writes the heading for a list into the prompt.

The fix:
it sends the withheld disclosure.
Production's setting is withheld today,
so today's output is unchanged.

Recurrence:
`mistake-prevention.md`,
"What each sheet is shown".

## B419: no judge was shown which wordings narrate an ended life in the present tense

Red `a1f98e76d4`,
fixed in `afeac61dbb`.

Found on 2026-10-11 (UTC) in the read of TianqiChen66622,
which shipped the archive's present-tense narration of its subject
because the judges left the archive standing.
The census of that day over the 92 pinned archive pages
labelled 80 of 536 detector hits by hand:
about 68% precision when traits of the person count,
about 24% when only narrated acts count.
A detector that weak cannot refuse a wording or mark a text flawed,
so the owner chose to show its hits to the judges as candidates.

The fix:
`present-tense-candidates.ts`,
with the readings it stands on
(`present-tense-text.ts`,
`present-tense-words.ts`,
`present-tense-vocabulary.ts`),
returns each candidate with its sentence,
matched words and rule,
skips quotations,
blockquotes,
headings,
code and HTML through the shared slice grammar,
and reads nothing where the entry records no death.
The subject is every name the translation declares,
the front matter `name` and each alias in `info.alias`
(`subject-names.ts`;
a comma-joined string or a list),
the longest tried first.
`corpus-run/entry-info-record.ts` reads `people/<id>/info.yml` at the pin;
`identity-context.ts` reads `died` by the rule every identity field follows,
a bare year included,
and the identity block every stage reads names the date.
The lane contest,
the translate slate,
the consolidation slate,
its run-off over the tied finalists
and the consolidation gate
print a labelled tense block for each text with a candidate
(`tense-candidate-block.ts`,
each sentence written as a JSON string);
no verdict,
flawed-archive count or run-off reads it.
Artifact generation 15 records the candidates for the audit trail,
on a contest slice (`lane-contest-tense.ts`)
and,
for the wording that shipped,
on a consolidation slice (`consolidate-shipped-tense.ts`);
the readers refuse the key in generation 14 and earlier,
on a `sole-lane` slice,
which asks no judge,
and on a consolidation slice that ships no wording of its own.
Replays tell the death only for a generation 15 artifact,
whose models saw it,
so an earlier artifact replays with the block its models saw.
No cache version moved:
each affected stage's run shape names the death and the subject names,
so an entry that records a death asks a new question under a new key,
and the three pinned-key witnesses keep their strings.

The port onto the branch head found a defect in the first draft:
its reader allowed the key from generation 14,
while the generation 15 `sole-lane` path (B425) returned before the key was read,
and its writer wrote the key on every slice,
so a sole-lane record would have been read with the key dropped.
The writer now skips a sole-lane slice and the reader refuses the key there.
The same port first logged an absent `info.yml` to standard output in two built commands whose terminal output is pinned;
the replays now record an absence in silence.

Decided by the owner on 2026-10-11 (UTC):
every model sees the death date;
the record holds candidates on contest and consolidation slices;
the subject names are the front matter `name` and its declared aliases.
Decided by the lead under the owner's instruction of the same day:
generation 15 alone;
no cache version bump;
a bare year counts as a recorded death;
the replay readers take the death date,
`corpus-run/page-republish.ts` included,
whose page never depends on the identity block
but whose pass already fails on a damaged `info.yml` at prepare.

## B442: the window trial judged on sheets with no death and no tense block

Red `a08a6634b7`,
fixed in `62a07ceeb9`.

`runSliceArms` called `judgeTranslateSlate` with no ended life,
and `drawEntry` prepared the pair with no `sourceEntryInfo` and never read `info.yml`,
so the instrument measured sheets the pass does not ask.
`drawEntry` now reads the entry's `info.yml` after both pages
and returns the page facts of its preparation,
which `runWindowTrial`,
`runPick` and `runSliceArms` pass on as a required parameter;
the judges get all of them,
and the translators the identity block,
as the pass gives them.
`TRIAL_PROTOCOL_VERSION` is 2,
so a ledger bought on the older sheets is not resumed;
the trial reads no slice cache.

## B445: the consistency judges were not shown the tense candidates of a life that has ended

Red `54d53e8b46`,
fixed in `d4736ccb6c`.

The consistency judges choose one rendering and carry it to every place,
yet their sheet showed no tense candidate when the entry records a death.
The sheet now prints the labelled tense block of the English of each slice it shows,
once per slice under the first place's label,
built by the same `tenseCandidateGroups` and `tenseCandidateLines` the other sheets use
(`consistency-tense.ts`),
inside the fence the sheet chooses against all its texts.
`consistencyKey` adds the death flag and the subject names only when the entry records a death,
so every other key keeps its bytes,
and `CONSISTENCY_CACHE_VERSION` stays 1,
since no pass has run at it.
