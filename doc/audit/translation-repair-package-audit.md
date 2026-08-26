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

Tally as of 2026-08-26, after all ten slices reported:
2 BLOCKER (A-1 fixed, probes-1 open as `#247`),
21 MAJOR of which 1 fixed (A-2), 14 open as their own tasks (`#237` to `#246`, `#248` to `#251`, `#252` to `#257`),
and 6 folded into those tasks (slices-1 to slices-3, artifact-1, artifact-2, rendering-2);
by the end of 2026-08-26 every MAJOR task, `#237` to `#257`, is fixed in place, each marked FIXED under its entry,
and roughly seventy MINOR, verified where cited and queued after the MAJORs.

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

FIXED 2026-08-26: guards in `e0010019f`, fix in `8b289c3ab`.
`createRunClient` requires both keys (a missing one is a stated refusal naming the variable, exit 6),
the Synthetic client refuses any id outside its catalog before the wire on both surfaces,
every call through the factory's client is counted on `RUN_SEATS`,
and `reportingRefusals` prints `SEAT` lines plus a `SEATS DARK:` line at the end of every command.
Each of five fix lines was removed in turn, rebuilt, and its suite failed
(2, 3, 2, 4, 2 failing lines); each was then restored and passed.
Negative control: a bare `node` launch with no Hyper key exits 6 with the variable name, no frames, no `SEAT` lines.
Live verification, 2026-08-26: a one-slice `editor-calibrate` under `mise run` from this worktree exited 0
with rounds `10/10` three times and `9/10` twice (never `5/10`), zero `hf: prefix` refusals,
every one of the ten seats asked five times, nine usable five of five,
`qwen3.8-max` usable three and thrown two (a wobble, not a dark seat), and no `SEATS DARK:` line.
The calibration's own coverage sentence still said six of ten seats wrote something;
that is standing coverage, and the `SEAT` lines now separate it from darkness.
Correction to the earlier diagnosis:
the fork worktree carries an encrypted `.env.local.json` byte-identical to the main one;
the half-dark run had been launched with bare `node`, which is what left the key unset.

### A-2, MAJOR, verified: a missing key is reported as a fault, and its name is muted

`src/corpus-run/run-config.ts:45-60`: `RunConfigError` carries no `messageNamesOnly` marker,
so `reportingRefusals` (`src/corpus-run/cli-refusal.ts`) prints `refused by RunConfigError`
plus a fault stack and exits 5.
The variable name, the one thing the operator needs, never reaches the terminal.
Fix: make it a stated refusal (exit 6), with the `#235` change.

FIXED 2026-08-26 in `8b289c3ab`:
`RunConfigError` extends `StatedRefusalError`, so the variable name is repeated at exit 6.

### A-3, MINOR, verified: the README documents the `#235` defect as a feature

`README.md:418-423`, quoted under the documentation layer.
Fixed with `#235`.

FIXED 2026-08-26 in `8b289c3ab`:
the credentials section now says the second key is required and documents the closing `SEAT` lines.

### A-4, MINOR, verified: the open-decisions document is stale against its own answers

Detail under the documentation layer.
Fix: a status line per question at the top of the planning document pointing at the record
that answered it.

FIXED 2026-08-26: a status block under the title names the record answering each of the ten questions.

### A-5, MINOR, verified: the handover exceeds its own cap by 1440 lines

Fix: move the oldest closed sections verbatim into `doc/handover/translation-repair-history.md`,
per the rule the handover states in its preamble.

FIXED 2026-08-26: 25 closed sections (1844 lines) moved verbatim into the history under a dated marker, checked
by a line-multiset comparison of the two files before and after; the handover stands at 1775 lines.

### A-6, MINOR, verified: four test names carry an all-caps verdict word (`TNM`)

`src/corpus-run/bench-report-groups.unit.test.ts:132` (`PASS`),
`src/refine-phase.unit.test.ts:412` (`PASSED`),
`src/corpus-run/run-timing.unit.test.ts:178` (`PASSES OVER`),
`src/budget-routing.unit.test.ts:174` (`FAILS OVER`).
The runner's own verdict prefix is `] PASS `, so prefix-anchored counts are unaffected,
but a bare-substring grep reports the opposite of the truth on these four.
Fix: reword (`ACCEPTS`, `KEEPS`, `SKIPS`, `ROUTES TO HYPER`).

FIXED 2026-08-26 in `70a520e7b`: the four names read RUN, CLEARED, SKIPS and SWITCHES TO HYPER, and two more
found by a package-wide sweep (`PASSES quotas through`, `PASSES an unsettled ... answer through`) read FORWARDS;
the sweep now finds no all-caps verdict word in any test name.

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

FIXED 2026-08-26 in `c19d203c6` (lint tidy in `82db8fb4e`): the TALLY and CLEANUP lines, the sentinel probe's
PROBE line, and the rendering audit's REFUSED line print `refusalText`, a marked class in its own words and
anything else by name; the CLEANUP guard fails with the printer restored (2 failing lines), passes restored.

### calibrate-3, MINOR, verified: an operator refusal thrown as a bare `Error`

`src/corpus-run/editor-width-control.ts:186-190` throws `new Error('editor width control refused: ...')`,
so the boundary prints `refused by Error` plus a fault stack and exits 5;
the sibling site `editor-width-probe.ts:139` already uses `StatedRefusalError`.

FIXED 2026-08-26 in `acfc7ad22`: the refusal is a `StatedRefusalError`, so the boundary prints it in one line
and exits 6, and the usable suite asserts the class.
Guard: with the site throwing a bare `Error` again, the case
`REFUSES a draw whose every slice holds one sentence` fails; restored, passes.

### calibrate-4, MINOR, verified: `MislabelledArtifactError` writes remedies nobody sees

`src/corpus-run/pass-schema-guard.ts:229-277` builds an operator remedy ("Ways forward")
into a class that is correctly unmarked, because `reason` carries a parser's text
(`caughtValueText(error)` at `:378`), so the boundary prints only `refused by MislabelledArtifactError`.
Fix: a marked class naming entry, generation, and the ways forward; the reader's reason goes
to the log through `refusalText`.

FIXED 2026-08-26 in `acfc7ad22`: `MislabelledArtifactError` carries `messageNamesOnly` and names the entry,
the generation and the ways forward; the reader's own objection is logged at warn through `refusalText` at the
throw site, and the inventory in `message-names-only.unit.test.ts` lists the class as marked.
Guard: with the marker removed, the inventory cases `KEEPS exactly the classes the inventory records` and
`KEEPS a reason for every class that writes its sentence and stays unmarked` fail; restored, passes.

### calibrate-5, MINOR, verified: `editor-calibrate` builds a client per slice

`src/corpus-run/editor-calibrate.ts:211`: `createRunClient()` inside `runOne`,
so budget cooldowns, meter caches, and per-model limiters restart on every slice,
and a provider held out on slice N is re-asked immediately on slice N+1.
`editor-width-probe.ts:94` and `window-trial-probe.ts:326` build once in `main`.
This is also why the arm A log carries four `is not set` warnings.

FIXED 2026-08-26 in `acfc7ad22`: `main` builds the client once, before the slice loop, and hands it to
`runOne`; the only `createRunClient()` call left in the file is that one.
No test observes client construction, so this one is verified by reading the diff rather than by a guard.

### calibrate-6, MINOR, verified: the refusal streak resets on slices the ledger already held

`src/corpus-run/window-trial-probe.ts:410-416`: `bought.refusedInARow = 0` runs before
`if (rows.length === 0) continue`, and a slice already complete in the ledger returns empty rows,
so on a resumed run a fault refusing every NEW slice never reaches `REFUSALS_BEFORE_STOPPING`,
and each refusal still buys a producer slate.
Fix: reset only when `rows.length > 0`.

FIXED 2026-08-26 in `acfc7ad22`: the streak is a function, `streakAfter` in `window-trial-protocol.ts`,
and a slice the ledger already held leaves it where it was; the loop reads it on both paths.
Guard: with the held slice resetting the streak again, the cases
`REFUSES to reset the streak on a slice the ledger already held` and
`reaches the stop across a resumed run whose held slices interleave with refusals of every new one` fail;
restored, passes.

### calibrate-7, MINOR, verified: the control's sentence cut needs a trailing space

`src/corpus-run/editor-width-control.ts:38-43`: `TERMINATORS = ['。', '. ', '! ', '? ']`,
so a passage with one sentence per line reads as one sentence and leaves the positive control.

