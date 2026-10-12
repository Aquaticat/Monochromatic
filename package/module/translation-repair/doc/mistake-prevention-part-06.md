# Preventing this package's mistakes, part 06

Part 06 of [Preventing this package's mistakes](mistake-prevention.md),
whose index lists every part in order.

## Numbers read back from text

What happened:
the slice-cost reader took a count as whatever `Number` made of the field's text,
so an empty field read as 0,
`0x1F` as 31,
`1e3` as 1000,
a leading sign as part of the count,
and a digit run past the largest exact integer as a neighbouring number,
though its writer only ever writes the digits of an integer (ledger B71).
It also checked each field in one loop and read it again through helpers that threw when the loop had not,
throws no line could reach.
The same reading ran through the package (ledger B73):
counts in its own log lines,
sheets and declarations,
the dials and flags an operator types,
the prices and lengths providers list,
and the stamp on every log line,
which `Date.parse` read without its zone as local time
and,
cut off part way,
as NaN that one reader kept as a call's end and another as a sample's time.
A probe counting the family first missed readers handed on as values (`.map(Number)`) and `Date.parse`
(ledger M90),
and a call about what providers write was first made from the package's fixtures,
not their stored listings (ledger M91).

An offset was read out of a parse refusal's message,
which quotes a short file back whole,
so a file's own words gave the offset (ledger B274);
and a request rate written with a fraction was read as a rate,
and made the pace read its list of starts between two entries (ledger B292).
Text a message may quote is never searched for a phrase the message uses as structure,
and a count of places is a whole number of one or more,
or is refused where it is read.
The same held for the ledger:
the lead's tooling lists a ledger passage as a choice awaiting the owner by a marker phrase,
and two passages of a process entry that quoted the phrase were listed as such choices (ledger M141).
A record that quotes a marker phrase its tooling matches on is reworded,
or the match is anchored where the marker stands.

The rule:
a reader of a number in text accepts only the spelling its writer writes,
through a shared rule or a round trip through the writer:

- a count is ASCII digits a double holds exactly (`isWholeNumberText`),
  leading zeros read as written,
  and every refusal cites `WHOLE_NUMBER_RULE`;
- an amount an operator types is a plain decimal (`isDecimalText`),
  then finite;
- a number a service writes as text takes JSON's spelling (`isUnsignedNumberText`),
  then finite and not under zero;
- a log stamp is what `toISOString` writes (`isIsoStampText`),
  and a line whose stamp is not is left out and counted,
  never placed at a time nobody wrote;
- a value the package wrote with `String` is read back only when `String` spells it again.

Each field is read once,
into its value or its refusal,
and the record is built from those readings.
A number an operator types is read by the same rules,
a blank variable reads as unset,
a minus sign before digits is answered as a count under zero,
and the refusal says what leaving the value off does.
A number passed between the package's own functions stays a number:
it is never written as text only to be read back.
Before counting a family,
list every way the language reaches the behaviour
(a call,
a construction,
a value handed on,
a coercion);
before deciding what a writer writes,
measure its stored output with a control.

What enforces it:
`number-reads.unit.test.ts`,
which `source-scans` runs,
fails on a call of `Number`,
`parseInt`,
`parseFloat`,
`BigInt`,
`Number.parseInt`,
`Number.parseFloat` or `Date.parse`,
a `new Date` given an argument,
a unary plus on anything but a literal,
or any of those readers handed on as a value,
until the read is named with the rule that holds it;
`whole-number-text.unit.test.ts` and `iso-stamp-text.unit.test.ts` hold the shared rules,
and `iso-stamp-text.test-fixture.ts` lists the stamp spellings every stamp reader is shown refusing.
Out of the scan's reach:
a reader reached through `globalThis` or a renamed binding,
and arithmetic on text.

## Command lines

What happened:
every runner found its own flags with `indexOf` or `includes` on the exact token,
so `--cap=0`,
a mistyped `--olny`,
a second `--only`,
or any argument to a runner that reads none
read as not written,
and the runner ran what nobody asked for:
every pending corpus entry,
every subject the settled audit could buy,
or the seated roster in place of the models named (ledger B75).
A flag written last or before the next flag read as unwritten,
a plain-object table looked up by a typed name found `Object.prototype`'s keys,
the mise task descriptions,
written by hand,
had drifted from what five runners read,
and three refusals did not show what was typed,
one of them not even which part of the line was wrong.
An `--only` naming an entry a runner could not reach was dropped without a word,
so the runner ran over nothing,
or over the rest when the stray stood beside real entries (ledger B76).
The line a pass prints for an `--only` said every entry it names runs,
where a named entry that has finished does not (ledger B376):
an operator line is read against every state of what it names.

The rule:
a runner declares what it reads in `corpus-run/command-lines.ts`
(valued flags,
repeatable flags,
switches and positions),
hands `process.argv` and its own name to `reportingRefusals`,
and reads only the line that call hands it;
a flag's value goes through `corpus-run/command-flags.ts`.
The reader refuses,
all at once and ending with the usage line,
anything the declaration does not name or a value it cannot use,
and every refusal names the part that is wrong and quotes what was typed.
A table keyed by typed text is a `Map`,
and a list the command line names,
such as the card providers,
is written once and read by both the declaration and the reader.
A task description,
and every invocation in the living docs,
names only flags the runner reads.
Ids a line names are held to what the runner can reach through `askedAmong`,
which refuses the line,
naming every stray,
before anything is spent.

What enforces it:
`command-lines.unit.test.ts` fails on a runner the build makes that the table does not declare,
a malformed declaration,
a task description out of step with its runner's flags,
or a living doc invoking a runner with a flag it does not read;
`command-line-reads.unit.test.ts`,
which `source-scans` runs,
fails on a read of `process.argv`,
an import of `parseArgs`,
or a dynamic import of `node:process` or `node:util` anywhere but a runner's own hand-off and the one reader;
`command-line.unit.test.ts` holds the reader's readings and refusals,
and `command-flags.unit.test.ts` the refusal of ids a runner cannot reach.
Habit holds a new runner that narrows its walk by id to `askedAmong`.
Out of the scan's reach:
`process` reached through `globalThis` or handed on whole,
and a property name built at run time.

## Tables keyed by text

What happened:
plain objects served as tables looked up by text the package did not write:
a provider's stream delta type,
a corpus asset's extension,
a stored issue status and repair disposition,
and corpus entry ids in the attempt counts.
An object answers `constructor`,
`toString` and the other names it inherits with the prototype's values,
and one written through `__proto__` sets its prototype and drops the entry,
so a delta typed `constructor` was routed with `Object.prototype` as its channel,
an asset named `tabby.constructor` read as usable,
a claim with that status was filed under the `Object` function as its arm,
and a count for `__proto__` was never written (ledger B77).
A lookup took the first node carrying an id,
on the unstated assumption that ids are unique,
and a document repeating an id had a sound span checked against the wrong node
and rejected as stale (ledger B129).
A census of every first-match lookup in the production source found eight more:
a voice's second rendering of one title passed over (ledger B203),
an href keyed to the archive's last text for it (ledger B204),
a claim's proposers taken from the last chunk naming it (ledger B205),
a stored page assembly and a provider's listing read by their first row under a key (ledger B206,
B208),
trimmed texts keyed by slice beside two index lists that were checked (ledger B207),
three log readers settling a repeated field by order (ledger B209),
and an attribute restored from the first of two a tag names (ledger B210).
A heading cut at its last colon wrote a name holding a colon twice (ledger B198).
The census's search pattern missed maps built from typed pairs and maps filled by `set` in a loop,
where two of the eight stood.
Three sites that census described and left were fixed next:
a title linked twice in one slice,
whose second link was never located (ledger B228);
a refrain,
compared only at the first place its wording stands (ledger B229);
and an archive block found again by its text,
so its revision was checked at the first place the text stands (ledger B230).
A caller that cut a piece out of a text passes where the piece stands,
and the callee does not find it again by its text.

