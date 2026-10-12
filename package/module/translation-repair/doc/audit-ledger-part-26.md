# Audit ledger, part 26

Part 26 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B77: tables keyed by text answered the names every object inherits

Found in B73 and left open there;
B75 made the fidelity probe's defect table a map,
and this entry reads the rest of the package.
A plain object read through a key the package did not write answers `constructor`,
`toString` and the other names on `Object.prototype` with the prototype's values,
and answers `__proto__` with the prototype itself where it holds no entry of that name;
written through `__proto__`,
it sets its prototype instead of holding the entry,
so the entry is gone without a word.
A JSON file that records a `__proto__` key does read back,
since `JSON.parse` defines it as the object's own,
so the defect needs a key the object does not hold,
or one the code writes.
Found by reading the code;
no stored output was searched for a key spelled this way.

Five sites read a key from outside the package
(the red cases in `42eb0b0dd` each failed on its assertion before the fix):

- `anthropic-delta-scan.ts` routed a stream delta by the type the provider names,
  through `DELTA_CHANNELS` and `DELTA_TEXT_FIELDS`;
  a delta typed `__proto__` or `constructor`,
  with text in the field the inherited value's string form names,
  yielded that text with `Object.prototype` as its channel;
- `image-asset.ts` read an asset's media type off its extension through `MEDIA_TYPES`,
  and answered `tabby.constructor` as usable;
- `corpus-run/judge-crosscheck.ts` placed a claim in an arm by its issue's stored status through `ARM_OF_STATUS`,
  and filed a status `constructor` or `__proto__` under the `Object` function or `Object.prototype`;
  the status count `score-crosscheck` prints,
  counted into `{}`,
  printed the `Object` function's text in the count for `constructor` and dropped `__proto__`;
- `repair-sheet.ts` printed the inherited function as the note for a stored disposition `constructor`;
- `corpus-run/attempt-store.ts` held the attempt counts the corpus pass keeps by entry id as a plain object,
  so an id spelled as an inherited name counted as the inherited value,
  and a count for `__proto__` was not written.

`f55cb82a0` first moved the two reads that sat in runner bodies,
the attempt count and the status count,
into `attemptsOf`,
`countAttempt` and `statusBreakdown`,
with no change in what they do,
so cases could reach them.

The other tables and records read or wrote only keys the package itself chose,
and changed for one rule across the package:
the three canon tables in `quote-normalize.ts` and `CLOSER_OF` and `OPENER_OF` in `translate-quote-balance.ts`,
keyed by one UTF-16 unit,
which no inherited name is;
`CANADIAN_PAIRS`,
which reached its readers only through the `CANADIAN_SPELLINGS` map;
`nodeEntries`,
the build's own entry names;
`ADMISSIBILITY_FIELDS`,
looked up by the names of the counts the reader itself declared;
and records filled by ids or names the package itself produces
(claim,
cluster,
issue,
seed and envelope ids,
repair statuses and dispositions,
refusal reasons,
recall bands),
in `adjudicate-wire.ts`,
`tally-resolution.ts`,
`restoration-judge-wire.ts`,
`derivability-wire.ts`,
`repair-scorecard.ts`,
`repair-region.ts`,
`corpus-run/editor-width-probe.ts`,
`corpus-run/sentinel-probe.ts` and `corpus-run/recall-benchmark.ts`.

