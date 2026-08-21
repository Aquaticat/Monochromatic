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

### Measured, not inferred: judges were already deciding slates on the source shape

The two archived bed runs carry 26 judge ballots between them.
SIX OF THE 26 NAME THE ORIGINAL'S SHAPE as a reason for their choice, one of
them citing "Criterion 4" by number and rejecting two candidates in the same
sentence for what it called violating structure while praising the winner for
conveying the passage as one coherent paragraph rather than a disjointed list.
That is the criterion deciding a slate, on a slice where the archive and the
Chinese disagree about how many blocks the passage has.

So the fix is not a precaution against a failure mode that might appear.
It removes a criterion that six ballots were visibly applying, against the same
shape the guard was simultaneously demanding candidates depart from.
Neither archived run is scored, because both were produced under wording that
has since changed, but they are evidence about the instrument rather than about
the pipeline, and that evidence survives the run being discarded.

### The ballot that failed a whole slate on both criteria at once

One of the six is not a passing remark.
At `lintong` slice 1, the run I stopped, a judge abstained from the entire slate
and gave two reasons: that no candidate spelled the declared handle the way the
identity block does, and that "the original is a single unbroken paragraph with
no block-quote markers, yet every candidate wraps the text in block quotes and
most fragment it into separate quoted lines, altering the markdown structure
(criterion 4)".

Every candidate wrapped the passage in block quotes because THE ARCHIVE PAGE
DOES, and the guard requires it: the page's blocks are the floor.
So the slate was refused for obeying the guard, by a criterion that had not been
told the guard had changed, and the refusal cost that slice its whole judged
decision.
Criterion 4 is closed by `#144`.
The criterion 3 half was NOT closed by `#143`, which settled whether a declared
name is content a passage owes and said nothing about how to spell one; the
spelling half is `#145`, and the check that decided it is recorded in "Two
spelling authorities, no precedence".

A tripwire in the scorecard prints any ballot whose stated reason reaches for the
source's shape or for a declared name, and it was shown firing on this archived
row before being trusted on a live one.

### Two spelling authorities, no precedence

READ RATHER THAN ASSUMED, through the package's own `collectIdentityLines`
against the corpus page and against the archived rows.
At `lintong`, the identity block declares one romanised form of the handle and a
second as an alias.
The English page uses THREE forms across its length, one of which the block
declares nowhere, and that undeclared form is the one standing in the slice both
lanes worked from.
Every consolidation copied it. So did both lanes. So did the shipped text.

THE TWO SHEETS DISAGREED, and neither said which wins.
The translator sheet said names already used by the existing translation are
authoritative and are kept exactly.
The judge sheet said declared names are used exactly as given.
Where an archive contradicts its own front matter, producers were instructed to
write the form the judge was instructed to penalise, and every candidate on the
slate inherits it at once, so the fault cannot order them: the judge's only
literal move is to refuse the whole slate, which it did, twice at the same slice.
The incumbent that survives that refusal is where the spelling came from.

SETTLED. The declared spelling outranks the archive's usage, in both producing
sheets, because the front matter is what the archive DECLARES and its prose is
demonstrably inconsistent with itself.
Where the block offers more than one form, any declared form is right; where the
block is silent, the archive's usage stands as before; and inventing a third
spelling is forbidden as it always was.
The judge is separately told that a spelling every candidate shares cannot
separate them, so it decides on the other criteria rather than declining.

WHY THIS WAS WORTH A THIRD RESTART. One row had landed. The alternative was
thirteen slices measured through an instrument that had already been observed
failing a slate for obeying its own guard.

### What the four refused slates were actually refusing

The archived bed rows carry 114 ballots.
FOUR OF THEM REFUSED AN ENTIRE SLATE, and reading all four is what turned two
hand-found defects into a class:

-   `lintong` slice 1, twice, on the declared spelling and on the source's block
    shape, which are `#145` and `#144`.
-   `gaoyanger` slice 1, on tense: every candidate was said to have altered the
    time reference by rendering a tenseless Chinese copula in the past.
-   `keyword233` slice 0, on tense together with a declared location the passage
    does not mention, which is the `#143` direction.

TENSE IS IN THREE OF THE FOUR, and the rule that settles it already existed.
`critic-prompt.ts` tells its critics that supplying what English requires and the
original can omit, a pronoun, a number, an article, A TENSE, is required rather
than added.
No judge had ever been shown that sentence.
Judges were split in both directions on the same question: one refused a slate
for rendering the present in the past, another marked a candidate down for
keeping the present as awkward for a memorial page.

THE GAP WAS WIDER THAN TENSE.
Every producing sheet in the package splices `HOUSE_POLICY_BLOCK`; no judging
sheet did.
The stages that decide what SHIPS were the only stages never told that reader
protection outranks completeness, while criterion one asks them for every
proposition of the original with nothing left out.
A rendering that keeps a suicide method vague, which is the corpus's own rule,
reads as an omission to a judge holding only the numbered list.

SETTLED as `JUDGE_POLICY_BLOCK`, spliced once into `buildCandidateSelectMessages`
so all five judge panels get the same text and none can drift from the producers.
It states precedence outright, because three of the four refusals came from
judges applying a numbered criterion literally against everything beside it.

FOUR DEFECTS, ONE SHAPE. `#143`, `#144`, `#145` and `#146` are all the same
failure: a rule given to the models that WRITE and withheld from, or contradicted
for, the models that CHOOSE. The bed has been started six times, and every
restart was paid for by a defect that would otherwise have decided the corpus.

### The sweep that should have come first

Two of these were found by hand, in ballots.
The rest were found in one pass that asked a different question: which system
prompts in this package carry the corpus's rules, and which do not.

-   Producing sheets carrying them: the translator, the consolidator, the
    critic, the coverage reader, the refiner, the adjudicator.
-   Deciding sheets carrying them: none.
-   The editor, which REWRITES text rather than judging it: none, though
    `house-policy.ts` names it as a consumer in its own comment.

THE EDITOR IS THE SERIOUS ONE.
The block's header states the failure it exists to stop: a page keeps a suicide
method vague because the corpus's rule says to, a critic ignorant of the rule
files it as an omission, and the editor restores the detail.
The critic was given the rule and the editor was not, so exactly half of that
sentence was guarded.
Its own sheet told it five separate times that every detail of the original must
survive and that an omission must be filled in full sentences with nothing
dropped.

WHAT THE SWEEP COST, and what finding these one at a time cost.
The sweep is one `rg` over `role: 'system'` and one grep for the block name.
Finding `#144` and `#145` by reading ballots cost two bed restarts.
A sweep of the same kind belongs at the front of any measurement that depends on
what models were told, and this one is now recorded so the next measurement can
start with it.

## Two checks run before run 6 could pay for them

Both were run while the bed was in flight, so a hit would have cost one slice rather than ten.

### The overturned wording exists nowhere but the tests that pin it

The sweep that found #146 to #148 checked whether each sheet carried the policy block.
It could not have found #147, which was a stale copy of wording #143 had already overturned,
sitting in a sheet that did carry its policy.
So the second sweep looked for the overturned phrasings themselves across every file under `src/`:
`HAS dropped`, `has left something out`, `of the ORIGINAL preserved`, `are authoritative`,
`compared against the ORIGINAL by a mechanical`, `omitting one`.

Every hit is either a test asserting the phrase is absent, a comment recording why it was removed,
or the one live site that now carries the precedence clause after it
(`src/translate-wire.ts`, where `are authoritative` is immediately followed by
`WHERE DECLARED NAMES IS SHOWN AND SPELLS THE SAME PERSON OR PLACE DIFFERENTLY, THE DECLARED SPELLING WINS`).
No sheet the bed exercises carries an overturned claim.

The sweep was widened past `role: 'system'` to the two files that build model-facing text without one.
`src/consolidate-brief.ts` renders judge findings under `Says what the original does not`
and `Omits what the original says`; those are labels on ballot output,
and the ballots are now produced under the corrected policy,
so the labels describe what the judges were asked for.
`src/line-structure-addendum.ts` is the one open question and is recorded under its own heading.

### The findings recording is proven at runtime, not by reading the edit

