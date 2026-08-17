# Handover: the lane outcome vocabulary and what is mid-flight

Written 2026-08-16 because the user's machine is stuttering and a hard reboot would otherwise lose the state.
Updated after every step from here rather than at the end.
Companion to `doc/planning/two-lane-corpus-pass.md`, which holds the design record;
this file holds the WORKING STATE.

Worktree: `/var/home/user/worktrees/translation-repair`, branch `translation-repair-rebased`.
All commands below assume it, not the main worktree.

## The one sentence

Every defect in this stretch is the same shape:
**an absence recorded as a deliberate choice**,
and the fix is always to give the absence its own name rather than let it borrow a decision's.

## Standing instruction: `no-non-null-assertion` names the wrong fix

**From the user, 2026-08-16.**
`oxlint`'s `typescript(no-non-null-assertion)` prints help text suggesting optional chaining
(`x?.y` in place of `x!.y`). Do not follow it.
The fix in this repo is `nonNullishOrThrow` from `@monochromatic-dev/module-or-throw/ts`,
added as a `workspace:*` dependency where a package does not already carry one;
`translation-repair` already does (`package/module/translation-repair/package.json:23`).

The suggestion is not merely stylistically off, it changes what the code MEANS:
`x!.y` throws where the value is missing and `x?.y` yields `undefined`,
so following the help text turns a loud failure into a silent one,
which is the defect class this whole session exists to close.
The repo's own configuration already states the intent
(`package/config/oxlint/src/rule/restriction.ts:214`: "Ban non-null assertion (!): use nonNullishOrThrow instead").

Per the user, the message documented the correct fix not long before, so this reads as a REGRESSION
in wording rather than as a rule anyone re-decided.
What is measured so far: the help text (`Consider using the optional chain operator ...`) appears
nowhere in this repository outside `node_modules`, so it is emitted by oxlint's built-in
`typescript/no-non-null-assertion` rather than by any config or plugin here,
while the correct fix IS documented on this side, in
`package/config/oxlint/src/rule/restriction.ts:214` and
`package/oxlint-plugin/no-restricted-syntax/README.md` (lines 60, 139, 204).
The cause is NOT established beyond that: no oxlint source has been read for it.
Do not attribute it to the oxlint maintainers and do not file anything upstream on this evidence.
Tracked for the user to fix properly in `#442`.

## Standing instruction: fixtures are cat-themed invention, and adapting is not inventing

**From the user, 2026-08-17**, on a fixture I wrote for the rendering audit:
"Ensure everything is cat-themed. Cats don't hand over letters to Li Ming by hand."

The fixture in question was not corpus content, and that was checked rather than assumed: `git grep`
against the corpus clone at the pinned commit (`~/one-among-us/data`, `a41fc607`) reports zero files
for `没有离开`, `三封信`, `在窗台上`, `第二天把三封信`, `她没有离开`, `睡了一整天`, and zero for the
English side (`gave three letters`, `the windowsill`, `slept on the windowsill`).
The single hit anywhere was `交给了`, an ordinary verb phrase, in an unrelated sentence.
Nothing had been committed either: the file was untracked when the question was asked.

WHAT WAS ACTUALLY WRONG is worth keeping, because it is subtler than a licensing slip.
The sentence was ADAPTED from the fixture written into task `#85` by an earlier review, with the
place and person swapped, rather than invented here.
An inherited skeleton is weaker than the standard even when it carries no corpus text, and it is how
a non-cat example survives three rewrites.
Write fixtures; do not adapt them.

THE CHECK IS CHEAP, so run it rather than reasoning about it: `git grep --fixed-strings --count` for
each distinctive span in the corpus clone, before a fixture is committed and before one is sent to
any model.

WHERE CORPUS TEXT MAY GO, unchanged: to the production provider, which is ZDR and retains no
content. Not into the repository, and not into any other external tool. The sol reviews in this
handover were four source files with no corpus content and no fixtures beyond what those files hold.

## Landed, pushed, safe

-   `92539977f` read the unreached slice on the axis that separates it (test).
-   `494723d8d` pin the stage that heard nobody, and the rules around it (tests + barrel exports).
    Exports added: `LaneSliceOutcome`, `DecisionComparison`, `translateLaneWordings`.
-   `d14a06bca` pin the gap verdict, the decision axis, and the blocked run's shipped index (tests).

All three were shown to fail without their guards before being trusted (GFP), by stripping the
guard, rebuilding, running, and restoring with `git checkout --`.
The strip scripts are in the scratchpad as `unheard.mjs` and `ungap.mjs`.

## The vocabulary change landed

`c2779c737`, the whole thing as one commit,
because the coherence rule cannot land without the repair-exit fix:
`buildSliceDelivery` asserts coherence, and the repair lane would otherwise throw at every anchor.
Full suite green, lint clean, types clean.

New files it added:

-   `src/wording-coherence.ts`, the cross-axis rule, plus `src/wording-coherence.unit.test.ts`.
-   `src/lane-slice-sets.ts`, the five checks every named index list has to pass, shared by all three lists.
-   `src/lane-slice-coverage-error.ts`, the error class moved out so the builder and the set checks can share it
    without importing each other.
-   `src/repair-lane-wordings.ts`, the repair lane's adapter, mirroring `translate-lane-wordings.ts`.

Two existing tests moved with it, and neither was weakened:
the pairwise contradiction message is now one message for any two lists,
and the delivery fixture's anchor became `not-applicable` where it used to be `decided ''`.

## The decision taken while the user was away

**A fifth outcome member, `not-applicable`.**
Adopted rather than asked, because the evidence determines one answer (QGR);
recorded here and in the planning doc so it can be reversed on sight.

The repair lane skips a passage the archive never translated:
it mends existing English and there is none.
`notApplicableRepair` returns `repairedText: ''`,
and `repair-assemble.ts` fed every outcome to the builder as a DECISION,
so the lane reported "I decided the empty string here" at every gap in the archive.
`compareDecisions` then read that against a translate lane that actually filled the passage
and reported `{ kind: 'comparable', verdict: 'different' }`:
a row asserting the two lanes chose different wordings where one of them never had an opinion.

Both reviewers ranked the options A > B > C independently and for the same reason:

-   **A, the fifth member.** Chosen.
-   **B, report anchors as `unfilled`.** Rejected: `unfilled` means the lane tried and produced nothing,
    which is a rate worth measuring, and folding these in would make the repair lane's decline rate
    equal the count of gaps in the archive, a constant of the document that measures nothing about the lane.
    `#105` wants exactly that rate.
-   **C, keep `decided ''`.** Rejected: it is the defect.

Mechanics, agreed by both reviewers and implemented:

-   Coherence requires `not-applicable` to sit at an `absent` incumbent, and refuses it at a `present` one.
-   `decideDelivery` needs no new member: a non-decision at an absent incumbent already returns `gap-remains`,
    and the shipped/withdrawn refusal already covers it.
-   `not-applicable` is a REACHED outcome, so the stopped-prefix rule still refuses it after a `not-evaluated`.
    The blocked exit therefore intersects anchors with the outcomes prefix:
    an anchor before the crossing is `not-applicable`, one after it stays `not-evaluated`.

## Also landed since

