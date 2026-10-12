# Translation-repair package audit, part 01

Part 01 of [Translation-repair package audit](translation-repair-package-audit.md),
whose index lists every part in order.

## Scope and method

Subject:
`package/module/translation-repair` at `b20120fbb`
(worktree `/var/home/user/worktrees/translation-repair`,
branch `translation-repair-rebased`).

The source is partitioned into ten slices,
every file in exactly one,
checked by script before the reading started:
`provider` (76 files,
20733 lines),
`probes` (63,
20031),
`document` (77,
19246),
`slices` (58,
18550),
`repair` (65,
17544),
`translate` (66,
16700),
`artifact` (47,
13786),
`calibrate` (33,
10042),
`consolidate` (28,
7408),
`rendering` (19,
6264).
File lists:
`~/temp/agent/audit-slices/<slice>.txt`.

Each slice is read in full by a forked reviewer under seven lenses,
in this priority order:
silent failure (the `#235` class),
wrong output,
resilience under provider failure,
corpus or key leakage,
contract drift between prose and code,
repo-rule violations the linters cannot see,
and test-coverage gaps.
Reviewer reports land in `~/temp/agent/audit-<slice>.md`.
The harness runs at most five reviewers at once,
so the second five slices start as the first five finish.

A reviewer's report is a lead.
Every BLOCKER and MAJOR is re-verified at the cited line before it enters the register;
"checked and found sound" sections are recorded as the reviewer's claim,
not as evidence.
Reviewers inherit this session's context,
so a report that omits the `#235` fallback,
the `RunConfigError` marker gap,
or the seat-silence gap in the slice that holds them is treated as a skim,
and that slice is re-read by the main session.

## Baseline, measured before anything was touched

- `mise run //package/module/translation-repair:lint:types`:
  exit 0.
- `mise run //package/module/translation-repair:lint:oxlint`:
  0 warnings,
  0 errors,
  965 files,
  484 rules.
- `mise run //package/module/translation-repair:buildAndTest`:
  exit 0;
  750 suites carry the runner's `] PASS ` prefix,
  0 carry `] FAIL `
  (log `~/temp/agent/audit-buildAndTest-20260826T024842Z.log`).
- Build alone:
  2.0 s wall (`rolldown` 539 ms),
  which sets the cost of each GFP mutate-and-rebuild cycle.
- Source:
  532 files,
  150304 lines (tests and benches excluded).
  Tests:
  432 files,
  146083 lines.
  Benches: 0.
- Node:
  `v26.7.0` under mise,
  so the `import.meta.main` guard every CLI uses is live.

## Mechanical layers, swept over the whole package

Each sweep was run with `rg` over `src` excluding `*.test.ts`,
and each null result was checked
against a pattern known to match,
so a zero is a measured zero rather than a silent one.

- Provider request fields the owner forbade (`thinking`,
  `budget_tokens`,
  `reasoning_effort`):
  0 in code.
  The two textual matches are comments in `anthropic-request.ts:438` and `synthetic-client.ts:260`
  recording the prohibition.
- Inline debt markers (`TODO`,
  `FIXME`,
  `HACK`,
  `XXX`): 0.
  The single textual match is `U+XXXX` in a TSDoc line of `mask-invisible-lines.ts:157`.
- Lint suppressions:
  62 `oxlint-disable` lines,
  every one carrying a `--` justification;
  59 are `no-await-in-loop` (sequential awaits on purpose),
  2 `typescript/strict-void-return`,
  1 `no-restricted-syntax/no-regex`.
  `@ts-ignore` and `@ts-expect-error`: 0.
- Banned constructs:
  `switch`:
  0;
  `process.exit(`:
  0;
  `string | undefined`:
  0;
  non-null `!` assertions:
  0;
  `try...finally`:
  0 in code
  (three textual matches are comments explaining why a disposable is used instead).
- Raw `console.*` outside `src/corpus-run`:
  10,
  all inside TSDoc `@example` blocks.
- Quorum arithmetic:
  exactly one site,
  `stage-quorum.ts:167` (`Math.ceil(modelIds.length / 2)`),
  tested at `:219` and `:327` with `>=`.
- CLI refusal boundary:
  38 files call `reportingRefusals(` under `if (import.meta.main)`,
  matching the `#226` census;
  the four other files that mention `process.argv` are argument helpers with no `import.meta.main`.
