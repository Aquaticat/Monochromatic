# Translation repair history 2026-08-24 to 2026-08-25: work parked while a calibration held the build, and its landing

The verification command that stopped reading an empty runs directory as a green run,
the combined build and test of all parked items,
the naming of the two-lane artifact family,
the landing rehearsed on a throwaway worktree,
and the documentation of the three report commands with the collision recheck.

Part of [Translation repair history: 2026-08-24 to 2026-08-25](translation-repair-history-2026-08-24-to-25.md),
which lists every file of this record.

Historical evidence only:
no next-action list here is a current instruction,
and the stop condition in the index applies.

## `#217` is built, GFP-proven and parked (2026-08-25)

Built in the fork worktree `/var/home/user/worktrees/verify-empty`,
checked out at `e8430d094`,
because the change edits `src/` and the calibration's slice cache is keyed on the pipeline digest.
It cannot be committed from there:
that worktree has no `node_modules/.bin/git`,
so the policy wrapper is absent.
It is parked as `~/temp/agent/verify-empty-217-218.tar.gz`,
which carries `#218` as well,
and is applied over the main worktree in the landing sequence.
The tarball was checked against the main worktree before parking:
all six modified files are byte-identical to the fork's base commit,
and all three new files are absent there,
so it applies without clobbering anything.

### What was wrong

`namesUnder` answered an absent directory with an empty array and printed the absence with `console.error`.
Stdout therefore read `verify-published: matched=0 settledWithNoPage=0 pageWithNoArtifact=0`,
then `verify-published: 0 of 0 pages carry every wording their artifact promised`,
and `process.exitCode` stayed 0.
An empty runs directory and a run whose every page agreed produced the same report and the same exit code,
so a mistyped `TRANSLATION_REPAIR_RUNS_DIR` read as a green run.

`errorName` compounded it.
It answers `error.name`,
which is `Error` for every filesystem failure,
so a directory that was never created and one at mode 000 printed the same `(Error)`.

### What landed

Absence became a kind rather than an empty list,
in two new modules.

-   `src/corpus-run/directory-listing.ts` holds `DirectoryReading`,
    `namesIn` and `filesystemReason`.
    `filesystemReason` reads `error.code`,
    so the report says `ENOENT` or `ENOTDIR` instead of `Error`.
-   `src/corpus-run/published-tree-listing.ts` holds `settledEntryIds`,
    `publishedEntryIds`
    and the verdict `whatThereIsToVerify`.

`verify-published.ts` gained a second exit code,
`NOTHING_WAS_VERIFIED = 2`,
kept separate from `PUBLISHED_TREE_DISAGREES = 1`:
a disagreement says the run shipped something wrong,
while the new code says the run was never examined,
and a gate that treats those alike either ships an unchecked run or refuses a good one.

An absent published tree is deliberately NOT one of the nothing-verified cases.
Beside real artifacts it means every settled entry is unpublished,
which is the most serious finding this check can make,
so it stays a finding with a count rather than collapsing into silence.

### The lister already had a second copy

`editor-standing-read.ts` carried its own `DirectoryReading` union and its own `namesIn`,
with the same `errorName` weakness and the same `console.error` plus empty-list shape.
Both now call the shared module,
following the rule `error-name.ts` records for itself:
lift at the point a further caller would be written.
Its one refusal message now names `ENOENT` rather than `Error`.

### Evidence

Boundary cases,
run against the built CLI on `mktemp` fixtures:

```text
absent runs directory        exit 2   NOTHING VERIFIED, no artifacts directory under the run (ENOENT)
run dir with no artifacts/   exit 2   NOTHING VERIFIED, no artifacts directory under the run (ENOENT)
artifacts/ present, empty    exit 2   NOTHING VERIFIED, the artifacts directory holds no settled artifact
artifacts, no published tree exit 1   NO PUBLISHED TREE (ENOENT). All 2 entries the run settled are unpublished
six agreeing pages           exit 0   matched=6, 6 of 6 pages carry every wording
```

