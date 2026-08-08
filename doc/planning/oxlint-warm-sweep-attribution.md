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

## What this does not yet say

Which part of the 3m04s belongs to this rule.
`prefer-readonly-parameter-type` is a semantic plugin doing whole-program analysis and is the
obvious suspect,
 but no measurement here separates it from oxlint's own passes or from the
other plugins in `@monochromatic-dev/config-oxlint`.

Attributing that needs a run with the rule disabled,
 which needs a config that spreads the
shared base and overrides one rule,
 since the root `oxlint.config.ts` takes its rules from that
package rather than declaring them.

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
