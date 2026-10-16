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

The final repository query returned 46 newly filed issues:
37 open and nine closed with recovery evidence.
Existing issues were reused for six additional discovery or process findings.
These counts describe the filing result,
not completed integration of the trial-only corrections.

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

## Verification

The application and harness issue bodies were rendered before submission.
Each created issue was fetched again and its title,
body,
and open state matched the prepared content.
The package-reuse and account issues were independently fetched and checked for their bodies and triage labels.
The [trial report](../audit/depot-trial-2026-10-15.md)
and [coverage proposal](../planning/depot-expanded-coverage.md)
retain the measurement and adoption boundaries.