-   The consequence tests both reviewers asked for, and the blocked-exit intersection
    (an anchor before the crossing is `not-applicable`, one after it is `not-evaluated`).
    GFP run: reverting the classification fails both adapter tests, and restoring clears them.
-   What hearing nobody has to mean, which three readers already assumed and nothing checked:
    the record's text must be the archive's and it must claim no change,
    the resumed branch now discards an unheard cached record rather than trusting it,
    and the predicate is named once instead of spelled out in each reader.
    GFP run on that guard too.
-   The translate driver crossed the line cap on the way, so its assembly tail moved to
    `translate-assemble.ts` and the refusal sentences to `translate-alignment-refusals.ts`,
    mirroring the repair lane's split on the same seam. The cap was never raised.

## The preparation identity landed

`preparation-identity.ts`, with eight tests and a GFP run.
It names a slicing and nothing about the run, so a resumed pass over the same slicing gets the same name
however the commit, cache state or roster differed.
Fields are length prefixed rather than delimited, because slice text is arbitrary document content
and can hold any separator anyone might pick.
The brand is built through `assertPreparationIdentity`, which is also what a version 2 reader
will use on a value read back from disk.

Stripping the target placement kind fails the blank-content-versus-anchor case;
stripping the whole-document texts fails the difference-outside-every-slice case.
Both restored, suite green.

## The comparison moved onto the ledger

The last of the reviewer's ship blockers. It took each lane's wordings and its shipped index set,
and read absence from that set as the archive being retained,
so a changed decision left out of the set compared as a deliberate keep:
the same defect the outcome union was split to end, in the one place that reports on both lanes.

It now takes the two delivery ledgers `runDocumentLanes` already builds,
which have already refused a decided slice that is neither shipped, withdrawn nor blocked.
The result carries the preparation identity, so rows cannot be persisted without the slicing that numbers them.
Nothing called the comparison yet, so no production caller had to change; its tests were rewritten to the new boundary.

Three guards from the vocabulary commit were also pinned and GFP'd:
the incumbent-kind disagreement at EQUAL empty text,
the withdrawal by assembly on a run that never assembled,
and the two coherence assertions at the comparison's call sites.

Two corrections landed on top: a fourth spelling of hearing nobody in the extracted assembler,
and the identity framing only the target's slice index while the source's was equal by assumption.

## A note on stripping guards while the trial runs

Measured, not assumed: the window trial is ONE long-lived process (started 12:51),
its bundle contains zero dynamic imports, and nothing restarts it,
so every module was resolved at startup and rebuilding `dist` cannot reach it.
That is why the GFP strips here were safe.
If the trial is ever restarted, or a bundle gains a dynamic import, that reasoning expires:
strip in a throwaway worktree instead.

## The ledger boundary was strengthened again after a second review

Each ledger now carries the slicing it was built over, rather than one identity passed beside both:
two ledgers loaded from different artifacts of one entry line up perfectly and number different passages,
and that is the pair the comparison exists to refuse.
It also checks that both ledgers agree about which slice sits at each POSITION,
about each slice's ORIGINAL as well as its archive wording,
and that every row survives the four-case delivery rule (`delivery-coherence.ts`, eight tests).
A record reaching the comparison is a structural type, not proof the ledger builder made it.

The version 2 parser contract is written up in the planning doc under
"What the version 2 parser must require, and what it may tolerate".
Read that before writing the parser rather than re-deriving it.

## The version 2 artifact landed

Three files under `src/corpus-run/`:
`artifact-v2-contract.ts` (the shape), `artifact-v2-vocabulary.ts` (the frozen dispatch unions),
and `artifact-v2-build.ts` (the builder), with six tests.

Both lanes nest and neither is at the top level.
The builder takes only what cannot be computed from the run:
the identity comes off the preparation and the whole comparison off the two ledgers,
so neither can be supplied wrong.
`laneSelection` states `pending-human-decision` rather than leaving the winner absent.

The frozen unions are worth knowing about:
they are copies of the live ones, and the copying is deliberate.
The builder assigns live values into them, so a live union that gains a member the snapshot does not list
STOPS COMPILING there, and the next person meets the version question as a build error
rather than as an artifact that quietly means something new.

`ArtifactJsonValue` deliberately excludes JSON's `null`:
it is absence spelled as a value, which is what this whole generation exists to stop recording.

## Two holes in the version 2 builder, found by review and closed

Both were the session's own defect class at the newest boundary, and both are
now committed (`b2478473d`, tests strengthened in `da426b2a2`).

**The identity binding was forgeable.** The builder computed one identity from
`prepared` and stamped it onto BOTH ledgers before comparing them, so the
comparison's unequal-identity refusal could never fire there: what it proved was
that the two ledgers agree with each other, and two ledgers built over some
other slicing agree with each other perfectly.

The identity is now stamped by `runDocumentLanes`, which is the only place
holding the preparation and the rows at once, so `DocumentLanesResult` carries
two `IdentifiedDeliveryLedger`s rather than two bare row arrays. The builder
recomputes what the name should be, refuses a ledger whose own name disagrees,
then checks the four per-slice facts a row carries over from preparation,
because an equal name is a hash claim and the rows are what every join uses. It
also checks each raw result's slice count, which no ledger check can see: a
structurally valid driver result could pair one lane's result with the other's
rows.

**The freeze was half a freeze, and the comment claimed the whole thing.**
Assignment into the frozen types fails when a live union gains a MEMBER. It does
not fail when a live record gains a FIELD: excess property checking applies to
object literals, so the wider object assigns cleanly and `JSON.stringify` writes
the new field into every artifact, which the version 2 parser then refuses for
carrying keys the schema does not name. Every row is now rebuilt through object
literals in `artifact-v2-project.ts`.

Worth keeping straight, because the correction has its own limit: the projection
does not make a new live FIELD fail compilation either, it simply leaves the
field out. What it buys is that the bytes stay what the schema says. An exact
-shape type test would turn field growth into a build error too; that is the gap
to close if an omitted field ever turns out to have mattered.

## The corpus pass now settles from both lanes

`04c6d85cf` wired it, `592c06512` tested it.
`settleEntry` prepares the document once and calls `runDocumentLanes`,
so the two documents differ by lane rather than by two runs of the aligner,
and writes the version 2 artifact.
One deadline covers both lanes, still armed before either cache opens,
and `throwIfAborted()` runs after the driver returns rather than between the lanes.

No slice budget is passed, and that was checked rather than assumed:
`prepareDocumentPair` defaults to the same `SLICE_CHAR_BUDGET`
that `repairTranslation` passed down when it prepared the document itself,
so entries settled either side of this change are sliced identically.
The reviewer's warning that calling preparation directly bypasses a default was wrong on this repo.

The TALLY line was rebuilt rather than transplanted (`settled-tally.ts`, five tests).
Top-level `status` is the pass's own state,
every lane measurement carries its lane in the key,
and `selection=` says out loud that nobody has picked a winner.
Nothing in the repo parses TALLY lines, checked with `rg`, so no consumer moved with it.

