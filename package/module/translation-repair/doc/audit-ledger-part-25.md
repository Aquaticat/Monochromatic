# Audit ledger, part 25

Part 25 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Recurring code families, continued

### B72: the italic-title pass read structure off the text

Found reading `italicizeSlice` for B70's splice,
which left open that a quoted title inside an emphasis span was rewritten in asterisks there too.
The archive side read structure the same way:
`archiveItalicSpans` (`corpus-run/archive-italic-spans.ts`) split each line of a slice at its stars,
so words inside an HTML comment or an MDX expression read as italics,
a span across two lines read as its first line's words,
a linked title read as link markup and never as a title,
and a span set with underscores was never read.

Measured first with the site's compiler
(`@mdx-js/mdx` with `remark-math`,
comments rewritten as the site's build does;
`italic-in-emphasis-census.mjs`)
over the 92 archives at the pin and the 273 settled pages,
of which it parses 272.
Its control,
one quoted title inside emphasis,
one inside bold and one outside,
counted 3 found,
1 inside emphasis and 1 inside bold.
The pass finds one quoted archive title in the archives and two in the settled pages,
none inside emphasis or bold.
The two readings of the archives' titles differ by nine
(`italic-title-reading-diff.mjs`,
`italic-star-only-where.mjs`):
five only the split reads,
four of them inside MDX expressions in `XIEPT2` and `shihai4h`
and one the first line of a span in `Susiethegamer`;
four only the parse reads,
three linked titles in `Futajuhuacha` and `zhangyubaka`
and that whole span in `Susiethegamer`.
None of the nine stands quoted in any archive or settled page
(`italic-reading-effect.mjs`),
so the fix changes no current output.

Fixed (`db01484f7` red,
`f0bad6d25`,
then cases in `d38620f38` and `3429c8229`):
`emphasisSpans` (`corpus-run/emphasis-spans.ts`) blanks HTML comments to spaces of the same length,
reads the text with `parseBodyTolerant`,
and returns each emphasis node's offsets and words,
its text and inline code in document order with a hard break read as a line feed,
on one line.
`archiveItalicSpans` reads those words,
and `italicizeSlice` parses a slice only when it quotes an archive title in prose,
then leaves quoted any title that overlaps an emphasis span.
`treeNodes` moved to `mdast-tree-nodes.ts`,
shared with the formula floor in `translate-formula.ts`.

Four calls made here are open to veto.
The parse is the tolerant one,
strict MDX first and plain Markdown where the strict grammar refuses,
so the pass has no refusal arm:
with the package's `parseMdxBody`,
2,251 top-level blocks of the archives and 10,724 of 272 settled pages each parse alone,
and one settled page (`yulianNyanner`) is refused whole,
so a refusal is reachable on shipped pages,
while inline emphasis reads the same in both grammars.
Only emphasis is left alone,
not bold:
italics inside bold render bold italic,
which still sets a title apart.
A quoted title is left when it overlaps an emphasis span at all,
not only when it lies inside one.
And `oneLine` folds only the space and the line feed,
though its TSDoc said every whitespace run:
the pass writes the page's own words back,
so folding a no-break space would change the page's spacing.
Measured at the pin
(`b72-whitespace-probe.mjs`,
its control counting a tab,
a carriage return and a no-break space),
no quoted span of an archive or settled page holds whitespace other than those two,
nor does any emphasis span of the 272 settled pages the compiler parses,
and one archive emphasis span holds a narrow no-break space.
The TSDoc now says what the code folds.

With the emphasis skip,
the comment mask and the hard break's line feed each turned off in one build,
the case covering each failed and nothing else in the file.
The case for words inside an HTML comment passes with the mask off,
since plain Markdown reads a comment as an HTML node,
which is why `d38620f38` puts a JSX comment beside one:
the strict grammar reads it as an expression only once the HTML comment is blanked.
The readers' own tests failed as named with `treeNodes` made recursive
(the deep tree,
a `RangeError`),
the parse made strict alone
(the refused text,
an `MdxParseError`)
and `oneLine` folding every whitespace character
(the no-break space),
the last in a build of its own (ledger M89).
Each was restored,
and the tree read clean.