Fixed (`2293b0ded`):
a table looked up by text is a `ReadonlyMap`,
and a record filled by a key is a `Map` until it is handed on whole,
as an object built by `Object.fromEntries` at its function's return or its file's write,
so the shapes callers and stored files read are unchanged.
The attempt counts are a `Map` in memory and an object only in their JSON file.
A table over a closed set of names keeps the names in its type instead,
so the compiler refuses a lookup by unchecked text:
`ADMISSIBILITY_FIELDS`,
which the reader now walks by its own list of counts rather than by the declared record's entries,
`perBand`,
and `HYPER_CREDIT_RATES`,
checked with `satisfies` rather than typed as a record of strings.
`nodeEntries` and `CANADIAN_PAIRS` are maps rather than literal-keyed objects
because `isolatedDeclarations` (TS9010) needs an annotation on an exported constant,
and an annotation widens the keys to `string`;
the build configs hand rolldown `Object.fromEntries(nodeEntries)`.
Written one tuple per line,
the pairs table went past `eslint(max-lines)`'s 300 counted lines (490),
so its doubled-l and word-by-word groups moved to
`corpus-run/canadian-spelling-pairs-doubled-l.ts` and `corpus-run/canadian-spelling-pairs-word.ts`,
spread back in their places so the map's order is unchanged.

Found on the way and fixed in the same commits:
the media-type note said the table had two entries because the corpus had two extensions,
where the table had four from the commit that wrote the note (`158117e79`);
counted over the data repository at the pin,
the corpus's pictures are 210 `.webp`,
91 `.jpg`,
6 `.png` and 1 `.jpeg`,
and the note now says so.
The pairs table's TSDoc called every Canadian form lower case,
where `id` maps to `ID` (class 169).
And the comment over `score-crosscheck`'s status count said it counted control-arm claims only,
where it counts the undecided claims too (`f55cb82a0`).

Calls made here are open to veto:

- every table looked up by text is a map,
  the ones whose keys could never be an inherited name among them,
  so one rule covers the package and the scan lists no exceptions;
- records filled by a key are maps inside the function and objects outside it,
  rather than maps all the way to the stored file,
  which would change what every reader and stored artifact holds;
- tables over a closed key set keep literal keys rather than becoming maps,
  since the compiler then holds every lookup to the set;
- `judge-crosscheck.unit.test.ts`'s two suites sit under one root `describe`,
  so a failure in the first no longer stops the second from running (ledger M97).

Guard-offs on the fixed tree,
restored with `git diff` printing nothing after:
with `DISPOSITION_NOTES` a plain object again,
the scan's package case failed (`expected [ Array(1) ] to deeply equal []`)
and the repair sheet's inherited-name case failed (`expected false to equal true`).
The red commits show the rest:
each red case failed on its assertion against the unfixed code,
and the scan's package case listed every site before the fix
(`f0322ce6f` and `98f5b8861`).
The full suite on `d2af668bd`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,493 PASS lines and no FAIL line.

What the scan cannot see was read by a typed census of the fixed tree
(`~/temp/agent/audit-glossary-fix/b486-prototype-census.mjs`,
TypeScript 7.0.2's checker over the package's 2,005 source files),
which lists every element access and `in` test whose key is not a written literal.
In production code,
no write goes through a key typed as text,
and the 63 reads and 3 `in` tests keyed by text each take a field name the package chose
(read through a helper whose callers pass a written name),
an id the package minted,
or a key `Object.keys` gave from the same record;
the 4 keyed by a type parameter are keyed by a closed set.
A second probe (`b486-casts.mjs`) found no cast narrowing text to literal keys,
and two computed destructurings,
both of `process.env` by the package's own variable names.

Recurrence:
a table looked up by text is a `ReadonlyMap`,
and a record filled by a key is a `Map` until handed on whole;
`text-keyed-tables.unit.test.ts`,
which `source-scans` runs,
fails on a declaration typed with string keys whose value is an object literal at a module's top or `{}` anywhere,
or that is written through a computed key.
Out of its reach,
and named in its module note:
a table built by `Object.fromEntries` or handed back from a function and then read by text,
a class field,
a parameter destructured from an object an alias types,
a key typed by a template literal,
and a cast of text to a table's literal keys.

### B78: durations, holds, paces and budgets measured on the system clock