`callConfig` was checked rather than assumed to still describe the run it labels,
now that a whole second lane runs under it.
`RunCallConfig` carries only call TIMING (`perCallTimeoutMs`, `streamFirstByteMs`, `streamIdleMs`),
which is transport-level and identical for both lanes,
and roster identity rides on `pipelineDigest`:
that digest is taken over the emitted executable `.mjs` files (`pipeline-digest.ts`, `sha256-tree-v1`),
and the rosters live in `run-config.ts`, which compiles into one of them.
So two passes differing only in translate models get different pipeline digests.
Nothing to change; recorded so the question is not re-asked.

The abort window is the case worth knowing about:
a resumed entry buys nothing, so no exchange is left to notice a ceiling that has already fired,
and the lanes hand back two complete documents the run is not entitled to record.
The test settles once with a write that cannot land, which leaves the cache full rather than discarded,
then resumes under an aborted signal.
GFP: stripping `throwIfAborted` makes that case alone fail, writing the artifact anyway.

The cleanup-failure case landed too (`f0ea127c8`), after first probing whether it was injectable at all:
settle once with a write that cannot land so the cache survives,
make that cache directory read-only, then settle again.
Removal unlinks the entries INSIDE a directory, which needs write permission on the directory itself,
so the artifact lands and the discard cannot.
It reads what was PRINTED, keyed on an entry id no other case uses,
because the runner runs cases concurrently in one process and a capture keyed on nothing
collects whatever else was logging.
GFP: collapsing the `CLEANUP` line back into a `TALLY` fails it.
Full suite green after all of it.

## Found while testing it, and FIXED: the repair lane's unheard critics (`#112`)

Measured, with every one of 48 critic calls failing on a two-slice fixture:
the entry SETTLES, `repairStatus=unchanged`, `repairIssues=0`,
and the repair ledger reported **`decided` at every slice**
while the findings carried `stage-quorum-unmet (critic 0/6)` for each.

That is this session's defect class in the lane nobody audited for it.
`decided` means the lane produced a wording;
here no critic was ever heard, so the archive stands by default,
which is what `incumbent-fallback` exists to say.
As recorded, "critics examined this and found nothing" and "no critic answered"
were the same row.

Fixed in `repair-unheard.ts`, modelled on `translate-unheard.ts`:
`heardNobodyAbout` reads the pre-existing `heardCriticIds` and `refined` signals,
`assertUnheardKeptArchive` refuses a silent slice whose wording moved anyway,
and `repair-lane-wordings.ts` splits the unheard indices out before recording decisions.
Re-measured on the same fixture: every repair outcome now reads `incumbent-fallback`
and the decision comparison reads `not-comparable`, naming the repair lane.
The `pass-entry` lost-voices case asserts the outcomes, not just the findings.
The policy question of whether such an entry should settle AT ALL is still open in `#112`'s notes;
the misrecording is closed.

## The parser contract was corrected before the parser was written

A review of the CONTRACT itself, not of code, found five clauses wrong.
All five are corrected in the planning doc under
"What the version 2 parser must require, and what it may tolerate",
each saying what it replaces.
The short version:

-   "Every field is REQUIRED" contradicted the writer, which keeps raw lane results LIVE and additive
    on purpose. Version 2 needs a FROZEN EVIDENCE CORE naming the few raw fields a reader verifies,
    or the version means whatever today's TypeScript says.
-   Exactness follows SCHEMA OWNERSHIP, not nesting, which the old wording left to be inferred
    from a lane object holding a strict ledger and a tolerant raw result side by side.
-   The blocked status is NOT recomputable: a blocked run and an unblocked one produce the same ledger
    when no slice decided differently. The reader checks a compatibility matrix instead.
-   A standalone reader cannot re-prepare the texts, because the artifact stores none of the identity's
    inputs. Verification TAKES a preparation rather than claiming to build one.
-   Generic dispatch accepts an explicit version 1 rather than refusing a version it can read,
    and `readArtifactChangeSets` refuses version 2 explicitly, since it answers with one singular
    change set per artifact and version 2 has two lanes and no singular anything.

## The comparison rules are frozen now, which they were not

The sixth finding was a defect in shipped code, and it is fixed:
the vocabulary froze the WORDS a comparison row may use, and the RULES deciding a row
were still the live comparator's, which the builder called and projected.
A later change to how a verdict is decided would have reinterpreted every artifact on disk
under an unchanged version number.

`artifact-v2-comparison.ts` derives the persisted comparison from version 2 ROWS,
which is what a reader holding only the file can run.
The live comparator keeps refusing ledger pairs that cannot be compared at all.
The builder runs BOTH and refuses a disagreement,
so the day the live rules move, a corpus pass stops rather than writing artifacts
that quietly mean something new.

Two corrections landed on that module afterwards, both defects in code shipped the same day:

-   Row equality compared `JSON.stringify` on both sides while its own comment said key order
    did not matter. It passed only because both sides came from literals written in one order.
    The reader compares rows parsed OFF DISK, where the order is whatever the file has,
    so the exported function was a trap aimed at the parser that has to reuse it.
    Equality is now field by field over all eleven fields and into the unions,
    in `artifact-v2-row-equality.ts`, shared by writer and reader so the two cannot disagree
    about what agreement means. The key-order case carries a positive control:
    it asserts the reordered row's bytes actually differ, so it would fail against the old reading.
-   `compareLanesV2` did not cross-check `sourceText`, which the live comparator does refuse on.
    Harmless in the writer, where the live comparator runs first, but the READER runs only the
    frozen module, so a refusal missing there is a refusal the reader does not have.

`assertDerivationsAgree` is the one guard here with no strip demonstration, and it cannot have one:
both derivations live inside the builder, so no fixture reaching `buildSettledArtifactV2` from
outside can make them disagree. Its accept and refuse paths are both covered directly in
`artifact-v2-comparison.unit.test.ts`. Recorded rather than left unremarked, the same way the
`CLEANUP` capture's limits were.

## The version 2 parser landed, all eight steps

Written to the corrected contract, one commit per step, each with lint, types and its own tests green
before the next started.
What exists now:

-   `artifact-exact-guard.ts`: `requireExactKeys`, `requireOneOf`, `requireArtifactJsonValue`,
    `requireArtifactJsonRecord` (both refuse `null` at every depth), and `requireOpenRecord`, which
    accepts it. That pair IS the tolerance boundary.
-   `artifact-v2-read-contract.ts`: parsed types plus the frozen evidence core.
    Both lane statuses are literal copies rather than imports of the live unions.
-   `artifact-v2-read-vocabulary.ts` and `artifact-v2-read-rows.ts`: exact parsers for the three
    unions and the three rows. The tolerant row parser refuses a RESERVED field on the wrong member
    (`acceptedText` on an outcome that decided nothing) while tolerating unknown ones.
-   `artifact-v2-read-evidence.ts`: both lanes' tolerant evidence parsing, in ONE file rather than one
    each as the sketch had it, because they differ by three fields and share the index-list reading.
-   `artifact-v2-read-row-relations.ts`, `artifact-v2-read-set-relations.ts`,
    `artifact-v2-read-comparison.ts`: evidence against ledger BY POSITION, slice indices DISTINCT
    within a ledger, index sets against the rows that produce them, blocked COMPATIBILITY, per-row
    `assertWordingCoherent` and `assertDeliveryCoherent`, and the recorded comparison against
    `compareLanesV2`.