Its census at `3429c8229`
(`census-apleN5`,
1,475 passes,
taken clean)
reads against `census-vi1FHB`:
ran 0,
still cold 1,103,
cold since then 4,
not loaded 6,
claimed sources with no stretch there 0,
sources edited since then 2
(`archive-italic-spans.ts` loaded with 0 cold stretches,
and `archive-italic-title-restore.ts` with 1,
its `break` on a quote that never closes,
cold at the baseline too).
Library source went from 747 stretches over 1,435 lines in 275 files to 746 over 1,432 in 274:
the star split's stretch went with it.
The suite prints one pass line per top-level suite,
so the 3 more passes are the new test files' three suites,
and the cases added to an existing file add none.
The 4 cold since then are the other packages' stretches `census-vi1FHB` read as run
(`with-timeout.ts` 57-59,
`create-logger.ts` 240-247 and 366-373,
`error-format.ts` 31-58),
and no commit since touched those packages,
so they come and go with run timing:
cold in `census-DapwaX`,
run in `census-vi1FHB`,
and cold in `census-apleN5` and in the census one commit before it (`census-NUrxKe`).

Recurrence:
a reader of a page's structure,
block or inline,
reads the parse the site's build reads,
with comments masked as that build masks them,
never a split of the text at a delimiter;
and a helper moved into a module of its own gets a unit test of its own in the same change
(ledger M88).

### B73: numbers read out of text more leniently than their writers write them

Found beside B71,
which left the package's other number reads from text open as a family.
`Number` reads an empty or blank text as 0,
takes a hexadecimal,
binary,
octal or exponent spelling,
a sign and surrounding spaces,
and reads a digit run past `Number.MAX_SAFE_INTEGER` as a neighbouring number,
or one past the largest double as `Infinity`.
`Date.parse` reads a date-time without its zone as local time,
a date alone as midnight UTC,
and spellings outside the ISO format by a fallback each engine defines.
Each reader here that took text through one of them
took spellings its writer never writes.

What the red commits (`51dc87e82`,
`81f96f2a2`,
`977724373`,
`26d5849db`,
`ee2d57372`,
`a381f9da1`)
show each reader doing:

- the stage roster counted `(/2 heard`,
  `(-1/2`,
  `(0x1/2` and `(1e0/2` as units;
- the cap census paired a stream whose content count was empty,
  `-5` or `1e3` as delivering 0,
  -5 and 1000;
- call timing read `elapsed ms` as 0,
  and round timing read an empty,
  signed or exponent duration without throwing;
- the spend line took `prompt=0x5`,
  `5e0` and `+5`,
  and costs its writer's `String` never spells;
- the grade sheet called a heading with no number "headed 0";
- numbered reference lines,
  the cache account's source commit and version,
  and Han numerals read a digit run two past the exact range as its neighbour;
- the asked count and the rendering audit's arguments truncated 40.9 and 4.9;
- the fidelity and coverage probes fell back to their default for `--cap fourty`,
  took -3,
  and read `--cap`,
  `--only` and `--damage` written last as unwritten;
- the roster card listed a blank field as 0,
  `$0x1` as one dollar a token,
  OpenRouter's `-1` (a price it does not quote) as a negative price,
  and a 401-digit price as `Infinity`;
- the two grace windows,
  the hard cap,
  spend ceiling,
  Bedrock credit and request pace took a hexadecimal,
  an exponent,
  a sign,
  spaces around the digits and a point with no digit on one side,
  so `0x3E8` or `1e3` set a value the operator did not write as such;
- the overlap dial refused a value set to blanks,
  where every other numeric variable reads blanks as unset;
- the meter reader,
  call timing and the cap census read a log stamp without its zone 14,400 seconds late
  on a machine at UTC minus four hours (`stamp-reads-probe.mjs`),
  and a date alone at midnight UTC;
  a stamp cut off part way became NaN,
  which call timing kept as a call's end that `measureInFlight`'s sort cannot order,
  and the cap census as a sample's time that pairs with nothing and counts as before the caps.

Measured before fixing:
every stored log record these readers take is spelled as its writer spells it
(1,630 stream lines,
551,805 `SPEND` lines,
287,785 round lines and 1,305 stage findings;
each scan flagged the malformed lines planted in its control),
so the fix refuses no stored log record.
Over the 28 stored provider listings
(`listing-number-probe.mjs`,
with a control file of planted values),
the 7,870 prompt and completion values,
four of them planted,
hold 20 written `-1` by OpenRouter,
10 of each,
and 2 written `0.042e-6` in LLM Gateway's catalogue,
the only exponent;
the fix reads those two as before and lists the 20 as not listed,
where the card printed a negative price.

