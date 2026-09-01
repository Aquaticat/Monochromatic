# Translation repair history: 2026-08-25 calibration, segment 2

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

## The refiner column is thinner than the editor column, by about four times

Measured on the live calibration at 33 of 40 slices,
while checking why one slice reported
zero refiner rounds.

### The first version of this section was wrong by an order of magnitude

It claimed the two columns differ by "roughly fifty times in round count".
That compared
1023 LOG LINES against 20 ROUNDS,
which are not the same unit.
`selectBestCandidate` emits
three different line shapes,
and only one of them is a round:

```text
918 per-judge ballots      "<model> chose candidate N at weight N: <reason>"
 90 decided rounds         "candidate N from <model> won weight N across N ballots"
 14 tied rounds            "judges tied at weight N; keeping the fallback"
```

The error was counting all three as if each were a vote.
Recorded rather than quietly
corrected,
because the wrong number pointed at a real and expensive action.

### What the rounds actually are

`runRefineStage` judges through the SAME `selectBestCandidate` (`src/refine-stage.ts:328`)
with the whole roster as judges,
so refiner rounds are already inside those counts:

```text
104 rounds total   (90 decided + 14 tied) at 33 slices
 20 refiner rounds (15 with a winner, 5 tied or declined by every judge)
 84 editor rounds  by subtraction
```

That is about 4.2 editor rounds per refiner round,
not 50.

Every decided round carries a real panel:
865 ballots over 90 rounds,
mean 9.6,
min 7,
max 10.
Refiner rounds draw from the same roster,
so 20 of them is on the order of 190
ballots at 33 slices,
projecting to roughly 230 at 40.

The reason the refiner ballot count looked absent is that `runRefineStage` puts it in a
FINDING string rather than its log line (`src/refine-stage.ts:436` writes
`refine-selected (weight N of N ballots)`),
while the log line carries only the winning
weight.
Nothing was missing;
it was being read in the wrong place.

### What that changes

The alarm was overstated.
A column with roughly 230 ballots is not obviously short,
and
there is no longer a prior that a second batch is needed before the landing.

STILL READ THE ACTUAL STANDING AT EXIT rather than this projection.
Ballots are not
independent within a round,
`#200` already records a sqrt(2.9) within-slice deflation for
exactly that reason,
and 15 decided refiner rounds spread across six seats is a thin base
for a ten-seat Bonferroni comparison however many ballots sit under it.

So the exit order is unchanged from the rehearsed procedure,
with one added reading:
if the refiner standing's own denominator turns out short,
`#200` records that the remedy is
a second batch of 80 poolable slices,
and that pooling needs no drift opt-in only while the
build does not change.
The landing changes the build.
That constraint is real and worth
keeping in view;
what has changed is that it is now unlikely to bind.

## The run's power inputs, measured at 38 of 40 slices

`#200` projected from a 16-slice reading.
These are the figures the standing will actually
rest on,
measured rather than projected,
and two of them moved in opposite directions.

```text
slices seen                     38
contributing (>= 1 round)       31   82%
empty (0 rounds, nothing to edit) 7
total judged rounds            131
rounds per contributing slice  4.23
```

Seven empty slices is not a fault.
`editor-calibrate.ts` names this case explicitly:
a slice
can buy the whole accuracy lane and have nothing to edit.
`#200` recorded one live slice
doing it;
there are now seven,
and they simply contribute nothing to either column.

### Both inputs moved, and they largely cancel

The 16-slice reading had 75 percent yield and 2.54 rounds per slice;
the 14-slice selftest
had 2.90 rounds per contributing slice,
giving a sqrt(2.90) = 1.70x deflation.

Now yield is BETTER at 82 percent,
and rounds per contributing slice is WORSE for power at
4.23,
because within-slice correlation deflates by sqrt of that:
2.06x rather than 1.70x.

These are not independent problems.
Raw z grows as sqrt(total rounds),
and the deflation
divides by sqrt(rounds per contributing slice),
so the deflated z grows as

    sqrt(total rounds / rounds per slice) = sqrt(contributing slices)

THE EFFECTIVE SAMPLE IS THE NUMBER OF INDEPENDENT SLICES,
NOT ROUNDS.
Extra rounds bought
inside one slice buy precision about that slice,
not about the roster.
So the figure that
decides the standing is 31 contributing slices,
on track for roughly 33 at 40,
against the
10 that produced a deflated best z of 1.76 in the selftest.

