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

## Application, harness, and runner findings

- [#1002](https://github.com/Aquaticats/Monochromatic/issues/1002):
  Android instrumentation: SessionStoreTest uses a context with null applicationContext.
- [#1003](https://github.com/Aquaticats/Monochromatic/issues/1003):
  Android instrumentation can skip decoder and playback coverage when indexed audio fixtures are absent.
- [#1004](https://github.com/Aquaticats/Monochromatic/issues/1004):
  Desktop E2E: folder chooser never appears on the prepared Depot software-rendered runner.
- [#1005](https://github.com/Aquaticats/Monochromatic/issues/1005):
  Desktop E2E: fixed-coordinate folder selection aborts the thirty-track fallback fixture.
- [#1006](https://github.com/Aquaticats/Monochromatic/issues/1006):
  Desktop E2E: an aborted session prevents later independent sessions from reporting coverage.
- [#1007](https://github.com/Aquaticats/Monochromatic/issues/1007):
  Desktop E2E: nested parent compositor route fails pointer and text checks in the cloud trial.
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

## Remaining filing work

Release transfer,
quota diagnostics,
scheduling accounting,
completed-job logs,
and expanded coverage issues are being filed separately.
Their verified links will be added to this inventory.

## Verification

The application and harness issue bodies were rendered before submission.
Each created issue was fetched again and its title,
body,
and open state matched the prepared content.
The package-reuse and account issues were independently fetched and checked for their bodies and triage labels.
The [trial report](../audit/depot-trial-2026-10-15.md)
and [coverage proposal](../planning/depot-expanded-coverage.md)
retain the measurement and adoption boundaries.