Fixed (`73984a59a`,
`a572a1cac`,
`65dd1e6a8`,
`0ebf573a3`,
`f3c4a1c59`,
`93a0d06b1`,
with the guard red at `6006f9816`).
The shared rules:

- `whole-number-text.ts` holds `isWholeNumberText`
  (ASCII digits a double holds exactly,
  leading zeros read as written),
  cited by every refusal as `WHOLE_NUMBER_RULE`;
  `isNegativeWholeNumberText`
  (a minus sign before a whole number more than zero),
  so a reader can answer a count under zero in its own words;
  `isDecimalText`
  (digits,
  or digits,
  a point and digits);
  and `isUnsignedNumberText`
  (a plain decimal with an optional exponent,
  as JSON writes a number).
- `iso-stamp-text.ts` holds `isIsoStampText`,
  which takes a stamp only when `toISOString`,
  the logger's writer,
  writes the instant `Date.parse` read back as the very text read.
- `corpus-run/command-flags.ts` holds `flagValue`,
  `wholeNumberFlag` and `idListFlag`,
  the probes' one reader of a flag and its value.

Where each applies:
a count the package wrote is read through `isWholeNumberText`,
the spend line's cost by spelling back what `String` wrote,
and a log stamp through `isIsoStampText`.
A count or flag an operator types is digits;
the hard cap,
spend ceiling,
Bedrock credit and request pace are a plain decimal,
then finite;
the grace windows are digits;
and every numeric variable reads blanks as unset.
A listing string is read through `isUnsignedNumberText`,
then finite and not under zero,
a listing number finite and not under zero,
and anything else is `NOT_LISTED`,
so the card asks for the field rather than printing a number nobody listed.
Call timing gains an `unstamped` kind,
counted as `callsWithoutStamp` and printed by `run-timing-report`;
`readCapLog`
(once `capSamplesOf`)
returns its samples with `unstampedLines`,
which `cap-census` prints;
and the meter reader skips the line as it skipped an unreadable stamp before.
`admitWithinShortfall` named each passage by its position written as text,
and two of its three callers read the admitted names back with `.map(Number)`;
a passage now carries its position as a number.

Calls made here are open to veto:

- a count is digits only,
  and leading zeros read as written;
- the asked count and the audit's arguments refuse 40.9,
  reversing cases agent commit `4133bf926` pinned to truncate,
  which no doc records as an owner ruling;
- `-0` draws the rule's own refusal,
  and a minus sign before digits is answered as a count under zero;
- the overlap dial and the request pace read blanks as unset,
  as the other dials did;
- a listing price takes the JSON number spelling,
  exponent included,
  since a stored catalogue writes one,
  and OpenRouter's `-1` reads as not listed;
- the operator's fractional dials take a plain decimal,
  exponent refused,
  and the grace windows digits;
- a log stamp is read only in `toISOString`'s spelling,
  so one naming the right instant without milliseconds,
  with `+00:00`,
  or with a six-digit year before 10000 is refused too:
  a line carrying one did not come from the logger as written;
- a log line whose stamp the logger did not write is left out and counted,
  not thrown on,
  so one such line costs its call,
  not the report.

The guard is `number-reads.unit.test.ts`,
which `source-scans` runs.
It finds every call of `Number`,
`parseInt`,
`parseFloat`,
`BigInt`,
`Number.parseInt`,
`Number.parseFloat` and `Date.parse`,
with or without `new`;
`new Date` given an argument;
a unary plus on anything but a literal;
and any of those readers handed on as a value.
Each read is keyed by file,
enclosing named function and reader,
and the package is held to 43 keys and 48 reads,
each naming the rule that holds it to its writer's spelling,
or why it reads no text.
Two kinds read outside the shared rules are named there with why:
hexadecimal prefixes of the package's own digests
(`translate-slate.ts`,
`corpus-run/window-trial-order.ts`)
and the digits opening an engine message (`run-json-read.ts`).
Out of its reach:
a reader reached through `globalThis` or a renamed binding,
and arithmetic on text.
Its first count
(`number-reads-probe.mjs`,
35 keys)
missed the readers handed on as values and `Date.parse`;
widened before it became the guard,
the scan found the six more that `f3c4a1c59` and `93a0d06b1` fixed (ledger M90).

