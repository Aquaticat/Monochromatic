# Audit ledger, part 43

Part 43 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B335: three guards no case can tell from their absence

Changed in `e1c84094e`.

Found by the same cross-check:
`list-spread-restore.ts`,
`fidelity-damage.ts` and `rendering-audit-corroborate.ts` each hold a guard
a case reaches and passes without.
Each is an equivalent mutant,
so no case can be written:
lists pair only at the same item count,
so a gapless list is gapless on both sides of its pair and reads alike either way;
every text includes the empty string,
so the refusal of an empty sentence holds without its line;
and comparing missing bounds is false,
so an unused side intersects nothing without its line,
which the type check needs to reach the bounds at all.
The lead measured the last two in Node.

The fix:
each guard stays,
with a comment at its site saying why no case can separate it.
B178 had recorded that every case of its file passes with the third guard cut out
and deleted the case that named it,
leaving the guard with no word on why it stays.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B336: characters a reader cannot see stood literally in the source

Red in `2339cf5a6`,
fixed in `0b3996534`.

Found on 2026-10-06 (UTC):
M135 had inferred,
without measuring,
that the decoding which wrote agents' literal characters wrote older ones too.
`literal-unseen-characters.unit.test.ts` reads every TypeScript file under `src` code point by code point
and finds each character with the Unicode property `Default_Ignorable_Code_Point` or `White_Space`,
or of the general category `Cc`,
other than space,
tab,
line feed and carriage return,
written as itself rather than as its escape.
Its fixture makes every such character with `String.fromCodePoint`,
so the scan's own file holds none.
On the red tree it found 31 in 9 files:
byte order marks in the `duplicate-bodies` and `nesting-bound` tests;
ideographic spaces in the `parse-document`,
`image-reading-stage-padding` and `trailing-whitespace` tests
and in a set of `translate-address-original.ts`;
no-break and narrow no-break spaces in the `translator-answer-fold` and `corpus-run/emphasis-spans` tests
and in a set of `quote-normalize.ts`;
and a soft hyphen in the `translator-answer-fold` test.
In a test such a character is fixture data no reader of the file can see,
and in production code a member of a set no reader can see.

The fix:
each of the 31 is its `\u` escape,
written at the line and column the scan named by a script that refused any place holding another character.
Every site is a plain string or an untagged template,
the `parse-document` fixture's included,
so each value is the character it was.
The whole suite on `0b3996534`,
run in a side checkout:
2,019 `[PASS]` lines and no `[FAIL]` line,
the lint finding nothing,
and 46 source scans passing.

Recurrence:
`mistake-prevention.md`,
"Escapes and the layer that reads them".

### B337: comments wrote backticks with a backslash before them

Red in `2339cf5a6`,
fixed in `0b3996534`.

Found on 2026-10-06 (UTC):
the twelve lines in five older files M137 recorded.
A comment is Markdown to every reader that renders it,
and Markdown keeps a backslash before a backtick inside a code span or a fenced block,
so a fence written with escaped backticks never opens
and a template literal escaped inside an example shows code that does not compile.
`comment-escaped-backticks.unit.test.ts` reads every comment the parser reports
and finds a backtick with a backslash before it,
unless the run of backslashes it ends has a backtick just before it,
which is a code span holding nothing but backslashes.
On the red tree it found 12 lines in 5 files:
the `artifact-probe-read` test 7,
`house-policy.ts` 2,
`refine-prompt.ts` 1,
the `local-program-failure` test 1
and the `text-accumulators` test 1.
The lead's first draft kept a span of one backslash only,
and so found the span of two in a comment of `credential-views.ts`,
the JSON escape of one backslash,
which renders as written (M138).