Found in T8's seventeenth batch,
beside B71,
and left open there.
The system clock is the time of day,
which a person or a time daemon can set,
and the package took its durations,
deadlines,
holds,
paces and budgets as differences of `Date.now()` readings.
Set back an hour mid-call,
a duration read negative,
a hold or a pace waited an hour longer than asked,
and a budget lasted an hour more;
set forward,
holds ended early and budgets ran out at once.
Found by reading the code;
no stored log was searched for a run during which the system clock was set.

The scan committed red (`a3f1f2c55`) read 36 reads of the wall clock as a number:
23 in production,
in `corpus-pass.ts`,
`pass-decline.ts`,
`pass-entry.ts`,
`sentinel-probe.ts`,
`provider-budget.ts`,
`provider-router.ts`,
`repair-benchmark.ts`,
`request-pace.ts`,
`slice-cost-log.ts`,
`stage-round.ts` and `stream-idle-guard.ts`,
and 13 in tests,
in `budget-hold-wait`,
`pass-decline`,
`pass-outside-reads`,
`stage-quorum`,
`stage-round` and `transient-retry`.

Each red case (`29608a23b`) failed on its assertion against the unfixed code,
with `wall-clock-stub.test-fixture.ts` holding `Date.now` at a reading the case moved:

- the pacer on its default clock,
  set back an hour after a take,
  asked the next take to wait 3,600,000 ms more than the window;
- a take whose sleep ended a millisecond before its reserved start returned there
  (1,059,999 for 1,060,000):
  the pacer slept once and never read the clock again;
- the idle guard,
  set back an hour before the first byte,
  reported that byte at -3,600,000 ms;
- the slice cost meter,
  set back mid-slice,
  wrote `ms=-3600000`,
  a line `slice-cost-read` drops;
- the gather round,
  set forward two hours as it started,
  logged a round of 7,200,000 ms;
- the default budget view,
  set back an hour after a refusal,
  held the refuser 3,600,300 ms on a 300 ms backoff;
- a budget view whose clock read 0 at its first reading took that reading for none
  and read every meter again inside the window;
- the repair benchmark,
  set forward two hours during its first entry,
  skipped the second on an hour's budget;
- `settleEntry`,
  set back an hour while it settled,
  wrote a `durationMs` of -3600000 into the artifact,
  which the two-lane reader refuses.

Fixed (`8204394fc`):
every difference between two readings in one process reads `monotonicMs` (`monotonic-clock.ts`),
which is `Math.floor(performance.now())`.
Node reads `performance.now` through `uv_hrtime` (`src/node_perf.cc` in v26.10.0),
which on Linux reads `CLOCK_MONOTONIC` (libuv `src/unix/linux.c`);
clock_gettime(2) says that clock is unaffected by jumps in the system time and does not count suspend,
and libuv's timers already run on a monotonic loop clock.
Floored,
every printed and stored duration stays a whole number of milliseconds,
the form the slice-cost reader and the artifact require.
Converted:
the stream idle guard,
the slice-cost log and reader,
the stage round's three marks,
the repair benchmark's run budget,
the corpus pass's soft budget,
stop-before-next check and closing line,
the pass entry and its decline line,
the sentinel probe,
and the default clocks of the provider router,
the provider budget and the request pace,
which the two hold modules' examples name too.
Two behaviours changed beyond the clock:
the pacer sleeps again for what is left whenever a sleep ends before its reserved start,
and the budget's stamp for a view never read is negative infinity rather than zero.
The first is also the likely cause of the request pace's real-clock case
falling short of its 19 ms bound at 18.89 and 18.99 ms (recorded with B73):
a take now returns only once a floored reading has passed its reserved start,
more than 19 ms after the case's own first reading,
an inference from the code,
since the short reads were never reproduced on demand.
`e2b0962fd` added to that stamp's TSDoc the second way zero fails on this clock,
which a guard-off found.
Docs that said "wall time" for these durations say time,
read on `monotonicMs`,
and tests that measured elapsed time with `Date.now` read `performance.now`.