`validityBefore` and `validityAfter` were widened from a bare validation kind to
`{validation, findings, unknownDetail}` several runs ago, and nothing had ever shown the wider shape populated.
Run 3's archive (`consolidate-calibrate.jsonl.before-spelling-precedence-fix`) was written under the widened harness
and carries an invalid row, so it is a positive control that costs nothing to read.

Its `lintong` slice 1 row records four models' verdicts, and the invalid ones carry the check's own words:

- `The PAGE AS IT STANDS is 2 blocks (blockquote, paragraph) and your translation is 1 (blockquote).`

The harness records findings. A `kind: 'invalid'` in run 6 will say what failed, not merely that something did.

## The verse addendum still speaks for the original, and no bed slice can show it

`LINE_STRUCTURE_RULE` in `src/line-structure-addendum.ts` opens
`This region's ORIGINAL IS line-structured: each original line is a unit`,
then asks the editor to keep every existing line in place.
The second clause is the floor rule; the first names the ORIGINAL as the authority on how many lines there are.
On the case the rule exists for, `Toka_ls`, the two disagree:
the Chinese chunk is 21 blocks at median 22 and the English rendering is 18 blocks at median 101.
An editor reading the first clause as licence may re-split the merged rendering,
which is the shape claim #144 removed from three other sheets.

It cannot affect run 6.
`isLineStructured` was run over all thirteen bed slices and returned false for every one,
so the addendum is empty on every call the bed makes.
It is a production follow-up, filed with the other unswept sheets rather than restarting the bed.

## The measuring sheets now carry the rules too, and one of them needed a fourth verdict it did not get

The four sheets of #149 grade rather than write, so nothing ships from any of them.
What they decide is which defects get worked on next,
and an instrument that penalises a page for obeying the rules it was written under reports damage where the pipeline was right.

`JUDGE_POLICY_BLOCK` could not simply be spliced into them.
Its closing paragraph reads
`WHERE A CRITERION AND A HOUSE RULE DISAGREE`
and speaks of a candidate,
and a checker has neither: it has issues, regions, verdicts and a text under review.
So the two shared paragraphs were lifted out
(`HOUSE_POLICY_BLOCK` and `FORCED_DIFFERENCES`)
and each consumer supplies its own close.
`JUDGE_POLICY_BLOCK` recomposes from the pieces and is byte-identical to what the running bed's judges see,
3037 bytes, checked against a snapshot taken before the edit.

### What the resolution checker could not be told, and why it was not given a fourth verdict

`RESOLUTION_VERDICTS` is `fixed`, `not-fixed`, `worse`.
An issue asking an editor to restore a detail reader protection keeps out is an issue that should never have been filed,
and none of the three verdicts says that.
`checker-sensitivity.ts` already names the case,
its fabricated `ABSENT_ISSUE` is labelled `not-fixed-defect-was-never-there`,
and that harness exists to catch a checker answering `fixed` by agreeing with the sheet instead of reading the text.

Whether a fourth verdict was owed turned on one measurable fact: what an unresolved issue costs.
It re-fires nothing.
`runCheckerStage` is called once in `repair-chunk.ts`, after the editor's rounds,
`resolvedIssueIds` is credit-only,
and `notFixed` is read nowhere but `tally-resolution.ts` and the sensitivity probe.
The one real consequence is in `refine-phase.ts`,
where a previously confirmed issue going unresolved rolls the refinement back, which is the conservative direction.
So the checker is told to answer `not-fixed` and told outright that the issue itself is wrong,
and the known limit is recorded here rather than papered over:
the tally cannot distinguish an unfixed defect from an issue that was never a defect,
so a protected-detail issue reaching the checker understates repair quality by one.

The splice bought something the sheet could not do before.
Where an editor DID restore a protected detail, `worse` is the correct existing verdict,
and until now nothing gave the checker any reason to cast it.

### The prober had an active contradiction, not merely a gap

`PROBE_RULES_HEAD` says content the AFTER text drops is damage only if the ORIGINAL supports it.
On a protected detail the ORIGINAL does support it, which is the entire reason the rule exists.
A block spliced beside that bullet would have left two live rules disagreeing, with the older one written as a numbered rule.
`PROBE_HOUSE_RULE_CLAUSE` names the interaction in as many words.

### The restoration grader keeps its anchor

The 2026-07-17 directive grades restoration against the Chinese source, and the block does not move that anchor.
An anchor on the source is what makes the bias possible:
a repair rendered vaguer than the Chinese because reader protection asks for it reads as a partial restoration.
The added line says such a repair is `restored`, and that carrying a detail the rules keep out raises no verdict.

### A guard that reported success without running

The first version of `measuring-sheets-carry-house-rules.unit.test.ts` called `describe` without `await`.
The file registered nothing, printed nothing, and exited zero;
the whole suite then reported `exit=0` with no failing line while six cases had never run.
This was caught only by grepping the log for the suite's own name rather than trusting the exit code.
Every other test file in the repo already awaits its `describe`, so this is a trap rather than a defect:
a suite is proven to exist by finding its name in the output, never by the run's exit status.

## The verse rule and the page rule contradict each other, and the guard settles nothing

This section replaces a first reading that was wrong, kept here because the wrong reading is the instructive part.

### What was claimed, and what refuted it

The claim was that `TRANSLATE_LINE_STRUCTURE_RULE` tells a producer to emit one line per ORIGINAL line
while the structural guard floors on the page as it stands,
so every verse candidate would be rejected on any page that had merged lines.

Measured, and refuted.
`validateTranslatedSlice` has two sides, and neither of them forbids unmerging on verse.
Every block of the page must appear in the candidate, in kind and in order, so a candidate that MERGES the page's blocks fails.
Extra blocks are allowed, but only where the ORIGINAL has them:
a three-block candidate against a one-block page returns `valid` when the source is verse and `invalid` when the source is prose,
with `Add a block only to carry something the ORIGINAL has and the text you are replacing left out.`

So on a line-structured chunk the guard actively PERMITS the unmerge, because the original licenses every block it adds.
The guard and the verse rule agree; it was the two sheet rules that did not.

The probe was positive-controlled before its null was trusted, per QPC.
The control reproduces the archived finding verbatim:

- `The PAGE AS IT STANDS is 2 blocks (blockquote, paragraph) and your translation is 1 (blockquote).`

So the null on the verse cases is a real null, and the guard has nothing to say about unmerging.

### What is actually wrong

On a line-structured chunk the producer's system prompt carries two rules that point opposite ways,
and until now neither deferred to the other.

- `TRANSLATE_RULES`, from #144: where the existing translation shapes the passage differently, keep the existing translation's shape.
- `TRANSLATE_LINE_STRUCTURE_RULE`, from #79: produce one output line per original line, and where the existing translation has merged lines, unmerge them.

On `Toka_ls`, the entry the verse rule was written for,
the Chinese chunk is 21 blocks at median 22 against the English rendering's 18 blocks at median 101.
One rule says keep 18 and the other says restore 21.
Both arrive in one prompt, and a producer meeting a contradiction resolves it however it likes.

The verse rule wins, and now says so.
It rests on a measured failure and its own recorded decision, while #144's bullet was written about prose reshaping.
Because the guard is a floor, nothing downstream would ever have caught the wrong choice,
which is why the precedence had to be stated in the sheet rather than left to the check.

`LINE_STRUCTURE_RULE` in `line-structure-addendum.ts` is NOT the same defect.
It is given to an editor working on the standing text, where keeping every existing line is the anti-reflow rule #79 built,
and its own documentation states the distinction.

### It could not have reached run 6 either way

The bed computes `lineStructured` with `isLineStructured` over each slice's source text,
and that predicate returned false for all thirteen bed slices,
so neither producing sheet emits the rule on any slice this run buys.

## The three instruments still discriminate under the longer prompt

A static guard proves the rules ARRIVE.
It does not prove a checker still tells a fix from a non-fix with several kilobytes more in front of it,
so all three sensitivity probes were run live against their pre-built fixtures.

Resolution checker, every arm where the harness expects it:

- a genuine fix reads `fixed` on all three voices, an untouched text reads `not-fixed` on all three, and a fix that damaged its slice splits two `fixed` against one `worse`.
- on the mixed sheet the tense issue resolves, the meaning issue does not, and the FABRICATED issue draws two `not-fixed` against one `fixed`, so the majority still refuses to agree with a sheet describing something absent from the text.

Introduced-defect prober:

