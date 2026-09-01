# Translation repair history: segment 2.2

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

-   `HardCapOverrideError` quotes what the hard-cap environment variable held.
    That is an operator's own input,
    not corpus text,
    and quoting it is the point:
    an operator who set a ceiling believes the run is bounded the way they asked.

-   `SyntheticHttpError` carries 600 characters of a provider's HTTP error body.

### The third is a judgment, and it is being recorded rather than changed

A provider's error body is the provider's text,
not ours.
The one instance recorded in this handover is
`{"error":"You've exceeded your subscription rate limits. Upgrade, or try again later..."}`,
which echoes nothing.
A provider COULD echo part of a request in a 400,
and a request carries corpus wording,
so the path is not impossible.

It stays as it is,
for two reasons the owner has already stated.
Provider issues are normal and expected and the pipeline must stay diagnosable through them,
and the standing instruction on logging is to add more where it is thin,
not less.
An excerpt bounded at 600 characters is the diagnostic that makes a provider fault legible.

Recorded here so it reads as a decision rather than an oversight,
which is the same treatment the `raw=` warn logs already have.

### What this closes

The three defects found by hand (`#220`,
`#224`,
`#225`) all came from a parser's own message
or from a cause chain,
never from a class this package wrote.
That is now a measured statement about all seventy-five rather than an impression from three.

## Every entry point now reports its refusals, settled by measurement (`#226`, 2026-08-25)

`#223` wrapped nine CLIs when `reportingRefusals` caught exactly one class.
It now catches everything,
so the list should be every entry point,
and now is:
29 more were wrapped,
in `f92df6042`.

This section keeps the argument that held the change back for a day,
because the argument was sound and the thing that resolved it was evidence,
not a better argument.

`refusalText` forwards a message only from a class that declares it quote-free,
and four classes declare it:
`RunJsonUnreadableError`,
`LedgerShapeError`,
`FrontMatterParseError`,
`MdxParseError`.
Wrapping a CLI therefore turns
`ArtifactParseError: <what it says>` into `refused by ArtifactParseError` plus frames.
For a report CLI that is a small loss.
For `corpus-pass`,
the production driver,
it is the diagnostic that matters most.

The scan of all seventy-five error classes cuts both ways here.
It says none of them quotes,
so forwarding their messages would be safe today,
which makes the conservative default look like pure cost.
It also says nothing about the seventy-sixth,
and a library added later reintroduces the risk silently,
which is the whole reason the default fails closed.

Three ways out,
and they are not equally good:

-   Mark all seventy-five classes.
    Restores every message,
    and makes the marker mean
    "audited" rather than "constructed safe",
    which is a weaker claim than the marker
    currently makes.
-   Wrap only the report and probe CLIs,
    and leave `corpus-pass` alone with its reason
    recorded,
    the way `ledger-report` is already excluded for a reason of its own.
-   Wrap everything and accept that an unexpected fault is located by frames rather than
    described by a message.

### The premise that it needed the suite was wrong

The sentence this section used to end on said deciding without the suite
would be guessing at what the output reads like.
That was a refusal with an unconsidered bridge behind it.
`node --experimental-strip-types` runs the package source directly,
so the output could be read at any point without building anything,
and the whole decision took one throwaway fixture under `~/temp/agent`.

The same bridge answered a question the section never thought to ask,
and answered it against the section's own numbers.

### What the census actually was

Twenty-five was wrong.
There are 38 entry points,
9 of them wrapped.
The count was low because the search looked for `if (import.meta.main)`,
and 13 entry points did not have it:
they ended in a bare top-level `await main();`,
which runs on import.
Nothing value-imports any of them today,
and the one import that exists takes only a type from `roster-bench`,
which erases,
so this was a latent hazard rather than a live defect.
They now carry the guard the other 16 had.

### The four cells

Each cell is one process,
source run on a throwaway fixture,
stderr measured in bytes:

```text
bare, marked error        exit 1, 708 bytes   stack dump, plus Node spilling the
                                              error's own fields as an object literal
wrapped, marked error     exit 4, 193 bytes   the message, and what to do next
bare, unmarked error      exit 1, 554 bytes   class, message and stack
wrapped, unmarked error   exit 5, 662 bytes   class and frames, message dropped
```

