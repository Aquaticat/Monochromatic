# Translation repair history: 2026-08-26 audit, part 01

Part 01 of [Translation repair history: 2026-08-26 audit](translation-repair-history-11-2026-08-26-audit-segment-01.md),
whose index lists every part in order.

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