- `deletion/mislabelled`, where real damage sits under a false accepted issue, draws three removal-corroborated claims.
- `deletion/licensed`, the negative control where silence is correct, draws `none-found` on all three.

Rendering auditor:

- the flipped rendering draws an agreed `altered-polarity` finding on two voices.
- the clean rendering agrees at neither tier, which is the expectation; one voice filed a lone claim and no agreement formed on it.
- two degraded lines on the flipped arm are infrastructure rather than sheet: one voice lost and a 2-of-3 roster.

## Measurement 3, read on the three slices the reading called tied

Read while the run was still buying its last slices, because the reading is the slow half and these three were already settled.
The question fixed in advance was whether a consolidation gives these slices a text the reading would prefer to BOTH lanes.

### keyword233 slice 0: no consolidation, and that passes

The judges declined and the standing text shipped.
By the rule fixed for this slice, where the reading recorded two good texts, a tie passes.
The lanes differed on two words: the repair lane wrote `opened her own channel` and `heartfelt reflections`,
the translate lane `set up her own channel` and `spiritual reflections`.
`心灵感悟` is reflection of the heart, and `spiritual` invites a religious reading the Chinese does not carry,
so the standing text that shipped is the better of the two.

### keyword233 slice 1: better than either lane

The consolidation took `坚强不屈` as `unyielding` from the repair lane,
where the translate lane's `resilient` drops the `不屈` half outright.
It took `这在我看来很棒` as `which I find wonderful` from the translate lane,
where the repair lane's `I thought` moves a present-tense judgement into the past.
And on `她用她的智慧和热情` it wrote `She used her wisdom and passion to add a touch of brightness`,
restoring an agent that the repair lane dropped (`Her wisdom and passion brought`)
and that the translate lane demoted to an adverbial (`With her wisdom and passion`).
Nothing in either lane is missing from it.

### Weideriche_ slice 0: better than either lane, and one of the wins is a house rule

The original's block quote ends `有伤口不要用酒精x`, where the trailing `x` is a typed flourish that says nothing in English.
The repair lane copied it across as its own line.
The translate lane dropped it.
The consolidation dropped it, and one contest ballot cited the rule by name,
saying the translate candidate `adheres to the house rule for omitting meaningless punctuation`.
That is the punctuation rule of `HOUSE_POLICY_BLOCK` deciding a live ballot.

It also kept `伤口` singular, `a wound`, where the translate lane had pluralised it, which another ballot had flagged.
And it kept the recipient in `也会向其他人表达自己的关心`, which the translate lane dropped;
the shipped `to them` resolves an ambiguity the Chinese leaves open, but preserving the recipient beats dropping it.

So two of the three tied slices got a text better than both lanes, and the third correctly changed nothing.

## The consolidation has no assembly step, so nothing wraps it

Every SHIPPED consolidation in this run is one long line per paragraph while both lane texts are semantically wrapped.
The cause is structural rather than a stray setting:
`wrapReplacementText` is called from exactly two places,
`wrapTranslateRecords` in `translate-assemble.ts` and `wrapRepairOutcomes` in `repair-assemble.ts`,
and both are lane assembly steps.
A third rendering that no lane assembles inherits neither.

Nothing in production is wrong today, because consolidation is not wired.
Wired as it stands, every consolidated slice would ship unwrapped into a corpus #122 converted to semantic wrapping.
Filed as its own task, blocking the wiring half of this work.

## Measurement 4 has already found one: the consolidation changed the tense of a page

`gaoyanger` slice 1 is a slice where the reading and the contest AGREED on the translate lane,
which is the population measurement 4 exists to protect.
The gate settled on a consolidation anyway, and that consolidation moved the slice from past into present.

- standing: `Gaoyang was a cute, gentle, and kind girl. She grew up in a single-parent family with difficult living conditions, but she was always very strong.`
- shipped: `Gaoyang is a cute, gentle, kind girl. She is from a single-parent family, and from childhood her living conditions were difficult, but she has always been very strong.`

The rest of the page is past.
Chunk 0's standing text reads `Gaoyang indulged in the cradle of happiness.`,
and chunk 1's own standing text reads `Gaoyang was a pretty, tender and kind girl.`
A reader meets both tenses on one short memorial page.
The shipped sentence also disagrees with itself: `She is from a single-parent family, and from childhood her living conditions were difficult.`

The shipped text is not worse on any other axis.
It separates `单亲家庭` from `从小生活条件不好`, which the Chinese does carry as two clauses and the standing text had fused.
So this is a tense defect specifically, not a bad consolidation.

### The mechanism, read off the sheets rather than guessed

`consolidate-wire.ts` splices `HOUSE_POLICY_BLOCK`, which says nothing about tense,
so the producer choosing the wording had no guidance at all, with the past-tense standing text in front of it.
`contest-ballot-wire.ts` splices `JUDGE_POLICY_BLOCK`,
whose forced-differences paragraph tells the gate that rendering a tenseless copula in past or present is a choice English forces and never a fault.
The producer was free and the decider was told not to object.

That paragraph was added by #146 for a measured reason and is not the thing to undo:
three whole-slate refusals came from judges treating a forced tense as an alteration of the time referred to,
and Chinese does mark no tense.
What no sheet has ever carried is the other half.
A slice joins a page that already has a tense, and absent a reason to change it, the page's tense is the one to match.
Consistency with the page is a different claim from whether a forced choice is a fault, so stating it does not reopen the refusals.

This is the run reporting a behavioural finding rather than an instrument defect,
which is what a swept instrument is supposed to produce.

## The sixth run scored complete, at 13 of 13 slices

Run 6 finished every slice. The four measurements fixed in advance are answered
below. No passage is quoted here: findings are described structurally, and the
texts stay in the run artifacts.

### Measurement 1: how often the roster backs a consolidation

The gate ran at 7 of 13 slices and shipped the consolidation at 7 of 7.

The other six never reached the gate. Five declined at the judging step with
`declined-indecision` and shipped the incumbent (`lintong#2`, `keyword233#0`,
`Weideriche_#1`, `Acheron#1`, `Acheron#2`), and `Zha_Ke#0` has no standing text
at all, so there was nothing to contest.

The 7 of 7 needs one qualification before it reads as endorsement. Three of the
seven shipped on a minority of decisive ballots, with refusals at or above the
winning count: `keyword233#1` at two consolidated against four `neither`,
`Acheron#0` at two against four, `Weideriche_#0` at three against three. A
`neither` ballot means the two texts differ only in wording and neither is more
faithful, which is the churn case the sheet elsewhere warns against. Whether a
plurality of refusals should keep the standing text is a counting-rule question
this run raises and does not settle.

### Measurement 2: structural validity without a repair round

63 of 78 candidate renderings were valid on the first attempt, and 6 of the 13
slices were clean at 6 of 6. The failures cluster on two shapes: pages whose
standing text is a block quote, where producers flatten or multiply the quote,
and `Zha_Ke#1`, where three producers emitted text that would not parse as MDX
at all.

### Measurement 4: damage where the contest already agreed with the reading

The answer is no, in two different ways, and both are real.

#### `gaoyanger#1`: the tense finding, with the ballots behind it

Recorded already as issue #152 and fixed since. The scorecard supplies the
mechanism the earlier reading could only infer. The panel split three to three.
Three judges preferred the past-tense candidate, one of them saying outright
that the present tense wrongly implies the person is alive, which in a memorial
is a defect of dignity rather than of style. Two of the three judges who
preferred the present-tense candidate justified it by appealing to the
original's unmarked tense and its present copula, which is exactly the reading
the forced-differences paragraph invites when nothing names the English as the
authority. The present-tense candidate won and shipped.

This is a positive control for the #152 fix rather than an argument against
#146: the judges who were right were already right, and lost the vote to a
reading the fix now removes.

#### `Zha_Ke#1`: the consolidation deleted a person's will from the page

The most serious finding of the run, and it outranks everything else open under
#138.

The slice's ORIGINAL is a single parenthetical content warning. Its standing
English is that warning FOLLOWED BY the entire will: a `<details>` and
`<summary>` wrapper, dozens of lines, a numbered list of final wishes. The
shipped consolidation is the warning alone. Everything after it is gone, and
the gate voted six to nil to ship it.

