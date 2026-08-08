# Whole-repo oxlint timing, first attribution

Opened against issue #374,
 which asks for a warm whole-repo `mise run lint:oxlint` under sixty
seconds.
Measured 2026-08-08 on the machine running this session.
No optimization proposed yet:
 this records where the time goes,
 because every number quoted
for this before was a cold run.

## What was measured

Warm run,
 with `node_modules/.cache/prefer-readonly-parameter-type` populated by the previous
sweep:
 3m04.7s wall,
 2m36.8s user,
 30.0s system.
The cache is 45 MB.

Cold runs of the same command through this session,
 with that cache deleted first:
 10m24s to
11m10s across eight measurements,
 clustering near 10m45s.

So the persistent summary cache removes roughly seventy per cent of the work,
 and the warm
figure is about three times the target rather than the eleven times a cold number implies.

Findings are identical between the warm and cold runs,
 1555 in both,
 with the same error and
warning totals.
That matters before trusting any timing:
 a cache that changed results would make the fast number
meaningless,
 and this one does not.

## Which three minutes

Measured by turning the one rule off in `oxlint.config.ts`,
 keeping the same task, invocation
and warm cache,
 and putting the file back afterwards.

Warm run with `prefer-readonly-parameter-type/prefer-readonly-parameter-types` disabled:
**13.0s** wall,
 against 3m04.7s with it on,
 and zero findings from it confirming it really was
off.

So this rule is about 171 of the 184 seconds,
 roughly ninety-three per cent of warm whole-repo
lint time.
Everything else oxlint does across the repository,
 core passes and every other plugin together,
is thirteen seconds.

That reframes issue #374 entirely.
The target is not a broad performance problem to chase across the linter;
 it is one rule,
 and
the rest of the run already sits comfortably inside sixty seconds with two thirds of the budget
to spare.
Reaching the target means taking this rule from 171 seconds to about 47,
 a factor of three and
a half,
 with no other component needing to change.

## What this does not yet say

### How to measure the next split, and what tripped

`EffectAnalysisBudget` in
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/effect-analysis-budget.ts`
already receives every timed span through `record({ startedAt, phase, },)`,
 and already knows
the phase label.
It accumulates only a single total,
 so the breakdown needs a temporary map keyed by the first
word of the label plus a dump on process exit.
That instrumentation type-checks and is the shortest path to the answer.

What tripped is the harness rather than the method:
 the run takes about three minutes and a
foreground command is cut off at two,
 which killed the workers before the exit handler wrote
anything and left the instrumented file in place until it was restored deliberately.
Run it in the background.

Only five sites report a phase at present,
 so the breakdown will account for part of the 171
seconds rather than all of it,
 and the size of the unaccounted remainder is itself the useful
number:
 it says how much sits outside every span the rule currently times.

### Which phase, measured

Warm run with per-phase accumulation,
 summed across every worker:

- `source` 583.3s
- `project` 23.4s
- `fixed-point` 4.5s
- `foreign` 0.8s
- 611.9s recorded in total

Two cautions before reading anything into those,
 both of which change what the numbers mean.

The total exceeds the rule's 171 seconds of wall time because the sweep runs workers in
parallel and each contributes its own spans,
 so these are worker-seconds and only their
*proportions* are meaningful.
And only five sites report a phase,
 so 611.9 worker-seconds is the total of instrumented spans
rather than of the rule's work;
 what falls outside them cannot be derived from this,
 because
wall time and summed time are not comparable under parallelism.

Within what is instrumented,
 `source` is 95.3 per cent and nothing else is close.

That is the phase to look at next,
 and the sharper question it raises is why it costs so much on
a *warm* cache:
 the cache exists to avoid re-deriving summaries,
 and a source phase still
dominating afterwards suggests either that it covers work the cache does not cover,
 or that
reuse is missing more often than intended.
Answering that needs the phase broken down further rather than another total.

### What the earlier suspects were


The suspects are the whole-program summary construction,
 the checker queries each summary
makes,
 and the per-file diagnostic pass,
 and nothing here separates them.

Nor does it say what the cache is worth per phase.
Cold costs 645 seconds against 184 warm,
 so 461 seconds are avoided by reuse,
 but whether the
remaining 171 is mostly unavoidable analysis or mostly cache misses is unmeasured.

## Why the cold number was the one being quoted

Every sweep in `doc/planning/prefer-readonly-return-substitution.md` deletes the cache first,
deliberately:
 a warm cache masked an analysis-internal failure earlier in that work,
 and the
guarded failure there is a wrong offer rather than a slow run.

Correct for that purpose and misleading for this one.
Anyone reading those eleven-minute figures as the cost of linting this repository would
conclude the target is an order of magnitude away.
It is closer to three times,
 and the first question is which three minutes.