- `package.json` declares no `bin`,
  so `AP4` (shebang) does not apply;
  every CLI runs through a mise task.
- Tests:
  0 files without `expect(`;
  0 `.skip`/`.only`/`todo`;
  4 test names carry an all-caps verdict word (see finding `A-6`);
  4 files hold more `it({` cases than `expect(` calls
  (`compare-candidates.unit.test.ts` 8 against 3,
  `checker-roster.unit.test.ts` 9 against 8,
  `wording-coherence.unit.test.ts` 5 against 4,
  `slice-coverage.unit.test.ts` 5 against 4),
  to be read rather than assumed to be gaps.

## How the test mass is covered

The 146083 test lines sit outside every slice,
and that exclusion is deliberate and named here
rather than silent.
Branch coverage of the implementation was measured by mutation in `#233` (73 branches,
19 gaps closed)
and `#234` (twenty depth-two rounds,
eight gaps closed),
reachability from the built bundle in `#208`,
`#209`,
`#231` and `#232`,
and throw assertions were rewritten to check classes in `#127`.
This audit reads a test file when a finding lands in the module it covers,
when a reviewer names a branch as untested,
or when the mechanical sweeps single it out (the four files listed under the mechanical layer).
A full test-side reading pass is not part of this audit unless a slice report shows the prior
measurements to be wrong,
in which case it is scheduled as its own item.

## Documentation and decisions layers

- `doc/planning/translation-repair-open-decisions.md` (2046 lines) is titled as still open,
  while `doc/decision/translation-repair-question-answers.md` records the owner's answers to
  questions 1 through 7 and the planning document itself marks question 8 answered.
  Questions 9 and 10 have decision records of their own
  (`translation-repair-straggler-grace.md`,
  `translation-repair-runaway-call-termination.md`).
  Drift,
  not a defect:
  a reader starting from the planning document is told to decide things
  already decided.
- `doc/handover/translation-repair.md` is 3440 lines against the 2000-line cap it sets for itself.
- `package/module/translation-repair/README.md:418-423` documents the `#235` defect as a feature:
  the Charm Hyper key is "OPTIONAL,
  and its absence is not an error".
  Rewritten in the same commit as the `#235` fix.
- `doc/troubleshooting/translation-repair-unread-signals.md` still lists two signals nothing acts on:
  `alignment.findings` (recorded,
  reaches no stage) and the quote-anchoring findings.
  That document calls it a design question and does not settle it;
  this audit does not either,
  and records it so it is not rediscovered.
- `doc/audit/translation-repair-debt-layers.md` (2026-08-19) reported the same zero-debt result
  for layers four and five at 610 files;
  this audit's sweep at 532 source files agrees.

## Findings register

Tally as of 2026-08-26,
after all ten slices reported:
2 BLOCKER (A-1 fixed,
probes-1 open as `#247`),
21 MAJOR of which 1 fixed (A-2),
14 open as their own tasks (`#237` to `#246`,
`#248` to `#251`,
`#252` to `#257`),
and 6 folded into those tasks (slices-1 to slices-3,
artifact-1,
artifact-2,
rendering-2);
by the end of 2026-08-26 every MAJOR task,
`#237` to `#257`,
is fixed in place,
each marked FIXED under its entry,
and roughly seventy MINOR,
verified where cited and queued after the MAJORs.

Closing tally,
measured 2026-08-26 after the last landing (`8bffaba9b`):
every entry under this heading carries a
FIXED,
CLOSED,
folded or tracked marker;
counted by heading,
3 BLOCKER,
28 MAJOR and 35 MINOR (a grouped heading
such as `document-5 to document-12` counts once).
The measurement found three entries without a marker,
all fixed
in fact and recorded since:
`provider-1` (with A-1),
`provider-14` (CLOSED by the MAJOR landings) and `calibrate-1`,
whose pointer half was the one piece still owed and landed in `8bffaba9b`.
Whole suite after `50ffffc07`:
814 PASS,
0 FAIL,
exit 0.
Guards recorded as owed inside FIXED blocks (repair-8's typography half,
consolidate-5,
probes-10
and probes-11,
calibrate-5 and calibrate-8,
repair-2,
document-11,
slices-5 and slices-8 as type-checked only) are
not defects;
they are the places where the landing is proven by the type check or by measurement rather than by a
mutation,
and each says so under its entry.

