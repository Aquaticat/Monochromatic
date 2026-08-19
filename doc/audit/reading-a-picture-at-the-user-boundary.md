# Reading a picture at the user boundary

First real vision traffic for `#111`, run 2026-08-19 against the production provider
from a clean worktree at `778cda3ad`,
built and exercised through `dist/final/node/index.mjs` rather than through source.

Everything before this was verified against invented fixtures.
Nothing had crossed the artifact-consumer boundary,
so nothing had established that the provider accepts the message shape at all.

## What the provider accepts

The endpoint takes a content-parts array.
Both models the catalog marks as reading images accepted it on the first attempt,
with no transcoding and no shape negotiation:

-   `hf:Qwen/Qwen3.6-27B`, 262144 context
-   `hf:moonshotai/Kimi-K3`, 524288 context

Both accepted `data:image/webp;base64,` directly.
That matters more than it sounds:
187 of the 191 distinct assets a source-side photo reference names are `.webp`,
so a webp rejection would have forced a transcoding stage into the pipeline.
It did not.

Ten calls were made across four entries.
First-byte latency ran 2.8 to 4.2 seconds and whole exchanges 5 to 51 seconds,
which puts a reading in the same cost band as an ordinary translation call rather than in a band of its own.

## What the readings are

The instruction asks for transcription in the picture's own language,
so a reading of a Chinese picture comes back in Chinese
while the transcript the archive carries is the English a human translator wrote.
The two are never comparable by length:
`dogesir_/intro.webp` reads as 590 to 632 characters against a 1538-character English transcript,
which is the ordinary Chinese-to-English expansion rather than a truncated reading.

## Where the screen stands, measured

`readingMakesSense` refuses a reading sharing fewer than two anchors
with the transcript the archive already carries.
Over the four corpus slices that carry both a protected target-only run and a source-side photo reference,
five assets, two readers, ten attempts:

-   six attempts produced a usable reading, with shared anchors of 2, 2, 4, 5, 5, 5
-   four attempts were refused, all four `describes-another-picture`, all four on `Mio/7`

Two of the six sit exactly on the floor.
One anchor more lost to paraphrase and `zheermao101/photo3.webp` fails for both readers.

## The margin is not what an earlier note claimed

`doc/planning/when-an-image-reading-makes-no-sense.md` recorded 37 to 142 anchors per known transcript
against a requirement of two,
and read that as a wide margin.
That measurement was of the English archive transcripts,
which carry 77 to 130 anchors each because every English word of four letters or more is one.
The operative number is not that count but the OVERLAP with a Chinese reading,
and the overlap is 2 to 5.

The ceiling is set by how many Latin-script and digit tokens the picture itself contains,
since those are the only tokens that survive into both a Chinese reading and an English transcript.
The source side of these five slices carries 3 to 11 anchors in total.
A picture of pure Chinese prose carrying no names, handles or dates
cannot clear a floor of two however correctly it is read.

## Cross-model corroboration is far stronger

Two models reading the SAME picture agree with each other in the same script,
so nothing is lost to translation.
On `dogesir_/intro.webp`:

-   cross-model shared anchors 8 of 9
-   distinct-character overlap 245 of 246, ratio 0.996

Against 4 and 5 shared anchors for the same two readings measured against the archive transcript.
The vision sub-roster is exactly two models and both are already being asked,
so this signal costs nothing that is not already spent.

## The archive-transcript clause refuses correct readings

Every reading of `Mio/7`'s two pictures was refused as `describes-another-picture`,
four attempts across two assets and two readers.
Calling the transport directly, bypassing the screen, shows what was thrown away:

-   `photo6.webp` reads as 100 and 98 characters, 7 anchors each, 0 shared with the archive transcript
-   `photo7.webp` reads as 590 and 178 characters, 10 and 7 anchors, 0 shared with the archive transcript

The readings are real.
The two models agree with each other almost exactly,
1.000 and 0.967 distinct-character overlap.
What they do not agree with is the 2066-character target-only English on that slice,
which is simply not a transcription of either picture.

So the clause fires on a premise it cannot check.
It assumes a slice's target-only English transcribes that slice's pictures,
and where the target-only English is some other kind of addition,
every correct reading of every picture there is refused.

## Cross-model corroboration separates cleanly, on a small sample

Over the ten readings saved by these probes, five pictures across four entries,
comparing every reading against every other:

-   5 pairs of the same picture read by different models: shared anchors 5, 6, 7, 8, 9;
    character overlap 0.829 to 1.000
-   40 pairs of different pictures: shared anchors 0 to 2;
    character overlap 0.326 to 0.667

