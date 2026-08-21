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

## What the bed can and cannot show

Three confounds were checked against the artifacts before the bed was scored,
because each would have made the readout mean something other than what it
claims.

NO SLICE IN THE BED CARRIES A PICTURE.
The translate lane is shown `pictureContext` in production and the calibration
arm passes none, so a bed slice whose passage transcribes an image would put
blind consolidation producers against a candidate that could see.
Measured: no bed slice source carries image syntax, and no settled artifact for
the six entries records a picture reading at all.
The readout is clean on that axis, and the wiring is still owed the day a bed
includes one.

AT 5 OF 13 SLICES ONE CANDIDATE IS THE ARCHIVE, CHARACTER FOR CHARACTER.
The translate lane returned the archive verbatim at `lintong` slices 1 and 2 and
at `Zha_Ke` slice 1; the repair lane returned it verbatim at `Acheron` slices 0
and 1.
The sheet renders that text twice, once as ARCHIVE RENDERING and once as a
CANDIDATE, and a producer weighing the apparent agreement of two sources is
counting one source twice.
This is production's behaviour and not the bed's, since a lane declining to
change the incumbent means the archive was already right there.
Recorded as `#142`, to be fixed after the bed rather than during it.

THE BED CANNOT SHOW THE SHEET AND THE GUARD DISAGREEING.
The sheet asks for the archive's shape and the guard checks the standing text's,
which diverge only where a lane wins with a reshaped slice.
No bed slice does, so this readout says nothing about that case.
Recorded as `#140`.

## The scorecard, and what it refuses to decide

`consolidate-score.mjs` reads the run's log and buys nothing, so it can be run
against a partial bed while the run is still in flight.

It COUNTS measurements 1 and 2:
how often the gate ships a consolidation over the standing text, with the ballot
split at each slice, and how many consolidations were structurally valid before
any return round.

It REFUSES to count measurements 3 and 4, which ask whether a text is BETTER.
It prints those slices with the original, both candidates and what shipped, side
by side, and names what to read for at each: at the tied slices, whether the
shipped text is one the reading would prefer to both lanes; at the ten decided
slices, whether anything the winning lane carried is gone.
The reading is the measurement, and the sheet is its worksheet.

It also names a case the counters would otherwise bury: slices where a return
round ran AND the contest ballots said a candidate DROPPED something.
A consolidation restoring what the standing text is missing is, to a guard
anchored on the standing text, a surplus to be deleted.
Nothing in the bed has hit that yet, and the scorecard prints the ballots
whenever it does.

## First slice, and the tripwire it had to clear

`lintong` slice 1 was the slice that exposed the source anchor, so it is the one
the restarted run had to clear before the other twelve were worth buying.

Under the page anchor all six consolidations were structurally valid with no
return round, against none under the source anchor, and every one of them kept
the block quote and its attribution line rather than flattening them.
The gate settled on the consolidation, three of six ballots naming it and three
calling the pair equivalent.
What shipped is the winning lane's text with one unsupported word removed, which
is measurement 4's criterion met rather than merely not violated: nothing the
winner carried is gone.

## One anchor for three stages, and the question it leaves open

`#139`, `#140` and `#142` are three symptoms of one unsettled question:
WHICH TEXT DECIDES THE SHAPE OF A RENDERED SLICE.

Today three stages answer it three ways.
The translate lane validates against the SOURCE.
The consolidation arm validates against the STANDING text, which is whichever
lane won.
The consolidation sheet asks for the shape of the ARCHIVE.
Any two of those disagree wherever the archive is shaped differently from the
Chinese, which is 4 of 19 measured comparison rows, and the first bed slice is
one of them.

THE FIRST ANSWER WAS "ANCHOR EVERYTHING TO THE ARCHIVE", AND IT IS WRONG.
It is kept here as a rejected option rather than deleted, because the reason it
fails is the reason the guard ends up shaped the way it does.
The argument for it was that the archive is the only reference every stage can
share, the source being another language's shape.
"Measured: neither text is a correct structural authority" refutes it, and
"What the guard should check instead" is what replaces it.

WHAT SURVIVES IS THE FRAMING, NOT THE ANSWER.
The three stages must stop answering the shape question three ways, and `#140`
still dissolves rather than needing a design of its own, because the rule that
settles `#139` settles it too.

WHAT NOTHING HERE SETTLES, and what no measurement in this bed can settle:
an archive whose own shape is wrong.
The rule below ACCEPTS the archive shape wherever a candidate matches it, which
preserves a bad one as faithfully as a good one, and the owner's standard is
that what we produce must be good even where the original is not.
The first bed slice is the easy direction, where the archive's block quote and
attribution line are better than the Chinese paragraph they render.
The hard direction, an archive that merged what the Chinese separates, has not
been looked for and is not in the bed.
It is recorded here rather than guessed at.

