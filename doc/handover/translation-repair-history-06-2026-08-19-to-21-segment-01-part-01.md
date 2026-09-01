# Translation repair history: 2026-08-19 to 2026-08-21

Part of the [translation repair history index](translation-repair-history.md).

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## 2026-08-19: what the first real CLI runs of the reading stage found

Four defects,
all fixed,
all found by running `corpus-pass` rather than by reading code.
Full evidence in `doc/audit/reading-a-picture-at-the-user-boundary.md`.

### `sentinel-probe` cannot verify anything in the settle path

It calls `repairTranslation` directly and never reaches `settleEntry`.
A run over a picture-bearing entry completes green while proving nothing
about picture gathering,
because the code that gathers pictures is in `pass-entry.ts`.
The honest CLI check is
`corpus-pass -- --only <ids>` into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`.
Anything that claims to verify the two-lane path must go through `settleEntry`.

### A failing picture reader killed the whole entry

`readImageAsset` is the ONLY model-calling stage that calls `client.chatText` directly.
Every other stage goes through `attemptStageCall`,
which contains a failure as a lost
voice and rethrows only on abort.
So a reader that looped,
and was cut off by the client's runaway guard,
rejected
`Promise.all` in `readImagePair`,
and the rejection travelled into `settleEntry`:
`status=ERROR`,
`processed=0`,
both lanes lost.
Fixed with `Promise.allSettled` plus `signal.throwIfAborted()`,
the same shape and order
`attemptStageCall` and `runStageRound` use.

WHEN A STAGE IS ADDED,
ASK WHETHER IT CALLS THE CLIENT DIRECTLY.
That one question would have caught this before a run did.

### Two refusals corroborated each other and would have been asserted as fact

`There is no text visible in this image.` and `No legible text is visible.`
agreed at 0.565 trigram overlap and were marked `corroborated`,
bound for the translator and judge sheets under
"WHAT THE PICTURES HERE SAY,
transcribed by two readers that agreed".
Both had slipped the phrase list by a single word:
one by word order,
one because `legible` sat between `no` and `text`.
The list had also silently lost its safety net,
since its own comment claimed the anchor clause caught what it missed
and the anchor clause had been deleted earlier the same day.

Replaced with `src/reading-refusal.ts`,
which tests SHAPE:
at most 160 characters,
containing a negation word,
containing a picture word,
all three required,
whole-word matched from a linear scan.
Six real transcriptions (390 to 632 characters) contain zero of either word list.

### The repair lane was deleting picture readings

`PICTURE_READING_NAMESPACE` was added to the store and not to `CLAIMED_PREFIXES`.
The repair lane is defined by SUBTRACTION,
as everything not claimed,
so it adopted `picture.*.json` and its discard deleted them
while logging that it discarded its own slices.

This handover already warned about this exact class,
and it had bitten three times.
This was the fourth.
The cure is now structural rather than a warning:
`slice-cache-namespace.unit.test.ts` walks every namespace the package defines
and fails if one is unregistered,
so a fifth cannot be added silently.

### Where the reading stage stands

A picture in this corpus is usually a photograph of a person,
not a document,
so most produce no reading and that is CORRECT rather than a miss.
Deterministic OCR confirms it:
on a smoke test of six assets,
tesseract read the three the models read,
at comparable length,
and found nothing in the three the models declined.

WHAT IS NOT YET SETTLED,
and the next thing to build:
the owner ruled that deterministic OCR should be tried FIRST,
that oversized assets should be re-encoded to AVIF at best quality rather than downscaled,
and that a picture with no text can simply be ignored.
`tesseract` (with `chi_sim`),
`avifenc` and `magick` are all installed.
An OCR-first order would also settle a real worry:
the same picture corroborated at 0.643 in one probe and disagreed at 0.087 in a CLI run,
so model readings are less repeatable than a five-pair sample suggested,
and a deterministic party on one side of the comparison halves that variance.

## 2026-08-19, later: the deterministic reader, and what the provider will not take

### OCR is a gate in front of the model calls, not a third reader

`src/image-ocr.ts` reads a picture with `tesseract -l chi_sim+eng` before any
model is asked.
`readImagePair` takes it as an injected `readOcr` collaborator,
required rather than defaulted,
so a unit test that forgets to supply a stub is
a TYPE ERROR instead of a slow test that shells out to whatever the machine has.

It gates rather than votes,
and that was settled by measurement rather than
preference.
Against the model readings already on record its trigram overlap is
0.019 and 0.023 on `Word1.webp` and 0.096 and 0.111 on `intro.webp`,
while those
same models agree with each other at 0.643 and 0.785.
It is not missing the
text:
on `Word1.webp` it returns 405 characters against their 390 and 394.
It
reads the same text and gets the GLYPHS wrong,
which leaves length intact and
destroys overlap.
Letting it vote would refuse readings that are fine.

What it is reliable at is PRESENCE,
six of six against the models in both
directions.
So:
no text found,
no model asked,
and the verdict is a new
`no-text` kind rather than an `unavailable`.
That is 119 of 191 assets.

### The provider refuses AVIF

`HTTP 400: Image type image/avif not supported. Only image/jpeg, image/png,
image/gif, image/webp, image/tiff, and image/bmp are supported.`

Every local measurement had said AVIF was the answer for the oversized assets:
it fit 16 of 17 under the cap with the text intact,
where webp fits 10 and
misses the three carrying the most text.
None of that mattered.
Verified by
sending the same picture twice,
one call apart,
as AVIF and as webp:
the AVIF
calls returned 400 and the webp calls returned 454 and 450 characters.

WHAT IS OPEN.
Without downscaling,
which the owner ruled out,
the three
text-heaviest oversized assets (`Aniloviraw/photo0.webp` 2965 characters,
`gqt/photo1.webp` 2329,
`Zha_Ke/letter.webp` 1718) cannot be put in front of a
model in any accepted format.
The deterministic reader reads all three,
so
their text is not lost;
what is missing is a second party to corroborate it.

A probe was in flight at the time of writing to test whether the byte cap is the
real obstacle at all.
The cap is SELF-IMPOSED:
`CONTEXT_SHARE = 0.5` in
`image-asset.ts`,
justified as leaving room for "the prompt,
the source,
the
archive wording and the reply".
A READING call carries none of those but a
200-character instruction,
so half a context is far more conservative than that
call needs.
If the provider accepts the pictures as they are,
the whole
re-encode problem dissolves and nothing needs to be lossy.
Read the probe's
result before building any re-encode.

Remaining option if it does not:
tiling.
Cutting `Zha_Ke/letter.webp`,
which is
1080 by 5645,
into vertical strips loses NO pixels,
which is what "no
downscaling" protects,
and a letter's natural reading order is already
top-to-bottom.
Untried.

## 2026-08-19, later still: the cap was ours, and two silent defects behind it

### The probe answered: nothing needs to be lossy

The probe named at the end of the previous section returned,
and it overturned the section.
The byte cap was never the provider's.
Sent as they are,
every oversized asset is accepted:
`gqt/photo1.webp` is 1274028 bytes,
four times the cap this package was enforcing,
and it comes back read for 2631 characters.
The corpus maximum,
1344454 bytes,
is accepted too.

So the cap is gone,
along with `CONTEXT_SHARE`,
`CHARS_PER_TOKEN`,
`BASE64_INPUT_GROUP` and `BASE64_OUTPUT_GROUP`.
`encodeImageAsset` now takes a plain `maxBytes`,
set to 8 MiB in the reading stage,
which nothing in this corpus approaches.
45 of 191 pictures had been refused on our own arithmetic.

No re-encode,
no format change,
no downscaling,
no tiling.
The tiling option recorded as "remaining,
untried" is not needed:
the three text-heaviest assets were only unreachable because of the cap that no longer exists.

WORTH KEEPING AS A METHOD NOTE,
and the reason this took a day to find.
The estimate divided a context length by an assumed characters-per-token
and compared the result against a base64 length.
Every step of that arithmetic was correct.
A vision model does not tokenize a picture by its base64 length:
it tokenizes by resolution,
in tiles.
The quantity being measured was one this package had invented,
so no amount of care in measuring it could have produced a right answer.
The check that would have caught it on day one costs one call:
send an oversized picture and see.

### The store rejected every `no-text` reading on resume

`isPairedReading` in `reading-cache-store.ts` checks the discriminant before the fields,
and it knew two kinds.
`no-text` was added to `PairedReading` the same afternoon and not to the guard.
Consequence:
every record carrying it was rejected on resume,
so the picture read as never gathered,
the deterministic reader ran again,
the same record was written back,
and the next pass rejected it again.
119 of 191 pictures end at that kind,
so two thirds of the picture work was re-done on every resume.

Nothing reported anything.
A run that silently re-does work is indistinguishable from a run that had nothing to resume,
which is why this needed a test to find rather than a log to read.

THE SHAPE OF THE MISTAKE IS THE SAME AS THE NAMESPACE ONE next door in the same directory:
a second place that has to learn about a new kind,
with nothing making it.
`reading-cache-store.unit.test.ts` now persists one record of every kind through the real store
and reads it back through a second open,
so a kind added to the type without being added to the guard fails there.
The same tests caught a second defect:
the optional `readings` on an `unavailable` record
were waved through unchecked for being optional.

### A stopped run returned a verdict instead of throwing

The OCR gate sits ahead of every model and consulted no signal of its own.
Its early return for `no-text` sits ABOVE the fan-in that rethrows on an aborted signal,
so a run already told to stop did not throw:
it spawned a decoder and tesseract for every remaining picture
and returned a `no-text` verdict that was then persisted.

`signal.throwIfAborted()` now runs before the gate.
The existing abort case could not have caught this,
because the call throws either way and the only difference is what it spent getting there;
the new case counts the asks and expects zero.
Removing the check makes it fail with `expected 'returned no-text' to equal 'AbortError'`.

### Verified at the settle path, not at the probe

`sentinel-probe` cannot verify any of this:
it calls `repairTranslation` directly and never reaches `settleEntry`.
The honest check is `corpus-pass -- --only <id>` into a throwaway `TRANSLATION_REPAIR_RUNS_DIR`.

On `wangzihao980`,
at the tip of this work:

```text
gatherEntryPictures  gathered 6 of 6 pictures
readImageWithOcr     picture1.webp: no text (0 characters, under 16)
readImagePair        picture1.webp: no text to read, so no model was asked
                     ... the same for picture2 through picture5 ...
