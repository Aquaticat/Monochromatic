# Compact prepared-group review

## Implemented architecture

The 2026-10-17 refactor shares actual Pi preparation, execution, and finalization phases
across top-level and Codemode child groups.
`prepared-dispatch.mjs` retains the actual prepared records,
reviews the complete group, and releases those records into native execution.
The qualified SDK supplies the phase bodies through `createOwnedToolPhases`.

`integration/native-batch/prepared-group.mjs` owns membership, review disposition,
source checks, confirmation, and execution maps.
Automatic uncertainty and assessment failure use that group's scoped selector.
Established stale decisions remain withheld.
The separate manual group, original-source approval router, child dispatcher, whole-call runner API,
and suspended-before-hook protocols are removed.

The caller constructs one native session preset and awaits cleanup.
The native slot factory reserves a call before actual preparation.
Terminal retention remains independent of later parent eligibility.
Script-value use still requires current original ownership and a returned member.

## Retained boundaries

The source compiler retains clause, heading, incorporation, authorization, admission,
and complete-operation fallback semantics.
Model replies supply estimates; selected readable instructions and observed authorization supply authority.
Question binding, source attribution, currentness, and callback reentrancy checks protect these boundaries.
Consolidation removes repeated execution ownership without discarding those checks.

[Decision review](decision-review.md), [instruction collection](instruction-collection.md),
and [operation preparation](operation-preparation.md) identify callers and alternatives.
Finite program profiles retain the real VM, recorder, queues, conversion, and issued-work drain.

## Artifact layout

Qualified upstream TypeScript stays in its verified compiler checkout.
Native output contains emitted SDK runtime, maintained contracts, generated helpers,
policy output, metadata, and licensing.
Identical files share storage across immutable releases.

The earlier proposal to prune everything outside a literal graph is not implemented.
Native verification loads contract fixtures from the generated artifact,
and generation uses imports absent from the literal source graph.
Retaining this development output preserves real consumers without another staging protocol.
The emitted graph explicitly records computed imports; an unreached file is not automatically dead.
The active artifact contains 1,030 regular files totaling 8,211,396 bytes.
Its conservatively reachable graph contains 794 files totaling 6,099,319 bytes.
Shared external dependency targets are excluded.

Maintenance removes 43 inactive build copies after live-process and repository-consumer checks,
retaining active output and verified rollback.
Builds preserve old paths for running sessions; automatic release eviction is not implemented.

## Executable evidence

All 22 real native lifecycle modes pass, including child preparation, hook blocking,
unsealed arguments, and cancellation.
The 24-case fallback matrix, native execution catalogs, full package units, and type check pass.

The final configured MiMo replay completes all 16 original calls,
with zero selectors and 17 actual live-Luna requests.
Positive-controlled payload inspection excludes raw structured commands, thinking, and signatures.
A prohibited process/Bash pair is withheld without a selector.
Removing both independent denial barriers through a process-local load hook makes the real test
execute three harmless fixture commands and fail.
Production artifact hashes remain unchanged.

The earlier comparison matches nine three-member traces against immutable baseline `native-release-1voz8z`.
The first prototype changed cancellation finalization and validation-result order;
the corrected traces exercise both differences.
Captured traces remain in private evidence after inactive build cleanup.

## Source inventory and limits

The parser inventory counts 813 tracked source files, 103,885 physical lines,
65,692 nonblank code lines, and 29,136 runtime statements.
It removes comments, interfaces, type aliases, and type-only declarations.
Remaining annotations and string data count as code lines.
Positive controls preserve a comment-looking string and detect an added statement.

The literal source graph reaches 296 files and 20,357 code lines.
Filename-classified verification accounts for 28,596 code lines in 290 files.
Build inputs and other files outside the graph are reported separately, not declared unused.
The intermediate compact-design baseline was 68,040 code lines and 30,301 statements;
the retired extension deletion predates that baseline.
There is no accepted numeric line budget.

Full maintained Oxlint covers 813 files with 486 rules:
83 errors and 13,686 warnings remain for MiMo's lint pass.
Behavioral verification does not establish lint completion.
Inventories and receipts remain private under
`${HOME}/temp/agent/pi-mimo-lint-approval-20261017`.