The fix:
the 12 lines write their backticks bare:
the test's two example fences open and close,
the TSDoc examples of `house-policy.ts` and `refine-prompt.ts` show code that compiles
(the refine prompt's example had escaped its substitution too),
and the `text-accumulators` test's span,
whose code holds backticks of its own,
is delimited by two backticks.

Recurrence:
`mistake-prevention.md`,
"Escapes and the layer that reads them".

### B338: a failing scan over the package printed how many findings it had and not what they were

Changed in `2339cf5a6`;
issue 610.

Found on 2026-10-06 (UTC):
the first red run of the scans of B336 and B337 printed only
`expected [ …(31) ] to deeply equal []` and `[ …(13) ]`,
and reading the findings took a second run of each file outside the runner.
By the lead's inference,
the 13 are the 12 lines of B337 and the span its scan's first draft flagged.
`@monochromatic-dev/module-test` builds `expect` on chai 6.3.0,
whose `config.truncateThreshold` defaults to 40
(`node_modules/.pnpm/chai@6.3.0/node_modules/chai/index.js:860`)
and is handed to loupe as the length a value is cut to (`index.js:928`);
the test package neither sets it nor exports chai's `config`,
so this package cannot change it.
The same display stands in B70,
quoting a failure of that entry's guard
(`expected [ …(9) ] to deeply equal [ …(8) ]`),
recorded and not acted on (M138).

The change:
`scan-findings.test-fixture.ts` (`expectNoFindings`) fails with every finding on a line of its own
before the comparison runs,
and the two scans fail through it.
Issue 610 records the cause in the test package.

Open:
by the lead's census,
31 of the 43 scans compare a whole list or record,
so each can fail with a count where what differs runs past 40 characters;
four of them
(`dead-test-declarations`,
`silent-test-cases`,
`temp-dirs-scratch` and `trailing-whitespace`)
assert as the two new scans did,
and the red commit says they move onto the fixture in a later commit.
Closed since by B339:
every scan's package-wide comparison goes through a helper that prints what differs,
and a scan holds them there.

Recurrence:
`mistake-prevention.md`,
"What a failing check prints".

### B339: forty-one scans compared what they found through the library, which printed it cut to a count

Red in `be46dce42`,
fixed in `9b028204d`;
issue 610.

Found on 2026-10-06 (UTC),
the item B338 left open.
A guard written for it,
`scan-direct-comparisons.unit.test.ts`,
found 64 comparisons in 41 scans
(62 `toEqual` and 2 `toStrictEqual`,
by the lead's count of its findings on the red tree)
that compared what a walk over the package found with an inventory or with nothing
through the assertion library alone,
which prints any value longer than 40 characters cut to its length.
B338's census by the lead had counted 31 scans.

The fix:
`scan-findings.test-fixture.ts` holds a helper for each shape of comparison,
each throwing with every difference whole on a line of its own
before it makes the scan's own comparison,
so a scan passes and fails on the inputs it did:
`expectNoFindings` for a list that should be empty (46 sites),
`expectFindingsAsListed` for a list against an inventory,
counting copies and printing both lists where only their order differs (12),
and `expectRecordAsListed` for a record,
key by key,
a list under a key diffed entry by entry (6).
`scan-findings.unit.test.ts` asserts each helper's whole failure text;
by the agent's measurement each of five mutants of the helpers fails the case meant for it,
and a finding planted in a scratch file failed four migrated scans of different shapes with its own text.
The guard,
among the source scans,
fails on a case of a scan the `source-scans` task names
that reads the package's files and compares through `toEqual` or `toStrictEqual` on `expect(...)`,
and on a scan none of whose cases reads them.

Open:
issue 610 stands,
since the cut is the library's and the test package neither sets its threshold nor exports it;
and the guard's header names what it cannot reach:
a reader bound to a constant,
a fixture reached through a namespace import,
a comparison inside a function the case calls,
`expect(...).not`
and a case built by a helper.
It reads names,
not scopes,
so a local name that shadows a reader errs toward a finding.

Recurrence:
`mistake-prevention.md`,
"What a failing check prints"
and "Searches and censuses that miss".

### B340: the consolidation driver test's 5,000 ms hang bound outran on a loaded machine

Fixed in `5086b6c6f`.

Found on 2026-10-06 (UTC)
when the gate on `9b028204d` failed one case of the whole suite.
`consolidate-driver.unit.test.ts` bounded each call,
and every drive passing no signal of its own,
by `CALL_TIMEOUT_MS`,
5,000 ms,
and its TSDoc said the bound was never reached because nothing bought a call.
The case "runs two consolidation slices at once at overlap 2,
after a serial positive control ..."
buys calls through `recordingClient`,
and failed with a `TimeoutError` its name never states:
in that run (6.0 s,
the logger's own 5 s sink check timing out just before)
and in another agent's suite run (13.9 s).
The twin memo logged a buy abandoned,
"refused by TimeoutError".
The case passed in every other gate.

The fix:
the bound is 60,000 ms,
as the grace windows of B318 are:
a stop for a hang,
which no case waits for,
since every scripted client answers at once.
The one case of the file that stops a run brings its own controller,
and the TSDoc says what the bound covers and why it is that size.
No run at a bound of 1 ms was made:
the failure already shows the bound on the case's path.

Open:
the same shape,
a real-clock bound of a few seconds over scripted work,
stands at 604 sites in 138 test files
(by the lead's search for `AbortSignal.timeout`,
`perCallTimeoutMs`,
a `TIMEOUT_MS =` declaration
and `timeoutMs:` with a number),
and a census of them waits for the merges in flight:
each is either a stop for a hang,
moved to one documented bound,
or a bound a case means to reach,
kept and gated.
B318 left "a bound of 5,000 ms over about 50 ms of work" not shown to fail;
whether that is this site is not established.
Closed since by B358 in `4cca8c301`.

Recurrence:
`mistake-prevention.md`,
"Tests on the real clock".

### B341: the stream drain's cancel line logged a redirected address unmasked

Red in `de6ff17`,
fixed in `a7eca7f`.

Found on 2026-10-06 (UTC),
the redirected address B329 left open.
`stopReading` (`stream-drain.ts`) logged `response.url` when a cancel failed,
and after a redirect that is the address the redirect named,
its path and query as the provider wrote them.
By the agent's probe with node's `fetch` against a local server,
a `302` to `/landing?key=<key>` left that address whole in `response.url`,
and the cancel line printed the key.
`fetch` refuses a redirect to an address with userinfo,
and no request the package sends carries a key in its address.

The fix:
`stopReading` takes the request's credentials
and logs the address through `maskCredentials`.
The case "MASKS THE CREDENTIAL A REDIRECT LEFT IN THE ADDRESS the failed cancel names"
gives its response the address the probe measured `fetch` leaving.

Recurrence:
`mistake-prevention.md`,
"Messages a marked class carries":
an address a provider chose is reply text,
masked before anything logs it.

### B342: the map-write scan read a typed array's copy as a write over an unread key

The scan changed in `de6ff17`,
and the copy it had forced restored in `a7eca7f`.

Found on 2026-10-06 (UTC),
the scan's misreading B329 left open.
`blind-map-writes.unit.test.ts` listed every two-argument `set` whose function never read the key,
so a typed array's `set(source, offset)`,
which copies a source into the array and writes no key,
read as a map write,
and `credential-views.ts#decodeView` copied its offsets one element at a time to pass the scan.

The fix:
the scan resolves a plainly named receiver through the scopes that hold the write,
nearest first,
and leaves out a write whose nearest declaration makes a typed array
(a constructor,
`from` or `of`)
or annotates one;
a member,
a name a pattern binds without a type,
or a name it cannot follow stays a possible map write.
One fixture case holds each form of typed-array declaration.
Another holds a Map named like a typed array in another function and in an outer scope;
it passes on the old scan by design,
and by the agent's measurement fails under a resolution by name across the whole file.
`decodeView` copies with `set` over a `subarray` again,
which throws where a copy runs past the array,
where an index write past a typed array is dropped without a word.

Open to the owner's veto:
only a plainly named receiver is resolved,
so a typed array reached through a member is still reported.

Recurrence:
`mistake-prevention.md`,
"Searches and censuses that miss":
a scan reading a method call tells the receiver's kind from its declaration,
never from the method's name alone.

### B343: a second test file sorted away the order the recheck guarantees

Changed in `de6ff17`;
its red is the agent's measurement,
since the cases pass on the stage as it stands.

Found on 2026-10-06 (UTC),
the item B328 left open.
`refine-slice-settle.unit.test.ts` compared each settled slice's recheck readings through `readingsInSeatOrder`,
which sorted the ballots into seat order.
By the agent's mutant,
with the checker stage's roster ordering removed from `repair-edit-stages.ts`,
every case of the file still passed while `refine-recheck.unit.test.ts` failed six;
with the helper also removed,
the two cases whose round heard three checkers failed.
The third case hears no checker,
so it has no ballots to order.

The fix:
the three cases assert the readings as the stage returns them,
and `readingsInSeatOrder` is gone from `sunbathing-recheck.test-fixture.ts`.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B344: the nesting count read tag names its own way

Red in `de6ff17`,
fixed in `a7eca7f`.

Found on 2026-10-06 (UTC),
the nesting count's own tag-name reader B326 left open.
`nesting-inline-count.ts` opened a tag at `<` followed by an ASCII letter.
By the agent's differential over the 283 spellings of the tag-name set,
of the 106 the strict grammar opens a tag for it missed 8
(names starting with `$`,
`_` or a letter of another script),
so a body nesting such tags past the bound passed the measure,
and it opened 146 the grammar refuses.

The fix:
the count reads a tag through `readTagName`,
in the line followed by `LINE_GOES_ON`
(a line ending,
a name letter and a bracket),
since the grammar steps over a line ending inside a tag
and the next line is out of the scan's sight.
By the agent's probe the grammar reads a tag split after its name,
after a member's dot or a colon,
or after `</`,
as one element.
A closer begun with `</` at a line's end now closes on the next line,
where the count kept the tag open.
The count and the grammar agree on all 283.
The opener half of the line-end case passed on the old count,
and the agent showed it failing with `LINE_GOES_ON` empty.

Open to the owner's veto:
`LINE_GOES_ON` is an invented continuation,
measured against the grammar,
where the alternative hands the scan the rest of the body and changes `nesting-bound.ts`.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B345: the attribute restorer read attribute names its own way

Red in `de6ff17`,
fixed in `a7eca7f`.

Found on 2026-10-06 (UTC),
the attribute-name reader B326 left open.
`corpus-run/tag-attributes.ts` read an attribute name as ASCII letters,
digits,
`-`,
`.` and `:`.
By the agent's differential,
each of the 283 spellings written as an attribute's name (`<Cat NAME="1"/>`),
the strict grammar reads one attribute on 75;
the reader dropped 61 of those tags whole,
read a name on 32 the grammar refuses,
and read the prefixed `a : b` as `b`.

The fix:
`readAttributeName` in `mdx-tag-name.ts` reads a name as the grammar's states do
(`micromark-extension-mdx-jsx` 3.0.2,
`factory-tag.js`,
`attributeBefore` to `attributeLocalNameAfter`):
a primary name,
then optionally `:` and one local name,
with whitespace allowed around the colon,
each part taking the characters a tag name's parts take,
and no `.` member.
The restorer reads through it,
keeping a prefixed name without the whitespace around its colon,
and the reader and the grammar agree on all 283.
The lead probed a name starting with a letter past U+FFFF:
the compiler refuses it as a tag name and as an attribute name,
and `readTagName` reads none,
as B326 found for tag names;
the spelling set holds no such character.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B346: the destination scan ended an address at ASCII whitespace only

Red in `de6ff17`,
fixed in `a7eca7f`.

Found on 2026-10-06 (UTC),
the item B327 left open.
The autolink literal's path,
its trail and a trail's closing bracket end at `markdownLineEndingOrSpace` or `unicodeWhitespace`
(`micromark-extension-gfm-autolink-literal` 2.1.0;
`micromark-util-character` 2.1.1 defines `unicodeWhitespace` as `\s` over one UTF-16 unit),
but the scan ended a run only at a space,
a tab and the two line endings.
An address followed by a no-break or an ideographic space ran on into the words after it,
so a page that kept the address and rewrote those words read as dropping a destination.
With five whitespace suffixes added to the generator,
the scan and the tree reader disagreed on 4,620 of 31,106 texts,
each holding a space past ASCII.

The fix:
a run ends at every whitespace `isTagWhitespace` reads
(the same 25 units,
the predicate the tag readers step over),
and so does a trail's closing bracket.
The generator draws a no-break space and an ideographic space after a path,
and whitespace past ASCII after a trail's period,
its bracket and a character reference.
The two readers agree on every text,
and a case holds 18 texts to the parse's own address,
a next-line mark and a zero-width space among them as controls that end no address.

Open to the owner's veto:
the scan imports `isTagWhitespace` from the tag readers' module,
where the alternative is a neutral module both import.

Recurrence:
`mistake-prevention.md`,
"Structure read off the parse".

### B347: the corpus git children spoke the caller's language

Red in `de6ff17`,
fixed in `a7eca7f`.

Found on 2026-10-06 (UTC) by the agent writing the runner observations,
whose change is not merged yet.
`corpusGitEnvironment` kept the caller's locale variables,
and git translates its messages,
while the corpus reader tells a missing page from another failure by git's English words.
By the agent's probe with git 2.55 over a throwaway repository,
reading a path absent at a held commit,
the refusal came in German under `LANGUAGE=de` with an English `LANG`
and under `LANG` or `LC_MESSAGES` set to German,
and in English once `LC_ALL=C` was added to any of them;
that the reader then classes a missing page as another failure
is the agent's inference from `classifyCorpusReadFailure`.

The fix:
the environment sets `LC_ALL` to `C` after inheritance.
`corpus-git-context.unit.test.ts` asserts the environment whole,
and runs real git under a German locale through `runKeyless`,
reading the English refusal back,
beside a control showing the same read translated without the hold;
the lead's run of it on the red tree showed `LC_ALL: 'de_DE.UTF-8'` kept
and the refusal printed as `Schwerwiegend: Pfad ... existiert nicht`.
The corpus entry barrel exports `corpusGitEnvironment` for that case.

Open to the owner's veto:
the real-git case depends on the host's git translating;
on a host without German messages its control fails,
not the guard.

Recurrence:
`mistake-prevention.md`,
"Tests touching the real world".

### B348: the bench-draw cases asserted fragments where the whole value was known

Changed in `de6ff17`,
a commit of test files alone.

Found on 2026-10-06 (UTC) by the agent writing the runner observations.
`corpus-run/bench-draw.unit.test.ts` held three `toContain` assertions where the whole value was known:
the empty-pool refusal,
the middle-width case
and the one-seat refusal.

The fix:
each asserts the whole value:
`BenchDrawError: a bench sample cannot be drawn from no slices` as the refusal's `String`,
`{ widths: [2, 3, 4, 5, 6], repeated: 4 }`,
and `BenchReportError: a roster of 1 cannot be benched: nothing to vary`.
The runner observations change rewrites `BenchReportError`;
by that change's own report it prints the same text,
and if it lands with another the one-seat refusal's expectation moves with it.

Recurrence:
`mistake-prevention.md`,
"Guards that cannot fail".

### B349: a listed reason's anchor was held to the call's top-level statement

Red in `d1e6af41c`,
fixed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass,
before its merge.
`promise-combinators-in-order.unit.test.ts`,
the scan that holds every Promise combinator in production code to a listed reason,
took a call's own statement from the top level of its function,
so inside an `if`,
a `for` or a `try`
any name anywhere in that block held the anchor.
Two calls in one `if` block,
the first resting on a name only the second uses,
passed,
and the `nextSettled` entry passed with `throwIfAborted` moved into the `try`,
where no rejection reaches it.
By the agent's measurement,
the scan as it stood missed the three defects planted inside an `if`,
a `for` and a `try`
in the case "HOLDS A NAMED ANCHOR TO THE INNERMOST STATEMENT MAKING THE CALL".

The fix:
the scan holds a name to the innermost statement making the call,
and looks for feeding code among the statements that come before the call's own in each enclosing block,
and in the head of a loop whose body holds the call.
A name written as `{ inHandler }` must stand in the handler of a `try` whose block holds the call,
and `nextSettled` now rests on that;
the cases for that form are coverage only,
since the old scan cannot express it.
By the agent's measurement,
seven edits to copies of the production source the scan reads each give exactly their finding,
one of them moving `throwIfAborted` out of `nextSettled`'s handler into the `try`,
and the unchanged source gives none.
At the merge the scan's package-wide case moved onto `expectNoFindings`,
which `scan-direct-comparisons.unit.test.ts` requires of a listed scan (B339),
and the scan joined the source-scans task.

Open to the owner's veto:
A loop's head counts as code feeding the call.
The readers of a settled result are taken from the first statement list at or around the call's statement.
A call in a class field initializer has the whole class declaration as its statement.
`Anchor` is `string | { inHandler }` rather than a new reason.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B350: a catch that handed its error on read as quiet

Red in `d1e6af41c`,
fixed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
A `catches-own` reason in the combinator scan held when any one catch under the call was quiet.
The handing check saw the error only as a direct argument,
so an alias,
a cast,
an array,
a nested object or a destructured parameter read as quiet,
and one quiet `try` beside one that throws held the reason.
By the agent's measurement,
the scan as it stood missed six of the plants of the case
"HOLDS A REASON RESTING ON A CATCH TO EVERY CATCH INSIDE THE CALL":
the alias,
the cast,
the array,
the object inside an argument,
the destructured parameter
and the quiet catch beside a throwing one.

The fix:
every catch under the call must be quiet,
with at least one present;
a destructured parameter is never quiet;
and any read of the binding counts as handing it on,
except a direct argument of `refusalText`,
`refusalOf` or `errorName`,
or the value of a property of an object literal that is such an argument.
By the agent's measurement,
each of three production edits gives one finding:
the error handed to `describeFailure` in `attribution-read.ts`,
the error cast inside `refusalOf` in `ledger-directory.ts`,
and a second,
throwing `try` in `cited-reference-lookup.ts`.

Open to the owner's veto:
A destructured catch parameter is never quiet,
where the review would treat one as quiet when none of its names is handed on;
by the agent's search,
production code holds none.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B351: the combinator scan did not find `Promise` reached without its name

Red in `d1e6af41c`,
fixed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
The scan read `Promise` by its identifier and off `globalThis`,
so `Promise.resolve().constructor.all`,
`globalThis.globalThis.Promise.all` and `ns.Promise.all` gave no finding,
and its doc did not list them as out of its reach.
By the agent's measurement,
the scan as it stood gave none of the 13 findings expected of the case
"FINDS PROMISE REACHED WITHOUT ITS NAME BEFORE THE COMBINATOR".

The fix:
a member named `Promise` or `constructor` read off any value is a finding,
as is a member named like a combinator read off anything but `Promise`,
called or not,
save `AbortSignal.any`;
so is each of those names destructured off a value other than `Promise` or the global object.
The module doc names what stays out of reach:
`eval` and `Function` text,
a computed key that is no string literal or a reflective read off a value other than `Promise` or the global object,
and another module's alias handed on or read by such a key.
By the agent's search,
production code reads no `.constructor` or `.Promise`,
and the only combinator-named member it reads off anything but `Promise` is `AbortSignal.any`,
in `stage-round.ts` and `synthetic-transport.ts`.

Open to the owner's veto:
`const { any, } = AbortSignal` is a finding while `AbortSignal.any` is allowed.
The combinator-name rule reads any such member off anything but `Promise`,
called or not.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B352: a gather round dropped an ask's own failure under the caller's stop

Red in `d1e6af41c`,
fixed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
`nextSettled` (`stage-round.ts`) throws the caller's reason in place of whichever ask rejected first,
and the ask's own failure,
a deadline or a transport failure landing as the stop arrived,
reached no line.
The case "LOGS THE FAILURE AN ASK ENDED IN AFTER THE CALLER'S ABORT" asserts the line whole,
and on the agent's tree before the fix it failed with `expected [] to deeply equal [ Array(1) ]`.

The fix:
where the caught value is not the caller's reason itself,
`nextSettled` writes it through `refusalText` on a logger tagged `nextSettled`,
then throws through `throwIfAborted()`;
`awaitHeard` hands it the stage and the logger,
and gains `@throws` for the logger's failure and for an ask's own failure when no abort is in play.
The list note and the TSDoc say the asks share the signal and the catch puts its reason in place of what it caught.
The case holding that nothing is logged when the asks end in the caller's own reason is coverage only;
by the agent's control it fails with the identity check removed.
The client failing two seats after the stop is extracted as `clientFailingAfterTheStop`,
which the existing case on the rejection now uses.

Open:
by the agent's run at its base `f3c2bae13`,
none of 21 test files that reach the round saw the new line;
on the merged tree the gate on `ce2654b2c` failed four cases the credential work added since that base,
each pinning the provider's words in the line a stop writes,
in `window-trial-pick`,
`repair-refine-step`,
`repair-slice-buy` and `translate-slice-attempt`.
By the lead's reading,
the round now throws the abort reason and logs the failure it replaces through `refusalText`,
so those words reach no line (M140).
The same four fail at `4cca8c301`,
and the change that fixes them is not merged there.
Closed since by B365 in `fba9c5b60`.

Open to the owner's veto:
The line is written only when the caught value is not the caller's reason,
where the review's fix logs whenever the caller has aborted.
The line is tagged with `nextSettled`,
while `askOnce` writes on its logger untagged.
Extracting `clientFailingAfterTheStop` changed the body of an existing case.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".

### B353: the precedence of a read failure and a parse failure in the bench draw was unpinned

Cases added in `d1e6af41c`,
coverage only,
passing before and after `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass;
no defect.
`sliceEntry` (`corpus-run/bench-sample.ts`) reports the original's failure,
read or parse,
ahead of the English page's,
and no case mixed a read failure with a parse failure.
Two cases in `bench-sample-draw.unit.test.ts` now pair an unparsable original with a missing English page,
and an unreadable original with an unparsable English page.
By the agent's control,
swapping the two checks in `sliceEntry` turns both red,
with three older cases.

The skip line of the pair step has no case:
by the agent's bounded probe over three fixed seeds of 2,000 generated page pairs,
5,773 pairs passed the pair step,
2,363 of them cut into 7,326 slices,
and none reached that line;
227 pages built with broken front matter each printed their parse line,
which shows the probe reads every line the draw prints,
and nothing controls for the pair line itself.
`PAIR_STEP_FAILED`'s TSDoc records the probe.

Open to the owner's veto:
Hoisting two expected lines into `ORIGINAL_MISSING_LINE` and `ORIGINAL_UNPARSABLE_LINE`
changed the bodies of existing cases.

Recurrence:
`mistake-prevention.md`,
"Refusals inside a composed operation".

### B354: a count finding of the combinator scan named the wrong call

Red in `d1e6af41c`,
fixed in `ce2654b2c`.

Found on 2026-10-06 (UTC) by the review of the input-order change's second pass.
An unlisted call written before a listed one took the entry by position,
and the finding named the old,
listed call's line.
By the agent's measurement,
the scan as it stood named only the listed call in the planted file of the case
"COUNTS EACH SITE'S CALLS AGAINST ITS ENTRIES".

The fix:
a site whose call count differs from its entries gives one finding naming every call's place,
and none of its entries is checked against a call it was not read against;
the calls of an unlisted key are still reported one finding each.

Open to the owner's veto:
The finding names every call of such a site,
where the review offered naming the first call no entry was read against;
the agent's reason is that the scan cannot know which call an entry was read against.

Recurrence:
`mistake-prevention.md`,
"Output decided by arrival order".