Severity:
BLOCKER is wrong or missing output,
silent failure,
data loss,
or corpus/key leakage;
MAJOR is a contract violation or resilience gap likely to bite in a real run;
MINOR is a rule violation or coverage gap with no output effect.
IDs prefixed `A-` come from the main session's own reading;
IDs prefixed with a slice name come from that slice's reviewer and were re-verified.

### A-1, BLOCKER, verified: half the roster is sent to a provider that cannot serve it (`#235`)

`src/corpus-run/run-config.ts:611-617`:
`createRunClient` returns the bare Synthetic client when `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`
is unset,
and `src/synthetic-client.ts:265` sends any model id to the wire with no catalog check,
so the five Charm-Hyper-only roster labels fail every call with HTTP 400 while quorum
(`stage-quorum.ts:167`,
five of ten,
met with `>=`) lets every round stand.
Evidence and the fix design are on `#235`;
the launch that triggered it ran `node dist/...` directly from a fork worktree without secrets.

FIXED 2026-08-26:
guards in `e0010019f`,
fix in `8b289c3ab`.
`createRunClient` requires both keys (a missing one is a stated refusal naming the variable,
exit 6),
the Synthetic client refuses any id outside its catalog before the wire on both surfaces,
every call through the factory's client is counted on `RUN_SEATS`,
and `reportingRefusals` prints `SEAT` lines plus a `SEATS DARK:` line at the end of every command.
Each of five fix lines was removed in turn,
rebuilt,
and its suite failed
(2,
3,
2,
4,
2 failing lines);
each was then restored and passed.
Negative control:
a bare `node` launch with no Hyper key exits 6 with the variable name,
no frames,
no `SEAT` lines.
Live verification,
2026-08-26:
a one-slice `editor-calibrate` under `mise run` from this worktree exited 0
with rounds `10/10` three times and `9/10` twice (never `5/10`),
zero `hf: prefix` refusals,
every one of the ten seats asked five times,
nine usable five of five,
`qwen3.8-max` usable three and thrown two (a wobble,
not a dark seat),
and no `SEATS DARK:` line.
The calibration's own coverage sentence still said six of ten seats wrote something;
that is standing coverage,
and the `SEAT` lines now separate it from darkness.
Correction to the earlier diagnosis:
the fork worktree carries an encrypted `.env.local.json` byte-identical to the main one;
the half-dark run had been launched with bare `node`,
which is what left the key unset.

### A-2, MAJOR, verified: a missing key is reported as a fault, and its name is muted

`src/corpus-run/run-config.ts:45-60`:
`RunConfigError` carries no `messageNamesOnly` marker,
so `reportingRefusals` (`src/corpus-run/cli-refusal.ts`) prints `refused by RunConfigError`
plus a fault stack and exits 5.
The variable name,
the one thing the operator needs,
never reaches the terminal.
Fix:
make it a stated refusal (exit 6),
with the `#235` change.

FIXED 2026-08-26 in `8b289c3ab`:
`RunConfigError` extends `StatedRefusalError`,
so the variable name is repeated at exit 6.

### A-3, MINOR, verified: the README documents the `#235` defect as a feature

`README.md:418-423`,
quoted under the documentation layer.
Fixed with `#235`.

FIXED 2026-08-26 in `8b289c3ab`:
the credentials section now says the second key is required and documents the closing `SEAT` lines.

### A-4, MINOR, verified: the open-decisions document is stale against its own answers

Detail under the documentation layer.
Fix:
a status line per question at the top of the planning document pointing at the record
that answered it.

FIXED 2026-08-26:
a status block under the title names the record answering each of the ten questions.

### A-5, MINOR, verified: the handover exceeds its own cap by 1440 lines

Fix:
move the oldest closed sections verbatim into `doc/handover/translation-repair-history.md`,
per the rule the handover states in its preamble.

FIXED 2026-08-26:
25 closed sections (1844 lines) moved verbatim into the history under a dated marker,
checked
by a line-multiset comparison of the two files before and after;
the handover stands at 1775 lines.

### A-6, MINOR, verified: four test names carry an all-caps verdict word (`TNM`)

