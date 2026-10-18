# Depot Linux ARM64 repository workload research

## Purpose and queued admission

This queued investigation follows the Nextest identity adapter campaign
and the current platform source-ledger reconciliation.
No ARM64 workload profile has been dispatched for this investigation.
The identity adapter is terminal and its exact transport variant has been removed.

The parent admitted one bounded Linux ARM64 profile from frozen application source
`e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
The initial admission permits at most one concurrent parent VM,
an eight-CPU ceiling,
a 15-minute finite job window,
and a USD 1 nominal campaign guard.
The current catalog's `depot-ubuntu-24.04-arm-8` label denotes 8 CPUs and 32 GiB.
At the published native CI rate of USD 0.0004 per second,
the full job window reserves USD 0.36 before separate storage and passing-result meters.
This is a timestamp-compute reservation,
not an observed invoice charge or an aggregate account cap.
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

## Selected source-owned consumers

The AMD64 Truepeak comparison is native run `221vdm1f21`,
with harness `a85e204f078db540c2a292342000ce5423bb8338`.
Its owning `cargo nextest run --release --all-features` boundary passed 89 tests
and retained 2 deliberate skips.
Its adapter added locked offline execution,
JUnit output,
and disposable filesystem paths while preserving default build and test concurrency.
The actual compiler was `rustc 1.101.0-nightly`,
commit `5d8fec0669a64607db9ccbf663e7c23125bf4748`.
The all-feature graph uses pure-Rust Turso,
fake samples,
and disposable databases;
it does not require a paid provider or live audio.
See the [Rust receipt](../audit/depot-rust-coverage-2026-10-18.evidence.json).

The matched TypeScript owner is `//package/module/p-limit-fork:test:unit`.
Its unchanged AMD64 source passed in GitHub Actions run `39105587003`,
with harness `b9c84e42b72f7e0abfa942a98a61029e4f3f252c`.
The actual output identifies 11 passing runtime describe groups,
not a machine-counted total of individual cases.
Its preparation uses locked Node `26.12.0`,
pnpm `12.14.0`,
frozen installation with lifecycle scripts disabled,
the shared build prerequisites,
and the owner build.
The exact minimal prerequisite graph is the remaining harness-design input.

## Next action

Preserve the selected AMD64 logs and source graph,
design an isolated ARM workflow,
validate the workflow and admission locally,
then dispatch the single admitted finite profile.
Actual ARM compiler,
runtime,
binary architecture,
source hashes,
JUnit outcomes,
and terminal cleanup remain unmeasured until that profile executes.
