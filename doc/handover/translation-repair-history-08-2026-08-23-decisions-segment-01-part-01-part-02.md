# Translation repair history: 2026-08-23 decisions, part 02

Part 02 of [Translation repair history: 2026-08-23 decisions](translation-repair-history-08-2026-08-23-decisions-segment-01-part-01.md),
whose index lists every part in order.

## Task 187, corrections found while covering the wire

Three corrections to the section above.
None of them change what shipped;
two change what a later session should believe about it.

### "Reachable path" was true of the code and false of production

The heading above says the discount missed the author "on a reachable path".
Reachable in code,
yes.
Reachable in a corpus pass,
no,
and the distinction matters because it decides whether the machinery earns its complexity.

`wroteTextForIssue` weights a checker's verdict at half when that checker appears in `IssueAuthorship`.
Authorship can only ever name an editor
(`producer.modelId`,
`producer.matched`,
`producer.contributors` at `candidate-select-model.ts:136-139`)
or a refiner,
added by `collectRefinedAuthors`.
`assertCheckerIndependence` at `repair-contract.ts:359` refuses any roster where a checker is also an editor
or a refiner,
and it runs at `repair-chunk.ts:126` and `refine-phase.ts:153`,
so every chunk and every refine phase is gated on it.
The production roster at `corpus-run/run-config.ts:192`,
the only `RepairModels` literal outside TSDoc examples,
is disjoint:
editors and refiners are Kimi-K3,
GLM-5.2 and GLM-4.7-Flash,
checkers are Qwen3.8-27B,
Nemotron-3-Super-120B and gpt-oss-120b.

So the checker-side discount has changed no tally that ever shipped.
Task 187's corrections are right and covered;
they are also currently inert,
and so is the half of task 91 that built them.

SCOPE THIS PRECISELY.
`SELF_VOTE_WEIGHT` has two independent readers and only one is unreachable.
The SELECTION side at `candidate-select.ts:276` halves a JUDGE's vote for its own candidate,
`judgeModelIds` is the whole six-model roster,
and the quorum threshold at `repair-contract.ts:288` is written around it.
That copy fires on every chunk;
the suite log shows it live
(`hf:zai-org/GLM-5.2 chose candidate 1 at weight 0.5`).
Do not delete it.

Whether to drop the checker-side apparatus or instead relax the assert and let the strongest editors check too,
with their self-votes discounted,
is a design question with a measurement behind it.
It is filed,
not decided here.

### The stored authorship went stale the moment a refinement was kept

`repairedText` became the refined text while `authorship` stayed editor-only,
so every `refined: true` record misstated its own contract.
The recheck's union lived in an argument and died with the call.
Fixed at the shipping return only:
both rollback paths hand back the editor's text,
so the editor's authorship is already true of them.

No cache bump was needed.
`SLICE_CACHE_VERSION` 30 is baked into the key,
and no pass has run since it landed,
so there is no v30 entry to go stale.

GFP:
removing the stored union fails `STORES BOTH STAGES ON A RECORD WHOSE REWRITE SHIPPED`
with `expected [ GLM-4.7-Flash ] to deeply equal [ GLM-4.7-Flash, GLM-5.2 ]`,
while the control `NAMES NO REFINER ON A SLICE IT ROLLED BACK` still passes.
Restored byte-identical,
zero import errors on the probe.

### Test files are exempt from max-lines

The section above splits a test file at the 300-line budget.
That split is fine to keep,
but it was self-imposed:
`package/config/oxlint/src/overrides.ts:161` turns `eslint/max-lines` off for `**/*.{test,bench}.ts`.
Only source files carry the budget.

FINAL GATE:
suite 546 PASS / 0 FAIL / exit 0,
lint 0 warnings 0 errors,
`lint:types` exit 0.
Commits:
3922cba3b,
f3c444458.

### Correction to the section above: the unreachability was already recorded

`doc/decision/translation-repair-question-answers.md` lines 130 to 140 already say it,
and say it as a deliberate state rather than a defect:

> `assertCheckerIndependence` in `repair-contract.ts` THROWS when any checker id also appears among the editors
> or refiners.
> A roster where a model could certify its own text is refused before any work happens,
> so no
> checker is ever a self-certifier and a half-weight branch would never run.
>
> Relaxing that assertion is the "widen the producing roles" half of `#91`,
> and question 1 answer D blocks
> roster widening until `#84` reports.
> So the ordering is forced:
> `#84`,
> then the roles widen,
> then the half
> becomes reachable and is applied.

So the checker-side discount is unreachable BY DESIGN,
pending task 186,
not by oversight.
Task 188 is the "and is applied" step,
blocked by 186,
not a discovery.

