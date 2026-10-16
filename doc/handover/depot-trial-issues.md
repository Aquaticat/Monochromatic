# Depot trial issue inventory

## Purpose and filing boundary

The user requested a GitHub issue for every problem discovered during this trial.
This inventory links each distinct finding to its current-repository issue.
Existing open and closed issues were searched before filing.
Observed failures are distinguished from unknown causes,
coverage gaps,
and unverified policy boundaries.
Trial-only workarounds remain open where integration or diagnosis is outstanding.
No upstream issue or support message was sent.

The first completed-batch repository query returned 50 newly filed issues:
41 open and nine closed with recovery evidence.
Existing issues were reused for six additional discovery or process findings.
These counts describe the filing result,
not completed integration of the trial-only corrections.
The completed resumed experiments add 12 issues,
including four closed after verified trial corrections.
The aggregate repository query now returns 62 newly filed issues:
49 open and 13 closed,
with the six reused issues remaining separate.

## Application, harness, and runner findings

- [#1002](https://github.com/Aquaticats/Monochromatic/issues/1002):
  Android instrumentation:
  SessionStoreTest uses a context with null applicationContext.
- [#1003](https://github.com/Aquaticats/Monochromatic/issues/1003):
  Android instrumentation can skip decoder and playback coverage when indexed audio fixtures are absent.
- [#1004](https://github.com/Aquaticats/Monochromatic/issues/1004):
  Desktop E2E:
  folder chooser never appears on the prepared Depot software-rendered runner.
- [#1005](https://github.com/Aquaticats/Monochromatic/issues/1005):
  Desktop E2E:
  fixed-coordinate folder selection aborts the thirty-track fallback fixture.
- [#1006](https://github.com/Aquaticats/Monochromatic/issues/1006):
  Desktop E2E:
  an aborted session prevents later independent sessions from reporting coverage.
- [#1007](https://github.com/Aquaticats/Monochromatic/issues/1007):
  Desktop E2E:
  nested parent compositor route fails pointer and text checks in the cloud trial.
- [#1008](https://github.com/Aquaticats/Monochromatic/issues/1008):
  Depot trial Cargo caches can return stale binaries after older source layers are restored.
- [#1009](https://github.com/Aquaticats/Monochromatic/issues/1009):
  Depot runner loses communication before recording any build steps.
- [#1010](https://github.com/Aquaticats/Monochromatic/issues/1010):
  Desktop chooser errors are hidden by the unbridged log facade and discarded Zenity stderr.
- [#1011](https://github.com/Aquaticats/Monochromatic/issues/1011):
  Trial mise setup warns that the cmake vfox plugin metadata module is missing.
- [#1012](https://github.com/Aquaticats/Monochromatic/issues/1012):
  Trial runtime installation reports the pipx-slopo lock sidecar missing.

## Package reuse and account observability

- [#995](https://github.com/Aquaticats/Monochromatic/issues/995):
  snapshot checkout collides with the CLI's injected local patch.
- [#996](https://github.com/Aquaticats/Monochromatic/issues/996):
  redundant mise cache restoration delays a prepared-image consumer.
- [#997](https://github.com/Aquaticats/Monochromatic/issues/997):
  fresh Depot CI consumers lack the user session required by desktop tests.
- [#998](https://github.com/Aquaticats/Monochromatic/issues/998):
  integrate verified installed-package reuse into an adopted desktop route.
- [#999](https://github.com/Aquaticats/Monochromatic/issues/999):
  the existing CLI credential cannot query the account usage endpoint.
- [#1000](https://github.com/Aquaticats/Monochromatic/issues/1000):
  verify aggregate spending control beyond separate product start limits.
- [#1001](https://github.com/Aquaticats/Monochromatic/issues/1001):
  reconcile storage scopes and documented cache-policy limits.

## Release transfer and scheduling

- [#1013](https://github.com/Aquaticats/Monochromatic/issues/1013):
  public release download depended on exhausted authenticated REST quota;
  closed with the verified consumer repair.
- [#1014](https://github.com/Aquaticats/Monochromatic/issues/1014):
  GitHub CLI masks the quota error as a missing release.
- [#1015](https://github.com/Aquaticats/Monochromatic/issues/1015):
  transferred release provenance is missing from the repository endpoint;
  closed with the verified original-identity bundle consumer repair.
- [#1016](https://github.com/Aquaticats/Monochromatic/issues/1016):
  Cargo metadata used the previous repository owner;
  closed with the generator and managed-manifest correction.
- [#1017](https://github.com/Aquaticats/Monochromatic/issues/1017):
  Scorecard history amplified REST usage;
  closed after production GraphQL verification.
- [#1018](https://github.com/Aquaticats/Monochromatic/issues/1018):
  Scorecard admission has no reservation before analysis starts.
- [#1019](https://github.com/Aquaticats/Monochromatic/issues/1019):
  Scorecard budget accounting uses workflow creation time.
- [#1020](https://github.com/Aquaticats/Monochromatic/issues/1020):
  cancellation can refund already-started analysis in the existing accounting.
- [#1021](https://github.com/Aquaticats/Monochromatic/issues/1021):
  latest-attempt history does not retain all attempted analysis work.
- [#1022](https://github.com/Aquaticats/Monochromatic/issues/1022):
  the GitHub CLI run-log route rejects completed-job logs while siblings run.
- [#1031](https://github.com/Aquaticats/Monochromatic/issues/1031):
  published scanner version 0.5.0 omits the binstall release-tag template;
  explicit download-layout dry runs succeed while registry-default dry runs fail.

The accounting issues describe source and fixture evidence;
they do not assert an observed live budget overrun.

## Repository publication

- [#1032](https://github.com/Aquaticats/Monochromatic/issues/1032):
  GitHub rejects an ordinary signed-commit push with `GH006` and no named requirement.
  Concurrent publication delivered the commit without a protection or history change;
  the server-side cause remains unknown.

## Expanded coverage and routing

- [#1023](https://github.com/Aquaticats/Monochromatic/issues/1023):
  native verification routes are absent from routine orchestration.
- [#1024](https://github.com/Aquaticats/Monochromatic/issues/1024):
  Android host,
  lint,
  and ABI checks need explicit routing.
- [#1025](https://github.com/Aquaticats/Monochromatic/issues/1025):
  existing browser suites need CI execution.
- [#1026](https://github.com/Aquaticats/Monochromatic/issues/1026):
  the `done` application lacks selected browser user-flow coverage.
- [#1027](https://github.com/Aquaticats/Monochromatic/issues/1027):
  affected-consumer selection needs transitive workspace dependencies.
- [#1028](https://github.com/Aquaticats/Monochromatic/issues/1028):
  a workflow filter still names the removed ownership package.
- [#1029](https://github.com/Aquaticats/Monochromatic/issues/1029):
  shared lockfile and toolchain changes are missing from selected workflow triggers.
- [#1030](https://github.com/Aquaticats/Monochromatic/issues/1030):
  remaining expanded workloads lack measured costs and an allocation policy.

Existing discovery issues #305,
#555,
#310,
and #603 were reused instead of duplicated.
The [coverage issue handover](depot-coverage-issues-2026-10-15.md) records those matches.

## Historical setup and access incidents

- [#1033](https://github.com/Aquaticats/Monochromatic/issues/1033):
  organization action policy rejected workflow startup;
  closed after the user's policy choice and verified startup recovery.
- [#1034](https://github.com/Aquaticats/Monochromatic/issues/1034):
  mise release discovery failed with HTTP 403 during setup.
- [#1035](https://github.com/Aquaticats/Monochromatic/issues/1035):
  the local worker task ceiling interrupted trial collection;
  closed with the user's recovery and measured replacement limit.
- [#1036](https://github.com/Aquaticats/Monochromatic/issues/1036):
  a local helper/kernel update mismatch prevented execution;
  closed with verified recovery.
- [#1037](https://github.com/Aquaticats/Monochromatic/issues/1037):
  the trial task was outside mise discovery roots;
  closed after relocating it and running the discovered task.
- [#1038](https://github.com/Aquaticats/Monochromatic/issues/1038):
  the direct desktop trial omitted the compositor path;
  closed with the corrected execution.
- [#1039](https://github.com/Aquaticats/Monochromatic/issues/1039):
  standalone SDK command execution failed to resolve bare command names.
- [#1040](https://github.com/Aquaticats/Monochromatic/issues/1040):
  Browser discovery returned no available browser for account inspection.

Existing process issues #425 and #572 cover asking measurable interview questions
and under-scoped completion or verification.
The final audit reused those instead of creating duplicates.

## Warnings exposed by successful chooser verification

- [#1041](https://github.com/Aquaticats/Monochromatic/issues/1041):
  the private desktop session does not provide the accessibility bus requested by GTK.
- [#1042](https://github.com/Aquaticats/Monochromatic/issues/1042):
  GTK cannot commit dconf changes in the private desktop session.
- [#1043](https://github.com/Aquaticats/Monochromatic/issues/1043):
  the folder dialog maps without a transient parent.
- [#1044](https://github.com/Aquaticats/Monochromatic/issues/1044):
  held-modifier repeat remains outside interactive coverage;
  pure detector tests and ordinary held-key repeat controls do not exercise that input boundary.

These warnings were visible after the chooser recovered in run `38833901553`.
They did not fail that run's interaction assertions.
Issue #1004 retains the verified recovery and stays open for integration of the trial-only correction.

## Resumed execution and accounting

- [#1045](https://github.com/Aquaticats/Monochromatic/issues/1045):
  the Playwright container version differs from the locked test runner.
- [#1046](https://github.com/Aquaticats/Monochromatic/issues/1046):
  repeated same-key Depot Test uploads duplicate stored result rows.
- [#1047](https://github.com/Aquaticats/Monochromatic/issues/1047):
  browser execution needs a working Podman user mapping in Depot CI.
- [#1048](https://github.com/Aquaticats/Monochromatic/issues/1048):
  the initial skip fixture matched no compiled Rust test;
  closed after the corrected fixture reported the intended skip.
- [#1049](https://github.com/Aquaticats/Monochromatic/issues/1049):
  the split probe passed a run-only flag;
  closed after invoking the supported split interface successfully.
- [#1050](https://github.com/Aquaticats/Monochromatic/issues/1050):
  the Rust timing adapter omitted an integration-test binary identity;
  closed after every expected identity appeared exactly once across the final shards.
- [#1051](https://github.com/Aquaticats/Monochromatic/issues/1051):
  the Sandbox SDK client intermittently remains alive after completed remote commands.
  The bounded reproduction,
  later passing control,
  and unresolved source ownership are retained in the
  [client-lifecycle record](../troubleshooting/depot-sandbox-client-exit.md).
- [#1052](https://github.com/Aquaticats/Monochromatic/issues/1052):
  the browser suite needs to distinguish unavailable OPFS from a logger regression.
- [#1053](https://github.com/Aquaticats/Monochromatic/issues/1053):
  prepared desktop execution needs verified decode-priority requests and rtkit fallback.
- [#1054](https://github.com/Aquaticats/Monochromatic/issues/1054):
  the prepared desktop session lacks verified analysis notifications through the built player.
- [#1055](https://github.com/Aquaticats/Monochromatic/issues/1055):
  compositor EGL diagnostics do not identify the affected operation.
- [#1056](https://github.com/Aquaticats/Monochromatic/issues/1056):
  the first expanded-cost draft used the wrong Linux runner overage rate;
  closed after correcting the rate and independently verifying the revised replay.

The [Test report](../audit/depot-test-feature-2026-10-16.md),
[expanded execution report](../audit/depot-expanded-execution-2026-10-16.md),
and [prepared desktop report](../audit/depot-prepared-desktop-2026-10-16.md)
retain the corresponding probes and recovery boundaries.
Existing issues #997 and #998 retain the successful combined desktop evidence;
they remain open for production integration.

## Complete-graph replay findings

- [#1057](https://github.com/Aquaticats/Monochromatic/issues/1057):
  immutable-base ancestry assertions need the base object fetched into the trial checkout.
- [#1058](https://github.com/Aquaticats/Monochromatic/issues/1058):
  Scorecard image inspection collided with mise template rendering;
  closed after the corrected adapter and fixture controls passed.
- [#1059](https://github.com/Aquaticats/Monochromatic/issues/1059):
  native trial setup omitted the source-configured cargo-binstall prerequisite;
  closed after Windows and macOS setup recovery.
- [#1060](https://github.com/Aquaticats/Monochromatic/issues/1060):
  the historical Windows workflow required unsupported GUI PowerShell redirection and skipped nextest;
  closed with existing corrected-workflow evidence and the independent test replay.
- [#1061](https://github.com/Aquaticats/Monochromatic/issues/1061):
  historical Windows tests referenced a Unix-only libc CPU helper;
  closed with the existing source fix and later passing compilation.
- [#1062](https://github.com/Aquaticats/Monochromatic/issues/1062):
  historical macOS change-plan fixtures generated case-colliding names;
  closed with the existing source fix and later passing test.
- [#1063](https://github.com/Aquaticats/Monochromatic/issues/1063):
  macOS rename notifications use a canonical target path that differs from the fixture expectation.
- [#1064](https://github.com/Aquaticats/Monochromatic/issues/1064):
  macOS burst-write notifications differ in reported paths and structural flags.
- [#1065](https://github.com/Aquaticats/Monochromatic/issues/1065):
  macOS in-place-write notifications differ in reported path and structural flag.
- [#1066](https://github.com/Aquaticats/Monochromatic/issues/1066):
  full-package Oxlint panics in `no-generated-empty-object-type` at the selected TOML revision.
- [#1067](https://github.com/Aquaticats/Monochromatic/issues/1067):
  the TOML fuzz coverage gate reports fewer covered lines in `values.ts` than its retained baseline.
- [#1068](https://github.com/Aquaticats/Monochromatic/issues/1068):
  the file-enforcer mutation task resolves its repository-relative package path twice.
- [#1069](https://github.com/Aquaticats/Monochromatic/issues/1069):
  truepeak-core Clippy rejects the schema-version constant assertion.
- [#1070](https://github.com/Aquaticats/Monochromatic/issues/1070):
  file-enforcer container tests receive `SIGKILL` after a logger sink verification timeout.
- [#1071](https://github.com/Aquaticats/Monochromatic/issues/1071):
  historical generated-file worktree checkout references an unresolvable Git LFS endpoint.
- [#1072](https://github.com/Aquaticats/Monochromatic/issues/1072):
  native trial setup needs Clippy installed for the exact locked Rust toolchain.
- [#1073](https://github.com/Aquaticats/Monochromatic/issues/1073):
  fail-fast native replay leaves independent selected tests unexecuted after a source failure.
- [#1074](https://github.com/Aquaticats/Monochromatic/issues/1074):
  isolated VM preparation needs bounded libvirt and QEMU Unix socket paths.
- [#1075](https://github.com/Aquaticats/Monochromatic/issues/1075):
  the VM bootstrap assumed `XDG_RUNTIME_DIR` was already present.
- [#1076](https://github.com/Aquaticats/Monochromatic/issues/1076):
  the vmsync lifecycle package task resolves its mvm helper from the package working directory.

These findings preserve source,
harness,
and environment boundaries.
The macOS watch symptoms remain separate until a shared cause is verified.

## Pending final reconciliation

The totals in this handover predate the latest complete-graph replays.
After diagnostic filing settles,
query every explicit issue ID and reconcile the new issue records,
reused existing issues,
open states,
and closures before replacing the aggregate totals.
The native-source findings are recorded in issues #1061 and #1062 and closed as already fixed;
the separate macOS watch findings remain open in #1063,
#1064,
and #1065.
Root also added replay evidence to existing issue #1002;
that is not a newly created issue.

Accounting collection is complete for terminal Depot runs `79lgpx91sf`,
`lvcwx21cbt`,
`ssvlvk57k4`,
`1pfkxwlwbd`,
`g1nngvfsrg`,
`xz7cchwbsk`,
`4z014g290p`,
and `dxk4v3s0w3`.
Their retained records include allocation verification and every provider attempt.
Final source-case reconciliation still requires the corrected manifests and later recovery runs.
Pending collection includes VM replay `rv6hfj76w9`
and native recovery runs `38847322477` and `38847322559`.
Linux desktop nextest recovery `pbg4h8ww6k` also needs collection and independent full-suite reconciliation.
The [accounting audit](../audit/depot-complete-ci-accounting-2026-10-16.md)
owns the measurements and distinctions between execution completion and passing CI.

## Verification

The application and harness issue bodies were rendered before submission.
Each created issue was fetched again and its title,
body,
and open state matched the prepared content.
The package-reuse and account issues were independently fetched and checked for their bodies and triage labels.
The [trial report](../audit/depot-trial-2026-10-15.md)
and [coverage proposal](../planning/depot-expanded-coverage.md)
retain the measurement and adoption boundaries.