FIXED 2026-08-26 in `acfc7ad22`: `TERMINATORS` gains the three stops that end their line.
Guard: with them removed, the case `REMOVES THE FIRST SENTENCE at a stop that ends its line` fails; restored, passes.

### calibrate-8, MINOR, verified: `verify-published` overclaims on unweighable entries

`src/corpus-run/verify-published.ts:260` returns `missing.length === 0` for an entry whose
artifact predates the stored archive text, and the closing line at `:378-381` says every page
carries its wordings "at the length it implies" although no length was checked for them.
The per-entry line does say `UNWEIGHED`; the summary does not.

FIXED 2026-08-26 in `acfc7ad22`: `reportEntry` answers `agreed-weighed`, `agreed-unweighed` or `disagreed`,
and the closing line reads
`N of M pages carry every wording their artifact promised; K of those at the length it implies, U UNWEIGHED because
the artifact predates the stored archive text`.
Verified at the boundary: over the 2026-08-17 runs directory, which has no published tree, the line reads
`0 of 0 ... 0 of those ... 0 UNWEIGHED` and the command exits 1;
over an empty directory the command takes its `NOTHING VERIFIED` exit 2 before the line.
No unit guard: `verify-published.ts` has no suite and the counting sits inside `main`; recorded as a gap, not claimed.

### calibrate-9, MINOR, verified: `PublishedPageDisagreesError` is unmarked

`src/corpus-run/published-page-check.ts:499-507`: the class documents that it names slices
and counts and quotes nothing, and carries no `messageNamesOnly`, so at a boundary it is muted.

FIXED 2026-08-26 in `acfc7ad22`: the class moved to `published-page-disagreement.ts`, takes a typed
`PageDisagreement` (wordings missing, or weight off) and writes its own sentence from indices and counts, which is
what lets it carry the marker: the inventory refuses the marker to a class that forwards a caller's sentence, so the
old shape could never have been marked.
Guard: with the marker removed the same two inventory cases as calibrate-4 fail; restored, passes.

### calibrate-10, MINOR, verified: four modules in the slice are referenced by no test

`pass-settled.ts` (whose module note records a past silent defect: a directory named `<id>.json`
counted as settled), `editor-width-arm.ts`, `pass-schema-census.ts`, `window-trial-probe.ts`:
`rg --files-with-matches` over `*.test.ts` finds 0 references for each.

FIXED 2026-08-26 in `acfc7ad22`: suites for `pass-settled.ts` (a directory or a symlink named like an
artifact is not counted, and the count agrees with the id set), `pass-schema-census.ts` (every classification, in name
order, skipping the directory and the suffix-less file), `editor-width-arm.ts` (a blank arm with no producer, and a
composite arm naming both editors as producers) and `window-trial-protocol.ts` (the digest and the streak, lifted out
of the command so they reach the bundle), plus a boundary case in `window-trial-probe.unit.test.ts` that runs the built
command with every provider key withheld and expects the stated refusal and exit 6.
The census suite found a real defect on the way: a file holding a JSON array passed `isJsonRecord`, carried no version
field, and was filed as an unversioned generation, a sound result to keep; it is `malformed` now.
Guards: the listing filter answering true for every entry fails three pass-settled cases; the array check removed
fails `classifies JSON that is not a record as malformed too`; the blank rule removed fails
`reads an arm whose editors proposed nothing as BLANK with no producer`; each restored, passes.
The scheduler's listing is renamed `artifactBackedIds`: the bundle already exported a `settledEntryIds` that lists
the published tree, and the barrel refused the second.

### calibrate-11, note: the window-trial ledger stores model-produced English

`src/corpus-run/window-trial-ledger.ts:83` writes `winnerText` to `<runs>/window-trial/arms.jsonl`.
Outside the repository by design; listed so the sanitization step knows the file exists.

### provider-1, BLOCKER, verified: the `#235` path, confirmed independently at source

Same defect as `A-1`; the reviewer reached it from the code alone and added one fact:
`src/synthetic-client.ts:264-265` builds the wire body as `model: request.modelId` with no
catalog or `hf:` check anywhere in `synthetic-client.ts`, `synthetic-transport.ts`, or `run-config.ts`,
while the routing client cannot misroute this way (`provider-router.unit.test.ts:210` pins it).
The TSDoc at `run-config.ts:564-568` ("THE SECOND KEY IS OPTIONAL AND ITS ABSENCE IS LOUD")
describes a refusal the code does not make.

### provider-2, MAJOR, verified: the second-opinion re-ask releases a Synthetic slot it never took

`src/provider-router.ts:320-324` increments `inFlightOnSynthetic` only when `chooseProvider` decides
Synthetic; `:389` releases one slot (`using slot = heldSlot(...)`) on EVERY Synthetic call in `callOn`;
the `chatJson` re-ask at `:597` calls `callOn({ provider: elsewhere })` without `chooseProvider`.
Whenever the preferred answer came from Hyper and was unusable, `elsewhere` is Synthetic and the
release decrements a count nothing incremented, so the count drifts negative and the saturation
test at `:305` (`>= syntheticSlotsPerModel`) needs extra concurrent calls before overflow to Hyper
resumes.
The comment at `:384-385` asserts a pairing this path breaks;
`provider-router.unit.test.ts:519` covers only the Synthetic-to-Hyper direction.
Tracked as `#240`.

FIXED 2026-08-26 in `fd8ac6c7e`: the re-ask takes a Synthetic slot right after the budget read, with no
`await` between, so the release in `callOn` pairs with a take in both directions.
Guard: a Hyper-to-Synthetic re-ask followed by two concurrent calls still splits one slot between the providers;
with the take removed both calls land on Synthetic (2 failing lines); restored, passes.

### provider-3, MAJOR, verified: the roster-to-catalog proof is a type nothing instantiates

`src/hyper-catalog.ts:329` exports `HyperOnlyNamesAreServed` and no other line in `src` names it,
so adding a label to `HYPER_ONLY_ROSTER_IDS` without a `HYPER_MODELS` row type-checks and surfaces
at run time as one `NoProviderForModelError` per call, converted by `attemptStageCall` into a lost
voice: the `#235` class again, one roster edit away.
Tracked as `#241`.

FIXED 2026-08-26 in `bbbd5f2c5` and `995b76f30`: the proof is a value (`HYPER_ONLY_NAMES_ARE_SERVED`) that fails
the type check when the conditional resolves to `never`, `hyperServesLabel` reads the Hyper catalog under a
label's exact spelling, and three cases open `roster-reach.unit.test.ts` pinning the roster against both catalogs.
Guard: a bogus Hyper-only roster label makes `lint:types` fail at the value (TS2322) and the two roster cases
fail naming the label; restored, passes.

### provider-4, MAJOR (mechanism verified, frequency unknown): text and tool deltas fold into one answer

`src/anthropic-completion.ts:249-262` pushes both `text_delta` and `input_json_delta` fragments
into `fold.answerParts` with no block attribution.
`hyper-catalog.ts:180` runs `qwen3.8-max` with `toolChoice: 'auto'`, under which a leading text
block is legal; such a stream yields prose plus JSON, fails the schema, and loses the voice, and a
Hyper-only seat has no other stack for a second opinion.
No mixed-stream case exists in `anthropic-completion.unit.test.ts`.
How often the provider does this is unmeasured; a wire capture decides the size.
Tracked as `#242`.

FIXED 2026-08-26 in `3bc37b4f1`: text and tool fragments accumulate apart; the tool arguments are the answer
whenever there are any, prose is the answer only when no tool was called, and set-aside prose is logged by size.
Guard: a stream with a text block before the tool block yields the JSON alone; with the channels glued again the
case fails on the prose prefix (2 lines); restored, passes.
Frequency in the wild stays unmeasured, as the finding said; the reader is now correct whatever it is.

### provider-5, MAJOR, verified: stale-lock takeover is `rm` then `claim`, which two starters can interleave

