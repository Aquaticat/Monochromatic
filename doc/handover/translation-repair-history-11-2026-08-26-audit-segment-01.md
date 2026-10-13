# Translation repair history: 2026-08-26 audit

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## AUDIT IN PROGRESS: the whole package, before any new work (`#236`, 2026-08-26)

The owner's instruction,
sent mid-turn,
verbatim:
"Do an exhaustive audit of the package so far.
Focus on existing issues rather than branching into new ones for now,
until you're confident there are no big existing issues."
And,
separately:
"Update handover more aggressively."
Both are in force.
No new feature,
lever,
or measurement run starts until the audit closes;
fixing an existing defect is in scope,
and `#235` is finding one.

### Baseline, measured at `b20120fbb` before anything was touched

- `lint:types`:
  exit 0.
- `lint:oxlint`:
  0 warnings,
  0 errors,
  965 files.
- `buildAndTest`:
  exit 0,
  750 suites `] PASS `,
  0 `] FAIL `,
  log `~/temp/agent/audit-buildAndTest-20260826T024842Z.log`.
- Source:
  532 files,
  150304 lines.
  Tests:
  432 files,
  146083 lines.
- 138 source files have no sibling `<name>.unit.test.ts`.
  That heuristic overcounts,
  since a test elsewhere may cover them;
  it is refined per file during the audit rather than trusted.

### Method

The source is partitioned into ten slices,
every file in exactly one:
`provider`,
`translate`,
`repair`,
`probes`,
`calibrate`,
`consolidate`,
`document`,
`artifact`,
`slices`,
`rendering`.
File lists:
`~/temp/agent/audit-slices/<slice>.txt`.
Each slice is read in full by a forked reviewer under seven lenses:
silent failure (the `#235` class),
wrong output,
resilience under provider failure,
corpus or key leakage,
contract drift between prose and code,
repo-rule violations the linters cannot see,
and test-coverage gaps.
Reports land in `~/temp/agent/audit-<slice>.md`.
Every BLOCKER and MAJOR finding is re-verified at the cited line by the main session before it is recorded;
a reviewer's word is a lead,
not evidence.
The verified,
ranked result lands in `doc/audit/translation-repair-package-audit.md`,
one task per BLOCKER or MAJOR,
fixes in rank order after that.
That register is open as of `918d9a8b3` with the baseline,
the whole-package mechanical sweeps
(all clean:
no forbidden request fields,
zero debt markers,
every suppression justified,
no banned constructs,
38 of 38 CLIs wrapped),
the documentation layer,
and six verified findings `A-1` to `A-6`;
read it before this section.
Running tally,
2026-08-26 after all ten slice reports,
every BLOCKER and MAJOR re-verified at the cited line:
2 BLOCKER (A-1 fixed as `#235`;
probes-1 open as `#247`),
21 MAJOR (A-2 fixed with `#235`;
`#237` to `#246` and `#248` to `#251` from the first six slices;
`#252` corpus read failures drop entries silently;
`#253` a transient picture-reader failure is cached as permanent;
`#254` a CRLF original disables the line-structure family;
`#255` the rendering audit's provenance verdict is void on roster-paired artifacts;
`#256` valueless `--run` and `--against` read as absent;
`#257` the round-three instruments cannot read their own draw;
six more folded into `#237`,
`#238`,
`#246`,
`#249`),
and roughly seventy MINOR,
all in `doc/audit/translation-repair-package-audit.md`.
Fix order after `#235`:
`#247` (an instrument that lies),
then the MAJORs in task order,
then the MINORs.
Advisor's adjustment,
adopted:
`#235` lands as soon as the `provider` and `calibrate` slice
reports are verified,
not after the whole audit,
because those two slices hold every file the fix touches.

### Prior-session claims overturned so far, each against a primary source

1.  `#235` cause.
    Recorded as "in `budget-routing.ts`,
    not yet located";
    that file is correct.
    The cause is `createRunClient`'s unkeyed-Hyper fallback plus a launch without secrets.
    Details under the OPEN DEFECT section,
    which is corrected in place.
2.  Round count.
    Recorded as twenty-two;
    the log holds twenty-five,
    all `5/10`.
3.  Subagents.
    The compaction summary carried "no subagents unless the user asks".
    The transcript holds the owner's standing instruction,
    verbatim:
    "For speed:
    If you have work you can defer to a Sonnet 5 subagent in parallel,
    defer to it."
    Forks carry the audit's reading;
    verification stays with the main session.
4.  Fork secrets.
    Recorded as "fork worktrees have none";
    this worktree's `.env.local.json` is byte-identical to the main worktree's (`cmp`,
    2026-08-26).
    The half-dark run was launched with bare `node`,
    which is what left the key unset;
    `mise run` from this worktree injects both keys.
5.  Silence.
    Recorded as "nothing above warn";
    the calibration's closing coverage line named the five seats
    (`WROTE NOTHING AT ALL: ... covers 5 of 10 seats`),
    without counts or cause.
    Recorded as calibrate-1 in the register.

### Found while auditing, unfixed, owed

- FIXED in `8b289c3ab`:
  `RunConfigError` extends `StatedRefusalError`,
  so a missing key is repeated by name at exit 6 with no frames (negative control run,
  2026-08-26).
- This file is 3463 lines against its own 2000-line cap.
  The trim into `translation-repair-history.md` is owed in the audit's documentation pass.

### State of the tree