readImageWithOcr     Word1.webp: read 205 characters without a model
readImageAsset       hf:moonshotai/Kimi-K3 read Word1.webp but the reading was refused: reads-as-refusal
```

Five pictures skipped both models in under a second,
and those five are exactly the ones that had produced the corroborated refusals.
The sixth passed the gate on 205 characters,
went to the roster,
and the shape screen caught a refusal from a real model on real content.

### A test file shaped wrongly passes silently, and costs an afternoon

This runner takes `describe({ name, children: [it({ name, fn, },),], },)`.
A file written as `describe('name', function () { it('name', fn,); },)` registers nothing,
prints nothing,
and exits 0.
Every runner in the chain reports success:
`mise run ... :test:unit -- <file>` exits 0,
and so does `node <file>`.

The tell is that a test file produces NO output at all,
not even a pass line.
A positive control on a known-good sibling separates it from a genuine null in one command,
which is the only reason it was caught here.

## 2026-08-19, last: a declined reading is asked again

The settle-path run discarded a good reading,
and the reason was not the picture.
`Word1.webp` carries text that the deterministic reader gets 205 characters out of.
Asked six times per model with identical bytes and identical instruction:

```text
hf:Qwen/Qwen3.6-27B     6 of 6 read it, 376 to 397 characters
hf:moonshotai/Kimi-K3   2 of 6 read it, 377 and 403 characters
```

A refusal is a property of the ROLL.
That costs more than the rate suggests,
because corroboration needs both readers
and the provider offers exactly two models that read images,
so the pair's success rate is the WEAKER reader's read rate rather than an average.
A reader declining two asks in three costs two thirds of the readings,
not one third.

`readPastRefusal` asks the same model again,
up to four asks,
on the refusal clause alone.
At the measured rate that retains four readings in five where one ask retained one in three,
and it costs about 2.4 asks per picture because asking stops at the first reading.
It fires only on pictures the gate already found text on.

On the same entry afterwards,
`Word1.webp` corroborated at 0.653,
after Kimi-K3 declined once and read 403 characters on its second ask.

WHY NOT A THIRD READER instead.
There is no third to have:
the catalog carries `readsImages: true` on exactly two models,
and the vision aliases the provider lists are aliases of those same two.
The two-model sub-roster was a design choice about judge disinterest;
it is now also a fact about supply.

### Resume, finally proved on the kind that needed it

Stopping that run once its pictures were settled and starting it again into the same
runs directory resumed all six,
five `no-text` and one `corroborated`,
with ZERO `readImageWithOcr` lines against six in the run that wrote them.
The resume proof that existed before today predated the `no-text` kind,
so the case the store had been silently rejecting had never actually been resumed.

### What is left

The README now describes the reading stage and names `tesseract` and `dwebp` as
deployment dependencies,
so package completeness is met for this lane.

Still owed,
and none of it blocks the lane:
a settle-path witness for the size ceiling needs an entry carrying an asset past
294912 bytes,
which `wangzihao980` does not have (`gqt` does);
and the corpus-wide re-run under the corrected pipeline has not been done,
since every batch started before today's fixes carries picture verdicts
produced by the estimate,
the missing gate,
and the missing retry.

### The last guard bite, and the coupling it revealed

The refusal shape clause had been added without its bite shown,
because a subagent
was rebuilding the shared dist at the time.
Disabling the `readsAsRefusal` call in `image-reading-sense.ts` fails the screen-level case with

```text
AssertionError: expected 'usable' to equal 'refused'
```

which is the two production refusals passing as usable readings again.
It also fails four cases in the re-ask suite,
because that suite drives its refusal fixture through the real screen rather than stubbing the clause,
so the clause is pinned from two directions and a rename cannot quietly detach it.

### Where the lane stands

Built,
tested,
and witnessed on the settle path:
the gate,
the shape screen,
the re-ask,
the ceiling,
and resume.
Unit suite 429 passing and 0 failing,
lint 0 warnings 0 errors,
types clean.

NOT YET WITNESSED:
one picture-bearing entry reaching `status=SETTLED` end to end under this build.
Every run so far was stopped deliberately once its picture phase had been read,
and the entry that did settle predates all of today's changes.
That is the one thing standing between this lane and done,
and it gates the corpus-wide pass,
because a full pass is hours of quota and one settled entry is the cheap check
that picture context flows through `slicePictures` into both lanes without a new surprise.

## 2026-08-19, closing: the entry settles, and the reading lane is measured separately

### One picture-bearing entry settled end to end

```text
TALLY wangzihao980 status=SETTLED slices=6
  repairStatus=repaired repairIssues=43 repairAccepted=35 repairResolved=35
  repairFindings=78 repairChanged=5
  translateStatus=complete translateChanged=4 documentsDiffer=4
  alignmentFindings=0 selection=pending-human-decision ms=3660309
