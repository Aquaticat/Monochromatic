# Translation repair history: segment 2.2, part 02

Part 02 of [Translation repair history: segment 2.2](translation-repair-history-05-2026-08-15-to-19-segment-02-part-02.md),
whose index lists every part in order.

## Continued record, continued

### `#108`'s pre-flight, and the capability it turned out to need

Before spending quota,
the run was checked against what exists.

ALREADY THERE:
`runTranslateStage` puts the incumbent on the ballot and rotates
the slate by a hash of the slice,
so production selection over a named slice is
invocable and the incumbent's win rate is not also a measure of position
preference.

WAS MISSING,
NOW BUILT:
the stage had NO parameter for surrounding source,
so
`#108`'s wide arm could not have been run at all.
`neighbouringSourceText`
mirrors what `judge-fidelity.ts` already does,
caveat label included,
and is
absent by default so every measurement taken before it still describes the sheet
production sends.
The narrow-sheet guard was shown to fail before being trusted,
and the first falsification was thrown away for failing the wrong way:
removing
the guard entirely made the sheet builder crash on an undefined text,
so the test
went red without its assertion ever being reached.
Redone with a defined
placeholder,
it fails on the assertion itself.

STILL TO BUILD,
and it is the only thing left before the run:
`translate-probe`
is hardcoded to one entry with a fixed slice count and takes no arguments.
It
needs an entry plus slice list,
and a flag for the wider window.

### The plumbing `#108` needs is done, and here is the one file left

`settleTranslateSlice` now takes an optional `neighbouringSourceText` and passes
it to `runTranslateStage`,
which passes it to the judges as context they are not
asked to render.
Absent by default at every level,
so the lane behaves exactly as
it did and every measurement taken before tonight still describes what production
sends.

WHAT REMAINS IS ONE PROBE,
and writing it deliberately rather than at five in the
morning is the reason it is not written.
Twice tonight a rushed classification
shipped a design error that only an acceptance test caught,
both times by
deciding a slice's class from the slice alone;
the lesson is worth one night's
delay.

THE SPEC,
so the next session does not re-derive it:

1.  Walk the pinned corpus,
    run `classifyDisplacement` per entry,
    and collect
    every flagged slice with the class that flagged it.
    Reuse the probe's own
    reading rather than a copy of the thresholds.
2.  For each flagged slice,
    call `settleTranslateSlice` TWICE:
    once as it stands,
    once with `neighbouringSource({ slices, sliceIndex, },)` supplied.
    Same
    client,
    same rosters,
    same slice.
3.  Record per slice:
    the class,
    whether each arm replaced the archive text,
    and
    the decision the stage reported.
    `TranslateSliceRecord` already carries what
    is needed.
    Append each result durably AS IT LANDS,
    and on restart skip every
    (entry,
    slice,
    arm) triple already recorded.
    See what the cache does and
    does not do,
    below.
4.  Tally the replacement rate PER CLASS PER ARM.
5.  ON THE FIRST FLAGGED SLICE ONLY,
    before letting the remaining seventy-nine
    proceed,
    read the wide arm's judge sheets out of the run log and confirm
    they carry the `SURROUNDING ORIGINAL` label.
    This is a fail-fast guard on the
    live wiring,
    not the proof;
    the proof is now a test,
    below.
6.  DEDUPLICATE BEFORE COUNTING.
    Relocation candidates are ADJACENCIES,
    so one
    slice can appear in more than one candidate.
    The unit of trial is an
    (entry,
    slice position) pair;
    carry the candidate metadata alongside rather
    than running the same slice twice and counting the same model result twice.
7.  RUN MATCHED ORDINARY SLICES AS A NEGATIVE CONTROL,
    drawn from slices the
    screen did NOT flag.
    Without them a general context-induced conservatism,
    judges keeping the incumbent more often simply because they were shown more
    text,
    is indistinguishable from the window doing its job on relocations.
    The three flagged non-relocation classes are not this control:
    they are
    flagged too.
8.  REPORT PAIRED TRANSITIONS,
    replace-to-keep and keep-to-replace,
    rather than
    two aggregate rates.
    Two rates that match can hide equal traffic in both
    directions,
    which is not the window working.

THE HOP IS NOW PINNED BY A TEST,
which is what item 5 stopped having to carry.
`translate-slice.unit.test.ts` drives `settleTranslateSlice` with a recording
client and asserts the window reaches EVERY judge sheet,
NO translator sheet,
and neither when no caller supplies one.
Shown to fail:
deleting the forwarding
spread in `translate-slice.ts` fails it with `expected +0 to equal 5`,
which is
precisely the silent null the run would otherwise have bought.
A translator must
not see the window because one that rendered the neighbouring original would be
marked down for covering content that was never its slice.

THE CACHE QUESTION HAD TWO HALVES AND ONLY ONE IS ANSWERED.

THE HALF THAT IS ANSWERED was a real defect rather than a worry.
The key covered
models,
identity context,
source,
incumbent,
mode and the governance flag,
and
NOT the window,
so two arms would have shared a key.
The window is now part of
the key,
APPENDED ONLY WHEN PRESENT so a key computed without one is
byte-identical to what it always was and no settled slice in the corpus is
discarded.
That file had no tests at all;
it now has six.

THE HASHES THIS DOCUMENT QUOTED FOR THAT CHECK,
`0522d446...` and `09bc539a...`,
came from an ad-hoc fixture whose inputs were never written down,
so nobody could
reproduce them.
Against the fixture now pinned in
`translate-slice-key.unit.test.ts`,
absent,
explicit `undefined` and empty all
give `1f6e97d2...` and a supplied window gives `60a7a398...`.
The relationship
the old figures were quoted for held;
the figures themselves named nothing.

THE WINDOWLESS HASH IS NOW A LITERAL IN THE TEST,
because every other case in
that file compares two keys,
and a change that moved BOTH sides would pass all of
them while silently discarding every settled slice in the pinned corpus.
Shown to
fail:
appending one field to the serialized array fails the pinned hash and
nothing else in the file.

THE HALF THAT IS NOT is where that key is READ,
and this document previously
implied the fix alone de-risked the run.
It does not,
because the fix protects a
path the probe does not take.
The only call site of `translateSliceKey` is the
document driver,
`translate-document.ts:252`;
`settleTranslateSlice` imports no
store at all,
and its two mentions of caching are comments.
So a probe that
calls `settleTranslateSlice` directly,
which is what step 2 says,
consults no
cache.
The arms cannot collide,
which is the good half,
but nothing resumes
either:
at roughly fifteen hundred real calls,
a run that dies at hour three
restarts from zero.

The key change stays regardless.
It is correct for the driver path and for any
later windowing there,
and it cost four tests.
It simply is not the thing that
makes the probe survivable.

WHAT MAKES IT SURVIVABLE is step 3's own durable append,
and the infrastructure
for it already exists:
`openNamespacedCache` in
`src/corpus-run/slice-cache-namespace.ts` is generic over its stored value and
takes a lane prefix plus its own generation marker.

ONE TRAP IF THAT ROUTE IS TAKEN,
and it is the same neighbour-discriminator
error that has now bitten three times.
`CLAIMED_PREFIXES` in that file defines
the repair lane as everything NOT in the list.
A new lane that invents a prefix
without registering it there is therefore adopted by the repair lane,
whose
`discardNamespace` deletes it on the next generation change.
Registering the
prefix is what claims the files.
A plain append-only JSONL beside the run,
keyed by entry,
slice and arm,
avoids the question entirely and is enough for a
one-off measurement;
prefer it unless the probe needs something the lane
machinery gives.
