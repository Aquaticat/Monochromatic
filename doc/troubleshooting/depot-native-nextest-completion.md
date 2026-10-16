# Depot native tests with nextest 0.9.148 stop before complete coverage

## Symptom

Historical native replay `38842787230` reached macOS tests but reported:

```text
Summary [  24.953s] 55/1382 tests run: 54 passed, 1 failed, 1 skipped
```

Desktop replay `38843527788` similarly reported:

```text
Summary [  60.000s] 1020/1433 tests run: 1017 passed, 3 failed, 1 skipped
```

These are terminal failed commands with incomplete test execution.
They cannot establish every required test's outcome.
The distinct application failures remain in issues `#1062` through `#1065`.

## Root cause

The historical `package/music-player/desktop-app/mise.toml:166` task invokes:

```javascript
// package/music-player/desktop-app/mise.toml, historical source cb95cf6d78
runCargo(['nextest', 'run'])
```

Nextest release `cargo-nextest-0.9.148`,
source commit `cd1d6d5467322dbc0d39a80cb671d000ac302798`,
sets `fail-fast = true` in `nextest-runner/default-config.toml:58`.
The [current running-tests documentation](https://nexte.st/docs/running/#failing-fast)
confirms that the default stops scheduling new tests after failure.
The already running tests finish.

`cargo-nextest/src/dispatch/core/run.rs:261` applies the explicit override:

```rust
// nextest, cargo-nextest/src/dispatch/core/run.rs:261 at cargo-nextest-0.9.148
} else if self.no_fail_fast {
    builder.set_max_fail(MaxFail::from_fail_fast(false));
```

This is documented upstream behavior and a trial harness coverage omission.
The workflow matrix's `fail-fast: false` controls independent jobs;
it does not configure nextest inside a job.

## Verification

The retained failing catalog comprises the two macOS runs named in Symptom.
Windows native source `cb95cf6d78` failed test compilation before enumeration,
which is a different boundary tracked in issue `#1061`.

Trial commit `32a9250add` provides
`//package/dev-script/task-util:trial:depot:native:nextest`
on branch `trial/depot-complete-scanner-20261016`.
It reads the selected historical task through `mise tasks info --json`,
reads its dispatcher through `mise config get`,
asserts that both replacement anchors occur exactly once,
and adds `--no-fail-fast` in memory.
It retains hashes of the original and adapted bodies.
The source checkout stays unchanged.

A disposable package control passed through the actual adapter.
Its dispatcher asserted the exact nextest arguments,
the package's environment variable,
and `SLINT_EMIT_DEBUG_INFO=1`.
The native recovery runs are `38847322477` and `38847322559`;
their full-suite results remain pending at this documentation checkpoint.

## Verified workaround and tradeoff

The adapter's command and environment transformation passed the disposable control.
Actual historical native execution remains under verification.
The supported invocation is `cargo nextest run --no-fail-fast`.
This schedules remaining tests despite earlier failures and therefore can consume more runner time.
It preserves failing exit status and default concurrency.
It does not repair application assertions or make an uncompilable test binary runnable.

## What does not work

- Treating a failed command as proof that every test ran loses unscheduled cases.
- Disabling workflow matrix fail-fast leaves nextest's internal policy unchanged.
- Treating `NEXTEST_PROFILE=ci` as a universal built-in profile is unsupported;
  custom profiles require configuration.

## Separate Clippy prerequisite incident

The same native replay reported this rustup diagnostic before Clippy could inspect code:

```text
error: 'cargo-clippy' is not installed for the toolchain 'nightly-2026-10-13-x86_64-apple-darwin'.
```

Windows reported the corresponding `cargo-clippy.exe` and Windows toolchain name.
The harness had installed Rust and cargo-nextest but had no explicit Clippy component step.
This proves a missing prerequisite at the consumer boundary;
it does not establish which mise or rustup selection branch omitted the component.
The [rustup component documentation](https://rust-lang.github.io/rustup/concepts/components.html)
identifies Clippy as a toolchain component.

Harness `32a9250add` records installed components,
runs `rustup component add clippy --toolchain nightly-2026-10-13`,
records them again,
and requires `cargo clippy --version` before package lint.
The cloud recovery must cross that gate before this incident is closed.
Installing the component adds setup work;
it cannot turn source Clippy diagnostics into passing lint.

## Upstream filing decision

1.  Upstream fault is not established:
    nextest implements its documented default,
    and the trial omitted an explicit Clippy prerequisite check.
2.  A consumer-side configuration remedy exists.
3.  Nextest documents the required full-run option;
    rustup documents component installation.
4.  Contribution policy assessment is unnecessary because no upstream change is proposed.
5.  The observed impact is incomplete trial coverage and failed lint setup.
6.  The consumer adapter control passed;
    cloud recovery remains pending.

The upstream nextest title search for `fail-fast` returned issues `#1955` and `#3624`,
which concern beta override behavior and stress-run exit status respectively.
Neither is the observed default-policy omission.
No upstream filing or comment is warranted,
and there is no additive upstream draft.
Repository issue tracking remains required for the trial defects.
