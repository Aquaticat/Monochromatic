# On the quarter measure: a letter seeking a better method

To Archimedes, who weighed the sand and bounded the circle from within and without,
greetings.

I keep a library of songs, and I have a small problem of measure that I cannot best,
so I bring it to you in the hope that your method exceeds mine.

## The task

Each song has a single loudest instant.
Not the loudest of the marks we wrote down when we captured it, but the loudest the air
truly reaches when the song is played back and the sound is reconstructed between our marks;
a crest can rise between two written points higher than either.
For each song I must find that instant, or a safe estimate of it, so I may set one constant
loudness for the whole song: quiet enough that the true crest never breaks the vessel at the
gate, yet no quieter than that.
Too loud by even a little is harsh.
Too quiet is a song that should have been fuller.

There are two errors, and they are not equal.
If I set a song too loud, a guard at the gate clips the one crest that overflows: a brief
harshness on that instant, but the vessel does not break.
If I set a song too quiet, the whole song is diminished, and there is no guard to restore it.
So my bound is asymmetric: I may err loud by no more than a half of a decibel, and I would
rather not err quiet by more than two.
The quiet error is the only cost I truly pay within the bounds; the loud error the guard
softens.

## The one law

To know a song's loudest instant for certain, I must hear the whole song, for the crest can
hide anywhere.
But the library is vast.
Measured exactly, it is nine hundred sixteen thousand eight hundred sixty-one seconds of sound,
across four thousand one hundred fourteen songs.
And I am permitted to listen to no more than a quarter of all those seconds: two hundred
twenty-nine thousand two hundred fifteen, and not one more.
This is the law I cannot break.
Everything else is open.

The difficulty is precisely this: the crest I most need to hear is the one I did not, because
it hid in the seconds I did not spend.
What I did hear tells me little of what I did not.

## The methods I have exhausted

I have tried many roads, and each taught me its wall.

I tried listening to a fixed span of every song, the same number of seconds each.
This fails, for the same span is a whole short song but a single breath of an hour-long
rhapsody, and the long songs then hide their crests in the vast unheard remainder.

I tried listening to a fixed fraction of every song instead, a fifth of each, spread in even
snatches from beginning to end, so that my attention is uniform and no song is slighted for
its length.
This is better, and it is close to what I now do.
Yet a few songs still hide a single sharp cry between my snatches, and against those few I am
helpless by this road alone.

I tried listening from the beginning until the loudness seemed to settle, and stopping there
to spend my hearing elsewhere.
This fails worse than the fixed span, for music is not a rising tide; the loudest cry often
comes late, after a quiet opening, and the settling deceives me.

I tried a two-part scheme: a brief listen to every song, and then a full hearing of only the
songs that seemed dangerous.
Here is the cruelty of the problem.
If some oracle told me which songs were dangerous, this road reaches almost perfect measure,
erring quiet by less than a sixth of a decibel, well within the quarter.
But I have no oracle, and I cannot tell the dangerous from the innocent by the brief listen,
because the hidden cry leaves no trace in the seconds I did hear.
A song may sound quiet in every snatch I take and yet hide a crest four decibels above them.
No threshold of loudness separates these, for they sit among the innocent at every level.

I tried reading the marks the scribes left on the songs, their provenance and their own
declarations of loudness.
The copies drawn from the singing-videos are never the hot ones, and the losslessly-kept are
never the culprits; these marks are true.
But they name the safe, not the dangerous, and they cover only a fifth of the library, and
where a song declares its own peak that declaration understates the true crest by near two
decibels, for it counted only the written marks and not the crest between them.

I tried judging by the unevenness of what I did hear, reasoning that a song whose snatches
vary greatly must be turbulent and hide crests.
The correlation is weak, a seventh at best, and for the same reason as before: the danger lives
in the unheard, and the variance of the heard cannot see it.

I tried grouping songs by their album, for songs of one album pass through one maker's hand and
share its loudness.
This is the most promising of the cross-song roads.
Within an album the loudest instants sit close, a decibel or so apart in the median, and to
hear the loudest song of an album is to bound all its fellows from above, safely, for the album
maximum is never exceeded by any member.
Hearing the loudest song of every album would cost only a tenth of the library.
But the lone songs have no album, and the loose folders gather unrelated songs whose loudness
spans wildly, and these have no fellows to vouch for them.
So the album bounds the many but not the few, and the few are exactly my problem.

