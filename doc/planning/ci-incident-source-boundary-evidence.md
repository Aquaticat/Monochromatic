# CI incident source-boundary evidence

## Purpose and observed gap

The initial body of issue `#1162` reversed its environment-variable sender and receiver.
Immutable harness `18e8c13173` proves the pilot sets `DEPOT_LOGGER_EXTERNAL_GROUP`,
while `package/module/logger.fuzz/mise.toml:288` reads `DEPOT_LOGGER_EXTERNAL`.
The body and a correction comment are re-fetched and verified after correction.
The failure and its repair remain the same incident.

`AGENTS.md:403` already requires fresh backing for source claims through its `NVS` rule.
The proposed refinement makes the two sides explicit before publishing interface-name claims.
This is a proposal; no policy change is implemented or needed to continue the CI work.

## Proposed existing-rule refinement

```text
# Proposed replacement wording in AGENTS.md
NVS:
 Pair environment,
 tool,
 or source claims with fresh evidence.
For caller/receiver names,
 cite both immutable sides before publication.
No backing:
 verify or label a guess.
```

The evidence should retain the actual caller definition,
receiver definition and source revision,
with an actual boundary control when the surrounding task requires behavior verification.
This prevents a correct failure classification from carrying reversed interface names.

The additional source probes are the cost;
they do not replace actual consumer controls or change source-test execution policy.
Inspect the proposed wording and the corrected `#1162` source evidence when deciding whether to adopt it.