Three separate defects compose to produce that, and each is independently
actionable.

    1.  The slice pairs one line of Chinese against a span of English many times
        its size. Whatever the pairing intended, the consolidation was asked to
        render a note and handed a will as the text it replaces.
    2.  The structural floor could not stop it. The scorecard's floor section
        reports `Zha_Ke#1` as `shipped=valid` while `standing=INVALID:1`: the
        standing text does not parse, so the guard has no block list to floor
        on, and a one-paragraph candidate passes against a page it cannot read.
        The floor is disabled exactly where it mattered most.
    3.  The faithfulness criterion then rewards the deletion. One ballot
        objected to candidates that "add an entire 'My Will' document not
        present in the ORIGINAL", reasoning correctly from the criterion it was
        given. Another ballot objected in the opposite direction, that rival
        candidates "omit the body of the will". The panel had no rule telling it
        which of those two readings governs.

Nothing here is specific to consolidation. A selection between two lanes would
face the same three defects; the third rendering is what made them visible.

### Two findings about the wrapper, pointing opposite ways

Every one of the seven shipped consolidations is unwrapped: a single long line
per paragraph, where both lane candidates arrive semantically wrapped. This is
#151 observed live rather than inferred from the call graph.

The second finding constrains how #151 may be fixed. Judges actively penalise
semantic wrapping in their ballots, calling it arbitrary line breaks,
unnecessary line breaks, and breaking mid-sentence in a way that undermines
coherent reading. At least five ballots across four slices demote a candidate
for it. So the wrapper must run AFTER selection and never on a candidate a judge
is shown, or fixing #151 will cost the wrapped lane its votes.

### Correction to the `Zha_Ke#1` account, and the real cause

The finding stands and the mechanism is confirmed, but the evidence first cited
for it was the wrong field, and the cause is one layer deeper than described.

WHAT WAS WRONG. The account cited the scorecard's `standing=INVALID:1` as proof
that the page does not parse. `standingText` in the bed is not the archive page:
`standingOf` returns the WINNING LANE'S candidate, the text that would ship if
the consolidation lost. The page is `incumbentText`.

WHAT WAS MEASURED INSTEAD, by running the production validator directly over the
run-6 state rather than reading the scorecard's summary:

    -   `sourceText` is 41 characters on one line.
    -   `incumbentText` is 3875 characters over 73 lines.
    -   `repairText` and `translateText` are both 3875 characters: BOTH LANES
        KEPT THE WHOLE THING.
    -   `shippedText` is 164 characters on one line.
    -   `validateTranslatedSlice` returns `valid` for the shipped text and
        `invalid` for the page itself, whose finding is that it could not be
        parsed as Markdown.

So the conclusion holds exactly as stated: the floor was disabled because the
page does not parse, and a candidate that drops 3711 of 3875 characters passed
against the source alone.

THE CAUSE, which the first account did not reach. The strict grammar's complaint
is `Expected a closing tag for <details>`. The slice boundary cuts THROUGH an
HTML element: the opening tag is inside this slice's span and the closing tag is
not. The span is therefore not a well-formed document fragment, and no strict
parse of it can succeed no matter what any producer writes.

The same page parses cleanly under the plain-markdown grammar, which reads it as
two blocks, a paragraph and an html block. Under that reading the floor bites
correctly and the one-paragraph candidate is refused.

This reframes the slicing task: not "one line of Chinese paired against a large
English span" alone, but a slicer that splits inside an HTML element.

## The fail-open floor, fixed

Issue #153, landed in `0cf2f759b` and `393ee5486`, GFP-proven.

`validateTranslatedSlice` turned a page the strict grammar refused into no page
at all, so the floor had no block list and fell back to comparing the candidate
against the original alone. A check that could not run answered yes.

The page side now downgrades to plain markdown; the candidate side stays strict.
That split is what the two decisions already in the code imply rather than a
reversal of either: `inspect-paragraph.ts` refuses the fallback for a CANDIDATE,
which this pipeline asked for and may refuse, while `parse-document.ts`
downgrades a whole PAGE, which is archive text nobody here wrote.

The relaxed reading deliberately claims no atoms. Plain markdown collapses an
html region into one opaque node, so the references and code inside it are
invisible, and reporting an empty atom list as complete would make the atom
check pass by ignorance. Only the block sequence is claimed.

### What the regression diff showed

The floor section was rerun over all thirteen bed slices with the patched
validator. `Zha_Ke#1` shipped flips from valid to invalid, with the finding
naming a page of two blocks against a candidate of one. No other verdict
anywhere in the scorecard moved.

### Nothing ships at a slice cut through an element, and that is correct

Two guard cases pin this, because it is a consequence worth knowing rather than
an oversight. A candidate reproducing the cut page exactly is refused at the
CANDIDATE parse, which stays strict. A candidate that writes the element
correctly is refused at the FLOOR, because the two grammars disagree about what
the same element is: the page read loosely calls it an html block, a candidate
read strictly calls it an `mdxJsxFlowElement`, and the kinds never match.

Fail-closed both ways is the safe answer for a span that is not a well-formed
fragment. Every candidate is refused, the incumbent stays, and the content
survives. It is not shipping, and making such slices shippable belongs to the
slicer, which is #154.

### The downgrade is recorded, and the source-side twin is not a live problem

The fallback was itself silent at first, which the repo's own parser policy
forbids. A refusal already shows which reading produced it, since the finding
names the blocks compared, but a pass carried no evidence at all. The verdict
now carries the grammar that read the page, and `translate-repair.ts` records
`translate-page-downgraded` beside the existing `translate-unvalidated`.

The source arm of the same check was probed and left alone. It returns `unknown`
on a strict refusal, `translate-repair.ts` already records that as
`translate-unvalidated`, and zero of the thirteen bed slices reach it. A
recorded fail-open with no live case is not worth changing without one.

## How much of the corpus the mid-element cut puts at risk

Measured while run 7 was in flight, since it needs no quota. Counts only: no
passage is reproduced.

    -   18 of 92 English pages carry block-level HTML.
    -   12 of 92 entries use `<details>` specifically, which is the multi-line
        wrapper a slice boundary can land inside. `XingZ60` uses six of them.
    -   Of the sixth bed's thirteen slices, exactly one page needed the relaxed
        grammar, and it is `Zha_Ke#1`.

The probe that produced the first two numbers was validated against a positive
control before it was believed: an earlier version asked
`validateTranslatedSlice` for the grammar behind a pass, which cannot work,
because the floor refuses such a page before any verdict carries a grammar. It
reported zero, including for `Zha_Ke#1`, whose page is known to refuse the
strict grammar. Reading `readPageSkeleton` directly reports `Zha_Ke#1` and one
other nothing, which is the answer.

So `Zha_Ke#1` is not a one-off. Roughly one entry in eight carries an element a
slice boundary can cut, several of those pages run to hundreds of lines, and
after the floor fix a slice cut through one ships nothing at all. That makes
#154 a shipping blocker for that fraction of the corpus rather than a tidiness
issue, and it should be read alongside #71, which found a different defect on
the same `XingZ60` entry.

## The five declines are real, not voice loss

Measured from the archived run-6 state, no quota. This answers the question
#130 had to settle before any decline policy could be written on top of it,
because a policy calibrated on infrastructure failures would be calibrated on
noise.

EVERY ONE OF THE FIVE HAD A FULL PANEL. All five record `judgesAvailable: 6`
and `ballots: 6`: every judge answered, and none was lost to an empty reply or
a cut stream. The earlier declines in this bed that were caused by voice loss
were a different thing, and none of these is one. They are genuine indecision.

They are also near misses rather than chaos. The picks, by candidate index:

    -   `lintong#2` scattered across four candidates, best supported by two.
    -   `keyword233#0` across four, best supported by three, and every one of
        the six ballots was a self-vote.
    -   `Weideriche_#1` split three against three between only two candidates.
    -   `Acheron#1` across five, best supported by two.
    -   `Acheron#2` across four, best supported by two.

The seven slices that DID reach the gate look barely different: their best
candidate carried three or four votes against the declines' two or three, and
`gaoyanger#1` proceeded on the same three-against-three shape between two
candidates that made `Weideriche_#1` decline. What separates them is the
weighting rather than the raw count, and self-voting is doing much of that
work: `keyword233#0` weighed to nothing because all six judges preferred their
own candidate.