DONE processed=1 of pending=1
```

That was the gate.
Both lanes completed on a document whose picture context came from the
gate,
the shape screen and the re-ask,
and the aligner raised nothing.

READ THE COST FIGURE BEFORE PLANNING A CORPUS PASS:
3660309 ms is 61 minutes for ONE entry,
and the corpus holds 93.
A serial end-to-end pass is days of wall clock,
not hours.

### So the reading lane is measured on its own

The reading lane is separable:
it runs before either translation lane and takes nothing from them.
`~/temp/agent/reading-census.mjs` walks every entry,
prepares its pair,
gathers its pictures,
and reads them through the same `readDocumentPictures` production call,
recording the verdict per asset into `~/temp/agent/reading-census.json`.
That buys the corpus-wide picture rates for the price of the vision calls alone,
instead of waiting days behind two translation lanes that no picture question depends on.

It answers three things the single-entry runs cannot:
how many pictures reach each verdict corpus-wide;
how the nine assets in the 16 to 31 character band behave,
which is what decides whether
`MIN_OCR_CHARS` sits in the right place;
and how many re-asks the refusal roll actually costs,
which is what the ask limit should be
set from rather than from one picture.

### A null result that was a bug, twice in one session

The census printed `entries listed: 93` and `assets read: 0` on its first run,
in under a second.
Not a corpus without pictures:
`readCorpusFile` takes `relPath` and had been passed `path`,
so every read threw and a bare `catch { continue; }` turned 93 failures into a clean zero.

This is the same shape as the test file that registered nothing and exited 0 earlier today.
Both were caught by asking whether the probe could have shown a positive at all,
and in both cases the answer took one command.
The census now counts and reports the entries it could not read,
so its zero can never again mean two different things.

## The end-to-end corpus pass was launched, then STOPPED ON PURPOSE, and why

STATE AS OF 2026-08-19 23:08Z:
NO PASS IS RUNNING.
Nothing to monitor,
nothing to resume,
and no restriction on editing package source.
If a recovery session reads only one line
of this section,
that is the line.

It was launched at 23:00Z over 92 entries and killed at 23:08Z with four minutes of work
and ZERO settled artifacts,
so the discarded cost is one partial entry.
The dead directory `~/temp/agent/corpus-pass-full-20260819` holds a stale `pass.lock`,
a generation-keyed slice cache and that partial work.
It is worth nothing;
the relaunch
uses a FRESH directory,
because the rebuilt `dist` stamps a different digest anyway.

### Why it was stopped four minutes in

Reading `#107` immediately after launching turned up a fix that is measured,
bounded,
specified,
and NOT BUILT WHERE IT IS NEEDED,
for damage that is legible in shipped output:
`lintong` ships a farewell offering the same thing twice,
and `saurikissa` slice 7 ships a
sentence severed after its preposition.
The bound is measured over 1260 slices:
80 flagged,
51 contiguous runs,
longest run 3,
and every relocation pair adjacent,
so showing the judge
slices n-1,
n and n+1 provably covers every case in the pool.

