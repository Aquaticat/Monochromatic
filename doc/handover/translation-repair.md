# Translation repair session handover

Status:
the two-lane pipeline is built and publishing;
the whole-package audit (`#236`) has reported on all ten slices, and every MAJOR it filed (`#237` to `#257`)
is landed, GFP-proven and recorded under "State of the tree";
the three doc passes (A-4, A-5, A-6) are done, and the register's MINORs are being worked in register order:
every group from calibrate through rendering is landed (`acfc7ad22` to `8bffaba9b`) and `#236` is CLOSED;
`#213`, `#230` and `#229` are measured on matched arms and closed; `#219`, the readiness signal, is next.
`doc/planning/translation-repair-open-decisions.md` has every question answered; it is kept for the evidence.

WHAT THIS FILE IS.
What a session starting today needs, and nothing else.
Capped at two thousand lines.
When it reaches that cap, its oldest sections move verbatim into
`doc/handover/translation-repair-history.md`, which has no cap.

WHY THE SPLIT.
This file reached twenty thousand lines, at which point it stopped being a handover
and became an archive nobody could read at the start of a session.
The history keeps every measurement; this keeps the working set.

THERE IS NO RELEASE DEADLINE.
The owner withdrew the one that used to sit here, on the grounds that being aware of it
made the work worse: it bought lower quality and, more than once, took longer anyway.
Do not reintroduce a date, do not infer schedule pressure from anything in the archive,
and do not let "time remaining" enter any decision. Quality is the only standing constraint.

ADVISOR IS A STANDING INSTRUCTION.
The owner has asked for it twice, the second time in these words:
"Please call advisor as usual. This is standing instruction."
Call `advisor` at the normal checkpoints:
before committing to an approach, when stuck, when changing approach,
and once more before declaring anything done.
An earlier session barred the tool on the grounds that it forwards the whole transcript
and the transcript names corpus entries from an unlicensed archive.
That bar is superseded and must not be reinstated.
The owner knows what the transcript carries, has said so about this corpus more than once,
and has made the call.
Re-raising it at every invocation is the failure mode to avoid:
the concern is recorded here once, and that is the whole of it.

WHAT BELONGS HERE.
Open tasks and their state, decisions still in force, defects not yet fixed,
and any measurement a reader would otherwise re-run.
What belongs in the history: closed work whose conclusion is already encoded in the code,
and superseded reasoning kept only for its evidence.

## AUDIT IN PROGRESS: the whole package, before any new work (`#236`, 2026-08-26)

The owner's instruction, sent mid-turn, verbatim:
"Do an exhaustive audit of the package so far.
Focus on existing issues rather than branching into new ones for now,
until you're confident there are no big existing issues."
And, separately: "Update handover more aggressively."
Both are in force.
No new feature, lever, or measurement run starts until the audit closes;
fixing an existing defect is in scope, and `#235` is finding one.

### Baseline, measured at `b20120fbb` before anything was touched

- `lint:types`: exit 0.
- `lint:oxlint`: 0 warnings, 0 errors, 965 files.
- `buildAndTest`: exit 0, 750 suites `] PASS `, 0 `] FAIL `,
  log `~/temp/agent/audit-buildAndTest-20260826T024842Z.log`.
- Source: 532 files, 150304 lines.
  Tests: 432 files, 146083 lines.
- 138 source files have no sibling `<name>.unit.test.ts`.
  That heuristic overcounts, since a test elsewhere may cover them;
  it is refined per file during the audit rather than trusted.

### Method

The source is partitioned into ten slices, every file in exactly one:
`provider`, `translate`, `repair`, `probes`, `calibrate`, `consolidate`, `document`,
`artifact`, `slices`, `rendering`.
File lists: `~/temp/agent/audit-slices/<slice>.txt`.
Each slice is read in full by a forked reviewer under seven lenses:
silent failure (the `#235` class), wrong output, resilience under provider failure,
corpus or key leakage, contract drift between prose and code,
repo-rule violations the linters cannot see, and test-coverage gaps.
Reports land in `~/temp/agent/audit-<slice>.md`.
Every BLOCKER and MAJOR finding is re-verified at the cited line by the main session before it is recorded;
a reviewer's word is a lead, not evidence.
The verified, ranked result lands in `doc/audit/translation-repair-package-audit.md`,
one task per BLOCKER or MAJOR, fixes in rank order after that.
That register is open as of `918d9a8b3` with the baseline, the whole-package mechanical sweeps
(all clean: no forbidden request fields, zero debt markers, every suppression justified,
no banned constructs, 38 of 38 CLIs wrapped), the documentation layer,
and six verified findings `A-1` to `A-6`; read it before this section.
Running tally, 2026-08-26 after all ten slice reports, every BLOCKER and MAJOR re-verified at the cited line:
2 BLOCKER (A-1 fixed as `#235`; probes-1 open as `#247`),
21 MAJOR (A-2 fixed with `#235`; `#237` to `#246` and `#248` to `#251` from the first six slices;
`#252` corpus read failures drop entries silently; `#253` a transient picture-reader failure is cached as permanent;
`#254` a CRLF original disables the line-structure family;
`#255` the rendering audit's provenance verdict is void on roster-paired artifacts;
`#256` valueless `--run` and `--against` read as absent; `#257` the round-three instruments cannot read their own draw;
six more folded into `#237`, `#238`, `#246`, `#249`),
and roughly seventy MINOR, all in `doc/audit/translation-repair-package-audit.md`.
Fix order after `#235`: `#247` (an instrument that lies), then the MAJORs in task order, then the MINORs.
Advisor's adjustment, adopted: `#235` lands as soon as the `provider` and `calibrate` slice
reports are verified, not after the whole audit, because those two slices hold every file the fix touches.

### Prior-session claims overturned so far, each against a primary source

1.  `#235` cause.
    Recorded as "in `budget-routing.ts`, not yet located"; that file is correct.
    The cause is `createRunClient`'s unkeyed-Hyper fallback plus a launch without secrets.
    Details under the OPEN DEFECT section, which is corrected in place.
2.  Round count.
    Recorded as twenty-two; the log holds twenty-five, all `5/10`.
3.  Subagents.
    The compaction summary carried "no subagents unless the user asks".
    The transcript holds the owner's standing instruction, verbatim:
    "For speed: If you have work you can defer to a Sonnet 5 subagent in parallel, defer to it."
    Forks carry the audit's reading; verification stays with the main session.
4.  Fork secrets.
    Recorded as "fork worktrees have none";
    this worktree's `.env.local.json` is byte-identical to the main worktree's (`cmp`, 2026-08-26).
    The half-dark run was launched with bare `node`, which is what left the key unset;
    `mise run` from this worktree injects both keys.
5.  Silence.
    Recorded as "nothing above warn";
    the calibration's closing coverage line named the five seats
    (`WROTE NOTHING AT ALL: ... covers 5 of 10 seats`), without counts or cause.
    Recorded as calibrate-1 in the register.

### Found while auditing, unfixed, owed

- FIXED in `8b289c3ab`: `RunConfigError` extends `StatedRefusalError`,
  so a missing key is repeated by name at exit 6 with no frames (negative control run, 2026-08-26).
- This file is 3463 lines against its own 2000-line cap.
  The trim into `translation-repair-history.md` is owed in the audit's documentation pass.

### State of the tree

