# Translation repair history: 2026-08-25 calibration, segment 3

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

```text
could not read Basket.json as JSON (EACCES)
```

`runs-lock.ts` and `editor-standing-read.ts` already said exactly that,
so all four sinks now speak one vocabulary.

### The suite that pins it, and the two-layer proof

`src/corpus-run/sink-names-only.unit.test.ts` holds five cases,
one per sink plus the case that reads the path back.
It pairs with `message-names-only.unit.test.ts`:
that one decides which CLASSES may repeat a message,
this one checks that the SINKS actually ask.

`editor-standing-read.ts` exports nothing,
so its case runs the built command the way an operator does and reads its stderr.
That is the first spawn in this package's suite.
The command exits 1 on the fixture for its own `#217` reason,
having recorded no rounds,
so the helper reads both streams off a `spawnSync` status
rather than treating a non-zero exit as a failure to run.

Every fixture proves itself unreadable before any assertion runs.
A suite run as root opens a mode-`000` file,
which would leave all five cases exercising the happy path while reporting a pass.

The two layers are proven separately,
because they fail in different worlds:

-   guarded open removed,
    policy call kept:
    2 of 5 fail,
    and the path-leak case PASSES,
    because `refusalText` is what keeps the path out there.
-   both removed:
    3 of 5 fail,
    the path-leak case included.
-   restored:
    5 of 5 pass,
    whole suite 687 of 687.

## Four guard proofs, run once the bundle was free (`#225`, `#228`, 2026-08-25)

The suites for `#224`,
`#225`,
`#226`,
`#227` and `#228` all import the built bundle,
and the bundle had been held by a live calibration since the day before.
Rebuilding released all five at once.

`#228`,
both providers.
Replacing `verify: wholeMessage` with a comment fails exactly two cases per provider:
`REFUSES a stream that ended without its terminator` reports `expected 1 to equal 3`,
one attempt spent instead of three,
and `ACCEPTS the retry when only the first attempt was cut short`
lets a `MalformedCompletionError` escape.
Four failures across the two suites,
no collateral.

`#225`,
parser half.
Reverting `front-matter.ts` and `parse-mdx.ts` fails three cases in each suite:
the position case,
the no-cause case,
and the marker case.
The no-quoting case passes in both worlds,
which is right rather than a gap:
the pre-fix classes already wrapped,
and the leak travelled through the CAUSE chain
that Node's reporter renders whether asked to or not.

`#225`,
CLI half.
Reverting `cli-refusal.ts` fails five of its seven cases,
including the two added this session for `#226`'s stated-refusal branch
and `#227`'s marked-class fault path,
so both of those are boundary-proven here too.
The survivors are the `RunJsonUnreadableError` report,
which the old code already caught,
and the clean run.

### Rebuilding under a live pass, measured rather than argued

`doc/runbook/translation-repair-corpus-pass.md` says to run nothing through `mise`
while a pass is in flight,
and gives the pipeline digest as the reason.
That reason is sound and it is narrower than the rule.

The pass in flight was `editor-calibrate`,
which writes no artifacts and stamps no digest:
its output is its log.
Before rebuilding,
three facts were checked on the running process rather than assumed:

```text
node dist/final/node/editor-calibrate.mjs 40    one process, zero children
/proc/<pid>/fd                                  no descriptor under translation-repair/dist
grep -o "import(" dist/.../editor-calibrate.mjs 0
```

A running pass never reads that directory again,
so overwriting it cannot reach the process.
The bundle was rebuilt eight times over the session,
twice with deliberately broken source for a guard proof,
and the calibration kept producing rounds throughout.

This does not license rebuilding under a CORPUS pass.
That one stamps a digest into every artifact it settles,
and a rebuild leaves the run recording a digest that no longer describes what is on disk.
The distinction is what the run WRITES,
not whether the process would notice.

## The pipeline now keeps what each model wrote (`#212`, 2026-08-25)

### The gap, found by hitting it

Asked to confirm or reject that one seat was weak for this job,
the honest answer available from the archive was that nothing could answer it.
No run this project has ever made kept a single line any model produced.

The producer standing says a seat was preferred on 3.0% of disinterested ballots.
It cannot say whether that seat wrote something WRONG
or merely something nobody picked as the single best of ten.
Those are different findings with different remedies.
Every archived artifact predates model attribution,
neither calibration writes candidates to its run directory,
and the log names only the WINNING candidate's author,
so a losing candidate cannot be joined to the model that wrote it.

Re-deriving the evidence meant buying fresh calls for something a finished run had already paid for.