WHAT IS AND IS NOT ALREADY BUILT,
established by reading the source rather than the tracker,
which says "not yet built" without the qualifier:

-   the judge's `neighbouringSourceText` and `neighbouringIncumbentText` parameters EXIST,
    and their own TSDoc names `#107` as the reason
-   the TRANSLATE lane is fully wired:
    `translate-document.ts` computes both with
    `neighbouringSource` and `neighbouringIncumbent` and feeds the call AND the slice-cache
    key from one value
-   the REPAIR lane has NO neighbour wiring at all:
    `translate-repair.ts` and the repair
    stages contain no occurrence of `neighbour`

That split is exactly the lane split the damage shows,
which is the confirmation that this
is the right target:
`lintong` counts 2 and 2 in the repair lane against 1 and 1 in the
translate lane,
and the severed sentence at `saurikissa` slice 7 is repair-lane too.
Do not confuse `translate-repair.ts`,
which is the translate lane's conversation with a
model whose candidate failed validation,
with the repair LANE,
whose entry point is
`repairPreparedDocument` in `repair-translation.ts`.

Measuring a pipeline corpus-wide for four days,
when a known defect in it already has a
specified fix,
spends the time to learn the rate of something we were about to remove.
The arithmetic favours stopping and it is not close:

WITHDRAWN 2026-08-25.
The owner removed the release date this table reasons against,
because working under it produced worse results and sometimes slower ones.
The comparison is kept because it records why "stop then run" was chosen,
but the schedule half of it is void and must not inform any later decision.