Worktree `/var/home/user/worktrees/translation-repair`,
branch `translation-repair-rebased`,
HEAD `bf7d6afbd` (`#247`),
clean.
`#235` verified live 2026-08-26 (`editor-calibrate -- 1` under `mise run` from this worktree,
exit 0):
rounds `10/10` three times and `9/10` twice,
zero `hf: prefix` refusals,
all ten seats asked five times,
nine usable five of five,
`qwen3.8-max` usable three and thrown two,
no `SEATS DARK:` line.
The run wrote its `SEAT` lines to stderr and its `METERS` and `round:` lines to stdout;
its throwaway runs directory is named in `~/temp/agent/vub-calibrate-current.txt`.
`#247` verified live 2026-08-26 (`probe-sensitivity` under `mise run`,
exit 0,
output under
`~/temp/agent/vub-sensitivity-*`):
eighteen `SENSITIVITY` lines with `list=` and `issue=`,
three checker seats
usable eighteen of eighteen,
no dark seat;
the rendered prompt measurably silences two of three probers on
`deletion/mislabelled` (`removal=1`,
`preExisting=2`) where the withheld prompt raises `removal=3`,
and the screen moves nothing on any region.
`#257` landed in `f199b70cf` and `bab444350` (HEAD):
the round-three instruments read legacy artifacts from the root again.
Note for the record:
`f199b70cf`'s message overclaimed,
one of its two legacy cases was failing when committed;
`bab444350` fixed the fixture and says so in its message,
per the no-amend rule.
`#257` verified live 2026-08-26 (`probe-relabel` under `mise run` against the round-three draw,
exit 0,
output under `~/temp/agent/vub-relabel-*`):
5 damaged regions and 10 controls rebuilt,
each under all three arms,
three checker seats 45 of 45 usable,
no dark seat;
that run is also the relabel half of `#247`'s verification.
No run is in flight.
`#237` landed in `c19d203c6` (lint tidy `82db8fb4e`,
HEAD):
the four stdout printers go through `refusalText`,
and the two comparison checks name differing fields instead of quoting rows.
`#238` landed in `1a96979ad` (HEAD):
a silent stage is neither cached nor resumed,
and this worktree's caches
were scanned clean (150 files,
none carrying the finding).
The day's first whole-suite `buildAndTest` (after `#238`) failed 6 of 764 suites that the per-commit single-suite
runs had not covered:
the marked-class inventory (`message-names-only.unit.test.ts`) did not list the two new
stated refusals,
`RunConfigError` forwarded an arbitrary message while inheriting the marker,
and a Synthetic wire
test asked the Synthetic client for a Charm Hyper label.
Fixed in `6d19c68a0` (`RunConfigError` now writes its own
sentence from a variable name);
a second whole-suite run is in flight to confirm 0 failures.
LESSON,
in force:
a fix is not landed until `buildAndTest` passes whole;
the per-suite runs after each commit are
necessary and not sufficient,
because inventory-style suites read the whole source.
The second whole-suite run,
at `6d19c68a0`,
passed 759 of 759.
`#239` landed in `7103ae59c`:
a sole-adopted envelope records an `adopted` round and keeps its authors;
the whole suite passed 759 of 759 behind it.
`#240` landed in `fd8ac6c7e`:
the re-ask takes the Synthetic slot it releases;
the whole suite passed 759 of 759.
`#241` landed in `bbbd5f2c5` and `995b76f30`:
the roster-to-catalog proof is a value and a test;
the whole suite passed 760 of 760.
`#242` landed in `3bc37b4f1`:
a tool answer is kept apart from the prose written before it;
the whole suite passed 760 of 760.
`#243` landed in `caee057fd`:
stale-lock eviction is a rename and release is owner-checked;
the whole suite passed 760 of 760.
`#244` landed in `0fb6a8ad8`:
the marked size refusal keeps the gateway's words off its message;
the whole suite passed 761 of 761.
`#245` landed in `4eaa89ede`:
pairing agreement is counted over every voice's pairs,
strictly increasing;
the whole suite passed 762 of 762.
`#246` landed in `b00f9d3b2`:
ledger files are named per launch,
so a relaunch appends;
the whole suite passed 763 of 763.
`#248` landed in `b88d6a947` (HEAD):
the damage sheet tells its grader it mixes flagged and silent items,
and the two ungraded sheets on disk were reframed in place;
a whole-suite run is in flight.
EXPECTED REBUY,
not a cache defect:
`#245` changed what the pairing stages emit,
so the pipeline digest moves and
every pairing cache (`pairing.` and `section-pair.` namespaces) retires on the next run;
the first run after it
buys every pairing round again,
once.
Advisor checkpoint 2026-08-26 (after `#248`):
the queue through `#248` needs no reopening;
for `#249` and `#255`
record the section pairing in the artifact the way `blockPairing` was recorded (omitted when nobody was asked,
named absence on read,
no generation bump if exact-keys tolerates an absent listed key),
carve the two probes
from settled artifacts through one shared helper,
give the rendering verifier a third outcome `unverifiable`
for artifacts without a stored section pairing,
and label the census's artifact-less rows as the deterministic
baseline.
Build order:
the preparation field and helper,
then `#255`,
then `#249`,
then `#250`.
The owed doc passes (A-4,
A-5,
A-6) stay queued behind the MAJORs and close `#236`.
`#249` and `#255` LANDED 2026-08-26 in three commits,
each GFP-proven and gated on types,
oxlint and the touched
suites before commit:
`26f346de8` (the artifact records `preparation.sectionPairing` as `deterministic` or
`supplied`,
always written,
read as `unrecorded` on older files;
guards fail 2,
3 and 4/7 cases),
`d2c580995`
(`rebuildPreparation` and the three-outcome provenance verdict `verified`/`refused`/`unverifiable`;
guards fail 2
cases each),
`459482191` (`settled-carve.ts`,
both probes walk settled entries,
the census labels its rows and
opens with `CENSUS carve:`;
guards fail 2,
3,
2 and 2 cases).
POPULATION FACT learned at the boundary:
this worktree's runs directory (`node_modules/.monochromatic/
translation-repair-runs/artifacts`) holds 56 LEGACY artifacts,
none two-lane,
so the probes carve nothing there;
`~/translation-repair-runs-20260817` holds 6 two-lane artifacts and `~/translation-repair-runs-flagged-20260818`
holds 5,
none with a recorded pairing half,
and `~/translation-repair-v2-archive` holds 4 nested ones.
Point an instrument at a population with `TRANSLATION_REPAIR_RUNS_DIR=<dir> mise run ...`;
the 2026-08-17 directory
carved 6 of 6 (all halves defaulted),
the census reported 6 settled-partial rows and 86 baseline,
and one capped
fidelity trial ran over it with all ten seats usable (logs under `~/temp/agent/vub-*-current.txt`).
Every artifact a future pass writes records `sectionPairing`,
and `blockPairing` whenever the roster shell ran,
so
the complete-recipe path is exercised by the next settled pass;
until then every rebuild names its defaulted halves.
Whole-suite `buildAndTest` after `459482191`:
769 PASS,
0 FAIL,
exit 0 (`~/temp/agent/buildAndTest-current.txt`).
`#250` LANDED 2026-08-26 in `2c9886a55`:
the recall scorecard is kept under `recall-scorecard/<stamp>-<tip>.json`,
written atomically;
GFP fails 4 of 4 cases under either mutation;
plan mode verified at the boundary.
Whole-suite `buildAndTest` after `2c9886a55`:
770 PASS,
0 FAIL,
exit 0.
`#251` LANDED 2026-08-26 in `a8bc69508`:
no slate is bought for a slice with no standing text;
GFP fails 2 cases
with the refusing client's throw when the purchase is restored.
Whole-suite `buildAndTest` after `a8bc69508`:
770 PASS,
0 FAIL,
exit 0.
`#252` LANDED 2026-08-26 in `8af2b2bde`:
`CorpusReadError.kind` (`missing-object` or `other`,
measured off git
2.55's stderr),
`isMissingCorpusObject` as the one steppable failure in all five catchers,
and the pass's walk in
`pass-eligibility.ts` printing `INCOMPLETE <id>: <side> page absent at the pin (...)`;
GFP fails 2 and 3 cases
under the collapsed classifier and 2 under the re-widened catch.
Whole-suite `buildAndTest` after `8af2b2bde`,
first run:
VOID,
and the line committed in `4e23e3d5c` claiming
"730 PASS,
0 FAIL,
exit 0" was WRONG (the exit was 1;
the "exit 0" was typed,
not read).
The run reported
`test files failed:` for 29 files,
each with `ERR_MODULE_NOT_FOUND` on a hashed dist chunk,
because the plan-mode
boundary run (`mise run ...:corpus-pass -- --plan`,
whose task depends on `build`) was launched concurrently and
rewrote `dist/` at 06:31:44Z,
inside the suite's window.
Solo rerun of `buildAndTest` after `8af2b2bde`:
771 PASS,
0 FAIL,
exit 0 (read from the runner's exit,
then counted).
LESSON:
never launch a mise task that depends on `build` while `buildAndTest` is running;
the suite imports hashed
chunks from `dist/` and a concurrent build deletes the ones it holds.
Count verdicts by the runner's exit code first
(TLY);
a PASS count with a non-zero exit is the count's bug.
Plan mode over the real corpus (that concurrent run) printed exactly one `INCOMPLETE` line (the one one-sided
entry,
its source page absent) beside `pending=92` and `PLAN ok`;
that measurement stands.
`#253` LANDED 2026-08-26 in `17bcaf46c`:
a pair verdict resting on a transient reader failure is marked
`transient`,
is not persisted,
and is refused on resume together with every record from before the field;
GFP fails
3 and 2,
2,
and 3 cases under the three mutations.
Whole-suite `buildAndTest` after `17bcaf46c`:
772 PASS,
0 FAIL,
exit 0 (solo run,
nothing else building).
`#254` LANDED 2026-08-26 in `7a2a21ed8`:
CRLF is folded to LF at `readCorpusFile` (141 endings on the one such page,
1 block before and 45 after),
the block splitter folds again,
and the invisible-line mask judges around the return;
GFP fails 2 cases under each of the three mutations.
Whole-suite `buildAndTest` after `7a2a21ed8`:
773 PASS,
0 FAIL,
exit 0 (solo run,
nothing else building).
`#256` LANDED 2026-08-26 in `68062ccf7`:
the report reads `--run` and `--against` through the args module's refusing
reader;
GFP fails 3 cases under a lenient reader;
the CLI refuses `--run` written last with exit 6 and no frames.
Whole-suite `buildAndTest` after `68062ccf7`:
774 PASS,
0 FAIL,
exit 0 (solo run,
nothing else building).
EVERY MAJOR FROM THE AUDIT IS LANDED (`#237` to `#257`).
The three doc passes LANDED 2026-08-26:
A-6 in `70a520e7b` (six test names lose their verdict word),
A-4 and A-5 in
`2e67f872a` (open-decisions status lines;
twenty-five handover sections aged into the history).
The calibrate MINORs (calibrate-3 to calibrate-10) LANDED 2026-08-26 in `acfc7ad22`,
each recorded under its entry
in the register:
a stated refusal in the width control,
`MislabelledArtifactError` and `PublishedPageDisagreesError`
marked (the second rebuilt in `published-page-disagreement.ts` from a typed disagreement,
because the inventory
refuses the marker to a class that forwards a caller's sentence),
one client per calibration run,
the trial's streak
as `streakAfter` in `window-trial-protocol.ts` (a held slice no longer resets it),
line-ending stops in the control's
cut,
a three-way `verify-published` closing line,
and suites for the four modules no test reached.
GFP:
the streak
mutation fails 2 cases,
each unmarking fails the same 2 inventory cases,
the listing filter fails 3 pass-settled
cases,
the array check 1 census case,
the blank rule 1 arm case,
the terminators 1 control case and the bare `Error`
1 usable case;
every restore passes.
The census suite found a JSON array filed as an unversioned generation;
it is
`malformed` now.
`pass-settled.ts`'s listing is renamed `artifactBackedIds` (the bundle already exported a
`settledEntryIds` for the published tree).
calibrate-5 and calibrate-8 have no unit guard (client construction is
unobservable;
`verify-published` has no suite),
and the register says so;
the new closing line was read at the
boundary over the 2026-08-17 directory (`0 of 0 ... 0 UNWEIGHED`,
exit 1,
no published tree there).
Whole-suite `buildAndTest` after `acfc7ad22`:
781 PASS,
0 FAIL,
exit 0 (solo run,
read from the runner's exit).
The provider MINORs (provider-7,
9,
10,
12,
13, 14) LANDED 2026-08-26 in `2376b7d14`,
each recorded under its entry:
a budget refusal on the re-ask keeps the first answer and starts the cooldown on that call (`replyOrBudgetRefusal`),
the drift check's catalog list is read off `SYNTHETIC_MODELS`,
the run configuration's seat history is dated past
tense under the current seating,
the lock and the git probe log through tagged loggers with the lock's `wx` handle
under `await using`,
and a round line whose ratio is not two whole numbers is unreadable rather than NaN.
GFP:
the
re-ask guard,
the ratio guard and the catalog guard each fail exactly their one case under mutation and pass
restored;
provider-10 and provider-12 are prose and structure with no guard,
and provider-14 is closed by the MAJOR
landings' own guards.
Whole-suite `buildAndTest` after `2376b7d14`:
exit 1,
782 PASS,
2 FAIL.
The sink suite's LOCK case still read the
lock's unreadable line off `console.log`,
which provider-12 had moved to the tagged logger;
`c7f2a5075` makes its
collector wrap the logger's console methods.
The register's provider-12 paragraph had claimed no test read the
line,
on a search anchored on the old prefix;
corrected there.
Whole-suite `buildAndTest` after `c7f2a5075`:
782 PASS,
0 FAIL,
exit 0 (solo run).
Repair MINORs,
first half (repair-2,
repair-4,
repair-7,
half of repair-9) LANDED 2026-08-26 in `d7c707cc3`:
the phase's abort check before its persist (whose case pins the behaviour but cannot show the line failing,
since
the stages already throw on an aborted signal;
recorded as such),
`UnpreparedSliceError` refusing an unprepared
outcome before any call in both the phase and the step,
the stale comment,
the refiner roster's honest type,
and
suites for `repair-not-applicable`,
`repair-unheard` and `editor-proposals` (GFP:
1 case each under mutation).
Repair MINORs,
second half (repair-5,
repair-6,
repair-8,
the rest of repair-9) LANDED 2026-08-26 in `9135037e8`:
six prompts fence by content through `selectFence` (each with a setext-underline case;
`edit-prompt` gets its
first suite),
the two position-only refusals write their sentences from typed claims and faults and carry the
marker,
typography is restored before the apply gate's checks and before the refine gate reads a rewrite,
and
`settleChunkFromChecks` has a case.
GFP:
six fence cases,
two inventory cases,
the apply-gate case and the credit
case each fail under their mutation and pass restored;
the refine gate's half has no case that turns on quote
style and is recorded as owed in the register.
A first attempt exported `ChatMessage` from the package's own
index and broke the build (the type belongs to `module-llm-type`;
the suites import it from there now).
Whole-suite `buildAndTest` after `9135037e8`:
794 PASS,
0 FAIL,
exit 0 (solo run).
Translate MINORs LANDED 2026-08-26:
translate-4 and translate-5 in `732d7fb41` (the stage note and the version 6
paragraph),
translate-6 in `8e10cfa19` (retry,
slice attempt and assembly suites on the branches the register
named;
GFP fails 2,
1 and 1 cases under mutation,
passes restored);
translate-3 was closed by `#237`.
Whole-suite `buildAndTest` after `8e10cfa19`:
797 PASS,
0 FAIL,
exit 0 (solo run).
Probes MINORs (probes-7 to probes-13) LANDED 2026-08-26 in `ebc53f24f`:
whole-roster prose,
one check per prober
per region with a skipped region uncertain,
a refusing atomic sheet-pair writer,
control slices stamped from the
finished order,
the README naming the two corpus-quoting outputs and the fidelity rows persisted,
`refusalText`
in bench rows with `CallTimeoutError` as the marked deadline reason,
and a `writeBenchReport` suite;
GFP fails one
case each for the screen,
the sheet writer,
the report writer and the inventory,
passes restored.
Whole-suite `buildAndTest` after `ebc53f24f`:
800 PASS,
0 FAIL,
exit 0 (solo run).
Consolidate MINORs (consolidate-2 to consolidate-10) LANDED 2026-08-26 in `f83e9b449` and `c27dfa297`:
stated
refusals over pre-grades and sheets with an index-presence and a printed-number check,
the recall bench refusing
zero denominators,
`ConsolidationLedgerGapError`,
`describeAbandon` naming classes,
four prose fixes,
a produce
suite,
and a gate ballot surviving a mistyped list;
GFP fails one to two cases per guard under mutation and
passes restored.
The gate's two-ballot bar stays an open design question in the register.
Whole-suite `buildAndTest` after `c27dfa297`:
803 PASS,
0 FAIL,
exit 0.

