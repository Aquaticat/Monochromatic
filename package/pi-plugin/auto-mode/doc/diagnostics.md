# Diagnostic evidence and storage

## Purpose and callers

`native/contract/integration/action-policy/assessment-diagnostics.mjs` records selected model requests and replies.
`native/contract/integration/action-policy/decision-diagnostics.ts` correlates source clauses,
scores,
routing,
and final outcomes by review and operation identity.
Both use the existing tagged logger.

This evidence is necessary to distinguish a model's uncertain answer from a request that received no answer.
The reported MiMo incidents demonstrate the difference:
one review records an approval distribution of `0.48`,
`0.34`,
and `0.18`;
another reaches an HTTP transport exception before any final answer is admitted.

## Storage ownership

The shared logger owns the file sink under the nearest `node_modules/.monochromatic` directory.
Auto-mode does not own a parallel logging backend.
The initial package directory contains 12,728 diagnostic files totaling 7,089,712,671 apparent bytes.
The largest sampled files are historical logs from 2026-10-14.
Their dominant records are repeated resource-input snapshot messages.

Current `native/contract/collector/resource-input-custody/diagnostics.ts` batches those snapshot counts
until the next microtask.
It retains context,
system,
append,
and unknown attempt counts without writing a record for every synchronous snapshot.
The historical storage total is therefore not evidence that current code still emits the old per-copy messages.

## Invariants and alternatives

Decision reconstruction retains selected source material,
question identities,
model scores,
fallback reasons,
and the original operation.
Transport failures exclude credentials and arbitrary upstream exception text.
The current HTTP invocation category permits bounded recovery without retaining a borrowed error cause.
The original reported transport failure's discarded cause cannot be recovered retroactively.

Silencing all diagnostics would remove the evidence needed to diagnose these failures.
Adding package-specific file retention would duplicate the shared logger's responsibility.
Storage maintenance must preserve investigation evidence and account for active writers.
Compression or archival is preferable to discarding captured decisions without an evidence policy.

## Verification

The native fallback tests assert correlated model requests,
question evidence,
and outcomes.
The transport tests include hostile credential-bearing failures.
Snapshot diagnostics can be inspected through their batched count records.
The footprint inventory and sampled log-shape report are retained privately under
`${HOME}/temp/agent/pi-mimo-lint-approval-20261017`.
