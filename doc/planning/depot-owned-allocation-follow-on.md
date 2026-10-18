# Depot owned allocation follow-on ledger

## Purpose and queue

The frozen baseline remains
`doc/audit/depot-owned-allocation-ledger-2026-10-18.evidence.json`,
with `223` allocation rows.
The parent's independent baseline review passed its timestamp/cost and source-body joins on 2026-10-18.
This follow-on will preserve separate source receipts and deduplicate every new identity against that baseline.
It will not rewrite baseline arithmetic or interpret admissions as measured allocations.

The requested queue is recorded before normalization:

- Original failed graph `39135886118`,
  if absent from the baseline.
- Coverage native desktop `0jpk5bwpvs`.
- Native BuildKit-auth runs `dzsf27t0xx`,
  `pxx75mxnw2`,
  and `38z4wlq9d3`,
  plus separate BuildKit IDs `j9r23brwtx`,
  `xwq746tv4z`,
  and `20l2bllb5n`.
- The six terminal cache-scope runs recorded in
  [the cache receipt](../audit/depot-cache-trust-scope-2026-10-18.evidence.json).
- Coverage standard public GitHub `39141147245`
  and later owned Depot OS controls when terminal and published.
- Corrected root graph GitHub `39140975786`
  and native `gb01kjx2qk`
  when terminal and published.

The machine follow-on will live at
`doc/audit/depot-owned-allocation-follow-on-2026-10-18.evidence.json`,
with its own retained source archive.
Known requested resources,
actual run/job/attempt identities,
observed intervals,
nominal list-compute arithmetic,
public GitHub zero compute,
conservative reservations,
and unknown VM or builder billing intervals will remain distinct.

This task is read-only with respect to cloud resources and account settings.
It allocates no jobs,
VMs,
or builders.
Root and coverage owners retain their active watcher ownership.
