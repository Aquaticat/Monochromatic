# Translation repair history: 2026-08-26 audit, part 02

Part 02 of [Translation repair history: 2026-08-26 audit](translation-repair-history-11-2026-08-26-audit-segment-01.md),
whose index lists every part in order.

## AUDIT IN PROGRESS: the whole package, before any new work (`#236`, 2026-08-26), continued

### State of the tree, continued

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