`src/corpus-run/runs-lock.ts:353-375`: `await rm(path, { force: true })` then one `claim`.
The comment says "exactly one create succeeds", which holds only when both removes precede both claims;
B-rm, B-claim, C-rm (removes B's live lock), C-claim lets both passes proceed, and the dispose at
`:380-383` removes whichever file is present, so B's exit deletes C's lock.
Needs two starts against one stale lock, which a relauncher can produce.
No concurrent-takeover case in `runs-lock.unit.test.ts`.
Tracked as `#243`.

FIXED 2026-08-26 in `caee057fd`: the eviction is a rename to a name only that call knows, so exactly one of any
number of concurrent starters evicts (`evictStaleLock`), every acquisition carries a random token, and the release
removes the file only while it still carries that token (`releaseIfOwned`), saying so when it keeps one.
Guards: two concurrent evictions report `evicted` and `gone` (fails as `evicted`, `evicted` with a remove),
a release of a lock another holder took over keeps it (fails with the owner check removed),
and of two concurrent takeovers exactly one acquires and the other is refused with the winner's lock intact.

### provider-6, MAJOR by contract, verified: a marked class inherits a provider body excerpt

`src/request-size-refusal.ts:59` declares `messageNamesOnly: true` on `SyntheticRequestTooLargeError`,
and its `super({ status, bodyText, summary })` at `:103-117` ends `Gateway said:`, after which the
parent (`src/completion-shape.ts:82-89`) appends `bodyText.slice(0, BODY_EXCERPT_LIMIT)`.
The marker's contract (`stated-refusal.ts`, `refusal-text.ts`) excludes anything read from a provider body.
The observed gateway wording carries only a byte position, so nothing has leaked;
a gateway that echoes request bytes would print corpus text at the boundary.
Tracked as `#244`.

FIXED 2026-08-26 in `0fb6a8ad8`: `SyntheticHttpError` takes an excerpt policy, the marked subclass withholds the
gateway's words from its message and keeps them on `bodyExcerpt` for the log.
Guard: a gateway body echoing a sentinel leaves the message clean and the excerpt carrying it;
with the excerpt quoted again two cases fail; restored, passes.

### provider-7, MINOR, verified: a budget refusal during the re-ask is not caught

`src/provider-router.ts:590-604` calls `callOn` bare for the second opinion; a 429 or 402 there
becomes a throw instead of the first outcome, and `markRefused` starts that provider's cooldown one
call late.
Folded into `#240`.

FIXED 2026-08-26 in `2376b7d14`: the re-ask goes through `replyOrBudgetRefusal`, which reads a 429 or a 402
as the re-ask not happening: the first answer is returned and `markRefused` runs on the call the refusal arrived on.
`#240` closed the slot half of this site; this is the refusal half the entry named.
Guard: with the helper rethrowing, the case
`KEEPS the first answer and starts the other provider's cooldown when the re-ask is refused on budget` fails;
restored, passes.

### provider-8, note: the run log carries provider body excerpts and 80-character openings

`src/stage-call.ts:247` logs `String(error)` of a `SyntheticHttpError` (up to 600 body characters);
`src/stream-cut.ts:40` sets `OPENING_CHARS = 80`.
Both are recorded decisions (`#75`), and the log is treated as corpus-bearing; no change.

### provider-9, MINOR, verified: the catalog-drift instrument compares against a stale copy

`src/corpus-run/model-catalog-compare.ts:26-33`: `CATALOG_MODEL_IDS` still lists
`hf:zai-org/GLM-4.7-Flash` and omits every Hyper-only id, so the tool built to catch catalog
removals reports a departed model as expected.
Fix: derive from `Object.keys(SYNTHETIC_MODELS)` and delete the copy.

FIXED 2026-08-26 in `2376b7d14`: `CATALOG_MODEL_IDS` is `Object.keys(SYNTHETIC_MODELS)`; the Hyper-only ids are
absent on purpose, since the fetch compares Synthetic's own endpoint.
Guard: with the departed id appended to the derived list, the case `IS the compiled Synthetic catalog` fails;
restored, passes.

### provider-10, MINOR, verified: TSDoc describes a roster that no longer exists

`src/chat-contract.ts:174` (example uses the departed `hf:zai-org/GLM-4.7-Flash`),
`src/synthetic-catalog.ts:134` ("two of the six"),
`src/corpus-run/run-config.ts:111,152,173` (GLM-4.7-Flash as the third editor) and `:330-335`
("Exactly two models read images").
The `#235` diagnosis started from this prose.

FIXED 2026-08-26 in `2376b7d14`: the seat history in `RUN_MODELS`'s TSDoc opens with the current seating (ten seats
across two providers, the measured editors, refiners and checkers) and keeps each earlier rule in the past tense with
its date; the reader paragraph counts six readers of ten, measured as `readsImages: true` on 2 Synthetic and 4 Hyper
rows; the chat contract's example names `hf:zai-org/GLM-5.2`.
Prose only, no guard.
The "two of the six" the entry placed at `synthetic-catalog.ts:134` is not in that file (`rg` over the whole of `src`
finds the phrase nowhere), so nothing was changed there; the file's remaining mentions of the departed model are
dated history.

### provider-11, note: a shared meter read aborted by its first caller resolves wet for every sharer

`src/provider-budget.ts:318-322`, documented and pinned by `provider-budget.unit.test.ts:268`;
the 429/402 re-route corrects the one decision it can mislead. Accepted.

### provider-12, MINOR, verified: raw `console.log` in two library modules, and a handle outside `using`

`src/corpus-run/git-command.ts:54`, `src/corpus-run/runs-lock.ts:173,222,344,351` (`TLG`);
`runs-lock.ts:258-263` opens with `'wx'` and closes by hand, so a write failure leaves an empty
lock the next pass reports unreadable and takes over (`PP3`).

FIXED 2026-08-26 in `2376b7d14`: `runs-lock.ts` logs through `tagged({ tag: 'runs-lock' })`, warn for a lock held
by another process, an unreadable file and a lock no longer this acquisition's, info for the two takeovers;
`git-command.ts` logs its fallback through `tagged({ tag: 'git-command' })`; and `claim` holds its `wx` handle in
`await using`, so a write that fails still closes it, the empty file such a failure leaves being what the next pass
reads as unreadable and evicts.
The sink suite `sink-names-only.unit.test.ts` reads the unreadable-lock line and caught the move: the whole-suite
run after `2376b7d14` failed its LOCK case (782 PASS, 2 FAIL, exit 1), and `c7f2a5075` makes the suite's collector
capture the logger's console methods and drops the `LOCK ` prefix from the expectation.
An earlier draft of this paragraph said no test read those lines; the search behind it was anchored on the old
prefix with a leading quote and missed the case. The disposal itself has no guard.

### provider-13, MINOR, verified: a malformed round line parses to `NaN` silently

`src/corpus-run/run-timing-parse.ts:297-298`: `heard: Number(counts[0])` with no check that the
ratio split into two integers; only the duration fields refuse.

FIXED 2026-08-26 in `2376b7d14`: `countIn` refuses an empty or non-digit field and the ratio must split into exactly
two fields; both throw inside the existing `round line unreadable` wrapper.
Guard: with `Number` restored and the two-field check removed, the case
`THROWS ON A RATIO THAT IS NOT TWO WHOLE NUMBERS` fails; restored, passes.

### provider-14, MINOR, verified: each of provider-1 to provider-5 lacks the test that would have caught it

No re-ask landing on Synthetic, no mixed text-then-tool stream, no roster-subset assertion,
no bare-client refusal of a non-`hf:` id, no `RunConfigError` marker check at the boundary,
no concurrent stale-lock takeover. Each fix carries its guard, committed first per `GFP`.

CLOSED 2026-08-26 by the MAJOR landings, each recorded under its own entry with its guard: the re-ask landing on
Synthetic (`#240`, provider-2), the mixed text-then-tool stream (`#242`, provider-4), the roster-subset proof
(`#241`, provider-3), the bare client's refusal of a non-`hf:` id and the `RunConfigError` marker at the boundary
(`#235`, A-1 and provider-1), and the concurrent stale-lock takeover (`#243`, provider-5).
Nothing further to land.

### repair-1, MAJOR, verified: a slice settled while a whole stage heard nobody is cached as a decision

`src/repair-translation.ts:453-470`: the only gate on the write is `outcome.heardCritics === 0`.
The quorum gather never throws on shortfall (`src/stage-quorum.ts:369-377` returns
`stage-quorum-unmet (...)` as a finding), and every silent stage downstream lands on an ordinary
"unchanged" exit: a silent panel makes every claim `needs-human` (`src/tally-votes.ts:76`, electorate
below `minBallotWeight`), so `src/repair-chunk.ts:274` returns "nothing to edit, unchanged";
a silent editor returns `src/repair-editor-stage.ts:251` "no operation survived the gate";
a silent checker leaves every tally unresolved and `src/select-candidate.ts:193` ranks the unchanged
candidate first on the tie.
All three carry `heardCritics > 0`, so all three are persisted and memoised.
`src/refine-phase.ts:336` persists unconditionally, so `refine-candidates (0/N heard)` and a
rollback produced by a silent recheck are stored too.
Consequence: a provider outage lasting one slice (the `#199` week of 429s, or the `#235` shape where
every seat of one role sits on a dark provider) is frozen into the cache as "examined and found
nothing to change"; every later run resumes it, reports success, and never re-asks.
The findings travel with the record, so the artifact says `stage-quorum-unmet` while the text ships settled.
Retroactive: caches written during the `#199` outage may already hold such records.
Tracked as `#238`.