Kept on the system clock,
since each outlives the process that wrote it:
ISO stamps (`new Date().toISOString()`),
the runs lock,
the lookup caches' `fetchedAt`,
`wallClock()` in `corpus-run/pass-outside-reads.ts`,
and `LAUNCH_STAMP`.
`corpus-run/run-timing-read.ts` takes its durations between the logger's stamps,
which are all a stored log keeps,
so a run during which the clock was set still reads wrong there.

Calls made here are open to veto:

- every duration inside one process is read on `monotonicMs`,
  the soft budget and the repair budget among them,
  so both now count only time the machine is awake,
  as the hard cap's timer already did;
- readings are floored to whole milliseconds rather than kept fractional,
  so no log or artifact format changes;
- the pacer sleeps again until its reserved start rather than trusting a timer's early end;
- the budget's never-read stamp is negative infinity rather than zero or an absent value;
- the scan reads tests as well as source,
  with the stub and its own test the two files it skips;
- docs keep "wall clock" for the system clock,
  while idiomatic speed phrases and the file name `where-a-round-spends-its-wall-clock.md` stay.

Guard-offs on the fixed tree,
each restored with `git diff` printing nothing after:

- `monotonicMs` reading `Date.now`:
  the first run hung `request-pace.unit.test.ts` after its FAIL line (ledger M100);
  after the stub was scoped to its case (`b1604a2f8`),
  all eight files exited 1,
  each failing only its B78 case,
  with the red values
  (1790809200000,
  3660000,
  -3600000,
  `'ms -3600000'`,
  7200000,
  3600300,
  `[ 'error', 'skipped' ]` and -3600000);
- the pacer's loop cut to one sleep:
  the sleeps-again case failed (1059999 for 1060000);
- the budget stamp's exact revert,
  zero plus the check reading zero as never:
  only the reads-once case failed,
  with two reads of each meter;
  zero without that check failed nine of the file's cases,
  since on this clock zero is the process's start
  and every call in the first freshness window took the pre-read view as fresh;
- the scan with `Temporal.Now` unrecognised:
  its fixture case failed;
- the stub replacing `Date.now` for the whole process:
  ledger M100.

The full suite on `3a6f92f13`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,500 PASS lines and no FAIL line.

Out of the scan's reach,
and named in its module note:
`Date`,
`performance` or `Temporal` reached through `globalThis` or another name,
a date compared with `<` or `>`,
and a duration taken between stamps a process wrote.
TSDoc examples are comments,
which the scan does not read,
and were fixed by hand.

Recurrence:
a difference of two readings in one process reads `monotonicMs`,
and the system clock is read only as a stamp;
`wall-clock-reads.unit.test.ts`,
which `source-scans` runs,
fails on `Date.now` called,
handed on or destructured,
`getTime` or `valueOf` called,
a unary plus or `Number` on a date,
`performance.timeOrigin` and `Temporal.Now`,
in source and tests alike.

### B79: tests that wrote a process global while module-test ran other cases beside them

Found by the census M100 queued.
module-test runs a suite's children sixteen at a time unless a suite says otherwise
(`package/module/test/src/describe.ts`),
so a case that sets an environment variable,
diverts `console.log` or moves the working directory across an await
shares that value with every case running beside it,
and each restore puts back what it found,
which can be a sibling's value when cases finish out of order.
29 test files wrote a process global
(assignments,
deletes,
and `Reflect` or `Object` writes,
one of them split over two lines).
Read file by file,
16 already ran every writing case in a suite run one at a time,
several with a comment giving this reason;
the other 13,
which the scan committed red (`b9edc1542`) listed as 134 findings,
fell into these groups:

- three where restores finishing out of order could leave a sibling's value set:
  `candidate-ledger` and `run-config`'s `resolveRunsDir` suite on the runs directory,
  and `artifact-pool-conflict` on the pool variables,
  one of its cases setting them only after an await;
  `recordContest`,
  `resolveRunsDir` and `resolvePool` read their variable before their first await,
  so each case read its own value,
  and no later suite in those files reads the variable,
  so no assertion failed on it;
