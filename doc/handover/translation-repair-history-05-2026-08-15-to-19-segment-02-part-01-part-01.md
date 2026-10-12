# Translation repair history: 2026-08-15 to 2026-08-19, segment 2, part 01

Part 01 of [Translation repair history: 2026-08-15 to 2026-08-19, segment 2](translation-repair-history-05-2026-08-15-to-19-segment-02-part-01.md),
whose index lists every part in order.

## Current stop condition

Historical evidence only.
Candidate M failed on 2026-09-01.
No historical next-action list authorizes a corpus run,
model call,
spent-prompt retry,
or successor implementation.

## Continued record

### Preserved chronological continuation

MEASURED BEFORE CHANGING ANYTHING,
across every stored run artifact:
844
`quote-not-found` failures,
of which 45 carry that suffix.
So for critic claims
this is a small correction,
consistent with what `#72` estimated,
and for the
coverage question,
whose quotes are whole sentences rather than fragments,
it
was almost the whole failure mode.

THE FIX IS A THIRD PASS,
collapsing soft line breaks on both sides.
Both
fallbacks are length-preserving,
so offsets still index the stored document and
anchors still carry its canonical bytes.
A blank line still separates:
a
paragraph break carries two line endings where a space-joined quote carries one
space,
so nothing can be joined across a boundary the document keeps.
The
diagnostic is deleted,
because nothing can emit it now,
and the two tests that
pinned the refusal now pin the location and the ambiguity.
Shown to fail with
the pass disabled,
then restored;
the whole package suite is green.

### The eleven sections rerun under all three changes, and what the rerun can and cannot attribute

The section set was measured once before the v2 sheet,
the roster threshold and
the line-wrap pass landed,
and once after.
Nine of the eleven verdicts are
identical.
Two moved,
and only one of the two can be attributed.

    XIEPT2 sections 0 to 6   absent, both runs
    XIEPT2 section 7         absent  ->  split
    XingZ60 section 12       carried ->  partly-carried
    XingZ60 sections 13, 14  absent, both runs

WHAT `#106` RESTS ON IS UNCHANGED,
and it is worth saying plainly because the
rerun was run to try to break it:
NO CANDIDATE IN EITHER RUN REPORTS FULL
COVERAGE.
Nine of eleven are absent by a majority of the entire roster with all
six models heard,
and the two that moved both moved AWAY from coverage,
not
toward it.
The sections I had labelled as plainly translated are still reported
as carrying nothing.

SECTION 12 IS ATTRIBUTABLE,
AND IT IS NOT THE MODELS CHANGING THEIR MINDS.
The
v2 tallies are 0 full and 5 partial.
The verdict shape before this landing
counted any claim of coverage as one anchored vote,
so those same five votes
printed as `carried (anchored 5)`.
The move is the partial-from-full separation
arriving,
which is exactly what a review said it would do to this candidate,
and
`partly-carried` forbids inserting the passage whole just as `carried` did.

SECTION 7 IS NOT ATTRIBUTABLE,
and claiming otherwise would be the failure this
document exists to prevent.
The VOTES moved,
5 absent and 1 anchored in the
first run against 3 absent and 2 partial in the second,
and votes of that shape
read as `split` under either threshold rule.
So the cause is either the rewritten
sheet or ordinary run-to-run variance between two samples of six stochastic
models,
and ONE RUN CANNOT SEPARATE THEM:
the run-to-run band for this stage has
never been measured,
so a single move smaller than an unmeasured band is not
evidence of anything.

THE LINE-WRAP FIX DID NOT SHOW UP HERE,
AND WAS NOT EXPECTED TO.
Unanchored
quotes across the section set went from 4 to 6,
the wrong direction for a fix
that makes anchoring strictly easier.
That is not a contradiction:
the two runs
quote different sentences from different replies,
so the comparison is
uncontrolled,
and the wrap diagnosis was made on the BLOCK set,
where 10 of 11
unanchored quotes were soft wraps.
The controlled test is a rerun of
`mikaela_khara`,
whose three v1 splits carried 3,
3 and 4 unanchored quotes with
ZERO absent votes,
which is the wrap signature exactly.

### The locator fix invalidated the repair cache, and nothing would have reported it

Found by a reviewer reading the landing rather than by anything in the code.
`locateQuote` gained the collapsing pass,
and `critic-wire.ts` DROPS a claim it
cannot anchor.
So a critic quote copied out of a wrapped paragraph now survives
where it used to be discarded,
the surviving issue set for a slice changes,
and
with it the patch and the settled text.