FIXED 2026-08-26 in `1a96979ad`, together with slices-1.
The finding has one spelling, built and read through `stage-silence.ts`;
the repair driver refuses to cache a settlement carrying it through `cacheRefusalsOf`, which names its reasons,
the refine driver does the same, both cache guards refuse to resume such a record,
and the namespace loader now says which record it refused instead of dropping it silently.
Guard: a persisted slice carrying `stage-quorum-unmet (critic 0/6)` is not resumed while its neighbour is;
shown to fail with the guard's finding check removed (2 failing lines), restored, passed.
Retroactive scan: this worktree's default runs directory holds 150 slice-cache files and none carries the finding;
the main worktree has no runs directory, so nothing needed purging.
Not guarded: the two persist-side refusals in the drivers have no driver-level test,
because the scripted client in the driver suites cannot make one stage fall short of quorum;
the existing no-critic refusal beside them has none either (repair-9), and both are listed there.

### repair-2, MINOR (downgraded from the reviewer's MAJOR): the refine loop lacks the accuracy loop's abort check

`src/refine-phase.ts` has no `signal.throwIfAborted()` before its persist at `:336`;
`src/repair-translation.ts:437` checks before its write.
The reviewer's mechanism, that an abort settles every remaining slice as silence, does not hold:
`src/stage-round.ts:103-108` rethrows a caught error when the signal is aborted, `src/stage-call.ts:244-246`
does the same, and `src/stream-drain.ts:353-358` throws `StreamCutShortError` under a caller abort
rather than returning partial text, so an aborted call propagates as a throw and nothing after it is
persisted.
The symmetric check is still owed as a guard against a future path that turns an abort into a non-ok
outcome, and `refine-phase.unit.test.ts` has no abort case.
Folded into `#238`.

FIXED 2026-08-26 in `d7c707cc3`: `refine-phase.ts` calls `signal.throwIfAborted()` before its persist, the check
`repair-translation.ts` makes before its own write, and `refine-phase.unit.test.ts` has an abort case: a client that
aborts the run from inside its first exchange and still answers leaves the cache empty and the phase rejected.
GFP, reported as measured: with the new line removed the abort case STILL PASSES, because the stage machinery already
throws on an aborted signal before the phase reaches its write, exactly as the entry's mechanism paragraph says.
The line is the symmetric guard the entry asked for against a future path that settles an aborted call; the case
pins the behaviour, not the line, and this paragraph says so rather than claiming a guard it cannot show failing.

### repair-3, MAJOR, verified: envelopes adopted without a vote lose their authors

`src/editor-ensemble.ts:232-243`: the sole-proposal path pushes the winner and its contributors but
no round (`rounds.push` happens only on the judged path at `:282`).
`src/issue-authors.ts:311-318` builds a composite's `perIssue` from `envelopeAuthorsFromRounds({ rounds })`,
and `:227` reads `byEnvelope[envelopeId] ?? []`, so every issue served by a sole-adopted envelope has no author.
Under `checkerSelfCertificationPermitted: true` (the live setting) a checker that wrote that text votes
on it at full weight and the artifact's `wroteTheText` is false for it.
Bounded today because the checker and editor rosters do not overlap (`#187`); the record is wrong now
and the weighting becomes wrong on the first overlapping roster.
`issue-authors.unit.test.ts` has no composite built from a sole envelope.
Tracked as `#239`.

FIXED 2026-08-26 in `7103ae59c`: a sole adoption is a round of its own kind, `adopted`, carrying the one slate
entry, its index, a reason, and empty vote fields so every reader of a round keeps its shape;
`issue-authors` treats it like a selected round and the artifact rounds reader parses it.
Guards: the authors case fails with the kind check reverted (2 lines), the selection case fails with the push
removed (2 lines); both restored and passing.

### repair-4, MINOR, verified: an outcome with no prepared slice is refined against an empty original

`src/refine-phase.ts:219` (`prepared?.source.text ?? ''`) and `:236` (`?? outcome.repairedText`);
`src/repair-refine-step.ts:150-157` throws for that state after the phase, so the tolerance buys
model calls before a refusal that comes anyway. Unreachable through `repairPreparedDocument` today.

FIXED 2026-08-26 in `d7c707cc3`: the phase refuses an outcome naming a slice the preparation never produced before
any call, as `UnpreparedSliceError` (`unprepared-slice.ts`, marked, one slice index in its message), and
`repair-refine-step.ts` throws the same class for the same fault instead of a bare `Error`; the `??` fallbacks are gone.
Guard: with the refusal removed, the case
`REFUSES an outcome naming a slice the preparation never produced before buying any call` fails; restored, passes.

### repair-5, MINOR, verified: six prompts fence document text with a fixed `=====`

`src/edit-prompt.ts:18`, `src/critic-prompt.ts:18`, `src/adjudicate-prompt.ts:17`,
`src/resolution-wire.ts:21`, `src/restoration-judge-wire.ts:23`, `src/derivability-wire.ts:22`,
against `src/refine-prompt.ts`, whose note calls the fixed value forgeable (a setext underline) and
picks its fence against the content with `selectFence`.
A page carrying a `=====` line closes the instruction block early; every gated stage bounds the damage.

### repair-6, MINOR, verified: two unmarked classes whose messages hold positions only

`src/repair-unheard.ts` (`RepairUnheardError`) and `src/placement-layout.ts` (`PlacementLayoutError`)
carry no `messageNamesOnly` and quote nothing, so the slice they name is muted at the boundary.
`repair-unheard.ts:160` spells `archive\`s` with a backtick for an apostrophe.

### repair-7, MINOR, verified: a stale comment names an exit that no longer exists

`src/repair-translation.ts:536`: "A blocked document already returned above" against the module
note at `:47-56` ("NOTHING BLOCKS THE DOCUMENT ANY MORE").

FIXED 2026-08-26 in `d7c707cc3`: the comment says nothing blocks a document any more and points at the module note.
Prose only.

### repair-8, MINOR, verified: typography restoration runs after the structural gate

`src/apply-patch.ts:346` applies `restoreTypography` to `newText` after every check, while
`src/refine-stage.ts:255` gated the raw `operation.newText`, so a protected atom holding a straight
quote between word characters can be altered by text no gate saw. Low frequency.

### repair-9, MINOR, verified: the guards the three MAJORs need do not exist

No abort case in `refine-phase.unit.test.ts`; the only silence-and-cache case in
`repair-translation.unit.test.ts` is the critic one; no sole-envelope composite in
`issue-authors.unit.test.ts`; `repair-not-applicable`, `assertUnheardKeptArchive`, `heardNobodyAbout`,
`settleChunkFromChecks`, `collectEnvelopeProposals` are named by 0 test files;
`src/refine-slice-settle.ts:149` types the refiner roster as `RepairModels['checkerModelIds']`.

FIXED IN PART 2026-08-26 in `d7c707cc3`: the abort case (repair-2), the refiner roster typed as
`readonly RosterModelId[]` rather than as the checker seats (the borrowed type was the only non-optional one),
and suites for `repair-not-applicable` (the anchor never counts toward the non-translation block; every count zero;
the finding's wording), `repair-unheard` (`heardNobodyAbout` on all three inputs; `assertUnheardKeptArchive` refuses
a foreign wording and a claimed change, accepts the archive wording, asks nothing of a slice somebody spoke about)
and `editor-proposals` (a duplicate merges its writer into the first proposal; distinct texts stay apart in roster
order; a silent model contributes nothing).
The sole-envelope composite landed with `#239` and the silence-and-cache cases with `#238`.
Guards: the claimed-change refusal removed fails `REFUSES a silent slice that claims a change`; the merge disabled
fails `MERGES a duplicate proposal into the first one`; the anchor counted as standing fails
`REFUSES to count an anchor toward the non-translation block`; each restored, passes.
Still owed: a suite naming `settleChunkFromChecks`, which lands with the rest of this group.

### translate-1, MAJOR, verified: pairing agreement is filtered from the first usable voice's reply only