`src/corpus-run/bench-report-groups.unit.test.ts:132` (`PASS`),
`src/refine-phase.unit.test.ts:412` (`PASSED`),
`src/corpus-run/run-timing.unit.test.ts:178` (`PASSES OVER`),
`src/budget-routing.unit.test.ts:174` (`FAILS OVER`).
The runner's own verdict prefix is `] PASS `,
so prefix-anchored counts are unaffected,
but a bare-substring grep reports the opposite of the truth on these four.
Fix:
reword (`ACCEPTS`,
`KEEPS`,
`SKIPS`,
`ROUTES TO HYPER`).

FIXED 2026-08-26 in `70a520e7b`:
the four names read RUN,
CLEARED,
SKIPS and SWITCHES TO HYPER,
and two more
found by a package-wide sweep (`PASSES quotas through`,
`PASSES an unsettled ... answer through`) read FORWARDS;
the sweep now finds no all-caps verdict word in any test name.

### calibrate-1, MAJOR, verified: the "nothing above warn" premise of `#235`'s silence half is wrong

`src/corpus-run/editor-calibrate.ts:359-367` ends the calibration with `coverageGapLines`,
and `src/producer-silence.ts:222` renders
`WROTE NOTHING AT ALL: <models>. No candidate of theirs reached any slate, so the table covers N of M seats`.
The arm A log carries that line twice (EDITOR and REFINER),
each ending `covers 5 of 10 seats`.
So the handover's "said nothing at any level above warn" and the troubleshooting document's
"nothing aggregates it" were wrong,
and both are corrected in this commit.
What is actually missing is narrower and still real:
the line cannot tell a budget refusal from a timeout from a seat failing every call with HTTP 400
(its own wording says so),
it carries no per-seat call or failure count,
it is stdout prose under exit 0,
and it exists only in the two calibration CLIs;
the pass's per-entry `TALLY` line (`src/corpus-run/settled-tally.ts`) has no seat field,
and the other 36 CLIs have nothing of the kind.
Consequence for the `#235` design:
the process-scoped seat tally reported by `reportingRefusals`
stays,
because it is the only universal boundary,
and it must print asked,
usable,
and failure
counts per dark seat with the failure class;
`coverageGapLines` stays as the standing-coverage
measure it already is,
and its sentence gains a pointer at the seat report.

FIXED 2026-08-26:
the seat report landed with A-1 (`8b289c3ab`:
`SEAT <model> asked= usable= unusable= threw=`
per seat and a `SEATS DARK:` line at the end of every command),
and the pointer landed in `8bffaba9b`:
the
`WROTE NOTHING AT ALL` sentence now says the `SEAT` lines at the end of the command carry how often each seat was
asked and how many answers were usable,
and that the run log names the failure.
Guard:
the pointer removed fails
`POINTS AT THE SEAT LINES from the silent-seat sentence`;
restored,
passes.
Found unmarked when the closing tally
was measured;
the pointer was the only half of the consequence still owed.

SUPERSEDED IN PART 2026-08-26 (`#263`,
landed in source `d8a040edf` and `04f1ebafd`,
unbuilt while the arms hold
`dist`):
the sentence itself was wrong for a seat that answered.
Arm A's REFINER table called `minimax-m3` silent
beside `SEAT minimax-m3 asked=31 usable=31`,
and arm A2 did it for two seats,
because the refiner's `produced` list
was built from slates and a rewriter that leaves a paragraph as it stands never reaches one.
The refine stage now
carries out who it heard,
the coverage split takes `answered` as a fourth input,
and the line reads `ANSWERED AND
WAS NEVER SLATED` for that seat;
a seat that does not record who answered (editor,
translate;
`#266`) says so in
its silent line instead of calling the unknown silent.
The pointer at the `SEAT` lines stays on every wording.

### calibrate-2, MAJOR, verified: the pass prints any error's message into its stdout summary

`src/corpus-run/pass-entry.ts:522-529` and `:641-648`:
`Error.isError(error) ? error.message.slice(0, ERROR_MESSAGE_CAP) : String(error)` lands in
`TALLY <id> status=ERROR ... error=<message>` and `CLEANUP <id> ... error=<message>`.
That bypasses the `#227` rule that only `messageNamesOnly` classes may repeat their message:
`SyntheticHttpError` (`src/completion-shape.ts`) embeds an excerpt of the provider's raw body,
and any unmarked parser class may quote a passage.
The `TALLY` line is the one operators grep and paste.
Fix:
`error=${refusalText({ error })}` at both sites,
with the full text kept in the run log
through the tagged logger where diagnosis needs it.
Tracked as `#237`.

