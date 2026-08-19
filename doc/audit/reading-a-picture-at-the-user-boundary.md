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