WHAT MAKES IT INVISIBLE is that the cache key holds the slice texts,
the
governance flag and the run shape,
and the fix changes NONE of them.
The same
key answers differently before and after,
so a resumed corpus pass would mix
records from both generations and report nothing.

IT IS NOT THE CASE THAT LET VERSION 25 STAND.
That record could only overclaim a
change,
and `sliceRecordAgrees` catches an overclaim on resume at the cost of one
recomputed slice.
This one can differ either way and leaves no contradiction
behind:
a slice settled before the fix with a dropped wrapped quote reads exactly
like a slice where the critic found nothing.
`SLICE_CACHE_VERSION` is 27,
and the
pinned key hash moved with it.
`TRANSLATE_SLICE_CACHE_VERSION` deliberately did
not:
anchoring reaches the repair lane through `repair-stages.ts` alone,
and the
translate lane never asks a critic to quote anything.

### Both verdict guards shown to fail, which they had not been

The roster threshold and the quorum gate arrived together with a signature
change,
so the old behaviour was unreachable and neither guard had ever been
watched to fail.
One probe covers both:
compute the majority over `voices.length`
and drop the `quorumMet` gate.
Four tests fail,
three on the threshold and one on
the gate,
`'absent'` where `'inconclusive'` is required.
Restored,
rebuilt,
green.

WORTH RECORDING ABOUT THE GATE'S REACH,
since it is not obvious from reading it:
quorum needs `ceil(n / 2)` and a majority needs `floor(n / 2) + 1`,
so reaching a
majority ALWAYS implies quorum.
The gate can therefore only ever convert a
`split` into `inconclusive`,
which is the case the failing test pins,
and it can
never overturn a decided side.

### The block set rerun, which is where the wrap fix was diagnosed and where it shows

The section rerun could not speak to the line-wrap fix,
so `mikaela_khara` was
run again:
the same sixteen candidates that produced the three splits,
under the
same roster.

ALL THREE SPLITS ARE NOW CARRIED.

    pair 1 block 3   split (3 anchored, 3 unanchored)  ->  carried (4 full, 2 partial, 0 unanchored)
    pair 1 block 4   split (3 anchored, 3 unanchored)  ->  carried (5 full, 0 partial, 1 unanchored)
    pair 2 block 16  split (2 anchored, 4 unanchored)  ->  carried (5 full, 0 partial, 1 unanchored)

Unanchored quotes across the sixteen fell from 12 to 5.
That number alone does
not attribute,
because the sheet also changed and its copy-exactly rule pushes
the same direction,
and the replies are fresh samples either way.

WHAT DOES ATTRIBUTE IS INTERNAL TO THE NEW RUN,
and it is the check worth
keeping:
of the five quotes still unanchored,
ZERO are wrap-collapsible,
against
10 of 11 before the fix.
Four are English the model composed rather than copied,
which is precisely what the anchoring check exists to refuse,
and one is the
single word `September`,
which occurs twice in that document and is refused as
`ambiguous-quote (target)`.
Verified by locating it directly rather than assumed
from the classification.
So the wrap class is not merely smaller,
it is empty,
and the remaining refusals are the two failure modes that SHOULD refuse.

ONE VERDICT MOVED THE OTHER WAY,
`pair 1 block 5` from carried to
`partly-carried` at 3 full and 3 partial,
which is the same partial-from-full
separation that moved XingZ60's section 12 and not a change of votes.

WHAT THIS DOES TO ITEM 28's BLOCK-SCALE FINDING is strengthen it.
Across both
runs of this entry,
ninety-six voice answers,
NOT ONE VOTE FOR ABSENCE was cast.
Sixteen passages the block aligner refuses to pair,
and the roster says every one
of them is already carried by the translation.
Landing four would have inserted
sixteen renderings of text that is already there.

THE SINGLE-WORD QUOTE IS ALSO EVIDENCE FOR A REVIEW FINDING nobody has acted on:
the wire guard accepts any non-empty quote,
so `September` was admissible
evidence and only the locator's ambiguity check stopped it.
`#106` records the
identifying-evidence constraint as open.

### A second reviewer on the anchoring change: two real holes, two refusals, one still open

The locator change was sent for review with the four files it touches.
Six
findings came back.
What matters is that they split three ways,
and the split
was decided by reading this repository rather than by the reviewer's confidence.

TWO WERE REAL AND ARE FIXED.