Both criteria separate with a gap and no overlap.
A shared-anchor floor of 3 keeps 5 of 5 same-picture pairs and admits 0 of 40 different ones.
A character-overlap threshold of 0.75 does the same.

The different-picture group is the positive control:
it is the case that must move, and it moves.

STATED AS THE SMALL SAMPLE IT IS.
Five same-picture pairs is enough to show the separation exists
and not enough to place the threshold precisely.
It is drawn from the only corpus slices carrying both a protected target-only run and a source-side photo,
so it cannot be widened without reading pictures that no transcript describes.

## What a reading is actually for, checked rather than assumed

The wiring was going to be justified as protection:
a transcript the source cannot account for gets deleted,
and a reading gives it a source.
Checking that premise against the nine known transcripts shows it is already false.
Every one of them is held by a guard today:

```text
wangzihao980/4     split(1138) + quotes
zheermao101/8      alignment + quotes
zheermao101/11     split(1129) + quotes
dogesir_/3         split(1538) + quotes
Zha_Ke/1           alignment
MizuharaNagisa/3   alignment + quotes
Mio/7              split(2066) + quotes
Mio/16             alignment + quotes
shihai4h/14        alignment + quotes
shihai4h/52        alignment
shihai4h/53        split(10736) + quotes
```

Exactly one corpus slice sits in the gap the reading was supposed to fill:
`shihai4h/3`, ratio 4.1, 284 characters of target, no quote block, no protected run.
The remaining unguarded rows are ordinary slices at ratios of 2.3 to 4.4,
which is the ordinary Chinese-to-English expansion rather than a transcript.

So the reading does not buy protection.
It buys the three things protection cannot:

-   CHECKING a transcript against the picture it claims to transcribe,
    which is what the owner asked for and what no guard does
-   ADDING a transcript where the archive carries none,
    which is half of what reading pictures is for
-   giving translators and judges the picture's content as evidence
    rather than a hole in the source they must translate around

The acceptance test for the wiring follows from that.
It is not "a transcript survives", since they already do.
It is that a reading reaches the models and changes what they can check.

## Where a reading attaches

Source-side references reach 79 of 1260 slices,
and no slice names a picture on the target side without naming it on the source,
so the source's own references are the whole attachment surface.

They do not reach `Zha_Ke/1`, whose 3652 characters transcribe a letter
named one slice later, in `Zha_Ke/2`.
That is the same adjacency the fidelity window was built for,
measured on 2026-08-18 as every relocation pair in the corpus being adjacent,
so the readings of a slice's NEIGHBOURS travel with it
exactly as the neighbouring source and neighbouring archive already do.

## A picture finding is telemetry, and the key deliberately omits it

The slice cache key appends `['pictures', pictureContext]` only when a reading arrived.
The findings do not enter the key at all.

That asymmetry is intentional.
The key must cover everything that changes WHAT THE MODELS ARE ASKED,
and a finding changes nothing a model sees:
`picture Word1.webp: no reading, readers-disagree` is a line in the stored record,
never a line in a sheet.
Feeding it into the key would evict every slice on a reason string
that no model ever read.

The consequence is worth naming so nobody rediscovers it as a defect.
A slice settled on a run where nobody gathered a picture's bytes
records `picture Word1.webp: not read`.
A later run that DOES gather those bytes,
but whose two readers disagree,
computes the same empty picture context,
so it hits the same key and resumes the old record with the old reason.
The stored reason then describes the earlier run's gap rather than this run's disagreement.

Both runs are correct about the thing that matters:
no reading reached the models, so no reading should.
Only the explanation is stale, and only in the direction of an older,
less specific reason.
A run that gathers bytes and CORROBORATES a reading computes a different context,
so it misses the key and re-settles, which is exactly the behaviour required.

The alternative, keying on findings, would trade an occasionally stale telemetry string
for cache misses on every slice of every entry whose reader availability shifted.
That is the wrong trade for a field nothing gates on.

## The paired-quote ratio guard is refused on its own measurement

The fallback half of this work was specified as two pieces:
keep every target-only block out of translation, which is built and wired,
and add a paired-quote ratio guard "for the one merged case",
a paired blockquote whose English side runs over five times its Chinese side.

Measured over the whole pinned corpus rather than the entry that raised it,
that second piece protects nothing and costs eight slices.

There are 211 aligned blockquote pairs.
Their growth band is p50 2.89, p90 4.00, p99 8.49, max 26.20.
Nine pairs sit over 5.0:

```text
Susiethegamer/15    src 76   tgt 382    ratio 5.0
shihai4h/18         src 70   tgt 364    ratio 5.2
CutOceanHeyFis1/4   src 15   tgt 83     ratio 5.5
mikaela_khara/0     src 16   tgt 98     ratio 6.1
a2581911655/3       src 12   tgt 78     ratio 6.5
Weideriche_/0       src 11   tgt 73     ratio 6.6
shihai4h/46         src 55   tgt 467    ratio 8.5
shihai4h/14         src 98   tgt 1649   ratio 16.8
Rentable_A/0        src 10   tgt 262    ratio 26.2
```

Three things follow, and each on its own is enough.

The outlier the guard was designed around is `shihai4h/14`,
not `shihai4h/3`.
The earlier note named the entry rather than the slice,
and the two are different slices with different shapes.
`shihai4h/14` already carries both an alignment guard and a quote guard,
so the ratio test would be its third.

The slice that actually needs covering cannot be reached by any quote rule.
`shihai4h/3` is 70 source characters against 284 of target, ratio 4.1,
and it carries NO BLOCKQUOTE ON EITHER SIDE.
A guard that fires on paired blockquotes over five times their source
misses it twice over: wrong shape, and under the threshold anyway.

The remaining eight firings are ordinary text.
Five of them have source quotes of 10 to 16 characters,
where a ratio is arithmetic on almost nothing:
`Rentable_A/0` reaches 26.2 because ten Chinese characters became a sentence.
Freezing those out of translation is a cost with no matching benefit.

So the guard is refused, on the population it was meant to serve.
What covers `shihai4h/3` is the reading, which is what the ruling asked for first:
the slice names `photo3.webp`, 18550 bytes,
comfortably inside the smaller reader's allowance of 294912,
so both readers can be sent it and a corroborated reading can reach the sheets.
The structural half of the fallback that DOES earn its place,
keeping target-only runs out of translation,
is built, wired into `translate-slice.ts`, and unaffected by this.

## What the first real CLI run showed

`corpus-pass --only wangzihao980` into a throwaway runs directory,
which is the pipeline as it actually ships rather than a probe around it.

The wiring reaches production:
`gathered 6 of 6 pictures`, then `reading 6 pictures for this document`,
then six distinct readings persisted under the `picture.` namespace.
Their verdicts:

```text
corroborated                          overlap 0.565   reading lengths 39/27
corroborated                          overlap 0.565   reading lengths 39/27
unavailable   readers-disagree        overlap 0.087
unavailable   one-reader-only         (Qwen3.6-27B: too-short)
unavailable   no-reader-available     (both readers: reads-as-refusal)
unavailable   no-reader-available     (too-short; reads-as-refusal)
```

Three observations worth keeping.

The screen is doing real work rather than passing everything.
Four of six pictures produced no usable reading,
and each refusal names which reader failed and how.

Corroboration is doing real work too.
One pair was compared and REFUSED at 0.087,
which sits inside the 0.000 to 0.129 band measured for readings of different pictures.
That is the mechanism separating on live traffic rather than on a sample.

THE TWO CORROBORATED ROWS WERE NOT READINGS.
Both readers had declined, in different words, and the two declines agreed.
That finding and its fix have their own section;
what belongs here is that the figure alone did not reveal it.
An overlap of 0.565 sits between the two measured bands
and reads like a weak but real agreement,
which is exactly what it is: two short texts that genuinely resemble each other.
The number was right and the conclusion drawn from it was wrong,
because agreement about a picture presumes both parties were describing one.
Reading the stored text was what settled it,
and no threshold could have.

## Two refusals corroborated each other, and the fix is a shape rather than a list

The corroborated pair recorded above was checked rather than trusted,
and it was not a reading of anything.
Both entries hold this:

```text
hf:Qwen/Qwen3.6-27B      "There is no text visible in this image."
hf:moonshotai/Kimi-K3    "No legible text is visible."
```

Two models declining to read, agreeing with each other at 0.565 trigram overlap,
and marked `corroborated`.
Nothing downstream could tell:
a corroborated reading travels to the translator and the judge
under the heading `WHAT THE PICTURES HERE SAY, transcribed by two readers that agreed`,
so both sheets would have asserted
that the picture says `There is no text visible in this image.`

That is worse than no reading.
A refused picture is silent, and silence is what the design is built to fall back to.
An asserted falsehood is evidence pointing the wrong way.

### Why the existing screen missed it

The per-reading screen carried a phrase list including
`no text is visible` and `no visible text`.
The first reply misses by WORD ORDER.
The second misses because `legible` sits between `no` and `text`.
Each slipped by exactly one word.

