# Depot Linux ARM64 repository workload research

## Purpose and queued admission

This queued investigation follows the Nextest identity adapter campaign
and the current platform source-ledger reconciliation.
No ARM64 workload profile has been dispatched for this investigation.
It must not start while the adapter profile is active.

The parent admitted one bounded Linux ARM64 profile from frozen application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
The initial admission permits at most one concurrent parent VM,
an eight-CPU ceiling,
a 15-minute finite job window,
and a USD 1 nominal campaign guard.
Exact runner/resource syntax and the scoped rate reservation remain preflight work.
The parent reserves the other VM slot for its KVM control.
Account settings and production routing remain outside this experiment.

## Evidence boundary

The BuildKit ARM Node/ELF probe is image execution evidence.
It does not establish functional execution of repository Rust or TypeScript owners on ARM64 CI.
The first step is to inspect prior frozen-source ARM receipts,
target support,
and current exact runner labels.
Reuse existing evidence if it already meets the application/source/tool and consumer boundary.

Otherwise prepare a source-owned Rust core test profile,
including actual all-feature Truepeak tests when the frozen target supports them,
and a representative matched TypeScript owner cohort.
Keep original tool/source identities,
functional outcomes,
and unexercised surfaces explicit.
One execution does not qualify a performance ratio;
that would require unchanged repetitions and observed spread.

## Next action

Finish and clean the adapter's exact transport variant,
reconcile the current platform ledger,
then audit the existing ARM receipts before designing any new allocation.