```text
run then fix   baseline describing a superseded pipeline,
               fix plus verification plus a second pass lands late, no slack
stop then run  fix in hours, 5 flagged entries verify overnight,
               relaunch sooner, full pass done sooner, real slack
```

THE USER RATIFIED THIS AS A STANDING RULE while it was happening,
in three words:
"Always stop and restart."
So this is not a one-off judgement call to re-litigate.
When a
fix ought to land before a long measurement,
kill the measurement and restart it after.
Do not let a multi-day run finish on code that is already superseded.

### What gates the relaunch, and what does not

ONLY `#107` GATES IT.
The fix list does not grow while the pass waits.
`#98` was already measured to have zero instances on this corpus under a validated positive
control,
so it changes no pairing here and is correctly gated on heading scoring instead.
`#90`,
`#91`,
`#94` and `#96` have no measured shipped damage and stay post-pass.

HARD RELAUNCH DEADLINE (WITHDRAWN 2026-08-25,
kept only as a record of what was decided then).
If the window fix has not cleared its gates by then,
relaunch on the current tip and land the fix afterwards.
A perfect pipeline that never gets
measured is worth less than a measured one.

The gates are checkable rather than felt:

-   `lintong` repair lane drops from 2 to 1 for each of the two distinguishing noun phrases
-   `saurikissa` slice 7 no longer ships the severed sentence
-   the contested-cut replacement rate at unflagged slices does not fall away from about 0.95
-   suite,
    lint and types stay green