FIXED 2026-08-26 in `c19d203c6` (lint tidy in `82db8fb4e`):
the TALLY and CLEANUP lines,
the sentinel probe's
PROBE line,
and the rendering audit's REFUSED line print `refusalText`,
a marked class in its own words and
anything else by name;
the CLEANUP guard fails with the printer restored (2 failing lines),
passes restored.

### calibrate-3, MINOR, verified: an operator refusal thrown as a bare `Error`

`src/corpus-run/editor-width-control.ts:186-190` throws `new Error('editor width control refused: ...')`,
so the boundary prints `refused by Error` plus a fault stack and exits 5;
the sibling site `editor-width-probe.ts:139` already uses `StatedRefusalError`.

FIXED 2026-08-26 in `acfc7ad22`:
the refusal is a `StatedRefusalError`,
so the boundary prints it in one line
and exits 6,
and the usable suite asserts the class.
Guard:
with the site throwing a bare `Error` again,
the case
`REFUSES a draw whose every slice holds one sentence` fails;
restored,
passes.

### calibrate-4, MINOR, verified: `MislabelledArtifactError` writes remedies nobody sees

`src/corpus-run/pass-schema-guard.ts:229-277` builds an operator remedy ("Ways forward")
into a class that is correctly unmarked,
because `reason` carries a parser's text
(`caughtValueText(error)` at `:378`),
so the boundary prints only `refused by MislabelledArtifactError`.
Fix:
a marked class naming entry,
generation,
and the ways forward;
the reader's reason goes
to the log through `refusalText`.

FIXED 2026-08-26 in `acfc7ad22`:
`MislabelledArtifactError` carries `messageNamesOnly` and names the entry,
the generation and the ways forward;
the reader's own objection is logged at warn through `refusalText` at the
throw site,
and the inventory in `message-names-only.unit.test.ts` lists the class as marked.
Guard:
with the marker removed,
the inventory cases `KEEPS exactly the classes the inventory records` and
`KEEPS a reason for every class that writes its sentence and stays unmarked` fail;
restored,
passes.

### calibrate-5, MINOR, verified: `editor-calibrate` builds a client per slice

`src/corpus-run/editor-calibrate.ts:211`:
`createRunClient()` inside `runOne`,
so budget cooldowns,
meter caches,
and per-model limiters restart on every slice,
and a provider held out on slice N is re-asked immediately on slice N+1.
`editor-width-probe.ts:94` and `window-trial-probe.ts:326` build once in `main`.
This is also why the arm A log carries four `is not set` warnings.

FIXED 2026-08-26 in `acfc7ad22`:
`main` builds the client once,
before the slice loop,
and hands it to
`runOne`;
the only `createRunClient()` call left in the file is that one.
No test observes client construction,
so this one is verified by reading the diff rather than by a guard.

### calibrate-6, MINOR, verified: the refusal streak resets on slices the ledger already held

`src/corpus-run/window-trial-probe.ts:410-416`:
`bought.refusedInARow = 0` runs before
`if (rows.length === 0) continue`,
and a slice already complete in the ledger returns empty rows,
so on a resumed run a fault refusing every NEW slice never reaches `REFUSALS_BEFORE_STOPPING`,
and each refusal still buys a producer slate.
Fix:
reset only when `rows.length > 0`.

FIXED 2026-08-26 in `acfc7ad22`:
the streak is a function,
`streakAfter` in `window-trial-protocol.ts`,
and a slice the ledger already held leaves it where it was;
the loop reads it on both paths.
Guard:
with the held slice resetting the streak again,
the cases
`REFUSES to reset the streak on a slice the ledger already held` and
`reaches the stop across a resumed run whose held slices interleave with refusals of every new one` fail;
restored,
passes.

### calibrate-7, MINOR, verified: the control's sentence cut needs a trailing space

`src/corpus-run/editor-width-control.ts:38-43`:
`TERMINATORS = ['。', '. ', '! ', '? ']`,
so a passage with one sentence per line reads as one sentence and leaves the positive control.