### Do not turn that into a prediction

`#200` already refused this,
and its reason still holds:
the effect size being scaled was
measured on FIVE models,
and the pooled preference rate roughly halves at ten seats,
so the
implied z can move either way.
`standing-from-log.mjs` derives the Bonferroni critical value
from the row count,
so it will use the ten-seat threshold rather than the selftest's 2.58,
and it applies the deflation itself.

Read the printed standing.
The value of these numbers is that they make it INTERPRETABLE:
when a seat clears or fails,
the reason is 31 independent slices deflated by 2.06x,
and both
halves are now measured rather than assumed.

## An unreadable run file printed itself, and the fix was a whole class rather than one CLI

Filed as `#220` during the calibration,
deferred until the landing cleared,
then reproduced
on 2026-08-25.
It was filed as a crash with a minified stack.
Reproducing it showed something worse.

V8 gives a `JSON.parse` refusal a synthetic script whose source IS the text it was handed,
so Node's uncaught-exception report prints that line.
Against a throwaway ledger,
`ledger-report` printed a whole contest ahead of the stack trace:

```text
<anonymous_script>:1
{ "task": "whiskerfield-1", "at": "2026-08-25T00:01:00.000Z", "candidates": [ { "index": 0, "producers": ["tab

SyntaxError: Bad control character in string literal in JSON at position 110 (line 1 column 111)
```

A real ledger file holds candidate renderings and a person's entry id.
A garbled one published both to a terminal.

The package already stated the rule this broke.
`error-name.ts` records that a message is uncontrolled and that a run directory path can name
a person;
`LedgerShapeError` says outright that it NAMES,
NEVER QUOTES.
Nothing had applied either to the parse step.

### The class was twelve times larger than the report

Counting `JSON.parse` sites that no `try` encloses found 25 matches,
which is not the answer:
11 are TSDoc `@example` text and one parses a string on the write path.
The real class was 12 file-reading sites across 11 files,
every one under a run directory.

Fixing only the one that happened to be tripped would have left eleven instances of the same
contract violation,
which is the layer-1-only mistake `ELR` warns about.

`readRunJson` in `run-json-read.ts` is now the only way a run file is read.
It refuses with `RunJsonUnreadableError`,
naming the file's basename and the failure and
carrying no text from it.
A parse offset survives as a number,
because a truncation point is what tells an operator what
happened and it is content-free.
`parseRunJson` splits out for the two callers that hold text rather than a path.

`slice-cache-namespace.ts` is deliberately left alone.
Its `serialized` argument arrives from `persistSlice` on the WRITE path as a lane's own
in-memory serialization,
so it never reads a file.
That was traced to the call site rather than assumed.

### Two lint rules disagreed, and the answer was to delete the code

Reading the digit run by hand needed either a mutable cursor or a character array.
`no-function-root-let` forbids the first,
and `prefer-spread` and `no-misused-spread` forbid
each other on the second.
Per `LN1` the remedy is structural,
not picking a surface to silence:
`Number.parseInt` already reads a leading digit run and stops,
so the hand-written scan is gone.

### The test that could not have failed

Writing the absence assertion exposed a trap worth remembering.
V8 quotes only the FIRST TEN CHARACTERS of a file back inside its refusal message,
so a fixture
word of `Marmaladeslept` appears as `Marmalades`,
and a test asserting the full word absent
passes even against a reader that forwards the message whole.

The fixtures now lead with `Bixbyfluff`,
exactly ten characters,
confirmed against `JSON.parse`
directly to appear in the message it produces.
The same measurement corrected a truncation offset guessed at 30 to the real 27.

GFP-proven:
breaking both guards,
so `readRunJson` forwards V8's message and `refusalOf`
forwards every class's,
fails `readRunJson` on two children and `refusalOf` on exactly the
foreign-message case,
exit 1.
Restoring returns 680 PASS,
0 FAIL.

### What the boundary check found that the unit tests could not

Driving `rendering-audit-settled-report --run` against a malformed file confirmed the leak is
closed there too:
zero hits for the fixture's distinctive word,
with the file's name appearing
twice as a positive control that the parse was genuinely reached.

It also showed the OTHER half of `#220`,
which `#222` did not close:
the refusal was safe but still uncaught,
so Node printed the minified bundle line,
around three thousand characters of it,
around a correct one-line message.

