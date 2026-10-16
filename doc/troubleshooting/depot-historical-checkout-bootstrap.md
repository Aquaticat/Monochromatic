# Historical checkout and host preparation fail before Depot checks

## Scope

These incidents affect the isolated affected-CI harness,
not a proposed production migration.
The TOML source is `525d2e09f8168a3bdd7e513e26d4c80b363123e5`.
The native source is `cb95cf6d785c3073c192b95f0632cdae7b910894`.
Both use mise action version `2026.10.9` and separate harness/source checkouts.

## Missing historical JavaScript entry

### Symptom and source

Run `zn4q03mh59` failed before selected checks with Node's `MODULE_NOT_FOUND`
for `source/node_modules/@monochromatic-dev/git-policy-cli/dist/final/node/index.mjs`.

At the TOML revision, `package/git-policy/cli/package.json:17` declares:

```json
// package/git-policy/cli/package.json at 525d2e09f8
"bin": {
  "git": "dist/final/node/index.mjs"
}
```

Frozen dependency installation creates the workspace executable link;
it does not build the linked package's missing output.
The executor's initial Git identity read therefore starts a missing program.

### Verified correction

The harness runs the existing `//package/git-policy/cli:build` task before Git commands.
It then uses the historical `git cli-git trust --yes` command for the reviewed TypeScript policy.
Run `hgqj2nstwq` reached all selected core checks after this preparation.
The package build and policy trust are setup costs, not TOML test coverage.

## Native revision needs its published policy tool

### Symptom and source

Run `5tbb7qftkw` copied the TOML bootstrap into the newer native case.
Both core and Android jobs stopped at:

```text
error: no matching package named `ignore` found
location searched: crates.io index
required by package `monochromatic-git-policy-cli v0.1.2`
```

At the native revision, `package/git-policy/cli/mise.toml` defines its build as:

```toml
# package/git-policy/cli/mise.toml at cb95cf6d78
[tasks.build]
run = "cargo build --release --locked --offline --bin cli-git-native"
```

The native package's `package.json` has no executable mapping.
The source `mise.no-env.toml:129` instead installs `cargo:monochromatic-git-policy-cli`
and links its `cli-git-native` binary as `.cache/cli-git-bin/git`.
The source `package/git-policy/cli/README.md:135` says the trust commands are retired:

```text
The former `trust`,
 `untrust` and `status` commands are retired.
Configuration is data,
 so nothing needs approval.
```

The old assumption that every historical checkout needed the JavaScript wrapper build was wrong.
This checkout requires its locked published native executable.
An unrelated offline build adds a Cargo-cache requirement absent from the intended native case.

### Correction under verification

Harness commit `a24cfd43a7` installs the source lock's published policy version,
creates the authored per-checkout executable link,
and runs real Git version/help commands before selected checks.
It omits the unrelated wrapper source build and retired trust command.
Runs `j80v9dqfb4` and `xg3znh2j0p` exercise this correction.
The desktop attempt passed this setup and reached its separate Clang host probe.

Installing Rust and `cargo-binstall` precedes dependent Cargo tools;
see [Cargo backend prerequisites](mise-cargo-backend-needs-rust-installed.md).

## Immutable lockfile and policy-fixture boundaries

Earlier attempts `zgsc58pmfc` and `zxdc83cpbp` failed the executor's
`mise.lock changed during setup` assertion or the historical policy's `config-untrusted` guard.
The exact source input comparison prevented those attempts being counted as valid check runs.

Source commands now use `MISE_LOCKED=1`.
Tool installation occurs outside source using explicit versions read from its lockfile.
The action's implicit environment activation is disabled using `env: false`
and `export_path: false`; each task activates its own configured environment.
The complete lockfile rewrite has not yet been retained as a diff,
so its individual metadata changes remain unclassified.

The generated-file fixture is outside the original trusted checkout's directory.
It therefore requires its own explicit trust operation after building the historical wrapper.
Trusting only the source root does not establish trust for a sibling fixture.
See [historical trust snapshots](cli-git-trusted-snapshot-stale-policy-code.md).