- `run-config`'s `readHeadSha` suite moved the working directory with `process.chdir` across an await while its sibling ran,
  which passed only because `readHeadSha` does not depend on the working directory,
  the very thing the moving case checks;
- `bench-report` never put the runs directory back nor removed its `mkdtemp` directory,
  harmless only because its case is the file's one;
- seven whose writes sit in windows with no await between setting and restoring,
  or in the only case of their suite:
  `transient-retry`,
  `artifact-pool-names`,
  `bench-report-groups`,
  `corpus-pin-override`,
  `pass-generation-guard`,
  `probe-telemetry-report` and `spend-ceiling`,
  safe as written and one await away from not being;
- `artifact-placement`,
  whose captures chain to each other and filter by file name,
  built for cases running at once;
  a restore out of order left a closed wrapper forwarding to the real reporter;
- `writer-grace-override`,
  whose two clearers sat in a table that nothing calls by name,
  so no reading of the text could follow them to a case.

`bench-sample-draw` sets `PATH` only in the text of a program a child process runs,
which is not this process,
and the scan reads it as text.

Fixed (`cf17f1dd0`):
every suite whose cases write a process global runs at `concurrency: 1`,
with a comment naming the global;
`bench-report`'s case restores the variable and removes its directory when it ends;
`clearDial` holds one static delete per dial in an `if` chain
(the lint configuration bans `switch`),
which also retires a `Record` keyed by text;
and `artifact-placement`'s capture no longer claims its suite runs cases at once.

The scan,
`global-writes-sequenced.unit.test.ts`,
reads every test and test fixture for an assignment or `delete` on a member chain off
`process`,
`console`,
`globalThis`,
`Date`,
`Math`,
`performance`,
`Intl`,
`JSON` or `crypto`;
`Reflect.deleteProperty`,
`Reflect.set`,
`Reflect.defineProperty`,
`Object.defineProperty` and `Object.assign` with such a first argument;
and `process.chdir` or `process.umask` with an argument.
It places a write in a function declared by name at every call of that name,
followed out to a fixpoint,
and a write in a method or callback where that function is made;
a write passes only in a case whose every enclosing suite,
out to the one awaited at the file's top,
runs at concurrency 1,
written there or inherited.
A write outside any case,
in a function no call by name reaches,
or in a suite not awaited at the top is reported.
A stub through the case's own sandbox (`ctx.sinon`) is no write form,
since module-test scopes it to the case.

Calls made here are open to veto:

- every writing case is sequenced,
  the seven safe today among them,
  so the rule reads off the text and still holds when an await is added;
- a suite sequenced inside one that is not counts as running beside others,
  since its parent dispatches it with its siblings;
- a writer no call by name reaches is reported rather than passed;
- console captures stay as they are in sequenced suites
  rather than moving to `ctx.sinon` stubs,
  which would scope them by construction
  but rewrite capture helpers that work,
  where sequencing is the package's own answer in 16 files already;
- no red case per file:
  whether a restore leaves a sibling's value depends on the order cases finish,
  so a check of the variable after the suite could pass by luck,
  and the scan's package case is the deterministic red.

Guard-offs on the fixed tree,
each restored with `git diff` printing nothing after:
`readHeadSha`'s suite back at concurrency 16 failed the package case with exactly its two `process.chdir` writes;
`Reflect.set` dropped from the write calls,
following no caller of a named helper,
and reading only the innermost suite
each failed the fixture case
(the `Reflect.set` finding missing,
then the write a helper chain reaches,
then the write in a sequenced suite inside a concurrent one,
12 findings for 13).

The full suite on `99cf575d7`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,501 PASS lines and no FAIL line.