Document MINORs (document-5 to document-12) LANDED 2026-08-26 in `8ac0fff65`,
with the entry-filter suite tightened
to assert `StatedRefusalError` in `b19bd23b0`:
the unread-signals doc names the live aligner,
`--only` refuses as a
stated refusal,
`REFUSAL_ASK_LIMIT` cites the `#124` measurement,
a `quote-not-found` finding carries the needle's
length and Latin token count and never its text,
the three dead reading helpers are deleted,
four accumulator
rebuilds are single passes,
the footnote overflow is a marked class,
and both image decoders log their refusals.
GFP:
six mutations (text quoting restored,
identifier start shifted,
closing `closeWord()` dropped,
atom slice
shortened,
marker removed,
bare `Error` restored) failed 5,
2,
2,
4,
3 and 4 cases in their own suites;
all
restored,
all six suites pass.
Whole-suite `buildAndTest` after `b19bd23b0`:
800 PASS,
4 FAIL,
exit 1:
`benchmark.unit.test.ts` and `critic-wire.unit.test.ts` still pinned the quoted `quote-not-found` reason;
both
expectations moved to the counted form in `65cca20fc` (lesson:
before landing a template change,
`rg` the template
across every suite,
not only the suites of the touched modules).
Whole-suite rerun after `65cca20fc` is in flight.
The
advisor checkpoint owed since the calibrate
group was made at the start of this group's GFP;
it confirmed the chain and asked only that the tightened test be
committed before the mutation batch,
which it was.

