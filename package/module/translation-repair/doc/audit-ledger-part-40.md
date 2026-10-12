# Audit ledger, part 40

Part 40 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B291: each test that started a child built the child's environment itself, and several passed the keys on

Scan red in `a67f453cb`,
fixed in `cebfcc122`.

Found on 2026-10-06 (UTC),
after a fixture merged with a coverage cluster was found to start a child
with the parent's environment whole (M121).
The owner's rule is that keys come from the task runner and no child of a test inherits them.
Nothing held it:
each test file that started a child built the child's environment itself,
or passed none.
`nano-spawn` merges the `env` it is given into the parent's environment
(the lead's reading of its type definitions,
stated in the agent's brief),
so leaving a variable out of that object removes nothing.
No child of any of these files calls a provider,
so no key was used or shown.

The fix:
`src/child-environment.test-fixture.ts` is the one place a test may start a child.
It hands the child the test process's environment with every variable whose name ends in `_API_KEY` removed,
and every variable whose name starts `TRANSLATION_REPAIR_` too,
then the variables the case names
(`environmentWithoutKeys`,
`spawnKeyless` over `nano-spawn`,
`runKeyless` over node's own `spawn`,
`runBuiltCommand` for a built command).
A removed name is stated as `undefined`,
which the merge inside `nano-spawn` and node's `spawn` both read as absent.
Its test file starts real children that print the names they see,
with a control case that hands a child a key-named variable and sees it arrive.

`src/test-children-keyless.unit.test.ts` reads every test file and fixture but that one.
It fails on an import of a spawning module
(`nano-spawn`,
`node:child_process`,
`execa`,
`cross-spawn`) under any form,
and on a call of a spawning function.
It joined the `source-scans` task,
which ran 41 files from then.
Its package case failed with 54 findings in 27 files,
an import and a call in each.
Of the 27,
five are the keyless fixtures of the runner clusters merged since the agent's base,
where the agent counted 44 findings in 22 files.

Every child of the 27 files goes through the fixture.
`git` in a throwaway repository runs through `spawnKeyless`,
node on a script or a built command through `runKeyless`,
and built commands through `runBuiltCommand`.
Three files passed more than the rule allows,
by the agent's reading:
`verify-published.unit.test.ts` spread the parent's environment into its child,
keys included;
`fidelity-reference-cli` blanked the keys it knew of and let the rest through;
and `editor-standing-read.unit.test.ts` wrote the runs directory into the parent's own environment,
for its child to inherit.
That file hands the directory to the child by name,
so its helper `runsDirPointedAt`,
the two inventory lines of `duplicate-bodies` that named it and the suite's `concurrency: 1` are gone.
The five fixtures of the runner clusters are the lead's edits:
three keep their exported names and call `runBuiltCommand`,
one calls `runKeyless`,
and one runs git through `spawnKeyless`.

Measured by the lead on the red tree:
the new scan alone fails with the 54 findings and its own fixture case passes;
the fixture's test file passes;
and the `source-scans` task prints 41 pass lines and fails on that one case alone.
Measured by the lead on the fix tree,
with the two red test files of `3c74be74a` also in it:
the whole unit suite prints 1,823 pass lines and 10 fail lines,
every one of the 10 in those two files (M125);
the `source-scans` task prints 41 pass lines and no fail line;
and lint ends with no warning and no error.
The agent could not run `bench-sample-draw.unit.test.ts` in its worktree,
where the git policy shim was not built;
it runs in the whole suite.
The whole suite ran on `040656c51` in a side checkout,
which holds the fixes of B291 to B293:
1,823 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open:
production code starts children that inherit the parent's environment whole
(`git` from `corpus-source.ts`,
`artifact-generation.ts`,
`coverage-census-commit.ts`,
`cache-account-git.ts` and `run-config.ts`;
the image readers of `image-ocr.ts`;
and the coverage census,
which runs the unit suite as a child).
None calls a provider.
A follow-up for these was not merged at `f8e99b84d`.
One name for the three fixtures that only rename `runBuiltCommand` waits for the last runner cluster.
Both closed since:
the children in `4049d9eb2` (B314),
and the wrapper fixtures folded into `runBuiltCommand` in `3d36ba7b9` (B319).

Open to the owner's veto:
removing every `TRANSLATION_REPAIR_` variable and not the keys alone;
a case's own variable winning over the removal,
so a case can hand a child a key-named variable on purpose;
`runKeyless` reporting a signalled child as code -1;
no standard input for `runBuiltCommand`;
and the node child of `bench-sample-draw` inheriting the environment less keys and settings,
with `HOME` set by the case,
where it was given `PATH` and `HOME` alone.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B292: a request rate with a fraction made the pace wait a whole window

Red in `3c74be74a`,
fixed in `040656c51`.

Found on 2026-10-06 (UTC) by a coverage agent of T8,
whose probe of a fallback in `request-pace.ts` the follow-up's brief names,
and fixed by that follow-up.
`hyperRequestsPerHour` read any plain decimal of `TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR` as a rate.
A fraction made the pace read its list of starts at a fractional position,
miss,
and wait a whole window.
With starts at 0 and 600 ms in a window of 1,000 ms,
a pace of 1.5 places read a wait of 1,000 ms at 700 ms where two places read 300
(the agent's probe,
not rerun by the lead).

The fix:
`hyperRequestsPerHour` refuses a value that is not a whole number of one or more written in digits,
as a stated refusal naming the variable,
the value as written and what is accepted.
`createRequestPace` throws a `RangeError` for a count of places that is not a whole number of one or more,
so a pace built by hand cannot reach that read either.
The mode that paced nothing for a count of zero or less goes with it;
no production caller used it,
and its cases are removed.
The two fallbacks on the list of starts are `nonNullishOrThrow` reads:
the first sits behind a length check,
and the second's index is in range for a whole count.
The red cases build a pace with 1.5,
0,
-1,
`NaN`,
`Infinity` and 2 to the 60th,
and set the variable to `1.5` and `0.5`.

With it,
no defect:
`sleepBackoff` (`transient-retry.ts`) rethrew whatever its timer rejected with when the caller had not aborted.
By the agent's reading of the runtime's own `timers/promises` source and its probe on Node 26.10.0,
a timer given a number and an abort signal rejects only when that signal aborts,
so no input reaches the rethrow.
It is an `unreachable:` throw that keeps the rejection as its cause.

`doc/configuration.md` said a bad value of the variable was not refused and silently left the default,
which the code had already stopped doing,
by the agent's reading of the ledger;
it says what is refused,
and `doc/seats-and-calibration.md` says the rate is a whole number
(both the lead's edits,
in `040656c51`).

Measured by the lead on the red tree for B292 and B293:
the whole unit suite prints 1,823 pass lines and 10 fail lines,
every one of the 10 in the two red files
(two cases of `request-pace` and four of `stream-drain`,
with the lines of the suites that hold them),
each by assertion.
The whole suite's run on `040656c51` is recorded in B291.

Open to the owner's veto:
removing the mode that paced nothing;
the wording of the refusals and of the `unreachable:` throws.

Recurrence:
`mistake-prevention.md`,
"Numbers read back from text".

### B293: the stream drain's opening line was never read by the credential mask

Red in `3c74be74a`,
fixed in `040656c51`.

Found on 2026-10-06 (UTC) as the path B266 left open.
`drainBody` logs an opening excerpt of the generated text,
and the upstream's name,
through a line the credential mask of the transport never read.
An endpoint that echoed the key it was sent would have put the key in the log.
No such echo was seen;
the cases use a fixture's invented key,
never one from the environment.

The fix:
`drainBody` takes the request's credentials,
which `fetchTransport` already holds and passes.
The whole assembled opening text is masked before the excerpt is cut from it,
so a key split across chunks or frames is masked whole.
A stream torn down inside a key holds no whole copy,
so `maskCredentialsInCutText` (`credential-mask.ts`) also masks an ending of four units or more
that is the opening of a credential.
The upstream's name is masked too.
`stream-cut.ts`,
which writes the line,
is unchanged.
Four red cases expect a sent credential masked:
echoed whole in the first content;
arriving in two chunks or two frames;
cut inside the key,
where no head of it may show;
and in the gateway's name field.
A fifth case,
a stream that never echoes the key,
pins the line as it was and passes before and after.
`credential-mask.unit.test.ts` gains three cases for the new function.

The lead's edit:
`drainBody` requires its `credentials` argument,
where the agent gave it a default of none.
A default would let a later caller start a drain that masks nothing without saying so.
The transport is the one production caller and names its list,
and each test call that carries none says `credentials: []`.
With the argument made required,
the suite and the scans each failed on one case alone,
the TSDoc example scan naming the example of `drainBody` that lacked the key;
with the key in the example that scan passes run alone,
and nothing but that one comment line changed after the last whole run on the lead's tree.

The agent's measurements,
not rerun by the lead:
over a stream of one megabyte the masked and unmasked drains differ by less than the spread between runs
(25 runs each after a warm-up),
with about 5 ms more at the median where one frame carries the whole megabyte.
The whole suite's run on `040656c51` is recorded in B291.

Open to the owner's veto:
four units as the shortest head masked at a cut,
which leaves the first three units of a key to show there
and masks an excerpt's ending that happens to match a key's head;
the credentials as a parameter of `drainBody`,
where masking inside `stream-cut.ts` is the alternative;
and masking the upstream's name.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
every line that carries a provider's text is read by the mask before it is cut.

### B294: `translate-probe` without a key reported three failed slices and exited 0

Red in `7d2ca2604`,
fixed in `da8a963cc`.

Found on 2026-10-06 (UTC) while moving five probe runners into modules a test can load (T8).
`translate-probe` built its client inside the `try` that reports one slice as failed.
With no provider key,
the stated refusal printed as `SLICE FAILED: RunConfigError: ...` once for each of three slices,
and the command ended at exit 0 having asked nobody.

The fix:
the client is built before the `try`.
A refusal to build one stops the command,
exit 6,
and a failure inside the gather is still reported for its slice.

Two more in the same commit,
each cased red first by the agent in its worktree:
`translate-probe` printed `probing the first 3` whatever the count of slices was,
and prints the smaller of the count and three;
and B308 records the count of `coverage-probe`.
With them,
no defect:
`displacement-probe` answered `false` without a word
where a relocation candidate named a slice its slicing did not hold,
in the two filters that count transcription suspects and markup donors.
No input builds that state,
so it is an `unreachable:` throw naming the slice and the slice count,
and no case drives it.

Measured by the lead on the red tree:
four of the five as-built test files pass against the unmoved commands,
and `translate-probe` fails in that one case by assertion,
exit 0 where 6 is expected.
The agent's measurement,
not rerun by the lead:
a census over its 20 test files lists none of the five bundles among those no test loaded,
and no cold stretch in the entry files or new modules beyond the one throw.
The whole suite ran on `da8a963cc` in a side checkout:
1,858 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
to rule on:
`coverage-control-probe` refuses the whole run where an entry lacks a page,
and `coverage-probe` skips such an entry as an ordinary state of the corpus.

Open to the owner's veto:
the client built before the `try` for one slice,
where rethrowing a stated refusal from the catch is the alternative,
which would also stop a slice whose gather refused;
`probing the first 1` and `probing the first 2` in the existing form of the line;
the stamps of the log lines of `displacement-probe` read as `<time>` in its as-built cases,
where pinning them wants a clock handed to the logger.

Recurrence:
`mistake-prevention.md`,
"What a catch charges":
a catch that charges one unit of work does not also hold the setup every unit shares.

### B295: two listing readers parsed a provider's reply before any mask read it

Red in `17a66fa66`,
fixed in `097b6ac40`,
whose masking cases the agent ran red in its worktree.

Found on 2026-10-06 (UTC) while moving six sampler and card runners into modules (T8),
as a path B266 left.
`model-catalog` and `roster-card` read a provider's listing with `reply.json()`
and never passed its text through the credential mask.
A reply that echoed the key would have been parsed,
and a catalog id carrying it printed.
No such echo was seen;
the cases use an invented key.

The fix:
both read through `readProviderListing`,
which masks the text before it is parsed,
whatever transport it is handed.

The agent's account,
not rerun by the lead:
its masking cases failed before the mask was written;
it did not take the mask out again afterwards to see them fail a second time.
The whole suite ran on `097b6ac40` in a side checkout,
which holds the fixes of B295 to B298:
1,886 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open to the owner's veto:
a limit of 60 seconds on a listing read,
where there was none;
the mask in `readProviderListing` on top of the transport's own;
listing reads through `fetchTransport` in place of the global `fetch`;
a listing status read as 200 to 299.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
a reply is masked as text before anything parses it.

### B296: the samplers' and cards' refusals reached the operator as faults

Red in `17a66fa66` for the two draws,
fixed in `097b6ac40`,
with the listing cases run red by the agent in its worktree.

Found by the move B295 records.
Each of these ended at exit 5:

- a listing body that was not JSON,
  or a catalog listing of the wrong shape,
  with a stack;
- `draw-sample` and `damage-sample` over a runs directory with no `artifacts` directory;
- a final draw whose sample carries no recorded repair,
  which refused in clear words but as a fault.

The fix:
each is a stated refusal,
exit 6.
The listing refusals name the URL and quote neither the body nor the parse failure.
`listSettledNames` names the directory and the variable that sets it.
`UnmeasurableRepairError` (`sample-grading.ts`) extends `StatedRefusalError`,
the lead's choice of the two ways the agent set out,
so the draw calls `assertRepairMeasurable` with no catch around it.

Measured by the lead on the red tree for B296 and B297:
four of the six as-built test files pass against the unmoved commands,
and `draw-sample` and `damage-sample` fail in two cases each by assertion,
exit 5 or 0 where 6 is expected.
The agent's measurement,
not rerun by the lead:
a census over its 35 test files lists none of the six bundles among those no test loaded
and no cold stretch in the new modules;
two entry files each keep one cold character,
the continuation after an awaited call that a keyless run refuses before it returns
(`model-health.ts`,
`damage-sample.ts`).
The whole suite's run on `097b6ac40` is recorded in B295.

Open,
to rule on:
`resolvePool` (`artifact-pool.ts`) reads the environment and prints through `console.log` itself,
and `loadEntry` (`draw-entry-load.ts`) takes a reader but reads the run's corpus pin itself.

Recurrence:
`mistake-prevention.md`,
"Two layers reading one refusal".

### B297: a draw that could not finish left or removed a sheet that blocks the next draw

Red in `17a66fa66` for the empty damage pool,
fixed in `097b6ac40`,
with the other two cased red first by the agent in its worktree.

Found by the move B295 records.

- A final draw over a pool with no accepted issue wrote an empty gate sheet,
  which a final path's exclusive create then protects for ever,
  blocking the real draw.
  It is refused before any file is written.
- A failed final draw removed a file it had not created.
  The tracker recorded a path before its write,
  so a write that found the path taken had another draw's sheet removed.
  The tracker releases a path the exclusive create did not make.
- An empty damage pool wrote a kept,
  empty sheet and manifest and ended at exit 0,
  blocking the next run.
  It is refused before any client opens.

The whole suite's run on `097b6ac40` is recorded in B295.

Recurrence:
`mistake-prevention.md`,
"Files a later run reads back":
a cleanup removes only what its own run created,
and a write that nothing may replace is made only once there is something to write.

### B298: a region no prober answered for was recorded as silent

Fixed in `097b6ac40`,
with its cases,
which the agent ran red in its worktree.

Found by the move B295 records.
`damage-sample` recorded a region no prober answered for as silent,
which is the human grade's negative reference.
A region nobody heard and a region every prober passed read the same on the sheet.

The fix:
such a region is printed as unheard and left off the sheet,
and a run in which no region is heard refuses.
A tally missing after a region was probed is an `unreachable:` throw.
The whole suite's run on `097b6ac40` is recorded in B295.

Open to the owner's veto:
an unheard region left off the sheet and counted in a printed line,
where refusing the whole run at the first one is the alternative;
one client opened for each region of the damage sample,
as before.

Recurrence:
`mistake-prevention.md`,
"Which seats a quorum counts":
no answer is never recorded as an answer.

### B299: `editor-width-probe` over a draw holding no slice bought the control and wrote a report with no row

Tests in `327ea1de0`,
fixed in `77a213478`,
with its case,
which the agent ran red in its worktree.

Found on 2026-10-06 (UTC) while moving `editor-calibrate` and `editor-width-probe` into modules (T8).
`editor-width-probe 1 b` drew one slice,
of which draw B takes none,
then bought the positive control and wrote a report with no row:
a clean finish over no work,
paid for.

The fix:
a draw that holds no slice is a stated refusal before the control,
naming how many slices that draw needs.

The as-built cases are in `327ea1de0` and pass against the unmoved commands and the moved ones:
six for `editor-calibrate` and two for `editor-width-probe`,
every child through the keyless fixture,
over a throwaway repository holding one invented entry.
The whole suite ran on `77a213478` in a side checkout:
1,898 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
seen by the agent and left to rule on:
`editor-calibrate-standing.ts` counts a round whose lone composite candidate has no ballot as judged,
while the shipped table counts it as not unvoted;
and the wording of the reach line,
"the rest carried no paragraph",
which the agent questions.
B307 closes the third thing it saw,
the bare `Error` of `bench-sample.ts`.

Open to the owner's veto:
the stage seams of the width probe (`controlHolds`,
`gather`,
`runSlice`,
`writeReport`) and the draw passed in as functions;
the wording of the empty-draw refusal;
`readOverlap`,
`adoptGrace`,
`readWriterGrace` and `newClient` passed as functions.

Recurrence:
`mistake-prevention.md`,
"Work no floor can check":
state known at the start is checked before anything is bought.

### B300: the two Exa lookups parsed and kept a reply before any mask read it

Red in `251df99c4`,
fixed in `c67279f66`.

Found on 2026-10-06 (UTC) among the paths the agent of B266 listed as not reached
(its list,
in the lead's notes).
`searchWorkTitle` (`work-title-search.ts`) and `fetchCitedReference` (`cited-reference-fetch.ts`)
send the Exa key in an `x-api-key` header and read the answer with `response.json()`.
Neither passed the answer's text through the credential mask,
and neither goes through the transport that masks for the chat clients,
since each takes the `fetch` it is handed,
and a pass hands them the global `fetch` (`corpus-run/pass-outside-reads.ts`).
What they read is kept:
a hit's title,
address and highlight,
and a fetched page's title and text,
go into a sheet a model reads and into the lookup and reference caches on disk.
An endpoint that echoed the key it was sent would have put the key in all three places.
No such echo was seen;
the cases use an invented key from a fixture.

The fix:
both read their reply through `readMaskedJsonBody` (`masked-json-body.ts`).
The body's text is taken once,
every credential the request's headers carried is masked out of it
(`credentialsOfHeaders`,
`maskCredentials`,
the pair the transport uses),
and only then is it parsed.
A parse failure's message,
which quotes the text it refused,
quotes the masked text.
Each lookup builds its headers once and hands the same object to the request and to the read,
so the read cannot mask a different key from the one that was sent.
`masked-json-body.unit.test.ts` holds four cases.

Measured by the lead on the red tree:
`work-title-lookup.unit.test.ts` and `cited-reference-fetch.unit.test.ts` each fail in the one new case,
by `AssertionError`,
and in no other.
On the lead's fix tree the whole unit suite printed 1,899 pass lines and 2 fail lines,
both for one case this change does not touch:
`displacement-probe as built`,
"REFUSES as stated and exits 6 when an artifact names a commit the clone lacks"
(the case and its suite).
Its file,
rerun alone on the same build,
printed one pass line and no fail line.
The whole suite then ran on `c67279f66` in a side checkout:
1,899 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open:
that case fails under load.
The lead's reading,
an inference not measured in any commit through `f8e99b84d`:
the probe reads an entry's two pages with `Promise.all` (`corpus-run/settled-carve.ts`),
both reads fail for a commit the clone lacks,
and which page the refusal names is whichever git child ends first.
It failed again in the whole-suite run on `f8e99b84d` (B305),
and its fix is in no commit through that one.
Measured and fixed since,
in `f3c2bae13` (B316).

Open to the owner's veto:
masking at the read and not by handing the lookups the masking transport;
one helper for both lookups.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries",
and for the case that fails under load,
"Output decided by arrival order".

### B301: one reply nested thousands of markers deep ended the translate stage for every voice

Red in `c720721a9`,
fixed in `41d5f9267`.

Found on 2026-10-06 (UTC) by a follow-up to the cost B212 left open.
The Markdown parser descends once per nesting level,
and so does the tree transform it runs on its own output,
so a reply of thousands of nested quotation markers exhausted the stack.
Whether it did depended on how deep the caller already stood
(the agent measured 5,989 quotation markers parsed from a shallow caller and 5,957 through the translate stage),
so one reply could pass in one place and fail in another.
The strict entry turned the overflow into its own refusal,
with the message "at RangeError (RangeError)" and no cause.
The plain entry let the engine's `RangeError` out,
`requireMarkdownRefusal` took any `RangeError` for it,
and two readers of the plain entry had no catch:
the fold that lays a paragraph out as it renders
(`soft-break-fold.ts`,
read by `pageLayout` and two judge sheets)
and the floor that reads a rendering's atoms (`translate-unwrapped-link.ts`).
One voice's reply of 16,000 nested markers left `runTranslateStage`,
by the agent's trace through the first of the two,
and the voices that wrote ordinary renderings lost their work with it.
Other shapes never overflowed and cost minutes:
a link nested in a link,
an image in a link,
a list nested by indentation
(the agent's timings,
in its report).

The fix:

- `nesting-bound.ts` reads a body in one linear pass before any parse,
  against one bound:
  256 levels of the container markers opening a line,
  of a line's indentation,
  of a paragraph's open brackets and,
  under the strict grammar,
  of open tags and open braces;
  and 1,024 emphasis delimiters in a block.
  Fenced code and a line of rule characters are skipped for what they cannot nest.
- Both entries refuse a body past the bound with the refusal their callers already read:
  `MdxParseError`,
  or for plain markdown a new `MarkdownParseError`,
  a `RangeError` by class.
  The message names the measure,
  the bound,
  the line and the column,
  and quotes nothing.
- Both entries catch the engine's stack exhaustion,
  for a shape the lexical measure does not see,
  and raise the same refusal with the exhaustion as its cause.
  Anything else propagates unchanged.
- `requireMarkdownRefusal` reads `MarkdownParseError` alone,
  so another `RangeError` is no longer taken for the grammar's refusal.
- `foldSoftBreaks` returns a refused text as written,
  and the atoms floor reads no atoms from one;
  the floor that reads the candidate's shape refuses the same text with its own finding.

The lead's edits on the agent's work:
the byte order mark the scan drops is written as an escape,
where the agent's source held the invisible character itself;
and `MarkdownParseError` carries no `line` or `column` field,
since nothing read them and they were not adjusted for a leading mark as the strict refusal's are.

Measured by the lead on the red tree:
five test files fail as described and in no other case
(`translate-deep-reply` one case of two,
`wording-key` one,
`unwrapped-link` one,
`translate-validate` one,
`translate-floor-ground` two).
The agent's measurements,
not rerun by the lead:
the lowest overflow over every shape it tried is 2,995 bullet markers from a shallow caller;
the deepest page of the pinned corpus nests 3 container levels,
2 brackets,
2 open tags,
2 open braces and 36 delimiters in a block
(184 pages of 93 entries,
read through the package's own corpus readers);
a parse at the bound takes 8 to 330 ms for every shape measured,
and a body one past it is refused in at most 5 ms;
a scan of `src` for functions that reach themselves found 12,
none over text a model or a page wrote.
Its two cases at the stack's edge prove the catch at one measured edge each,
on one runtime build.
The whole suite ran on `41d5f9267` in a side checkout:
1,909 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and the 41 source scans passing.

Open,
with no fix in any commit through `f8e99b84d`:
callers of `parseDocument` that take text assembled from model output and have no catch
(`consolidation-polish-round.ts`,
`refine-phase.ts`,
`refine-slice-settle.ts`,
`repair-chunk-verdict.ts`,
`assembly-regressions.ts`,
`archive-footnote-order.ts`),
where the agent did not trace whether a floor refuses a deep reply first;
and,
found on the lead's reading,
inline counts are skipped inside what the scan reads as a fence,
and its fence rule is looser than the parser's,
so nested brackets after such a line are not counted.
There the catch still turns an overflow into the refusal,
and the slow bracket shapes are not bounded.

Open to the owner's veto:
the bound's values;
`MarkdownParseError` as a `RangeError`;
a cause on `MdxParseError` for the stack exhaustion alone;
an indented line of 514 or more columns refused;
markers and indentation counted inside a fence;
brackets and delimiters counted inside code spans and addresses;
a refused text folded as written and given no atoms,
where propagating is the alternative.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation":
text one voice wrote is bounded before a parser that descends once per level reads it,
and every reader of that parser has its refusal.
