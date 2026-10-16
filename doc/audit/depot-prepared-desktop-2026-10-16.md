# Prepared Depot desktop runtime experiment

## Scope and current state

This experiment combines installed-package reuse with fresh desktop runtime services
and the existing seven-session interaction suite.
It runs on the isolated `trial/depot-prepared-desktop-20261016` branch,
starting from the verified trial source `d6deca5fa5`.
Production workflows and subscription settings are unchanged.
The experiment is in progress;
the initial runtime probe is [Depot run `bm8l40jmnp`](https://depot.dev/orgs/l4zncjjbj5/workflows/bm8l40jmnp).

The earlier [package snapshot experiment](depot-expanded-cost-2026-10-15.md)
verified the installed versions of 23 packages and ImageMagick in separate fresh consumers,
but the consumers lacked the user-session manager and audio services needed by the interaction harness.
The separate [GitHub runner verification](../troubleshooting/slint-nested-color-scheme-portal.md)
passed 117 interaction checks with no failures and one not-injectable case.
Neither result alone proves that the prepared Depot CI route can run the complete suite.

## Runtime boundary under test

The actual harness launches each compositor and player inside a transient systemd user unit,
identifies the player through that unit's cgroup,
and stops the unit during cleanup.
The relevant source is
`package/music-player/desktop-e2e/src/session.ts`
and `package/music-player/desktop-e2e/src/session-launch.ts`
at trial revision `d6deca5fa5`.
Replacing those operations with unrelated process launches would change the tested isolation boundary.

[Depot's custom-image documentation](https://depot.dev/docs/ci/how-to-guides/custom-images)
states that snapshots retain filesystem contents,
while each consumer starts with a fresh process environment.
It also documents preserving installed packages and pre-pulled container images.
Consequently this experiment checks installed files separately from live service readiness.

## Source audit

Upstream systemd tag `v255`,
commit `db11bab38ccf1ed257f310d29070843d4c58ea01`,
rejects a user-manager startup when `sd_booted()` reports that the host was not booted with systemd.
This is a source finding,
not yet a claim about the exact installed version in the Depot consumer.
[Systemd `src/core/main.c`](https://github.com/systemd/systemd/blob/v255/src/core/main.c#L2650)
contains:

```c
// systemd v255, src/core/main.c:2651
if (arg_action == ACTION_RUN &&
    sd_booted() <= 0)
        return log_error_errno(SYNTHETIC_ERRNO(EOPNOTSUPP),
                               "Trying to run as user instance, but the system has not been booted with systemd.");
```

The [systemd container interface](https://systemd.io/CONTAINER_INTERFACE/)
describes running systemd as a container's PID 1 with the appropriate private mounts,
namespace boundaries,
and delegated cgroup hierarchy.
The runtime probe checks the actual snapshot's namespace support and available container tools
before attempting that route.
No host-runtime marker is fabricated to bypass `sd_booted()`.

## Evidence collection

The committed probe in
`.depot/workflows/depot-prepared-desktop.yml`
uses the existing `monochromatic-trial-desktop-packages:20261016-v1` image
with a 2-CPU,
8-GB sandbox and a three-minute job limit.
It installs no packages.
Its task records PID 1,
the systemd version,
cgroup mounts,
bounded namespace probes,
and available container or virtual-machine tools.
It prints selected runtime facts rather than the process environment or credentials.

Run it from the pushed experiment branch with:

```sh
# trial/depot-prepared-desktop-20261016
depot ci run --workflow .depot/workflows/depot-prepared-desktop.yml
```

The branch is pushed before each run so that Depot does not inject a local patch
into a repository already preserved in the snapshot.
The [existing patch-collision incident](../troubleshooting/depot-snapshot-mise-cache.md)
records why that distinction matters.

## Remaining verification

- Match the installed systemd version to the deciding source.
- Establish a real fresh session manager and private audio services without reinstalling the desktop packages.
- Execute all seven sessions in separate fresh consumers and retain their individual results.
- Verify package manifests,
  consumer isolation,
  audio isolation,
  and process cleanup independently of the interaction assertions.
- Record any new observed problem on the repository tracker after checking existing issues,
  including [issue 997](https://github.com/Aquaticats/Monochromatic/issues/997)
  and [issue 998](https://github.com/Aquaticats/Monochromatic/issues/998).