Out of the scan's reach,
and named in its module note:
a write through an alias (`const env = process.env`),
a global shadowed by a local of the same name,
and a case made by a function the suite's text only calls.
Package source is not read:
production code that writes a process global is a different question,
and none was looked for here.

Recurrence:
a case that writes a process global runs in a suite run one at a time,
out to the top of its file,
or replaces a method through its own sandbox;
`global-writes-sequenced.unit.test.ts`,
which `source-scans` runs,
fails on any other.

### B80: archive revisions checked one at a time and composed into one page

Found by T8's eighteenth batch,
which left it open.
`repairArchiveBlocks` (`corpus-run/archive-block-repair.ts`) reviews each unclaimed archive block,
latest first,
and splices every revision it accepts into one page,
but it handed each review the archive as it came,
so the footnote check on a revision (`revisionFootnoteFindings`,
the class eighty-four floor) never saw the revisions beside it.
The check's own comment calls a footnote a relation between blocks.
Two blocks each carrying the one marker of a note,
each revised to drop it,
passed alone,
since the other block's marker still referenced the note,
and together shipped the note with nothing referencing it;
the page guard downstream reads the reviewed page as its archive,
so it inherits the defect rather than finding it.
The red case (`ffe8132b1`) asserted both premises,
each revision alone leaving the note referenced,
and the page shipped both revisions with no refusal logged.

Fixed (`5faa6f689`):
each block's review now takes the page the revisions already applied leave,
and since later blocks go first,
the block under review stands in it at its archive offsets.
The reviewers' context,
the quote style a revision is restored to
and the footnote check all read that page.
`introducedFootnoteFindings` counts defects by kind,
convention and identifier,
so a revision passes only into a page whose defects are a sub-multiset of the page before it,
and the reviewed page carries none the archive lacked.
In the red case the later block's revision stands
and each revision of the earlier block is refused.
The refusal now says the revision "gives the page a footnote defect it does not carry as it stands",
and its tail says the defect's "other end" stands outside the block,
since the end outside may be a note rather than a marker.
The block-outside refusal now says "not in the page it is reviewed in".

No stored reply moves with the changed prompts:
preparation caches only its pairing,
section-pairing and page-title rounds,
each keyed by its full content (`corpus-run/pass-prepare.ts`),
and nothing under `src` keys an archive review reply.
The other callers of `introducedFootnoteFindings`
(`assembly-integrity.ts`,
`assembly-structural-withdrawal.ts`,
`corpus-run/page-footnote-integrity.ts`)
each read a whole spliced page,
so the archive review was the one reading a part.

A correction on the way.
The red case first expected one refusal from every roster seat,
but the gather asks a window of quorum plus one seats
(`stage-quorum.ts`,
`fanOut`),
and three of the four were asked,
so the case would have failed with the fix in place.
It now records the seats asked about the earlier block and expects one refusal from each.
Before the red case,
`308bbe206` wrapped the file's two awaited suites in one root suite,
so a failing case in the first no longer keeps the second from running.

Guard-off on the fixed tree:
the review handed the archive as it came again failed the new case alone in its file,
and `git diff` printed nothing after the restore.
The full suite on `5695cd5be`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,506 PASS lines and no FAIL line.

Calls made here are open to veto:

- the quote style a revision is restored to follows the page as it will ship,
  not the archive as written;
  the two differ only where an earlier accepted revision removed the archive's only quotes of a style;
- where two blocks' revisions conflict,
  the later block's stands,
  since it is reviewed first;
  a pair that is sound only together,
  such as a note and its only marker both removed,
  stays refusable as before,
  each half refused for the defect it alone would leave;
- the reviewers see the page as revised so far,
  which is the page their block would join.

Recurrence:
a check guarding a relation between parts of a composed text
reads each part's change in the text the changes already accepted leave;
`mistake-prevention.md`,
"Checks on one part of a composed text".

### B81: an apparatus check that vouched for a block on one of its lines