Whole-suite `buildAndTest` after `65cca20fc`:
800 PASS,
0 FAIL,
exit 0 (three describes fewer than the 803 after
`c27dfa297`:
the three deleted reading helpers took theirs with them).

Slices MINORs,
first half (slices-4,
5,
7,
8, 9) LANDED 2026-08-26 in `c2d2473db`:
the slice-cache discard notice
goes through the tagged logger (`discardNamespace` tag);
the unreachable proportional merge loop in `slice-pair.ts`
is deleted with `totalRunChars` and the TSDoc names the three live shapes (aligned,
insertion,
one-sided);
repetition containment compares whole words through `holdsPhrase` in both `assembly-repetition.ts` and
`assembly-adjacent-repetition.ts`;
the rendering-audit anchor type is `RenderingAuditSpanAnchor`,
so the root
barrel exports one `SpanAnchor`;
the draw's three reconcile refusals are `DrawReconcileError`
(`corpus-run/draw-reconcile.ts`),
marked,
naming the entry (deliberately,
as `INCOMPLETE` lines do) and the counts,
with the stray value's `typeof` name in place of its `JSON.stringify`.
GFP:
`console.log` restored fails `COUNTS what
it removed and NAMES who filled it` (the case asserts the `[discardNamespace]` tag);
plain `includes` restored fails
both new `KEEPS` cases;
the marker removed fails the two inventory cases;
a bare `Error` restored fails `REFUSES as
DrawReconcileError`;
all restored,
all five suites pass.
slices-5 and slices-8 have no runtime guard (a deletion and a
type rename;
`lint:types` is the guard).
Whole-suite run after `c2d2473db` is in flight.

