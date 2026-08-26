# Translation-repair package audit

Status:
IN PROGRESS, opened 2026-08-26 as task `#236`.
Findings are appended as they are verified;
a finding listed here was re-read at the cited line by the main session,
never taken from a reviewer's report on trust.

Owner's instruction, verbatim:
"Do an exhaustive audit of the package so far.
Focus on existing issues rather than branching into new ones for now,
until you're confident there are no big existing issues."

## Scope and method

Subject:
`package/module/translation-repair` at `b20120fbb`
(worktree `/var/home/user/worktrees/translation-repair`, branch `translation-repair-rebased`).

The source is partitioned into ten slices, every file in exactly one,
checked by script before the reading started:
`provider` (76 files, 20733 lines),
`probes` (63, 20031),
`document` (77, 19246),
`slices` (58, 18550),
`repair` (65, 17544),
`translate` (66, 16700),
`artifact` (47, 13786),
`calibrate` (33, 10042),
`consolidate` (28, 7408),
`rendering` (19, 6264).
File lists: `~/temp/agent/audit-slices/<slice>.txt`.

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
"checked and found sound" sections are recorded as the reviewer's claim, not as evidence.
Reviewers inherit this session's context,
so a report that omits the `#235` fallback, the `RunConfigError` marker gap,
or the seat-silence gap in the slice that holds them is treated as a skim,
and that slice is re-read by the main session.

## Baseline, measured before anything was touched

- `mise run //package/module/translation-repair:lint:types`: exit 0.
- `mise run //package/module/translation-repair:lint:oxlint`: 0 warnings, 0 errors, 965 files, 484 rules.
- `mise run //package/module/translation-repair:buildAndTest`: exit 0;
  750 suites carry the runner's `] PASS ` prefix, 0 carry `] FAIL `
  (log `~/temp/agent/audit-buildAndTest-20260826T024842Z.log`).
- Build alone: 2.0 s wall (`rolldown` 539 ms), which sets the cost of each GFP mutate-and-rebuild cycle.
- Source: 532 files, 150304 lines (tests and benches excluded).
  Tests: 432 files, 146083 lines.
  Benches: 0.
- Node: `v26.7.0` under mise, so the `import.meta.main` guard every CLI uses is live.

## Mechanical layers, swept over the whole package

Each sweep was run with `rg` over `src` excluding `*.test.ts`, and each null result was checked
against a pattern known to match, so a zero is a measured zero rather than a silent one.

- Provider request fields the owner forbade (`thinking`, `budget_tokens`, `reasoning_effort`):
  0 in code.
  The two textual matches are comments in `anthropic-request.ts:438` and `synthetic-client.ts:260`
  recording the prohibition.
- Inline debt markers (`TODO`, `FIXME`, `HACK`, `XXX`): 0.
  The single textual match is `U+XXXX` in a TSDoc line of `mask-invisible-lines.ts:157`.
- Lint suppressions: 62 `oxlint-disable` lines, every one carrying a `--` justification;
  59 are `no-await-in-loop` (sequential awaits on purpose), 2 `typescript/strict-void-return`,
  1 `no-restricted-syntax/no-regex`.
  `@ts-ignore` and `@ts-expect-error`: 0.
- Banned constructs: `switch`: 0; `process.exit(`: 0; `string | undefined`: 0;
  non-null `!` assertions: 0; `try...finally`: 0 in code
  (three textual matches are comments explaining why a disposable is used instead).
- Raw `console.*` outside `src/corpus-run`: 10, all inside TSDoc `@example` blocks.
- Quorum arithmetic: exactly one site, `stage-quorum.ts:167` (`Math.ceil(modelIds.length / 2)`),
  tested at `:219` and `:327` with `>=`.
- CLI refusal boundary: 38 files call `reportingRefusals(` under `if (import.meta.main)`,
  matching the `#226` census;
  the four other files that mention `process.argv` are argument helpers with no `import.meta.main`.