Found by T8's eighteenth batch,
which left it open.
`isVerifiableEditorialArchiveBlock` (`archive-block-evidence.ts`) corroborates a reviewer's claim
that an unclaimed archive block is translation-side apparatus:
a contributor line,
a citation,
a picture,
a comment.
It accepted a block when any line declared contributors,
or when the block opened with a label,
a picture
or a comment it closed somewhere,
so prose beside the apparatus passed with it;
and it matched the "translated by" and "translation by" labels as raw prefixes,
so "Translation byproducts" passed as a label (the B23 family).

Measured first,
as the batch asked
(`b81-editorial-census.mjs` in the audit's scratch folder,
which prints entry ids,
block indices,
counts and masked shapes only):
over the 92 pinned archives' 2,446 top-level blocks,
the check accepted 40,
38 by a contributor line and 2 bare `Translation:` labels,
39 of them a single line,
and none carried anything outside its apparatus.
So the loose arms reached nothing in the pinned corpus.
Its verdict also never changes the text that ships
(inference from `archive-block-review-stage.ts`):
it decides whether an "editorial-context" retention counts as an anchored voice,
which moves the block's record between unresolved and retained after a naturalness review,
and whether that review is bought;
revisions come only from "revise" voices,
and a block either way stands as the archive wrote it.
The tightening is the check meaning what its TSDoc says,
"narrow",
for any later pin and for the record each block keeps.

The red case (`060fb6bf4`) holds six blocks the check should refuse and five it should keep;
a probe over the build (`b81-red-probe.mjs`) read all six as accepted.
`d6d72cbcf` first moved the contributor reader's line logic into `contributorDeclarationLines`,
so the check and the reader of declared names read the same lines,
with a test of its own;
exporting it took `pipeline-barrel.ts` over its line budget,
and the identity exports moved to `identity-barrel.ts`.
Fixed (`3a1577c42`):
with the block's comments blanked (`maskHtmlComments`;
one left open refuses the block),
each line a reader sees must be a declaring line,
a line opening with a label at word edges,
or a line Markdown reads as pictures and nothing else visible;
closed comments alone are still apparatus.
The fix first bounded the label's end with a test of its own,
against "Words inside words",
which sends a phrase looked for in prose through `word-bounds.ts`;
`382763ca5` reads it with `wordStarts` instead.
On both forms the census accepted the same 40 blocks
(a diff of each id list against the one taken before the fix printed nothing).

What a label line says after its label is not read,
and the TSDoc says so:
whether `Translator: Mittens. The cat won an award` names a person or tells of one is the reviewers' to judge,
and a structural reading cannot tell a sentence break from "Ms." without guessing;
among the blocks the check accepted,
no label line outside the contributor lines carries text after its label.

Guard-offs on the fixed tree,
one per build,
each read with the stage test file and the build probe,
each restored with `git diff` printing nothing after:
the label's end left open failed the longer-word block alone,
on the first form and again on `382763ca5`'s;
the picture line's "nothing besides" off failed the picture-then-prose block alone;
every line turned into any line failed the three multi-line prose blocks;
the open-comment refusal off failed the earlier case's open comment;
comment-only acceptance off failed the comment-only blocks in both cases;
and the reader's continuation off failed the continuation cases in the reader's tests and the check's.
The full suite on `3788e8223`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,508 PASS lines and no FAIL line.

Calls made here are open to veto:

- the check is tightened though the pinned corpus reaches none of its loose arms,
  since its contract says narrow and a later pin could reach them;
- the label line's tail is left to the reviewers rather than to a sentence heuristic;
- `rendersAsNothing` decides a line a reader sees,
  so a line of invisible characters asks nothing of the block.

Recurrence:
a check that vouches for a whole block reads every part a reader sees,
never one part or the block's edges;
`mistake-prevention.md`,
"Checks that vouch for a whole block".

### B82: timing readers that read less than their writers write