What the 2026-08-23 reading did add,
and what is worth keeping:
the two readers of `SELF_VOTE_WEIGHT` must not be conflated.
The selection-side copy at `candidate-select.ts:276` is live on every chunk and must survive any cleanup
aimed at the checker-side one.

The lesson for a later session is the search,
not the fact:
`grep -rn 'SELF_VOTE_WEIGHT' src/` found the code
and `grep -rn 'assertCheckerIndependence' doc/` would have found the decision.
Searching the source and not the decisions is how a recorded choice gets rediscovered as a bug.

## Task 188, the arithmetic checked before the relaxation is written

Read on 2026-08-23,
while task 186's probe was in flight,
so the relaxation could be written the moment
the width question resolves rather than after it.

The worry worth settling first was whether relaxing `assertCheckerIndependence` would leave the discount
doing nothing.
If every checker is also an editor,
and every checker were therefore halved,
the discount would cancel out of `tallyResolutionChecks`:
its rule is `resolved: fixed > (notFixed + worse)`,
a comparison of two weighted sums,
and scaling both sides by one half leaves every verdict exactly where it was.
A uniform discount over a fully overlapping roster is not a safeguard,
it is a no-op.

It is not uniform.
The weight is chosen per issue at `package/module/translation-repair/src/tally-resolution.ts:265`,
by `wroteTextForIssue({ authorship, issueId, modelId, },)`,
so a checker is halved only on the issues whose shipped text it actually helped write
and keeps full weight on every other issue in the same slice.
A six-seat roster checking its own slice therefore still produces a mixed tally
rather than a uniformly scaled one.

This is what makes task 187 a prerequisite rather than a neighbour.
The discount reads `authorship`,
and until 187 the record could carry an author list describing pre-refinement text,
which would have halved the wrong checkers on the wrong issues once the roster overlapped.

What task 188 still owes when it runs,
none of which this reading settles:
the assertion's duplicate-checker refusal must survive,
because a repeated id is a different fault from an overlapping one
and `gatherStageVoices` still counts a repeat twice toward quorum
while `runCheckerStage` collapses it to one ballot;
`assertJudgeableProducerRoster`'s capacity arithmetic at `repair-contract.ts:288` must be re-read
at whatever width 186 lands on;
and the selection-side reader of `SELF_VOTE_WEIGHT` must not be touched.

## Task 186, the constraint that decides it is arithmetic, not a measurement

Found 2026-08-23 while the width probe was running,
by reading the live roster instead of the probe.

The repair lane's rosters are a PARTITION of the six-model roster,
not a selection from it.
`RUN_MODELS` at `package/module/translation-repair/src/corpus-run/run-config.ts:192` seats
three editors,
the same three as refiners,
and the disjoint other three as checkers.
Three writers plus three checkers is exactly six.
The partition saturates the roster,
with nothing spare.

That is not a coincidence,
it is what `assertCheckerIndependence` forces:
checkers must exclude every editor and every refiner,
so `writers + checkers` can never exceed the roster.

The consequence for the owner's standing ruling,
"All producing roles to 4":
it is not reachable under the current assertion.
Four writers out of six leaves at most two checkers,
and if the refiners were also widened to four as a distinct set the writers alone would exceed the roster
and no checker could be seated at all.

NOTHING WOULD REFUSE THE SHRUNK ROSTER.
The only floor on the checker roster is `assertRostersConfigured` at
`package/module/translation-repair/src/roster-configuration.ts:72`,
which refuses an EMPTY role and nothing else.
Every other assertion in the module was enumerated to check this;
`assertJudgeableEditorRoster` and `assertJudgeableProducerRoster` both bound the PRODUCING side.
So seating four editors today would quietly drop the checker stage to two voices,
and at two voices one `fixed` against one `not-fixed` resolves nothing,
because `tallyResolutionChecks` requires `fixed > (notFixed + worse)`.

THIS REVERSES THE ORDERING THE PLANNING DOC RECORDS.
That doc has the sequence as `#84`,
then the roles widen,
then the checker-side half becomes reachable
and `#188` applies it.
The arithmetic says `#188` comes FIRST:
until the assertion permits overlap,
there is no width at which four editors and a usable checker roster
can coexist,
so `#188` is a prerequisite of the owner's ruling rather than a consequence of it.

WHAT THIS DOES NOT SETTLE,
and what the probe is still for:
whether widening buys better repairs at all.
If the probe's move count lands inside its own null band,
the answer is that the width does not decide
anything measurable,
and the cheapest correct action is to stay narrow and record that,
which spends nothing and leaves the assertion alone.
The arithmetic above only says what widening COSTS if it is done;
it does not say it is worth doing.