## Measured: neither text is a correct structural authority

Anchoring every stage to the archive was the obvious answer, and it is wrong.
Measured over every settled artifact on this machine, 68 distinct
entry-and-slice records (the same passage appears more than once where two runs
sliced it differently), using the package's own `readSliceSkeleton`:

-   48 records: the archive and the Chinese carry the SAME block sequence, so
    the shape is not in doubt at all.
-   11 records: the archive carries MORE blocks, almost always an English
    rendering splitting one dense Chinese paragraph.
-   7 records: the archive carries FEWER blocks.
-   1 record: same count, different kinds.
-   1 record: unparseable under the strict grammar.

THE SEVEN ARE TWO DIFFERENT PHENOMENA, and that is the finding.
At `lintong` the archive merges several Chinese paragraphs into a block quote
and an attribution line, which is a better shape than the Chinese has.
At `Aniloviraw` slice 0 the archive is missing a whole block quote the Chinese
carries, and at slice 2 it is missing two trailing elements.
The first is a reshape to preserve.
The second is content the archive DROPPED, which is the whole reason this
pipeline exists.

SO AN ARCHIVE ANCHOR WOULD FORBID THE RESTORATION.
A rendering that puts back what `Aniloviraw`'s archive lost has one block too
many, gets called invalid, goes back to its author, and comes back with the
restoration deleted.
That is the mirror of the defect the source anchor caused at `lintong` slice 1,
and it is worse, because a lost block is lost silently while a flattened quote
is at least visible.

## What the guard should check instead

SUPERSEDED by "The shape rule, settled: the page is a floor, not a ceiling".
What follows is the match-either rule as it was proposed and its two recorded
limits, kept because the measurement that produced it still stands and because
the reason it was dropped is only legible beside it.
The rule that shipped treats the page as a floor rather than as one of two
acceptable sequences.

WHERE THE TWO REFERENCES AGREE, which is 48 of 67 parseable records, the guard
stays exactly as strict as it is now.
Both texts say the same thing about the shape and a candidate departing from it
has no defence.

WHERE THEY DISAGREE, a candidate is valid if it matches EITHER the archive's
block sequence or the Chinese's.
The shape is a judgement call there, the pipeline has no authority that settles
it, and a guard that picks one anyway manufactures findings on 19 of 67 measured
records and sends models back to undo defensible work.
THAT SHARE IS NOT A CORPUS RATE: the pool is the settled artifacts on this
machine, five of the seven fewer-block records are one entry sliced by different
runs, and one entry dominates the more-block records.
Matching either still catches the failure the guard was built for, a model
returning one undifferentiated blob, except where a reference is itself one
block.

THE PROTECTED ATOMS ARE UNAFFECTED and stay strict against both.
A footnote marker or a link that appears in neither reference is invented, and
one that appears in both and not in the candidate is lost, whatever the block
shape does.

TWO LIMITS, RECORDED RATHER THAN BUILT AROUND.
A candidate matches one reference SEQUENCE ENTIRE, so an archive that both
reshapes what it keeps AND drops a trailing block leaves the ideal rendering,
reshaped prefix plus restored tail, matching neither.
No measured record does both, and the `Aniloviraw` prefixes are kind-identical
so a restoration there matches the Chinese, but it is unmeasured rather than
impossible.
And a one-sided slice has no archive text at all, so the second reference has to
be OPTIONAL, degrading to today's single-reference check rather than refusing
every candidate.

THE CONSOLIDATION BED STAYS VALID UNDER THIS RULE.
Its first slice is a disagreement record, and what the six producers returned
matched the archive's sequence, which the proposed rule accepts.
Nothing measured so far would have to be bought again.

## The bed stopped at five slices, and why

`lintong` slice 2 shipped a consolidation that signs a friend's note with the
DEAD PERSON'S name, alias and city.
The Chinese signs it as left by a friend; the standing text had that right; the
consolidation put the archive's declared identity into the attribution line.

THE CAUSE IS A SHEET RULE, and it is production's, not the bed's.
`src/translate-selection-sheet.ts` gives every slate judge a criterion saying a
candidate dropping a declared name "has left something out", and the
consolidation sheet says carrying one is correct "even where the passage never
spells it out".
Read literally, both instruct a model to put the archive's identity block into
any passage, and one judge had already abstained at the previous slice for the
stated reason that no candidate carried the declared location.
Recorded as `#143`, with the measurement that put the rule there, which the fix
has to keep satisfying.