`src/pair-blocks-stage.ts:330-333` and `src/pair-sections-stage.ts:368-372`:
`const agreed = (pairings[0] ?? []).filter(votes >= AGREEMENT_NEEDED)` with `AGREEMENT_NEEDED = 2`.
Votes are tallied over every usable reply, but candidates come only from the first, so a
correspondence two other voices named is dropped whenever the first voice omitted it, and which pairs
survive depends on which seat answered usably first.
Both files' module notes say "AGREEMENT IS PER PAIR rather than per reply", which the code contradicts.
Pairing is the input every later stage reasons from: a dropped block pair leaves its original
`source-only` (the `#157` shape returns), a dropped section pair sends a translated section through as absent (`#159`).
Both suites seat only two voices, a shape that cannot show it.
Tracked as `#245`.

FIXED 2026-08-26 in `4eaa89ede`: agreement is per pair through `agreePairs` (`pair-agreement.ts`), shared by both
stages: every distinct pair across every usable voice is counted, a contested source keeps its better-voted target
or is dropped with a finding on a tie, and the result stays strictly increasing on both sides with a finding for an
agreed pair that would run backwards.
Guards: six helper cases plus a three-voice case per stage; the blocks stage reverted to the first reply's pairs
fails its three-voice case, the tie rule removed fails the contested case; restored, both pass.

### translate-2, MAJOR, verified: ledger file names restart at zero per process and overwrite on relaunch

`src/candidate-ledger.ts:78` (`const state = { recorded: 0 }`), `:208-209` (ordinal from that counter),
`:252-255` (`writeFile` to `${padded}.json`).
Relaunching into the same runs directory is the documented resume path, and `ledger-report.ts`
reads the whole directory with no way to tell an overwritten file from an original, so the `#212`
evidence (producer standings, self-preference counts) is silently lost for every relaunched pass.
Tracked as `#246`.

FIXED 2026-08-26 in `b00f9d3b2`: every ledger file is named by a per-process launch stamp (file-safe ISO time plus
process id) and then the ordinal, so names never collide across launches and still sort as text into contest order.
Guard: the same ordinal under two launches names two files and names sort by launch then ordinal;
with the launch dropped from the name two cases fail; restored, passes.
The reader-side check slices-2 proposed is not added: with unique names the collision cannot recur,
and files written before this fix already collided in a way no reader can undo.

### translate-3, MINOR, verified: `sentinel-probe` prints any error's message to stdout

`src/corpus-run/sentinel-probe.ts:166-173`, the same shape as calibrate-2. Folded into `#237`.

### translate-4, MINOR, verified: a stage note says a guard is missing that `translate-slice.ts` now runs

`src/translate-stage.ts:31-33` against `src/translate-slice.ts` (`findDroppedDeclaredNames`, two sites).

### translate-5, MINOR, verified: the translate slice cache is at version 6 with a history ending at 5

`src/translate-document-contract.ts:57` against the paragraphs at `:31-50`;
nobody can tell what the bump to 6 discarded or why.

### translate-6, MINOR, verified: twenty-one files in the slice have no sibling unit test

Named in the reviewer's report (`~/temp/agent/audit-translate.md`); the branches that deserve a
direct case are `translate-retry.ts:200-228`, `translate-slice-attempt.ts:182-183`, the shipped and
withdrawn index sets in `translate-assemble.ts`, every `blankAgainst` branch in `translate-absence.ts`,
and the three-voice pairing case translate-1 needs.

### probes-1, BLOCKER, verified: the sensitivity instrument labels an arm `prior=shown` that shows nothing

`src/corpus-run/probe-sensitivity.ts:92-103` calls `runIntroducedDefectProbe` with `issues` and no
`disclosure`; the probe's default is `'withheld'` (`src/introduced-defect-probe.ts:155`), and the sheet
renders the "PRE-EXISTING DEFECTS THIS EDIT TARGETED" block only under `disclosure === 'rendered'`
(`src/introduced-defect-wire.ts:438`), whose own default is `'rendered'` (`:365`).
So the `condition: 'shown'` arm (`:172`) and the `'absent'` arm (`:168`) send byte-identical prompts
and differ only in what the deterministic screen dismisses, while the closing NOTE (`:243-247`)
tells the reader a stage that "goes quiet with prior=shown is one the production prompt silences".
Production withholds explicitly (`src/repair-chunk.ts:389`), so the counts describe production;
the labels, the comments, and the NOTE do not, and the instrument cannot detect a regression in the
rendered prompt at all.
No recorded decision rests on a post-flip run; any rerun would mislead.
Tracked as `#247`.

FIXED 2026-08-26 in `bf7d6afbd`.
Production's disclosure is one exported constant (`PRODUCTION_PRIOR_ISSUE_DISCLOSURE`) read by both stages
and both instruments; the sensitivity arms are a data table (`probe-sensitivity-arms.ts`) whose unit test
holds every arm's printed list to the disclosure it sends; each accuracy region runs under `none`,
`withheld`, and `rendered`, so none-against-withheld isolates the screen and withheld-against-rendered the prompt.
Guard shown to fail with the rendered arm sending `withheld` (2 failing lines), restored, passed.
Live run of the instrument, 2026-08-26, exit 0: eighteen `SENSITIVITY` lines each carrying `list=` and `issue=`,
three checker seats asked eighteen times and usable eighteen of eighteen, no dark seat.
It measured what the old arms could not: on `deletion/mislabelled`, `list=withheld` raises `removal=3`
while `list=rendered` raises `removal=1` with two probers filing the real deletion as `preExisting`,
so the rendered prompt lets a false accepted issue talk two of three probers out of seeing real damage;
`list=none` against `list=withheld` moves nothing on any region, so the screen dismisses no real claim here.

### probes-2, MAJOR, verified: the relabel instrument's "shown" arm shows nothing either

`src/corpus-run/probe-relabel.ts:78-88` passes no `disclosure`, and `:150` labels the arm
"Production condition: the issue list is shown". Same mechanism; folded into `#247`.

FIXED 2026-08-26 in `bf7d6afbd`: three arms per region (the production disclosure, the other prompt, no list),
each labelled from the constant it sends. Its live run waits on `#257`, since it reads the round-three draw.

### probes-3, MAJOR, verified: the damage sheet tells the grader every item was flagged

`src/corpus-run/probe-verify-sheet.ts:303-304` prints, unconditionally, that "an automated reviewer
claims each one introduced a defect", while `src/corpus-run/damage-sample.ts:333-357` builds the
sheet from `probe-flagged` AND `probe-silent` items with every claim stripped.
`score-verify.ts` reads a Y on a silent item as damage the probe missed, so the preamble primes the
grader toward Y on exactly the partition scored as probe misses.
The 20-item damage sheet of 2026-08-17 is still ungraded, so this can still be fixed before it costs a grade.
Tracked as `#248`.

FIXED 2026-08-26 in `b88d6a947`: `formatVerifySheet` takes a framing; the verify sheet keeps its wording and the
damage sample writes the blind one, which says the reviewer flagged some items and stayed silent on others without
saying which. Guard: the blind sheet never says "claims each one"; with the framings collapsed the case fails.
The two ungraded damage sheets on disk (`damage-sheet.md`, `damage-sheet-agent-read.md` in this worktree's runs
directory) had their preamble replaced in place with the blind wording, items untouched, so grading them now is safe.

### probes-4, MAJOR, verified: two probes carve with the deterministic pairer the pass no longer uses

`src/corpus-run/judge-fidelity-probe.ts:384` and `src/corpus-run/displacement-probe.ts:198` call the
bare `prepareDocumentPair` under a comment reading "Slices exactly as the lanes would see them",
while the pass carves through `prepareDocumentPairWithRoster` (`src/corpus-run/pass-entry.ts:267`),
whose LLM-assisted pairing took one entry from zero slices to nine (`#189`) and whose deterministic
fallback slid whole documents (`#71`).
Fidelity trials therefore run on pairs the lanes never see, and the displacement census counts the
deterministic aligner's slides as translation displacement.
Tracked as `#249`.

FIXED 2026-08-26 in `26f346de8`, `d2c580995` and `459482191`.
The artifact now records the other half of its pairing recipe (`preparation.sectionPairing`, always written as
`deterministic` or `supplied` with the pairs, read as `unrecorded` on older files), `rebuildPreparation` and
`recipeOf` turn both halves back into the inputs `prepareDocumentPair` consumed, and `settled-carve.ts` lists a
runs directory's settled entries and carves each over the pair at the artifact's own commit.
Both probes walk that population and log `carved from its settled artifact (complete recipe)` or the halves the
deterministic default stood in for; an entry with no two-lane artifact is skipped by name of its kind.
Guards: the rebuild reproduces a crossed section pairing and a declined block, proved by the identity hash with the
bare carve as positive control; removing either recipe half from the carve or the reader's generation check fails
2 to 3 cases each.
Measured at the boundary: this worktree's runs directory holds 56 legacy artifacts and both probes carve none;
`TRANSLATION_REPAIR_RUNS_DIR` pointed at the 2026-08-17 runs directory carves 6 of 6 two-lane artifacts, every one
with both halves defaulted since they predate the recorded pairing, and one capped fidelity trial ran over them
with all ten seats usable.