FIXED 2026-08-26 in `acfc7ad22`:
`TERMINATORS` gains the three stops that end their line.
Guard:
with them removed,
the case `REMOVES THE FIRST SENTENCE at a stop that ends its line` fails;
restored,
passes.

### calibrate-8, MINOR, verified: `verify-published` overclaims on unweighable entries

`src/corpus-run/verify-published.ts:260` returns `missing.length === 0` for an entry whose
artifact predates the stored archive text,
and the closing line at `:378-381` says every page
carries its wordings "at the length it implies" although no length was checked for them.
The per-entry line does say `UNWEIGHED`;
the summary does not.

FIXED 2026-08-26 in `acfc7ad22`:
`reportEntry` answers `agreed-weighed`,
`agreed-unweighed` or `disagreed`,
and the closing line reads
`N of M pages carry every wording their artifact promised; K of those at the length it implies, U UNWEIGHED because
the artifact predates the stored archive text`.
Verified at the boundary:
over the 2026-08-17 runs directory,
which has no published tree,
the line reads
`0 of 0 ... 0 of those ... 0 UNWEIGHED` and the command exits 1;
over an empty directory the command takes its `NOTHING VERIFIED` exit 2 before the line.
No unit guard:
`verify-published.ts` has no suite and the counting sits inside `main`;
recorded as a gap,
not claimed.

### calibrate-9, MINOR, verified: `PublishedPageDisagreesError` is unmarked

`src/corpus-run/published-page-check.ts:499-507`:
the class documents that it names slices
and counts and quotes nothing,
and carries no `messageNamesOnly`,
so at a boundary it is muted.

FIXED 2026-08-26 in `acfc7ad22`:
the class moved to `published-page-disagreement.ts`,
takes a typed
`PageDisagreement` (wordings missing,
or weight off) and writes its own sentence from indices and counts,
which is
what lets it carry the marker:
the inventory refuses the marker to a class that forwards a caller's sentence,
so the
old shape could never have been marked.
Guard:
with the marker removed the same two inventory cases as calibrate-4 fail;
restored,
passes.

### calibrate-10, MINOR, verified: four modules in the slice are referenced by no test

`pass-settled.ts` (whose module note records a past silent defect:
a directory named `<id>.json`
counted as settled),
`editor-width-arm.ts`,
`pass-schema-census.ts`,
`window-trial-probe.ts`:
`rg --files-with-matches` over `*.test.ts` finds 0 references for each.

FIXED 2026-08-26 in `acfc7ad22`:
suites for `pass-settled.ts` (a directory or a symlink named like an
artifact is not counted,
and the count agrees with the id set),
`pass-schema-census.ts` (every classification,
in name
order,
skipping the directory and the suffix-less file),
`editor-width-arm.ts` (a blank arm with no producer,
and a
composite arm naming both editors as producers) and `window-trial-protocol.ts` (the digest and the streak,
lifted out
of the command so they reach the bundle),
plus a boundary case in `window-trial-probe.unit.test.ts` that runs the built
command with every provider key withheld and expects the stated refusal and exit 6.
The census suite found a real defect on the way:
a file holding a JSON array passed `isJsonRecord`,
carried no version
field,
and was filed as an unversioned generation,
a sound result to keep;
it is `malformed` now.
Guards:
the listing filter answering true for every entry fails three pass-settled cases;
the array check removed
fails `classifies JSON that is not a record as malformed too`;
the blank rule removed fails
`reads an arm whose editors proposed nothing as BLANK with no producer`;
each restored,
passes.
The scheduler's listing is renamed `artifactBackedIds`:
the bundle already exported a `settledEntryIds` that lists
the published tree,
and the barrel refused the second.

### calibrate-11, note: the window-trial ledger stores model-produced English

`src/corpus-run/window-trial-ledger.ts:83` writes `winnerText` to `<runs>/window-trial/arms.jsonl`.
Outside the repository by design;
listed so the sanitization step knows the file exists.

### provider-1, BLOCKER, verified: the `#235` path, confirmed independently at source