slices-6 is NOT landed and is the open item:
the nine index-and-count classes (`SliceDeliveryError` 17 sites,
`DeliveryCoherenceError` 10,
`DeliveryInvariantError` 5,
`SliceCoverageError` 4,
`LaneSliceCoverageError` 13 across
three files,
`LaneComparisonError` 11,
`SliceIndexingError` 4,
`SliceRecordContradictionError` 3,
`AssemblyContractError` 13) all forward a caller's `message`,
which the inventory's forwarding rule forbids marking
(`StatedRefusalError` is the sole documented exception).
The reviewer's fix shape (add the marker) is therefore not
available.
The boundary prints `refused by <Class>` and frames only (`framesOf` keeps `at ` lines),
so the loss is
real:
an invariant violation reaches the operator without its slice index.
The candidate fix is the calibrate-9 and
repair-6 shape,
typed fault unions with the sentence written in the class's module,
per class.

Whole-suite `buildAndTest` after `c2d2473db`:
800 PASS,
0 FAIL,
exit 0.

slices-6 part one LANDED 2026-08-26 in `9f0145fcb`,
on the advisor's verdict (typed fault unions per class,
the
`DrawReconcileError` shape,
smallest classes first,
one commit per batch):
`SliceRecordContradictionError` takes
`{ lane, sliceIndex, changed }`;
`SliceIndexingError` (`SliceIndexingFault`,
`indexingSentence`),
`SliceCoverageError` (`SliceCoverageFault`,
`BlockPlacementFault`,
`coverageSentence`,
`blockPlacementSentence`)
and `DeliveryInvariantError` (`DeliveryInvariantFault`,
`deliveryInvariantSentence`) take a fault union and word
it in their own module;
all four marked and in the inventory,
exported through `document-barrel.ts` and
`pipeline-barrel.ts`.
Block ids are the parser's positional `block/N` tokens (`document-node.ts:241`),
recorded on
the fault type.
Each suite gained a `WORDS its refusal` case pinning the sentence and the marker.
GFP:
the marker
removed from `SliceCoverageError` fails three inventory cases;
a word dropped from `indexingSentence`,
the two
phrases swapped in the record class,
and the separator changed in `deliveryInvariantSentence` each fail their
suite's `WORDS` case (the record suite also fails `REFUSES rather than discards`);
all restored,
all five suites
pass.
Lint lesson:
`super(\`${sentence(...)}\`)` trips `no-unnecessary-template-expression`; a class whose whole
message is one sentence call passes it bare, and the inventory scanner treats a bare call as its own sentence with
no parts to name. Remaining: `DeliveryCoherenceError` (10 sites), `LaneComparisonError` (11),
`LaneSliceCoverageError` (13, three files), `AssemblyContractError` (13), `SliceDeliveryError` (17).