`reportingRefusals` closes that.
It catches ONLY `RunJsonUnreadableError`,
because catching every `Error` would hide the stack
of a genuine programming fault,
and the forwarding case is tested to hold that line.

Which CLIs needed it was measured off the built bundles' own import graph rather than guessed:
11 of 39 entry bundles can reach the reader,
one is the library barrel,
one is `ledger-report`
which reports its unreadable files as a shortfall inside its own output,
and the other nine are
wrapped.
The same throwaway now yields two lines and 211 characters at exit 4.

### The test suite taught something about its own runner

Written with three sibling cases,
the suite failed.
`describe` runs children concurrently by default,
and all three cases swap process-global state:
one saw zero captured lines because a sibling had already restored `console.error`,
and another
read `undefined` where it had just written zero.
`concurrency: 1` is documented for exactly this.
Both swaps are process-wide,
and the runner spawns `node` once per test FILE,
so nothing outside
the file was ever at risk.

A grep counting `PASS` and `FAIL` lines reported 681 passes and zero failures on that failing
run,
because the runner reports a file-level failure in its own line.
The exit code was right and the count was wrong,
which is what `TLY` says to expect.

Landed as `768d26b18`,
`ba83d021c`,
`7a4f27db0` and `a72d9b6fb`.

### One observation recorded rather than acted on

The suite output shows the pipeline's own warn logs forwarding a model's raw non-JSON answer,
`raw="not json at all"`,
alongside the `SyntaxError` message that quotes it.
That is the same shape as the unguarded-parse defect,
but the exposure is different:
those lines go to a run log inside a run directory that already holds corpus wording,
and the
owner's instruction is to log more rather than less.
Naming it here so the difference is a decision rather than an oversight.

## A second calibration is in flight, to pay four measurements the landing left owed

Launched 2026-08-25T14:14Z,
detached,
40 slices,
the same command the first calibration used:

```sh
TRANSLATION_REPAIR_RUNS_DIR=~/temp/agent/editor-calibrate-postguard-20260825 \
  mise run //package/module/translation-repair:editor-calibrate -- 40
```

Log at `~/temp/agent/editor-calibrate-postguard-20260825.log`.

THE SHAPE IS COPIED DELIBERATELY.
Two of the four things this run owes are RE-derivations
rather than first measurements,
and a re-derivation against a differently shaped population
answers a different question than the one asked.
Matching slice count,
roster and command is what makes the comparison legible.

Meters before launch,
from `budget-sample`:

```text
METERS synthetic=wet hyper=wet syntheticWeekly=91.03581431818182% syntheticFiveHour=2750/2750 syntheticThrottled=no hyperBalance=9683
```

### What to read off it

-   `#215`'s achieved concurrency,
    from `run-timing-report`.
    The first calibration could not answer this:
    the round lines it reads did not exist
    until `#215` landed in `b6ea1cc51`,
    so `NO ROUND LINE` on that log was a true absence
    rather than a quiet zero.
    This replaces the audit's 1.45 hour straggler upper bound with a measurement.
-   `#214`'s straggler window,
    re-derived against a population that now contains runaways.
-   `#221`'s zero-content recount per seat.
    The number to beat is `deepseek-v4-pro-0813` at 36 of 356 completed streams.
    Falling to zero confirms one reading of that row;
    staying near 36 confirms the other.
    `qwen3.8-max` is expected to stay high and to be an accounting artifact either way,
    since it is the sole `toolChoice: 'auto'` seat and its answer arrives as tool-call
    arguments that `generatedChars.content` does not count.
-   `#213`'s serialization question,
    which was blocked on `#211` and `#215` and is now free.

### While it runs

Nothing goes through `mise`,
per the corpus-pass runbook's step 4:
every pass and probe task
declares `depends = ["build"]`,
so invoking one rewrites `dist/final/node` underneath the
running pass.
Read the log with built entry points directly instead.

The pass was launched from `a93c0892d`,
with the working tree clean and the field confirmed
clear beforehand by argument-vector inspection rather than by a recorded pid.

## The same defect had a second half, reaching a sink through a catch (`#224`, 2026-08-25)

`#222` claimed every run-file read goes through the guarded reader.
That claim is true as it was scoped,
and the scope was narrower than it sounds:
it covered parses that NO `try` encloses,
which are the ones V8's uncaught-exception reporter prints whole.