- `package.json` declares no `bin`, so `AP4` (shebang) does not apply; every CLI runs through a mise task.
- Tests: 0 files without `expect(`; 0 `.skip`/`.only`/`todo`;
  4 test names carry an all-caps verdict word (see finding `A-6`);
  4 files hold more `it({` cases than `expect(` calls
  (`compare-candidates.unit.test.ts` 8 against 3, `checker-roster.unit.test.ts` 9 against 8,
  `wording-coherence.unit.test.ts` 5 against 4, `slice-coverage.unit.test.ts` 5 against 4),
  to be read rather than assumed to be gaps.

## How the test mass is covered

The 146083 test lines sit outside every slice, and that exclusion is deliberate and named here
rather than silent.
Branch coverage of the implementation was measured by mutation in `#233` (73 branches, 19 gaps closed)
and `#234` (twenty depth-two rounds, eight gaps closed),
reachability from the built bundle in `#208`, `#209`, `#231` and `#232`,
and throw assertions were rewritten to check classes in `#127`.
This audit reads a test file when a finding lands in the module it covers,
when a reviewer names a branch as untested,
or when the mechanical sweeps single it out (the four files listed under the mechanical layer).
A full test-side reading pass is not part of this audit unless a slice report shows the prior
measurements to be wrong, in which case it is scheduled as its own item.

## Documentation and decisions layers

- `doc/planning/translation-repair-open-decisions.md` (2046 lines) is titled as still open,
  while `doc/decision/translation-repair-question-answers.md` records the owner's answers to
  questions 1 through 7 and the planning document itself marks question 8 answered.
  Questions 9 and 10 have decision records of their own
  (`translation-repair-straggler-grace.md`, `translation-repair-runaway-call-termination.md`).
  Drift, not a defect: a reader starting from the planning document is told to decide things
  already decided.
- `doc/handover/translation-repair.md` is 3440 lines against the 2000-line cap it sets for itself.
- `package/module/translation-repair/README.md:418-423` documents the `#235` defect as a feature:
  the Charm Hyper key is "OPTIONAL, and its absence is not an error".
  Rewritten in the same commit as the `#235` fix.
- `doc/troubleshooting/translation-repair-unread-signals.md` still lists two signals nothing acts on:
  `alignment.findings` (recorded, reaches no stage) and the quote-anchoring findings.
  That document calls it a design question and does not settle it; this audit does not either,
  and records it so it is not rediscovered.
- `doc/audit/translation-repair-debt-layers.md` (2026-08-19) reported the same zero-debt result
  for layers four and five at 610 files; this audit's sweep at 532 source files agrees.

## Findings register

Severity:
BLOCKER is wrong or missing output, silent failure, data loss, or corpus/key leakage;
MAJOR is a contract violation or resilience gap likely to bite in a real run;
MINOR is a rule violation or coverage gap with no output effect.
IDs prefixed `A-` come from the main session's own reading;
IDs prefixed with a slice name come from that slice's reviewer and were re-verified.

### A-1, BLOCKER, verified: half the roster is sent to a provider that cannot serve it (`#235`)

`src/corpus-run/run-config.ts:611-617`:
`createRunClient` returns the bare Synthetic client when `TRANSLATION_REPAIR_CHARM_HYPER_API_KEY`
is unset, and `src/synthetic-client.ts:265` sends any model id to the wire with no catalog check,
so the five Charm-Hyper-only roster labels fail every call with HTTP 400 while quorum
(`stage-quorum.ts:167`, five of ten, met with `>=`) lets every round stand.
Evidence and the fix design are on `#235`;
the launch that triggered it ran `node dist/...` directly from a fork worktree without secrets.

### A-2, MAJOR, verified: a missing key is reported as a fault, and its name is muted

`src/corpus-run/run-config.ts:45-60`: `RunConfigError` carries no `messageNamesOnly` marker,
so `reportingRefusals` (`src/corpus-run/cli-refusal.ts`) prints `refused by RunConfigError`
plus a fault stack and exits 5.
The variable name, the one thing the operator needs, never reaches the terminal.
Fix: make it a stated refusal (exit 6), with the `#235` change.