Worktree `/var/home/user/worktrees/translation-repair`, branch `translation-repair-rebased`,
HEAD `bf7d6afbd` (`#247`), clean.
`#235` verified live 2026-08-26 (`editor-calibrate -- 1` under `mise run` from this worktree, exit 0):
rounds `10/10` three times and `9/10` twice, zero `hf: prefix` refusals, all ten seats asked five times,
nine usable five of five, `qwen3.8-max` usable three and thrown two, no `SEATS DARK:` line.
The run wrote its `SEAT` lines to stderr and its `METERS` and `round:` lines to stdout;
its throwaway runs directory is named in `~/temp/agent/vub-calibrate-current.txt`.
`#247` verified live 2026-08-26 (`probe-sensitivity` under `mise run`, exit 0, output under
`~/temp/agent/vub-sensitivity-*`): eighteen `SENSITIVITY` lines with `list=` and `issue=`, three checker seats
usable eighteen of eighteen, no dark seat; the rendered prompt measurably silences two of three probers on
`deletion/mislabelled` (`removal=1`, `preExisting=2`) where the withheld prompt raises `removal=3`,
and the screen moves nothing on any region.
`#257` landed in `f199b70cf` and `bab444350` (HEAD):
the round-three instruments read legacy artifacts from the root again.
Note for the record: `f199b70cf`'s message overclaimed, one of its two legacy cases was failing when committed;
`bab444350` fixed the fixture and says so in its message, per the no-amend rule.
`#257` verified live 2026-08-26 (`probe-relabel` under `mise run` against the round-three draw, exit 0,
output under `~/temp/agent/vub-relabel-*`): 5 damaged regions and 10 controls rebuilt, each under all three arms,
three checker seats 45 of 45 usable, no dark seat; that run is also the relabel half of `#247`'s verification.
No run is in flight.
`#237` landed in `c19d203c6` (lint tidy `82db8fb4e`, HEAD): the four stdout printers go through `refusalText`,
and the two comparison checks name differing fields instead of quoting rows.
`#238` landed in `1a96979ad` (HEAD): a silent stage is neither cached nor resumed, and this worktree's caches
were scanned clean (150 files, none carrying the finding).
The day's first whole-suite `buildAndTest` (after `#238`) failed 6 of 764 suites that the per-commit single-suite
runs had not covered: the marked-class inventory (`message-names-only.unit.test.ts`) did not list the two new
stated refusals, `RunConfigError` forwarded an arbitrary message while inheriting the marker, and a Synthetic wire
test asked the Synthetic client for a Charm Hyper label. Fixed in `6d19c68a0` (`RunConfigError` now writes its own
sentence from a variable name); a second whole-suite run is in flight to confirm 0 failures.
LESSON, in force: a fix is not landed until `buildAndTest` passes whole; the per-suite runs after each commit are
necessary and not sufficient, because inventory-style suites read the whole source.
The second whole-suite run, at `6d19c68a0`, passed 759 of 759.
`#239` landed in `7103ae59c`: a sole-adopted envelope records an `adopted` round and keeps its authors;
the whole suite passed 759 of 759 behind it.
`#240` landed in `fd8ac6c7e`: the re-ask takes the Synthetic slot it releases; the whole suite passed 759 of 759.
`#241` landed in `bbbd5f2c5` and `995b76f30`: the roster-to-catalog proof is a value and a test;
the whole suite passed 760 of 760.
`#242` landed in `3bc37b4f1`: a tool answer is kept apart from the prose written before it;
the whole suite passed 760 of 760.
`#243` landed in `caee057fd`: stale-lock eviction is a rename and release is owner-checked;
the whole suite passed 760 of 760.
`#244` landed in `0fb6a8ad8`: the marked size refusal keeps the gateway's words off its message;
the whole suite passed 761 of 761.
`#245` landed in `4eaa89ede`: pairing agreement is counted over every voice's pairs, strictly increasing;
the whole suite passed 762 of 762.
`#246` landed in `b00f9d3b2`: ledger files are named per launch, so a relaunch appends;
the whole suite passed 763 of 763.
`#248` landed in `b88d6a947` (HEAD): the damage sheet tells its grader it mixes flagged and silent items,
and the two ungraded sheets on disk were reframed in place; a whole-suite run is in flight.
EXPECTED REBUY, not a cache defect: `#245` changed what the pairing stages emit, so the pipeline digest moves and
every pairing cache (`pairing.` and `section-pair.` namespaces) retires on the next run; the first run after it
buys every pairing round again, once.
Advisor checkpoint 2026-08-26 (after `#248`): the queue through `#248` needs no reopening; for `#249` and `#255`
record the section pairing in the artifact the way `blockPairing` was recorded (omitted when nobody was asked,
named absence on read, no generation bump if exact-keys tolerates an absent listed key), carve the two probes
from settled artifacts through one shared helper, give the rendering verifier a third outcome `unverifiable`
for artifacts without a stored section pairing, and label the census's artifact-less rows as the deterministic
baseline. Build order: the preparation field and helper, then `#255`, then `#249`, then `#250`.
The owed doc passes (A-4, A-5, A-6) stay queued behind the MAJORs and close `#236`.
`#249` and `#255` LANDED 2026-08-26 in three commits, each GFP-proven and gated on types, oxlint and the touched
suites before commit: `26f346de8` (the artifact records `preparation.sectionPairing` as `deterministic` or
`supplied`, always written, read as `unrecorded` on older files; guards fail 2, 3 and 4/7 cases), `d2c580995`
(`rebuildPreparation` and the three-outcome provenance verdict `verified`/`refused`/`unverifiable`; guards fail 2
cases each), `459482191` (`settled-carve.ts`, both probes walk settled entries, the census labels its rows and
opens with `CENSUS carve:`; guards fail 2, 3, 2 and 2 cases).
POPULATION FACT learned at the boundary: this worktree's runs directory (`node_modules/.monochromatic/
translation-repair-runs/artifacts`) holds 56 LEGACY artifacts, none two-lane, so the probes carve nothing there;
`~/translation-repair-runs-20260817` holds 6 two-lane artifacts and `~/translation-repair-runs-flagged-20260818`
holds 5, none with a recorded pairing half, and `~/translation-repair-v2-archive` holds 4 nested ones.
Point an instrument at a population with `TRANSLATION_REPAIR_RUNS_DIR=<dir> mise run ...`; the 2026-08-17 directory
carved 6 of 6 (all halves defaulted), the census reported 6 settled-partial rows and 86 baseline, and one capped
fidelity trial ran over it with all ten seats usable (logs under `~/temp/agent/vub-*-current.txt`).
Every artifact a future pass writes records `sectionPairing`, and `blockPairing` whenever the roster shell ran, so
the complete-recipe path is exercised by the next settled pass; until then every rebuild names its defaulted halves.
Whole-suite `buildAndTest` after `459482191`: 769 PASS, 0 FAIL, exit 0 (`~/temp/agent/buildAndTest-current.txt`).
`#250` LANDED 2026-08-26 in `2c9886a55`: the recall scorecard is kept under `recall-scorecard/<stamp>-<tip>.json`,
written atomically; GFP fails 4 of 4 cases under either mutation; plan mode verified at the boundary.
Whole-suite `buildAndTest` after `2c9886a55`: 770 PASS, 0 FAIL, exit 0.
`#251` LANDED 2026-08-26 in `a8bc69508`: no slate is bought for a slice with no standing text; GFP fails 2 cases
with the refusing client's throw when the purchase is restored.
Whole-suite `buildAndTest` after `a8bc69508`: 770 PASS, 0 FAIL, exit 0.
`#252` LANDED 2026-08-26 in `8af2b2bde`: `CorpusReadError.kind` (`missing-object` or `other`, measured off git
2.55's stderr), `isMissingCorpusObject` as the one steppable failure in all five catchers, and the pass's walk in
`pass-eligibility.ts` printing `INCOMPLETE <id>: <side> page absent at the pin (...)`; GFP fails 2 and 3 cases
under the collapsed classifier and 2 under the re-widened catch.
Whole-suite `buildAndTest` after `8af2b2bde`, first run: VOID, and the line committed in `4e23e3d5c` claiming
"730 PASS, 0 FAIL, exit 0" was WRONG (the exit was 1; the "exit 0" was typed, not read). The run reported
`test files failed:` for 29 files, each with `ERR_MODULE_NOT_FOUND` on a hashed dist chunk, because the plan-mode
boundary run (`mise run ...:corpus-pass -- --plan`, whose task depends on `build`) was launched concurrently and
rewrote `dist/` at 06:31:44Z, inside the suite's window.
Solo rerun of `buildAndTest` after `8af2b2bde`: 771 PASS, 0 FAIL, exit 0 (read from the runner's exit, then counted).
LESSON: never launch a mise task that depends on `build` while `buildAndTest` is running; the suite imports hashed
chunks from `dist/` and a concurrent build deletes the ones it holds. Count verdicts by the runner's exit code first
(TLY); a PASS count with a non-zero exit is the count's bug.
Plan mode over the real corpus (that concurrent run) printed exactly one `INCOMPLETE` line (the one one-sided
entry, its source page absent) beside `pending=92` and `PLAN ok`; that measurement stands.
`#253` LANDED 2026-08-26 in `17bcaf46c`: a pair verdict resting on a transient reader failure is marked
`transient`, is not persisted, and is refused on resume together with every record from before the field; GFP fails
3 and 2, 2, and 3 cases under the three mutations.
Whole-suite `buildAndTest` after `17bcaf46c`: 772 PASS, 0 FAIL, exit 0 (solo run, nothing else building).
`#254` LANDED 2026-08-26 in `7a2a21ed8`: CRLF is folded to LF at `readCorpusFile` (141 endings on the one such page,
1 block before and 45 after), the block splitter folds again, and the invisible-line mask judges around the return;
GFP fails 2 cases under each of the three mutations.
Whole-suite `buildAndTest` after `7a2a21ed8`: 773 PASS, 0 FAIL, exit 0 (solo run, nothing else building).
`#256` LANDED 2026-08-26 in `68062ccf7`: the report reads `--run` and `--against` through the args module's refusing
reader; GFP fails 3 cases under a lenient reader; the CLI refuses `--run` written last with exit 6 and no frames.
Whole-suite `buildAndTest` after `68062ccf7`: 774 PASS, 0 FAIL, exit 0 (solo run, nothing else building).
EVERY MAJOR FROM THE AUDIT IS LANDED (`#237` to `#257`).
The three doc passes LANDED 2026-08-26: A-6 in `70a520e7b` (six test names lose their verdict word), A-4 and A-5 in
`2e67f872a` (open-decisions status lines; twenty-five handover sections aged into the history).
The calibrate MINORs (calibrate-3 to calibrate-10) LANDED 2026-08-26 in `acfc7ad22`, each recorded under its entry
in the register: a stated refusal in the width control, `MislabelledArtifactError` and `PublishedPageDisagreesError`
marked (the second rebuilt in `published-page-disagreement.ts` from a typed disagreement, because the inventory
refuses the marker to a class that forwards a caller's sentence), one client per calibration run, the trial's streak
as `streakAfter` in `window-trial-protocol.ts` (a held slice no longer resets it), line-ending stops in the control's
cut, a three-way `verify-published` closing line, and suites for the four modules no test reached. GFP: the streak
mutation fails 2 cases, each unmarking fails the same 2 inventory cases, the listing filter fails 3 pass-settled
cases, the array check 1 census case, the blank rule 1 arm case, the terminators 1 control case and the bare `Error`
1 usable case; every restore passes. The census suite found a JSON array filed as an unversioned generation; it is
`malformed` now. `pass-settled.ts`'s listing is renamed `artifactBackedIds` (the bundle already exported a
`settledEntryIds` for the published tree). calibrate-5 and calibrate-8 have no unit guard (client construction is
unobservable; `verify-published` has no suite), and the register says so; the new closing line was read at the
boundary over the 2026-08-17 directory (`0 of 0 ... 0 UNWEIGHED`, exit 1, no published tree there).
Whole-suite `buildAndTest` after `acfc7ad22`: 781 PASS, 0 FAIL, exit 0 (solo run, read from the runner's exit).
The provider MINORs (provider-7, 9, 10, 12, 13, 14) LANDED 2026-08-26 in `2376b7d14`, each recorded under its entry:
a budget refusal on the re-ask keeps the first answer and starts the cooldown on that call (`replyOrBudgetRefusal`),
the drift check's catalog list is read off `SYNTHETIC_MODELS`, the run configuration's seat history is dated past
tense under the current seating, the lock and the git probe log through tagged loggers with the lock's `wx` handle
under `await using`, and a round line whose ratio is not two whole numbers is unreadable rather than NaN. GFP: the
re-ask guard, the ratio guard and the catalog guard each fail exactly their one case under mutation and pass
restored; provider-10 and provider-12 are prose and structure with no guard, and provider-14 is closed by the MAJOR
landings' own guards.
Whole-suite `buildAndTest` after `2376b7d14`: exit 1, 782 PASS, 2 FAIL. The sink suite's LOCK case still read the
lock's unreadable line off `console.log`, which provider-12 had moved to the tagged logger; `c7f2a5075` makes its
collector wrap the logger's console methods. The register's provider-12 paragraph had claimed no test read the
line, on a search anchored on the old prefix; corrected there.
Whole-suite `buildAndTest` after `c7f2a5075`: 782 PASS, 0 FAIL, exit 0 (solo run).
Repair MINORs, first half (repair-2, repair-4, repair-7, half of repair-9) LANDED 2026-08-26 in `d7c707cc3`:
the phase's abort check before its persist (whose case pins the behaviour but cannot show the line failing, since
the stages already throw on an aborted signal; recorded as such), `UnpreparedSliceError` refusing an unprepared
outcome before any call in both the phase and the step, the stale comment, the refiner roster's honest type, and
suites for `repair-not-applicable`, `repair-unheard` and `editor-proposals` (GFP: 1 case each under mutation).
Repair MINORs, second half (repair-5, repair-6, repair-8, the rest of repair-9) LANDED 2026-08-26 in `9135037e8`:
six prompts fence by content through `selectFence` (each with a setext-underline case; `edit-prompt` gets its
first suite), the two position-only refusals write their sentences from typed claims and faults and carry the
marker, typography is restored before the apply gate's checks and before the refine gate reads a rewrite, and
`settleChunkFromChecks` has a case. GFP: six fence cases, two inventory cases, the apply-gate case and the credit
case each fail under their mutation and pass restored; the refine gate's half has no case that turns on quote
style and is recorded as owed in the register. A first attempt exported `ChatMessage` from the package's own
index and broke the build (the type belongs to `module-llm-type`; the suites import it from there now).
Whole-suite `buildAndTest` after `9135037e8`: 794 PASS, 0 FAIL, exit 0 (solo run).
Translate MINORs LANDED 2026-08-26: translate-4 and translate-5 in `732d7fb41` (the stage note and the version 6
paragraph), translate-6 in `8e10cfa19` (retry, slice attempt and assembly suites on the branches the register
named; GFP fails 2, 1 and 1 cases under mutation, passes restored); translate-3 was closed by `#237`.
Whole-suite `buildAndTest` after `8e10cfa19`: 797 PASS, 0 FAIL, exit 0 (solo run).
Probes MINORs (probes-7 to probes-13) LANDED 2026-08-26 in `ebc53f24f`: whole-roster prose, one check per prober
per region with a skipped region uncertain, a refusing atomic sheet-pair writer, control slices stamped from the
finished order, the README naming the two corpus-quoting outputs and the fidelity rows persisted, `refusalText`
in bench rows with `CallTimeoutError` as the marked deadline reason, and a `writeBenchReport` suite; GFP fails one
case each for the screen, the sheet writer, the report writer and the inventory, passes restored.
Whole-suite `buildAndTest` after `ebc53f24f`: 800 PASS, 0 FAIL, exit 0 (solo run).
Consolidate MINORs (consolidate-2 to consolidate-10) LANDED 2026-08-26 in `f83e9b449` and `c27dfa297`: stated
refusals over pre-grades and sheets with an index-presence and a printed-number check, the recall bench refusing
zero denominators, `ConsolidationLedgerGapError`, `describeAbandon` naming classes, four prose fixes, a produce
suite, and a gate ballot surviving a mistyped list; GFP fails one to two cases per guard under mutation and
passes restored. The gate's two-ballot bar stays an open design question in the register.
Whole-suite `buildAndTest` after `c27dfa297`: 803 PASS, 0 FAIL, exit 0.

Document MINORs (document-5 to document-12) LANDED 2026-08-26 in `8ac0fff65`, with the entry-filter suite tightened
to assert `StatedRefusalError` in `b19bd23b0`: the unread-signals doc names the live aligner, `--only` refuses as a
stated refusal, `REFUSAL_ASK_LIMIT` cites the `#124` measurement, a `quote-not-found` finding carries the needle's
length and Latin token count and never its text, the three dead reading helpers are deleted, four accumulator
rebuilds are single passes, the footnote overflow is a marked class, and both image decoders log their refusals.
GFP: six mutations (text quoting restored, identifier start shifted, closing `closeWord()` dropped, atom slice
shortened, marker removed, bare `Error` restored) failed 5, 2, 2, 4, 3 and 4 cases in their own suites; all
restored, all six suites pass. Whole-suite `buildAndTest` after `b19bd23b0`: 800 PASS, 4 FAIL, exit 1:
`benchmark.unit.test.ts` and `critic-wire.unit.test.ts` still pinned the quoted `quote-not-found` reason; both
expectations moved to the counted form in `65cca20fc` (lesson: before landing a template change, `rg` the template
across every suite, not only the suites of the touched modules). Whole-suite rerun after `65cca20fc` is in flight. The
advisor checkpoint owed since the calibrate
group was made at the start of this group's GFP; it confirmed the chain and asked only that the tightened test be
committed before the mutation batch, which it was.

Whole-suite `buildAndTest` after `65cca20fc`: 800 PASS, 0 FAIL, exit 0 (three describes fewer than the 803 after
`c27dfa297`: the three deleted reading helpers took theirs with them).

Slices MINORs, first half (slices-4, 5, 7, 8, 9) LANDED 2026-08-26 in `c2d2473db`: the slice-cache discard notice
goes through the tagged logger (`discardNamespace` tag); the unreachable proportional merge loop in `slice-pair.ts`
is deleted with `totalRunChars` and the TSDoc names the three live shapes (aligned, insertion, one-sided);
repetition containment compares whole words through `holdsPhrase` in both `assembly-repetition.ts` and
`assembly-adjacent-repetition.ts`; the rendering-audit anchor type is `RenderingAuditSpanAnchor`, so the root
barrel exports one `SpanAnchor`; the draw's three reconcile refusals are `DrawReconcileError`
(`corpus-run/draw-reconcile.ts`), marked, naming the entry (deliberately, as `INCOMPLETE` lines do) and the counts,
with the stray value's `typeof` name in place of its `JSON.stringify`. GFP: `console.log` restored fails `COUNTS what
it removed and NAMES who filled it` (the case asserts the `[discardNamespace]` tag); plain `includes` restored fails
both new `KEEPS` cases; the marker removed fails the two inventory cases; a bare `Error` restored fails `REFUSES as
DrawReconcileError`; all restored, all five suites pass. slices-5 and slices-8 have no runtime guard (a deletion and a
type rename; `lint:types` is the guard). Whole-suite run after `c2d2473db` is in flight.

slices-6 is NOT landed and is the open item: the nine index-and-count classes (`SliceDeliveryError` 17 sites,
`DeliveryCoherenceError` 10, `DeliveryInvariantError` 5, `SliceCoverageError` 4, `LaneSliceCoverageError` 13 across
three files, `LaneComparisonError` 11, `SliceIndexingError` 4, `SliceRecordContradictionError` 3,
`AssemblyContractError` 13) all forward a caller's `message`, which the inventory's forwarding rule forbids marking
(`StatedRefusalError` is the sole documented exception). The reviewer's fix shape (add the marker) is therefore not
available. The boundary prints `refused by <Class>` and frames only (`framesOf` keeps `at ` lines), so the loss is
real: an invariant violation reaches the operator without its slice index. The candidate fix is the calibrate-9 and
repair-6 shape, typed fault unions with the sentence written in the class's module, per class.

Whole-suite `buildAndTest` after `c2d2473db`: 800 PASS, 0 FAIL, exit 0.

slices-6 part one LANDED 2026-08-26 in `9f0145fcb`, on the advisor's verdict (typed fault unions per class, the
`DrawReconcileError` shape, smallest classes first, one commit per batch): `SliceRecordContradictionError` takes
`{ lane, sliceIndex, changed }`; `SliceIndexingError` (`SliceIndexingFault`, `indexingSentence`),
`SliceCoverageError` (`SliceCoverageFault`, `BlockPlacementFault`, `coverageSentence`, `blockPlacementSentence`)
and `DeliveryInvariantError` (`DeliveryInvariantFault`, `deliveryInvariantSentence`) take a fault union and word
it in their own module; all four marked and in the inventory, exported through `document-barrel.ts` and
`pipeline-barrel.ts`. Block ids are the parser's positional `block/N` tokens (`document-node.ts:241`), recorded on
the fault type. Each suite gained a `WORDS its refusal` case pinning the sentence and the marker. GFP: the marker
removed from `SliceCoverageError` fails three inventory cases; a word dropped from `indexingSentence`, the two
phrases swapped in the record class, and the separator changed in `deliveryInvariantSentence` each fail their
suite's `WORDS` case (the record suite also fails `REFUSES rather than discards`); all restored, all five suites
pass. Lint lesson: `super(\`${sentence(...)}\`)` trips `no-unnecessary-template-expression`; a class whose whole
message is one sentence call passes it bare, and the inventory scanner treats a bare call as its own sentence with
no parts to name. Remaining: `DeliveryCoherenceError` (10 sites), `LaneComparisonError` (11),
`LaneSliceCoverageError` (13, three files), `AssemblyContractError` (13), `SliceDeliveryError` (17).

slices-6 part two LANDED 2026-08-26 in `95882d3fe`: `DeliveryCoherenceError` (`{ sliceIndex, fault }`, eight kinds,
`coherenceSentence`), `LaneComparisonError` (`lane-comparison-fault.ts`, `comparisonSentence`),
`LaneSliceCoverageError` (`NamedSliceSetLabel`, `SET_CLAUSES`, `laneCoverageSentence`; `NamedSliceSet` lost its clause
fields and the sets suite's fixtures with them), `AssemblyContractError` (`assembly-contract-fault.ts`,
`assemblySentence`), `SliceDeliveryError` (`slice-delivery-fault.ts`, which now holds the class; `deliverySentence`).
`slice-delivery.ts` was at 302 code lines and is split: `slice-delivery-decide.ts` holds `SliceDelivery`,
`decideDelivery` and `nonNullishAccepted`; `slice-delivery.ts` re-exports the type and the class. `pipeline-barrel.ts`
was at 303 and the four lane blocks moved to `lane-barrel.ts`, star-exported from `index.ts`. GFP: the marker removed
from `SliceDeliveryError` fails three inventory cases; a word dropped from `coherenceSentence` fails `WORDS` and
`REFUSES a gap that carries wording anyway`; the clause dropped from `comparisonSentence`, the wrong clause looked up in
`laneCoverageSentence`, and the two numbers swapped in `assemblySentence` each fail their suite's `WORDS` case; all
restored, all six suites pass. The register carries the slices FIXED block. Whole-suite `buildAndTest` after
`95882d3fe`: 800 PASS, 0 FAIL, exit 0 (solo run).

Advisor checkpoint before the artifact group MADE 2026-08-26T09:26Z. Verdict: proceed. Its constraints on the artifact
group: a malformed `id` or digest is named by shape (`typeof`, length, digits only), never echoed, since a malformed
id is not an entry id and the deliberate-print license does not reach it; the consolidation reader mirrors the contest
and index-set readers (the settled set equals the contest's settled set and is strictly increasing);
`refuseUnknownMember` becomes a structural `never` throw printing `kind` and `Object.keys` only; the four untested
functions get cases on `mktemp -d` plus `git init` throwaway repositories, with a real `--depth 1` clone for the
shallow throw, never the pinned corpus clone; the reviewer's `#238` answer inside the entry is prose to acknowledge,
not a fix to build. Next checkpoint: after the rendering group lands and before `#236` closes.

A compaction summary written after `36235af97` claimed no advisor tool existed and that the advisor sentences in this
file were fabricated. That claim is wrong: the transcript records 390 `server_tool_use` advisor calls this session; on
2026-08-26 most returned no result (provider trouble), and the results that landed sit at 08:38Z (between
`8ac0fff65` and `b19bd23b0`), 09:00Z (before `9f0145fcb`) and 09:26Z (this checkpoint). A future session doubting a
checkpoint verifies it against the transcript's `server_tool_use` parts rather than rewriting this file.

artifact-3 to artifact-6 LANDED 2026-08-26 in `12b2af6c1`: `refuseUnknownMember` names kind and field names only;
`parseConsolidation` takes `laneSelection` and holds a settled stage to the contest's slices in order (measured true on
all 28 real artifacts carrying the field first); the three `POOL` lines name a malformed id or digest by `shapeOf`;
`resolveCommit`, `tipContains` and `isShallowRepository` take a `repository` seam, and three new suites cover the git
questions on throwaway histories (`artifact-generation-git`), `keepEligible` and `parseRegionTally`; `resolveCommit`
and `keepEligible` are barrel exports marked `@internal`. Gates: oxlint `Found 0 warnings and 0 errors`, `lint:types`
exit 0. GFP: six mutations on one build, each failing only its own cases (the register block names them), two control
suites green, restored and passing. Lesson: `it` children of one `describe` run concurrently, so a `console.log`
capture must chain and forward rather than replace and restore, and each case must filter by its own fixture name.
Whole-suite `buildAndTest` after `12b2af6c1`: 804 PASS, 0 FAIL, exit 0 (solo run; the three new suites add four
describes).

rendering-4 to rendering-12 LANDED 2026-08-26 in `744890056` (rendering-4, 5, 6, 7, 8, 9, 10, 12) and `50ffffc07`
(rendering-11): voice rates read the run's roster and print `asked= answered= lost=`; relocation candidates print
claim pairs and slice pairs apart; one client per run; the four operator refusals are `StatedRefusalError`; the row
and digest notes say `report` carries document spans; a negative `--cap` is refused; unknown category and verdict
words are bounded to one token; `RenderingAuditInvariantError` stands at the six invariant sites; two new suites
cover the driver and the report and run both built commands at the boundary. Gates on both commits: oxlint `Found 0
warnings and 0 errors`, `lint:types` exit 0. GFP is attributed guard by guard in the register block.

REGRESSION SHIPPED AND FIXED WITHIN THE HOUR: `744890056` exported the two CLI entry modules through the audit
barrel, which made the bundler fold each into a shared chunk and left the built commands as re-exports whose
`import.meta.main` read false; `mise run rendering-audit-settled` and `rendering-audit-settled-report` printed
nothing and exited 0 for that one commit. The boundary cases written for rendering-11 found it; `50ffffc07` fixed it
by moving the testable halves into `rendering-audit-settled-buy.ts` and `rendering-audit-settled-runs.ts`. Rule:
nothing an entry module declares may be exported through a barrel; the boundary cases guard it, and a marker export
re-added to the barrel fails them.

Two lessons for guards: a failing `describe` rejects and stops its suite, so one GFP round may mutate at most one
describe per suite file or later describes never report; and `it` children of one describe run concurrently, so a
console capture must chain and forward (recorded under the artifact group).

Whole-suite `buildAndTest` after `50ffffc07`: 814 PASS, 0 FAIL, exit 0 (solo run; the three new suite files,
across `744890056` and `50ffffc07`, add ten describes: 1 + 4 + 5).

CLOSING `#236` (2026-08-26). The register's closing tally was measured rather than assumed: a scan of every entry
under "Findings register" for a FIXED, CLOSED, folded or tracked marker found three without one. `provider-14` was
CLOSED already (the scan had not looked for that word); `provider-1` was fixed with A-1 and lacked only its line;
`calibrate-1`, a MAJOR tied to `#235`, still owed the pointer from the calibrations' `WROTE NOTHING AT ALL` sentence
to the `SEAT` report, which landed in `8bffaba9b` with its guard (`POINTS AT THE SEAT LINES`; the pointer removed
fails it, restored passes). With that, every entry carries a marker: 3 BLOCKER, 28 MAJOR, 35 MINOR by heading.
NOTE ON THE NUMBER: `#236` here and throughout this file is the session's task-list item, "Exhaustive audit of the
translation-repair package"; the GitHub issue numbered 236 is an unrelated, already closed file-enforcer issue, so
closing the audit mutates no GitHub issue. The task-list items `#258` and `#236` are marked completed.

CLOSE VERIFIED (2026-08-26). Whole-suite `buildAndTest` after `8bffaba9b`: 814 PASS, 0 FAIL, exit 0 (solo run). The
advisor checkpoint owed after the rendering group was made at the close; it judged the close sound pending two
measurements the tally had asserted rather than measured, and both came back clean. The marker scan re-run on the
after-state, with CLOSED in the marker set, finds every entry marked: 3 of 3 BLOCKER, 28 of 28 MAJOR, 35 of 35 MINOR,
zero unmarked. The entry-module rule (nothing an entry module declares may be exported through a barrel) was checked
across every built command a `mise.toml` task invokes, not only the two that regressed: 38 of 38
`dist/final/node/*.mjs` entries carry `import.meta.main`, with `index.mjs` (the barrel, not an entry) at 0 as the
control. No standing test guards this, by the checkpoint's call: the sweep is the audit act. The next checkpoint is
due before `#219`'s AskUserQuestion; none between `#213`, `#230` and `#229`.

Queue: `#213` (arm A and arm B under `mise run` from a worktree carrying the secrets), `#230`'s recovery rate on the
next run, `#229` lever 1, and `#219` (the readiness signal via AskUserQuestion).

`#213` LANDING (2026-08-26). The overlap dial landed in `ce5ca2368`: `TRANSLATION_REPAIR_SLICE_OVERLAP` admits that
many slices at a time through `p-limit` in `editor-calibrate.ts`, unset reproduces the sequential driver exactly, and
an unreadable value or a value under one is a stated refusal read before the sample is drawn, so two sequential runs
can never pass as an overlap comparison. The run client stays shared across slices in flight, on purpose: the saved
prototype rebuilt it per slice, which predates `acfc7ad22`'s once-per-run client, and the per-model limiter is what
production routes through. The progress line and the `SliceRounds` type moved to `editor-calibrate-slice.ts`, numbered
by sample position rather than arrival, which keeps the entry module at 298 code lines and exports nothing from it.
Guards: `slice-overlap.unit.test.ts` (four cases, one describe) and `editor-calibrate-slice.unit.test.ts` (three
cases); four GFP rounds, one mutation each: an unreadable dial falling back to one fails only `REFUSES a value that is
not a number`, zero admitted fails only `REFUSES zero`, numbering from zero fails `NUMBERS` and `RENDERS`, the reach
note dropped fails only `SAYS`; restored, both suites pass. Boundary, keys stripped: a dial of `four` exits 6 with the
refusal and no other output; a dial of `2` prints `1 slices, 10 models editing and judging each, 2 slices in flight`
and then the key refusal; the built command keeps its `import.meta.main` guard. Next: the whole suite (in flight),
then arm A (`TRANSLATION_REPAIR_SLICE_OVERLAP=1`) and arm B (`4`) back to back over four slices under `mise run` from
this worktree, which carries `.env.local.json`; `mise env` here lists both key names.
Whole-suite `buildAndTest` after `ce5ca2368`: 816 PASS, 0 FAIL, exit 0 (solo run). Both arms were launched back
to back at 2026-08-26T11:08Z into `~/temp/agent/overlap-arm-serial-20260826` and
`~/temp/agent/overlap-arm-four-20260826`, logs beside them under the same names with `.log`.

`#213` MEASURED (2026-08-26). Arm A (`TRANSLATION_REPAIR_SLICE_OVERLAP=1`) and arm B (`4`) ran back to back over the
same four slices, full roster, both exiting 0, 33 rounds each. `run-timing-report` on each log: A, 43.19 min of round
time (sequential, so also the wall clock), 37.08 min of it waiting after quorum (85.9%), 8 voices never heard, calls
in flight mean 2.44 peak 10, 1.75 h of calls; B, 24.19 min of run for 51.96 min of overlapped round time, 46.98 min
waiting (90.4%), 10 voices never heard, mean 4.31 in flight, peak 34, 1.74 h of calls. So the same call time ran in
56% of the wall clock, and voices heard were 304 against 302 of 312. Losses by cause: A, 6 grace cuts (all
`qwen3.8-max`) and 2 `schema-mismatch`; B, 7 grace cuts (`qwen3.8-max` 4, `hf:Qwen/Qwen3.8-27B` 2,
`hf:zai-org/GLM-5.2` 1) and 3 `schema-mismatch`, one of them the same `deepseek-v4-flash-0731` panel answer failing
its re-ask. QNB CAVEAT: one run per arm, and the run-to-run band on an unchanged build is unmeasured, so the two-voice
difference is not a finding either way; the wall-clock gain is the arithmetic of one call budget spread over four
lanes while 86% to 90% of every round is waiting, which a repeat could shrink but not undo. WHAT IS NOT DECIDED:
whether overlap above one becomes the calibrations' default, and whether the corpus pass should overlap its slices the
same way; both are design changes for the owner, queued for the `#219` question. Logs and run directories:
`~/temp/agent/overlap-arm-serial-20260826` and `~/temp/agent/overlap-arm-four-20260826`, read only through their own
templates (`~/temp/agent/compare-arms.py`, beside the logs it reads).

`#230` PAID (2026-08-26). Both arms carry `91f0c8ba5`, and each logged two `recovery round for 1 unreadable answers`
lines: A recovered both (`panel` and `critic`, each `1/1 heard`), B recovered one (`introduced-defect-probe` `1/1`;
`panel` `0/1`, the same model answering badly twice), so 3 of 4 re-asked answers came back readable. The split comment
is CONFIRMED rather than corrected, and `2829fd4da` records why in `stage-call.ts`: the only non-`ok` kinds `chatJson`
returns are `refusal-shaped` and `schema-mismatch`, a stream the idle, runaway or degeneration guards cut throws into
the not-answered catch, and a grace-abandoned straggler is classified in `stage-round.ts`; live, all four re-asked
voices were `schema-mismatch` and none of the thirteen grace cuts was re-asked.

`#229` LEVER 1, DIAL LANDED (2026-08-26). `4c070f729`: `src/grace-override.ts` reads
`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS` (unset or empty means the built-in `STRAGGLER_GRACE_MS`; unreadable or not
positive is a `StatedRefusalError`), `runGatherRound`'s `graceMs` default resolves through it per call, and
`editor-calibrate` and `corpus-pass` resolve it first thing and print `STRAGGLER GRACE OVERRIDDEN by ...` when it
differs. `shippedAuthors` moved to `editor-calibrate-slice.ts` (driver at 297 code lines). Guards: nine cases in
`grace-override.unit.test.ts`, two `shippedAuthors` cases; four GFP rounds each bit only their own cases (NaN returned
fails the prose and `300s` cases, zero admitted fails the zero case, the note inverted fails both note cases,
per-issue authors dropped fails `CREDITS both halves`); restored, both pass. Boundary, keys stripped: `five` exits 6
in one line; `300000` prints the note after the header and then the key refusal; `corpus-pass --plan` on a throwaway
runs dir prints the note after START and exits 0, and refuses `soon` with exit 6. Whole-suite `buildAndTest` after
`4c070f729`: 819 PASS, 0 FAIL, exit 0 (solo run). Arm C launched at 2026-08-26T12:23:14Z: overlap 1,
`TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=300000`, the same four slices, into `~/temp/agent/overlap-arm-grace-20260826`
with the log beside it; it is matched against arm A. The proof that the window reached the rounds is a round with more
than 180000 `ms in grace` or an `abandoned 300000ms` line. Nothing may rebuild `dist` until it ends; the whole suite
after `2829fd4da` (a comment-only commit that passed oxlint and `lint:types`) runs then.

SANITIZATION INVENTORY (2026-08-26). The tracked tree was scanned with the standalone `forbidden-strings` binary
against the built deny-list of 10206 corpus sentences (`~/temp/agent/deny-rules.txt`): zero findings over the whole
`--all` walk, validated by a positive control first (one rule written into a throwaway file fired as `rule=0` both
named explicitly and through the same walk from inside the worktree; the file was deleted at once). Findings print on
stderr as `PATH:LINE rule=<token>`, never the text. The branch carries 2342 commits beyond `main` (merge base
`88ba0ae2e`, since 2026-07-16). The proposal behind the `#219` question, with the four decisions it keeps apart, is
`doc/planning/translation-repair-readiness-signal.md`.

`#229` LEVER 1 MEASURED (2026-08-26). Arm C (overlap 1, `TRANSLATION_REPAIR_STRAGGLER_GRACE_MS=300000`, the same four
slices, launched 12:23:14Z, exit 0 at 13:17:15Z) against arm A (overlap 1, 180000): round time 53.87 min against 43.19
(+24.7%), waiting after quorum 48.33 min (89.7%) against 37.08 (85.9%), voices never heard 5 against 8 (306 of 311
heard against 304 of 312; C ran 32 rounds to A's 33 because it needed one recovery round to A's two), grace cuts 4
against 6, all `qwen3.8-max` in both, one `schema-mismatch` (`critic`, recovered `1/1`) against two. The window's
effect is legible in the rounds themselves: four rounds burned the full 300000 ms (the four cuts), and two rounds
spent 214010 ms and 263265 ms in grace, which are voices that arrived after 180000 ms and would have been cut under
the built-in window. So on this sample the longer window bought back 2 voices of the 6 the built-in one loses, at
10.68 min of wall clock, about 5.3 min per voice, and the other four stragglers reason past five minutes and are cut
anyway. Under overlap that price changes, since waiting after quorum is what overlap fills: a longer window under
overlap 4 was not run and would be the arm to run if overlap becomes the default. QNB: one run per arm again; the two
180000 arms cut 6 and 7, so C's 4 sits below both and the two in-band rounds are direct evidence rather than a
difference of totals. The dial stays opt-in and `STRAGGLER_GRACE_MS` stays 180000 until the owner decides (question 4
of the readiness signal). Log and run directory: `~/temp/agent/overlap-arm-grace-20260826`.

Whole-suite `buildAndTest` after `2829fd4da` (the last code commit), run after arm C as the final gate before the
readiness signal: 819 PASS, 0 FAIL, exit 0 (solo run). The advisor checkpoint before `#219` was made and asked
for this verdict to be read first, the status head refreshed, the arm reader kept beside its logs, and question
2 scoped to `editor-calibrate`; all four are in this commit.

## FIXED: half the roster was sent to a provider that cannot serve it (`#235`, 2026-08-25 to 2026-08-26)

STATUS 2026-08-26: fixed in `8b289c3ab`, guards in `e0010019f`, each guard shown to fail with its fix line removed,
verified live the same day (see "State of the tree" in the audit section);
`doc/troubleshooting/synthetic-hf-prefix-misroute.md` holds the located cause and the fix.
The body below is the diagnosis as it stood while the cause was being located, kept for its evidence.

This is the most important open item in this file, and it is unfixed.
It was found while running arm A of the `#213` overlap measurement, and it invalidates that run.

### What happened

The run was the serial control arm:
`TRANSLATION_REPAIR_SLICE_OVERLAP=1`, four slices, the full ten-model roster.
Log at `~/temp/agent/overlap-arm-serial.log`, 887 lines;
run directory `~/temp/agent/overlap-arm-serial`.
It started at 01:54:46 UTC and ended at 02:15:58 UTC, about twenty-one minutes,
and it exited cleanly: no refusal line, no fault line, all four slices reported.

Every single round it logged heard five of ten voices.
Twenty-five rounds, `5/10 heard` on all twenty-five, no exceptions.
(Re-measured 2026-08-26 with `grep -oE 'round: [0-9]+/[0-9]+ heard'`.
The first count here was twenty-two; it came from a narrower anchor that required a stage prefix,
and every round is `5/10` under either anchor, so the substance stands.)

The five that were lost are exactly the five Charm Hyper endpoint labels,
the ones whose identifiers do not carry an `hf:` prefix,
and each of them failed on every call it made:

```text
model                                              http400  streams
  qwen3.8-max                                           25       25
  minimax-m3                                            25       25
  gemma-4-26b-a4b-it                                    25       25
  deepseek-v4-pro-0813                                  25       25
  deepseek-v4-flash-0731                                25       25
  hf:zai-org/GLM-5.2                                     0       26
  hf:Qwen/Qwen3.8-27B                                    0       25
  hf:moonshotai/Kimi-K3                                  0       25
  hf:openai/gpt-oss-120b                                 0       25
  hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4      0       25
```

A hundred percent failure rate on five models, a zero percent failure rate on the other five.
The provider's own words, which are the giveaway:

```text
SyntheticHttpError: provider API returned HTTP 400:
{"error":"Your model name should start with an hf: prefix; for example: ...
```

Synthetic was handed five models that only Charm Hyper serves, and said so, 125 times.

### Why nobody noticed

Quorum is five of ten.
The five surviving models are exactly enough to meet it,
so every round stood, every slice settled, and the command exited zero.

The resilience work is what hid this.
`#199` and the multi-provider landing made the pipeline survive a provider going away,
and it did survive: it produced a complete, well-formed, four-slice calibration.
It just produced it from half the roster.
CORRECTED 2026-08-26: it did not say "nothing above `warn`".
The calibration's closing coverage line (`producer-silence.ts:222`, printed by
`editor-calibrate.ts:359-367`) named all five dark seats twice, as
`WROTE NOTHING AT ALL: ... covers 5 of 10 seats`.
What was missing: per-seat call and failure counts, the failure class
(the line itself says a budget refusal, a refused sheet and a timeout all look alike from there),
any such line in the pass or the other 36 CLIs, and anything louder than stdout prose under exit 0.
Audit finding `calibrate-1` in `doc/audit/translation-repair-package-audit.md`.

That is the defect to fix, and it has two halves that should not be conflated:

1.  **The routing half.**
    A model that only one provider serves must never be offered to the other one.
    CAUSE LOCATED 2026-08-26, and it is NOT `src/budget-routing.ts`.
    That file and `src/roster-reach.ts` were read in full and are correct:
    a bare Charm Hyper label derives `{ onSynthetic: false, onHyper: true }` and routes to Hyper.
    The misroute is the single-provider fallback in `createRunClient`,
    `src/corpus-run/run-config.ts:611-617`:
    when `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY` is unset it returns the bare Synthetic client,
    and that client sends whatever model id it is handed to the wire with no catalog check
    (`src/synthetic-client.ts:265`).
    The log proves the process had no Hyper key:
    `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY is not set` appears four times, once per slice,
    and no `METERS ` line exists at all, because the routing client was never built.
    How the key went missing: arm A was launched with `nohup env ... node dist/final/node/editor-calibrate.mjs 4`
    directly from the fork worktree `~/worktrees/tr-overlap`,
    which has no `.env.local.json`, so nothing injected secrets;
    the process inherited whatever that shell happened to hold.
    The earlier pointer at `budget-routing.ts` was written after reading sixty lines of it,
    and was wrong.

2.  **The silence half.**
    Losing five of ten voices for an entire run should be loud.
    Right now it is a `warn` per call, a `5/10 heard` per round, and one closing coverage
    sentence in the two calibration CLIs that names the seats but not the counts or the cause.
    A run that finishes with a model at a hundred percent failure should say so at the end,
    in its own summary, where a reader who is not grepping will see it.

### What this costs, and what is now void

The arm A measurement is void as a ten-model measurement.
Do not read wall clock, concurrency, or overlap conclusions off it.
Arm B, the `TRANSLATION_REPAIR_SLICE_OVERLAP=4` arm, was never launched;
`~/temp/agent/overlap-arm-four.log` does not exist.
Both arms need re-running after the routing fix, back to back,
and that re-run also pays the recovery rate owed by `#230`, since it will carry `91f0c8ba5`.

`#213` therefore stays open, and it is now blocked on this defect rather than on quota.

This also blocks `#219`.
Production readiness cannot be signalled while one provider's absence
silently halves the roster and the run still reports success.

### Three instruments that lied, and how to not be fooled again

Recorded because each one cost real time in this session.

1.  **The run log stamps are UTC, and the machine is on EDT.**
    A line reading `02:11:48` was written at `22:11:48` local.
    Reading them as local time makes a live run look like it died twenty hours ago.
    Compare against `date -u`, never against `date`.

2.  **Node's `comm` on this machine is `node-MainThread`, not `node`.**
    Scanning `/proc/*/comm` for exactly `node` finds nothing and looks like proof of death.
    Match on a `node*` prefix, or match the `cmdline` instead.

3.  **`pgrep -f PATTERN` matches the shell that is running it.**
    A waiting loop whose own command line contains the pattern never exits.
    This has now cost three separate incidents, including one where a kill loop
    killed its own shell and returned exit 144.
    List PIDs first, confirm the kind from `/proc/<pid>/comm`, then kill by number
    from a command that does not contain the pattern.

### Exactly where to pick this up

- The cause is `createRunClient` in `package/module/translation-repair/src/corpus-run/run-config.ts`;
  the fix design (require the Hyper key, catalog guard in the Synthetic client,
  process-scoped seat tally reported by `reportingRefusals`, `RunConfigError` as a stated refusal)
  is recorded on `#235`, advisor-reviewed, and held until the `#236` audit closes.
- Launch rule from now on: a run starts through `mise run //package/module/translation-repair:<task>`
  from a worktree that holds `.env.local.json`, so sops injects BOTH keys.
  A fork made with `git worktree add` has no secrets file.
  Never `nohup env ... node dist/...`.
- The fix needs a test proven per `GFP`:
  a non-`hf:` model with Synthetic live must never produce a Synthetic call,
  and the test must be shown to fail with the fix removed.
- The overlap prototype itself is built and lint-clean but NOT committed.
  It lives in the fork at `/var/home/user/worktrees/tr-overlap`, detached at `166b08e81`,
  and its two files are saved at `~/temp/agent/proto-slice-overlap.ts`
  and `~/temp/agent/proto-editor-calibrate.ts`,
  with a drafted, unlanded test at `~/temp/agent/proto-slice-overlap.unit.test.ts`.
  Because the fork is pinned to an older commit, recreate it from the new head
  and reapply those two saved files rather than patching the stale checkout.

## The writers are seated, and the queue is being verified live

2026-08-24, after the 40-round producer calibration landed.

### The seating

`editorModelIds` and `refinerModelIds` are now
`hf:moonshotai/Kimi-K3`, `hf:Qwen/Qwen3.8-27B`, `gemma-4-26b-a4b-it`.
`hf:zai-org/GLM-5.2` left both seats and `qwen3.8-max` was not given one.
The whole standing, both raw and availability-adjusted,
the Mann-Whitney proof that `qwen3.8-max`'s top headline is survivorship,
and the reason the same table must NOT be used to move a checker seat,
are in `doc/decision/translation-repair-multi-provider.md`
under "The forty-round pass seats the writers, 2026-08-24".

Two reach checks ran before the swap, since `gemma-4-26b-a4b-it` is text-only
and Hyper-served:

-   Pictures never reach these stages.
    `document-lanes.ts` records that the repair lane edits in place against critic claims
    and none of its stages asks what a picture says,
    and reading is its own stage over `RUN_READER_MODELS`,
    which `run-config.ts` derives from the catalog rather than listing by hand.

-   The catalog's `maxOutputLength` of 25_600 is not a bound this model runs into.
    Nothing in production reads that field at all,
    and the model answered 40 rounds of production-sized slices with no cut.

Structured output was checked too, because these seats emit schema-guarded JSON:
across 937 completed streams in the calibration
there was exactly ONE schema mismatch, and it was `qwen3.8-max`'s.
`gemma-4-26b-a4b-it` had none.

### The live verification of `#196`

The queue was GFP-proven but had never run against a provider.
It does not need XingZ60's thirteen hours to be exercised:
the mechanism is size-independent,
so a mid-sized entry under a deliberately tight cap runs the same code path.

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=5 \
      mise run //package/module/translation-repair:corpus-pass -- --only MocaKawai

`--only` already existed; nothing had to be built to bound this.
What the run has to show is a `REATTEMPT MocaKawai queued` line,
an attempt count above one in the run's attempt map,
and a cache that grew between attempts.

A useful thing fell out of reading the cache layer for this:
`countCachedSlices` counts every `.json` under the entry's cache directory,
and `slice-cache-namespace.ts` gives pairing, contest, refine and translate records
that same suffix and that same directory.
So an attempt that spends its entire cap buying only a section pairing
still registers as progress and still earns its re-attempt.
Had setup cached somewhere else, the largest entries,
the ones this was built for, would have stalled on their first attempt every time.

### What the first live run proved, and the defect it exposed

Run 1, `--only MocaKawai` under a 5-minute ceiling, into a throwaway runs dir.
It exercised BOTH branches of the re-attempt policy in one invocation
and then exited cleanly, exit 0, in 601.84s:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 5 minutes rather than the built-in 420
    TALLY MocaKawai status=ERROR ms=300002 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    REATTEMPT MocaKawai queued: cached 2 more slices, so the next attempt starts further along
    TALLY MocaKawai status=ERROR ms=300004 aborted=true error=Timeout: MocaKawai exceeded its 300000ms deadline
    STALLED MocaKawai: its 2 cached slices are what it started with,
    so a further attempt in this invocation would repeat it
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=600008ms

`attempts.json` read `{"MocaKawai": 2}`,
so the second attempt happened inside the SAME invocation
against the same `sha256-tree-v1:38a0fcb...` digest.
That is the whole of what `#196` said was untested.

THE RE-ATTEMPT REALLY DID START FURTHER ALONG, and the timestamps show it.
Attempt 1 reached "both lanes over 13 slices" 45 seconds in, after buying two block pairings.
Attempt 2 reached the same line 0.16 seconds in, off those cached pairings.

The two records it banked were both `pairing.` files rather than repair slices,
which is the cache-layout fact working exactly as intended:
`countCachedSlices` counts every `.json` in the entry's directory,
so setup progress earns a re-attempt.

#### The ceiling has a floor, and nothing said so

Attempt 2 banked nothing and the entry stalled.
The cause is not the queue: `RUN_PER_CALL_TIMEOUT_MS` is 360_000
and the ceiling was 300_000,
so every attempt was cut BEFORE any single exchange was allowed to return.
No exchange returned, so no slice cached, so no progress could be read,
so the queue correctly dropped the entry.

Every component behaved as designed and the run explained none of it,
while five minutes looks like a perfectly reasonable ceiling to set.
`capOutlastsOneCall` and `capTooTightNote` now catch it and print
`CAP TOO TIGHT` naming both numbers.

WARNED RATHER THAN REFUSED, deliberately:
cutting mid-exchange is exactly what a test of the stall path wants,
and refusing would have blocked the run that found this.
GFP-proven at the equal-values boundary,
which is the case a `>=` would silently accept.

This also answers half of `#196`'s open question about raising the cap by slice count.
Any such rule has a hard floor at one exchange deadline,
and a practical floor well above it,
since a slice runs several exchange rounds in sequence:
the critic round alone took over 200 seconds on the measured attempt.

### The second run says the floor is much higher than one exchange

Run 2, `--only Weideriche_` under a 15-minute ceiling, exit 0 in 1801.90s.
It stalled too, and that is the finding:

    CAP OVERRIDDEN by TRANSLATION_REPAIR_HARD_CAP_MINUTES: entries run under 15 minutes rather than the built-in 420
    TALLY Weideriche_ status=ERROR ms=900061 aborted=true
    REATTEMPT Weideriche_ queued: cached 1 more slices, so the next attempt starts further along
    TALLY Weideriche_ status=ERROR ms=900002 aborted=true
    STALLED Weideriche_: its 1 cached slices are what it started with
    DONE processed=0 of pending=1; artifacts=0/92 elapsed=1800065ms

`Weideriche_` is the SECOND SMALLEST entry in the corpus,
828 bytes of source against a 41720-byte largest,
and it cuts into 3 slices.
The ceiling was 15 minutes, two and a half times the 6-minute exchange deadline,
so `CAP TOO TIGHT` correctly stayed quiet.

Attempt 1 bought the block pairing in seconds
and then spent the remaining fourteen and three quarter minutes on CHUNK 0 ALONE,
reaching critic, then panel, then editor, and never finishing.
The stage words in that attempt's log come to critic 18, panel 12, editor 2.
Attempt 2 did the same and banked nothing.

SO ONE REPAIR SLICE COSTS MORE THAN 885 SECONDS, on the second smallest entry.
That is not surprising once stated:
a slice runs critic, panel, editor and checker rounds IN SEQUENCE,
and each round is bounded by `RUN_PER_CALL_TIMEOUT_MS` at 360_000 on its own.

THE `CAP TOO TIGHT` FLOOR IS THEREFORE NECESSARY BUT NOT SUFFICIENT.
One exchange is a provable lower bound and it is the honest one to assert
without a measurement.
The practical floor is a whole round sequence, and 15 minutes is under it.
The production ceiling of 420 minutes is nowhere near either floor,
so nothing that ships is affected;
what was affected was two verification runs that looked reasonable and could not work.

The number to replace the estimate with is being measured now:
run 3 is `--only Weideriche_` at the DEFAULT ceiling,
which settles the entry end to end and reports what it actually cost.
Do not raise the warning threshold on the 885-second lower bound.
It is a bound, not a cost.

### Run 3 settles, publishes, and verifies, with half the roster dark

`--only Weideriche_` at the DEFAULT 420-minute ceiling, exit 0 in 7725.66s.

    TALLY Weideriche_ status=SETTLED slices=3 repairStatus=repaired repairIssues=20
      repairAccepted=14 repairResolved=14 repairFindings=135 repairChanged=2
      translateStatus=complete translateChanged=2
    DONE processed=1 of pending=1; artifacts=1/92 elapsed=7723880ms

It wrote one artifact of 412823 bytes and one page,
`fixed/people/Weideriche_/page.en.md`, of 897 bytes,
over 253 model streams.
`verify-published` then read the page back against the artifact that produced it:

    verify-published: matched=1 settledWithNoPage=0 pageWithNoArtifact=0
    Weideriche_: wordings=3 silent=0 chars=895=expected missing=0
    verify-published: 1 of 1 pages carry every wording their artifact promised, at the length it implies

`chars=895=expected` is the strong form:
the page is EXACTLY the archive plus every change the slices made,
so no text outside a slice was lost or added.

THIS RAN THROUGH A PROVIDER OUTAGE FROM START TO FINISH.
Charm Hyper was dry from the run's first second,
so five of the ten roster models never answered,
including `gemma-4-26b-a4b-it` in the editor and refiner seats it had just been given.
The entry still settled, still published, and still verified.

#### The cost, and why runs 1 and 2 could never have worked

128.7 minutes for a THREE-SLICE entry,
the sixth smallest of 92, 828 bytes of source.
That is roughly 43 minutes a slice, and it settles the earlier puzzle completely:
a 5-minute ceiling and a 15-minute ceiling were never near buying one.

TREAT 43 MINUTES AS AN UPPER BOUND RATHER THAN THE COST.
Five models were dark, so every stage ran retry rounds for lost voices
that could not be filled.
The lower bound from run 2 is 885 seconds, just under 15 minutes.
A healthy two-provider slice sits somewhere between the two,
and nothing has measured it.

THE `CAP TOO TIGHT` THRESHOLD STAYS AT ONE EXCHANGE for exactly that reason.
Two bounds that differ by a factor of three do not support a threshold,
and the one-exchange floor is the only value that is provable rather than fitted.

#### A tested edge case turned up live

The entry's cache directory holds ZERO records after settlement,
having held ten a few minutes earlier.
That is the first of the two counterintuitive cases `entry-reattempt.ts` carries a test for:
a settled entry discards its cache on the way out,
so settlement has to be an INPUT to the re-attempt verdict
rather than inferred from a count that just fell to zero.
Inferring it would have read this run as an entry that lost everything it had.

#### What is proved, and the one thing that is not

Proved live, each on its own run:

-   An entry the cap cuts is re-attempted inside one invocation against one frozen digest.
-   The re-attempt starts further along, off the cache the previous attempt bought.
-   An attempt that buys nothing stalls the entry rather than looping.
-   An entry settles, publishes, and its page verifies against its artifact.

NOT directly observed: a chain of EARNED re-attempts ending in settlement.
Run 3 settled in a single attempt because the production ceiling never cut it.
Showing the composition needs a ceiling between one slice and one entry,
which on these numbers means roughly 60 minutes:

    TRANSLATION_REPAIR_RUNS_DIR=<throwaway> TRANSLATION_REPAIR_HARD_CAP_MINUTES=60 \
      mise run //package/module/translation-repair:corpus-pass -- --only Weideriche_

Expect two or three attempts and about two and a half hours.
It was not run because Synthetic quota is restorable only sometimes,
and the composition is arithmetic over four facts each already observed.

## Five sections aged out into the history (2026-08-25)

Moved verbatim into `doc/handover/translation-repair-history.md` when this file reached its cap,
because each is closed work whose conclusion is already encoded in the code:

-   The writer calibration's coverage report, verified live.
-   The settled artifact speaks one vocabulary, as generation 3 (`#94`).
-   The stamped index is `sliceIndex`, as generation 4 (`#204`).
-   The read-any-generation dispatch never learned generation 3 (`#206`).
-   The 53 indirectly-reached modules, branch by branch (`#209`).

## Charm Hyper got credit, the full roster is running, and a run's cost is now measured (2026-08-25)

The owner bought 10,000 hypercredits.
`budget-sample` confirmed it live before anything was launched:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=97.09290877272727%
syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=10000
```

Both providers wet at once,
which is the window `#200` had been waiting for since the 14-slice run of 2026-08-24 settled no seat.

### The run in flight

Launched 2026-08-25T01:30Z, detached, 40 slices, every seat filled by the whole ten-model roster.

```text
TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/editor-calibrate-fullroster-20260825 \
  mise run //package/module/translation-repair:editor-calibrate -- 40
```

Log at `~/temp/agent/editor-calibrate-fullroster-20260825.log`,
pid beside it in the `.pid` file.

ALL TEN SEATS ARE ANSWERING, which is the whole reason this run exists.
The five Hyper-only ones wrote nothing last time.
`gemma-4-26b-a4b-it` in particular HOLDS an editor seat and had never been tested.

DO NOT REBUILD `dist/` WHILE IT RUNS.
The run stamps its cache with the runner's own dependency closure,
so a source change plus any restart invalidates every cached slice and re-buys the whole run.
Documentation is outside that closure and safe to edit.

### What a slice actually costs in wall time, and a revision that should not have happened

Measured over the first six slices:

```text
slice 1  lintong chunk 0        214 s   0 editor  0 refiner
slice 2  windward0032 chunk 14 1362 s   5 editor  0 refiner
slice 3  Huasheng chunk 16       503 s   2 editor  0 refiner
slice 4  Mio chunk 10           1083 s   2 editor  1 refiner
slice 5  lintong chunk 4         967 s   2 editor  1 refiner
slice 6  zheermao101 chunk 2      16 s   0 editor  0 refiner

real slices   4, mean  979 s
cheap slices  2, mean  115 s
real share   67 percent
```

Projected total 7.7 hours, which is the figure first estimated from roster-round arithmetic.

A REVISION WAS MADE ON ONE SAMPLE AND WAS WRONG.
After slice 2 alone, at 1362 s, the projection was moved from 8 hours to 12
and the earlier number was declared superseded.
Slice 2 turned out to be the slowest of the four real slices measured,
which span 503 to 1362 s, a 2.7-fold spread.
The mean is 979 s and the original estimate was right.

THIS IS EXACTLY WHAT `QNB` FORBIDS:
measure the run-to-run band before crediting a difference smaller than it.
The rule was quoted in the same session it was broken in.
One slice could not distinguish a real slowdown from the top of an ordinary spread,
and no projection should have moved until it could.

### The refiner lane fires, and the two empty slices were not a signal

Slices 1 through 3 each reported `0 refiner rounds (nothing eligible to rewrite)`,
which looked like the refiner standing was going to come back empty for the second run running.

MEASURED INSTEAD OF WAITED.
Across 74 real shipped slices from four archived runs,
mirroring the bounds in `refine-eligibility.ts`:

```text
paragraphs                 156
  markup or non-prose       41
  hard break                 2
  under 120 chars           78
  over 1200 chars            1
  ELIGIBLE                  34

slices carrying at least one eligible paragraph: 32 of 74 (43%)
```

Three empty slices in a row has probability near 19 percent.
Unremarkable.
Slice 4 then produced a refiner round, which is the first this workstream has ever seen:
the earlier run's binary predated the fix that drives the lane at all.

### What the run costs in credits, and the correction that came with measuring it

The first estimate, computed from assumed tokens per call, was 500 to 1,500 credits for a 40-slice run.
THAT WAS HIGH BY ROUGHLY A FACTOR OF FOUR.

Measured from the run's own `reportStreamProgress` lines,
which carry content and reasoning characters per call:

```text
model                     calls   content   thinking  out-tokens  credits
qwen3.8-max                   9         0    125,612      31,403     3.77
minimax-m3                   10     6,409     98,961      26,343     0.69
deepseek-v4-pro-0813         10     4,512          0       1,128     0.10
deepseek-v4-flash-0731       10     4,214      4,066       2,070     0.05
gemma-4-26b-a4b-it           10     3,986          0         997     0.01
```

Scaled to 40 slices the output side is about 120 credits,
and adding an input side priced two to three times lower puts the whole run near 250.
So 10,000 credits buys on the order of 35 runs of this size, not 6 to 20.

THINKING DOMINATES THE BILL.
`qwen3.8-max` and `hf:zai-org/GLM-5.2` each emitted over 118,000 characters of reasoning
against a few thousand of answer,
and `completion_tokens` counts thinking.
Any cost model built on answer length underreads by most of the bill.

### Nothing we have ever run recorded its token spend (`#210`)

The estimate above had to be computed rather than read,
because token counts are not in any log this project holds.

`formatUsageNote` in `model-content.ts` reads `prompt_tokens` and `completion_tokens`
off the provider's own usage block
and appends them to an `rl.debug` line in both clients.
Every archived run logged at info,
so a grep for `[0-9]+\+[0-9]+ tokens` across every log in `~/temp/agent` returns ZERO matches.

It did not matter while Synthetic was the only provider:
a flat subscription either fits the weekly allowance or it does not,
and the `METERS` line already carries that percentage.
Charm Hyper is metered per token at rates differing by two orders of magnitude across one roster,
so cost depends on which seats answered and by how much.

`spend-line.ts` and `corpus-run/spend-read.ts` close it.
One `SPEND provider=<name> model=<id> prompt=<n> completion=<n>` line per exchange at info,
shaped like the `METERS` line so a reader splits rather than matches,
and a reader that totals a log per provider-and-model seat.

A provider that reports no usage still gets a line carrying `unreported` in both counts.
A run whose provider stayed quiet and a run that spent nothing total the same,
and only the named absence tells them apart.

### Two defects that only writing the consumer could find

Both were in code already reported as verified,
and neither was reachable from the writer's own tests.

THE MARKER CARRIED A LEADING SPACE, copied from `METERS_MARKER`.
That one only ever meets lines carrying a logger prefix, so it can demand the space.
This one also meets the bare line the writer RETURNS,
so `readSpendLine(reportSpend(...))` read as prose and answered `not-a-record`.
The marker is now `'SPEND '`
and the reader accepts it at start-of-line or after a space.

THE FIELD TABLE WAS A PLAIN OBJECT,
so a log line writing `__proto__=` would have reached the prototype.
Keys come off a log line; it is a `Map` now.

This is the same lesson as the `#209` method note from one day earlier,
arriving from the other direction:
there, mutating a module found arms nothing defended;
here, writing the consumer found what the producer's tests could not reach.

### `qwen3.8-max` books all of its output as thinking (`#211`)

Measured on the live run:
`qwen3.8-max` reports 0 content characters on every single call,
13 of 13, against 204,258 reasoning characters.
Other seats do this occasionally,
`hf:zai-org/GLM-5.2` on 3 of 10 and two others on 1 of 10.
Thirteen of thirteen is categorical.

THE VOICE STILL LANDS.
The same model casts ballots with full reasons,
so the answer arrives and is used.
What is wrong is the accounting.

THE OBVIOUS EXPLANATION IS ALREADY REFUTED, recorded so it is not re-walked.
Charm Hyper speaks the Anthropic protocol,
and forced tool use would deliver an answer as `input_json_delta` fragments.
`anthropic-delta-scan.ts` maps that delta to `content` and its own comment names this exact failure mode:

```text
`input_json_delta` IS THE ANSWER CHANNEL ... Routing them to `reasoning`
would leave every schema'd call looking like a model that thought at length
and answered nothing.
```

So the mapping is right and something else produces the symptom.
Settling it needs a captured frame from a live call,
which waits until the run releases the provider.

Not urgent: nothing is broken and no quota is wasted.
But a reader of any run log would conclude the most expensive seat on the roster produced nothing,
and the `SPEND` line sidesteps it entirely,
since `completion_tokens` comes from the provider and is channel-agnostic.

### A run's cost is now attributable per seat, and the run in flight will never be (2026-08-25)

`#210` grew its second half while the calibration held the main worktree.
The writer and reader were already built;
what was missing was the thing that turns token counts into money.

#### The price table is an observation with a date on it

`package/module/translation-repair/src/corpus-run/hyper-price.ts` carries all
twenty-six models Charm Hyper lists,
with input, output, cache-create and cache-hit rates in credits per million tokens.
The operator read them off the provider's model page on 2026-08-25,
and `HYPER_PRICE_READ_ON` ships beside the rates so every report prints how old its figures are.

The numbers were not transcribed by hand.
A parser read the pasted page with strict structural checks,
refusing any row whose label order or rate format did not match,
and emitted the table.
Transcribing a hundred and four figures by eye is exactly where a silent error would live.

#### The two cache columns are unreachable, which makes the input half exact

Nothing in `package/module/translation-repair/src` sends `cache_control`,
which is one grep to confirm.
On the Anthropic protocol Hyper speaks,
that means there are no cache-creation and no cache-read tokens,
and every prompt token bills at the plain input rate.
So the input half is exact rather than an upper bound.
The rates are carried anyway,
so whoever turns caching on finds them recorded and can see what the saving is worth.

#### Synthetic is never priced, and that is a correctness rule

`priceTally` splits seats into three buckets:
metered and priced, metered with no row in the table, and flat-subscription.
Only the first gets a credit figure.
Folding the second into the total at zero would report a cheaper run rather than an incomplete one,
and converting the third would invent a currency that provider does not bill in.
The report names all three separately.

#### What the report says, and the two controls it was checked with

```sh
mise run //package/module/translation-repair:spend-report -- <log> [<log> ...]
```

Positive control, on a throwaway fixture carrying every case at once:
priced seats sorted by cost with their share of the bill,
one unpriced metered seat named rather than zeroed,
one subscription seat carried with tokens and no credits,
one call that reported no usage counted as a floor,
one prose line mentioning the marker correctly not counted,
and one truncated record counted as unreadable.
The arithmetic checks by hand:
`qwen3.8-max` at 84000 prompt and 51065 completion tokens comes to 3.36 plus 6.13, or 9.49 credits.

Negative control, on the live calibration log:
`NOTHING RECORDED`,
which is the honest answer and not a zero total.

#### The run in flight will never have a cost breakdown

The calibration started before `spend-line.ts` existed,
and the running build is the one it started with.
Its log carries no `SPEND` line and never will.
Rebuilding `dist/` mid-run would invalidate every cached slice and re-buy the whole run,
so this is not a thing to fix.
It is the last run this project will make that cannot say what it cost.

What the meter does give is the total.
The balance opened at exactly 10000 and read 9909 after nine slices:
about ten credits per slice,
so a forty-slice run lands near four hundred credits and a ten-thousand balance buys roughly
twenty-five of them.
That corrects the earlier per-slice figure of 8.33,
which came from a smaller sample.
The total is all the meter can say.
Which seat spent it is what the `SPEND` lines add.

#### Proven by removal

Three mutations, each caught by the file that owns the guard and by no other:

- Dropping the `glm-5.2` row from the price table:
   caught by the catalog-join case,
  which asserts every model `hyper-catalog.ts` can seat has a row.
- Making `priceTally` inherit the tally's token order instead of sorting by cost:
   caught by an ordering case built so the two disagree,
  where the seat with ten times the tokens is a quarter of the bill.
- Looking rates up on the object literal instead of the `Map`:
   caught by the `__proto__` case.

Full suite after: 659 suites, zero failures, zero lint warnings.

#### Still parked, not landed

Everything lives in `~/temp/agent/spend-telemetry-210.tar.gz`,
fourteen files with repo-relative paths, untarred over the repo root to apply.
It cannot be committed from the isolated worktree,
which lacks the forbidden-strings scanner and is refused by the `branch-worktree-only` policy.
It must land after the calibration finishes,
and after any second calibration batch,
because pooling needs no drift opt-in only while the build is unchanged.

### `#211` diagnosed from logs and source, without spending a call (2026-08-25)

The earlier note recorded this as needing a captured frame from a live call,
and put the count at 13.
Both were wrong.
The count is about seventy calls,
and most of the diagnosis was reachable by reading.

#### The premise, remeasured

Across the calibration's first nine slices,
`qwen3.8-max` opened seventy-one streams and reported zero content characters on seventy of them,
while casting seventy-one ballots with full prose reasons.

#### There are two independent parsers, and only one of them is blind

`anthropic-completion.ts` imports `json-guard.ts` and `completion-shape.ts` and nothing else.
It never touches `anthropic-delta-scan.ts`.
So the thing that extracts the answer and the thing that counts characters for the progress line
read the same bytes through different code.
The vote landing while the count reads zero is the two disagreeing,
not the model failing.

#### The mechanism, from `channelFor` in `anthropic-delta-scan.ts`

Block type outranks delta type:

```ts
if (blockType === THINKING_BLOCK)
  return 'reasoning';
return DELTA_CHANNELS[deltaType] ?? UNREAD;
```

Its own comment says why that precedence exists:
providers have been seen sending plain text deltas inside a thinking block,
and reading only the delta type would file that as the answer.
The rule is right for the model it was written for.
If `qwen3.8-max` declares a thinking block and sends its answer deltas inside it,
the same rule files its entire reply as reasoning,
while the extractor, which reads only `delta.type` and ignores blocks, still recovers the answer.

`qwen3.8-max` is also the only model on the roster configured `toolChoice: 'auto'`;
every other Hyper seat is `forced`.
`hyper-catalog.ts` records that it answers HTTP 400 to every forced-tool variant tried.

#### What separates this from the ordinary case

For every other model, the zero-content count equals the cut count exactly:
`hf:zai-org/GLM-5.2` five and five,
`hf:Qwen/Qwen3.8-27B` two and two.
Those are streams that ended before any content arrived, which is expected.

`qwen3.8-max` reports seventy zero-content streams against twelve cuts.
Fifty-eight of them completed cleanly and still counted nothing.
Cutting cannot explain that, and no other model shows the pattern.

`deepseek-v4-pro-0813` shows a smaller separate anomaly,
eight zero-content streams with no cuts at all,
recorded here so it is not folded into this one.

#### This is not cosmetic: the runaway guard is blind to this model

`stream-runaway-watch.ts` applies `CONTENT_OVERRUN_CAP` to the content channel only,
and its comment states the reasoning channel is deliberately untouched.
If this model's output is filed as reasoning, the volume bound never sees it,
so nothing stops it early and it runs to the straggler deadline instead.

The cut rates match that prediction.
`qwen3.8-max` is cut on twelve of seventy-one streams, near seventeen percent,
the highest on the roster by a factor of two and a half.
`hf:zai-org/GLM-5.2` is next at five of seventy-two.
Six of the eleven seats are cut zero times.
Each cut is a lost voice on a panel that was paid for.

#### What is still owed

One thing, and it is now a single cheap check rather than an investigation:
capture one `qwen3.8-max` stream and confirm it declares a thinking block
whose deltas carry the answer.
If it does, the fix is at `channelFor`, not at the model,
and the candidate shape is to keep the block-type override only for delta types
that are not themselves answer channels.
Do not change it before the frame is seen:
the override exists because a real provider needed it,
and removing it blind would restore the defect it was added for.

### Authorization to drop weak models, and why the worst-looking seat is not one (2026-08-25)

The owner granted authorization to drop models that are exceptionally bad.
Recorded here with the guard that has to travel with it.

#### The instrument now names drop candidates, and warns about one confound

`~/temp/agent/standing-stats.mjs` previously reported a seat as `SETTLED` on the
absolute value of its z score, which puts a seat far above the pooled null and
one far below it under the same word.
It now splits by direction:
`CARRIES ITS SEAT` above, `DROP CANDIDATE` below,
each still requiring both the per-round and the per-slice reading to clear the
Bonferroni threshold for the actual number of comparisons.

It also prints a standing warning to check a seat's cut rate before dropping it.
A seat whose voice is lost scores low for a reason that is not its judgement.

#### Its control is now a real log rather than pasted figures

The analyser learned the second header shape that `producer-calibrate` prints,
so the prior forty-round producer run reads directly.
That run is now the positive control:
pooled null 13.48% over 336 of 2492 ballots,
ten comparisons, Bonferroni threshold 2.807.

#### The evidence says drop nothing today, and says it twice

`hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4` sits at 3.0%, z of -4.99,
which clears the threshold by a wide margin in the negative direction.
Its cut rate in the run now in flight is zero of seventy-eight,
so the score is not voice loss.
That is genuine weakness, and it is already acted on:
the writer seats were settled at three from this same run,
and a model at 3.0% was never among them.
Nothing to drop.

`qwen3.8-max` is the opposite case and the important one.
It is the BEST producer on the roster at 27.0%, z of +5.22,
and it carries the worst cut rate on the roster, twelve of seventy-eight.
It earns the top score while losing twelve voices to the defect in `#211`.

So the seat that looks worst by cut rate is the strongest seat by judgement,
and dropping on the cut rate alone would have removed it.
That is exactly the confound the warning exists for.

#### What this changes about `#211`

It stops being an accounting curiosity.
The scanner mis-files this model's output, the volume bound therefore cannot see it,
it runs to the straggler deadline, and the pipeline loses a sixth of the voices
of its highest-scoring producer.
Fixing it does not tidy a log line, it recovers the best seat's lost ballots.

#### What the authorization is waiting on

The editor standing, which the run in flight is measuring and which is not the
producer standing.
`#136` already recorded a model that is worst at one stage and better than two
peers at another, so a producer table cannot seat or unseat an editor.
When the run lands, the analyser names candidates and the cut rates say which of
them are real.

## No volume guard can see `qwen3.8-max`, and stragglers may cost more than serialization (2026-08-25)

Measured on the live full-roster calibration at 15 of 40 slices, from the run log alone.
Full working in `doc/audit/every-volume-guard-is-blind-to-one-model.md`, committed as `d16a616e3`.
This run predates the parked `#211` fix, so every number here is a clean pre-fix baseline.

### The measurement

Every seat was asked exactly 120 times, so the denominators need no adjustment.
Seven of the ten lose no voice at all.
The 34 losses are `qwen3.8-max` 21, `hf:zai-org/GLM-5.2` 11, `hf:Qwen/Qwen3.8-27B` 2.

`qwen3.8-max` reports content characters of 0 at the median AND at the 95th percentile,
across all 100 of its completed streams.
Not one byte it sent reached the content channel.
Every other seat medians between 303 and 619.
That is `#211` confirmed at production scale, where it had been proved on one captured frame run.

### Why that is worse than a telemetry error

`src/stream-runaway-watch.ts` applies its volume cap to the content channel only,
and its module note says the reasoning channel is untouched.
`#156` set that bound at 32000 and declined a reasoning bound deliberately.
So for this one seat the chain closes: answer filed as reasoning,
cap reads content, content is always zero, no volume guard can ever fire.
The only thing that stops it is `STRAGGLER_GRACE_MS`, and that is what its 21 cuts are.

### The correction to `#211`'s recorded prediction

`#211` predicted the cut rate would fall toward the roster's.
That is not supported and has been replaced on the task.
The cuts are volume runaways, not stalls: `qwen3.8-max` is cut mid-reply after 106,405 characters
once and then 19 of 21 times between 293,163 and 350,293,
a tight cluster because the cut is time-bound while the stream rate is steady.
Post-fix those bytes meet `contentCap`, so the call is cut at roughly 32000 rather than 300,000,
in seconds rather than 180.
What changes is when and how expensively the voice is lost, not obviously whether.
Two mechanisms pull opposite ways: an early overrun rides the retry predicate `#156` built,
giving the model an attempt it never used to get,
against which a model emitting 300,000 characters may simply overrun again.
Record the outcome, not the prediction.

### What it redirects

The straggler cuts group into 29 distinct events.
At 180 seconds each that is an upper bound of 1.45 hours inside a 3.73 hour run.
It is an upper bound and must be read as one:
`runStageRound` assembles from its `arrived` map rather than awaiting abandoned calls,
so the true per-event cost is at most the grace window and may be less.

That is potentially a larger lever than the serialization question `#213` was opened on,
and 21 of the 34 cuts are the seat `#211` already fixes.
So the order is now: land `#211` and re-measure, then re-derive the window, then prototype fan-out.
Measuring fan-out first would be measuring a system about to change underneath it.

### Two tasks this opened

`#214` re-derives the straggler window.
`doc/decision/translation-repair-straggler-grace.md` rests on the claim that no hung call had ever
been recorded and every cut voice was slow-but-working.
A voice cut mid-reply after 3,020,068 characters refutes that.
The decision should be superseded rather than edited, since its reasoning was correct for the
population it had, and it should not be reverted:
60 seconds really did cut `hf:zai-org/GLM-5.2` inside its ordinary range, and still would.

`#215` adds elapsed milliseconds to the stream completion line.
A production run currently cannot answer where its own wall-clock went,
because dispatch is logged at `debug` and production emits only `info` and `warn`,
while the completion line carries `firstByte` and `maxGap` but no duration.
That is why the 1.45 hour figure is a bound rather than a measurement,
and why `#213` cannot yet measure the baseline it needs.

### Corrected count for `#213`

The first pass said seven serialization sites and grepped four wrong paths.
The full sweep finds eleven resting on the refuted premise, seven of them on the production path,
and `src/editor-ensemble.ts:248` is the one with a clean argument:
envelopes within a slice are independent, nothing reads back an earlier envelope's outcome,
and `Promise.all` preserves order, so gathering concurrently and folding in index order is
byte-identical output for pure latency.
The task carries the full list, including the sites that are correctly sequential and must not be
touched.

### Two more findings from the same run (2026-08-25)

The deepseek zero-content anomaly is RESOLVED, and it is the same defect as `#211` intermittently.
It had been held open because the instrument used then was a 40-line scan window over 9 samples
with a measured 39 percent hit rate on healthy calls.
The completion line's own content count answers it on roughly 1,200 streams:
`deepseek-v4-pro-0813` is zero-content on 12 of 127, every one with reasoning above zero,
against a baseline of exactly zero across eight other seats.
What remains a prediction rather than a conclusion is whether `#211`'s fix removes those 12,
since the fix exempts `input_json_delta` and not `text_delta`.
Count them on the first post-fix run.

`#216` implements an owner instruction that turns out never to have been implemented:
"Please make sure to put even the full tool schema into system prompts."
Seventeen modules build a system message and NOT ONE carries its response schema;
the seven that name a schema at all name it only as the API-level `responseFormat`.
The supporting evidence is that all 6 schema failures in this run are on Charm Hyper seats,
`gemma-4-26b-a4b-it` 4 and `qwen3.8-max` 2, with zero on Synthetic,
and one of them reads `{"checks": "\n[{\"region\":` ,
a JSON-stringified array where the schema declares an array of objects.
That is the wrong-tool-call-format failure the owner named.
The provider split is confounded, since those seats are also different models,
so the task says so and does not claim the protocol causes it.

### The `#200` power projection flips, on measured accrual (2026-08-25)

`#200` recorded that 40 slices "lands a hair under the line", worst-case z 2.776 against a
Bonferroni threshold of 2.807 at ten seats.
That rested on a projected 63 percent yield.
Measured at 16 of 40 slices, the yield is 75 percent: 12 of 16 slices contributed a judged round.

Judged-round accrual, counted from `selectBestCandidate` votes rather than projected:

-   407 votes over 16 slices, which at roughly one ballot per judge is about 41 rounds.
-   2.54 rounds per slice, and 2.30 with the single richest slice dropped,
    so no one slice carries the rate.
-   The 14-slice run that settled nothing managed 2.07 per slice from 10 contributing slices.

Holding the prior effect size, 40 slices reaches about 30 contributing slices,
so z scales by the square root of 3 and the deflated best z goes from 1.76 to roughly 3.05,
clearing 2.807 by 0.24.

DO NOT ACT ON THIS EITHER, for the same reason the original projection carried.
The effect size it holds was measured on FIVE models, and the pooled preference rate roughly halves
at ten seats, so the z it implies could move in either direction.
The margin is thin in both directions and the run measures the effect size directly.
Read the standing when it exits; the projection is superseded either way.

## Landing sequence for the parked work, verified ready (2026-08-25)

Everything below is blocked on the calibration exiting and nothing else.
The archive was verified on 2026-08-25 and applies cleanly:
`gzip --test` passes, it holds 33 repo-relative paths,
HEAD descends from its base `f800f1352`,
every commit between that base and HEAD is documentation only,
and NONE of the 33 files changed in that range.
So untarring over the repo root reverts nothing and clobbers no concurrent work.

### Order, and why this order

CORRECTED 2026-08-25: step 1 used to read the pid file, which holds the wrong process.
`doc/runbook/translation-repair-corpus-pass.md` carries the reasoning and the controls.

```sh
# 1. Confirm the run is actually gone, rather than merely quiet.
#    NOT the pid file: it holds the launching bash wrapper, and the work runs
#    two levels below it. Measured live: bash 3038649 at 2792 KB, mise 3038654,
#    node 3038820 at 126340 KB doing the work. Ask what is running instead.
running() {
  for d in /proc/[0-9]*; do
    [ -r "$d/cmdline" ] || continue
    mapfile -d '' -t argv < "$d/cmdline" 2>/dev/null || continue
    [ "${#argv[@]}" -gt 0 ] || continue
    [ "$(basename -- "${argv[0]}")" = node ] || continue
    for a in "${argv[@]:1}"; do
      [ "$(basename -- "$a")" = "$1" ] && echo "alive pid=${d#/proc/}"
    done
  done
}
running editor-calibrate.mjs   # silence means gone

# 2. Read the standing FIRST, while the tree still matches the build that
#    produced it. This answers `#200`, and nothing else here can change it.
node ~/temp/agent/standing-from-log.mjs \
  ~/temp/agent/editor-calibrate-fullroster-20260825.log

# 3. Land the parked work. 16 new files, 17 modified, 0 identical.
tar --extract --file ~/temp/agent/spend-telemetry-210.tar.gz \
  --directory /var/home/user/worktrees/translation-repair

# 4. Build BEFORE any test: the suite imports from `dist/`, so a test run
#    against a stale bundle measures the old code and passes.
mise run //package/module/translation-repair:build

# 5. Then lint, types, tests.
mise run //package/module/translation-repair:lint
mise run //package/module/translation-repair:lint:types
mise run //package/module/translation-repair:test:unit
```

### The commit, and the trap in it

`CPN`: a pathspec commit omits any file it does not name, and this lands SIXTEEN
new files. Naming only the modified ones would commit a tree whose imports do not
resolve at that commit while the working tree still builds, which is invisible
until somebody checks out that commit.

Verify with `git status --short` afterwards that nothing is left untracked.

New files, all of which must appear in the pathspec:

    package/module/translation-repair/src/candidate-ledger.ts
    package/module/translation-repair/src/candidate-ledger.unit.test.ts
    package/module/translation-repair/src/candidate-select-record.ts
    package/module/translation-repair/src/corpus-run/hyper-price.ts
    package/module/translation-repair/src/corpus-run/hyper-price.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-parse.ts
    package/module/translation-repair/src/corpus-run/ledger-read.ts
    package/module/translation-repair/src/corpus-run/ledger-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/ledger-report.ts
    package/module/translation-repair/src/corpus-run/spend-cost.ts
    package/module/translation-repair/src/corpus-run/spend-cost.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-read.ts
    package/module/translation-repair/src/corpus-run/spend-read.unit.test.ts
    package/module/translation-repair/src/corpus-run/spend-report.ts
    package/module/translation-repair/src/spend-line.ts
    package/module/translation-repair/src/spend-line.unit.test.ts

Modified files:

    package/module/translation-repair/mise.toml
    package/module/translation-repair/rolldown.node.config.ts
    package/module/translation-repair/src/anthropic-delta-scan.ts
    package/module/translation-repair/src/anthropic-delta-scan.unit.test.ts
    package/module/translation-repair/src/ballot-barrel.ts
    package/module/translation-repair/src/candidate-select.ts
    package/module/translation-repair/src/corpus-run/sentinel-probe.ts
    package/module/translation-repair/src/editor-ensemble.ts
    package/module/translation-repair/src/hyper-client.ts
    package/module/translation-repair/src/judge-fidelity.ts
    package/module/translation-repair/src/pipeline-barrel.ts
    package/module/translation-repair/src/provider-barrel.ts
    package/module/translation-repair/src/refine-stage.ts
    package/module/translation-repair/src/stream-idle-guard.ts
    package/module/translation-repair/src/stream-idle-guard.unit.test.ts
    package/module/translation-repair/src/synthetic-client.ts
    package/module/translation-repair/src/translate-judge.ts

### The three measurements owed immediately after, before anything else is built

Each one is a prediction already on record, and each is falsifiable. Take them on
the first post-fix run rather than reasoning about them.

-   `qwen3.8-max` cut rate. Pre-fix baseline 21 of 119, 17.6 percent, stable
    against an earlier 12 of 71. `#211` predicts NOT that this falls but that
    each cut costs a fraction of the time and bytes, because `contentCap` can
    finally see the model. Record whichever happens.
-   `deepseek-v4-pro-0813` zero-content count. Pre-fix 12 of 127. Twelve to zero
    means it is the same mechanism as `qwen3.8-max`; twelve holding means
    `text_delta` inside a thinking block, which `#211` deliberately does not
    exempt, and that opens its own task.
-   `qwen3.8-max` content characters at p50 and p95. Pre-fix both are 0. Any
    nonzero value confirms the routing fix at the user boundary rather than in a
    unit test.

## The run will finish, and budget is not what would stop it (2026-08-25)

Measured at 4h21m into the full-roster calibration,
off its own 115 `METERS` readings,
read with `node dist/final/node/meter-report.mjs` directly
rather than through the task, which would have rebuilt `dist` underneath it.

Both providers answered every reading:
`synthetic wet=115 dry=0 unreadable=0`, `hyper wet=115 dry=0 unreadable=0`,
so this run has had no outage at all and its numbers carry no availability caveat.

Runway against work left, which is the only question that mattered:

-   Hyper drained 205 of 10000 in 4.39h, so 46.7 per hour, leaving 210 hours of runway.
-   Synthetic drained 5.183pp gross in the same window, so 1.18pp per hour, leaving 79 hours.
-   Seventeen of forty slices are done, and the remaining twenty three come to
    6.0 hours at the whole-run mean gap of 943s,
    7.3 hours at the slower last-half mean of 1150s,
    and 12.9 hours if every remaining slice were as slow as the slowest one yet seen at 2017s.

Even the pessimistic arm finishes with an order of magnitude of budget to spare.
Nothing here needs the account owner to top up or reset anything.

### The weekly allowance refilled mid-run, and endpoint arithmetic is 62% wrong

`syntheticWeekly` ROSE once in 115 steps,
from 95.594% to 97.577% at 2026-08-25T03:03:24.086Z, a jump of 1.982pp.
The subscription window rolls, so an allowance is not a monotone drain.

That breaks the obvious way to price a run.
Net endpoint change reads 3.200pp,
gross drain summed over the downward steps alone reads 5.183pp,
so subtracting the endpoints understates what was actually spent by 62%.

THE SAME DETECTOR FOUND ZERO RISES IN `hyperBalance`, 0 of 115 steps,
which is what a prepaid balance should do and is what makes the synthetic
result meaningful rather than an untested instrument.

`meter-report` prints `level first` and `level last`,
which are exactly the two numbers a reader will subtract.
It does not claim they are spend, and its own job is duty cycle and outages,
but nothing warns that the difference is not the cost.
`#210`'s token-priced spend line is the right instrument for cost
and this is one more reason it is: meter deltas cannot answer the question at all.

### Slice lines carry no timestamp, which is more of `#215`

Sixteen of the seventeen slice gaps here were recovered by carrying the most
recent `METERS` timestamp forward through the log,
because `slice N of 40` lines have no timestamp of their own.
`#215` is recorded as a run being unable to say where its wall-clock went
for want of a duration on the completion line.
It is worse than that: the per-slice progress lines cannot be placed on a clock
at all except by leaning on an unrelated line that happens to be timestamped.
Whatever `#215` adds should cover the progress lines too.

## Corpus text in commits: what the owner decided, and the rule (2026-08-25)

Raised because a sweep found corpus text committed to a PUBLIC repository,
and the working rule carried across sessions said it should never be there.
`doc/audit/corpus-text-reached-a-public-repository.md` has the measurements.
The short version: fifteen documents under `doc/` carry 185 lines of Chinese
source text, plus English memorial sentences that a script-keyed scan cannot see,
on `origin/translation-repair-rebased`, none of it on `origin/main`,
publicly readable since 2026-08-20.

THE OWNER DECIDED NOTHING IS REMOVED.
Exposing corpus text is sometimes fine, because the owner is friends with the
people who run the site the corpus comes from.
So no file changes, no history is rewritten, nothing is force-pushed,
and the repository stays public.
A session that rediscovers this must not reopen it, must not offer to scrub it,
and must not treat it as an incident.
The relationship that makes it fine is not visible from inside the repository,
which is why it is written here.

### The rule going forward

The instruction attached to that decision was to take extra care not to expose
more in commits later.
Permission is not indifference, and it is not retroactive cover for adding more
without thinking.

-   Corpus text enters a commit only when it carries evidence nothing else can carry,
    and only as much of it as the evidence needs.
    Where a rendering changed a tense, or an aligner paired the wrong headings,
    the wording IS the finding and quoting it is right.
    Where the point is a count, a rate, a slice index or a model's behaviour,
    it is not, and the id and index say it better.

-   Never quote because quoting was easier than naming.
    That is the failure mode that produced 185 lines:
    each one was individually defensible and nobody was counting.

-   A document ABOUT the exposure quotes nothing.
    Naming files and counts is the whole discipline,
    so an audit that reprints the evidence repeats the fault it records.

-   Everything else about handling the corpus is unchanged.
    It is read at runtime from the pinned clone by `git show <sha>:<path>`,
    corpus files are never committed,
    and artifacts and grading sheets stay under run directories outside the repository.

### Why this is not an `AGENTS.md` rule

Proposed there and declined by the owner as too narrow to be worth a repo-wide
shortcode: it is a rule about one corpus, in one package, under one relationship.
It belongs where the people working on that package will read it.

## Corpus exposure is not a blocker, and sanitization is the last step (2026-08-25)

Supersedes the caution in the corpus-exposure sections of this handover.
The owner set the plan after `#456` was measured:

-   COMMIT THE CORPUS HOWEVER IS CONVENIENT.
    Do not spend effort avoiding corpus text in commits,
    do not shrink a quote to dodge exposure,
    and do not treat a corpus-bearing diff as something to route around.
    Nothing about corpus text blocks any commit on this branch.

-   SANITIZATION HAPPENS ONCE, AT THE END.
    When the pipeline is production ready,
    tell the owner with the `AskUserQuestion` tool rather than in ordinary prose,
    because that is the signal they are waiting for.
    They will disable branch protection temporarily,
    and the corpus content committed along the way gets sanitized then.

-   THE DENY-LIST IS BUILT AND NOT INSTALLED.
    `doc/decision/corpus-deny-list-for-forbidden-strings.md` has the design and the evidence.
    Installing 10206 literal rules today would cost about two minutes of rule compilation
    on every single commit, because the scanner recompiles the runtime rules file per scan.
    `#456` is the fix. The deny-list waits for it rather than taxing every commit,
    and it waits without cost, since sanitization at the end covers the same ground.

WHAT THIS DOES NOT CHANGE.
The corpus is still read at runtime from the pinned clone,
corpus files are still never committed as corpus files,
and artifacts and grading sheets still live under run directories outside the repository.
The change is that quoting inside our own documents is now unremarkable.

FOR THE SANITIZATION ITSELF (rendering-8, 2026-08-26):
the persisted runs of the settled rendering audit, `<runs dir>/rendering-audit-settled/*.json`,
carry document spans and model prose in every row's `report`
(`locator.text`, `focus.text` on both sides, each voice's `reason`),
so they are corpus-bearing whatever the `textIdentity` digest beside them says;
the module notes that once claimed otherwise were corrected in `744890056`.

## Two source fixes found while the run was live, both owed (2026-08-25)

Both were found by testing documentation against reality rather than by reading code,
and both edit `src/`, which restamps the pipeline digest and invalidates
the slice cache the calibration has been buying since 01:29Z.
So both wait for the run, and both belong in the landing sequence
after the standing is read and the parked work is extracted.

-   `#217`: `verify-published` cannot tell a clean run from an empty one.
    NOW BUILT AND PARKED, in the section `#217` is built, GFP-proven and parked.
    `doc/runbook/translation-repair-corpus-pass.md` carries the workaround until it lands.

-   `#218`: a real Bilibili account UID sat in the TSDoc `@example` for `readingAnchors`
    in `image-reading-sense.ts`.
    NOW FIXED AND PARKED beside `#217`.
    An invented UID was rejected, because any ten-digit number could be somebody's real account.
    The example now reads `'posted by Mittens on 2019-04-07'`,
    which demonstrates more of what the docstring claims than the original did:
    it lists a date and a username first, and the old example carried only a digit run.

`#219` is not a code fix and is the easiest thing here to lose:
when the pipeline is production ready, say so with the `AskUserQuestion` tool,
not in prose, because that is the signal the owner is waiting for
before disabling branch protection to sanitize the committed corpus text.

## Sections aged out into the history (2026-08-26)

Moved verbatim into `doc/handover/translation-repair-history.md` when this file passed its cap by
more than 1500 lines (register item A-5), because each is closed work whose conclusion is already
encoded in the code or in a decision record. Their headings, in the order they now sit in the history:

-   The settled artifacts already carry editor rounds, and they do not support the reseat
-   Zero editor rounds does not mean nothing was repaired (`#200`)
-   How many slices an editor calibration needs, measured from production
-   The 14-slice editor calibration finished, and it settles no seat (`#200`)
-   What the suite actually reaches, measured (2026-08-24)
-   `#217` is built, GFP-proven and parked (2026-08-25)
-   The parked work is now build-and-test verified together, not just apply-clean (2026-08-25)
-   `#216` was half wrong, and reading the source before building found it (2026-08-25)
-   `#215`: a run now says where its wall-clock went, and a CLI reads it back
-   `#205`: the two-lane artifact family is named for its shape, not a version
-   The landing was rehearsed on a throwaway, and it works
-   The three report CLIs are documented, and the landing was re-checked for collisions
-   The refiner column is thinner than the editor column, by about four times
-   The run's power inputs, measured at 38 of 40 slices
-   An unreadable run file printed itself, and the fix was a whole class rather than one CLI
-   A second calibration is in flight, to pay four measurements the landing left owed
-   The same defect had a second half, reaching a sink through a catch (`#224`, 2026-08-25)
-   A third shape, found by asking which other parsers quote (`#225`, 2026-08-25)
-   Does any error class quote what it was handed? Scanned, not sampled (2026-08-25)
-   Every entry point now reports its refusals, settled by measurement (`#226`, 2026-08-25)
-   The cause sweep, which the message scan had missed (2026-08-25)
-   A stream the provider cut short was the one transport failure that never retried (`#228`, 2026-08-25)
-   Which error messages may be repeated, decided by a rule rather than an audit (`#227`, 2026-08-25)
-   The guard proof found the guard was somewhere else (`#224`, 2026-08-25)
-   Four guard proofs, run once the bundle was free (`#225`, `#228`, 2026-08-25)
-   The pipeline now keeps what each model wrote (`#212`, 2026-08-25)
-   The ledger has a reader, and writing it found a real gap (`#212`, 2026-08-25)
-   `#211` is proved at the wire, and the fix is in (2026-08-25)
