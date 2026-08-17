# Four translation-repair decisions taken by the owner on 2026-08-16

Answered together, in response to the four options sets in
`doc/planning/translation-repair-open-decisions.md` and `#105`, `#106`.
Each was presented with pros, cons and a ranking; the owner took three of the four recommendations
and overrode one. The override is the most consequential of the four, so it is stated first.

## Both insertion landings are parked

THE OVERRIDE. The recommendation was to land the coverage instrument, ranked first because it is
built and measured twice. The owner parked BOTH landings instead.

What this settles, and it was previously blocked pending exactly this answer:

-   Do NOT wire `groupSourceFirst` into `subdivideChunkPair`.
-   Do NOT emit insertion pairs from `alignDocumentSections`.
-   The coverage prototype (`coverage-wire.ts`, `coverage-verdict.ts`, `coverage-stage.ts`,
    `coverage-candidates.ts`, the `coverage-probe` task) stays wired to nothing.

WHAT THE MEASUREMENTS ALREADY SAID FOR IT, so this is not a decision against the evidence.
At paragraph scale the case was already weak: across both runs of `mikaela_khara`, ninety-six
answers and not one vote for absence, so at most one candidate of twenty-two and plausibly none is a
genuine omission. The census attributes the rest to merges and mispairings, which insertion would
duplicate rather than repair. At section scale the absences are real, but landing five as designed
would have produced eight duplicate headings on `XIEPT2`, so it was never ready as written.

WHAT IT COSTS, stated plainly: the section-scale absences `#106` found are real and stay unaddressed.
That is the known price of this answer rather than an oversight in it.

THE FIRST CONSEQUENCE, acted on immediately: option A of
`doc/planning/coverage-wire-rerun-trade.md` is NOT to be run. It existed to say how much of the
block-scale null to believe, and the block-scale null existed to decide landing four. With both
landings parked it informs no pending decision. The handover carried a standing instruction to run
it after the cost run; that instruction is withdrawn.

One piece of it survives on its own account, because it is a durability fix rather than a
measurement: the coverage probe writes with `console.log(JSON.stringify(...))` and nothing persists
it, which is why the 2026-08-16 numbers at both scales survive nowhere but a session transcript.

## The rendering audit runs over a sample of settled artifacts

The recommendation, taken. Standalone, over a SAMPLE of settled version 2 artifacts, rather than per
slice inside the translate lane, over every artifact, or not at all.

It gets a RATE rather than a verdict, which is what an instrument in shadow mode is for: how often
the lane's renderings carry corroborated defects. It cannot settle a question about any particular
entry, and that is accepted.

Nothing in the producing path changes, so the instrument's own error rate, which is still unmeasured
in production, cannot reach what ships.

## Declines get one retry, and then a name

The recommendation, taken. Retry a declining slate ONCE against the same panel, then record what
still declines under a named disposition.

WHY ONE AND NOT MORE, from the window trial ledger's 327 real judgings: retrying identically
configured arms resolved 21 of 37 declines, while only 8 slices of 109 declined under BOTH judgings.
One retry captures most of the recoverable set and the rest is a stable core that further retries
buy progressively less of.

WHAT THE DECLINES MOSTLY ARE, which the disposition name has to respect: voice loss, not unfillable
passages. The rate is 0.171 overall but 0.063 at a full panel against 0.287 at five voices and 0.692
at four, and the mechanism is in `candidate-select-model.ts`, where `MIN_SELECTION_WEIGHT` is 2 and
a self-vote counts a half.

### The disposition name, chosen here and cheap to veto

The owner delegated the name by taking this option. Proposed: `no-candidate-backed`.

It names what the code actually observed, which is that no candidate reached
`MIN_SELECTION_WEIGHT`, and it does not claim the passage is unfillable, which the panel-width
figures say is usually false. `panel-declined` was rejected for attributing a choice to the panel
when the panel mostly just lost voices; `unfillable` was rejected outright as the reading the
measurements contradict.

The existing delivery vocabulary already covers WHERE such a slice lands, so this is a reason rather
than a new kind: a slice with an incumbent stays `incumbent-retained`, and one without stays
`gap-remains`.

## The window trial is dropped

The recommendation, taken. No fourth sham-context arm.

Over the 109 slices it read, the wide arm decided differently from a narrow arm 18 times, and the
two IDENTICALLY configured narrow arms differed 21 times. The effect is smaller than the noise it
was measured against, and the exclusion rule that produced this reading was fixed in writing before
any numbers existed.

WHAT IS KNOWINGLY GIVEN UP: this cannot distinguish "no effect" from "an effect this design cannot
resolve". A sham-context arm could have, and the owner judged that refinement not worth another full
trial against the same six models, since the practical answer, do not widen the judge's context,
is the same either way.

WHAT SURVIVES THE TRIAL and outlives its own question: the negative control measured the per-slice
preserve-or-replace decision as about 19 percent unstable between identical runs. Rates over many
slices survive that; per-slice claims and small comparisons do not. That constraint is not dropped
with the trial and constrains how any single pass may be read.