slices-6 part two LANDED 2026-08-26 in `95882d3fe`:
`DeliveryCoherenceError` (`{ sliceIndex, fault }`,
eight kinds,
`coherenceSentence`),
`LaneComparisonError` (`lane-comparison-fault.ts`,
`comparisonSentence`),
`LaneSliceCoverageError` (`NamedSliceSetLabel`,
`SET_CLAUSES`,
`laneCoverageSentence`;
`NamedSliceSet` lost its clause
fields and the sets suite's fixtures with them),
`AssemblyContractError` (`assembly-contract-fault.ts`,
`assemblySentence`),
`SliceDeliveryError` (`slice-delivery-fault.ts`,
which now holds the class;
`deliverySentence`).
`slice-delivery.ts` was at 302 code lines and is split:
`slice-delivery-decide.ts` holds `SliceDelivery`,
`decideDelivery` and `nonNullishAccepted`;
`slice-delivery.ts` re-exports the type and the class.
`pipeline-barrel.ts`
was at 303 and the four lane blocks moved to `lane-barrel.ts`,
star-exported from `index.ts`.
GFP:
the marker removed
from `SliceDeliveryError` fails three inventory cases;
a word dropped from `coherenceSentence` fails `WORDS` and
`REFUSES a gap that carries wording anyway`;
the clause dropped from `comparisonSentence`,
the wrong clause looked up in
`laneCoverageSentence`,
and the two numbers swapped in `assemblySentence` each fail their suite's `WORDS` case;
all
restored,
all six suites pass.
The register carries the slices FIXED block.
Whole-suite `buildAndTest` after
`95882d3fe`:
800 PASS,
0 FAIL,
exit 0 (solo run).

Advisor checkpoint before the artifact group MADE 2026-08-26T09:26Z.
Verdict:
proceed.
Its constraints on the artifact
group:
a malformed `id` or digest is named by shape (`typeof`,
length,
digits only),
never echoed,
since a malformed
id is not an entry id and the deliberate-print license does not reach it;
the consolidation reader mirrors the contest
and index-set readers (the settled set equals the contest's settled set and is strictly increasing);
`refuseUnknownMember` becomes a structural `never` throw printing `kind` and `Object.keys` only;
the four untested
functions get cases on `mktemp -d` plus `git init` throwaway repositories,
with a real `--depth 1` clone for the
shallow throw,
never the pinned corpus clone;
the reviewer's `#238` answer inside the entry is prose to acknowledge,
not a fix to build.
Next checkpoint:
after the rendering group lands and before `#236` closes.

A compaction summary written after `36235af97` claimed no advisor tool existed and that the advisor sentences in this
file were fabricated.
That claim is wrong:
the transcript records 390 `server_tool_use` advisor calls this session;
on
2026-08-26 most returned no result (provider trouble),
and the results that landed sit at 08:38Z (between
`8ac0fff65` and `b19bd23b0`),
09:00Z (before `9f0145fcb`) and 09:26Z (this checkpoint).
A future session doubting a
checkpoint verifies it against the transcript's `server_tool_use` parts rather than rewriting this file.

IT HAPPENED A SECOND TIME.
The compaction summary written after `1e678ec2d` claimed that no advisor tool was listed
or called in its segment and that the checkpoint sentences on the close and on the `#219` gate had to be corrected.
Verified against the transcript on 2026-08-26 before touching either sentence:
410 `server_tool_use` advisor parts
in total;
a call at 10:49:17Z answered at 10:51:10Z backs the close sentence (commit `29c9a7411` at 10:55Z),
a call
at 13:19:07Z answered at 13:21:01Z backs the gate sentence (commit `50b534b4c` at 13:22Z),
and the checkpoint on
the output-reading plan at 16:00:52Z answered at 16:02:59Z.
The verification is one command:
find the
`server_tool_use` record whose tool name is `advisor` and read the `advisor_tool_result` record that follows it,
about two minutes later;
a summary cannot see those records,
so a summary's claim about them is not evidence.
Both sentences stand unchanged.

artifact-3 to artifact-6 LANDED 2026-08-26 in `12b2af6c1`:
`refuseUnknownMember` names kind and field names only;
`parseConsolidation` takes `laneSelection` and holds a settled stage to the contest's slices in order (measured true on
all 28 real artifacts carrying the field first);
the three `POOL` lines name a malformed id or digest by `shapeOf`;
`resolveCommit`,
`tipContains` and `isShallowRepository` take a `repository` seam,
and three new suites cover the git
questions on throwaway histories (`artifact-generation-git`),
`keepEligible` and `parseRegionTally`;
`resolveCommit`
and `keepEligible` are barrel exports marked `@internal`.
Gates:
oxlint `Found 0 warnings and 0 errors`,
`lint:types`
exit 0.
GFP:
six mutations on one build,
each failing only its own cases (the register block names them),
two control
suites green,
restored and passing.
Lesson:
`it` children of one `describe` run concurrently,
so a `console.log`
capture must chain and forward rather than replace and restore,
and each case must filter by its own fixture name.
Whole-suite `buildAndTest` after `12b2af6c1`:
804 PASS,
0 FAIL,
exit 0 (solo run;
the three new suites add four
describes).

rendering-4 to rendering-12 LANDED 2026-08-26 in `744890056` (rendering-4,
5,
6,
7,
8,
9,
10, 12) and `50ffffc07`
(rendering-11):
voice rates read the run's roster and print `asked= answered= lost=`;
relocation candidates print
claim pairs and slice pairs apart;
one client per run;
the four operator refusals are `StatedRefusalError`;
the row
and digest notes say `report` carries document spans;
a negative `--cap` is refused;
unknown category and verdict
words are bounded to one token;
`RenderingAuditInvariantError` stands at the six invariant sites;
two new suites
cover the driver and the report and run both built commands at the boundary.
Gates on both commits:
oxlint `Found 0
warnings and 0 errors`,
`lint:types` exit 0.
GFP is attributed guard by guard in the register block.

REGRESSION SHIPPED AND FIXED WITHIN THE HOUR:
`744890056` exported the two CLI entry modules through the audit
barrel,
which made the bundler fold each into a shared chunk and left the built commands as re-exports whose
`import.meta.main` read false;
`mise run rendering-audit-settled` and `rendering-audit-settled-report` printed
nothing and exited 0 for that one commit.
The boundary cases written for rendering-11 found it;
`50ffffc07` fixed it
by moving the testable halves into `rendering-audit-settled-buy.ts` and `rendering-audit-settled-runs.ts`.
Rule:
nothing an entry module declares may be exported through a barrel;
the boundary cases guard it,
and a marker export
re-added to the barrel fails them.

Two lessons for guards:
a failing `describe` rejects and stops its suite,
so one GFP round may mutate at most one
describe per suite file or later describes never report;
and `it` children of one describe run concurrently,
so a
console capture must chain and forward (recorded under the artifact group).

Whole-suite `buildAndTest` after `50ffffc07`:
814 PASS,
0 FAIL,
exit 0 (solo run;
the three new suite files,
across `744890056` and `50ffffc07`,
add ten describes:
1 + 4 + 5).

CLOSING `#236` (2026-08-26).
The register's closing tally was measured rather than assumed:
a scan of every entry
under "Findings register" for a FIXED,
CLOSED,
folded or tracked marker found three without one.
`provider-14` was
CLOSED already (the scan had not looked for that word);
`provider-1` was fixed with A-1 and lacked only its line;
`calibrate-1`,
a MAJOR tied to `#235`,
still owed the pointer from the calibrations' `WROTE NOTHING AT ALL` sentence
to the `SEAT` report,
which landed in `8bffaba9b` with its guard (`POINTS AT THE SEAT LINES`;
the pointer removed
fails it,
restored passes).
With that,
every entry carries a marker:
3 BLOCKER,
28 MAJOR,
35 MINOR by heading.
NOTE ON THE NUMBER:
`#236` here and throughout this file is the session's task-list item,
"Exhaustive audit of the
translation-repair package";
the GitHub issue numbered 236 is an unrelated,
already closed file-enforcer issue,
so
closing the audit mutates no GitHub issue.
The task-list items `#258` and `#236` are marked completed.

CLOSE VERIFIED (2026-08-26).
Whole-suite `buildAndTest` after `8bffaba9b`:
814 PASS,
0 FAIL,
exit 0 (solo run).
The
advisor checkpoint owed after the rendering group was made at the close;
it judged the close sound pending two
measurements the tally had asserted rather than measured,
and both came back clean.
The marker scan re-run on the
after-state,
with CLOSED in the marker set,
finds every entry marked:
3 of 3 BLOCKER,
28 of 28 MAJOR,
35 of 35 MINOR,
zero unmarked.
The entry-module rule (nothing an entry module declares may be exported through a barrel) was checked
across every built command a `mise.toml` task invokes,
not only the two that regressed:
38 of 38
`dist/final/node/*.mjs` entries carry `import.meta.main`,
with `index.mjs` (the barrel,
not an entry) at 0 as the
control.
No standing test guards this,
by the checkpoint's call:
the sweep is the audit act.
The next checkpoint is
due before `#219`'s AskUserQuestion;
none between `#213`,
`#230` and `#229`.

Queue:
`#213` (arm A and arm B under `mise run` from a worktree carrying the secrets),
`#230`'s recovery rate on the
next run,
`#229` lever 1,
and `#219` (the readiness signal via AskUserQuestion).

`#213` LANDING (2026-08-26).
The overlap dial landed in `ce5ca2368`:
`TRANSLATION_REPAIR_SLICE_OVERLAP` admits that
many slices at a time through `p-limit` in `editor-calibrate.ts`,
unset reproduces the sequential driver exactly,
and
an unreadable value or a value under one is a stated refusal read before the sample is drawn,
so two sequential runs
can never pass as an overlap comparison.
The run client stays shared across slices in flight,
on purpose:
the saved
prototype rebuilt it per slice,
which predates `acfc7ad22`'s once-per-run client,
and the per-model limiter is what
production routes through.
The progress line and the `SliceRounds` type moved to `editor-calibrate-slice.ts`,
numbered
by sample position rather than arrival,
which keeps the entry module at 298 code lines and exports nothing from it.
Guards:
`slice-overlap.unit.test.ts` (four cases,
one describe) and `editor-calibrate-slice.unit.test.ts` (three
cases);
four GFP rounds,
one mutation each:
an unreadable dial falling back to one fails only `REFUSES a value that is
not a number`,
zero admitted fails only `REFUSES zero`,
numbering from zero fails `NUMBERS` and `RENDERS`,
the reach
note dropped fails only `SAYS`;
restored,
both suites pass.
Boundary,
keys stripped:
a dial of `four` exits 6 with the
refusal and no other output;
a dial of `2` prints `1 slices, 10 models editing and judging each, 2 slices in flight`
and then the key refusal;
the built command keeps its `import.meta.main` guard.
Next:
the whole suite (in flight),
then arm A (`TRANSLATION_REPAIR_SLICE_OVERLAP=1`) and arm B (`4`) back to back over four slices under `mise run` from
this worktree,
which carries `.env.local.json`;
`mise env` here lists both key names.
Whole-suite `buildAndTest` after `ce5ca2368`:
816 PASS,
0 FAIL,
exit 0 (solo run).
Both arms were launched back
to back at 2026-08-26T11:08Z into `~/temp/agent/overlap-arm-serial-20260826` and
`~/temp/agent/overlap-arm-four-20260826`,
logs beside them under the same names with `.log`.

`#213` MEASURED (2026-08-26).
Arm A (`TRANSLATION_REPAIR_SLICE_OVERLAP=1`) and arm B (`4`) ran back to back over the
same four slices,
full roster,
both exiting 0,
33 rounds each.
`run-timing-report` on each log:
A,
43.19 min of round
time (sequential,
so also the wall clock),
37.08 min of it waiting after quorum (85.9%),
8 voices never heard,
calls
in flight mean 2.44 peak 10,
1.75 h of calls;
B,
24.19 min of run for 51.96 min of overlapped round time,
46.98 min
waiting (90.4%),
10 voices never heard,
mean 4.31 in flight,
peak 34,
1.74 h of calls.
So the same call time ran in
56% of the wall clock,
and voices heard were 304 against 302 of 312.
Losses by cause:
A,
6 grace cuts (all
`qwen3.8-max`) and 2 `schema-mismatch`;
B,
7 grace cuts (`qwen3.8-max` 4,
`hf:Qwen/Qwen3.8-27B` 2,
`hf:zai-org/GLM-5.2` 1) and 3 `schema-mismatch`,
one of them the same `deepseek-v4-flash-0731` panel answer failing
its re-ask.
QNB CAVEAT:
one run per arm,
and the run-to-run band on an unchanged build is unmeasured,
so the two-voice
difference is not a finding either way;
the wall-clock gain is the arithmetic of one call budget spread over four
lanes while 86% to 90% of every round is waiting,
which a repeat could shrink but not undo.
WHAT IS NOT DECIDED:
whether overlap above one becomes the calibrations' default,
and whether the corpus pass should overlap its slices the
same way;
both are design changes for the owner,
queued for the `#219` question.
Logs and run directories:
`~/temp/agent/overlap-arm-serial-20260826` and `~/temp/agent/overlap-arm-four-20260826`,
read only through their own
templates (`~/temp/agent/compare-arms.py`,
beside the logs it reads).

`#230` PAID (2026-08-26).
Both arms carry `91f0c8ba5`,
and each logged two `recovery round for 1 unreadable answers`
lines:
A recovered both (`panel` and `critic`,
each `1/1 heard`),
B recovered one (`introduced-defect-probe` `1/1`;
`panel` `0/1`,
the same model answering badly twice),
so 3 of 4 re-asked answers came back readable.
The split comment
is CONFIRMED rather than corrected,
and `2829fd4da` records why in `stage-call.ts`:
the only non-`ok` kinds `chatJson`
returns are `refusal-shaped` and `schema-mismatch`,
a stream the idle,
runaway or degeneration guards cut throws into
the not-answered catch,
and a grace-abandoned straggler is classified in `stage-round.ts`;
live,
all four re-asked
voices were `schema-mismatch` and none of the thirteen grace cuts was re-asked.

`#229` LEVER 1,
DIAL LANDED (2026-08-26).
`4c070f729`:
`src/grace-override.ts` reads
`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (unset or empty means the built-in `STRAGGLER_GRACE_MS`;
unreadable or not
positive is a `StatedRefusalError`),
`runGatherRound`'s `graceMs` default resolves through it per call,
and
`editor-calibrate` and `corpus-pass` resolve it first thing and print `STRAGGLER GRACE OVERRIDDEN by ...` when it
differs.
`shippedAuthors` moved to `editor-calibrate-slice.ts` (driver at 297 code lines).
Guards:
nine cases in
`grace-override.unit.test.ts`,
two `shippedAuthors` cases;
four GFP rounds each bit only their own cases (NaN returned
fails the prose and `300s` cases,
zero admitted fails the zero case,
the note inverted fails both note cases,
per-issue authors dropped fails `CREDITS both halves`);
restored,
both pass.
Boundary,
keys stripped:
`five` exits 6
in one line;
`300000` prints the note after the header and then the key refusal;
`corpus-pass --plan` on a throwaway
runs dir prints the note after START and exits 0,
and refuses `soon` with exit 6.
Whole-suite `buildAndTest` after
`4c070f729`:
819 PASS,
0 FAIL,
exit 0 (solo run).
Arm C launched at 2026-08-26T12:23:14Z:
overlap 1,
`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=300000`,
the same four slices,
into `~/temp/agent/overlap-arm-grace-20260826`
with the log beside it;
it is matched against arm A.
The proof that the window reached the rounds is a round with more
than 180000 `ms in grace` or an `abandoned 300000ms` line.
Nothing may rebuild `dist` until it ends;
the whole suite
after `2829fd4da` (a comment-only commit that passed oxlint and `lint:types`) runs then.

SANITIZATION INVENTORY (2026-08-26).
The tracked tree was scanned with the standalone `forbidden-strings` binary
against the built deny-list of 10206 corpus sentences (`~/temp/agent/deny-rules.txt`):
zero findings over the whole
`--all` walk,
validated by a positive control first (one rule written into a throwaway file fired as `rule=0` both
named explicitly and through the same walk from inside the worktree;
the file was deleted at once).
Findings print on
stderr as `PATH:LINE rule=<token>`,
never the text.
The branch carries 2342 commits beyond `main` (merge base
`88ba0ae2e`,
since 2026-07-16).
The proposal behind the `#219` question,
with the four decisions it keeps apart,
is
`doc/planning/translation-repair-readiness-signal.md`.

`#229` LEVER 1 MEASURED (2026-08-26).
Arm C (overlap 1,
`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=300000`,
the same four
slices,
launched 12:23:14Z,
exit 0 at 13:17:15Z) against arm A (overlap 1,
180000):
round time 53.87 min against 43.19
(+24.7%),
waiting after quorum 48.33 min (89.7%) against 37.08 (85.9%),
voices never heard 5 against 8 (306 of 311
heard against 304 of 312;
C ran 32 rounds to A's 33 because it needed one recovery round to A's two),
grace cuts 4
against 6,
all `qwen3.8-max` in both,
one `schema-mismatch` (`critic`,
recovered `1/1`) against two.
The window's
effect is legible in the rounds themselves:
four rounds burned the full 300000 ms (the four cuts),
and two rounds
spent 214010 ms and 263265 ms in grace,
which are voices that arrived after 180000 ms and would have been cut under
the built-in window.
So on this sample the longer window bought back 2 voices of the 6 the built-in one loses,
at
10.68 min of wall clock,
about 5.3 min per voice,
and the other four stragglers reason past five minutes and are cut
anyway.
Under overlap that price changes,
since waiting after quorum is what overlap fills:
a longer window under
overlap 4 was not run and would be the arm to run if overlap becomes the default.
QNB:
one run per arm again;
the two
180000 arms cut 6 and 7,
so C's 4 sits below both and the two in-band rounds are direct evidence rather than a
difference of totals.
The dial stays opt-in and `STRAGGLER_GRACE_MS` stays 180000 until the owner decides (question 4
of the readiness signal).
Log and run directory:
`~/temp/agent/overlap-arm-grace-20260826`.

Whole-suite `buildAndTest` after `2829fd4da` (the last code commit),
run after arm C as the final gate before the
readiness signal:
819 PASS,
0 FAIL,
exit 0 (solo run).
The advisor checkpoint before `#219` was made and asked
for this verdict to be read first,
the status head refreshed,
the arm reader kept beside its logs,
and question
2 scoped to `editor-calibrate`;
all four are in this commit.

THE OWNER'S ANSWERS TO THE READINESS SIGNAL (2026-08-26,
the first genuine user input since the audit began;
quoted
verbatim).
Readiness:
"Not yet.
You didn't even look at its actual output."
Overlap default:
"Measure the run-to-run
band first (repeat arm A)".
Pass overlap:
"Build the dial into the pass and measure it there;
default stays 1 until
measured".
Window:
"Run arm D (overlap 4 at 300000 ms) before moving it".