Guard-offs ran on every fix
(each commit message records its own).
On the last two:
`isIsoStampText` without its write-back check failed its refusal case,
the stamp case of each of the three readers and call timing's count case;
each reader's own check removed with the rule intact failed that reader's case in each file and nothing in the rule's;
the left-out counters disabled,
the stream line's and call timing's in one build and the `SPEND` line's in another,
failed the cases counting them.
The scan without its detection of readers handed on as values,
of unary plus,
or of a type name as no read failed its fixture case;
without its detection of `new Date`,
both its cases;
and with one read unlisted,
its package case.
Each was restored,
and `git diff` printed nothing after.

Found on the way and open:
a flag written twice is read at its first value (closed by B75);
plain-object tables are looked up and filled by text from outside the package,
which reaches a prototype's keys
(the fidelity probe's defect table closed by B75,
the rest by B77);
the request pace's real-clock case flaked,
18.89 and 18.99 milliseconds against a 19 millisecond bound,
recorded with the elapsed-time family (B78);
`readCapLog` copied its queue of a label's streams at every stream line,
a copy `fold-copies.unit.test.ts` did not read (closed by B74);
and `run-timing-report` prints its count of completion lines without a duration before a fixed plural,
which the open family of counts before a fixed plural covers.

Recurrence:
a reader of a number in text takes only the spelling its writer writes,
through a shared rule
(`whole-number-text.ts`,
`iso-stamp-text.ts`)
or a round trip through the writer,
and an operator's text through the same rules,
saying what leaving the value off does;
`number-reads.unit.test.ts` fails on a new read until it names its rule.

### B74: map entries rebuilt as copies at every repeat of their key

Found reading `readCapLog` (`corpus-run/cap-census-read.ts`) for B73.
Each completed stream spread its label's queue into a new list,
and each pairing set the queue to a `toSpliced` copy,
so a log's streams of one label cost the square of their count:
the shape B70 removed from folds,
moved into a map.
`fold-copies.unit.test.ts` read `reduce` callbacks and loops reassigning a binding as a copy of itself,
not a map entry set to a copy of what the map held,
so it could not see this.