The other sites that census described and left were closed after those,
each a reader that answered for one of two elements under one key:
a roster seating one model twice,
a confirmation fitting two rounds,
a tally table,
a region's slice,
a ledger row for an arm,
a subject on two rows,
a sheet position named twice and a prober answering a region twice (ledger B238 to B245),
with a card dropped by a repeated served id (ledger B246).
A second census,
over map writes,
loops that return at a first match,
sets that drop repeats and keys of parsed objects,
found a page name the archive renders two ways given by its first rendering (ledger B263)
and one voice counted twice for naming a pair twice (ledger B264).
A report's merge key that left out two of four providers' states merged readings that differed there (ledger B281).
A reader says what a repeated key means,
by a refusal,
a count or a finding,
and a key holds every field that tells two records apart.

The rule:
a table looked up by text is a `ReadonlyMap`,
and a record filled by a key is a `Map` until it is handed on whole,
as an object from `Object.fromEntries` at its function's return or its file's write.
A table over a closed set of names keeps the names in its type
(a literal-keyed object,
checked with `satisfies` rather than annotated as a record of strings,
or a `Record` over the set's own union),
so the compiler refuses a lookup by unchecked text;
an exported table needs an annotation under `isolatedDeclarations`,
which widens its keys,
so an exported table looked up by text is a map.
A lookup that takes the first element matching a key
(`find`,
`indexOf`,
or a map built from pairs where a later pair replaces an earlier one)
names what makes the key unique:
the function that builds the collection,
or the check upstream that refuses a repeat.
Where neither does,
because the collection comes from a model's reply,
a file,
or a caller the signature lets build anything,
the lookup gathers every match and says what two mean,
in the refusal form its module already uses.
A cut at a delimiter is such a lookup too,
and a census of them reads maps built from typed pairs and maps filled by `set` in a loop
beside the calls.

What enforces it:
`text-keyed-tables.unit.test.ts`,
which `source-scans` runs,
fails on a declaration typed with string keys
(`Record<string, …>`,
that inside `Readonly`,
a string index signature,
or a package alias of one,
by annotation or by a cast)
whose value is an object literal at a module's top or `{}` anywhere,
or that is written through a computed key;
the red cases in each site's test file hold the inherited names.
`validate-issue.unit.test.ts` and `critic-wire.unit.test.ts` hold a document repeating an id,
and each site of ledger B203 to B210,
of B228 to B230 and of B238 to B246 holds its repeat in its own test file;
`blind-map-writes.unit.test.ts`,
which `source-scans` runs,
fails a two-argument `set` whose enclosing functions never read the same key of the same map,
outside the writes it allows with what makes each key unique (ledger B265);
first-match loops,
sets that drop a differing repeat and doubled keys in parsed JSON are held by habit and review.
Out of the scan's reach,
and read once by a typed census recorded in ledger B77:
a table built by `Object.fromEntries` or handed back from a function and then read by text,
a class field,
a parameter destructured from an object an alias types,
a key typed by a template literal,
and a cast of text to a table's literal keys.

## Durations on the system clock

What happened:
durations,
deadlines,
holds,
paces and budgets were differences of `Date.now()` readings,
and the system clock is the time of day a person or a time daemon can set.
Set back an hour,
the pacer asked a take to wait an hour more than its window,
the budget view held a refuser an hour on a 300 ms backoff,
and an entry's artifact recorded a duration of an hour below zero,
which its reader refuses;
set forward,
the repair benchmark read its budget spent and skipped an entry (ledger B78).
The fidelity probe read the start it records after reading every reference,
so the time those reads took was left out of the run it dates (ledger B383).
A run's start is read before its first work.

The rule:
a difference of two readings inside one process reads `monotonicMs` (`monotonic-clock.ts`),
whose clock no setting of the system time moves;
the system clock is read only as a stamp,
`new Date().toISOString()`,
for a moment that outlives the process.
A `monotonicMs` reading counts from near the process's start,
so it is never stored,
and zero marks nothing as absent:
a stamp for "never" is negative infinity.
A timer can end a millisecond before a monotonic deadline,
so code that must not start early reads the clock again after its sleep.

What enforces it:
`wall-clock-reads.unit.test.ts`,
which `source-scans` runs,
fails on the system clock read as a number in source or tests
(`Date.now` in any form,
`getTime` or `valueOf` called,
a unary plus or `Number` on a date,
`performance.timeOrigin`,
`Temporal.Now`),
and the red cases in each site's test file step the system clock through `wall-clock-stub.test-fixture.ts`.
Out of the scan's reach:
those globals reached through `globalThis` or another name,
dates compared with `<` or `>`,
and durations between stamps a process wrote.
Where a run reads its start is held by the fidelity probe's case alone,
which counts the reference reads made by each clock reading (ledger B383);
elsewhere it is habit.

## Globals a case replaces

What happened:
the stub for the system clock replaced `Date.now` for the whole test process,
while module-test runs a suite's cases side by side,
sixteen at a time by default.
A pacer case beside the stepped one read the stubbed clock,
and a guard-off that should have failed a case hung its file instead;
the logger's stamps in sibling cases took the stepped time too (ledger M100).
Thirteen other test files wrote environment variables,
`console` methods or the working directory in suites that ran their cases at once,
where a restore finishing out of order could leave a sibling's value behind (ledger B79).
A fixture that diverted `console.warn` to read the lines a piece of work logged
caught the logger's own report of a sink it could not verify,
since the logger starts on a process's first line and that line fell inside the divert;
on a loaded machine the report failed a cache case,
and the fixture's message had called the state unreachable (ledger B140).

The rule:
a case that replaces a global replaces it only for itself:
a method through the case's own sandbox,
`ctx.sinon.stub(target, 'method')`,
which module-test answers only to code in that case's async context and restores when the case ends;
any other write to a process global
(an environment variable,
a `console` method,
`process.exitCode`,
the working directory)
happens only in a suite run one case at a time,
`concurrency: 1` on it or on every suite around it out to the file's top,
even when no await falls between the write and its restore today.
Before writing such a fixture,
read how the runner schedules cases.
A case that replaces a process-wide writer starts every logger that writes through it before the replacement:
the built package's logger and the test framework's,
each flushed so its sinks are verified,
so a logger's report of its own reaches the writer it was meant for
and never reads as a line the work logged.
A guard-off whose process does not exit is a finding,
and a guard runner ends each file after a bound.

What enforces it:
`global-writes-sequenced.unit.test.ts`,
which `source-scans` runs,
fails on a write to a process global in a test or test fixture
that is not inside a case every suite around which runs one case at a time,
following helpers called by name to their cases;
`wall-clock-stub.unit.test.ts` holds a sibling case that reads the real clock while another case holds a stepped one;
`console-warn-lines.unit.test.ts` runs the warn-lines fixture in a child process whose file sink cannot verify
(added in `7ecd53897`).
Out of the scan's reach:
a write through an alias such as `const env = process.env`,
and a case made by a function the suite's text only calls.

## Readers of the package's own log lines

What happened:
`run-timing-report` reads back the round and completion lines a run logs.
Its reader knew one of the two round lines `runGatherRound` writes,
so a round whose quorum never stood left every figure the report printed;
a round line short of its fields was refused for a missing unit,
a completion line without its outcome read as an empty outcome,
and calls spanning no time divided by a zero span (ledger B82).

Two report commands counted the closing newline of a log as a line,
and totalled a log named twice (ledger B278).
A log's lines are what its newlines end,
and a reader that totals refuses a log it is handed twice.

The rule:
a reader of a line the package writes starts from the writer:
list every shape the writer can emit,
read each into its own kind rather than optional fields,
and refuse,
naming the field,
any line that carries the marker but none of those shapes.
Fixtures copy the writer's template for each shape,
and a figure folded from the readings counts every kind
or says why one is left out.
A division whose divisor the input can make zero is refused or guarded,
never printed as a number.

The same gap ran the other way when a writer changed:
B109 made the stream line write "1 content char",
and `cap-census-read.ts` found the content count by the text " content chars",
so a one-character stream would have read as no completed stream;
its fixtures copied the old wording and could not show it.

A writer's wording change therefore checks every reader of that line first:
search the package for the changed field's text,
and give each reader the old and the new spelling,
since run logs written before the change stay on disk.
Reader fixtures are built by calling the writer,
not by copying its template.

Three readers settled a field written twice by order,
two keeping the later value and one the first,
though each writer writes a field once,
so two records run together read as one clean record (ledger B209).
A reader says what a repeated field means,
with its module's own value for a record that will not read.

What enforces it:
`run-timing.unit.test.ts` holds a fixture line for each round shape and the completion line,
and a case for each refusal.
`cap-census.unit.test.ts` builds its stream lines through `reportStreamProgress`,
so a change to that line's wording reaches the cap-census reader's cases;
the run-timing fixtures still copy the writer's template,
so a new shape in `stage-round.ts` or `reportStreamProgress` reaches that reader untested
(ledger B82 records the follow-up).

## Pairing by position

What happened:
three page-assembly passes paired page headings with the original's or the archive's by position.
The heading collision restore checked only that the page's total matched,
so a slice that dropped a heading and another that gained one shifted every heading between them,
and a section the page never replaced shipped as empty text (ledger B83).
The heading series pass and the contributor name pass paired inside one slice with no count check at all,
so a page slice that dropped its first heading gave the next section the wrong number,
or wrote a signer's name over its title (ledger B84).
The contributor name pass already checked the count for signatures,
one line away.

A replacement for a slice the page lacks was taken with the archive read as empty text (ledger B273).
A row that names a slice is read through the reader that refuses a slice the page does not hold.

The rule:
pair two lists by position only where they carry the same count
at the level the positions are read:
per slice where positions are read per slice,
and per slice as well where a page-wide position runs through slices,
since equal totals can hide a shift.
Where the counts differ,
leave the items as they stand and let the guard downstream speak;
never fall back to empty text or a neighbour's item.
A pass reads per-slice page text through `pageTextOf` (`assembly-page-text.ts`),
which refuses a slice its map was not built from.

What enforces it:
each pass's tests hold a case whose page drops or gains one item inside a slice
(`heading-collision-restore`,
`heading-series-unify`,
`contributor-name-restore`),
and `assembly-page-text.unit.test.ts` holds the refusal.
No scan finds a new positional pairing;
a search for position-indexed reads over `corpus-run/` found the others,
each already checking its count.

## Offsets and positions

What happened:
the assembly guard's advancing withdrawal compared where the strict grammar stopped on the page as assembled
with where it stopped on the page with one replacement withdrawn,
as raw offsets into two different texts,
so a whole replacement shorter than its archive text read as moving a break it never touched,
and outranked the withdrawal that removed it (ledger B85).
The reader of those offsets placed a refusal at the start of the span the parser named,
though the parser raises it on leaving that span,
and placed a refusal naming no span at the start of the body,
though the parser had read to the body's end;
a page whose first named break was withdrawn then read as stopping at offset 0,
and the guard gave up every replacement (ledger B86).

The parser skips a byte order mark that opens its input without counting it,
so every position of the tree sat one character short of the body as written (ledger B257).
A parser that drops input without counting it moves every offset it reports,
and the shift is undone where the offsets are made,
not in each reader.

The rule:
an offset means something only in the text it indexes.
Compare two only after mapping one into the other's frame
(`assembledOffsetOf` in `assembly-structural-withdrawal.ts` for two pages that differ in one slice),
and keep "the parser accepted the page" as its own outcome rather than a number that can tie with a refusal.
A parser's position is where its message says it stopped:
read the deciding source for which end of a span that is,
and for what a message with no place means,
before turning either into an offset.

What enforces it:
`assembly-structural-withdrawal.unit.test.ts` holds a page whose earlier replacement only changes length
and a page whose remaining refusal names no place;
`strict-refusal-offset.unit.test.ts` holds an element left open in a paragraph and one left open at the document's end.
No scan finds offsets compared across texts.

## Provider fields read by their documentation

What happened:
the Anthropic reader reported `input_tokens` as the prompt,
as the name suggests,
though Anthropic's documentation counts in it only the tokens after the last cache breakpoint
and gives the prompt as that plus the tokens read from and written to the cache,
so a cached call read as a short one (ledger B88).
The same reader read a `text` or `partial_json` that was not a string as empty,
and passed over a delta frame with no delta,
so an answer came back with a piece missing and nothing said (ledger B89).
The scanner reading the same stream for the stream guards passed those frames over uncounted,
and block starts it could not read too,
so the tally its contract says should stay at zero
read zero for a body the reader then refused (ledger B93).
The reader also reported a count the stream never sent as 0
once the other count arrived (ledger B94).

The rule:
a field on a provider's wire is read as the provider's current documentation defines it,
fetched while writing the reader,
and a reader mapping one provider's fields onto another's shape
(Anthropic's usage onto the OpenAI-shaped `prompt_tokens`)
states each mapping beside the documentation it follows.
A gateway that serves one provider's format for another is read by the format's documentation,
and a capture that cannot be checked against it says so where it is kept.
A field the documentation makes part of a frame,
and that carries the answer,
is refused when absent or of the wrong type,
as a frame that does not parse is refused;
an empty string stands only for an empty fragment the provider sent.
A frame of a kind the reader does not read is passed over,
since the protocol may add kinds.
Where two readers walk one wire,
each counts or refuses a frame it reads and cannot,
judged by what that reader reads the frame for,
so neither reports a clean stream the other refused.
A count the provider never sent is absent,
never 0,
unless its documentation says an absent field means none,
as the cache fields do.

What enforces it:
habit and review;
`anthropic-completion.unit.test.ts` holds a stream that reads and writes the cache,
a delta frame with no delta,
a text that is a number,
a tool fragment with no `partial_json`,
and the deltas still passed over;
`anthropic-delta-scan.unit.test.ts` holds the frames the scanner counts as unreadable
beside the ones it reads or passes over.

## Two layers reading one refusal

What happened:
the budget layer held a refuser whose meter read wet for no time
when every other provider was dry,
so the calls kept going to it,
and the router read the same refusal as a reason to call that provider dry,
found no hold to wait out,
and ended the call as if no provider had budget,
166 times on Uekawakuyuurei while Synthetic's meter read wet (ledger B124).
Each layer's own test held its half;
no test ran a refusal through both.
The same shape sat inside one module:
the introduced-defect screen decides which side of a prober's claim it anchors on,
and two later readers,
the quote compared with the accepted issues and the grading sheet's direction,
decided again by whether the raw omitted text was empty,
so a claim padded with spaces was counted as introduced damage and shown to a grader as dropped wording
(ledger B128).
The blankness census found the shape three more times:
a rendering-audit claim's side decided blank by two readers,
a reply's emptiness by two transport readers,
and an archive block revision's by a stage that never asked and a floor that asked another way
(ledger B189,
B191,
B192).
And a refusal the provider states in a stream's error event was retried,
where the same refusal as an HTTP status is returned at once (ledger B202):
the ladder now reads both as one refusal.

Seven refusals about a value the operator set or a file the operator named were authored,
marked sentences,
and the commands' boundary printed each as a fault of the command,
with frames and the fault's exit code (ledger B221):
the thrower read its refusal as the operator's mistake and the printer as a bug.
A refusal's class says which of the two it is,
and a case drives each such class through the printer.

Five of the classes B221 left became stated refusals,
and the sixth stays a fault with its reason said (ledger B254).
The runners that no test had run as built held the same shape many times over:
an unreadable or missing log,
a missing `artifacts` directory,
a sheet and a manifest of different lengths,
a listing that is not JSON,
an empty corpus,
a roster too narrow,
each with a message telling the operator what to do,
printed as a fault with frames (ledger B278,
B284,
B290,
B296,
B303,
B307);
and a census run where no build stands raised its listing error uncaught,
printed as a fault at exit 5 (ledger B311).
Two settings that can refuse were read in module constants,
before the boundary that prints refusals ran,
and exited 1 under a dump of source (ledger B302);
the corpus pin was read that way too,
at the load of `run-config.ts` (ledger B381),
in 34 of the 43 built bundles,
until each entry read it inside its boundary on 2026-10-10 (ledger B394).
The slice overlap was read inside the boundary but for each entry,
so an unreadable value refused the pass after the runs lock was taken and the first attempt recorded (ledger B400).
The artifact pool's contradictory pair of variables was a plain `Error`,
printed as a fault at exit 5 (ledger B380);
and a fidelity reference request refused for what the operator typed printed under frames at exit 5,
its class a fault where a reference the clone holds fails its hashes (ledger B382).
A refusal that is always the operator's is a stated refusal by class,
never caught and wrapped where it happens to be printed;
a class that is a fault elsewhere is restated at the one site where it is the operator's;
and a setting that can refuse is read inside the boundary,
once,
before the command claims a directory or records anything (ledger B400).
A refusal that arrives in a 200 stream's error chunk with a 4xx code is returned unretried,
as the same refusal over plain HTTP is (ledger B251).

The rule:
where one event is read by two layers,
each layer's reading is stated beside the other's,
and a test drives the event through the real code of both,
stubbing only the wire and the meters,
for every reading the first layer can give it
(here:
held for the backoff,
held for a named wait,
held for no time,
read dry until paid).
A layer that folds in an earlier layer's evidence reads what that layer decided,
such as the hold it set,
or the side a screen's verdict names,
not the raw event the decision was made from.
A reader that can only be handed what the decision admitted
throws `unreachable:` for anything else,
rather than deciding it a second way.

What enforces it:
`provider-router.unit.test.ts` holds "ASKS A WET REFUSER AGAIN",
which runs the refusal through the real budget layer and the router;
`budget-hold-wait.unit.test.ts` holds the reading for a refuser with no hold;
`introduced-defect-screen.unit.test.ts` holds the padded claim beside the same claim with an empty side,
and `probe-verify-sheet.unit.test.ts` holds
"NAMES a claim the screen corroborated on its evidence as added"
and the refusal of a claim the screen did not corroborate.
`corpus-run/cli-refusal.unit.test.ts` holds a case for each of the seven classes of ledger B221,
asserting the printed line and the exit code;
each moved runner's suite "<command> as built" asserts the printed line and the exit code of its refusals,
from a child process;
`corpus-run/corpus-pin-entries.unit.test.ts` holds each command other than `corpus-pass` that reads the corpus pin
at exit 6 with its stated line alone,
and one that never reads it running past an unreadable commit (ledger B394);
no scan finds an operator's mistake still thrown as a class the printer reads as a fault.

## One field carrying two kinds of text

What happened:
a ballot's `reason` holds a judge's own words from a chat seat,
and a distribution over the candidate numbers from a typed decision seat,
which answers with no words.
The decline that ships by preference gathered every reason
of a ballot that did not back the shipped candidate as an objection for the polish,
so a typed seat's numbers entered the objections
(ledger B125).
Nothing harmed a page,
because only the consolidation slate's objections reach a refiner
and that slate seats no decision seat;
the translate lane's carry them and nothing reads them.

The rule:
where one field holds text of two kinds,
every reader that passes it to a model or a person
names the kind it accepts and filters by the source,
here `isDecisionSeat` on the ballot's model,
not by parsing the text's own label,
which a judge's words could happen to begin with.
Where a reader is safe only because a seating keeps one kind away,
a case pins that seating too.

What enforces it:
`slate-decline-ships-by-preference.unit.test.ts` holds
"RECORDS NO OBJECTION from a decision seat's decline",
and `run-seats.unit.test.ts` holds
"SEATS NO DECISION SEAT ON THE CONSOLIDATION SLATE under any reading".

## Counts in printed text

What happened:
report lines,
log lines and findings printed a count before a fixed plural,
so a count of one read "1 slices",
and a test pinned one such line as correct;
a finding the translating model reads told it "no line more than 1 times".
The patch that chose the nouns left the verbs agreeing with them ("1 entry ... are"),
and its calls put three files over the line cap (ledger B98).
The scan B98 added read a noun only directly after its count,
so 75 sites printing a count before a modifier and then a fixed plural ("1 cached slices") passed it,
and that fix's own verbs and pronouns ("has",
"its") again stayed plural until a reviewer read them (ledger B109).
A marked refusal still wrote `destination(s)` after its count
and several slices under the singular `slice` (ledger B217),
which the count-nouns scan had passed;
why it passed was not looked into.

The runners no test had run as built held the same family:
a noun,
a verb or a pronoun fixed after a count in the lines of six commands,
found when cases first pinned their whole lines (ledger B308);
and a finding for an original with no content line read "more than 0 times" (ledger B255).
A count's sign is not its size:
a noun chosen from a signed difference is chosen from the size of the difference,
since a difference of minus one is one of the thing counted.
That defect,
"-1 characters" in `verify-published`,
is ledger B309,
with four more runners' counts before a fixed plural,
all fixed in `8206fa5c6`.
The standing reader's off-roster note then read "1 of these artifacts name",
its verb fixed in the plural (ledger B377).

The rule:
a noun after a count that can be one is chosen by `wordForCount`,
a verb agreeing with that count by the same count,
and a count of occurrences by `howOften` (`count-word.ts`);
a log line may instead print the count as a label (`ballots: 3`),
which no count can make wrong.
A test asserts a count line at one as well as at many.

What enforces it:
`src/count-nouns.unit.test.ts`,
among the source scans,
fails on a `String(...)` interpolation followed,
directly or after one or two modifier words,
by a noun the package counts with `wordForCount` elsewhere,
outside the sites it names with why.
A verb or pronoun agreeing with a count,
a noun after more than two modifiers,
and a noun no `wordForCount` call counts yet ("frames" until B109)
are reviewed by hand:
read the whole printed sentence at a count of one.

## Modules without a test of their own

What happened:
a census of the package's 1,086 production modules found 417 with no `<stem>.unit.test.ts` beside them;
117 of those are barrels,
modules of types and literal constants,
or runner entries,
and 300 are logic that another module's test reaches or no test names at all (ledger B102).
A module tested only through its importers loses that coverage when an importer changes,
and nothing stopped a new one from joining them.

The rule:
a new production module ships with `<stem>.unit.test.ts` beside it,
unless it is a barrel,
holds only types and literal constants,
or is a runner entry `src/build-entries.ts` lists.
A module on the list leaves it when it gains a test.

What enforces it:
`own-unit-tests.unit.test.ts`,
among the source scans.