`assertSlicesDistinct` was added after the eight steps, from the adversarial list the task carried:
a ledger naming one slice twice passed every other relation, because all of them join BY POSITION.
Two rows both naming slice 5 agree with their own evidence, agree with the other lane, and still
match the prepared slice count, so the file described a document with one slice reported twice and
another missing and nothing said so.
It checks DISTINCT rather than ascending or contiguous: the writer renumbers slices by design
(`#100`), so a reader assuming `0` to `length - 1` would refuse a valid future artifact.
-   `artifact-v2-read.ts`: the orchestrator, `parseSettledArtifactV2`.
-   `artifact-read.ts`: dispatch only, returning a generation-discriminated reading;
    version 1 parsing moved to `artifact-v1-read.ts` keeping every exported name.
-   `artifact-v2-corpus-verify.ts`: `verifyArtifactV2AgainstPreparation`, taking a rebuilt preparation.

Verified at the boundary rather than only in fixtures: `settleEntry` wrote a real artifact into a
throwaway directory and the parser read it back, both lanes, recomputed comparison and all nine raw
repair fields intact (`scratchpad/probe-v2-roundtrip.mjs`).
Two facts fell out of the work and are now pinned by tests:

-   A LEGACY artifact is not version 1 with its version field removed.
    The slice count and the two index sets arrived WITH that field, so an artifact carrying them and
    no version is refused rather than read as older.
-   The scripted critic reply in the probes does not satisfy the wire contract, so those runs lose
    every voice (`stage-quorum-unmet (critic 0/6)`) and the repair outcomes read `incumbent-fallback`.
    That is `#112` working, not over-firing; do not read those probe outputs as a clean run.

## Next actions, in order

1.  ~~**The version 2 parser**~~, landed; see above.
    Original note kept for the shape of the requirement:
    `settleEntry` writes version 2 and `artifact-read.ts` read version 1 only.
    Read the CORRECTED contract in the planning doc rather than re-deriving it,
    and start from the file seams the review proposed:
    generic dispatch stays in `artifact-read.ts` and returns a generation-discriminated reading;
    version 1 parsing moves to its own file;
    version 2 gets a read contract (parsed types plus the frozen evidence core),
    exact parsers for the vocabulary, one tolerant parser per raw lane result,
    the relations (ledger against result, index sets, blocked compatibility,
    recorded comparison against derived), a top-level orchestrator,
    and a separate corpus verifier taking a supplied `PreparedDocumentPair`.
    The frozen comparison it needs already exists as `artifact-v2-comparison.ts`,
    with `artifact-v2-row-equality.ts` for the recorded-versus-derived check.
    Do NOT return `SettledArtifactV2`: its raw results are typed by live pipeline shapes,
    which is exactly what a historical reader must not depend on.

    BUILD ORDER, each step committed with its own tests, lint and types green before the next:

    1.  `artifact-exact-guard.ts`: `requireExactKeys`, the `callConfig` JSON value guard that
        refuses `null` recursively, and the open raw-result guard that ACCEPTS it.
        A sibling rather than more of `artifact-guard.ts`, which is already at 239 lines.
    2.  `artifact-v2-read-contract.ts`: the parsed types and the frozen evidence core.
        Core per `sliceTexts` row is `chunkIndex`, `incumbentKind`, `incumbentText`,
        `outcome.kind`, and `acceptedText` where decided.
        Lane evidence adds the counts and index sets each result already reports:
        repair carries `status`, `sliceCount`, `shippedChunkIndices`, `withdrawnChunkIndices`,
        `findings`; translate adds `changedSliceCount`, `refusedSliceCount`,
        `withdrawnSliceCount`, and its `status` of `complete` or `unfilled`.
    3.  `artifact-v2-read-vocabulary.ts`: exact parsers for outcome, delivery,
        decision comparison, ledger row, comparison row.
    4.  One tolerant evidence parser per lane, in its own file.
    5.  `artifact-v2-read-relations.ts`: evidence against ledger BY POSITION, index sets against
        the rows that would produce them, blocked compatibility, per-row `assertWordingCoherent`
        and `assertDeliveryCoherent`, recorded comparison against `compareLanesV2`.
    6.  `artifact-v2-read.ts`: top-level exact parse and orchestration.
    7.  Dispatch: version 1 parsing out of `artifact-read.ts` into `artifact-v1-read.ts`,
        `artifact-read.ts` left holding the four-case dispatch and returning the
        generation-discriminated reading.
    8.  `artifact-v2-corpus-verify.ts`, taking a supplied `PreparedDocumentPair`.
2.  ~~**The mixed-generation trap**~~, landed as `pass-schema-guard.ts` (`ed80db5cc`).
    Its premise was WRONG as first written here; the corrected account is kept below because it is
    what the guard was built to, and because the correction is the reusable part.
    `settledEntryIds` does read FILENAMES only (`pass-settled.ts`), so the scheduler
    skips an entry settled by any generation.
    What the note missed is that `corpus-pass.ts:232` already calls `assertResumableGeneration`
    (`pass-generation-guard.ts`) before anything is settled, and that guard refuses a directory
    whose artifacts record any pipeline digest but this build's.
    A build that writes version 1 cannot share a digest with one that writes version 2,
    since the digest is over BUILT OUTPUT, so the realistic trap is already refused
    with `GenerationDriftError` and a three-way remedy.
    What is genuinely uncovered is narrower:
    `TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT=yes` disarms the foreign-digest refusal,
    and its message promises that a rate over the pool stays usable if it names a required commit,
    which is true of build drift and false of SCHEMA drift, where half the files cannot answer
    the two-lane questions at all.
    Hand-assembled directories reach the same place without the opt-in.
    The precedent for the fix is in that guard's own comment:
    drift is applied to the foreign-digest check ALONE because unplaceable and legacy artifacts
    are different problems with different remedies "neither of which drift is an opinion about".
    Schema version is a third such problem.
    Re-running skipped entries still costs real money, so the guard REFUSES and names the ways
    forward rather than deciding anything.
    Found while checking that guard, and FIXED: the version 1 constant was named
    `SETTLED_ARTIFACT_SCHEMA_VERSION` and documented as "Schema generation the pass writes today",
    while `pass-entry.ts:249` writes 2.
    It is `ARTIFACT_SCHEMA_VERSION_V1` now, beside `ARTIFACT_SCHEMA_VERSION_V2`,
    so the guard importing what the pass writes cannot pick up the wrong one (`262526dcb`).

    What landed: `assertResumableSchemaGeneration` and `censusBySchema`, called from
    `corpus-pass.ts` immediately after `assertResumableGeneration`, refusing any settled artifact
    whose generation is not the one this pass writes.
    Not overridable, by the sibling guard's own rule.
    Three answers count as foreign: another version, no version field at all
    (the 2026-08-15 generation, which records a digest and so is neither unplaceable nor legacy),
    and a version this build cannot read.
    Verified at the user boundary rather than only in fixtures:
    the real `corpus-pass -- --plan` against a throwaway runs directory holding one version 1
    artifact refuses with `SchemaGenerationError` naming `schema version 1: 1 settled, CatEntry1`,
    and the same driver against a fresh directory still plans 92 entries.
    Both runs spent zero quota; plan mode makes no model call and the refusal precedes scheduling.