The list had also lost its safety net without anyone noticing.
Its own comment said "the anchor clause catches most of what it misses",
and the anchor clause was deleted earlier the same day
for refusing correct readings.
Removing a clause left the clause that depended on it standing alone,
which is the ordinary way a screen quietly narrows.

### The replacement, and why it is not a longer list

`src/reading-refusal.ts` tests SHAPE rather than wording.
A refusal talks about the picture:
it negates, it names the picture or its text, and it is a sentence rather than a passage.
A transcription reproduces what the picture holds and does none of those.
So a reading reads as a refusal when all three hold:
at most 160 characters after trimming,
containing a negation word,
and containing a word for the picture or its text.

All three are required because each alone refuses real readings.
The word lists are compared against whole words from a linear scan,
so `not` cannot fire inside `note`.

### Measured, both directions

Positive control, the two replies that caused this:
both now refused, clause `reads-as-refusal`.

Negative control, the six real transcriptions kept from the boundary probe:
all six usable, at 390, 394, 448, 454, 590 and 632 characters.
Between them they contain
ZERO English negation words and ZERO picture words,
so neither list can reach them even before the length bound is consulted.
Their shortest is more than twice the bound.

The separation is not marginal on this sample,
and the sample is small enough to say so plainly:
six real readings and two refusals.
What makes it worth shipping is not the count
but that the two populations differ in kind rather than in degree.
A Chinese transcription has no occasion to write the English word `image`.

## Why the reading stage alone could fail an entry

Both CLI defects share a root, and naming it is worth more than either fix.

Every other model-calling stage in the pipeline goes through `attemptStageCall`
(`src/stage-call.ts`), which wraps the exchange and ends with:

```ts
  catch (error) {
    // Aborts must always win so user steering can stop a fan-out.
    if (signal.aborted)
      throw error;
    l.warn(`${stage} ${modelId}: ${String(error,)}, voice lost`,);
    return { heard: false, };
  }
```

A model that fails loses its voice; the stage carries on with the voices it has;
an abort still travels.
That is why `translate-repair.ts` can call `Promise.all` over its candidates
without any of the exposure the reading stage had:
each call inside it is already contained.

`readImageAsset` calls `client.chatText` DIRECTLY.
It is the only stage that does.
So it inherited none of that, and a reader that threw
took its partner's reading, the picture, the document and the entry with it.

The fix places the same two rules at `readImagePair`,
which is the reading stage's own fan-in:
`Promise.allSettled` so a failure costs one reading,
then `signal.throwIfAborted()` so a stop still wins.
Deliberately the same shape and the same order as `attemptStageCall`
and as `runStageRound`, rather than a third way of saying it.

Routing readings THROUGH `attemptStageCall` was considered and not done.
It is built around a JSON response format and a validator,
and a transcription is neither, so the fit would be a parameter that means
"skip most of this function".
The containment is what matters and it is now stated in both places.

WHAT TO CHECK IF ANOTHER STAGE IS ADDED: whether it calls the client directly.
That question, asked once, would have caught both of these before a run did.

## What the corpus's pictures actually hold, measured deterministically

Every figure above about readings was a figure about MODELS.
None of them said how many corpus pictures carry text at all,
so none of them could say whether a picture producing no reading was a miss
or the correct answer.

Tesseract 5.5.3 with `chi_sim` and `eng`, over all 191 distinct
source-referenced assets, no model involved and no quota spent:

```text
CARRY TEXT          72
NO TEXT AT ALL     119
missing on disk      0
undecodable          0

text length over the 72 that carry any:
  min 1   p50 122   p90 759   max 2965
```

So 119 of 191 pictures, close to two thirds, are photographs with nothing to transcribe.
A reader declining those is RIGHT, and every earlier reading of "no usable reading"
as a shortfall was reading a correct answer as a failure.

The `min 1` matters as much as the maximum.
Tesseract on a photograph returns a few characters of noise rather than a clean zero,
so "carries no text" needs a floor taken from this distribution
rather than a strict comparison against zero.

### Deterministic OCR agrees with the models, in both directions

On the six assets where a model reading is on record, six of six agree:

```text
wangzihao980/Word1.webp       675x1200   tesseract  205   models read 390 / 394
zheermao101/photo3.webp      1225x533    tesseract  388   models read 448 / 454
dogesir_/intro.webp          1080x984    tesseract  540   models read 590 / 632
wangzihao980/picture4.webp    313x679    tesseract    0   both models: no text
wangzihao980/picture2.webp    270x360    tesseract    0   both models refused
Uekawakuyuurei/img231.webp   2024x1492   tesseract    0   both models refused
```

Tesseract reads what they read, at comparable length,
and finds nothing exactly where they found nothing.

