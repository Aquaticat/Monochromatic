# Translation repair history: segment 1.2

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

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

## `#216` was half wrong, and reading the source before building found it (2026-08-25)

`#216` was opened on the finding that seventeen modules build a `role: 'system'` message
and not one of them puts its response schema into that message.
That is true of the PROMPT BUILDERS and false of what a model actually receives on Charm Hyper.

`anthropic-request.ts` routes every schema-bearing call through `renderToolSystemPrompt`,
which prints the whole schema into the Anthropic `system` field under
"THE EXACT SCHEMA OF THAT OBJECT",
followed by seven format rules.
One of those rules reads
"Pass the object itself.
Do not pass a string that contains JSON,
and do not escape its braces",
which is exactly the failure `#216` cited as evidence that the schema was missing.

So the correlation runs the opposite way to the mechanism the task assumed:

```text
Charm Hyper   schema IS in the system prompt    6 of 6 measured schema failures
Synthetic     schema is NOT in the prompt       0 measured schema failures
```

The owner's instruction was already implemented on the provider where the failures are.
This is worth stating plainly because the task's own evidence section reads as though
it were about to conclude the opposite,
and a later session would have believed it.

### What was genuinely missing

The Synthetic path had nothing of the kind.
`synthetic-client.ts` builds an OpenAI-compatible body carrying only the API-level
`response_format` field,
which a model that does not honour it never sees.
That is a real gap against the instruction,
and it is the half that was built.

`src/schema-prompt.ts` renders a block from the same `JsonSchemaResponseFormat`
the request puts on the wire,
so the prompt and the wire cannot drift.
It is idempotent,
it adds a system message where a call has none
rather than dropping the schema on the calls that state least,
and it handles a system message carrying parts
so a call that also sends a picture is not the one that loses its schema.
Its rules list is carried over from the Anthropic renderer,
which is the wording this codebase has already run in production.

`hyper-client.ts` is deliberately unchanged,
with a comment at the seam saying why.
An edit there was written and then reverted:
it would have stated the schema twice on every Hyper call.

### Why the client seam rather than the seventeen prompts

The task proposed editing each prompt builder to append a rendered block.
The seam is strictly better.
It derives the text from the exact value going on the wire,
it covers every caller that exists and every caller written later,
and there is no eighteenth prompt to remember.

### What is owed, stated as an open question rather than a prediction

The after-measurement.
Adding schema text lengthens every Synthetic system prompt,
which costs tokens
and could hurt as well as help.
Synthetic's schema-failure count is already zero,
so this change CANNOT be validated by that number falling.
What it can be measured on is a first Synthetic schema failure never appearing under load,
and the token cost,
which the `#210` spend ledger now makes readable.
Record the outcome;
do not claim an improvement.

## `#215`: a run now says where its wall-clock went, and a CLI reads it back

The task's own text quoted the owner's standing instruction:
"If you found out we're not logging enough,
you should change the pipeline to log enough."
Following that instruction found a second gap the task had not named.

### What the log could not say, measured before changing anything

The live full-roster calibration log was surveyed for every line shape it carries.
Three tags appear in it and no others:
`reportStreamProgress` on 2405 lines,
`takeReading` on 161,
`exchangeWithRetry` on 4.
`takeReading` is the availability meter,
polled every minute or two.
There is no dispatch line,
and there is no round boundary line.

So the log records when each call ENDED and nothing else about time.
A call's start is not recoverable,
a round's extent is not recoverable,
and the question the audit `doc/audit/every-volume-guard-is-blind-to-one-model.md`
opened on has no answer in the data.

A lower bound was computable and was computed,
before the fix,
as a control.
Each completion line carries `firstByte` and `maxGap`,
and the largest gap falls
strictly after the first byte,
so their sum bounds the call's duration from below.
Intervals built from that sum are subsets of the true ones,
so overlaps counted on them
can only undercount:

```text
calls                        2405 (2349 completed, 56 cut)
log span                     6.15 h
summed duration FLOOR        2.37 h
mean concurrency FLOOR       0.39
peak concurrency FLOOR       9
```

Read that as a floor and nothing more.
It says at least nine calls were once in flight together,
and it cannot say what the figure actually is.

A method note worth keeping:
the first version of this sweep matched 1043 of 2405 lines and reported a peak of 5.
The label pattern required a colon,
so it silently dropped every non-`hf:` model.
An uncapped `grep --count` on the raw marker is what caught it,
which is the `QRY` rule paying for itself.

### The two lines that landed

`StreamProgress` gained `elapsedMs`,
computed as `Date.now() - state.armedAt` in
`armIdleGuard`'s `progress()`,
and `reportStreamProgress` prints it directly after
the outcome.
With the line's own timestamp that gives every call an interval,
which is what an
overlap count needs and what no completion line carried before.

`runGatherRound` now writes a round line,
which nothing did:

```text
editor round: 6/7 heard, 91402ms total, 61401ms to quorum, 30001ms in grace
```

The split is the point.
Time before quorum is the round doing its work;
time after it is the round waiting on
voices it may never hear.
Only the second is straggler cost,
and one round duration cannot tell them apart.
The audit could bound that cost only from above,
at the grace window times the number of
cut events,
and recorded that confirming it "needs the dispatch timestamps the run does
not currently record".

Both lines carry ids,
counts and durations only.
No corpus wording enters either.

### The reader, because a log nothing reads is not a measurement

`run-timing-parse.ts`,
`run-timing-read.ts` and `run-timing-report.ts`,
with the
`run-timing-report` mise task,
mirror the `spend-` and `ledger-` families.

Every read names what it found rather than returning an absence.
A completion line with no duration and a line that is not a completion at all are
different facts about a log:
the first says the run predates `#215`.
Folding them together would let a mixed archive's readable half be reported as the whole,
which is the shape of error this project has hit before.
The house `no-nullish-union` rule is what forced the discriminated union,
and it made the
reader better:
`readRunTiming` used to check `undefined` and then re-inspect the text to
count untimed lines,
and now one read decides all three outcomes.

Boundary verification,
all three states:

```text
new-format fixture   2 rounds, 29.0% of round time in grace, 1 voice lost,
                     mean 1.05 in flight, peak 2, 21.00s of calls across 20.00s of run
live pre-215 log     NO ROUND LINE, 2533 completion lines carry no elapsed field,
                     NO TIMED CALL
no argument          throws, naming the usage
```

Every figure in the fixture row is hand-computed from three intervals at
`[0,10]`,
`[2,8]` and `[15,20]` seconds,
not recorded from a run,
so a change in the sweep fails the case instead of moving the target.

### GFP

Both new guards were shown to fail with the guard removed and to pass with it restored.

```text
elapsedMs set to 0            stream-cut and stream-idle-guard both exit 1
                              "expected +0 to be at least 20"
round line deleted            stage-round exits 1, both cases
                              "expected exactly one round line, got 0"
```

The idle-guard failure is non-vacuous:
`firstByteMs` read 20 from a real wait,
so the assertion compared a measurement against a constant rather than zero against zero.

### What is owed

The measurement itself.
Achieved concurrency and the real straggler cost cannot be computed until a run emits the
new lines,
and the calibration now running was launched from the old build.
The audit's 1.45 hour figure stays an upper bound until then.
This is recorded as owed,
not predicted:
the point of the two lines is that the answer was unknown,
and it still is.

### Suite

676 PASS,
0 FAIL,
exit 0.
Lint 0 warnings 0 errors.
Build clean.

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