That last observation belongs to #91, which is about weighing self-certification
rather than forbidding it, and it now has a measured case behind it.

### What this settles, and what it does not

It settles that the decline rate is behaviour rather than infrastructure, so it
can be reasoned about.

The remaining half of #130 is a values choice rather than a measurement: what
SHOULD happen when a full panel cannot agree. The current behaviour keeps the
incumbent, and that is the reading consistent with everything else decided for
this corpus, where reader protection outranks completeness and a tie already
keeps the standing text. It is adopted on that basis rather than left open, and
it is the owner's to overrule.

### Measurement 4 in full: the three changed slices that lost nothing

Five run-6 slices shipped text differing from the standing rendering. Two were
read and recorded as damaged: `gaoyanger#1` drifted into the present tense, and
`Zha_Ke#1` shipped a short note where the archive carried a will. The other
three were flagged for reading and never got a recorded verdict, so measurement
4 stood as a bare "no, twice" without saying what the rest of the changed
slices did. All three are now read against the same question, which is whether
anything the standing text carried is lost. The passages stay in the run
artifacts under `~/temp/agent`; what follows describes the changes rather than
reproducing them.

`lintong#1` differs in exactly two places. The subject's name changes from a
two-word capitalised spelling to the lowercase single-word form the entry
declares, which is the ground every judge quoted in the run-6 name tripwire gave
for their pick. One sentence loses a trailing English connective that the
original marks nowhere. The attribution line survives intact and every other
line is identical. Nothing is lost.

`Zha_Ke#3` makes two changes and both are what the ballots argued for. A
connective the standing text had read as additive is read as contrastive
instead, and a verb phrase regains the object the original names, which the
standing text had left implicit. The outbound link survives unchanged. Nothing
is lost, and two readings improve.

`Acheron#0` is word for word identical to the standing text. It differs only in
that the semantic line breaks are gone, which is #151 rather than a loss of
content.

Measurement 4 therefore reads three clean against two damaged, rather than two
damaged against silence. Both damaged slices now have a fix and a guard behind
them, in #152 and #153, and confirming those hold in production is what run 7 is
for.

### What run 7 must show, written before run 7 is read

Recorded before the run finishes, for the same reason the `gaoyanger#1`
prediction was worth recording: an expectation written afterwards cannot be
wrong, and so cannot be evidence.

`gaoyanger#1` must not ship a present-tense rendering. The #152 sheets now name
the English as the authority for tense wherever the original leaves it unmarked.
A present-tense rendering shipping again means #152 failed in production, which
is an escalation rather than a cue to re-read the ballots.

`Zha_Ke#1` must ship nothing. Every candidate at that slice should be refused by
the floor, the incumbent retained, and the will preserved. Expect repair-round
churn there, because the finding the floor emits is a kind mismatch no candidate
can act on while #154 is open. That churn is #153 working rather than a hang or
a fresh defect. The one thing worth watching is whether the bed retries an
unfixable refusal past its bounded rounds, which would be a bound to fix in the
bed script rather than a pipeline defect.

The #155 change to DROPPED carries an overcorrection risk, because a criterion
counting anything the archive holds and a candidate omits structurally favours
the lane that starts from the archive. Run 6 settled 8 contests to translate, 4
to repair, and 1 to neither. Translate wins collapsing toward two or three would
mean the criterion overshot, and it would need the bounding pass #143 got.

Decline counts and `neither` counts may move in either direction, because the
sheets themselves changed. That is #130 data rather than noise, and it should be
read as a fresh measurement rather than compared for stability.

### #152 holds in production

Run 7 shipped a fresh consolidation at `gaoyanger#1`, the same slice run 6
damaged. Run 6's rendering opened in the present tense and then switched to the
past inside a single sentence, which is the exact pair of faults the #152 rule
names. Run 7's rendering holds the past throughout and no longer disagrees with
itself.

The expectation was recorded before the run was read, so it is evidence rather
than a reading fitted to a result.

### #154 is document-level data loss, and the pairing already knew

Two questions were open on #154: where the boundary came from, and whether the
assembly recovers what a slice drops. Both are answered from archived state, at
no quota cost.

The boundary came from a fallback, and the pairing had already refused the job.
The `Zha_Ke` artifact records `alignmentPairCount: 1` against `sliceCount: 4`,
with two findings, one per model asked:

```text
block-pairing unusable (hf:zai-org/GLM-4.7-Flash: pairing moves backwards on the translation side at position 3)
block-pairing unusable (hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4: pairing moves backwards on the translation side at position 3)
```

So the LLM-assisted pairing of #131 was asked, both answers were rejected as
non-monotone, and the run then fell back to assigning boundaries by character
fraction. The entry carries 303 source characters against 4388 target
characters, because the page holds a long `<details>` block the Chinese never
transcribes. Splitting a 14-to-1 asymmetry proportionally hands a 41-character
Chinese content warning a 3875-character English region.

That region is mid-element. It contains `<details>`, `<summary>` and
`</summary>`, and it stops before `</details>`. This is why the page fails the
strict grammar, and why #153 mattered: the floor used to read the refusal as
"no page" and skip the check entirely.

Assembly does not recover it. Splicing the run-6 slices back over the archive
text gives a page of 680 characters where the archive had 4388, losing 3708.
The tag counts show the shape of the damage:

```text
<details>   archive x1   assembled x0
</details>  archive x1   assembled x1
<summary>   archive x1   assembled x0
```

The opening tag and the whole body are gone and the closing tag survives with
nothing to close. So the assembled document both deletes the will and emits
unbalanced markup. This settles #154 as urgent before release rather than
urgent eventually.

It also names three separate fixes rather than one.

The first is the fallback itself, which is #71's unfinished half: a pairing the
roster declared unusable must not be replaced by a confident wrong answer. The
signal is recorded in the artifact and nothing reads it, which is now the third
time that pattern has been found.

The second is that a slice boundary must never fall inside an element,
whoever chose it. That is a structural invariant the assembler can enforce
regardless of pairing quality.

The third is #90 and #100: a page region with no counterpart in the original,
such as this `<details>` block, is one-sided content. It should be recognised
and held out of pairing, not handed proportionally to whichever source chunk
happens to sit nearby.

### The census: mid-element boundaries are not a fallback problem

Sizing #154's structural invariant meant asking how often a real slice boundary
lands inside an element. Every settled artifact carrying slice regions was
scanned, which is 18 unique entries and 124 slices, by walking each region's
tags and asking whether every opener it holds is closed inside it and every
closer it holds was opened inside it.

Three slices of 124 cut an element, across two entries of 18. That eighth-of-
the-corpus figure matches the earlier page-level count, where 12 of 92 English
pages use `<details>` and 18 of 92 carry block HTML.

The important result is the second entry. `AkiraComplex` splits a `<BlurBlock>`
across its two slices, with the opener in one and the closer in the other, and
its `alignmentFindings` is empty. No pairing was declared unusable, no fallback
ran, and the asymmetry is a mild 451 source characters against 714 target
characters. The accepted pairing placed that boundary itself.

So the fallback is not the cause of mid-element boundaries, only the cause of
the `Zha_Ke` one. Fixing the fallback would have left `AkiraComplex` exactly as
it is. The structural invariant is required on its own account rather than as
a second line behind the pairing fix, and it is the only one of the three fixes
that catches both cases.

Damage did not land on `AkiraComplex`, but not because anything prevented it.
Both lanes reproduced the tag they were handed, so the element survived. Nothing
required them to. Each slice on its own carries unbalanced markup, so the page
grammar refuses it exactly as it refuses the `Zha_Ke` region, and a candidate
that simply translates the prose it was given drops the tag without being wrong
about anything it was asked.

That failure mode is worse than markup corruption here. `BlurBlock` is the
content-blurring component from #49, so an opener dropped while its closer
survives renders as sensitive content with the blur removed. It is latent rather
than realised, and it is a reader-protection failure rather than a rendering
one.

One limit on the census: it reads regions that were assigned to a slice, so a
page region no slice covers cannot appear in it. It therefore undercounts
exposure rather than overcounting it.

### The real cause: container tags are in no block at all

The census said the invariant should have caught this, because
`assertSpanContiguity` already refuses a slice that cuts through a block and it
runs at preparation, at `document-preparation.ts:293`. Running the real
preparation over the real `Zha_Ke` pair explains why it did not.