3.  ~~The discriminated `unrecorded` reading collapsing back into an absent optional property~~,
    landed as `b8cdd5eba`.
    It was in `artifact-v1-read.ts` rather than in `artifact-read.ts`:
    `ParsedAcceptedIssue.repair` is now the `RecordRepairReading` itself.
    The collapse survives in exactly one place, `draw-entry-load.ts`, where a grading candidate is
    built for the SAMPLE FILE; that file's shape is on disk in draws a human is grading, so widening
    it is a persisted-format change rather than a reader change, and it is left to whoever decides
    to make it.
    Suite after: exit 0, 348 passing groups.

`buildSettledArtifact` (version 1) has lost its last production caller and stays:
readers still parse version 1 artifacts, and the corpus directory holds them.

## The invariants review is fully closed (`#103`)

Its three remaining items were re-read rather than trusted, and two were already built:

-   The translate lane already enforces what hearing nobody means, at `translate-document.ts:367`,
    before the record is kept.
-   The resumed branch already refuses an unheard cached record.
    It was untested and its finding was the only one written as a bare sentence while its siblings
    carry a tag, so a build that started refusing every cached slice would have read as a run with no
    cache. Now `translate-discarded-unheard-slice chunk N; ...`, pinned by a driver test shown to
    fail with the branch stripped (`112295ed2`).
-   The `unrecorded` collapse, fixed and described in the next-actions item 3 above.

## A GFP trap worth knowing about in the translate driver (`#95` closed)

`#95`'s last open nuance, the unconditional `settledByKey.set`, was already fixed in code when
re-read: the memoization sits inside the persist branch, so an unheard record is not reused by an
in-run twin. It had no test, and the first test written for it was WRONG in a way that passed.

A CALL COUNT DOES NOT SEPARATE THE TWO BEHAVIOURS. The resume branch refuses an unheard record
whatever put it there, so an unconditionally memoized twin costs two questions exactly like a
non-memoized one. Asserting the call count passed with the memoization moved out of the persist
branch, which is what the GFP run showed and what saved the case from being a guard that guards
nothing.

What differs is whether the second twin ever MEETS a record it has to discard, so the case asserts
an empty `translate-discarded-unheard-slice` finding list instead (`9d399f763`, corrected in
`9dde08ed7`).
Two protections stacked this way will hide each other from any instrument that reads only the cost.

## An independent review of both guards, and what it changed

Ran through `sol` on the two guard files plus the two reader relations files, with the context it
could not see stated in the prompt.
It found one defect in code landed the same night, and three more worth acting on.
All four are fixed (`7e7738b6d`, `ae52ca975`):

-   **Distinctness was the wrong invariant.** Every relation in the version 2 reader joins BY
    POSITION, so a ledger naming slice 1 then slice 0 agrees with its own permuted evidence, with the
    other lane under the same permutation, and with the slice count, while every consumer zipping
    rows against the preparation reads each row against the wrong slice. The reasoning that chose
    distinctness (the writer renumbers, so do not assume `0` to `length - 1`) is sound and does not
    reach that far: renumbering produces GAPS, and gaps are still increasing. Now strictly
    increasing, measured on `prepareDocumentPair` first.
-   **A label is not a shape.** The schema guard read `artifactSchemaVersion` and never the body, so
    a version 1 artifact relabelled as version 2 passed it, was skipped by the scheduler, and failed
    only in whichever reader asked it a two-lane question. Every artifact declaring the generation
    this pass writes is now parsed with that generation's reader.
-   **The census was keyed by its own prose**, so three unversioned generations collapsed into one
    phrase and a corrupt file collapsed with a sound artifact of an unreadable generation, which is
    how a refusal could tell an operator to preserve a corrupt file.
-   **The refusal order offered a remedy that does not work**: the build guard ran first, told the
    operator to set the drift opt-in, and the schema guard then refused anyway while the run logged
    a resume that never happened. Split into what nothing can override, then the shape, then the
    overridable build check. Verified at the boundary.

NOT ACTED ON, and recorded so it is not re-derived: sol also notes there is no directory-wide
snapshot, so a concurrent writer publishing a version 1 artifact between the census and the
scheduler still produces a mixed directory. The runs directory already takes an exclusive lock
(`lockRunsDir`), which covers our own passes; a foreign writer is out of scope of that lock and
would need one shared with it.

## What the rendering audit is for, and the design decisions inside it (`#85`)

The absent-baseline instrument the translate lane needs, since a slice rendered from scratch has no
BEFORE text for the differential probe to compare against.
It sits BESIDE the introduced-defect probe rather than replacing it: the repair lane still has a
baseline and `#66` still measures the old instrument.
The file inventory and the measured behaviour live under "The audit is rebuilt, run live, and
measured"; this section keeps only the reasoning that survived the rebuild, so it is not
re-litigated.

Three decisions inside it are worth not re-litigating:

-   **Each category proves itself from the side it CAN.** An omission has nothing in the candidate to
    quote, its absence being the claim, so a symmetric rule would make the likeliest defect of a
    from-scratch rendering unprovable. An unsupported addition is the mirror. Everything that changes
    something both sides state must quote both.
-   **The archive is irrelevant by construction, not by instruction.** A source quote is searched in
    the original and nowhere else, so a claim resting on another translation's wording anchors
    nowhere and is dropped. The prompt says so too; the prompt is not what enforces it.
-   **Corroboration counts VOICES, not claims**, threshold two rather than a majority: the first
    question is whether a defect is there, and a majority over six would discard a defect four of
    them missed. The rows keep the counts, so a stricter rule can be applied to an existing run.

STILL WIRED TO NOTHING: no lane calls it, and where it should run is Question 8, which is the
user's to answer. Measured, though, on its own fixtures.

The second of those three decisions is now stated too strongly, and the code has been left as it is
while the wording is corrected: nothing in the anchoring makes a voice reason independently of an
archive it may have seen elsewhere, and the `reason` field is not screened at all. What is true is
narrower and still worth having: the archive is not serialized into the prompt, and archive wording
cannot serve as an anchor. That is data-flow exclusion at the caller, not a property enforced by
quote anchoring.

## The audit is rebuilt, run live, and measured (`#85`)

Both arms ran on 2026-08-17, three times, through `mise run
//package/module/translation-repair:audit-sensitivity`.

THE CONTROL IS CLEAN, in every run: three auditors, three verdicts of `no-defect-found`, zero
claims, zero corroborated, zero near misses. Nothing was invented about a faithful rendering.

THE POSITIVE ARM FINDS THE PLANTED DEFECT, also in every run. The auditors are not the weak part:
they located a dropped negator, named it `altered-polarity`, and anchored it.

WHAT THE ARMS EXPOSED is the matcher, and only because the arm reports three measurements rather
than one count. Run by run, on the same fixture and the same roster:

-   Three voices, three oracle hits, no dropped claims, ONE corroborated defect, three near misses.
-   Three voices, three oracle hits, no dropped claims, ZERO corroborated defects. All three named
    `altered-polarity`; they quoted `不吃`, `吃` and `不吃罐头`. Unanimous agreement, reported as
    nothing.
-   Three voices, two oracle hits, one claim dropped as `unanchored-locator (source)`, zero
    corroborated, one agreed group of two voices.