The first is the one worth remembering:
ANCHORING WAS A CHAIN OF PASSES,
strict
to loose,
and each pass checked ambiguity only within its own class before
returning on its first hit.
A document holding `bad\nword` early and `bad word`
late answered the quote `bad word` with the LATE one,
unique among byte-exact
matches,
while the earlier occurrence was just as valid under the wrapping rule
the next pass would have applied.
A model normalizes whitespace and punctuation
when it copies,
so neither says which occurrence it read.
The fix judges
uniqueness over the broadest accepted form,
which REMOVES two passes rather than
adding a fourth.

MEASURED BEFORE CHANGING IT,
because a stricter rule that refuses real evidence
is a regression:
over three corpus passes,
16,479 anchored quotes checked against
the slice each was anchored in,
NOT ONE is refused by the stricter rule.
The
first version of that probe counted against whole pages and reported 566,
which
is the wrong scope,
since `repair-chunk.ts` parses the chunk pair and claims
anchor against that.
The page figure survives as the positive control:
same
counter,
same needles,
and it can see ambiguity when the scope allows it,
so the
zero is a measurement rather than a broken probe.

The second is the coverage `evidence` field,
which promised text a reader could
check against the translation and stored what the model sent.
Those read the same
until a fallback does the matching,
which is exactly when the submitted text does
not occur.
It now reads the located region back out of the document.
`unanchoredQuotes` still keeps what was sent,
since there the submitted text IS
the finding.

TWO WERE REFUTED BY THE SOURCE,
and both are worth recording because they look
right until you open the file.

CRLF was said to break offsets,
since mapping a two-unit line ending onto one
space shortens the text.
`quote-normalize.ts` maps `\r` and `\n` INDIVIDUALLY,
so
CRLF becomes two spaces and length is preserved.
A CRLF document then fails to
match a one-space quote,
which is a refusal rather than a wrong anchor.

A zero-width span carrying an empty quote was said to bypass the anchorless
guard,
since equal offsets are not inverted and the document slices to empty
there.
That shape is the INSERTION ANCHOR:
it is how an omission claim names
where missing content belongs,
and `validateIssueClaim` admits it deliberately.
A
guard against it was written,
and it broke the omission fixtures,
which is how
the design announced itself.
Reverted.

ONE IS REAL,
PARTLY FIXED,
AND THE REST IS RECORDED IN `#106`.
Collapsing every
line break turned a blank line into two spaces,
so a quote carrying two spaces
matched straight across a paragraph boundary.
The old note called that safe,
which held only while every model joined lines with exactly one space,
and a
critic quote is an untrusted input.
Matching now collapses SOLE line breaks and
leaves a run alone.
What remains unprotected needs the parse rather than the
characters:
boundaries carried by a single line break,
inside fenced code,
between list items,
between table rows,
and Markdown hard breaks.

CHECKED THAT THE NARROWING DID NOT UNDO THE RESCUE,
since a fix that refuses the
quotes it was built to accept is worse than the bug:
of 40 space-joined quotes
spanning a lone wrap taken from four corpus translations,
35 anchor,
and the 5
refusals are `quote-outside-blocks` in front matter,
which is not quotable
content.

### The section set run a third time, under unchanged code, and it reproduces exactly

The v2 run left one sentence unsupported:
that XIEPT2's section 7 moved from
`absent` to `split` for a reason a single run cannot separate from ordinary
variance between two samples of six stochastic models.
So the same eleven
candidates were run again with nothing changed.

ALL ELEVEN VERDICTS ARE IDENTICAL to v2,
section 7 included.
It splits again,
on
almost the same tallies.

WHAT THAT BUYS.
Section 7's split is REPRODUCIBLE rather than a fluke,
so the
version of the sentence that says "this might just be noise" is no longer the
honest one.
It also gives the stage a variance floor it never had:
two
independent samples of six models over eleven passages agreed on every verdict,
which is worth more than the individual results,
since every earlier number from
this stage was a single sample.

WHAT IT STILL DOES NOT SETTLE.
Attribution of the v1 to v2 move needs a run under
the OLD sheet,
which was not kept.
Low variance under v2 makes the sheet the more
likely cause than sampling,
and that is an inference from two runs of one
configuration,
not a measurement of the other.

ALSO WORTH SEEING:
three voices were lost to the sixty-second grace in this run,
and no verdict moved.
That is the roster threshold behaving as intended,
since a
majority of the whole roster was still reached and silence could not lower the
bar.