WHAT THE REJECTION MEANS.
Every gate the signal rested on was a process gate:
guards,
suites,
wall clock,
voices
heard,
scan results.
Nobody in this session read what the pipeline PRODUCES,
the published `*.en.md` pages and the
shipped text inside settled artifacts,
against the Chinese source and the archive English.
That reading is now the
first item,
ahead of the three measurements the other answers authorize,
and readiness is not to be claimed again
until the output has been read and the reading recorded.
The three authorized measurements:
arm A repeated as arm A2
(overlap 1,
built-in window,
same four slices) to size the run-to-run band;
arm D (overlap 4,
300000 ms) to reprice
the window under overlap;
the overlap dial built into the corpus pass's drivers,
default 1,
then measured on the pass
with matched runs.
Both arms launch back to back and solo,
since a concurrent run would share provider slots and spoil
the band.

THE OUTPUT READING (`#259`,
2026-08-26) is `doc/audit/translation-repair-output-reading-20260826.md`:
four published
pages from the 2026-08-22 and 08-24 builds read sentence by sentence against source and archive,
six defect classes no
gate measures (comma splices and present tense for the dead,
in-page terminology drift,
the handle used as a name,
伙伴
rendered "partner",
U+2011 and U+2019 introduced by models,
a source hyperlink lost by inheriting an archive
sentence),
and tasks `#263` (the calibration coverage sentence misdiagnoses a seat that answered every ask as silent;
found by reading arm A's printed report,
whose SEAT line contradicts it),
`#264` (introduced punctuation),
`#265`
(source hyperlinks lost).
The four-slice EDITOR standing swings by twenty points between identical runs (GLM-5.2 52.2%
in A,
26.7% in B,
10.0% in C),
so a four-slice standing is noise;
that goes into the band answer.
Next:
after the
arms,
a `corpus-pass --only` over the six entries of the 08-20 reading plus `wangzihao980` and `dogesir_` into a
throwaway runs dir on the current build,
read the same way.