Which span a voice picks is not stable between runs, so a count keyed on exact spans is a coin flip.
That is why the report now carries a SECOND TIER, `agreed`, beside the strict `corroborated`: it
groups claims of one category whose focus spans overlap, pairwise throughout, so two claims about
different words of one sentence never join and a wide claim touching two narrow ones pairs with each
rather than forming a trio. Both counts are reported; neither is folded into the other.

READ BOTH, and read the per-voice rows under them. The strict count is the conservative fact; the
second is the useful one; the oracle hits and the drop list say which component to blame when they
disagree.

## What the review found before any of that ran, kept because the reasoning still applies

An adversarial review of the three audit files on 2026-08-17 returned a NO-GO for the live arms,
and it was right.
The matcher cannot distinguish agreement on ONE DEFECT from agreement on ONE SENTENCE:

-   FALSE SPLIT, which was already suspected: `defectKey` demands both evidence strings match
    exactly, so two voices quoting different-width spans of the same dropped negation do not
    corroborate, and neither do two voices calling it `omission` and `altered-polarity`.
-   FALSE MERGE, which was not suspected and is worse: the quote floors (12 Latin characters, 4 CJK)
    FORCE a voice to pad a short trigger with context, since `not`, `three` and a three-character
    Chinese negation all fail the floor. Two DISTINCT defects in one sentence then arrive as the
    same padded quote under the same category, and are reported as one twice-confirmed defect. The
    floors cause the defect they were meant to prevent.

Had the positive arm run first it would have failed, and the failure would have been unattributable
between the auditors, the anchoring and the matcher.

The rebuild separates a LOCATOR span, which identifies one occurrence uniquely, from a FOCUS span,
which carries the alleged change and need only be unique inside its locator, keeps document offsets
for both, and corroborates on the focus interval rather than on the text a voice typed.
`#85` carries the full scope, including the one review finding deliberately not adopted (schema
enums for verdict and category, which would turn vocabulary noncompliance into voice loss) and why.

Two things the review predicted arrived exactly as described, which is worth recording because it
says what that kind of review is worth: the false merge it found was real and unsuspected, and the
false split it warned would spoil the positive arm did spoil it, twice, before the second tier
existed. One thing it recommended was not taken and should stay untaken: schema enums.

WHAT WAS NOT REBUILT, and is recorded rather than done, because each needs a decision or more than
one fixture to settle:

-   Cross-category agreement. Two voices naming one span `altered-polarity` and `omission` are
    reported as a near miss and counted as neither. Deciding whether they agree is a question about
    the taxonomy, and the precedence rule in the prompt is the current attempt to prevent it arising.
-   `broken-structure` still requires both sides. The review argued for splitting it; the precedence
    rule routes the one-sided cases to `omission` and `unsupported-addition` instead, which answers
    the objection by definition rather than by adding categories. Untested against a real structural
    defect.
-   `identityContext` is never anchored. An `altered-identity` claim resting on licensed evidence
    cannot point at that evidence, only at the two texts.

## The post-trial run queue, decided in advance

THE GATE HAS LIFTED. The window trial finished 2026-08-16T23:58Z, all 327 arms, zero refusals.
Its result is in `doc/planning/translation-repair-window-trial.md`: widening the judge's context did
not move selection, and in the larger reading the effect is SMALLER than the run-to-run noise band.
The negative control also measured something nobody asked for, and it constrains items 2 and 4
below: the per-slice preserve-or-replace decision is about 19 percent unstable between identical
runs, so no single pass settles a per-slice question. Recorded on `#105` and `#108`.

THE WHOLE QUEUE IS NOW HANDLED, as of 2026-08-16. Item 1 ran, item 2 was answered from the trial
ledger without building the bench, item 3 was answered and its trade corrected, and item 4 is
RUNNING; see "The two-lane cost run, launched 2026-08-16" for where to find it.
Nothing in the queue is waiting on a user answer.

What is left on the audit is not a measurement but a decision, and it is the user's: the instrument
is WIRED TO NOTHING. Whether it runs per slice inside the translate lane, or standalone over settled
version 2 artifacts, changes what it costs and what it can be compared against, and neither is
obviously right. Recorded as Question 8 in `doc/planning/translation-repair-open-decisions.md`, with
options, a ranking and the reason for each step of it.
The user has confirmed quota is not a constraint (near full, regenerating, one reset in hand), so
nothing below is held back for cost; what held them back was the trial's validity, since every one
of these calls the same six models.

1.  ~~**The two live arms of the rendering audit (`#85`)**~~ DONE, three runs of each arm; the
    polarity-flip fixture and the control that must not fire. They were the GFP for the whole
    instrument, and they earned their keep: the strict matcher missed a unanimous defect, which is
    why a second tier exists.
2.  ~~**`#105`'s decline-rate bench**~~ DONE, and the bench was never built: the window trial's
    ledger already held 327 real judgings under the production roster, which is better evidence than
    a synthetic bench and cost nothing. Decline rate 0.171 overall, but 0.063 on a full panel against
    0.287 on a panel of five and 0.692 on a panel of four, so declines are mostly VOICE LOSS rather
    than passages. Retrying the same slate decided 21 of 37 declines. Only 8 slices of 109 declined
    under both identical judgings. `#105` carries it; the policy decision is still the user's.
3.  ~~**The coverage rerun question (`#106`)**~~ ANSWERED, in
    `doc/planning/coverage-wire-rerun-trade.md`, and the trade recorded here was stated backwards.
    Ranked A > C > B > D: MEASURE the false-CARRIED rate first over the UNCHANGED wire, rather than
    change the wire or do nothing. The correction is that a false CARRIED is what a permissive
    evidence rule manufactures, so the block-scale null of ninety-six answers with no vote for
    absence is the measurement MOST exposed to the defect, and it is the one question 28 leans on
    against landing four. Section-scale verdicts are comparatively safe, since absence findings are
    not what the defect produces. Correspondence cannot be scored over the existing runs at all: the
    probe writes to stdout and nothing persists it. Not started, and must not start while `#114`
    holds the roster.
4.  **A few two-lane entries end to end**, to read the real per-entry cost against `HARD_CAP_MINUTES`
    of 180 before any full pass. `#92` measured the lane from bench calls; nothing has yet run both
    lanes over one document under the cap. LAUNCHED 2026-08-16, see "The two-lane cost run".

## The two-lane cost run, launched 2026-08-16

WHERE IT IS, so a killed session can find it without this transcript:

-   Runs directory, throwaway and outside the repo:
    `~/temp/agent/two-lane-cost.l9Fpgk6V`
-   Combined stdout and stderr:
    `~/temp/agent/two-lane-cost.l9Fpgk6V/two-lane-cost.log`
-   Command, from the `translation-repair` worktree:
    `TRANSLATION_REPAIR_RUNS_DIR=<that dir> mise run
    //package/module/translation-repair:corpus-pass -- --only
    Aniloviraw,zheermao101,aiyysk,XingZ60`
-   Code identity, from the run's OWN `START` line rather than from this document:
    `tip=e79bb338 pipeline=sha256-tree-v1:e327ca8b`. The tip is the run-record commit, one later than
    the `4fed9d7bd` the plan check ran at, and the PIPELINE HASH IS THE SAME in both, so the delta
    is documentation and the code is unchanged. Read the hash, not the tip: only one of them
    describes what actually ran.