## Where I now stand

This is the best policy I have, and I do not believe it is the best that exists.

For short songs, up to ninety seconds, I hear the whole and know the crest exactly.
For each longer song, I hear a fifth of it, in short evenly-spread snatches, and I take the
true crest to be eight tenths of a decibel above the loudest I heard.
That margin is a choice, and it is the crux of the whole matter.

The saving grace is the shape of the difficulty.
For almost every song, the crest I miss is a mere fourteen hundredths of a decibel above what I
heard: the songs are easy, and my snatches nearly suffice.
It is a long thin tail of a few songs, each hiding one sharp cry shorter than a tenth of a
second, that sets the whole margin.
To insure that last handful with certainty costs a full decibel of needless quiet laid upon
every song.

So I do not insure them.
With the eight-tenths margin, ninety-nine songs in a hundred sit within eight tenths of a
decibel of perfect, which is the whole of their audible cost.
The remaining one in a hundred, some forty-three songs, hide a crest my margin does not cover;
on those the guard at the gate clips the one overflowing instant on the first playing, a brief
harshness, and the idle hours later hear each in full and record its exact loudness, so the
harshness is a thing of the cold first hearing only, and never returns.
Not one of those forty-three carries a safe mark; they are the untagged hot masters, exactly
the songs no mark could vouch for.

## What I ask of you

I ask for a better method, and I forbid you nothing but the breaking of the one law.

Rule nothing out.
If you can find the feature I could not, the trace in the heard that betrays the unheard cry,
then the two-part scheme with its oracle becomes real, and the margin falls near to nothing:
build the classifier I failed to build.
If you can devise a cleverer sampling than even snatches, one that spends its seconds where
crests are likelier, tell me its rule.
If you can model where in a song the loud instants gather, and aim my hearing there, show me
the model.
If you can infer one song's crest from another's more deeply than the album allows, name the
kinship.
If the scribes' marks hold more than I read, read them deeper.
If the very bones of the encoding, the frames and their gains, betray a loud passage without a
full hearing, break them open.

Beat me on any of the three measures and I will take your method: the worst quiet a song
suffers, or the average quiet across all songs, or the count of songs the guard must clip on
their first hearing.
Only keep within the quarter.

## A ledger of the facts, that you may test your method

I set down the numbers plainly, so you need not take my word.

- The library: four thousand one hundred fourteen songs, nine hundred sixteen thousand eight
  hundred sixty-one seconds decodable.
- The budget: a quarter, two hundred twenty-nine thousand two hundred fifteen seconds.
- The vessel: a ceiling of one decibel below full scale, and I only ever attenuate, never
  amplify.
- The bounds: no more than half a decibel too loud, no more than two decibels too quiet.
- The crest is estimated by a Catmull-Rom reconstruction between the written marks, sampled at
  the quarter, half, and three-quarter points; this is the one meter, shared by every method.
- My current policy: full hearing under ninety seconds; else a fifth of the song in
  three-tenths-of-a-second snatches, evenly placed; plus an eight-tenths-of-a-decibel margin.
- Its result on the library: it hears twenty-one hundredths of all the seconds, within the
  quarter; the missed crest is fourteen hundredths of a decibel in the median, six tenths at
  the ninetieth part, one and a third at the ninety-ninth, and two and a quarter at the very
  worst; and forty-three songs, some one in a hundred, are clipped on first hearing.

The evidence, the tools to reproduce it, and the roads I walked are recorded in the plan at
`doc/planning/music-player-shared-truepeak-core.md`, in its Stage-two section.
The meter, the gain, and the shipped policy live in the crate
`packages/music-player/truepeak-core`.
The measurer that hears the library and writes down each song's crest and its per-tenth-second
loudnesses is `packages/music-player/truepeak-core.bench`, its collector; and the same package,
run with the word `--proportional`, reproduces every number in the ledger above from that
measurement, without hearing the library again.

If your method is better, it will show itself there, in those same seconds, under the same law.

Farewell, and think well.