The guard now also reads,
inside a loop,
a call `R.set(key, value)` whose value copies what `R.get` read,
directly or through a name bound to that read,
by the copying shapes it reads elsewhere,
and it reads a path through `??` or `||` from its left side.
Its fixture case gains a map entry spread into a new list,
one cut with `toSpliced` through a bound name,
one appended in place and one copied outside any loop;
the first two are found and the last two are not.
At `9e01f2650` its package case found five unnamed
(a probe built from the guard's own functions printed them):
`aggregateClaims`' `byComponent`,
`censusByGeneration`'s `byDigest`,
`indexProposers`' `index`,
`readCapLog`'s `waiting`
and `gatherRelabelCases`' `byRegion`,
each rebuilding a list held in a map entry at every repeat of its key.

Fixed (`9e01f2650` red,
`fde3a7298`,
then cases in `81ec51782`):
`aggregateClaims` groups with `Map.groupBy`,
which keeps member order within a group and the groups in the order their first members come;
the other four push onto the entry's list,
`readCapLog` splicing a paired stream out in place,
`indexProposers` copying a claim's first proposers once so a record's own list is never appended to,
and `gatherRelabelCases` gathering through a local type whose positions list is writable.

With each append disabled in one build,
the cases of `aggregate-claims`,
`attribution-report`,
`artifact-eligible` and `pool-generation` failed,
and those of `cap-census` and `probe-relabel-gathering` passed:
no case had two completed streams of one label waiting,
and none drew one region twice.
`81ec51782` adds both,
the second drawing the windowsill edit again at position 7,
the position `DAMAGED_CASES` records as the same edit drawn under a second accepted issue.
With the two appends disabled again,
both new cases failed
(the cap census read `[ 11, 'unpaired' ]`);
with the queue's splice removing nothing,
the cap census case read `[ 22, 22 ]`;
and with the guard's map check disabled,
its fixture case failed.
Each was restored,
and `git diff` printed nothing after.

Recurrence:
a loop that groups or queues by key appends to the entry's list,
or groups with `Map.groupBy`,
and removes in place;
it never sets an entry to a copy of what the entry held.
`fold-copies.unit.test.ts` fails on a new one.

### B75: command lines read token by token, each runner for itself

Found beside B73,
which gave a flag's value one reader (`flagValue`)
and left each runner finding the flag itself.
Every runner found its flags with `indexOf` or `includes` on the exact token,
so a flag written any other way read as not written at all,
and nothing said which tokens a runner reads.

What the red commit (`6035e9b03`) shows each reader doing:

- `readOnlyIds` read `--only=Tabby_01`,
  and the mistyped `--olny Tabby_01`,
  as no filter,
  which `corpus-pass` runs as every pending entry;
- `readOnlyIds` and `flagValue` took the first of two `--only` or `--naps` values
  and dropped the second without a word;
- `flagValue` read `--naps=3` as unwritten;
- `readAuditArguments` read `--cap=0`,
  and `--cpa 0`,
  as no cap,
  which the settled audit runs as buying every subject in the archive;
- `readCandidateIds` read `--candidates=<ids>` as none,
  so the probe ran the seated roster and none of the models it was started for.

The named run of the four files printed exit 1 for each,
with 3,
2,
2 and 1 failing cases.
Read in the same sweep and recorded in the fix's message (`97aeee2ca`):
`sentinel-probe` dropped flags and probed the value after one as an entry id;
`coverage-control-probe` read `--only` written last as every entry;
`score-agreement` and `score-probe` read a flag written with an empty value as their default file;
`ledger-report` read `--model --x` as a seat named `--x`;
a runner that takes no flags ran as if nothing had been typed after it;
`--damage constructor` found `Object.prototype.constructor` in the fidelity probe's plain-object defect table
and handed a function on as the defects to build;
and the descriptions of five mise tasks left out flags their runners read
(`b78a90e4a`'s red case names them).
Found while closing it (`dd882e587` red):
`roster-card` answered an empty served id and a provider outside the four alike,
with the bare usage line,
and the provider and candidate readers named a refused id unquoted,
so a spaced one read as two words of the message.

Fixed (`97aeee2ca`,
`1f37aa07d`,
`b78a90e4a`,
`b8ba86137`,
`911d9afc3`,
`1241086aa`,
`5a3e38037`,
with the guards in `6f45620da`,
`c5d814d14` and `4dded7d92`):

- `corpus-run/command-line.ts` holds `readCommandLine`,
  the one reader of a runner's whole line.
  Node's `parseArgs` splits it,
  with `strict` off and its tokens kept,
  so the equals form,
  the `--` terminator and grouped short flags read as they do for every Node command,
  and every refusal is written there,
  all at once,
  ending with a usage line built from the declaration.
  It refuses a flag the runner does not read,
  a valued flag with nothing usable after it
  (nothing,
  an empty argument,
  or the next flag),
  a switch given a value,
  a once-only flag written twice,
  an argument past the last position read,
  and a required position left out.
- `corpus-run/command-lines.ts` declares,
  for each of the 42 runner entries,
  its valued flags,
  repeatable flags,
  switches and positions,
  typed key for key by `CommandLines`
  (the package's isolated declarations cannot infer the table).
- `reportingRefusals` takes `argv` and reads the line against the entry its `what` names before the body starts,
  handing the body the line it read;
  a refusal exits 6,
  as every stated refusal does.
- The value readers in `corpus-run/command-flags.ts` take a flag's value from that line:
  `flagValue` is gone,
  `writtenOr` reads the score reports' file flags,
  and `idListFlag` trims space around each id,
  as the pass's entry filter already did.
- The fidelity probe's defect table is a `Map`.
- `ledger-report`'s own exit 3 for `--model` with no seat is gone,
  answered by the shared refusal;
  `score-probe` refuses one of `--repair-sheet` and `--manifest` without the other,
  where it printed its unscored note and dropped the file named;
  `readAskedCount` refuses an empty count argument.
- The five task descriptions name every flag their runners read.
- `roster-card` names each wrong part of its ask,
  both at once when both are,
  and the provider and candidate refusals quote the id they refuse;
  `CARD_PROVIDERS` in `model-card-derive.ts` is the one list `CardProvider`,
  the ask reader and `roster-card`'s declaration are written from,
  where the reader and the declaration each wrote the four names by hand.

Calls made here are open to veto:

- a minus sign before ASCII digits reads as a position,
  as Python's argparse reads one when no flag looks like a number,
  so a count typed under zero still reaches the reader that answers it as under zero;
- `parseArgs` runs loose and the package writes every refusal,
  so all of a line's problems are named at once in the words the B73 readers used,
  where strict `parseArgs` stops at the first in its own words
  (`Unknown option '--olny'` for `--olny a --paln`,
  measured on node v26.10.0);
- a valued flag takes the argument after it whatever it is,
  and refuses one starting with `--` as the next flag,
  so no value can start with `--`;
  a path starting with `--` is written after the `--` terminator,
  where only positions are read;
- a once-only flag written twice is refused,
  where `parseArgs` keeps the last value and the old readers kept the first;
- a repeatable flag (`--source` of `coverage-census`) keeps every value,
  in the order written;
- a grouped short flag such as `-abc` is refused once,
  whole,
  as typed;
- `idListFlag` trims space around each id;
- `ledger-report`'s `--model` with no seat exits 6,
  where it exited 3;
- `score-probe` refuses `--repair-sheet` or `--manifest` alone;
- `readAskedCount` refuses an empty count argument,
  reversing a case that pinned it to the default;
  B73's reading of blanks as unset covers environment variables,
  and an argument typed empty is not unset;
- a refusal quotes what was typed through `JSON.stringify`,
  so an empty or spaced value shows;
- a task description spells exactly the flags its runner reads,
  and the living docs invoke a runner only with flags it reads;
  the audit ledger is left out of that check,
  since it records what was typed when it was typed.

The guards:

- `command-line.unit.test.ts` holds the reader's readings and refusals on real runners' declarations,
  through `command-line.test-fixture.ts`;
- `command-lines.unit.test.ts` holds the table to the runner entries the build makes,
  each declaration to flag names a long flag can carry and positions that can be written,
  each runner's mise task description to exactly the flags it reads,
  and every runner invocation in the living docs to flags the runner reads;
- `cli-refusal.unit.test.ts` holds a refused line to exit 6 before the body runs,
  and the body to the line as read;
- `command-line-reads.unit.test.ts`,
  which `source-scans` runs,
  reads the package's source for `argv` read off `process`
  or off a whole import of `node:process`
  (as a member,
  an indexed or optional member,
  or through a parenthesis or type assertion),
  `argv` destructured from `process` or imported from `node:process`,
  `parseArgs` imported from `node:util` or read off a whole import of it,
  dynamic imports of either module,
  and a `reportingRefusals` call handed another argv or naming a runner other than its own file;
  it allows only `command-line.ts`'s import of `parseArgs`,
  and requires a hand-off from every runner the build makes.
  Out of its reach:
  `process` reached through `globalThis` or handed on whole,
  and a property name built at run time.

Guard-offs,
one mutation per build,
each restored with `git diff` printing nothing after
(`~/temp/agent/audit-glossary-fix/b75-guard-offs.ts`):
an unknown flag read as a switch failed the reader's mistyped-flag,
flagless-runner and prototype-name cases and `cli-refusal`'s refused-line case;
a repeated once-only flag let through failed the repeat case;
an empty value let through,
and in another build the next flag taken as the value,
each failed the valueless-flag case,
the first also the fidelity probe's case for a flag written last;
a switch's value let through failed the switch case,
and the fidelity probe's again;
the once-only lookup made with `in` failed the prototype-name case
(`--constructor needs a value written after it`);
a minus number read as short flags failed the number case
(`-35 is not a flag this command reads`);
arguments past the last position kept failed the past-position,
mistyped-flag and flagless-runner cases and `cli-refusal`'s;
a required position let go failed the past-position case;
the defect table looked up as a plain object failed the fidelity probe's defect case;
a description without `--manifest` failed the description case;
and a runner renamed in the table failed the table and description cases.
The scan
(`~/temp/agent/audit-glossary-fix/b75-scan-guard-offs.ts`)
failed its fixture case with each detection removed in turn:
whole imports of `node:process`,
wrappers,
bracketed names,
destructuring,
`argv` imports,
`parseArgs` imports (its package case too),
`parseArgs` read off a whole import,
dynamic imports,
a hand-off naming another runner,
one handed another argv,
and a hand-off counted as the file's own whatever runner it names;
its package case failed with `spend-report` naming another runner,
and with it copying the line before handing it on.
With `roster-card`'s ask keeping only its first problem,
the case naming both failed;
with `--plan` misspelt in `mistake-prevention.md`,
the invocation case failed naming `mistake-prevention.md:57 corpus-pass --paln`.
Before the invocation case,
a scratch sweep over every tracked Markdown file under the package and `doc/`
read 69 invocations and found no undeclared flag,
and reported both invocations planted in a control file.
The full suite on `3d8776f9f`
(`mise run //package/module/translation-repair:buildAndTest`)
printed 1,489 PASS lines and no FAIL line.
Later,
with `reportingRefusals` running the body once on a placeholder line before reading the real one,
`cli-refusal`'s refused-line case failed on `ran`
(`expected true to equal false`),
so its check that the body never starts carries weight of its own;
restored,
with `git diff` printing nothing after.

Found on the way and open:
an `--only` naming no entry runs over none without a word
(closed by B76);
and the package's other plain-object tables looked up or filled by text from outside it
(the family of prototype keys,
closed by B77;
the defect table is closed here).

Recurrence:
a runner declares what it reads in `corpus-run/command-lines.ts`,
reads only the line `reportingRefusals` hands it,
and reads a flag's value through `corpus-run/command-flags.ts`;
`command-lines.unit.test.ts` fails on a runner,
description or documented invocation out of step with the table,
and `command-line-reads.unit.test.ts` on a read of the line anywhere else.

### B76: ids a line names that its runner cannot reach, dropped without a word

Found closing B75.
`corpus-pass`,
`coverage-probe`,
`coverage-control-probe` and the settled rendering audit each kept the entries `--only` names with the same predicate,
and dropped any it could not reach:
an `--only` naming only a stray ran over nothing,
the settled audit printing `BUYING 0 of 0 selectable subjects`
and `coverage-control-probe` refusing as though no entry had offered a passage,
and a stray beside a real entry ran the real one alone.
`sentinel-probe` read its entry ids by position without a check,
so an unknown one printed an error line of its own while the probe spent on the rest.
`judge-fidelity-probe` already refused an entry its reviewed manifest lacks
(`selectReviewedFidelitySpecs`),
the first one only.

`28cbadd6a` moved the four predicates into one,
`askedAmong` in `corpus-run/command-flags.ts`,
with no change in what it keeps
(cases pin both readings).
The red commit (`31021fe29`) added what each refusal names to its parameters,
which every site passes,
and cases for a stray alone,
two strays beside a real id with one written twice and one spaced,
and the settled audit given `tabbby` beside `tabby`;
the named run printed exit 1 for both files,
the new case the only failing one in each.

Fixed (`4f9b79155`):
`askedAmong` refuses the line when any id asked for is missing from what the runner can reach,
naming every stray once,
in the order written and quoted:
`--only asks for "Tabby_0l", which the corpus at the pin does not hold`.
The four sites refuse before anything is spent,
and `sentinel-probe` holds its ids,
named or default,
to the corpus at the pin before it probes any.

Calls made here are open to veto:

- one stray refuses the whole line,
  where running the reachable ids and naming the strays would also have been possible;
  the line is refused because a mistyped id is a line the person did not mean;
- `sentinel-probe` probes in corpus order,
  as the other runners walk,
  where it probed in the order written;
- the settled audit's reachable entries are those the archive holds a reading for,
  so an entry with a reading and nothing to buy still runs,
  and reports `BUYING 0 of 0`;
- `judge-fidelity-probe` keeps its own refusal,
  which names the first stray only,
  since its reachable entries are a reviewed manifest's and its error class reports them.

Guard-offs,
one mutation per build,
each restored with `git diff` printing nothing after
(`~/temp/agent/audit-glossary-fix/b489-guard-offs.ts`):
strays let through failed both new cases;
a stray written twice named twice failed the `askedAmong` case;
strays named unquoted failed both.
The full suite on `e009f5d28`
(`mise run //package/module/translation-repair:buildAndTest`,
with the worktree clean)
printed 1,490 PASS lines and no FAIL line.

Recurrence:
a runner that narrows its walk by id passes the ids asked for and the ids it can reach through `askedAmong`;
`command-flags.unit.test.ts` holds the refusal.