It also has NO CONTEXT CAP, so it reads the 45 assets no model can be sent at all,
and it is deterministic, which the models are not:
the same picture corroborated at 0.643 in one probe and disagreed at 0.087 in a CLI run.

## The size cap, and why "best quality" cannot mean the highest number

45 of 191 assets sit past the smaller reader's allowance of 294912 bytes.
Re-encoding to AVIF at `--qcolor 100` fits ZERO of them,
because it makes every one LARGER, by four to twelve times:

```text
Uekawakuyuurei/IMG_1308.webp   1344454 -> 12302890 at q100
gqt/photo1.webp                1274028 ->  7929946 at q100
Mio/photo5.webp                1129330 ->  8224189 at q100
```

The source is lossy webp and near-lossless AVIF is not,
so "the best quality setting" has to mean the highest quality that FITS,
found by sweeping rather than assumed.

Only 17 of the 45 carry any text, so only those 17 are worth rescuing.
Sweeping `--qcolor` downward until the re-encode fits,
then decoding it back and re-reading it to check the text survived:

```text
asset                          ocr before   fits at   bytes    ocr after
Aniloviraw/photo0.webp               2965      q30    230558      3015
gqt/photo1.webp                      2329      q30    267639      2258
Aniloviraw/photo1.webp               1914      q60    288031      1926
Zha_Ke/letter.webp                   1585      q40    285611      1588
Chinatsu_Suzuki/photo2.webp           536      q50    273734       530
MizuharaNagisa/letter.webp            446      q40    213174       335
zhangyubaka/photo1.webp               298      q60    273039       298
Uekawakuyuurei/IMG_1308.webp           24    NO QUALITY FITS DOWN TO q30
```

Sixteen of seventeen fit, and on every asset carrying substantial text
the re-encode preserves it: `Zha_Ke/letter.webp` reads 1585 characters before
and 1588 after, `zhangyubaka/photo1.webp` exactly 298 both times.

NO RESIZING IS INVOLVED. `Zha_Ke/letter.webp` stays 1080 by 5645 pixels.
The bytes come down by re-encoding, which is what was asked for,
rather than by discarding resolution, which was not.

The one that never fits, `Uekawakuyuurei/IMG_1308.webp` at 5737 by 3970,
carries 24 characters, and the sweep's own read-back shows why that number
is noise rather than text: the low-yield assets swing wildly across the
re-encode, 45 to 25, 18 to 43, 1 to 11, while the text-bearing ones hold steady.
Nothing is lost by leaving it unread.

## The store, proven on the real thing

A settled entry RETIRES its own caches, so the settled path can never show a
resumed reading: after `wangzihao980` settled, its `slice-cache/wangzihao980/`
directory was gone and only the artifact remained.
The case the store exists for is therefore an entry CUT OFF mid-run,
which is what a deadline, a crash, or the owner's REISUB produces.

Run twice over `DarlinChit`, the first interrupted after its reading landed,
the second identical and into the same runs directory:

```text
FIRST RUN
  19:58:19.997  gathered 1 of 1 pictures for DarlinChit
  19:58:19.997  reading 1 pictures for this document
  19:58:28.113  hf:Qwen/Qwen3.6-27B read photo1.webp: 168 characters
  19:58:35.034  hf:moonshotai/Kimi-K3 read photo1.webp: 163 characters
  19:58:35.034  photo1.webp: corroborated by 2 readers at overlap 0.866

SECOND RUN
  19:58:39.959  gathered 1 of 1 pictures for DarlinChit
  19:58:39.959  reading 1 pictures for this document
  19:58:39.960  photo1.webp: resumed, corroborated
```

Zero `readImageAsset` lines in the second run, against two in the first.
The resume lands one millisecond after the gather, where the first run spent
eight seconds and then fifteen.

Two things worth keeping beyond the resume itself.

This is the first CORROBORATED READING OF REAL CORPUS CONTENT on record here:
168 and 163 characters of the same picture, agreeing at 0.866,
which sits inside the 0.643 to 1.000 band measured for readings of one picture
and far outside the 0.000 to 0.129 band measured for readings of different ones.
Every earlier "corroborated" row in this document turned out to be two refusals.

The entry that used to die now settles.
`corpus-pass --only wangzihao980` finished `status=SETTLED slices=6`,
`processed=1 of pending=1`, `artifacts=1/92`, where the same command before the
containment fix finished `status=ERROR` with `processed=0`.
STATED PRECISELY: no reader threw during that run, so it does not re-exercise the
containment. What it shows is that the wiring runs end to end and an entry with
six pictures settles. The containment itself is held by the unit guards, which
were shown to fail with it stripped.
