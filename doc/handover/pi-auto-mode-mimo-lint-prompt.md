# MiMo lint handoff

## Objective and scope

MiMo's task is to clear the complete maintained lint scope for `package/pi-plugin/auto-mode`
while preserving the verified native execution and review behavior.
The refactor has passing behavioral verification; lint completion is still pending.

The 2026-10-17 full Oxlint run reports **83 errors and 13,686 warnings**
across **813 files and 486 rules**, using one thread.
The previous intermediate snapshot reported 30 errors and 13,163 warnings.
Phase extraction and its genuine host fixtures add findings while removing retired protocols;
this is an explicit increase in diagnostic debt, not a clean-lint claim.

The exact diagnostics and per-file error index are private:

- `${HOME}/temp/agent/pi-mimo-lint-approval-20261017/final-full-oxlint.log`.
- `${HOME}/temp/agent/pi-mimo-lint-approval-20261017/final-lint-errors.json`.
- `${HOME}/temp/agent/pi-mimo-lint-approval-20261017/final-lint-summary.json`.

## Starting point

1.  Read the [package architecture](../../package/pi-plugin/auto-mode/doc/architecture.md)
    and the [implemented compact design](../../package/pi-plugin/auto-mode/doc/compact-review-design.md).
    Each major responsibility links to its callers, invariants, alternatives, and verification.
2.  Select a coherent error cluster from the measured error index.
    Native phase fixtures contain 25 errors;
    the shared dispatcher and phase callbacks are separate clusters.
    The linter rule source and actual borrowed API determine a valid restructuring.
3.  After a coherent change, the package type check and affected consumer tests establish preservation.
    Execution changes also need a native build before their consumer tests.
4.  Completion requires a fresh full-package lint result with zero errors and warnings,
    passing type checking and affected native tests,
    and a report of commits and exercised boundaries.

The configured commands are:

```sh
# Repository: package/pi-plugin/auto-mode/mise.toml
mise run //package/pi-plugin/auto-mode:lint:oxlint
mise run //package/pi-plugin/auto-mode:lint:types
mise run //package/pi-plugin/auto-mode:build
mise run //package/pi-plugin/auto-mode:test:unit
mise run //package/pi-plugin/auto-mode:test:native:phases
mise run //package/pi-plugin/auto-mode:test:native:decision-fallback
mise run //package/pi-plugin/auto-mode:test:native:execution
```

The lint task already bounds Node and Go workers.
Verification uses disposable state and the repository's resource limits.
An explicit filename subset supports local iteration;
the no-argument lint command is the completion measurement.
Rule severity and coverage remain unchanged.

## Verified behavior to preserve

The native build is `native-release-qWSxFz`.
Both direct and child groups use Pi's actual preparation, execution, and finalization bodies.
The same prepared group owns automatic review, manual confirmation, membership, and execution maps.
Native slots expose phase retention; the retired `invokeProgramNative` API and whole-call adapters are absent.
Restoring them to satisfy fixture typing would restore removed architecture.

The full units and type check pass.
The native lifecycle catalog passes all 22 modes,
including actual child preparation, hidden-property rejection, hook blocking, and cancellation.
The 24 fallback cases and native execution catalogs pass.
Logger destination tests and the full logger unit suite also pass.

The final configured replay `pi-hyper-rpc-allow-nTpk0q` completes all 16 original calls,
including both reported groups and intermediate process output,
with zero selectors and 17 actual live-Luna requests.
The actual transmitted requests pass positive-controlled payload inspection:
raw structured commands, thinking, and signatures are absent.
The prohibition replay `pi-hyper-rpc-allow-gSMsqH` withholds both process/Bash members
with zero selectors and three actual Luna responses.
The private replay retains configured extensions, skills, tool catalogs, and preceding turns.

The process-local denial mutation removes both independent disposition barriers.
The real native test then executes three harmless fixture commands and fails with `3 !== 0`.
Production file hashes remain unchanged.
Private replay and mutation tasks live in the investigation scratch `mise.toml`.

Luna remains `openai/gpt-6-luna-decisions` with cutoff `0.60`.
Assessments retain three sequential bundles of up to three parallel calls,
at most 200 questions per call, and the existing eligible one-retry allowance.
Fifteen seconds remains advisory.
Clause, heading, unit, and whole-operation fallback semantics remain distinct.
Source identity, exact membership, tool freshness, cancellation, callbacks, event ordering,
scoped Allow/Stop, headless withholding, the fixed program guard, and issued-work drain remain required.

The root `TCV` rule is unchanged by the user's decision.
The package-local [review-input lesson](../../package/pi-plugin/auto-mode/native/review-input-verification.md)
records actual provider-payload verification.

## Storage and adjacent change

The package measures about 22.9 MB including the active 8.21 MB native output and a verified rollback.
The measurement excludes shared dependency symlink targets.
The source inventory still contains 65,692 parser-counted code lines including 28,596 verification lines.
The user explicitly did not adopt 13k as a line target.

Historical logs are losslessly archived outside the package.
Maintenance removes 43 inactive release copies after consumer checks.
New package tasks route logs through the existing shared logger using `MONOCHROMATIC_LOG_DIRECTORY`.
The logger's optional directory API and its destination fixtures are the adjacent change in
`package/module/logger`; they have passing build, unit, and type checks.
Automatic release eviction and log retention are not implemented.

The [current frontier](pi-auto-mode-current-frontier.md) retains incident evidence,
commits, failed experiments, and historical measurements.
The original second group's discarded transport cause remains unknown.
Desktop `notify-send` termination is a separate incident.