The last row is the positive control,
and it is not invented:
it uses the six real artifacts from `~/translation-repair-runs-20260817`,
with each page synthesised from that artifact's own `shippableReplacements`
and checked with `pageCarriesEveryWording` before being written.
Without it,
every non-zero exit above would prove only that the check can refuse.

GFP:
with the verdict reverted to reading an unreadable listing as an empty one,
the two guard cases fail and the CLI reproduces `#217` exactly,
printing `0 of 0 pages carry every wording` and exiting 0 on an empty run.
Restored from copies kept in `~/temp/agent/217-gfp/`,
rebuilt,
and both pass again.

`published-tree-listing.unit.test.ts` covers 14 cases across five suites:
`namesIn` on a present directory,
an absent one and a file;
`filesystemReason` on a coded error,
an uncoded error and a thrown string;
both id listers on present and absent directories;
and all four verdict branches.

### One unrelated fix came with it

`probe-telemetry-report.unit.test.ts` imported `@monochromatic-dev/module-test`
rather than the `/ts` subpath every other test file uses,
which is what `ST3` requires.
It was the only such file in the package.
The fork exposed it because only this package's `dist/` is built there,
so the non-`/ts` path had nothing to resolve to:
one `TS2307` that cascaded into 12 `no-unsafe-call` and `no-unsafe-member-access` warnings.
Adding `/ts` cleared all 13.

## The parked work is now build-and-test verified together, not just apply-clean (2026-08-25)

`#210`,
`#211`,
`#212`,
`#217` and `#218` were each parked separately,
and each was checked only for whether its files applied cleanly over the main worktree.
Applying cleanly is not the same as compiling,
and none of them had ever been built together.

All five are now extracted into `/var/home/user/worktrees/verify-empty` on top of `e8430d094`,
and the combined tree was taken through the whole gate:

```text
build      exit 0
lint       exit 0   0 warnings, 0 errors  (oxlint type-aware plus tsc)
test:unit  exit 0   668 PASS, 0 FAIL
```

Six hundred and sixty-eight suites is nine more than the `#217` tree alone,
which is the `#210` and `#212` suites arriving.

The combined tarball is `~/temp/agent/parked-combined-20260825.tar.gz`,
42 files,
and it SUPERSEDES both `~/temp/agent/spend-telemetry-210.tar.gz`
and `~/temp/agent/verify-empty-217-218.tar.gz`.
Extract only the combined one;
extracting an older tarball afterwards would
overwrite files with their pre-combination contents.

### Why they were combined rather than kept apart

`#210` touches `provider-barrel.ts`,
`pipeline-barrel.ts`,
`ballot-barrel.ts`,
`candidate-select.ts`,
`editor-ensemble.ts`,
`judge-fidelity.ts`,
`refine-stage.ts`
and `translate-judge.ts`,
all of which further work is likely to touch.
Building each item against the same untouched base and landing them in sequence
would have let a later tarball silently overwrite an earlier one's edits to a shared file,
because a tarball carries whole files rather than a diff.
Building each item on top of the previous removes that hazard entirely.

No source file changed on the branch between the `#210` tarball's base and `e8430d094`:
the last commit touching `package/module/translation-repair/src/` is `91fe0d0e6`,
and everything after it is documentation.
So extracting the older tarballs onto this base discarded nothing.

### The landing sequence is correspondingly shorter

Read the standing,
extract `parked-combined-20260825.tar.gz`,
build,
lint,
types,
test,
then commit in item order so each item keeps its own message.
The build,
lint and test steps have now been run once already and passed,
so a failure there after landing would mean the main worktree differs from this fork,
which is itself the thing worth knowing.

## `#205`: the two-lane artifact family is named for its shape, not a version