-   judged-context cost is read,
    not assumed:
    n plus or minus 1 roughly triples the context,
    and `#92` found cost tracks CLAIM COUNT rather than size,
    so confirm claim counts hold

The instruments already exist:
`~/temp/agent/join-107.mjs`,
`~/temp/agent/severed-sentence-census.mjs`,
and the current code reproducing the `lintong`
duplication is the positive control.
Run the five flagged entries with `--only` into a
throwaway `TRANSLATION_REPAIR_RUNS_DIR`.

### Mechanics worth not rediscovering

The runner installs no signal handler,
so a plain TERM ends it and it died in two seconds.
The first TERM appeared to be ignored for a much dumber reason:
bash's BUILTIN `kill` has no
`--signal` long option,
so `kill --signal TERM <pid>` fails with "invalid signal
specification",
and the failure was invisible because stderr had been sent to `/dev/null`.
Use `kill -s TERM <pid>`.
This is the `LF2` case where no long form exists and the short
flag stays.

`pgrep --full 'corpus-pass.mjs'` MATCHES ITS OWN COMMAND LINE and will report a live runner
that is really the pgrep.
Use `pgrep --full '^node .*corpus-pass\.mjs'`.

## `#107`'s window is wired into the repair lane, and the 5-entry verify is RUNNING

Landed in `711497365`.
What it changed,
and the shape of it matters more than the diff:

```text
driver   repair-translation.ts   window computed per slice, BY POSITION
key      repair-slice-key.ts     folded in; version stays 27, deliberately
fan-out  repair-chunk.ts         one windowFragment spread into all three stages
critic   critic-prompt.ts        + chunk-critic-phase.ts + repair-stages.ts
panel    adjudicate-prompt.ts    + repair-stages.ts
editor   edit-prompt.ts          + repair-editor-stage.ts
```

THE CRITIC IS IN IT BECAUSE OF CLAIM FLOW,
not because it seemed thorough.
A slice
raising zero claims skips every downstream stage,
so a surplus passage can only ever be
removed if a CLAIM names it,
and only a critic that can see next door will name it.
The
panel and editor follow necessarily:
a panel that cannot see the neighbour must reject a
claim about text outside the slice as unfounded,
so widening the critic alone would have
manufactured exactly the claims the panel is guaranteed to throw away.

ONE FRAGMENT,
THREE SPREADS.
`windowFragment` is built once in `repairChunk` because the
three stages must see the SAME window or they contradict each other.
Three separate
arguments can drift;
three spreads of one value cannot.

THE VERSION CONSTANT STAYS AT 27 and the reasoning is recorded in the key's own history.
The window is folded into the KEY,
so a slice that has a neighbour keys anew and
recomputes,
which is correct because it is being asked a different question,
while a lone
slice keys identically and resumes,
which is also correct because there was no window to
show it.
A bump would have discarded both,
including the lone slices whose question never
changed.

### The trap that was avoided, and it is the one `#99` named

`neighbouringSource` takes a POSITION and throws on anything else.
The repair loop's
`chunkIndex` is a STAMPED index,
and passing it would either throw or,
worse,
address some
other slice's neighbours.
The loop now runs `for (const [sliceIndex, slice,] of
slices.entries())` so the position is correct by construction rather than by lookup.

### Why a test file exists for something the type checker should catch

TypeScript does NOT excess-property-check a spread.
Every one of the five call sites passes
the window as an optional property spread into an object literal,
so a stage that silently
dropped the parameter would compile,
lint,
and pass every existing test while sending the
models exactly the sheet they got before.
The failure mode is a change that looks landed
and does nothing,
so `nearby-window-reaches-the-models.unit.test.ts` asserts against the
RENDERED TEXT of all three sheets.

SHOWN TO FAIL BEFORE BEING TRUSTED,
per `GFP`,
and after being committed so restoring could
not discard it:
dropping `${nearbyBlock}` from the critic template alone turns the suite
red at exactly that case.
Restored,
and 430 pass with 0 failures.

### What is running and what it has to show

Five flagged entries into `~/temp/agent/win107-verify-20260819`,
detached,
about five hours.
The `~/translation-repair-runs-flagged-20260818/artifacts` pool is the BASELINE and must not
be overwritten:
the damage is already recorded there,
so it is the positive control and
re-spending to reproduce it would be waste.