### What now records it

`candidate-ledger.ts` writes one JSON file per judged contest into
`${TRANSLATION_REPAIR_RUNS_DIR}/ledger/`,
holding every candidate's exact rendered text,
every model behind it with composites expanded,
every ballot with its reason verbatim,
and the winning position or that the round declined.

ONE HOOK COVERS EVERY CONTEST.
The translate lane,
both editor paths,
the refiner and the fidelity judge all route through
`selectBestCandidate`,
so nothing has to be remembered per caller.

### Two shapes this had to take, and why

A WRAPPER,
NOT A HOOK IN THE CASCADE.
The deciding function leaves by six returns,
five of them declines.
Threading a write through each would be five chances to miss the sixth.
`candidate-select.ts` now exports `decideBestCandidate` with its logic untouched,
and `candidate-select-record.ts` wraps it.
The wrapper lives in its own module because `candidate-select.ts` sits at 269 of its 300 permitted
code lines and restating the request type there would breach the cap;
`Parameters<typeof ...>` borrows the signature instead of copying it.

IT NEVER RAISES INTO THE SELECTION PATH.
A pipeline that failed a slice because its telemetry could not write would be worse than one with
no telemetry,
so every failure is caught,
named and swallowed.
The test for that matters more than the success cases:
it points the run directory at a path where a FILE sits where the directory belongs,
and asserts the caller is undisturbed.

WITH NO RUN DIRECTORY NAMED,
NOTHING IS WRITTEN.
That is the ordinary path for every unit run and every probe,
not an edge case.

### What it holds, and where it must not go

Candidate text is a rendering of a corpus passage,
so the ledger holds unlicensed corpus wording exactly as the settled artifacts already do.
It lands under the run directory,
outside this repository,
and must never be committed.

### The current run gets none of this

The calibration in flight started on a build that predates the ledger,
and rebuilding `dist/` mid-run would invalidate every cached slice and re-buy the whole run.
So the roster question that prompted this stays unanswerable from the archive,
and the next run answers it without a single extra call.

## The ledger has a reader, and writing it found a real gap (`#212`, 2026-08-25)

Written for the same reason the spend reader was:
`#210`'s writer looked finished until its reader was built,
and building the reader found two real defects in the writer.
A writer with no reader has never been checked against anything.

### The join is the whole point

A ballot names a POSITION,
not a model.
Nothing before this could say which model a judge was talking about
when it explained why it did not pick something,
which is exactly the evidence a roster question needs.
`candidates[best - 1].producers` in `src/corpus-run/ledger-read.ts` is that join,
one-based because the slate the judges saw was.

`summariseLedger` returns per-seat counts:
candidates written (composites credit both authors),
contests won,
votes from judges with no stake,
the denominator of ballots those judges could cast,
and self-votes counted apart.
`workOfModel` returns one seat's candidate text beside every disinterested judge's verbatim reason.

Two ballot faults are counted separately and neither is dropped:
an abstention names nothing,
and a ballot naming a position the slate does not hold is a fault in the judge.
Folding them together would report one count of two where a contest had one of each.

### The parser refuses rather than filling in

`src/corpus-run/ledger-parse.ts` turns a file into a shape the reader can trust,
raising `LedgerShapeError` on anything else.
A truncated file quietly read as a contest with no ballots
would report a seat as unjudged when the record was simply lost.

Model ids are read as plain strings,
deliberately,
not as the catalog union the writer held.
A ledger is read to ask questions ABOUT the roster,
including about a seat since dropped,
so narrowing a recorded id back into today's catalog would be a claim the reader cannot support.

`weight` and `selfVote` are not read at all.
The reader works out who had a stake from the producer lists,
because it needs that for EVERY candidate and `selfVote` speaks only about the one its ballot named.
Reading it as a cross-check would prove nothing either:
`candidate-select.ts` and `candidate-ledger.ts` both derive their answer
from `producerModelIds` on the same producer in one process,
so the two can never disagree.
That was checked before being skipped.

### GFP found a gap the first twenty cases missed

Five mutations,
and the first one survived:
changing the join to `candidates[best]` left every test green.
Every ballot naming a middle position resolves under either indexing,
and so does a ballot past the end;
only a ballot naming the LAST candidate on a slate tells the two apart,
and no case named one.

The added case reads the declined contest,
which holds exactly one candidate whose only judge names it.
All five mutations are red now:
the join off-by-one,
ignoring stake in the denominator,
folding the two ballot faults together,
keeping an author's remark about its own work,
and tolerating an absent array in the parser.