### probes-5, MAJOR, verified: the recall scorecard is overwritten in place, non-atomically

`src/corpus-run/recall-benchmark.ts:332-335`: plain `writeFile` to the fixed name `recall-scorecard.json`.
`src/corpus-run/probe-store.ts` states the repo's own rule for repeated measurements (stamped names,
atomic writes); a twelve-hour run replaces the previous one with no trace.
Tracked as `#250`.

FIXED 2026-08-26 in `2c9886a55`: `persistRecallScorecard` (`src/corpus-run/recall-scorecard-store.ts`) writes
`recall-scorecard/<start stamp>-<tip>.json` through `writeFileAtomic`, the benchmark stamps its start and records
`startedAt` and `finishedAt`, and the `SCORECARD kept at <path>` line names the file.
Guards: two runs keep both files with their own rows, two builds started in the same instant keep two files, the
name carries no colon; collapsing the name to the old fixed one or dropping the tip fails all 4 cases.
Plan mode (`-- --plan`) still constructs the client and writes nothing.
The old `recall-scorecard.json` files on disk are left where they are; nothing reads them programmatically.

### probes-6 to probes-13, MINOR, verified where cited

The derivability sheet's fixed `=====` fence (`src/derivability-wire.ts:22`; zero collisions in the
pinned corpus, measured by the reviewer with `git grep --count`); stale six-model roster prose in
`src/corpus-run/judge-independence.ts:7-11` and the NOTE pasted into verdicts by
`src/corpus-run/score-crosscheck.ts:363-366`; per-region tallies counting checks rather than probers
(`src/introduced-defect-screen.ts:504-513`); damage sheet and manifest written with plain
`writeFile` to fixed names (`damage-sample.ts:347-365`, `probe-verify.ts:210-219`); the relabel
control stamping `baseIndex: index` (`probe-relabel-control.ts:234`); `coverage-probe` and
`judge-fidelity-probe` printing rows that carry corpus-derived text to stdout by design
(`coverage-probe.ts:463-467`, `judge-fidelity-probe.ts:501`); caught error text persisted into bench
rows (`bench-record.ts:289-290`, `benchmark.ts:415-424`); `writeBenchReport` named by no test.
Full text in `~/temp/agent/audit-probes.md`.

### consolidate-1, MAJOR, verified: a slice with no standing text buys a producer round it then discards

`src/consolidate-driver.ts:333-338` computes `standingText`, which `standingTextFor`
(`src/consolidate-standing.ts:40-44`) answers as `''` for a `settled-neither` or `quorum-not-met`
contest; `settleFresh` then builds the producer input (`:378-405`) and calls `produceConsolidations`
unconditionally, and `settleConsolidation`'s first exit (`src/consolidate-settle.ts:407-412`) refuses
with `no-standing-text` before judging anything.
One roster of producer calls plus up to one roster of repair calls per deadlocked slice, with no
possible effect on output; on a night the contest loses quorum, every contested slice pays it.
Whether such a slice should instead be judged against both lane renderings is a design question the
reviewer raised separately; the spend is a defect regardless.
Tracked as `#251`.

FIXED 2026-08-26 in `a8bc69508`: `settleFresh` in `src/consolidate-driver.ts` hands the settle half an empty slate
when the standing text is empty and asks no producer, so the `no-standing-text` terminal, its floor and its
findings still come from `settleConsolidation` and the settlement still resumes.
Guard: a `settled-neither` and a `quorum-not-met` contest each settle to `no-standing-text` under the driver
test's refusing client, which throws on any call; restoring the purchase fails 2 cases with that throw.
The design question (judge such a slice against both lane renderings instead) stays open and is not decided here.

### consolidate-2 to consolidate-10, MINOR, verified where cited

Bare `Error` for operator refusals in `src/grade-agreement.ts:170-184,266-269`; the agreement guard
checks count but not index presence (`:238-268`); sheet items indexed by position, not by printed
number (`src/grade-sheet-read.ts:252-265`); the scorecard prints 0 for an empty denominator
(`src/scorecard.ts:397-399,447-452`); an internal invariant thrown as bare `Error`
(`src/consolidate-driver.ts:322-326`); `describeAbandon` falling back to `String(error)` into a warn
line (`src/abandon-kind.ts:76-77`); four prose drifts; `consolidate-produce.ts` and `tally-claim.ts`
reached only through callers; a gate ballot lost whole when one list field is not an array
(`src/consolidate-gate-wire.ts:132-146`).
The reviewer also answered calibrate's open question: `candidate-select.ts:159` sets `judges` to the
SEATED roster, so a half-dark panel is correctly excluded by the window trial's full-panel filter.
Open question it raised for the main session: the consolidation gate's bar is absolute
(`CONSOLIDATE_GATE_QUORUM = 2`, `HEARD_NEEDED = 2`), so two of ten ballots against one can replace a
memorial page's wording and be cached as settled; whether that bar is intended is recorded here, undecided.

### document-1, MAJOR, verified: any corpus read failure silently drops the entry from a pass

`src/corpus-run/corpus-pass.ts:392-396` continues past any `CorpusReadError`,
and `src/corpus-source.ts:239-243` wraps every `execFile` rejection as one, with no kind field:
a non-zero git exit, a spawn failure, and a `maxBuffer` overflow all read as the expected missing side.
No line is written on either side, so the entry is absent from `pending=` and nothing says why;
a resumed pass then ranks bands over a shrunken `settled`.
No corpus-pass test references `CorpusReadError`.
Tracked as `#252`.

FIXED 2026-08-26 in `8af2b2bde`: `CorpusReadError.kind` is read off git's stderr, measured against git 2.55
(a path absent at the commit says `does not exist in` and is `missing-object`; an unreadable clone, a spawn failure,
an oversized blob or a failed listing is `other`), `isMissingCorpusObject` is the one guard a corpus walk may step
past, and all five catchers use it (the pass, the recall benchmark, the picture gatherer, the window trial probe,
the slice census).
The pass's walk lives in `src/corpus-run/pass-eligibility.ts`, names each incomplete entry by id and absent side,
and the pass prints one `INCOMPLETE <id>: <side> page absent at the pin (...)` line per entry.
Guards: the corpus-source tests assert the kind on a missing path, a missing clone and a failed listing; the
eligibility tests sort a throwaway clone into a pair, a settled size and a named gap, name a missing original as
the source side, and propagate an unreadable clone.
Collapsing the classifier fails 2 and 3 cases; re-widening the walk's catch fails 2.

### document-2, MAJOR, verified: a transient reader failure is cached as a permanent `unavailable` verdict

`src/document-readings.ts:166-183` persists every paired reading whatever its kind;
`src/image-reading-pair.ts:380-388` records a reader that threw as `reader-failed` and counts it absent,
and `:432-440` turns fewer than two readings into an `unavailable` pair verdict.
On resume `:150-158` serves that verdict from the cache with only `resumed, unavailable` in the log,
until the generation marker retires the cache on a rebuild, never on the provider's recovery.
That is provider trouble degrading the pipeline durably, which the owner's standing rule forbids.
Tracked as `#253`.

FIXED 2026-08-26 in `17bcaf46c`: an `unavailable` pair verdict carries `transient`, true when any reader produced
nothing for a reason that may not hold tomorrow (`reader-failed`, `empty-reply`, `too-short`, `reads-as-refusal`),
false for a disagreement or a roster that cannot read the picture; `readDocumentPictures` persists only resumable
verdicts (`isResumableReading`), and `openPictureReadingCache` refuses a transient record and any record written
before the field, so the one reader failure that left a picture unread is read once more.
Guards: a throwing reader marks the verdict transient and unresumable, a disagreement stays stable, the document
reader persists nothing under a failing client and one record under a disagreeing one, and the cache refuses the
transient and the older-shape records.
Flattening the mark fails 3 and 2 cases, dropping the persist guard fails 2, re-admitting transient records fails 3.

### document-3, MAJOR, verified: a CRLF original silently disables the line-structure family

