# Vmsync lifecycle task resolves its mvm command from the wrong directory

## Symptom

At immutable source `ef01490f5e960f8ca0b424c12242caeb3c5a2b5e`,
Depot run `99tl7zjfgp` built the vmsync bundle successfully,
then ran `mise run //package/cli/vmsync:test:e2e`.
Node reported `MODULE_NOT_FOUND` for a path ending in:

```text
source/package/cli/vmsync/package/cli/mvm/src/cli.ts
```

The failure precedes VM creation and the lifecycle assertions.
KVM availability cannot repair that relative path.

## Root cause

`package/cli/vmsync/mise.toml:42` launches the source test from the package's task directory:

```toml
# package/cli/vmsync/mise.toml at ef01490f5e
[tasks.'test:e2e']
description = "Run vmsync VM lifecycle tests (creates VMs, requires KVM)"
depends = ["build:js:node"]
run = "node src/lifecycle.expensive.unit.test.ts"
```

`package/cli/vmsync/src/lifecycle.expensive.unit.test.ts:36` defines a root-relative command argument:

```typescript
// package/cli/vmsync/src/lifecycle.expensive.unit.test.ts:36 at ef01490f5e
const MVM_ARGS = ['package/cli/mvm/src/cli.ts',];
```

The `nanoSpawn` call at line 75 passes a timeout and no working directory override.
The resulting path in Node's error directly establishes the incompatible resolution boundary.
The main worktree still contained these same relative command arguments when inspected on 2026-10-16.

## Verification and proposed repair

The cloud log retains the exact package-task failure after a successful build.
The same run successfully invoked the actual `mvm` source entry point by absolute path with `--help`.
That is a command-resolution positive control,
not a passing lifecycle suite.

The trial VM adapter preserves the original task result,
then attempts the unchanged test source from the repository root after guest prerequisites are prepared.
It never allows that supplementary experiment to turn an original task failure into success.
Guest preparation remains pending.

A production repair should derive the `mvm` entry point from an owned absolute source location
or set an explicit repository-root command directory.
That change is not part of the historical-source measurement.
Verification must exercise both Linux and Windows lifecycle assertions in disposable guests,
and cleanup must run even when guest setup fails.

## What does not work

- Installing libvirt or enabling KVM does not change Node's command path resolution.
- Treating a successful vmsync build as lifecycle-test coverage misses the failed invocation.
- Running the fixture against the user's existing libvirt session risks its fixed test domain names.

## Upstream filing decision

1.  This is a repository test-path defect,
    not a demonstrated Node or mise defect.
2.  The repository can derive an absolute entry point.
3.  The documented package task is the affected supported invocation.
4.  External contribution policy is inapplicable to a local-source finding.
5.  The observed impact is failure before VM assertions execute.
6.  The cloud failure and absolute-path help control are retained;
    full lifecycle recovery is not established.

The repository title search for `vmsync` found existing naming and refactoring issues,
but no duplicate of this working-directory failure.
No external upstream filing or draft is warranted.