Re-reading the sweep found the other half.
V8's `SyntaxError` MESSAGE quotes the text as well,
and four handlers forwarded that message to somewhere it could be read.
Catching the error prevents the whole file being printed;
it does not prevent the ten characters the message carries.

### What was leaking, and to where

Three of the four read artifacts,
which hold corpus renderings:

-   `corpus-run/editor-standing-read.ts` parsed an artifact and printed
    `caughtValueText(error)` to stderr.
    `caughtValueText` returns `error.message` for an Error,
    which is the whole mechanism in one call.
-   `corpus-run/attribution-read.ts` parsed an artifact and STORED the same text
    as the `reason` on a `MalformedArtifact` record that travels to its caller.
    This one does not merely print,
    it persists.
-   `corpus-run/artifact-placement.ts` printed it on the `POOL malformed` line.

The fourth,
`corpus-run/runs-lock.ts`,
parses a lock file holding a pid and a timestamp,
so nothing corpus-bearing was ever exposed there.
It is fixed for one contract rather than four.

### Two things measured rather than assumed

V8 quotes only where the text stops being JSON near its start.
A file truncated at its tail yields a positional message that quotes nothing:

```text
"Pouncewick not json at all"  ->  Unexpected token 'P', "Pouncewick"... is not valid JSON
'{ "tail": "Pouncewick" '     ->  Expected ',' or '}' after property value in JSON at position 23
```

That matters for the test as much as for the defect:
a fixture that fails late would have tested nothing while appearing to test the guard.
The fixture word is ten characters,
exactly V8's quote window,
so it is neither padded nor truncated for a reason unrelated to the guard.

### What was correctly excluded, each checked rather than waved through

`attempt-store.ts` and `slice-cache-namespace.ts` catch and branch on the class,
printing no message.
Both are deliberately left unconverted:
each treats `error instanceof SyntaxError` as "half-written file,
recompute",
and routing them through the guarded reader would change the thrown class
so that branch silently stopped matching.
`verify-published.ts` reports `errorName`,
which is a class name.
`pass-schema-census.ts` has no parse inside its `try` and forwards only `ArtifactParseError`.
`runner-closure.ts` reads our own built bundle.

### The shape of the fix

`src/refusal-text.ts` holds the decision.
`refusalText({ error })` repeats a message only from a class that DECLARES its message
names rather than quotes,
and otherwise renders `refused by <class>`.
`RunJsonUnreadableError` and `LedgerShapeError` declare it;
`ledger-directory.ts`'s `refusalOf` now delegates rather than keeping its own copy of the list.

A declared field rather than a symbol,
for a measured reason:
`--isolatedDeclarations` rejects a computed property name on a class (TS9038),
and the `Error.isError` gate already refuses every plain object a run file could carry.
What a symbol would have added is refusing a forged marker on a real Error,
which is the same trust a symbol import gives anyway.

It fails closed.
An unmarked class,
a foreign Error and a thrown non-Error all take the naming branch,
so the only way to leak through here is to mark a class whose message quotes.

### State

Landed in `2e8dd62f3`,
tests in `3c53df242`.
Type-check clean,
lint clean at 0 warnings and 0 errors over 908 files.

NOT YET RUN,
and this is the honest gap:
the suite imports the built bundle,
and the calibration in flight owns `dist/final/node`,
so the new cases resolve only after a build.
Lint on the test file reports two `TS2305` errors on that import
plus 14 warnings cascading from them,
and nothing else.
Running the suite and proving both guards per GFP is the remaining work on `#224`.

`mise tasks deps` was used to establish that `lint:types`,
`lint:oxlint` and `test:unit`
carry no build dependency,
which is what made checking anything mid-pass possible.
The type-check writes `dist/final/types/` only,
never the node bundle the pass is running.

## A third shape, found by asking which other parsers quote (`#225`, 2026-08-25)

`#220` and `#224` were both about `JSON.parse`.
The question that found this one was smaller and better:
which OTHER parsers does this package hand corpus text to,
and what do their refusals say?

Two,
and they answered differently.

### YAML quotes, every way it was asked

The `yaml` package raises `YAMLParseError` carrying a source code frame:

```text
Nested mappings are not allowed in compact mappings at line 1, column 7:

name: Pouncewick
      ^
```

