# The third rendering

A proposal, not a decision.
Opened by the owner's rejection of the question this task asked on 2026-08-21.

## What the owner ruled out

The question put to the owner was what a slice the contest declines should ship,
offered as a choice among the archive rendering, the repair lane's text and the
translate lane's text.
The answer rejected the question rather than the options:
quality is paramount,
and whatever this pipeline produces must be good even when the originals are
not.

TWO THINGS FOLLOW, and both are fatal to the question as asked.

A SELECTION SHIPS WHAT IT WAS GIVEN.
Every option on offer selected among texts already produced,
so a slice where none of them was good had no good answer available.
The question assumed the pipeline's last act is a choice.

THE ARCHIVE IS NOT A FLOOR.
Three of the four options leaned on the archive rendering as the safe default.
Human authorship is not evidence of quality,
and "even when the originals aren't" rules it out in as many words.

## Why a selection can never satisfy that standard

`doc/audit/eight-entries-read-against-the-original.md` found the two lanes
failing in OPPOSITE DIRECTIONS rather than at different points on one scale.
The repair lane inherits the archive's inventions.
The translate lane discards what the archive knew and the source does not carry.

At `keyword233` slice 1 the reading recorded both lanes being better than the
other IN DIFFERENT PLACES within the same slice:
one keeps a sense the other flattens,
and the other keeps an agent the first one displaces.
No selection among the two can produce that slice's best text,
because that text is not either candidate.

A CONTEST IS COMPARATIVE AND THE OWNER'S STANDARD IS ABSOLUTE.
`lane-won` means one candidate was more faithful than the other.
It does not mean the winner is good.
So a release rule reading "ship the winner" fails the standard at exactly the
same slices a rule reading "ship the archive on a decline" fails it,
and for the same reason.

## Why this proposal has no trigger

The obvious shape is an escalation:
detect the slices where the shipping text is defective,
and produce something better only there.
Two candidate detectors exist, and neither is good enough to be a gate.

THE RENDERING AUDIT IS NOISIER THAN THE EFFECT IT WOULD TRIGGER ON.
`doc/audit/rendering-audit-settled-population.md` audited 40 digest-verified
identical pairs three times.
The corroborated total moved from four to ten,
and ten of the forty subjects flipped between claiming something and claiming
nothing.
A trigger built on it fires on a different set of slices each run.

THE CONTEST HAS A STRUCTURAL BLIND SPOT.
Its ballots blame candidates relative to each other,
so a defect BOTH candidates share is invisible to it:
the inherited-invention case is precisely where the two lanes agree.

So this proposal fires everywhere the lanes differ,
which is the population the contest already enumerates,
and spends the calls rather than betting the release on a detector measured to
be unreliable.
The owner's standing instruction is that quality is paramount and quota is not
the constraint.

## What the stage does

CONSOLIDATE, one call per contested slice per roster voice.
The producer is shown, in the order the critic prompt uses:

-   The declared names both documents' front matter carries.
-   The original passage, which is the standard.
-   The archive rendering, as evidence about what the original says and as
    wording worth keeping where it is right.
-   Both lane candidates, named.
-   Every finding the contest's own ballots recorded against either candidate,
    verbatim, with the candidate each blames.

It is asked for ONE English rendering that states everything the original states,
states nothing the original does not,
keeps whichever candidate's wording is already right clause by clause,
and reads as English rather than as a repair of English.

STRUCTURE IS CHECKED DETERMINISTICALLY, by `validateTranslatedSlice`,
which is the same guard the translate lane's candidates pass.
A consolidation that changes the block skeleton goes back to its own author,
exactly as an invalid translated slice does by the decision of 2026-08-14.

## How it is decided

THE CONSOLIDATION IS NOT TRUSTED BECAUSE IT IS NEWEST.
It is a third candidate produced by the same kind of instrument that produced
the first two, and it can be worse.

So it faces the standing text in a second contest,
asking the same two questions the lane contest asks,
over a vocabulary naming this pair:
`consolidated`, `standing`, `neither`.
The standing text is whatever the lane contest settled on,
which is a lane at `lane-won` and is undefined at the other two verdicts.

WHAT THE OTHER TWO VERDICTS STAND ON is the part this proposal leaves open,
and is the one place the owner's answer is still needed:
at `settled-neither` and `quorum-not-met` there is no standing text to face,
so either the consolidation ships unopposed,
or the contest runs against both lanes in turn,
or the slice reaches the terminal state directly.

## The terminal state

A slice whose consolidation loses, and whose standing text carries corroborated
findings, has no text this pipeline can call good.
That is a real outcome and it gets its own recorded kind rather than a silent
fallback.
The release names those slices in a list.

THAT LIST IS THE OWNER'S QUESTION, RESUBMITTED WITH EVIDENCE:
a small set of specific slices, each with its original, its candidates and what
was found against them, rather than an abstract rule chosen in advance.

## What is measured before any of this is wired

The 13 slices of `doc/audit/eight-entries-read-against-the-original.md` are the
bed, because each carries a reading against the Chinese.

1.  How often the roster backs a consolidation over the standing text.
2.  Whether the consolidation is structurally valid without a repair round.
3.  Whether the three slices the reading called tied get a text the reading
    would prefer to both lanes, read fresh against the Chinese.
4.  Whether consolidation damages the slices where the contest already agreed
    with the reading, which is the risk that would refuse this whole shape.

Measurement 4 is the control.
A stage that improves the hard slices and degrades the easy ones is a loss,
and nothing in this proposal survives that finding.
