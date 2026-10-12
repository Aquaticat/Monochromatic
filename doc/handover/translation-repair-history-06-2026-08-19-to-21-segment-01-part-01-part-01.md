# Translation repair history: 2026-08-19 to 2026-08-21, part 01

Part 01 of [Translation repair history: 2026-08-19 to 2026-08-21](translation-repair-history-06-2026-08-19-to-21-segment-01-part-01.md),
whose index lists every part in order.

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