WHICH ENTRIES, AND WHY THOSE. Sizes are `page.md` blob bytes at corpus pin
`a41fc607ea5a70d8a7625cc67d5ed8c444f53379`, over 92 pending entries whose distribution is
min 120, q1 1481, median 2323, q3 4557, max 41720:

-   `Aniloviraw`, 1481 bytes, the first quartile.
-   `zheermao101`, 2323 bytes, the median.
-   `aiyysk`, 21455 bytes, second largest, the clean large point.
-   `XingZ60`, 41720 bytes, the largest by a factor of two, so the worst case the cap must survive.
    It is also `#71`'s pathological alignment entry, so it doubles as a full-scale check of that fix.

WHAT IT IS FOR, and what it cannot answer. Per-entry wall time against the 180 minute cap, the cost
split between the two lanes, and the voice-loss rate under the current roster. NOT per-slice
verdicts: the window trial's negative control measured the preserve-or-replace decision as about 19
percent unstable between identical runs, so nothing per-slice from a single pass is evidence.

HOW TO READ IT. Each entry logs one `TALLY <id> status=... ms=<durationMs>` line, and `durationMs`
also lands in the entry's artifact, so cost is readable from the log or the runs directory. An entry
that aborts at the cap is a RESULT, not a failed run; the soft budget is 72 hours and absorbs it.

NOTHING IS DECIDED BY THIS RUN. Whether to widen the deadline for `hf:zai-org/GLM-5.2`, seat a
replacement, or accept the voice loss is a user bullet on `#105`, and the run was deliberately
launched under the CURRENT roster and deadline so it reports that configuration as it stands.

## The cost run finished, and a seven hour cap clears the corpus (`#114`)

DONE 2026-08-17, written up in `doc/audit/two-lane-entry-cost.md`. The sweep listed under
"What is owed the moment the cost run exits" HAS BEEN RUN and is clear: lint 0 warnings 0 errors,
types clean, 359 test groups passing. That section is kept as the record of why it was deferred.

READ THE AUDIT RATHER THAN THIS SUMMARY IF THE CAP IS THE QUESTION. The first reading of this run
was wrong by about a factor of three on how many entries the cap stops, and the audit records both
the corrected numbers and the wrong ones under "What the first reading got wrong".

TWO OF FOUR ENTRIES NEVER FINISHED. `XingZ60` (41720 bytes) and `aiyysk` (21455) each ran the full
three hours and produced no artifact; `zheermao101` (2323) settled in 65.3 minutes and `Aniloviraw`
(1481) in 35.4. Seven and a half hours bought two artifacts, six of those hours buying nothing.

NEITHER ABORT WAS CLOSE TO HOPELESS, which is the fact the first reading missed. The aborted
entries KEEP their slice caches, so file counts and mtimes recover per-slice timing directly:
`aiyysk` had settled 73 of its 80 slices and `XingZ60` 55 of 83, both in the repair lane, at 2.47
and 3.19 minutes per slice. Whole-entry cost is therefore about 4.7 and 6.4 hours, not the 10 and
19.5 the per-byte extrapolation predicted.

COST IS SUBLINEAR IN SIZE: `cost_minutes = 0.2585 * bytes^0.694`, fitting all four entries within 16
percent. Per-byte cost FALLS threefold from the smallest entry to the largest, so a rate taken from
small entries badly over-prices large ones. That single error produced every wrong number.

A FULL PASS COSTS 119 to 128 HOURS. At the current cap 4 to 6 entries abort, wasting 12 to 18 hours.
AT A SEVEN HOUR CAP NONE ABORT, for about 8 hours more in total, because an aborting entry is
already paid for in full and thrown away. The budget conclusion survives unchanged: a full pass does
not fit the 72 hour soft budget at any cap.

SET ANY CAP WITH MARGIN. `XingZ60` projects at 385 minutes, so exactly 420 leaves 35 minutes inside
a fit whose residuals reach 16 percent and whose largest input is itself a projection. Eight hours
rather than seven, or set it after the queue lands and the rate is re-measured, which `#114` already
says is the better order.

THE CACHE DOES NOT SPAN A REBUILD, verified rather than assumed. `slice-cache-namespace.ts:463`
resumes only when `cached === generation` and `:470` discards otherwise, and the two surviving caches
hold 128 slices stamped `sha256-tree-v1:e327ca8b` while the current build digests to
`sha256-tree-v1:d8507690`. About 6 hours of paid work was orphaned by the sweep that followed the
run. Any plan that lets an entry span runs has to answer that first.

RECOVERED FOR FREE: `XingZ60` confirmed the `#71` and `#74` alignment fix at full scale before it
aborted, because preparation runs before the lanes. The log reports `12 chunk pairs, 83 slices, 4
alignment findings`, exactly what `doc/decision/translation-repair-unpairable-section.md` predicted.

THE SWEEP FOUND SOMETHING TOO, and it is worth knowing the telemetry cost a file split: the eight
lines of timing pushed `repair-translation.ts` to 301 lines, so `repairTranslation` now lives in
`repair-entry.ts` (`c2a16470a`). The boundary is real rather than convenient: one half takes two
documents and decides how to slice them, the other takes slices already decided.

## What is owed the moment the cost run exits

DO THIS FIRST, BEFORE READING THE RUN, because it is the half that is not yet verified.

`2ff6228d9` added per-slice cost telemetry (`slice-cost-log.ts`, `slice-cost-read.ts`) and its unit
tests import from `dist/`, which the cost run is reading. Building would have swapped code under a
live multi-hour run, so the build and the full sweep were deferred on purpose:

1.  `mise run //package/module/translation-repair:build`
2.  `mise run //package/module/translation-repair:test:unit`
3.  `mise run //package/module/translation-repair:lint`
4.  `mise run //package/module/translation-repair:lint:types`

WHAT WAS ALREADY VERIFIED, so this is a sweep rather than an unknown: the source modules were
exercised directly with node, outside `dist`, and every assertion held. The round trip between
writer and reader, the early-exit path where a lane leaves a slice by `continue`, a mixed log with
unrelated lines, and all three refusals (half-written line, unknown lane, non-integer measurement).
What the sweep adds is the built artifact, the lint rules and the types.

NOTHING ELSE MAY RUN `mise` IN THIS PACKAGE UNTIL THE RUN EXITS. `lint:types` runs `tsc --build`
and `build` writes `dist/` outright; `test:unit` reads `dist/` and would test the wrong code.

THE DECIDED WORK THAT FOLLOWS THE SWEEP, in order, all of it now unblocked:

1.  THE VOICE LOSS, first because everything else is measured through it. 135 of 327 judgings lost at
    least one voice of six, dominated by `hf:zai-org/GLM-5.2` abandoned 60000 ms after quorum. Widen
    that deadline or seat a replacement, then re-measure the decline rate.

    ITS SEQUENCING PRECONDITION IS MET: the cost run has reported, so a change here no longer
    invalidates a run in flight. The old cache is already orphaned by the sweep's rebuild, so moving
    the digest again costs nothing.

    ONE CONSTRAINT THE COST RUN ADDS, which discriminates widen from replace: widening the deadline
    adds wall time per call on a pipeline where `XingZ60` already projects at 6.4 hours against a 3
    hour cap. Widening pushes the wrong way on the number just measured. `roster-bench` and
    `model-health` exist to vet a replacement instead. Not pre-decided here, but weigh it against
    that number rather than in isolation.