`src/line-structure.ts:57-66` splits blocks on `\n\n`, which a CRLF document never contains,
so every slice counts as one block, fails `MIN_BLOCKS`, and `isLineStructured` answers false:
no editor addendum, no inheritance, no line-count guard.
`src/markdown-blocks.ts:11-16` already measured the population:
one of 184 files at the pin, `people/gqt/page.md`, the source side, which is the side the predicate reads.
`src/mask-invisible-lines.ts:260` splits on `\n` alone,
so an invisible line on that page keeps its `\r` and is never masked;
`src/quote-normalize.ts:205-212` treats `\r\n` as two breaks,
so every wrapped critic quote there is refused (document-4).
Tracked as `#254`.

FIXED 2026-08-26 in `7a2a21ed8`: `readCorpusFile` folds every CRLF to LF through `foldCarriageReturns`
(`src/line-endings.ts`, which counts what it folded), `isLineStructured` folds again for callers that read text by
other means, and the invisible-line mask judges each line without its carriage return and blanks around it, keeping
the return and the length.
Measured on the page at the pin: 141 endings folded, 1 block before the fold and 45 after; the page is prose, so the
predicate answers false for the right reason now, and it carries no invisible-only line.
Document-4 no longer meets corpus text, since the quote normalizer sees LF; its two-break reading of a literal CRLF
stands for text read by other means and is recorded here rather than changed, because a length-preserving
normalizer cannot collapse a two-unit ending to one space without an offset map.
Guards: the fold counts and shrinks by exactly the count and leaves LF and a lone return alone; a CRLF page reads
back LF; CRLF verse is line-structured; a CRLF invisible line is blanked with its return kept and the region
covering the mark alone. Undoing the read fold, the splitter fold, or the mask's body judgement fails 2 cases each.

### document-5 to document-12, MINOR, verified where cited

The unread-signals doc describes a `mirrored` flag and a proportional fallback that `chunk-document.ts:425-444`
no longer has (`equalShape` now, and the fallback is deleted);
`entry-filter.ts:58,79` throws operator mistakes as bare `Error`;
`image-reading-past-refusal.ts:76` justifies `REFUSAL_ASK_LIMIT` with the projection its own module note refutes;
`locate-quote.ts:151,171,253` writes up to 60 characters of a critic's quote into a `quote-not-found` finding
(corpus text in logs, no decision recorded);
`readingAnchors`, `sharedAnchorCount`, and `quotedTranscript` have no production caller;
per-character accumulator rebuilds in `footnote-graph.ts:106,190`, `image-reading-sense.ts:180,187`,
`reading-refusal.ts:156`, and `protected-atom.ts:259-273` (`RG2`, linear in practice);
bare `Error` for the footnote overflow refusal and several unreachable states, one defaulted with `?? ''`;
`image-ocr.ts:261,275` discards both decoder errors with `void error` (`LG2`),
and `MIN_OCR_CHARS` is a literal copy of `MIN_READING_CHARS`.

### slices-1, MAJOR, verified: the slice-cache store cannot refuse a silence-settled record

Folded into `#238` as its store side:
`src/corpus-run/slice-cache-store.ts:48-66` and `:423-427` are shape-only guards ending in `Array.isArray(...)`,
no guard reads `heardCriticIds.length` or a `stage-quorum-unmet` finding,
and the artifact reviewer confirmed the owned artifact shape carries no per-stage heard count either,
so the slice caches are the only place that decision lives.
Contrast `lane-contest-driver.ts:56-60`, whose `worthResuming` persists only quorum-met outcomes.

### slices-2, MAJOR, verified: the contest-ledger readers are blind to the ordinal collision

Folded into `#246` as its reader side:
`ledger-directory.ts:177-185` sorts by file name and asserts that is contest order,
`ledger-read.ts:365` reports the file count as the contest count,
and `ledger-parse.ts:494-498` reads the `at` stamp that no reader compares.

### slices-3, MAJOR, verified at the call shape: the slice census carves with the abandoned pairer

Folded into `#249`:
`slice-census-entry.ts:159-162` aligns with `alignDocumentSections` and `:225-232` subdivides with no `blockPairing`,
so the `CENSUS` lines size a translate lane over slices the pass no longer produces.

FIXED 2026-08-26 in `459482191`: `censusEntry` takes the settled recipe, feeds the section pairing to alignment and
each section's block pairing to subdivision, and labels every row `settled-complete`, `settled-partial` or
`deterministic`; the driver reads each entry's recipe from the runs directory and opens with a `CENSUS carve:` line
naming how many rows are which, legacy artifacts counted apart.
Guards: a recipe that unpairs the middle section moves the unpaired counts, and one that declines the middle block
shrinks the sliced translation characters; dropping either spread fails 2 cases.
Measured: 92 complete pairs, 6 settled-partial rows against the 2026-08-17 runs directory and 86 baseline.

### slices-4 to slices-9, MINOR, verified where cited

Raw `console.log` in `slice-cache-namespace.ts:553-556`;
the proportional merge loop at `slice-pair.ts:360-471` is unreachable while its TSDoc calls it the live fallback;
nine index-and-count error classes across the delivery, coverage, comparison, and assembly modules lack
`messageNamesOnly`, so the boundary prints only their names;
the repetition containment rule (`assembly-repetition.ts:420-422`, `assembly-adjacent-repetition.ts:289-294`)
compares space-joined strings with `includes`, so a phrase inside a longer span across word boundaries is dropped;
`SpanAnchor` names two declarations and the explicit `index.ts:37` export shadows the rendering-audit one;
`draw-entry-load.ts:162-189` throws its three reconcile refusals as bare `Error`, muting the counts they carry.

### artifact-1 and artifact-2, MAJOR, verified: both comparison checks embed whole rows in their messages

