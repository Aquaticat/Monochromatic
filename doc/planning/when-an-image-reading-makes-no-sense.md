# When an image reading makes no sense

`#111`'s authorized answer is
"B, but best effort, fallback to A whenever an image's OCR doesn't make sense",
and it says the rule has to be written down before it is implemented,
because it selects between two behaviours rather than describing one.
This is that rule.

Status: proposal.
The default stated here is implemented so the work is not blocked,
and it is cheap to change because it is one function with its own tests.

## What each branch costs

The two branches are not symmetric,
and the asymmetry is what sets the threshold.

TRUSTING A BAD READING IS EXPENSIVE.
The reading becomes the source a transcript is judged against,
so a wrong one licenses replacing a human's careful transcription
with something derived from a misreading,
and the judges have no way to tell,
because the reading is the only evidence they are given about the picture.

FALLING BACK IS CHEAP.
Option A protects the block structurally:
it stays out of translation and is spliced back unchanged.
That is exactly where the pipeline stands today for every transcript,
so a fallback loses nothing that currently exists.

SO THE RULE IS DELIBERATELY EAGER TO FALL BACK.
A reading has to earn its use.
This is the opposite of how a detector for a defect should be tuned,
and it follows from the costs rather than from taste.

## The rule

A reading is used only when every clause holds.
Otherwise the block falls back to structural protection.

### One: the reading has to say something

A reading under 16 characters after trimming is refused.
An image nobody could read returns an apology or nothing,
and both are shorter than any transcript worth having.

### Two: the reading must not be a refusal

A reading is refused when it carries a first-person inability
in its first 200 characters:
wording of the shape "I cannot", "I am unable", "I can't make out",
"no text is visible", "the image is unclear".
This clause is a heuristic and it is stated as one.
It is safe in the direction that matters,
because a false positive here costs only the fallback.

### Three: where the archive already transcribed the image, the two have to agree on something

This is the clause that does the work,
and it applies only when a transcript already exists.

Extract ANCHORS from both texts:
runs of digits of length two or more,
Latin word tokens of length four or more, lowercased,
and any `@handle` or bare domain.
Anchors are the parts of a transcription that survive translation and paraphrase:
a date, a username, a version number, an email address.

Require the reading and the archive transcript to share at least two distinct anchors,
or, where the archive transcript itself carries fewer than two,
at least one.

A reading of a DIFFERENT picture shares none.
A reading of the same picture shares its dates and handles
even when every sentence around them is worded differently.

### Four: where the archive has not transcribed the image, the reading stands on clause one and two alone

There is nothing to agree with,
and refusing on that basis would mean the pipeline could never add a transcript it does not already have,
which is half of what `#111` is for.

## What this rule does NOT do

IT DOES NOT JUDGE TRANSLATION QUALITY.
Whether the reading is a good rendering is the judges' question,
and they are equipped for it.
This decides only whether the reading is about the right picture at all.

IT DOES NOT SCORE CONFIDENCE.
There is no threshold to tune between "probably fine" and "probably not",
because the branch is binary and the costs are lopsided.

IT DOES NOT ASK A MODEL.
A second model deciding whether the first model's reading is sensible
is another call, another failure surface,
and it would need the picture too.

## Two things a reader should be suspicious of

THE ANCHOR CLAUSE ASSUMES TRANSCRIPTS CARRY ANCHORS,
and they do, by a wide margin.
Measured with the shipped extractor over every known target-only transcript
the block splitter can see:

```text
zheermao101   2115 chars   131 anchors      MizuharaNagisa  1969 chars   142
zheermao101   1071 chars    73               dogesir_       1487 chars   125
Mio           2052 chars   119               wangzihao980   1098 chars    79
Mio           1882 chars   132               shihai4h       1678 chars   112
Mio            477 chars    37               shihai4h       1350 chars    91
```

The floor is 37 against a requirement of 2,
because these transcribe profiles, letters and chat logs,
which are dense in handles, dates and addresses.

ONE CASE CANNOT BE MEASURED THIS WAY.
`Zha_Ke` wraps its transcript in a disclosure container with no blank line inside,
so the blank-line splitter does not see a quoted block there at all
and neither this measurement nor the transcript guard reaches it.
That is a gap in the splitter rather than in this rule,
and it is recorded here because a reader checking the table would otherwise
wonder why the entry is absent.

A transcript of a handwritten note with no names, dates or numbers
would carry no anchors,
and the rule would fall back on it every time.
That is the safe direction, and it is a real limit rather than a hypothetical one.

CLAUSE TWO IS PATTERN MATCHING ON APOLOGIES.
It will miss a refusal worded unusually.
Clause three catches most of what it misses,
because an apology shares no anchors with a transcript.
Where no transcript exists, an unusual refusal would pass,
and the result is a bad transcript added where none was before.
That is the one path where this rule can make things worse rather than merely
leave them as they are, and it is the one worth watching in the first run.

## Where the reading comes from, and why it is its own stage

`#111` warns that the vision sub-roster is exactly two,
that selection needs a minimum weight of two,
and that a producer's ballot for its own work counts half,
so where both vision models produce, no disinterested judge remains.
That is a real problem for one design and not for another.

READING IS SEPARATED FROM TRANSLATING, which dissolves it.
A vision model is asked only to READ the picture, producing text.
That text is then evidence, like the source and the archive are evidence,
and the ordinary six-model roster translates and judges from it
without any of them needing to see the picture.

This costs one or two calls per image and buys three things.
The roster is untouched, so selection keeps its weights and its disinterested judges.
The reading is a value that can be screened,
which is what the rule above does and what it presupposes.
And the reading is cacheable per asset,
where a translation carrying an inline image would be cacheable only per slice.

THE ALTERNATIVE, attaching the image to every translate and judge call,
was rejected on the roster arithmetic rather than on cost:
it puts the two vision models on both sides of their own work
and leaves four models judging text they cannot check.

## Image size, and when to give up on one

Measured over the 284 assets in the pinned corpus:
median 71 KiB, mean 154 KiB, largest 1312 KiB.
Base64 inflates by a third,
so the largest asset would arrive as roughly 1.75 MiB of prompt,
which is around 450 thousand tokens and does not fit the context of either vision model.

The images the known transcripts describe are smaller,
`Zha_Ke/letter.webp` at 613 KiB being the largest of them,
which is about 817 KiB encoded and does fit,
expensively.

THE RULE: an asset above a stated encoded size is not sent,
and the block falls back to structural protection.
`sharp` is already in this workspace and downscaling is therefore available,
but it is deliberately NOT the first move:
a downscaled photograph of handwriting is exactly the input
that produces a confident wrong reading,
which is the failure this whole rule exists to avoid.
Refusing a picture too large to send is honest;
shrinking it until it fits and then trusting what comes back is not.