The owner delegated the naming ("you decide,
this isn't a design decision")
and chose to leave the version-1 family where it is.
Measuring first changed the answer twice,
so both measurements are recorded.

### The task's own candidate was refuted

`#205` proposed `artifact-lanes-*` and `SettledArtifactLanes`,
noting neither had been checked.
Checking them killed both:
`ArtifactLaneRelationV2` and `ArtifactLaneSelectionV2` already use `Lane`
for PER-LANE concepts,
so a family-wide `Lanes` would name the whole thing
with the word its own parts already use for one part.

### The plain names belong to the older shape

Dropping the suffix outright collides on exactly six names,
and all six live in `artifact-v1-read.ts`:
`parseSettledArtifact`,
`ParsedArtifact`,
`buildSettledArtifact`,
`judgeSlice`,
`compareDecisions`,
`collectShippedRegions`.

That is worse than `#205` recorded.
The plainest names point at the OLDEST shape,
and the shape the pipeline actually writes wears a version number
that has been wrong since generation 3.
The v1 arm is still reachable,
so this is a naming problem rather than dead code:
`artifact-read.ts` routes unversioned and version-1 artifacts to it.
The owner chose to leave it,
and it is filed rather than fixed here.

### The rule, which the measurement chose rather than taste

A marker belongs exactly where two shapes are distinguished.

-   Six symbols have a version-1 counterpart,
    so those six say `TwoLane`:
    `parseSettledTwoLaneArtifact`,
    `ParsedTwoLaneArtifact`,
    `buildSettledTwoLaneArtifact`,
    `judgeTwoLaneSlice`,
    `compareTwoLaneDecisions`,
    `collectTwoLaneShippedRegions`.
-   Fifty-six have no counterpart at all,
    so their suffix asserted a version they do not carry and they simply lose it.
-   `ARTIFACT_SCHEMA_VERSION_V2` is untouched.
    It denotes the integer 2,
    and a version constant should carry a version number.
-   Forty files move from `artifact-v2-*` to `artifact-two-lane-*`.

### The sweep missed three names, and only the built artifact showed it

The first pass matched `[A-Za-z0-9_]*V2\b`,
which requires a word boundary after the digit.
`DamageRegionV2Error`,
`ArtifactComparisonV2Error` and
`verifyArtifactV2AgainstPreparation` carry `V2` in the MIDDLE,
so the scan never saw them,
the rewrite never touched them,
and a residue check built on the same assumption reported the work complete.

Reading `dist/final/node/index.d.mts` is what found them.
That is the rule this pays for:
a rename is checked at the artifact,
never only in the source it was applied to.

A method note on the check itself.
The first probe of the built types returned zero for every name including ones
that certainly exist,
because it read `dist/final/types/index.d.mts`,
which is not where the declarations land.
A positive control on a name known to be present is what caught it,
before the zero could be read as "the rename dropped everything".

The two error classes carry their own name as a string as well,
and both halves moved together
so a `name` assertion cannot pass against a class that no longer answers to it.

### Two test labels were lying

`artifact-change-sets.unit.test.ts` wrapped two assertions in
`caught(function parseTwoLaneArtifact() {...})` and
`caught(function readTwoLaneArtifact() {...})`,
and both bodies call the SINGLE-lane side.
The labels were chosen to dodge self-shadowing,
since a named function expression binds its own name inside its body,
and the dodge picked a name that says the opposite of what the code does.
They now name the assertion:
`singleLaneParseOfVersionTwo` and `changeSetReadOfVersionTwo`.

### Verification

```text
build          clean
lint           0 warnings, 0 errors
suite          676 PASS, 0 FAIL, exit 0
```

676 is the same count as before the rename,
which is what a pure rename must produce.
The shipped `index.d.mts` carries every renamed export
and `ARTIFACT_SCHEMA_VERSION_V2` as the only surviving `V2`,
and the six version-1 names are still present and untouched.

### Landing note

The 40 file renames mean the parked tarball is no longer sufficient on its own:
extracting new paths would leave the old ones in place.
`~/temp/agent/parked-deletions-20260825.txt` lists the 40 paths to delete,
and `~/temp/agent/parked-status-20260825.txt` holds the full status this park was cut from.

## The landing was rehearsed on a throwaway, and it works

The parked work had never been tested as a LANDING,
only as a working tree.
That gap mattered more after `#205`,
because 40 file renames mean the tarball
alone is no longer sufficient:
extracting new paths leaves the old ones in place.

A worktree was cut from the current main HEAD,
`9569f9d79`,
dependencies installed off the shared store,
and the park applied exactly the way a real landing would apply it:

```text
tar --extract   124 files
delete          40 superseded paths from parked-deletions-20260825.txt
status          67 new, 40 deleted, 57 modified
artifact-v2-*   0 files remain
```

The counts reconcile with the fork's own status,
where the same change reads as 27 new plus 40 renames plus 57 modified:
a rename lands as one new file and one deletion.

Then the whole gate,
on that fresh tree:

```text
build       clean
lint        0 warnings, 0 errors
suite       676 PASS, 0 FAIL, exit 0
```

And the new CLI through its own task,
which is the user boundary rather than a
node invocation of a bundle:

```text
mise run //package/module/translation-repair:run-timing-report -- <log>
  rounds                 2, 1.72min in total
    waiting after quorum 30.01s, 29.0% of round time
    voices never heard   1
  calls in flight        mean 1.05, peak 2
    busy against span    21.00s of calls across 20.00s of run
```

The worktree was removed afterwards.
What this buys is that the landing,
when the calibration exits,
is a rehearsed
procedure rather than a first attempt on the main worktree.

### The landing procedure, in the order it must happen

1.  Confirm the calibration has exited,
    and collect its standing first.
2.  In the main worktree,
    extract `~/temp/agent/parked-combined-20260825.tar.gz`.
3.  Delete every path in `~/temp/agent/parked-deletions-20260825.txt`.
4.  Build,
    lint,
    and run the suite.
    Expect 676 PASS and 0 FAIL.
5.  Commit with scoped pathspecs,
    naming every new file (CPN),
    and remember the 40 deletions are part of the same change.

## The three report CLIs are documented, and the landing was re-checked for collisions

Opened by asking what `#219` actually requires before production readiness can be
signalled,
and answering it by measurement rather than by assumption.

### What the measurement found

Of 47 mise tasks the package will carry after the landing,
the README named 6.
It did not name `corpus-pass`,
the primary entry point,
and it did not link
`doc/runbook/translation-repair-corpus-pass.md`,
which exists and carries the whole
operating procedure.
A reader of the design document had no route to running anything.

None of the three CLIs the landing adds,
`ledger-report`,
`run-timing-report` and
`spend-report`,
appeared in the README or the runbook.
Three user-facing tools were about
to land undocumented,
which is exactly what PKG exists to catch.

### How the documented output was obtained

Not from memory.
A throwaway worktree was cut at `852e84f3a`,
the parked tarball extracted,
the 40 recorded deletions applied,
and the package built clean.
Every block now quoted in
the runbook is output captured from that build.

For the populated cases the inputs were fixtures,
because the two run directories on disk
both predate the writers.
The timing fixture was hand-computed first:
rounds of 60000 and
30000 milliseconds with 40000 in grace,
and call intervals of `[0,10]`,
`[2,8]` and
`[15,20]` seconds.
The tool returned `1.50min`,
`40.00s` at `44.4%`,
`mean 1.05` and
`peak 2`,
matching the hand computation exactly.

THAT DOUBLES AS THE POSITIVE CONTROL.
It proves the reader can report non-zero,
so
`NO ROUND LINE` on the live calibration log is a true absence rather than a broken parser.
Without it the zero would have been an unvalidated null.

### Two things worth knowing before operating them

The three tools disagree on the exit code for "nothing recorded",
and the difference is
deliberate rather than an oversight.
`ledger-report` exits 1,
while `run-timing-report` and
`spend-report` exit 0.
An empty ledger usually means `TRANSLATION_REPAIR_RUNS_DIR` was never
set,
which is operator error worth failing on.
A log with no `SPEND` or round lines is
simply an older log and says nothing about the operator.
The runbook explains this rather
than smoothing it over.

`ledger-report --model <id>` prints candidate text verbatim,
which on a real run is corpus
wording from an unlicensed archive,
together with judges' reasons quoting it.
The runbook
now says plainly that its output must not be pasted anywhere.
The summary view carries only
model identifiers and counts and is safe to share.

### A rough edge found while capturing the output, filed as `#220`

A ledger file whose top level is an array rather than a single round object,
which is the
shape a reader would guess,
aborts the entire report with an uncaught `LedgerShapeError`,
a page of minified JavaScript,
and exit 1.
The message itself is good and names both the
file and the field.
Nothing catches it,
and `reportLedger` reads every file through one
`Promise.all`,
so a single truncated write destroys a report over every good file beside it.
A truncated write is the expected failure,
because the ledger is written during a run that
can be killed at any moment.

Not fixed now,
deliberately:
editing `ledger-report.ts` would invalidate the rehearsed
landing for a rough edge that costs nothing while the ledger is machine-written.

### The landing is still safe, and this was verified rather than assumed

The parked tarball was cut before the last doc commits,
which raised the question of whether
extracting it would clobber them.
It does not.
The tarball holds 124 entries under exactly
three prefixes,
all inside `package/module/translation-repair`,
and contains no `doc/` path
at all.
The only file changed on the branch since the rehearsal base `9569f9d79` is
`doc/handover/translation-repair.md`.
The intersection is empty,
so step 2 of the landing
procedure cannot overwrite a doc commit.

The landing procedure itself is unchanged.

### The runbook was audited against the source, and nothing in it is stale

Every environment variable it names exists in source:
both API keys,
`TRANSLATION_REPAIR_RUNS_DIR`,
and `TRANSLATION_REPAIR_HARD_CAP_MINUTES`.
Both flags it uses exist:
`--plan` at `src/corpus-run/corpus-pass.ts:513`,
and `--only` at `src/corpus-run/entry-filter.ts:24`,
read at `src/corpus-run/corpus-pass.ts:318`.
Every mise task it names exists,
apart from the three arriving with the parked work.

Every string it tells the operator to watch for is emitted by non-test source:

-   `PLAN ok tip=` at `src/corpus-run/corpus-pass.ts:515`,
    carrying exactly the `pipeline=`,
    `client=constructed`,
    `pending=` and `first=`
    fields the runbook claims it does.
-   `ONLY` at `src/corpus-run/corpus-pass.ts:328`.
-   `CAP OVERRIDDEN` at `src/corpus-run/corpus-pass.ts:491`.
-   `CAP TOO TIGHT` at `src/corpus-run/cap-override.ts:156`.
-   `REATTEMPT` and `STALLED` at `src/corpus-run/entry-attempt-queue.ts:109` and `:116`.
-   `METERS` at `src/provider-budget.ts:14`.

`RUNDIR` is set in Steps,
before What to check uses it,
so the additions are reachable
by a reader working through the document in order.

TWO SEARCHES LIED BEFORE THIS SETTLED,
both toward a false absence.
`rg --fixed-strings "--plan"` returned zero hits because `rg` read the pattern as its own
flag rather than as text.
An `ONLY` search capped with `head` at five lines hid the one
real emission behind four unrelated prompt strings.

Either would have read as "the runbook names something that does not exist",
and acting on
either would have meant editing a correct instruction into a wrong one.
Both are the QRY
failure mode exactly as it is written down,
and the uncapped,
flag-safe re-runs found
everything.
Worth remembering that the dangerous direction here is the empty result,
not
the noisy one.