### The judges now have a question with a right answer

`#84` asks whether the translate lane's judges can tell a faithful rendering from
a fluent one,
and it could not be answered from any corpus run,
for a reason
worth stating plainly:
IN PRODUCTION NOTHING KNOWS WHICH CANDIDATE IS BETTER.
That is what the judges are being asked.
A run therefore reports how often they
replaced the archive and never how often they were right to.

SO THE ANSWER IS CONSTRUCTED.
A trial takes a real archive slice,
deletes one
whole sentence with `applySeededErrors`,
and puts the two texts on the ballot
`selectBestCandidate` builds.
The deletion is word for word the clean text minus
a sentence,
so it cannot lose on fluency,
register or house style,
only on
coverage,
which is the first criterion the sheet names.
A judge that picks it has
ranked something above saying what the original says.

IT ASKS THE SHEET THAT SHIPS,
not a copy of it.
The task and criteria moved into
`translate-selection-sheet.ts` and both the stage and the trial import them,
so
the measurement cannot drift from the thing measured the first time either is
edited.

FOUR ARRANGEMENTS PER PAIR:
clean text as incumbent and as proposal,
each listed
first and second.
A judge that keeps whatever it is handed scores half,
a judge
that prefers position one scores half,
and only a judge that reads scores four.

A DECLINE IS NOT A HIT,
even in the direction where declining happens to leave
the clean text standing.
The judges did not find the deletion,
they abstained,
and counting that as correct is exactly how `#66`'s silent probe came to look
reliable.

TWO DEFECTS THE TESTS CAUGHT IN THE NEW CODE,
which is what they are for.
`SelectionBallot.best` and `SelectionOutcome.selectedIndex` are BOTH ONE-BASED,
and both were compared against a zero-based array position,
so every correct
choice read as wrong.
`CANDIDATE_NONE` is zero,
so a declining ballot had to be
read before that comparison or it would land in whichever branch was not the
clean one.
The trial now derives the clean text's one-based position once and
compares both readings against it.

WHAT IT DOES NOT ANSWER,
recorded in `#84` rather than implied:
self-preference,
since the fixture is attributed to a composite with no contributors so no ballot
is discounted;
and the HARD case,
a fluent paraphrase that quietly drops a
qualifier.
A deletion is a blunt defect,
so this is a floor:
a roster that cannot
see a missing sentence will not see a missing hedge.

### First reading from the fidelity trial: the judges see a deleted sentence

Sixteen trials over FOUR PAIRS,
one from each of `AmbeR_the_anpa`,
`Arita`,
`Chinatsu_Suzuki` and `CuspariaKLSY`,
four arrangements each:
EVERY TRIAL CHOSE
THE COMPLETE TEXT.
Preserving when the clean text was the incumbent,
replacing
when it was the proposal,
and both with the clean text listed first and second.
Deletions ran 75 to 158 characters.

COUNT THE PAIRS,
NOT THE TRIALS.
Sixteen trials are four independent questions
asked four ways each,
not sixteen independent questions,
because the four
arrangements of a pair share their text.
The earlier eight-trial reading came
from two slices of ONE entry,
which is why it was rerun.

THE BALLOTS SAY MORE THAN THE VERDICTS.
Ninety-five ballots were cast across the
sixteen trials:
66 for the complete text,
3 for the deletion,
26 declining to
choose.
Per judge:

- `hf:moonshotai/Kimi-K3`:
  16 clean,
  0 damaged,
  0 declined
- `hf:zai-org/GLM-5.2`:
  15 clean,
  0 damaged,
  1 declined
- `hf:Qwen/Qwen3.6-27B`:
  15 clean,
  0 damaged,
  1 declined
- `hf:zai-org/GLM-4.7-Flash`:
  10 clean,
  3 damaged,
  2 declined
- `hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4`:
  5 clean,
  0 damaged,
  11 declined
- `hf:openai/gpt-oss-120b`:
  5 clean,
  0 damaged,
  11 declined

EVERY VOTE FOR THE DELETION CAME FROM ONE JUDGE,
`GLM-4.7-Flash`,
and never
enough of them to carry a trial.

TWO JUDGES ABSTAIN ON TWO THIRDS OF TRIALS,
and the reason is legible in what
they wrote:
both hold the pair to the sheet's exact-names criterion,
which the
ARCHIVE ITSELF violates by romanising the handle `AmbeR_the_安帕` to
`AmbeR_the_anpa`,
and refuse both candidates on that ground.
That is a property
of the source slice rather than of the damage,
so on slices like these the
effective roster is four voices and not six.
It is worth carrying into `#93` and
into any quorum decision:
a criterion the archive cannot satisfy silently removes
a third of the panel.