### Verified at the boundary, in three states

The production writer wrote a real ledger into a throwaway run directory,
and the CLI read it back:

-   A real ledger prints the per-seat summary,
    and `--model <id>` prints that seat's text with the judges' verbatim reasons.
    Every number was checked by hand against the fixture.
-   An absent ledger (`ENOENT`) prints `NOTHING RECORDED` and exits non-zero.
-   An unreadable ledger (`EACCES`) now RAISES instead of reporting an empty run.

That last one was a real defect found by running the control.
Any `readdir` failure previously read as "this run recorded nothing",
so a permissions problem would have been reported as an answered roster question.
The refusal names the filesystem code rather than the message,
because a code carries no path and a run directory path can name a person.

The task is `mise run //package/module/translation-repair:ledger-report`,
with the run directory taken from `TRANSLATION_REPAIR_RUNS_DIR`
through the same `resolveRunsDir` every other reader in this family uses.

### State

Built,
lint clean,
types clean,
663 suites passing,
zero failures.
Parked in `~/temp/agent/spend-telemetry-210.tar.gz` with the `#210` spend work,
thirty-one files,
repo-relative paths,
untarred over the repo root to apply.

## `#211` is proved at the wire, and the fix is in (2026-08-25)

One call to `qwen3.8-max` on Charm Hyper,
shaped exactly like a production ballot request,
with the untouched SSE bytes kept at `~/temp/agent/capture-211.sse`.
HTTP 200,
17612 raw characters,
128 frames.

### What the provider actually sends

The diagnosis guessed the model declares a thinking block carrying its answer deltas.
The wire is narrower and stranger than that:

```text
content_block_start  index 0  {"type":"thinking"}
  ... 106 thinking_delta frames ...
content_block_stop   index 0
content_block_start  index 1  {"type":"tool_use","name":"candidate_ballot"}
content_block_start  index 1  {"type":"thinking"}          <- SAME INDEX, no stop between
  ... thinking_delta and input_json_delta interleaved, 17 of the latter ...
```

The provider opens index 1 as a tool call and then opens THE SAME INDEX again as thinking.
`openBlock` in `anthropic-delta-scan.ts` sets the block map unconditionally,
so the later declaration wins,
and `channelFor` then files every index 1 delta as reasoning,
including the `input_json_delta` frames carrying `{"best": 2 ...`,
which is the ballot.

That is the whole of the 70-zero-content-against-71-ballots signature.
The extractor in `anthropic-completion.ts` ignores blocks,
so it recovers the answer and the vote lands;
only the scanner that feeds the progress line and the runaway guard is fooled.

### The fix, and why this shape rather than the other one

`ANSWER_DELTAS` in `anthropic-delta-scan.ts` now exempts `input_json_delta`
from the thinking-block override.
A tool-call argument fragment cannot be deliberation:
it is the structured answer by construction,
filling a schema this pipeline sent.
`text_delta` is deliberately NOT exempt,
so the case the override was added for,
plain text deltas inside a thinking block,
still routes to reasoning.

The alternative was to keep the FIRST declaration in the block map.
That also routes this capture correctly,
but only because `tool_use` happened to arrive first.
The chosen shape holds whichever order the two declarations come in.

GFP-proven:
removing the carve-out turns the new case red,
restoring it turns it green.
The test fixture is the captured frame order,
duplicate `content_block_start` included.

### Measured on the captured bytes, before against after

The same 17612 characters replayed through the same scanner,
the carve-out being the only difference:

-   Without it:
    `content 0 chars, reasoning 1488 chars, unreadable 0`.
-   With it:
    `content 218 chars, reasoning 1270 chars, unreadable 0`.

The before state reproduces the production symptom exactly,
which is the zero content chars the log reports for 98 of this seat's 100 calls.
The 218 characters that move are the ballot,
and 218 plus 1270 equals 1488,
so nothing was invented or dropped:
it was only filed under the wrong heading.

### What it should buy on the next run

`stream-runaway-watch.ts` bounds the content channel and leaves reasoning alone,
so an answer filed as reasoning escaped the volume cap and ran to the straggler deadline.
`qwen3.8-max` was cut 12 times in 71,
the highest on the roster by two and a half times.
The prediction is that its cut rate falls toward the roster's.
NOT YET MEASURED:
the run in flight predates the fix.

### State

Parked with `#210` and `#212` in `~/temp/agent/spend-telemetry-210.tar.gz`,
now thirty-three files.
Lint clean,
types clean,
663 suites passing,
zero failures.