`parseDocument` returns six nodes for that page, and none of them is the
`<details>` element. The nodes run to the element's contents directly, as a
paragraph for the summary and a blockquote for the will, and the tags
themselves land in the gaps between nodes:

```text
  block/1   [  159,  370) paragraph
  GAP       [  370,  382) NOT IN ANY NODE: "\n\n<details>\n"
  block/2   [  382,  408) paragraph
  block/3   [  409, 4034) blockquote
  GAP       [ 4034, 4047) NOT IN ANY NODE: "\n</details>\n\n"
  block/4   [ 4047, 4103) mdxJsxFlowElement
```

`AkiraComplex` is the same shape, with `<BlurBlock>` at `[264, 278)` and
`</BlurBlock>` at `[669, 684)`, both in no node.

So the slice at chunk 1 covers `[159, 4034)` and carries exactly three whole
nodes. No block is cut, every block inside the range is one the slice holds, and
the invariant is satisfied on its own terms. The opening tag sits in a gap
inside the range and the closing tag sits in a gap outside it. Assembly replaces
the range, which deletes the opener, and copies the untouched remainder, which
preserves the closer.

That is the whole mechanism behind the assembled page carrying `<details>` zero
times and `</details>` once.

The defect is therefore not that the slicer cuts elements. It is that the
document node model has no representation for a container's tags, so a class of
page content exists only as text between nodes. Every invariant reasons over
nodes, so none of them can see it, and any slice whose range happens to span
such a gap deletes what is in it. `assertSliceCoverage` is blind for the same
reason, since it asks whether every block reached a slice.

This also explains why `AkiraComplex` needed no fallback to reach the same
state. Nothing about a bad pairing is required. An ordinary boundary between two
ordinary blocks does it, whenever a container happens to open between them.

### The guard, and what it finds across the whole corpus

The parse now reports what it dissolves. `flattenContainers` returns the
container spans beside the blocks, `parseDocument` shifts them to absolute
offsets and carries them on `RepairDocument`, and a new
`assertContainerIntegrity` runs at preparation beside the checks that already
guard blocks.

The rule is both tags or neither, rather than no tag inside a range. An element
wholly inside one slice puts both of its tags in that range, which is the
ordinary healthy case: the slice text carries them and a candidate that drops
them is caught downstream where the page grammar refuses it. A rule against any
tag in a range would refuse those pages too, and they are the majority of the
pages that use containers at all.

Running preparation over all 92 pairs, with no pairings supplied:

```text
pairs read: 92
pages carrying a container: 16  (containers in total: 24)
ContainerIntegrityError fired on 11
other preparation failures: 0
```

So 11 entries of 92 currently produce a page that loses an element and emits
markup closing nothing. Five of the 16 container-carrying pages are clean, which
is the measurement that says the predicate discriminates rather than simply
refusing everything it sees.

The elements involved are `<details>` on seven entries, and one each of
`<BlurBlock>`, `<div>`, `<Hexagon>` and `<p>`. `XingZ60` carries nine containers
by itself. Two entries, `hulicaijia` and `lin10104`, fire the mirror case, where
a range holds the closing tag without the opening one.

Zero other preparation failures means the change refuses nothing it did not aim
at.

Two honest limits. The dry run supplies no block pairings, so production
subdivides differently and the slice indices above will not match it; what
carries over is the exposure and the fact that the invariant runs in production
too. And the guard converts silent loss into a loud refusal rather than into a
shipped page, so those 11 entries now stop at preparation. That is the right
trade against deleting a will, and it is why the slicer still owes a treatment:
binding a container's blocks into one slice where its interior is paired
content, and holding the region out where it is not.

### The guard fails when removed, per GFP

The invariant was neutered with an early return, rebuilt, and the suite run.
Exactly the three refusal cases failed and the four acceptance cases still
passed, which is the expected shape: an acceptance case passes vacuously against
a check that does nothing, so only the refusals carry the proof. The invariant
was then restored from the commit and the suite is green again at `exit=0` with
no failing lines.

### Run 7 at seven of thirteen slices

Reading the run against the expectations recorded before it, on the seven
slices settled so far.

The #155 tripwire is not tripped. On these same seven slices run 6 settled four
contests to translate and three to repair, and run 7 settles three and four.
One slice moved, `keyword233#1` from translate to repair. That is a single
change rather than the collapse toward two or three that would have meant the
DROPPED criterion overshot.

Decisions moved more than contests did. Two slices, `keyword233#0` and
`Weideriche_#1`, went from `declined-indecision` to a settled judgement and now
ship, and `Weideriche_#0` did the same earlier. So the changed sheets are
resolving panels that previously could not agree. That is #130 evidence and it
points the same way the decline classification did: the declines were behaviour
rather than infrastructure, and changing what the judges were told changed the
behaviour.

`gaoyanger#1` and `Zha_Ke#1`, the two slices the run exists to check, are one
settled and one still pending.

### A runaway shape the guard was not built for

The run log carries three `StreamCutShortError` events, two of them at 1089815
and 2014974 characters, both from the same model, both ended by the 180-second
deadline rather than by any guard.

That matters because the client-side runaway guard from #119 and #120 is a
degeneracy detector: it looks for repetition and raises
`StreamDegenerateError`. Neither of these is that error, so the guard never
fired. The premise that a runaway repeats itself does not cover a model emitting
two million characters the scanner does not read as degenerate, and nothing else
caps output size.

Filed as #156 rather than folded into #154, with the cap left to be derived from
the observed distribution of completed responses rather than guessed.

## Container tags: the defect has one origin and two consumers

Recorded 2026-08-21, before the fix is written, so the expectations below count as evidence.

### The guard's census, and what it hides

`assertContainerIntegrity` refuses 11 of the 92 readable pairs.
Naming them, because the next measurement has to reproduce this exact set:
`AkiraComplex`, `SevenBird`, `XingZ60`, `Zha_Ke`, `cheonwoomaeng`, `gqt`, `hulicaijia`, `lin10104`,
`mikaela_khara`, `shihai4h`, `zhangyubaka`.
Sixteen entries carry a container at all, so five carry one and are not refused.

The refusals do not share a cause, and reading them as one cause is what sent the first fix at the wrong file.
Eight of the 11 hold a container wholly inside one paired chunk,
and the cut happens when subdivision splits that container's blocks across two slices.
Three do not: `SevenBird`, `mikaela_khara` and `XingZ60` hold a container whose closing tag
falls outside the chunk that holds its own children.
On `mikaela_khara` the chunk ends at 8581, the closer occupies 8581 to 8593,
and the next chunk begins at 8595, so the tag sits in a 14 character gap between two chunks.
On `SevenBird` the closer begins exactly at its chunk's end offset.

That is the same defect one level up.
Chunk boundaries are minted at `src/chunk-document.ts:190` from `first.startOffset` and `last.endOffset`.
Slice boundaries are minted in `runToChunk` at `src/slice-pair.ts:76` from the same two fields.
Both read node extents, container tags belong to no node, so both draw boundaries that cut tags off.
A fix at subdivision alone would leave `SevenBird` and `mikaela_khara` refused,
because their damage is done before subdivision runs.

### Widening at the origin rather than binding at the consumers

The first design was atomicity at subdivision: treat a container as indivisible, carve over atoms, widen at the edges.
It is rejected, and the measurement is what rejects it.
It repairs one of the two consumers, and it leaves any range derivation added later exposed to the same defect.

The fix instead widens the extents where the package first writes them:
a block that carries a container's opening tag owns that tag,
and a block that carries the closing tag owns that one.
Every consumer that reads `startOffset` and `endOffset` inherits the correction without knowing containers exist.

Two facts make this safe, and both are measured rather than assumed.
Across both sides of the whole corpus there are 53 containers and not one of them
has a tag region overlapping any block node, so widening cannot collide with a neighbour.
Nesting exists on `XingZ60` alone, four pairs across its two sides,
and it composes: a block takes the minimum opener start among containers it opens
and the maximum closer end among containers it closes.

Widening also dissolves the atomicity requirement rather than implementing it.
When a container's blocks split across two slices, the first slice carries the opening tag inside its own text
and the last slice carries the closing tag inside its own text.
Each tag is wholly held by some slice, neither is half held, and the invariant is satisfied by construction.
The `AkiraComplex` shape stops being a merge problem.