WHAT THAT RULES OUT.
A roster that keeps whatever it is handed scores half,
and
so does one that prefers the first candidate;
the rotation was built to separate
exactly those.
Neither pattern is what came back.

WHAT IT DOES NOT RULE OUT,
and this is a limit of the FIXTURE rather than of the
run:
PREFER THE LONGER TEXT scores sixteen of sixteen here too.
The deletion is a
strict subset of the clean text,
so the complete candidate is the longer one in
every arrangement and rotating the ballot cannot touch that.
Longer-is-better is
not a harmless habit either:
in production it favours a padded fresh rendering
over a tight archive one,
which is the sheet's "nothing added" criterion failing
quietly.

THE ONE PIECE OF EVIDENCE AGAINST A LENGTH HABIT is what the judges wrote.
They
name the missing propositions specifically:
"Candidate 2 completely omits the
first sentence containing the handle,
birth date,
and hometown".
A length rule
cannot produce that sentence.
It is still a SELF-REPORT and reasons can be
written after the fact,
so it is evidence and not proof.

WHAT SETTLES IT IS AN INSERTION FIXTURE,
where the correct answer is the SHORTER
candidate:
splice a sentence from elsewhere in the same document into the clean
text,
so it is in register and fluent and unsupported by this slice's original.
`SeededErrorKind` already carries `insertion`.
A roster that passes deletion and
insertion both cannot be reading length.
That is the next build under `#84`.

ONE LEAK CHANNEL IS ALREADY CLOSED,
checked by dumping a real judge sheet:
the
producer labels do not reach the model.
It sees `CANDIDATE 1` and `CANDIDATE 2`
and nothing saying which is the archive's.
So length is the remaining channel,
which is why the insertion fixture is the whole answer rather than a refinement.

AND THE FIXTURE IS A FLOOR BY CONSTRUCTION.
A deleted sentence is a blunt
coverage defect.
What the lane actually risks is a fluent paraphrase that drops a
qualifier while reading better than the archive,
and nothing here speaks to that.
The reading is:
a roster that could not see a missing sentence would be
disqualified,
and this one is not.

### The insertion fixture, which is what settles the length question

BOTH FIXTURES NOW LIVE IN `src/fidelity-damage.ts`,
and `--damage
deletion|insertion` chooses;
the probe runs both by default and reports per
defect as well as overall,
because a combined figure hides the reading that
matters.
Every trial and every row carries which defect it was built with.

WHAT THE INSERTION IS:
a sentence taken from ANOTHER SLICE OF THE SAME DOCUMENT,
spliced into the clean text after its own longest unique sentence.
Same
translator,
same register,
same subject,
genuinely fluent prose,
and unsupported
by the original this slice shows the judges.
The correct answer is therefore the
SHORTER candidate,
which is the one thing a deletion can never ask.

WHY THE DONOR IS ORDERED RATHER THAN CHOSEN,
and this is worth knowing because
the first version was wrong on the corpus rather than in principle.
Taking
strictly the furthest slice refused FIFTEEN OF SIXTEEN attempts:
the last slice
of a memorial entry is often a credit line,
a short list,
or a single sentence,
and none of those offers a borrowable sentence.
Refusing there would have sampled
only documents that happen to end in prose,
which is a selection rule nobody
chose.
`donorTextsFor` now returns every other slice carrying English,
furthest
first,
and the fixture takes the first that offers a sentence this slice does not
already carry.
Distance is still the preference;
it is no longer a veto.

WHAT THE FIXTURE REFUSES,
each for a reason worth keeping:
a donor sentence the
slice already carries,
since that adds nothing while scoring a judge wrong for
keeping a text that says the same things;
a slice with no sentence long or unique
enough to splice after;
and an entry with no other slice at all.

THE TESTS STATE THE INVERSION rather than describing it:
the deletion leaves the
complete text longer,
the insertion leaves it SHORTER,
and both leave every other
word alone.
Writing them turned up that an insertion anchor carries an EMPTY text
rather than an absent one,
since both members of `DocumentChunk` declare `text`,
so the probe's `cleanText === undefined` branch was unreachable and the donor
helper repeated the same misreading.
Both now rely on the length floor.