## Generated-file fixture tries an obsolete LFS endpoint

Run `d1jgjp62lg`, attempt `3xh4qrphll`, failed during `git worktree add`:

```text
Error downloading object: package-deprecated/audit/oph-common-look-and-feel/screenshot/contact-page.png
lookup monochromatic-lfs.an1298.workers.dev on 8.8.8.8:53: no such host
fatal: ... smudge filter lfs failed
```

No generator consistency result was produced.
The initial action checkout retains LFS pointers,
but the later worktree checkout invoked the globally configured smudge filter.
The fixture must retain the same pointer representation as its source checkout.
Commit `43c0fb4e8f` sets `GIT_LFS_SKIP_SMUDGE=1` for that fixture operation.
`git lfs help smudge` documents that variable as disabling smudging.
This preserves pointer files and does not validate the archived image payloads.
The generator task does not select those archived screenshots as its input surface.
The obsolete endpoint itself is a separate unresolved configuration problem.

## Local patch application fails before source setup

Feature run `mr9cw18gds` checked out harness base `0886b2669d`,
then Depot's injected patch step failed:

```text
error: patch failed: package/dev-script/task-util/mise.toml:140
error: package/dev-script/task-util/mise.toml: patch does not apply
```

The launch used local head `2288fcec22` and uploaded a 12579-byte patch
because the remote branch still pointed at the older base.
The log identifies the checkout and patch failure;
it does not establish why the hunk failed.
No historical source check executed.
The next dispatch explicitly waits for `git push` to finish and verifies a zero-patch launch.
This avoids this patch transport boundary without changing source inputs.
The first replay remains under verification.

## Slint executable lacks a runtime library

Native desktop run `w6ln4j09fz` passed the product build, Clippy, and 1406 nextest cases.
Its Slint check failed at executable loading:

```text
slint-viewer: error while loading shared libraries: libinput.so.10: cannot open shared object file: No such file or directory
```

The prepared Ubuntu image lacked that runtime dependency.
The next host preparation installs Ubuntu's `libinput10` package and invokes
the source-selected `slint-viewer --version` before package checks.
The dependency correction is under live verification.

## Desktop control requests lose standard input

The same run started its private systemd user manager and PipeWire server.
Its first control-socket attempts failed before the socket existed;
later attempts exited zero with empty output.
The harness finally emitted `Parent compositor must publish a real Wayland display before E2E starts`.
No authored desktop runtime session executed.
Container removal and overlay isolation checks passed.

The wrapper supplied Node's subprocess `input`,
but invoked `podman exec` without its interactive standard-input flag.
The reviewed wrapper now uses `podman exec --interactive` whenever input is supplied.
A `cat` positive control must echo the exact payload before compositor queries run.
The complete desktop replay is under verification;
the empty output is not evidence that the compositor cannot publish a display.

## Verification catalog

- Passed: historical JavaScript wrapper build and policy trust before TOML core execution.
- Passed: published native wrapper installation and source tool gate before the desktop host probe.
- Failed: Git reads immediately after dependency linking at the older JavaScript-wrapper revision.
- Failed: inherited offline native-wrapper source build without its registry cache.
- Failed: generated worktree checkout with default LFS smudging against the obsolete endpoint.
- Pending: generated consistency after pointer-preserving checkout and fixture-local policy trust.

Do not disable policy guards,
change historical source inputs,
or hand-edit the lockfile to make these setup assertions pass.

## Upstream filing decision

These are repository harness and historical configuration boundaries.
No third-party defect has been established.
The upstream-fault criterion therefore fails;
fixability and supported-use-case criteria do not establish responsibility.
External contribution-policy and comparable-issue reviews are not grounds to file without a defect.
No external filing or prototype is proposed.
Owned issue tracking retains the separate incidents and provider costs.

## Related evidence

- [Executor queue and run ledger](../handover/depot-affected-ci-executor.md).
- [Shallow checkout ancestry failure](cargo-publish-shallow-before-sha.md).
- [Expanded coverage issue](https://github.com/Aquaticats/Monochromatic/issues/1030).