Same defect as `A-1`;
the reviewer reached it from the code alone and added one fact:
`src/synthetic-client.ts:264-265` builds the wire body as `model: request.modelId` with no
catalog or `hf:` check anywhere in `synthetic-client.ts`,
`synthetic-transport.ts`,
or `run-config.ts`,
while the routing client cannot misroute this way (`provider-router.unit.test.ts:210` pins it).
The TSDoc at `run-config.ts:564-568` ("THE SECOND KEY IS OPTIONAL AND ITS ABSENCE IS LOUD")
describes a refusal the code does not make.

FIXED 2026-08-26 with A-1 (`e0010019f`,
`8b289c3ab`):
the Synthetic client refuses any id outside its catalog
before the wire on both surfaces,
both keys are required,
and the TSDoc that promised a loud absence is gone
(`SECOND KEY IS OPTIONAL` has no match in `run-config.ts`,
measured 2026-08-26).
Recorded here because this entry
carried no marker of its own until the register's closing tally was measured.

### provider-2, MAJOR, verified: the second-opinion re-ask releases a Synthetic slot it never took

`src/provider-router.ts:320-324` increments `inFlightOnSynthetic` only when `chooseProvider` decides
Synthetic;
`:389` releases one slot (`using slot = heldSlot(...)`) on EVERY Synthetic call in `callOn`;
the `chatJson` re-ask at `:597` calls `callOn({ provider: elsewhere })` without `chooseProvider`.
Whenever the preferred answer came from Hyper and was unusable,
`elsewhere` is Synthetic and the
release decrements a count nothing incremented,
so the count drifts negative and the saturation
test at `:305` (`>= syntheticSlotsPerModel`) needs extra concurrent calls before overflow to Hyper
resumes.
The comment at `:384-385` asserts a pairing this path breaks;
`provider-router.unit.test.ts:519` covers only the Synthetic-to-Hyper direction.
Tracked as `#240`.

FIXED 2026-08-26 in `fd8ac6c7e`:
the re-ask takes a Synthetic slot right after the budget read,
with no
`await` between,
so the release in `callOn` pairs with a take in both directions.
Guard:
a Hyper-to-Synthetic re-ask followed by two concurrent calls still splits one slot between the providers;
with the take removed both calls land on Synthetic (2 failing lines);
restored,
passes.

### provider-3, MAJOR, verified: the roster-to-catalog proof is a type nothing instantiates

`src/hyper-catalog.ts:329` exports `HyperOnlyNamesAreServed` and no other line in `src` names it,
so adding a label to `HYPER_ONLY_ROSTER_IDS` without a `HYPER_MODELS` row type-checks and surfaces
at run time as one `NoProviderForModelError` per call,
converted by `attemptStageCall` into a lost
voice:
the `#235` class again,
one roster edit away.
Tracked as `#241`.

FIXED 2026-08-26 in `bbbd5f2c5` and `995b76f30`:
the proof is a value (`HYPER_ONLY_NAMES_ARE_SERVED`) that fails
the type check when the conditional resolves to `never`,
`hyperServesLabel` reads the Hyper catalog under a
label's exact spelling,
and three cases open `roster-reach.unit.test.ts` pinning the roster against both catalogs.
Guard:
a bogus Hyper-only roster label makes `lint:types` fail at the value (TS2322) and the two roster cases
fail naming the label;
restored,
passes.

### provider-4, MAJOR (mechanism verified, frequency unknown): text and tool deltas fold into one answer

`src/anthropic-completion.ts:249-262` pushes both `text_delta` and `input_json_delta` fragments
into `fold.answerParts` with no block attribution.
`hyper-catalog.ts:180` runs `qwen3.8-max` with `toolChoice: 'auto'`,
under which a leading text
block is legal;
such a stream yields prose plus JSON,
fails the schema,
and loses the voice,
and a
Hyper-only seat has no other stack for a second opinion.
No mixed-stream case exists in `anthropic-completion.unit.test.ts`.
How often the provider does this is unmeasured;
a wire capture decides the size.
Tracked as `#242`.

FIXED 2026-08-26 in `3bc37b4f1`:
text and tool fragments accumulate apart;
the tool arguments are the answer
whenever there are any,
prose is the answer only when no tool was called,
and set-aside prose is logged by size.
Guard:
a stream with a text block before the tool block yields the JSON alone;
with the channels glued again the
case fails on the prose prefix (2 lines);
restored,
passes.
Frequency in the wild stays unmeasured,
as the finding said;
the reader is now correct whatever it is.