That is a whole line where V8 gives ten characters,
and five failure shapes were tried rather than one:
nested mapping,
duplicate key,
unclosed flow sequence,
tab indentation,
and bad block indent.
All five reproduced the frame.
Front matter holds a person's name,
their dates and their links.

WRAPPING IT DID NOT CONTAIN IT.
`FrontMatterParseError` carried the parser error as `cause`,
and Node's uncaught-exception reporter renders a cause chain,
so the frame printed under `[cause]:`.
Measured end to end by throwing a wrapped error from `node` and reading the terminal.

Reachable two ways:
`corpus-run/recall-benchmark.ts` calls `splitFrontMatter` and is not one of the nine CLIs `#223` wrapped,
and `parse-document.ts` runs inside the pass,
which writes to a terminal when run interactively.

### MDX was the near miss, and the first probe called it safe

Four of five MDX failure shapes report a position and an expectation and quote nothing.
On that evidence the module was written off as already safe.
Widening the probe found the fifth:

```text
1:1: Expected a closing tag for `<Pouncewick>` (1:1-1:13)
```

It quotes the tag name.
Narrow,
but `parse-document.ts` stringified that cause into a `ParseFinding.detail`,
which is STORED in the artifact rather than printed and forgotten,
and `mdx-downgraded` is a routine tolerance rather than a corruption path.

The lesson is the one `RXH` states:
the narrowest query returning nothing is not evidence of nothing.
One probe produced a clean negative that a fifth case refuted.

### What both errors say now

Position and fault code,
which is the whole of what a reader acts on:

```text
Front matter fence pair found but YAML inside refused to parse at line 1 column 7
(BLOCK_AS_IMPLICIT_KEY); corpus metadata parses upstream, so this signals corruption.

MDX body refused to parse at 1:1 (mdast-util-mdx-jsx/end-tag-mismatch); corpus documents
compile as MDX upstream, so failure signals corruption or an unsupported construct.
```

Neither carries the parser error as `cause` any more.
Nothing is lost that a reader acts on:
the file is on disk to open at that line.

### A recorded decision reversed, with its reasoning answered

`cli-refusal.ts` caught only `RunJsonUnreadableError`,
and its note argued for that:
catching every `Error` would destroy the stack of a genuine programming fault,
trading a rare ugly report for a permanently undiagnosable one.

That reasoning was right about the cost and wrong about the choice,
because the two are separable.
Everything is caught now,
and the frames are kept anyway.
What is dropped is the message line and the cause chain,
which is where text travels;
what is kept is the frames,
which name files inside our own `dist`.
An unexpected fault exits 5,
distinct from 4,
because one is a bug report and the other is a re-run.

The old forwarding test pinned the old contract,
so it was replaced rather than left to fail.
Three cases now hold the design from both sides:
the message must not appear anywhere the reporter writes,
and the frames must still be there.
Either assertion alone is satisfiable by a wrong implementation.

### State

Source landed in `7b81a95c3`,
tests in `9145cc8aa` and `1e862f9e5`.
Type-check clean,
and every source file lints clean.

NOT YET RUN.
Every new suite imports the built bundle,
and the calibration in flight owns `dist/final/node`.
Lint reports 20 findings across the three test files,
all four errors being `TS2305` on symbols the rebuild will supply.
Running them,
and proving each guard by removing it,
is what `#224` and `#225` still owe.

## Does any error class quote what it was handed? Scanned, not sampled (2026-08-25)

Three disclosure defects were found by hand,
one after another,
which is a bad way to learn a class is closed.
So the question was asked mechanically instead:
of every error class this package defines,
which builds a message that interpolates a value
that could be corpus text?

Seventy-five files define an `Error` subclass.
Scanning each class's `super(...)` call for interpolated identifiers whose names are text-shaped
(`text`,
`raw`,
`body`,
`content`,
`passage`,
`wording`,
`rendering`,
`answer`,
`source`,
`slice`,
`value`,
`excerpt`,
`snippet`,
`output`,
`reply`,
`message`)
returns three,
and reading all three settles them.

-   `WordingCoherenceError` takes a caller-supplied message and forwards it.
    All four call sites build `${at} reports ...`,
    where `at` is a slice locator,
    and none interpolates the wording.
    The scan flagged it on a neighbouring `@param wording`,
    not on the message.