2.  `#105`'s retry policy: retry a declining slate ONCE against the same panel, then record what
    still declines as `no-candidate-backed`. The delivery vocabulary already says WHERE such a slice
    lands, so this is a reason rather than a new kind: with an incumbent it stays
    `incumbent-retained`, without one it stays `gap-remains`.
3.  `#74` and `#98`, the aligner, now foundational rather than optional: 85 of 92 entries never reach
    the matcher because equal section counts skip it, so the population every section-scale
    measurement was drawn from is itself an artifact of the aligner. Re-run the section census after.
4.  SECTION-SCALE insertion, with the heading defect fixed, over the population that then reaches the
    matcher. When a source section's counterpart is a heading with no body, the body belongs UNDER
    that heading; landing it as designed would have produced eight duplicate headings on `XIEPT2`.
    PARAGRAPH-SCALE insertion is REFUSED on the evidence and is not part of this.
5.  The rendering audit, standalone over EVERY settled version 2 artifact rather than a sample. A
    census has no sampling error and can settle questions about particular entries. Nothing in the
    producing path changes, so an instrument whose production error rate is still unmeasured cannot
    reach what ships, and it can be re-run against those same artifacts when the instrument changes.
6.  Persisting `coverage-probe` output into the runs directory rather than stdout only. This is the
    one piece of the parked coverage work that survives on its own account, being the reason its
    2026-08-16 numbers exist nowhere but a transcript.

NONE OF IT BEFORE THE SWEEP. Every item is code, and there is already one unverified change in the
tree; three would compound into a sweep that cannot say which change broke what.

ONE KNOWN GAP TO CLOSE IN THE SAME SITTING: CLOSED 2026-08-17 (`3309ffff8`). A `SLICE-COST` line
could not say WHY a slice was cheap. Both lanes leave a slice early on a cache hit and on an
insertion chunk, and both emitted a row near zero milliseconds at any size, which on a RESUMED pass
would have scattered near-zero points across every size band and flattened the very slope the line
exists to show.

Every line now carries `exit=`, one of `computed`, `resumed`, `no-translation` or `unfilled`.
Ordinary completion is the default and needs no call, so the common path cannot be forgotten; the
other three name themselves before leaving, which the disposable cannot infer once scope has ended.
The reader REQUIRES the field rather than treating it as optional, because the telemetry landed
after the only pass that has run, so no production log carries the older shape.

THE MIRROR HOLE WAS FOUND AND CLOSED IN THE SAME SITTING (`dab4c6946`): `using` fires dispose on
THROW, so a slice killed by the entry deadline was logging `exit=computed` with near-cap
milliseconds, which is one poisoned row per aborted entry sitting inside the very population the
field exists to keep clean, passing an `exit=computed` filter. There is now an `aborted` exit, READ
FROM THE SIGNAL at dispose rather than named at each throw site: a slice can throw from the abort
check, from the stages, or from an assertion after them, and `Symbol.dispose` is not told which. A
named exit still wins, since a cache hit bought nothing either way. Both lanes now pass `signal`.

BOTH GUARDS WERE GFP'D, each committed before its strip.

-   The round trip, which its own header calls the only thing keeping writer and reader agreed about
    a shape neither owns: the writer's `sourceChars=` was renamed to `sourceCharacters=`, rebuilt,
    and the suite exited 1 with that case failing by name and the reader reporting `sourceChars
    missing`.
-   The abort exit: the signal check was replaced with a bare `taken.exit`, rebuilt, and the suite
    exited 1 with the cut-slice case failing by name.

Restored in both cases, and the suite passes.

THEN READ THE RUN, and only then: the `TALLY <id> status=... ms=` lines against the 180 minute cap,
the cost split between lanes, the voice-loss rate, and `XingZ60` as the full-scale check of `#71`'s
alignment fix. The `6/6 heard` critic line already in the log is one stage of one entry and is not
a rate; report what the whole run measures.

THE COST TELEMETRY DOES NOT APPLY TO THIS RUN. It was added after launch, so the run in flight
emits no `SLICE-COST` lines. This run answers the ENTRY-scale slope, over four entries spanning 28
times in size; the next run answers the per-slice question in `#92`.

DO NOT RUN THE COVERAGE MEASUREMENT. Option A of `doc/planning/coverage-wire-rerun-trade.md` exists
to say how much of the BLOCK-scale null to believe, and block-scale insertion is refused, so it
informs no decision that remains open. Section-scale insertion does not need it: the instrument was
eleven of eleven correct there, and its false-CARRIED weakness suppresses insertion rather than
causing it. The trade note stays as the record of why.

ONE PIECE OF IT SURVIVES ON ITS OWN ACCOUNT: persisting probe output into the runs directory rather
than stdout only. That is why the 2026-08-16 coverage numbers survive nowhere but a transcript, and
it is worth doing whatever happens to insertion.

THE FOUR DECISIONS, taken on the best-quality guideline and recorded with their reasoning in
`doc/decision/translation-repair-four-answers.md`. They were first put to the owner as option sets;
the owner answered and then WITHDREW the answers, because three of the four sets were priced on cost
and cost is not a constraint here, so they were decided on quality instead. Two came out differently
from what the owner clicked, and both differences are flagged in that file for a cheap veto:

-   The rendering audit runs standalone over EVERY settled artifact, not a sample. A census has no
    sampling error and can settle questions about particular entries; the sample won its earlier
    place on price alone.
-   Declines get one retry AND the voice loss gets fixed. These were offered as alternatives, which
    was the error: the retry treats the symptom and the deadline treats the cause.
-   Insertion splits in two. PARAGRAPH scale is refused on the evidence. SECTION scale is real and
    gets landed, but AFTER `#74` and `#98`, because 85 of 92 entries never reach the matcher and
    every section-scale number was drawn from the 7 that do.
-   The window trial is dropped, unchanged, and this one was decided on its merits rather than its
    price: a fourth arm would refine a measurement whose practical action is the same either way.

## The launch gate has lifted

The trial finished at 2026-08-16T23:58Z after 25622 seconds, so the reason for holding the corpus
pass is gone: nothing else is competing for the same six models.

What the trial cost in voices is worth carrying into whatever runs next, because it is the honest
rate for this roster and this deadline: 135 of 327 judgings lost at least one voice of six, a rate
of 0.413, dominated by `hf:zai-org/GLM-5.2` abandoned 60000 ms after quorum. Panels that seat six
and hear four still decide, and the trial's strict reading threw two thirds of its slices away on
that account.

A pass launched now should either widen the deadline for that model, seat a replacement, or accept
that a two-thirds strict-population loss is the price of the current configuration.

One plan-mode pass ran against a throwaway runs directory to check the wiring at the
user boundary: `PLAN ok`, 92 pending entries, zero quota. That exercises the scheduler
and stops before any entry settles, which is why `settleEntry` has its own tests.