Found by T8's nineteenth batch,
whose red commit `71f7720a9` cases all four,
and fixed in `43e444768`.
The run timing readers (`corpus-run/run-timing-parse.ts` and `corpus-run/run-timing-read.ts`)
read back the round and completion lines a run logs,
and `run-timing-report` prints what they read.

- A round whose quorum never stood read as a line about something else.
  `runGatherRound` (`stage-round.ts`) writes such a round as
  `<stage> round: h/n heard, Tms total, no quorum (h of k needed), every ask settled`,
  and the reader knew only the line that ends in grace,
  so the report left the round out of its count,
  its total time
  and its voices never heard.
  `readRoundTiming` now reads both shapes into a `quorum` that either `stood`
  (time to quorum and time in grace)
  or was `never` reached
  (the count needed),
  and refuses a no-quorum field whose heard count is not the ratio's.
  `summariseRounds` folds every round into the report's figures
  and sums grace only where quorum stood.
- A round line short of its four fields was refused as a field that "carries no ms unit",
  naming a unit where a whole field was missing.
  It is now refused by its field count against the four its writer writes.
- A completion line whose first field is not `<label>: <outcome>` read with an empty outcome.
  `reportStreamProgress` always writes `stream <label>: <outcome>`,
  so such a line is now refused as an unreadable completion line.
- `measureInFlight` divided by a zero span as if it held calls:
  timed calls that all took no time at one instant
  reported every call in flight on average
  while the sweep,
  which takes an end ahead of a start at one instant,
  counted a peak of none.
  A zero span is now refused with `NothingInFlightError`,
  as an empty call list already was,
  and the report says which empty span the calls left.

The refusals are named classes:
`TimingFieldError` for a field,
`TimingLineError` wrapping it for a line,
`NothingInFlightError` for an empty span.
`NothingInFlightError` carries the forwarding marker,
since both its sentences are fixed;
`TimingLineError` is on the message scan's withheld list,
because it quotes the whole line it could not read.

Running the built report on a throwaway log
(both round shapes and two calls of no duration at one instant)
printed the no-quorum round in every figure
and found one more defect:
the in-flight refusal followed its heading after a period,
so the refusal's lower-case sentence read as a broken one.
`8175dc866` joins them with a colon
and brings the corpus-pass runbook's quoted output to the report.

Guards shown to fail:
the four red cases failed in `71f7720a9` against the code before the fix;
with the heard-count agreement check disabled,
the case naming what a round line contradicts failed alone in its file;
with no-quorum rounds left out of the fold,
the `summariseRounds` case failed alone in its file.

Calls made here are open to veto:

- a round is one of two kinds rather than one shape with optional fields,
  so no reader can take a no-quorum round's missing grace for a zero;
- the refusals are named classes rather than plain errors;
- a zero span is refused rather than reported as a mean of zero;
- a completion line missing its outcome is refused rather than read as an empty outcome;
- the report prints no grace share where the rounds took no time,
  since a NaN percentage reads as a measurement.

Open:
the fixture lines are copies of the writers' templates,
so a case that builds each line through `stage-round.ts` and `reportStreamProgress` themselves
would catch a new shape the copies miss.

Landed 2026-10-02 (UTC):
`runGatherRound`'s line is built by `roundLine` (`stage-round-line.ts`),
which its own unit test pins for a round whose quorum stood and one whose quorum never did,
and the run-timing fixtures build every line the current writers still produce through `roundLine` and `reportStreamProgress`.
Their tag prefix is the chain a real corpus pass logs,
traced from `corpus-run/pass-lanes.ts` to the round;
the replaced fixtures carried an `[editor]` tag no caller writes.
The one line still typed by hand is the pre-timing completion shape,
which `reportStreamProgress` can no longer produce.

Recurrence:
a reader of a log line the package itself writes
reads every shape that writer writes,
and is tested against lines built the way the writer builds them;
`mistake-prevention.md`,
"Readers of the package's own log lines".