THE RUN WAS STOPPED RATHER THAN FINISHED.
Five of thirteen slices were bought, every one of them under the defective
wording, so scoring them would measure the defect.
The owner's standing instruction is to fix and restart rather than to score
around a defect, and this is the second time this bed has earned it.

## The shape rule, settled: the page is a floor, not a ceiling

Two candidate rules survived the measurement, and the bed's own rejections
separate them.

MATCH EITHER REFERENCE is too weak.
At `lintong` slice 2 the Chinese is five paragraphs and the page is a block
quote plus an attribution line, so a candidate matching the Chinese exactly
would be accepted with the quotation marks gone, and the passage is a note
somebody left, which is what the block quote says about it.

THE PAGE IS A FLOOR.
A candidate is structurally valid when the ARCHIVE'S BLOCK SEQUENCE APPEARS IN
IT IN ORDER, and it carries no more blocks than the longer of the archive and
the Chinese.
Where the archive has no text for the slice, the check falls back to today's
exact match against the Chinese.

WHAT THAT DECIDES, on every case measured so far:

-   `lintong` slice 1, where the source anchor called six good renderings
    invalid: the archive's two blocks appear in each, so all six pass.
-   `Aniloviraw` slice 0, where the archive is missing a whole block quote: a
    rendering that restores it still contains the archive's one block in order
    and has no more blocks than the Chinese, so the restoration is no longer
    deleted.
-   The three rejections the bed actually produced, one rendering of six
    paragraphs and two that swallowed the attribution line into the quote: all
    three still fail, because the archive's sequence is not inside them.

## What landed before the bed was bought again

Five changes, each with its guard shown failing when removed, and the bed
restarted from zero afterwards because every earlier row was produced under the
wording being fixed.

THE PAGE IS A FLOOR (`3ca134e57`).
`validateTranslatedSlice` takes the original AND the text a candidate replaces,
requires the page's block sequence to appear in the candidate in order, and
allows no more blocks than the longer of the two references.
Protected atoms take the larger demand of the two, so a footnote the archive
added is kept and one the archive dropped is restored.

THE PAGE IS NOT ALWAYS THE INCUMBENT (`3accdf27d`).
`repairInvalidCandidates` takes `pageText` separately, because a consolidator's
incumbent is the lane that won the contest while the page it replaces is the
archive.
It defaults to the incumbent, so the translate lane is unchanged.

A DECLARED NAME IS A SPELLING AUTHORITY (`e0e822733`).
Both sheets said a candidate dropping one had left something out, which is what
signed a friend's note with the dead person's name.

A CANDIDATE THAT IS THE ARCHIVE SAYS SO (`60f8d97ae`).

THE GATE STOPPED CHECKING ONE QUORUM TWICE (`9261c8efd`), which the GFP pass
found: removing the repeated conjunct failed no test, because
`settleGateBallots` cannot answer `consolidated` on fewer voices than the
quorum. A condition no case can reach reads as a second guard and is not one.

## What the floor rule dissolves, and what #144 cost

THE LIMIT THAT DISAPPEARED. Match-either recorded a case it could not serve: an
archive that both reshapes what it keeps AND drops a trailing block leaves the
ideal rendering, reshaped prefix plus restored tail, matching neither reference
entire.
The floor rule serves it outright.
A source of three paragraphs against an archive that merged two of them into one
block quote and dropped the third gives a floor of one block quote and a ceiling
of three, so the ideal rendering, block quote plus restored paragraph, sits
inside both bounds and is valid.
The rule that shipped is therefore not merely simpler than the one it replaced;
it accepts a rendering the earlier proposal would have sent back.

WHAT #144 FOUND, one slice into the second bed run.
Three sheets still told their models the ORIGINAL was the shape standard while
the guard floored candidates on the page.
The judge criteria were the dangerous one: judges apply these criteria literally,
which run 1 proved when one abstained from a whole slate over the declared-names
wording, so at every reshaped slice an archive-shaped consolidation could be
marked down by the very stage that is supposed to choose it.
The translator sheet and the repair follow-up were the expensive ones: each buys
a return round at every reshaped slice by construction, one by asking for the
source's shape and the other by announcing the check compared against the source
alone.

WHY THE JUDGE CRITERION NAMES NEITHER TEXT.
The existing translation reaches these judges anonymously, as one candidate among
the others, and never travels as labelled evidence.
A criterion naming the page would name a text the judge cannot see, so the
criterion now asks only what is checkable from a candidate alone, and says
outright that a shape the ORIGINAL does not have is not a fault.

THE BED WAS BOUGHT AGAIN, for the second time in a day.
One row had landed under the old criteria and it was discarded rather than
scored, on the standing instruction to fix and restart rather than to score
around a defect.