### What is expected after the change, committed in advance

The census must report 0 `ContainerIntegrityError` across all 92 pairs, with no qualification.
`XingZ60` carries a ninth container in a target-only section that no paired chunk reaches;
it needs no treatment, because no slice reaches it, neither tag is ever held,
and `spliceSlices` copies the region verbatim.
So the expected number is 0, not "0 except one".

Every entry without a container must produce byte-identical slices.
Seventy-six of the 92 have none, and any difference there means the widening reached text it had no business reaching.

On the 16 entries that do carry one, every tag region must fall inside some slice's range.

Cache misses on those 16 are expected, and they are invalidation rather than breakage:
the slice text changed, so the key changed.

### What the guard is for afterwards

Its job changes, and saying so now prevents a later session reading it as dead weight.
Before the widening it stood between a container and a document that loses a will.
After the widening, preparation cannot produce a half held tag at all,
so the guard stands against a future regression in range derivation rather than against damage in flight.

The residual exposure moves rather than disappearing.
A lane can still drop a closing tag from its own candidate,
and that is now a candidate fault rather than a preparation fault.
The machinery for it already exists: the floor reads a page the strict grammar refuses,
and a deleted region is a named fault bounded to a silent original.
Expected steady state, committed in advance: a container defect that used to stop preparation
now appears as a contest-visible fault on one candidate, and a different candidate ships.
No new machinery is to be built for it in this task.

### What the widening measured, including where the pre-commit was wrong

Landed 2026-08-21 as `fdfeb1108`, with tests in `d081efb91`.

The census reports 92 of 92 pairs preparing clean, 0 `ContainerIntegrityError` and 0 other failures.
That is the pre-committed number exactly, `XingZ60`'s target-only ninth container included.

One pre-committed expectation was stated wrong and is corrected here rather than quietly restated.
It said 76 entries carry no container and all 76 must produce byte-identical slices.
That count came from parsing the English side only.
Measuring both sides, 75 entries carry no container anywhere and 17 carry one on some side.
All 75 are byte-identical.
The entry that exposed the miscount is `interrgned`, which carries a `<blockquote>` container
on its Chinese side and none on its English side, so widening correctly changed its source-side slices
while its English side has no container at all.
There is no unexplained drift.

The guard fails when the widening is removed, which is what makes it evidence rather than decoration.
Neutering `widenNodesToContainers` to return its input and rebuilding takes the refusals from 0 to 16,
naming every entry whose English side carries a container and leaving the other 76 untouched.
Restoring it returns the census to 0.

### The old rule was measured wrong, not reasoned wrong

Worth recording because the sequence is the useful part.
The widening landed first while the guard still enforced its original rule,
that one slice range must hold both of a container's tags or neither.
The census then reported 12 refusals rather than 0:
`SevenBird` and `Zha_Ke` were fixed, and `Chinatsu_Suzuki`, `Huasheng` and `LCG_Akiball` were newly refused.

That is the fix working and the guard disagreeing with it.
Once tags ride inside blocks, a container whose blocks fall in different slices is the healthy case:
the first slice carries the opening tag in its own text, the last carries the closing tag in its own,
each lane sees the tag it must reproduce, and the page stays balanced.
The old rule called that a defect because it was written for a world where tags floated between blocks.

So the rule became two narrower ones.
Every tag of a container that holds blocks must lie wholly inside one of them,
and no slice range may end part way through a tag.
Both fire only on a regression in how extents or ranges are derived, which is what the guard is now for.
A lane dropping a tag from its own candidate is a candidate fault,
carried by the floor that reads a page the strict grammar refuses and by the named deleted-region fault.

### Verification state

Suite exits 0 with zero failing cases.
Lint reports 0 errors and 1 warning, the inherited `no-unsafe-type-assertion` on `unwrap-container.ts`,
already shown to be load-bearing: removing the assertion loses the borrowed-foreign marking
and `prefer-readonly-parameter-types` errors in its place.

Two documents that told the old story were corrected rather than left standing.
The `unwrap-container.ts` header said the tags "fall outside every promoted span" and that this was safe;
it now says where they go instead and that a caller reading blocks while dropping containers
reintroduces the defect in full.
Its test case asserting that no promoted block contains a container tag was asserting the defect itself,
so it is reversed rather than deleted.

### Run 7, the pre-committed slice

`Zha_Ke#1` was pre-committed to ship nothing, with the will preserved.
It shipped nothing and the incumbent was retained, so the outcome held.
The mechanism did not: the pre-commit predicted every candidate refused by the floor,
and what happened was `declined-indecision` at the judge, with the incumbent kept for want of agreement.
Recording the difference because a right outcome reached by an unpredicted route
is weaker evidence than one reached by the predicted mechanism, and the distinction should not be lost.

### The instrument that proved it, and the one that could not

The first attempt at an end-to-end check assembled each container entry with identity replacements,
every slice handing back exactly the text it was cut from, and compared the result to the archive.
All 16 came back byte-identical with no tag lost.
That result is worthless, and the positive control is what showed it:
neutering both the widening and the guard and running the same probe returns the same clean answer.
Identity replacement writes back the slice text it was given, and a tag inside a slice range
is inside that slice's text, so the probe round-trips whatever it is handed.
It cannot distinguish a fixed pipeline from a broken one.

The discriminating question is narrower, and it is the asymmetry the widening actually removes.
A tag inside some slice's range is text a lane rewrites.
A tag inside no slice's range is text assembly copies through untouched.
When a container has one of each, the two tags are decided by different authorities:
one can be dropped by a candidate while the other is guaranteed to survive,
which is precisely how a page ends up with markup closing nothing.

Measured across the target sides that carry containers, 24 containers reached in both builds:

    before  6 containers with both tags in a slice range, 7 with neither, and 11 SPLIT
    after   23 with both tags in a slice range, 1 with neither, and 0 SPLIT

The 11 name themselves: `SevenBird`, `XingZ60` three times, `Zha_Ke`, `cheonwoomaeng`, `gqt`,
`hulicaijia`, `lin10104`, `mikaela_khara`, `zhangyubaka`.
The single remaining "neither" is `XingZ60`'s target-only section, which no slice reaches by design.

WHAT THIS DOES NOT CLAIM. It does not claim a lane can no longer drop a tag.
It claims that both tags of a container are now decided by the same authority,
so dropping one is a candidate fault visible to the contest
rather than a structural certainty invisible to every invariant.
The residual exposure is named in the section on what the guard is for, and it is unchanged by this.

### Three things the widening changes that are not defects

Recorded so a later session does not read any of them as a regression.

Run 7's slices were cut BEFORE the widening, from the cached bed state.
Scoring run 7 against run 6 stays valid, because both read the same slices,
but per-slice comparison on the container entries ends at run 7:
any freshly prepared run re-slices them.
Run 7 must not be credited with the container fix, which landed after its slices were cut.

Seventeen entries will re-buy, not sixteen.
The source side widens too, so `interrgned` re-buys on its Chinese-side `<blockquote>`,
and the five container entries that previously settled clean
(`Huasheng`, `Chinatsu_Suzuki`, `LCG_Akiball`, `NIGHT81473140`, `hakureico`)
re-buy against new content hashes.
Cache misses on those 17 are invalidation, because the slice text genuinely changed.

The residual expectation is recorded and NOT yet observed.
A lane dropping a container tag should now surface as a contest-visible candidate fault,
carried by the floor and the deleted-region rule.
Nothing has exercised that path since the widening landed,
so it stays an expectation until the first post-widening run touches a container entry.

## Run 7 scored, and the deletion it did NOT repeat

### What the headline did, and why it cannot yet be credited to anything

Counting the same way for both runs over the same 13 slices:

- Run 6: the gate ran at 7 slices, shipped consolidated at all 7, and 5 slices ended `declined-indecision`.
- Run 7: the gate ran at 10 slices, shipped consolidated at all 10, and 2 slices ended `declined-indecision`.