Read against the three options,
this picks the third and weakens the case for the first.

Wrapping is an outright win on the refusal path:
708 bytes of stack and spilled fields become 193 bytes that say what happened.
On the fault path it costs the message and buys a code.
That code is the part the options list undervalued:
unwrapped,
a refusal,
a fault and the command's own verdict are all `1`,
and no gate or operator can tell them apart.

Marking all seventy-five classes stays available and stays the lever
that gets the message back on the paths where it matters.
It is now an improvement to make on top of a working separation,
rather than a precondition for making any change at all.

### What was measured before the change rather than after

That a wrapped CLI still leaves its own verdict alone.
`reportingRefusals` sets `process.exitCode` only inside its catch,
which the source says and a probe confirmed:
`verify-published` on an unreadable run directory exits `2` either way,
with byte-identical output.
Reading that off the source would have been an inference about unchanged code.

Type-check and lint carry the same 20 findings after the change as before,
all of them in the three test files waiting on a rebuild,
none in the 29 files touched.

## The cause sweep, which the message scan had missed (2026-08-25)

Scanning seventy-five error classes checked their `super()` MESSAGES.
It said nothing about their causes,
and a cause chain is exactly how `#225` travelled:
a clean message carrying a quoting cause that Node's reporter renders anyway.

So the same question was asked of causes.
Every site constructing an error with `{ cause: error }`,
and what that cause can hold:

-   TWO PARSER CAUSES,
    `FrontMatterParseError` and `MdxParseError`.
    Fixed in `7b81a95c3`;
    neither carries a cause any more.

-   THREE PROVIDER-PARSE CAUSES:
    `completion-shape.ts`,
    `stream-completion.ts` and
    `anthropic-completion.ts` each wrap a `JSON.parse` of a model's response as the cause of a
    `MalformedCompletionError`.
    V8 quotes ten characters,
    and a model's answer is a rendering of corpus text.

-   TWO FILESYSTEM AND GIT CAUSES,
    in `ledger-directory.ts` and `artifact-generation.ts`.
    One wraps `readdir`,
    the other a git revision resolution.
    Their messages name a path and a revision,
    not content.

-   ONE COMMAND CAUSE in `corpus-source.ts`,
    whose message carries the `git show` command line.
    That names an entry id,
    which these tools print by design:
    `ledger-report` and `verify-published` both report per entry.

-   TWO ABORT CAUSES in `stream-cut.ts` and `stream-drain.ts`,
    carrying an abort reason.

### The provider three are dominated, and that is measurable rather than arguable

`stage-call.ts` already logs `raw=${JSON.stringify(opening,)}` on every lost-voice warning,
bounded at `RAW_PREVIEW_CHARS = 120` grapheme clusters of the model's text.
Its own note records why that bound exists and what it bought:
the Kimi-K3 outage was a two-character channel marker,
507 mismatches in one pass were explained by it,
and its 2026-08-13 recurrence was explained the same way from `p|>` and `ep|>`.

So the deliberate disclosure is 120 characters,
on a routine warning,
to the run log.
The cause is ten characters of the same text,
only when the answer is malformed JSON,
and only if the error reaches a printer.
Twelve times smaller,
far rarer,
same destination.

They stay.
Changing them would trade a diagnostic the owner asked for
against an exposure strictly smaller than one already accepted beside it.

### What this sweep does and does not cover

It covers two channels:
an error's own message,
and its cause chain.
It does not by itself cover a third,
a value written into a persisted record rather than thrown,
which is how `attribution-read` was leaking in `#224`.
That one was found by reading call sites,
and no mechanical scan has been built for it.
Naming the gap here so a later session knows which of the three has no scanner.

## A stream the provider cut short was the one transport failure that never retried (`#228`, 2026-08-25)

Found by reading the running calibration's warnings rather than by suspecting anything:

```text
      4  MalformedCompletionError
      2  SyntaxError
```

All four are `panel gemma-4-26b-a4b-it`,
all four say
`anthropic stream ended without message_stop, voice lost`.
The two `SyntaxError` are the critic schema mismatches already recorded.
With the 13 straggler cuts in the same log,
the three classes account for every voice
the run never heard,
which is how this class was separated from the other two at all.

### Why it never retried, which is more interesting than that it did not

