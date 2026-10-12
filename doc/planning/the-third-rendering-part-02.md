# The third rendering, part 02

Part 02 of [The third rendering](the-third-rendering.md),
whose index lists every part in order.

## The measuring sheets now carry the rules too, and one of them needed a fourth verdict it did not get

The four sheets of #149 grade rather than write, so nothing ships from any of them.
What they decide is which defects get worked on next,
and an instrument that penalises a page for obeying the rules it was written under
reports damage where the pipeline was right.

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
A block spliced beside that bullet would have left two live rules disagreeing,
with the older one written as a numbered rule.
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
Every block of the page must appear in the candidate, in kind and in order,
so a candidate that MERGES the page's blocks fails.
Extra blocks are allowed, but only where the ORIGINAL has them:
a three-block candidate against a one-block page returns `valid` when the source is verse and `invalid`
when the source is prose,
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

- `TRANSLATE_RULES`, from #144: where the existing translation shapes the passage differently,
  keep the existing translation's shape.
- `TRANSLATE_LINE_STRUCTURE_RULE`, from #79: produce one output line per original line,
  and where the existing translation has merged lines, unmerge them.

On `Toka_ls`, the entry the verse rule was written for,
the Chinese chunk is 21 blocks at median 22 against the English rendering's 18 blocks at median 101.
One rule says keep 18 and the other says restore 21.
Both arrive in one prompt, and a producer meeting a contradiction resolves it however it likes.

The verse rule wins, and now says so.
It rests on a measured failure and its own recorded decision, while #144's bullet was written about prose reshaping.
Because the guard is a floor, nothing downstream would ever have caught the wrong choice,
which is why the precedence had to be stated in the sheet rather than left to the check.

`LINE_STRUCTURE_RULE` in `line-structure-addendum.ts` is NOT the same defect.
It is given to an editor working on the standing text,
where keeping every existing line is the anti-reflow rule #79 built,
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

- a genuine fix reads `fixed` on all three voices, an untouched text reads `not-fixed` on all three,
  and a fix that damaged its slice splits two `fixed` against one `worse`.
- on the mixed sheet the tense issue resolves, the meaning issue does not,
  and the FABRICATED issue draws two `not-fixed` against one `fixed`,
  so the majority still refuses to agree with a sheet describing something absent from the text.

Introduced-defect prober:

- `deletion/mislabelled`, where real damage sits under a false accepted issue, draws three removal-corroborated claims.
- `deletion/licensed`, the negative control where silence is correct, draws `none-found` on all three.

Rendering auditor:

- the flipped rendering draws an agreed `altered-polarity` finding on two voices.
- the clean rendering agrees at neither tier, which is the expectation;
  one voice filed a lone claim and no agreement formed on it.
- two degraded lines on the flipped arm are infrastructure rather than sheet: one voice lost and a 2-of-3 roster.

## Measurement 3, read on the three slices the reading called tied

Read while the run was still buying its last slices,
because the reading is the slow half and these three were already settled.
The question fixed in advance was whether a consolidation gives these slices
a text the reading would prefer to BOTH lanes.

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

```text
standing: Gaoyang was a cute, gentle, and kind girl. She grew up in a single-parent family with difficult living conditions, but she was always very strong.
shipped:  Gaoyang is a cute, gentle, kind girl. She is from a single-parent family, and from childhood her living conditions were difficult, but she has always been very strong.
```

The rest of the page is past.
Chunk 0's standing text reads `Gaoyang indulged in the cradle of happiness.`,
and chunk 1's own standing text reads `Gaoyang was a pretty, tender and kind girl.`
A reader meets both tenses on one short memorial page.
The shipped sentence also disagrees with itself:
`She is from a single-parent family, and from childhood her living conditions were difficult.`

The shipped text is not worse on any other axis.
It separates `单亲家庭` from `从小生活条件不好`, which the Chinese does carry as two clauses and the standing text had fused.
So this is a tense defect specifically, not a bad consolidation.

### The mechanism, read off the sheets rather than guessed

`consolidate-wire.ts` splices `HOUSE_POLICY_BLOCK`, which says nothing about tense,
so the producer choosing the wording had no guidance at all, with the past-tense standing text in front of it.
`contest-ballot-wire.ts` splices `JUDGE_POLICY_BLOCK`,
whose forced-differences paragraph tells the gate that rendering a tenseless copula in past
or present is a choice English forces and never a fault.
The producer was free and the decider was told not to object.

That paragraph was added by #146 for a measured reason and is not the thing to undo:
three whole-slate refusals came from judges treating a forced tense as an alteration of the time referred to,
and Chinese does mark no tense.
What no sheet has ever carried is the other half.
A slice joins a page that already has a tense, and absent a reason to change it, the page's tense is the one to match.
Consistency with the page is a different claim from whether a forced choice is a fault,
so stating it does not reopen the refusals.

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