The fixes that landed between the two runs were aimed squarely at judges who could not agree,
so the direction is the one they were built to produce.
That is not evidence they produced it.
Twelve of the 13 slices moved between the runs,
including slices where nothing changed but the wording,
because the models are redrawn on every run and the bed buys every call fresh.
A shift from 7 to 10 out of 13 is well inside the spread two draws of that size can produce on their own,
and nothing here has measured that spread.
Run 8 does NOT bound it either, and saying so here corrects a line this document briefly carried.
A run-to-run band has to be measured on ONE UNCHANGED BUILD.
Run 8 carries ONE change run 7 did not:
the `#158` scanner fix, which is not telemetry-only.
Arming the degeneration detector on 47 percent of traffic that was previously invisible to it
can change outcomes on its own,
because a call whose thinking repeats past 131072 characters is now cut where run 7 let it complete.
So run 8 against run 7 still carries a confound, though a narrower one than run 7 against run 6.

The bed's slices are NOT the second change, and a line this document carried saying otherwise was wrong.
The bed does not slice anything.
It replays static artifacts under `~/temp/agent/readable-20260820` and `~/temp/agent/pairfix-20260820`,
every one of them written on 2026-08-20 between 17:34 and 19:29.
The `#154` widening landed at 2026-08-21 14:50:40, about twenty hours later.
Run 8 therefore replays PRE-WIDENING slices, exactly as run 7 did.

That static input is what makes run 9 against run 8 a clean pair:
identical build, identical slices, nothing touched between them.
Until that exists the honest reading is that the gate reached more slices in run 7 and the reason is unmeasured.

### `Zha_Ke#1`: run 6 shipped a 96 percent deletion, and run 7 did not

THE RUN ATTRIBUTION HERE WAS WRONG IN AN EARLIER VERSION OF THIS DOCUMENT,
which read as though run 7 shipped the deletion.
It did not.
Read straight off the two state files:

```text
run 6   Zha_Ke#1   decision=judged                origin=fresh       incumbent=3875   shipped= 164
run 7   Zha_Ke#1   decision=declined-indecision   origin=incumbent   incumbent=3875   shipped=3875
```

Run 6 deleted the letter. Run 7 kept every character of it.

WHAT CHANGED BETWEEN THEM IS THE DECISION, NOT THE JUDGEMENT.
Run 7's panel still reasoned the deleting way:
its recorded selection ballot calls the letter-preserving candidates
"unacceptable because they add the entire letter text, names, and metadata not present in the ORIGINAL".
The panel did not converge, the gate returned `declined-indecision`,
and the fallback to the standing text is what saved the letter.
So the letter survived run 7 by the safety net, not by the panel changing its mind.

RUN 7 IS ALSO THE FIRST RUN CARRYING `#155`.
The policy clause making deletion of page-only content a named fault landed at 13:45:20,
and run 7's state file was created at 13:46:48, eighty-eight seconds later.
Run 6 finished at 13:21, before it existed.
That makes run 6 against run 7 the only before-and-after pair for that clause,
and one slice is not enough to attribute the change to it:
`declined-indecision` is exactly what a panel split by a new fault clause looks like,
and also exactly what an ordinary tie looks like.

TWO OTHER ROWS NEED SEPARATING FROM THE DELETION COUNT.
Run 6's `Zha_Ke#0` and run 7's `Acheron#0` both carry `shipped=0` with `decision` undefined.
Those are slices that failed rather than slices that deleted,
and counting them as deletions would overstate the rate in both runs.

Run 7 does carry one large reduction that is not a failure:
`Acheron#1` shipped 172 characters against 328 standing, judged and fresh, a 48 percent cut.
Nothing has read that slice.

What follows describes RUN 6's deletion, which remains the clearest evidence in the bed.

Run 6 replaced 3875 characters of standing text with 164 characters, and the gate ballots were 6 for consolidated, 0 against.
Every other slice in both runs shipped between 90 and 111 percent of what stood.
This one shipped 4 percent.

The cause is not the judges.
Their own recorded reason is that the standing candidate
"includes the entire letter body and a metadata sentence not present in the original passage",
which is true, and which they were right to notice.
They were shown 41 characters of source against 3875 characters of standing English and asked which was faithful.
Given that pairing the short answer IS the faithful one.

The pairing is the defect.
Every other slice in the bed has a source-to-standing ratio between 2.1 and 4.0, which is what a Chinese to English pair looks like.
`Zha_Ke#1` sits at 94.5.

`Zha_Ke`'s English page carries ONE container spanning offsets 372 to 4045, a span of 3673 characters,
and its Chinese source carries none at all.
The letter is content the English page has and the Chinese does not,
and the slicing paired it against a note of 41 characters.

### The structural check filtered in the wrong direction

Three of the six candidates at that slice reproduced the letter at about 3800 characters, and all three were marked `invalid`,
every one of them for the same reason:
`MdxParseError: MDX body refused to parse`.
The three candidates marked `valid` were 136, 161 and 164 characters, all of them deletions.

So at this slice the structural check refused exactly the candidates that preserved the content
and admitted only the candidates that dropped it.
The floor did not fail to protect the letter.
It selected against it.

That parse failure has a named cause, and it is `#154`:
these slices were cut before the container widening,
so the container's tags belonged to no node and the slice text carried a letter body without its opening and closing tags.
A candidate faithfully reproducing that text reproduces the imbalance, and unbalanced MDX does not parse.
A candidate that rewrites it into a short clean note parses fine.

### What run 8 does NOT test

An earlier version of this section said run 8 was the first run whose slices are cut after the widening,
so it would be the live test of the residual expectation recorded here as unobserved.
That was wrong, and the timestamps settle it:
the bed replays artifacts written 2026-08-20, and the widening landed 2026-08-21 14:50:40.
Run 8 never exercises the widening.

The consequence for scoring matters more than the correction.
At `Zha_Ke#1`, a still-failing faithful candidate is NOT evidence the widening failed,
and a passing one is NOT evidence it worked.
The path was not walked.
Testing the widening needs slices cut from the current build, which the bed as written never does.

`Zha_Ke#1` should also come OUT of run 8's accuracy count for the band comparison.
Its `expect: 'repair'` label was set by a reading that did not know
93 percent of the slice's standing text was material the pairing had already declined to pair.
A malformed slice scoring as a clean accuracy point in a thirteen-item bed
moves the number this document is trying to bound.
Score it, record it, and exclude it from the comparison with a note.

The widening does not fix the pairing, and neither does anything else here.
Forty-one characters of source against a 2909-character letter the roster explicitly refused to pair
is a slice no judge should be shown at all, whatever parses.
That is `#157`, and this is the strongest evidence for it in the corpus so far:
not a pairing that produced a confidently wrong answer,
but a CORRECT pairing whose refusal the slicer discarded,
coming within a single unanimous ballot of deleting a letter someone wrote about a person who died.

## Run 8 scored, stratified, and what its headline rate hides

Run 8 finished on 2026-08-21 with all thirteen slices recorded.
Scored flat against the eight-entry reading it agrees on six of twelve,
excluding `Zha_Ke#1` for the reason `#154` and `#157` both give:
that row replays a slice built before either landed.

THE FLAT RATE ANSWERS THREE DIFFERENT QUESTIONS AT ONCE, so it is not the number to read.
The bed's own note records that `neither` in the reading means the two lanes TIED,
"not that both were bad".
A contest that picks a lane there has broken a tie, not contradicted the reading.
And a slice with no standing text has nothing to contest at all,
so its `neither` is structural rather than a judgement.

Split three ways:

- The reading named a lane and standing text existed, seven slices: the contest agrees on six.
    The one miss is `Acheron#2`, where the reading says translate and the contest chose repair.
- The reading called the lanes tied, three slices: the contest broke toward repair on all three.
- No standing text, two slices: `Zha_Ke#0` and `Acheron#0`, both necessarily `neither`.

THE TIE-BREAK LEAN IS WORTH WATCHING AND IS NOT YET A FINDING.
Three of three toward repair is what a systematic lean would look like
and also what three coin flips look like one time in four.
Run 9 is the second draw, on the identical build and the identical replayed slices,
and it is the thing that can tell those apart.

WHAT THE GATE SHIPPED: consolidated at eight slices, standing at three, no gate at two.
Judge participation was healthy throughout:
six judges available at every slice that had one,
five or six ballots, and zero abstentions anywhere.
So nothing in this run was decided by a panel that had lost voices,
which is the confound `#156` would introduce if the runaway guard were letting streams through.