### A-3, MINOR, verified: the README documents the `#235` defect as a feature

`README.md:418-423`, quoted under the documentation layer.
Fixed with `#235`.

### A-4, MINOR, verified: the open-decisions document is stale against its own answers

Detail under the documentation layer.
Fix: a status line per question at the top of the planning document pointing at the record
that answered it.

### A-5, MINOR, verified: the handover exceeds its own cap by 1440 lines

Fix: move the oldest closed sections verbatim into `doc/handover/translation-repair-history.md`,
per the rule the handover states in its preamble.

### A-6, MINOR, verified: four test names carry an all-caps verdict word (`TNM`)

`src/corpus-run/bench-report-groups.unit.test.ts:132` (`PASS`),
`src/refine-phase.unit.test.ts:412` (`PASSED`),
`src/corpus-run/run-timing.unit.test.ts:178` (`PASSES OVER`),
`src/budget-routing.unit.test.ts:174` (`FAILS OVER`).
The runner's own verdict prefix is `] PASS `, so prefix-anchored counts are unaffected,
but a bare-substring grep reports the opposite of the truth on these four.
Fix: reword (`ACCEPTS`, `KEEPS`, `SKIPS`, `ROUTES TO HYPER`).

### calibrate-1, MAJOR, verified: the "nothing above warn" premise of `#235`'s silence half is wrong

`src/corpus-run/editor-calibrate.ts:359-367` ends the calibration with `coverageGapLines`,
and `src/producer-silence.ts:222` renders
`WROTE NOTHING AT ALL: <models>. No candidate of theirs reached any slate, so the table covers N of M seats`.
The arm A log carries that line twice (EDITOR and REFINER), each ending `covers 5 of 10 seats`.
So the handover's "said nothing at any level above warn" and the troubleshooting document's
"nothing aggregates it" were wrong, and both are corrected in this commit.
What is actually missing is narrower and still real:
the line cannot tell a budget refusal from a timeout from a seat failing every call with HTTP 400
(its own wording says so), it carries no per-seat call or failure count,
it is stdout prose under exit 0, and it exists only in the two calibration CLIs;
the pass's per-entry `TALLY` line (`src/corpus-run/settled-tally.ts`) has no seat field,
and the other 36 CLIs have nothing of the kind.
Consequence for the `#235` design: the process-scoped seat tally reported by `reportingRefusals`
stays, because it is the only universal boundary, and it must print asked, usable, and failure
counts per dark seat with the failure class; `coverageGapLines` stays as the standing-coverage
measure it already is, and its sentence gains a pointer at the seat report.

### calibrate-2, MAJOR, verified: the pass prints any error's message into its stdout summary

`src/corpus-run/pass-entry.ts:522-529` and `:641-648`:
`Error.isError(error) ? error.message.slice(0, ERROR_MESSAGE_CAP) : String(error)` lands in
`TALLY <id> status=ERROR ... error=<message>` and `CLEANUP <id> ... error=<message>`.
That bypasses the `#227` rule that only `messageNamesOnly` classes may repeat their message:
`SyntheticHttpError` (`src/completion-shape.ts`) embeds an excerpt of the provider's raw body,
and any unmarked parser class may quote a passage.
The `TALLY` line is the one operators grep and paste.
Fix: `error=${refusalText({ error })}` at both sites, with the full text kept in the run log
through the tagged logger where diagnosis needs it.
Tracked as `#237`.

### calibrate-3, MINOR, verified: an operator refusal thrown as a bare `Error`

`src/corpus-run/editor-width-control.ts:186-190` throws `new Error('editor width control refused: ...')`,
so the boundary prints `refused by Error` plus a fault stack and exits 5;
the sibling site `editor-width-probe.ts:139` already uses `StatedRefusalError`.

### calibrate-4, MINOR, verified: `MislabelledArtifactError` writes remedies nobody sees