Gates,
none of them a feeling:

-   `lintong` repair lane:
    each distinguishing noun phrase appears EXACTLY ONCE in the
    assembled document.
    Not at-most-once.
    Removal here is only safe if the content really
    does ship next door,
    and zero occurrences is a worse failure than two
-   `saurikissa` slice 7 no longer ships the severed sentence
-   the contested-cut replacement rate at UNFLAGGED slices does not fall away from about 0.95
-   claim counts at unflagged slices do not inflate materially.
    `#92` found cost tracks
    claim count,
    so this is the trigger that would send the window from always-on to gated
    at flagged slices plus or minus one

Instruments already exist:
`~/temp/agent/join-107.mjs` and
`~/temp/agent/severed-sentence-census.mjs`.

SOURCE EDITS ARE OFF AGAIN WHILE THIS RUNS,
for the reason recorded above:
the process in
flight is safe,
but any interruption plus a rebuild stamps a new digest and the guard
refuses to resume into this pool.

### The checker is deliberately NOT windowed, and that is a decision rather than an omission

Recorded because the code and the tracker would otherwise disagree,
and a later session
would read the gap as unfinished work and thread it for nothing.

The first sketch of this change listed the checker beside the panel,
on the reasoning that a
stage verifying a removal cannot tell a fix from a deletion without seeing the neighbour.
That is overstated for what the checker actually does.
A removal claim quotes the surplus
AS IT APPEARS IN THIS SLICE,
and the checker verifies that the quoted text is gone from this
slice.
That question is answerable within the slice,
and the same holds for additions on the
deficit side.
Handing it the window would spend context on evidence it has no question for.

WHAT WOULD REOPEN IT,
stated so the decision is falsifiable:
if the verify artifacts show
`resolved` failing to fire on relocation-class issues,
the checker is being asked something
it cannot answer and the window follows.
That is a thing to read in the artifacts when they
land,
not a thing to assume either way now.

### Three effects to expect in the verify results, none of which is damage

Named in advance so they are not misread as regressions when the run lands.

CRITICS MAY QUOTE FROM THE NEARBY BLOCKS despite the rule forbidding it.
Those claims die at
anchoring,
because a quote taken from next door cannot anchor in this slice,
so the outcome
is safe.
They are still spent quota,
so COUNT THE DROPS:
a high count is the signal that the
rule needs strengthening or that the blocks need a stronger separator.

THE INTRODUCED-DEFECT PROBE IS WINDOWLESS and will therefore read a legitimate surplus
removal as dropped content.
Expect `removal`-class findings to rise on relocation slices,
and do not book them as damage without reading them.

`ISSUE_CATEGORIES` IS A CLOSED VOCABULARY WITH NO RELOCATION KIND,
so these claims must ride
an existing category.
Note which one they land in.
That is evidence about whether the
vocabulary wants a kind;
it is not a decision to take from this run.

### One defect already found in what just landed, fix scheduled rather than rushed

`repairSliceKey` spreads the two window sides as BARE values into a positional array,
so a
source-only window and an incumbent-only window carrying the same text hash identically.
`translateSliceKey` avoids this by spreading NAMED properties.
Tracked as task `#126` with
the labelled-entry fix.
It re-keys every windowed slice,
so it lands AFTER this verify and
BEFORE the 92-entry relaunch,
while no cache is worth keeping.

### The gate reader, and the false pass it produced first

`~/temp/agent/window-gates.mjs --new <dir> [--baseline <dir>]`.
Zero quota,
reads settled
artifacts only,
and turns the verify's completion into one command:

```text
GATE A  duplicated phrases, derived from the baseline, counted in the new repair document
GATE E  critic claims per slice, flagged against unflagged, baseline against new
GATE E2 claims per HEARD critic, with the roster each reading rests on
GATE B  delegated to severed-sentence-census.mjs
GATE C  delegated to join-107.mjs, both cuts
```

GATE A DERIVES ITS PHRASES INSTEAD OF HOLDING THEM,
which is what lets it live in a file at
all:
no corpus text is written into the repo,
the tracker or the instrument.
`#107` recorded
that the distinguishing phrases occur TWICE in the baseline repair document and ONCE in the
baseline translate one,
and that is a machine-checkable signature,
so the phrases are
recovered by searching for it and then counted in the new document.
Output names a phrase by
word count and a short hash,
never by its wording.