`hyper-client.ts` and `synthetic-client.ts` both call `exchangeWithRetry`
and then extract the completion AFTER it returns.
A truncated body arrives as HTTP 200.
That status is not in `RETRYABLE_STATUSES`,
so the ladder hands the reply straight back,
and extraction throws with nothing left that could re-dispatch it.

Every other transport failure carries a status the ladder recognises.
This one wears a success status,
which is exactly why it was invisible:
the ladder was working correctly and the failure was outside it.

### The fix follows a design that was already there

`attemptExchange` catches a thrown failure and asks ONE predicate,
`isSelfEndedStream`,
whether we caused it,
so that a runaway we cut is never re-dispatched.
Running the caller's read inside that same `try` puts a truncated body on exactly that path:
same catch,
same predicate,
same ladder.

So the terminator pass moved out of each extractor into an exported check,
`requireAnthropicTerminator` and `requireStreamTerminator`,
and `attemptExchange` gained an optional `verify` it runs before returning.

RULED OUT FIRST,
because retrying our own deliberate cut would be a bug:
the guards throw their own classes,
`StreamStalledError` and `StreamCutShortError`,
and an aborted drain THROWS with `partialText` rather than RETURNING a short body.
The only `return bodyText` in `stream-drain.ts` is the normal completion path.

### Measured from source, without a build

`dist/final/node` is held by the calibration,
so the boundary proof ran under
`node --experimental-strip-types` against `src/`,
with a fake transport and no key.
Both providers,
four cells each:

```text
  cut every time        attempts=5  MalformedCompletionError
  cut once, then whole  attempts=2  answered
  whole every time      attempts=1  answered
  HTTP 400 error page   attempts=1  SyntheticHttpError
```

Row two is the voice that used to be lost.
Rows three and four are the controls,
and row four is the one worth naming:
`wholeMessage` checks `isSuccessStatus` first,
so a non-success reply is never read as a stream.
Without that guard a 400 carrying an error page would report a parse failure
instead of the HTTP code,
which sends a reader to the prompt rather than to the provider.

### What the suites now assert, and what is still owed

Landed in `38a5178d7` (fix) and `05928328e` (tests).
Each client suite gained the two cases,
and the Hyper suite's existing terminator test
gained the attempt count it had been missing:
it ran on the production ladder,
paying about seven seconds of real backoff
to assert something the count now states outright.

The third path needs no new test.
Each suite already refuses a non-success reply whose body carries no terminator,
`out of credits` and `{"error":"slow down"}`,
so removing the `isSuccessStatus` guard inside `wholeMessage`
turns both into a parse failure about an error page.

NOT YET RUN.
The suites import `../dist/final/node/index.mjs`,
and rebuilding would swap the bundle out from under the pass in flight.
Owed at the same moment as `#224` and `#225`:
build once,
run the suites,
then prove each guard by removing it.

## Which error messages may be repeated, decided by a rule rather than an audit (`#227`, 2026-08-25)

`refusalText` repeats a message only from a class declaring `messageNamesOnly`,
and four of
eighty-five classes declared it.
So an operator meeting a domain refusal at a CLI boundary
read `refused by RosterConfigurationError` and learned nothing about what was wrong.

The obvious move,
marking all eighty-five,
is the one to refuse.
A 2026-08-25 scan did find that none of them quotes what it was handed,
but marking on that basis makes the marker mean "audited on a Tuesday"
rather than "constructed to name and never quote",
which is a weaker claim than the marker
already makes,
and it decays silently.

### The rule

A class may declare the marker when the CLASS writes the sentence,
and every value it interpolates is a number,
one of our own names,
or a value the operator supplied.

A class whose constructor forwards a `message` parameter to `super` may not,
however careful its throw sites are.
The claim would then be about thirty call sites rather than about one class,
and nothing could check it.
`StatedRefusalError` is the deliberate exception and carries its own note saying so.

That line is what makes the rest mechanical.
Thirty-four classes forward a message.
Fifty-one write their own sentence.

### What the scan found, reading every site rather than sampling

Across 490 construction sites outside the suites,
the free-text fields turned out to be
authored phrases almost everywhere:

-   `ArtifactParseError` has 93 sites,
    and all 77 distinct `reason` values are shape
    descriptions written by us,
    `a boolean`,
    `a record`,
    `distinct members`.