Folded into `#237`:
`artifact-two-lane-read-comparison.ts:150-154` puts `JSON.stringify(row)` (archive English and both lanes' text)
into an `ArtifactParseError`, a class marked `messageNamesOnly` at `artifact-guard.ts:26`,
so `refusalText` forwards the row verbatim at every CLI that reads a settled artifact;
`artifact-two-lane-comparison.ts:330-335` puts both rows into the unmarked `ArtifactComparisonError`,
which the pass's TALLY and CLEANUP lines print 200 characters of.
The trigger is a stored row disagreeing with the frozen rules, which is exactly what the guards exist to catch.

FIXED 2026-08-26 in `c19d203c6`: both checks name the differing fields through `comparisonRowDifferences`
(`comparisonRowsEqual` derives from it) and never a row; the read test asserts the message names `laneRelation`
and carries no `"repairText"`; guard fails with `laneRelation` dropped from the checks (2 failing lines per suite).

### artifact-7, MAJOR, verified structurally: the round-three instruments cannot read their own draw

`probe-relabel-artifact.ts:362-383` reads through `repairLaneRecordsOf` (`artifact-repair-lane-records.ts:83-121`),
which calls `parseSettledTwoLaneArtifact` directly and refuses any artifact without a numeric schema version;
the reviewer measured, with structural output only, that all 17 round-three entries are unversioned legacy
artifacts that `readSettledArtifact` reads as `kind: 'legacy'`.
Loud, not silent: exit 5 at the first item.
Tracked as `#257`, to be decided with `#247` and `#249`.

FIXED 2026-08-26 in `f199b70cf` and `bab444350`:
`readArtifactRecords` dispatches on the generation through `readSettledArtifact`,
the lane for version 2 and the root for the legacy and version 1 generations, with two cases pinning the legacy path.
`f199b70cf`'s message claimed both cases passed; one was failing at commit time
(the legacy parser requires `repairDisposition` and `refined` once a record carries regions,
and the fixture lacked them),
which `bab444350` fixed and says so.
Guard shown to fail with the dispatch forced to the lane (both legacy cases refuse at `artifactSchemaVersion`),
restored, passed.
Live run of `probe-relabel` against the round-three draw, 2026-08-26, exit 0:
`RELABEL rebuilt 5 distinct damaged regions`, `gathered 10 unflagged control regions`,
fifteen regions each under `issues-withheld`, `issues-rendered`, and `issues-absent`, none under the old label,
three checker seats asked 45 and usable 45, no dark seat.
Summed over the fifteen regions the arms raised `removal` 1 (withheld), 3 (rendered), 1 (absent)
and `corroborated` 0 each;
on real regions carrying six to seventeen prior issues the rendered prompt raised more, not fewer, removal claims,
the opposite of the cat fixture's direction, which is a fact for `#68`'s successor to read, not a verdict.

### artifact-3 to artifact-6, MINOR, verified where cited

`artifact-two-lane-project.ts:68-70` stringifies a `never` member carrying text fields
(unreachable while the unions stay exhaustive);
the consolidation reader (`artifact-two-lane-read-consolidate.ts:368-375`) refuses only a duplicate index,
never a missing or extra slice, unlike the contest and index-set readers;
`artifact-placement.ts:243-247,288-291` echo a malformed `id` or digest whole to stdout;
`resolveCommit`, `tipContains` (shallow-clone and unknown-commit throws), `keepEligible`, `parseRegionTally`,
and the three placement stdout lines have no test.
The reviewer also answered `#238`'s question:
the owned artifact shape carries no per-stage heard or configured count and no `stage-quorum-unmet` marker;
those strings travel only inside the tolerant raw lane result.

### rendering-1, MAJOR, verified: the provenance verdict is wrong on every roster-paired artifact

`rendering-audit-settled-input.ts:288` re-prepares with `prepareDocumentPair({ sourceText, targetText })`,
no `blockPairings` and no `sectionPairing`, while production carves through `prepareDocumentPairWithRoster`;
the identity check hashes every slice's placement and refuses on any difference,
so every artifact whose roster pairing moved a slice reads `verification=refused`.
The audited text is taken from the artifact itself, so every measurement column is right;
only the guard is void, in the one case it exists for.
Tracked as `#255`.

FIXED 2026-08-26 in `d2c580995` (on the recorded section pairing from `26f346de8`): `readArtifactSubjects`
re-prepares through `rebuildPreparation`, so a roster-paired artifact rebuilds to its own identity and reads
`verified`; the verdict gains `unverifiable`, carrying the recipe halves the file lacks, for a mismatch beside a
gap, while a mismatch under a complete recipe stays `refused`; the driver prints the missing halves beside the
objection.
Guards: an artifact built over a crossed section pairing reads `verified` with the bare carve as positive control;
an old-style file over a different pair reads `unverifiable` naming both halves; the moved-slicing case now carries a
complete recipe and still reads `refused`.
Removing the section half, the block half, or the gap rule fails 2 cases each.

### rendering-2, MAJOR by contract, verified: one stdout line prints an arbitrary caught message

Folded into `#237`:
`rendering-audit-settled.ts:292` prints `REFUSED: ${verification.detail}`,
which `rendering-audit-settled-input.ts:204` fills with `caughtValueText(error)` and no marker check;
bounded today to hashes and counts, but the verifier's `translating()` wrapper launders inner messages
into the marked `ArtifactParseError`, the `#244` shape.

FIXED 2026-08-26 in `c19d203c6`: `verifySettled` records `refusalText` as the detail.
No guard of its own: the path is one call, and an unmarked inner throw cannot be injected through the public reader.

### rendering-3, MAJOR, verified: `--run` and `--against` written last are read as absent

`rendering-audit-settled-report.ts:190-197` returns `''` for both an absent flag and a valueless one,
so `--run` written last reports the newest run and `--against` written last prints no across-run band;
the sibling args module records the same collapse as a fixed defect for `--cap` and `--only`,
and the report module has no test.
Tracked as `#256`.

FIXED 2026-08-26 in `68062ccf7`: the report reads both flags through `readReportArguments` in the args module,
which shares `valueAfter` and its refusal with `--cap` and `--only`; a flag at the end of the line or followed by
another flag is a stated refusal naming the flag (`--run needs a value written after it`, exit 6, no frames, verified
at the CLI boundary).
Guards in the args test: nothing named gives two empty lists, both named are read in any order, `--run` at the end
refuses, `--against` followed by `--run` refuses; a lenient reader fails 3 cases.

### rendering-4 to rendering-12, MINOR, verified where cited

`asked=` counts answered rows (`settled-read.ts:420`), so per-model voice loss is unreadable from the report;
relocation candidates are counted per claim pair, not per slice pair (`settled-relocation.ts:161-183`);
`auditOne` builds a client per subject (`settled.ts:122`, the calibrate-5 shape);
four operator refusals thrown as bare `Error`
(`settled.ts:428`, `settled-input.ts:391-392`, `settled-report.ts:96,161`);
the row and digest notes say a run file carries no text while `report` persists document spans
(`settled-row.ts:127-150`), which the `#219` sanitization must treat as corpus-bearing;
a negative `--cap` audits the whole archive (`settled.ts:216`);
model-supplied category and verdict words are stored verbatim in `dropped` (`rendering-audit-screen.ts:288,393`);
`settled.ts` and `settled-report.ts` have no test;
invariant throws are bare `Error`.

## Slice reports

Each entry records the reviewer's coverage claim, then what the main session verified.

- `provider`: reviewer read 76 of 76 files (20733 lines), none unread; reported 1 BLOCKER, 5 MAJOR, 8 MINOR;
  all fourteen re-verified at the cited lines and recorded; it named the `#235` fallback, the missing
  catalog check, and the `RunConfigError` gap unprompted.
- `translate`: reviewer read 66 of 66 files (16700 lines), none unread; reported 2 MAJOR, 4 MINOR,
  all six re-verified and recorded. Answered calibrate's question: `producer-calibrate.ts:120` also builds
  a client per slice.
- `repair`: reviewer read 65 of 65 files (17544 lines), none unread; reported 3 MAJOR, 6 MINOR;
  eight re-verified as reported, one (repair-2) downgraded after the abort path was traced through
  `stage-round.ts`, `stage-call.ts`, and `stream-drain.ts`.
- `probes`: reviewer read 63 of 63 files (20031 lines), none unread; reported 1 BLOCKER, 4 MAJOR, 8 MINOR;
  the BLOCKER and every MAJOR re-verified at the cited lines; MINORs spot-verified.
- `calibrate`: reviewer read 33 of 33 files (10042 lines), none unread;
  reported 2 MAJOR and 9 MINOR, all eleven re-verified at the cited lines and recorded;
  the reviewer named the `#235` fallback and the `RunConfigError` gap unprompted
  and corrected the silence premise, which is the opposite of a skim.
  Its open questions, handed to other slices:
  whether `candidate-select.ts:347` `judgesAvailable` counts seated or reachable judges (`consolidate`),
  whether `producer-calibrate.ts` also builds a client per slice (`translate`),
  and whether any consumer prints the `reason` field `pass-schema-census.ts` stores from a `SyntaxError`.
- `consolidate`: reviewer read 28 of 28 files (7408 lines), none unread; reported 1 MAJOR, 9 MINOR;
  the MAJOR re-verified; it answered calibrate's `judgesAvailable` question (seated roster).
- `document`: reviewer read 77 of 77 files (19246 lines), none unread; reported 3 MAJOR, 9 MINOR;
  the three MAJORs re-verified at the cited lines, the population note in `markdown-blocks.ts` included;
  MINORs spot-verified.
  Its open questions go to the fix queue:
  whether `screenNonTranslationVotes` findings joined into `l.warn` can quote text (`#237`),
  whether `reindexSlicePair` restamps both sides of an insertion pair,
  whether `#232`'s reachability measure counted test-only reach for `group-source-first.ts` and `reflow-orphans.ts`,
  and whether the reading cache's generation marker is the pipeline digest (`#253`).
- `artifact`: reviewer read 47 of 47 files, none unread; reported 3 MAJOR and 4 MINOR
  (artifact-1 filed MAJOR by the reviewer's own call, BLOCKER by the brief's letter);
  all three MAJORs re-verified at the cited lines;
  it answered both extra questions: no per-stage quorum evidence in the owned artifact shape,
  and the round-three draw is legacy artifacts the two-lane parser refuses.
- `slices`: reviewer read 58 of 58 files, none unread; reported 3 MAJOR, 6 MINOR;
  all three MAJORs re-verified at the cited lines; none needed a new task, they fold into `#238`, `#246`, `#249`.
  Its open questions: whether `PreparationIdentity` is a branded primitive
  (`lane-comparison.ts:403` compares with identity), whether a full-pass ledger reaches the open-file limit
  under one `Promise.all`, and whether an entry id may appear in a boundary refusal at all.
- `rendering`: reviewer read 32 of 32 files (19 source, 13 tests), none unread; reported 3 MAJOR, 9 MINOR;
  all three MAJORs re-verified at the cited lines.
  Its open questions: the population share of `verification=refused` (a kind-field count, `#255`),
  and whether the writer-side mismatch errors that `translating()` wraps can quote slice text (`#237`).

## What this audit does not cover

- Live behaviour against the providers.
  No model call is made by the audit;
  the `#235` fix will be verified live at the user boundary as its own step.
- The corpus itself, and the quality of shipped translations.
  Those are measured by the instruments in the `probes` and `rendering` slices,
  whose honesty is what the audit checks.