EXACTLY ONCE IS THE TEST,
not at most once,
and the reader says `LOST` rather than `ok` at
zero.
Removal at slice n is only correct if the content really does ship at n plus or minus
one,
and a document that quietly dropped the passage is worse off than one that says it
twice.

GATE E2 EXISTS BECAUSE CLAIMS PER SLICE BECAME UNREADABLE.
A stage that heard three of six
raises fewer claims than one that heard six whatever it was shown,
so while heard-counts are
moving,
claims per slice cannot be attributed to the window at all.
Claims per HEARD CRITIC
survives that,
and the reader now prints the average and minimum roster beside every rate so
no gate verdict is read without the roster it rests on.
The baseline reference is 1.70 claims
per heard critic at flagged slices and 1.74 at unflagged,
average roster 5.9,
minimum 5.

IT REPORTED A CLEAN PASS ON ITS FIRST RUN,
and both halves of that were wrong.
The two lanes
name their assembled text differently,
`repairedText` against `translatedText`,
so reading
one field for both compared every phrase against an empty string and found nothing.
The
reader then printed that nothing as PASS.
Two fixes,
and the second matters more than the
first:
the field is now read per lane and a missing one THROWS rather than defaulting to
empty,
and a derivation that finds no phrase is no longer a pass.
In `lintong` it is an
INSTRUMENT FAULT,
because that duplication was found by hand and an instrument that cannot
see it is broken;
elsewhere it is inconclusive,
which is also not a pass.

VALIDATED BY POSITIVE CONTROL,
which is the only reason to trust it:
run with the baseline
as its own `--new`,
it reports STILL DUPLICATED for every phrase it derived and Gate A reads
FAULT.
An instrument that cannot fail on known damage cannot clear anything either.
Gate C
reproduces `#107`'s recorded contested-unflagged rate of 0.9524 on the same pool.

This is the third null-that-was-a-bug in two days,
after the test file that registered
nothing and the census that read 93 entries and 0 assets.
All three were caught by the same
question,
asked before believing the answer:
could this probe have shown a positive at all.

### The window is proven to reach production, not just the prompt builders

`~/temp/agent/window-reaches-production.mjs`,
zero quota,
no network.

THE UNIT TEST COULD NOT ANSWER THIS.
It asserts that `buildCriticMessages` renders a window
it is HANDED.
Whether `repairPreparedDocument` computes one and hands it over is a different
question,
and it is exactly the one `#107` records going wrong before:
the translate lane's
window sat unused for weeks because the call site never passed what the builder accepted.

The probe drives the real `prepareDocumentPair` and `repairPreparedDocument` with a stub
client that records every sheet and answers "no issues",
so each slice raises zero claims and
skips every later stage.
Three invented cat-themed sections,
each carrying a marker no other
section uses,
so a sheet can be attributed to the slice it was asked about.

```text
slices prepared 3, sheets asked 6, all 6 carrying a NEARBY fence

middle slice   window carries the preceding neighbour   2 of 2
               window carries the following neighbour   2 of 2
first slice    window carries the following neighbour   2 of 2
               window wrongly carries the last slice    0 of 2
last slice     window carries the preceding neighbour   2 of 2
               window wrongly carries the first slice   0 of 2
```

THE TWO ZEROES ARE THE POINT,
more than the twos.
They are the negative control:
the window
reaches exactly one slice each way and not the whole document,
which is what
`neighbouringSource` promises in its TSDoc and what keeps the cost bounded.
A window that
quietly widened would show here as the first slice seeing the last.

IT REPORTED A FAILURE FIRST,
and the probe was wrong rather than the code.
The first version
filtered sheets by "mentions the middle marker" and read 4 of 6,
which looks like a partial
forward.
It is not:
slice 0's sheet mentions the middle marker because the middle slice is
ITS neighbour.
What is under review and what is context sit on opposite sides of the NEARBY
fence,
so the sheet has to be split there before it can be attributed.
Same lesson as the
gate reader an hour earlier,
in the opposite direction:
that one called a broken probe a
pass,
this one called working code a failure.