-   `MalformedCompletionError`,
    `QuotaShapeError` and `CreditsShapeError` take a `detail`
    that is an authored phrase at every site,
    naming which part of the protocol broke.
    None carries a byte of the body.
-   `TranslateAbsenceError` is the best case:
    its `reason` is typed `TranslateAbsenceReason`,
    a closed union,
    so the type proves what the inventory would otherwise assert.

Forty-two classes gained the marker,
joining the five that had it.

### Four that write their own sentence and still stay unmarked

Recorded rather than left silent,
because an absent marker looks identical to an oversight:

-   `SyntheticHttpError` interpolates an excerpt of the provider response body,
    on purpose.
-   `MislabelledArtifactError` takes `caughtValueText(error)`,
    which renders a caught error's
    own message.
-   `StreamCutShortError` reaches the message through `String` of an unknown abort reason.
-   `ArtifactProvenanceError` interpolates `expected` and `observed`,
    whichever field
    disagreed,
    which may be text.

### The guard, and why it is a source scan

`src/message-names-only.unit.test.ts` reads the source and checks four things:
the marked set equals the recorded list,
every interpolation in a marked message is named in
an inventory that says what it holds,
no forwarding class carries the marker,
and every
owning-but-unmarked class has a recorded reason.

A behavioural test would have pinned today's wording,
which is not the property worth
guarding:
rewording a sentence is fine,
and interpolating a new value into it is the thing
that needs a second look.

GFP-PROVEN,
four probes,
each restored afterwards:

```text
  marked but not recorded    KEEPS exactly the classes ... FAIL   exit 1
  message gains a new part   ACCEPTS only the message parts ... FAIL   exit 1
  owning class unmarked      KEEPS exactly ... + KEEPS a reason ... FAIL   exit 1
  withheld class marked      three of four FAIL                        exit 1
```

The second probe fails that assertion and no other,
which is the isolation worth having.

WHAT IT CANNOT CATCH.
A field the inventory already names,
such as `detail`,
can be handed
different text by a new throw site.
The inventory records what each field holds today,
and
that kind of change is caught by reading,
not by this file.
The stronger form would put the rule in the type system,
with the message built through a
tagged template whose interpolated values are a closed union rather than `string`.
That is a large refactor across the domain primitives and is not proposed here as part of
this landing;
it is written down as the direction if the inventory ever starts to strain.

The guard imports no built artifact,
so it runs from source while a pass holds the bundle.
Landed in `f0f15f5c3`.

## The guard proof found the guard was somewhere else (`#224`, 2026-08-25)

`#224` routed four sinks through `refusalText` and owed a proof that the routing mattered.
The proof was run the way the rule prescribes:
revert the fix,
rebuild,
run the suite,
see it fail.
It did not fail.
686 of 686 passed with all four sinks reverted to a bare `caughtValueText(error)`.

A passing revert reads as missing coverage,
and this session nearly recorded it as one.
The reason it is not is that the probe could not have failed:
a MALFORMED file reaches every sink through `parseRunJson`,
which already wraps it in a class declaring its message quote-free,
so `refusalText` returns that message and the bare expression returns the same message.
The two are the same string.
A null result from a probe that cannot show a difference means nothing,
and the control that gives it meaning is a file that will not OPEN.

### Two of the four opened without a guard

Measured on a mode-`000` fixture in a throwaway directory:

```text
POOL malformed Basket.json: EACCES: permission denied, open '/tmp/sink-probe-OXYrhl/Basket.json'
```

`attribution-read.ts` and `artifact-placement.ts` called `readFile` directly
and only PARSED through the guard,
so a file that would not open arrived as an ordinary `Error`
whose message quotes the whole path.
`refusalText` refused to repeat it,
which is the second layer doing its job,
but the only thing left to say was `refused by Error`,
and an operator reading that learns neither that the file exists nor that it is a permission fault.

`#222` recorded that all twelve run-file reads went through the guarded reader.
That was true of the parse and not of the open.
A run directory path names the run,
and under `artifacts/` a file's own stem is a person's entry id,
so the path is the sensitive half.

Landed in `f8a00627f`:
both call `readRunJson`,
which opens and parses behind one refusal:
