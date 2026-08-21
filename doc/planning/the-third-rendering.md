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

THE FINDINGS ARE CLAIMS, NOT FACTS, and the sheet says so.
They are judge output, and judge output is what `M3 fix D` had to teach the
critic policy not to treat as golden.
A producer that obeys a false finding introduces a defect this pipeline authored
itself, which is worse than the one it was sent to fix.
So each finding is shown as something to CHECK against the original before
acting on it, and a finding the original does not support is to be ignored.

THE LINE STRUCTURE ADDENDUM IS CARRIED, on the same conditional the translate
wire uses.
Verse slices are line-structured, and a producer not told so merges lines,
which `validateTranslatedSlice` then refuses on every attempt.

STRUCTURE IS CHECKED DETERMINISTICALLY, by `validateTranslatedSlice`.
A consolidation that changes the block skeleton goes back to its own author
through `repairInvalidCandidates`,
exactly as an invalid translated slice does by the decision of 2026-08-14.

AGAINST THE PAGE, NOT AGAINST THE ORIGINAL, and that correction was measured
rather than reasoned.
The first calibration slice is one Chinese paragraph that the archive renders as
a block quote followed by an attribution line.
Checked against the original, all six consolidations were invalid, five were
sent back, and the rendering that then won had flattened the quote and its
attribution into one plain paragraph:
damage this stage authored itself.
Over the nineteen comparison rows of the eight read entries the archive's shape
differs from its source slice's at four.
What a consolidation replaces is the text on the page, so the page is what it
has to match, and the sheet says so in the same words the guard uses.

THE TRANSLATE LANE IS STILL ANCHORED TO THE SOURCE, recorded as `#139`.
It is a separate decision with a separate blast radius, and this stage does not
wait on it.

THE REPLY SHAPE IS THE TRANSLATE LANE'S OWN, `{"translation": "..."}`.
That is not a convenience: it means `isTranslateReportWire`,
`repairInvalidCandidates`, `buildTranslateCandidates` and `judgeTranslateSlate`
are reused rather than reimplemented,
and the only new thing in the producing half is the sheet.

## How one consolidation is picked out of six

SIX PRODUCERS YIELD SIX RENDERINGS, and free prose almost never collides,
so deduplication will not reduce them to one.

`judgeTranslateSlate` is the selector, with the STANDING text as its incumbent.
Task `#109` split the translate stage into a producing half and a judging half
precisely so one slate could be judged on its own, and this is that caller.
It brings the self-vote discount, the identical-candidate collapse, the
candidate rotation and the blank-selection guard with it, none of which is worth
reimplementing.

ITS QUESTION IS A PREFERENCE, and a preference question measured worse than the
contest's question on the lane pair, 8 of 13 against 10 of 13.
It is nonetheless the right question HERE.
What made the general question fail on the lane pair was the asymmetry between
a candidate that inherits and a candidate that discards.
Six consolidations and the standing text are all renderings of the same original
written with the same evidence, so that asymmetry is absent.

## How it is decided

THE CONSOLIDATION IS NOT TRUSTED BECAUSE IT IS NEWEST.
It is a third candidate produced by the same kind of instrument that produced
the first two, and it can be worse.

So when the selector prefers a consolidation to the standing text,
that consolidation then faces the standing text on the CONTEST's question,
the one that asks what the original supports,
over a vocabulary naming this pair:
`consolidated`, `standing`, `neither`.

CHANGING THE SHIPPED TEXT NEEDS MORE EVIDENCE THAN KEEPING IT.
The standing text ships on `standing` and on `neither` alike.
That is not caution for its own sake: the translate wire already records the
reason, that a reader who knows this archive should not see it churn, and a tie
means the evidence does not carry a preference.

WHERE THERE IS NO STANDING TEXT, at `settled-neither` and `quorum-not-met`,
the consolidation faces EACH LANE in turn and ships only if it loses to neither.
Adopted here rather than put to the owner:
"must be good" determines the answer, and facing both also dissolves an
ambiguity in the contest prompt, whose `neither` covers both "both are clean"
and "both are equally unfaithful" without saying which.
A veto is welcome; a question would have been rubber-stamping.
This branch went unexercised in calibration, where the treatment arm declined on
none of thirteen slices, so it is a recorded rule rather than a measured one.

## The terminal state

A slice where the consolidation lost AND the second contest's own ballots blame
the standing text has no text this pipeline can call good.
That is a real outcome and it gets its own recorded kind rather than a silent
fallback.

THE EVIDENCE IS THE TWO CONTESTS' BALLOTS, never the rendering audit.
Deriving it from the audit would re-import the instrument this proposal rejects
as a trigger, at the one place where being wrong costs the most.

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

MEASUREMENT 3 HAS A KNOWN ANSWER TO CHECK AGAINST.
The reading names which clause each lane got right at `keyword233` slice 1,
so whether a consolidation carried both is legible rather than a matter of
taste.

MEASUREMENT 4 IS THE CONTROL, and it is read per slice rather than in aggregate.
At `keyword233` slice 0 and `Weideriche_` slice 0 the reading recorded two GOOD
texts, both lanes having corrected everything the archive got wrong, so a
consolidation that ties there has passed rather than failed.
On the ten slices where the reading named a lane, the criterion is that nothing
the winner carried is lost.
A stage that improves the hard slices and degrades the easy ones is a loss,
and nothing in this proposal survives that finding.

NOTHING HERE IS SCOPED DOWN FOR THE RELEASE DATE, by the owner's instruction of
2026-08-21.
The invalid-candidate return to its own author, the line-structure addendum and
the control arm are all part of the first build rather than of a later one.