`src/corpus-run/pass-schema-guard.ts:229-277` builds an operator remedy ("Ways forward")
into a class that is correctly unmarked, because `reason` carries a parser's text
(`caughtValueText(error)` at `:378`), so the boundary prints only `refused by MislabelledArtifactError`.
Fix: a marked class naming entry, generation, and the ways forward; the reader's reason goes
to the log through `refusalText`.

### calibrate-5, MINOR, verified: `editor-calibrate` builds a client per slice

`src/corpus-run/editor-calibrate.ts:211`: `createRunClient()` inside `runOne`,
so budget cooldowns, meter caches, and per-model limiters restart on every slice,
and a provider held out on slice N is re-asked immediately on slice N+1.
`editor-width-probe.ts:94` and `window-trial-probe.ts:326` build once in `main`.
This is also why the arm A log carries four `is not set` warnings.

### calibrate-6, MINOR, verified: the refusal streak resets on slices the ledger already held

`src/corpus-run/window-trial-probe.ts:410-416`: `bought.refusedInARow = 0` runs before
`if (rows.length === 0) continue`, and a slice already complete in the ledger returns empty rows,
so on a resumed run a fault refusing every NEW slice never reaches `REFUSALS_BEFORE_STOPPING`,
and each refusal still buys a producer slate.
Fix: reset only when `rows.length > 0`.

### calibrate-7, MINOR, verified: the control's sentence cut needs a trailing space

`src/corpus-run/editor-width-control.ts:38-43`: `TERMINATORS = ['。', '. ', '! ', '? ']`,
so a passage with one sentence per line reads as one sentence and leaves the positive control.

### calibrate-8, MINOR, verified: `verify-published` overclaims on unweighable entries

`src/corpus-run/verify-published.ts:260` returns `missing.length === 0` for an entry whose
artifact predates the stored archive text, and the closing line at `:378-381` says every page
carries its wordings "at the length it implies" although no length was checked for them.
The per-entry line does say `UNWEIGHED`; the summary does not.

### calibrate-9, MINOR, verified: `PublishedPageDisagreesError` is unmarked

`src/corpus-run/published-page-check.ts:499-507`: the class documents that it names slices
and counts and quotes nothing, and carries no `messageNamesOnly`, so at a boundary it is muted.

### calibrate-10, MINOR, verified: four modules in the slice are referenced by no test

`pass-settled.ts` (whose module note records a past silent defect: a directory named `<id>.json`
counted as settled), `editor-width-arm.ts`, `pass-schema-census.ts`, `window-trial-probe.ts`:
`rg --files-with-matches` over `*.test.ts` finds 0 references for each.

### calibrate-11, note: the window-trial ledger stores model-produced English

`src/corpus-run/window-trial-ledger.ts:83` writes `winnerText` to `<runs>/window-trial/arms.jsonl`.
Outside the repository by design; listed so the sanitization step knows the file exists.

## Slice reports

Each entry records the reviewer's coverage claim, then what the main session verified.

- `provider`: pending.
- `translate`: pending.
- `repair`: pending.
- `probes`: pending.
- `calibrate`: reviewer read 33 of 33 files (10042 lines), none unread;
  reported 2 MAJOR and 9 MINOR, all eleven re-verified at the cited lines and recorded;
  the reviewer named the `#235` fallback and the `RunConfigError` gap unprompted
  and corrected the silence premise, which is the opposite of a skim.
  Its open questions, handed to other slices:
  whether `candidate-select.ts:347` `judgesAvailable` counts seated or reachable judges (`consolidate`),
  whether `producer-calibrate.ts` also builds a client per slice (`translate`),
  and whether any consumer prints the `reason` field `pass-schema-census.ts` stores from a `SyntaxError`.
- `consolidate`: not started (queued behind the concurrency cap).
- `document`: not started.
- `artifact`: not started.
- `slices`: not started.
- `rendering`: not started.

## What this audit does not cover

- Live behaviour against the providers.
  No model call is made by the audit;
  the `#235` fix will be verified live at the user boundary as its own step.
- The corpus itself, and the quality of shipped translations.
  Those are measured by the instruments in the `probes` and `rendering` slices,
  whose honesty is what the audit checks.
