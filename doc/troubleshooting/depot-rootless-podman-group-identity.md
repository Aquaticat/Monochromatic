# Depot snapshot runner with uidmap 4.13 rejects rootless Podman group identity

## Symptom

The existing `mise run prepare:playwright` task failed in the Depot browser experiment
before any browser test executed.
The [failed run][failed-run] used revision
`229182267dd5d2ff29eac6908e260b08040a617e`
and attempt `3fltxptw1z` on 2026-10-16.
Podman exited 125;
the task wrapper then exited 1.

The deciding diagnostic came from `newuidmap`:

```text
newuidmap: Target process 1678 is owned by a different user:
uid:1001 pw_uid:1001 st_uid:1001, gid:1001 pw_gid:117 st_gid:1001
```

The preceding Podman warning said `/` was not a shared mount.
That warning and the ownership rejection are separate diagnostics;
the successful rootful follow-up does not prove the warning harmless in every workload.

## Root cause and limits

The runner process had UID 1001 and GID 1001,
while its passwd entry named primary GID 117.
The separate [identity probe][control-run],
attempt `kfnj5n805m`,
confirmed those values:

```text
{"uid":1001,"gid":1001,"groups":[4,117,999,1001]}
runner:x:1001:117::/home/runner:/bin/bash
uidmap 1:4.13+dfsg1-4ubuntu3.2
```

`dpkg-query --show podman` produced a package name without a version.
The experiment therefore does not establish the Podman binary version.

The repository task in `mise.toml` invokes rootless `podman build`.
The observed invocation called `/usr/bin/newuidmap` to establish its user namespace.
The Shadow source clone at tag `4.13`,
commit `24b44b686ea2221405cfd806dede046cf1fd9584`,
contains the matching ownership check in `src/newuidmap.c:141`:

```c
/* src/newuidmap.c:141, upstream Shadow tag 4.13 */
if ((getuid() != pw->pw_uid) ||
    (!getdef_bool("GRANT_AUX_GROUP_SUBIDS") && (getgid() != pw->pw_gid)) ||
    (pw->pw_uid != st.st_uid) ||
    (getgid() != st.st_gid)) {
```

The branch at `src/newuidmap.c:145` emits the observed ownership diagnostic and returns failure.
The checked source is the upstream release corresponding to the installed package's base version;
the full Ubuntu patch series was not audited.
The observed values and matching diagnostic support a group-identity rejection.
They do not establish why the sandbox started with a different primary group,
or prove a Shadow or Podman defect.

The current Shadow source at
`e9bc595fd20558cf51aef096db262232090e8fb8`
retains the same decision at `src/newuidmap.c:132`.
No third-party source was modified.

## Verification

The failing catalog is:

- Rootless `mise run prepare:playwright` in the Node/dependency snapshot:
  the image preparation task failed with the identity diagnostic.
- Merely selecting the correct Playwright image version did not resolve that failure.
  The version mismatch is independently tracked by [issue #1045][image-issue].

The working catalog is:

- Rootful image preparation in [run `5f1hbcxtws`][rootful-run],
  attempt `0h9nf3dbv2`:
  succeeded and published `monochromatic-trial-browser:20261016-v1`.
- The consumer browser job used the prepared container and executed 69 cases.
  Its WebKit assertion failure is separate from container setup.
- The DOM consumer in [run `zlhbx5k5rq`][control-run],
  attempt `106fpb437j`:
  passed 34 existing browser cases.

The [execution audit](../audit/depot-expanded-execution-2026-10-16.md)
and its evidence file retain job durations,
resource samples,
test cases,
and the deliberately failing browser control.

## Verified workaround

The isolated trial changed both the image probe/build and container-run boundary
from `podman` to `sudo --non-interactive podman`.
The committed patch is `c7906236c3c2c744dd79f616952a84fadd24b81c`
on branch `trial/depot-expanded-20261016`.

```text
# Isolated trial command boundary, not a workstation account change
podman build ...
  becomes sudo --non-interactive podman build ...
podman run ...
  becomes sudo --non-interactive podman run ...
```

Both preparation and consumption must use the same container storage owner.
The workaround uses root-owned container storage and can create root-owned files in the mounted checkout.
It was verified only in disposable Depot sandboxes bounded at 4 CPUs and 16 GiB RAM.
It is not a production rollout or a recommendation to change workstation account ownership.
The repository issue is [#1047][local-issue].

## What does not work

The unmodified rootless task fails in the measured sandbox identity.
Correcting the browser image version alone does not correct process identity.
Treating a later browser assertion failure as evidence that container preparation still failed
would conflate distinct boundaries.

Changing the runner account,
using an alternate login group,
and changing `GRANT_AUX_GROUP_SUBIDS` were not tested.
No claim is made about those alternatives.

## Upstream filing decision

No applicable exemption was found among the repository's `.out-of-scope/` entries.
Searches covered Shadow issues for `newuidmap` plus `different user`,
Shadow pull requests for `newuidmap` plus `group`,
and Podman issues for `pw_gid`.
The Podman results concerned different container networking or lifecycle boundaries;
they do not establish an exact duplicate or an upstream cause for this sandbox identity.

1.  Upstream fault:
    not established.
    The observed process and passwd primary groups differ,
    and the ownership guard rejects that mismatch.
2.  Fixability:
    the execution environment or consumer invocation can change;
    removing the ownership check is not justified by this evidence.
3.  Supported use:
    `man/newuidmap.1.xml:109` documents caller ownership validation.
    This investigation does not establish support for the mismatched sandbox identity.
4.  Contribution policy:
    Shadow's `doc/contributions/introduction.md` points to `doc/contributions/ai.txt`.
    That file prohibits contributions created with nontrivial AI assistance.
    No Shadow filing is prepared.
5.  Likely acceptance:
    no request to weaken this ownership guard is supported by the measured failure.
6.  Prototype:
    no upstream code prototype was made because upstream fault is unestablished
    and the contribution policy excludes this contribution.
    The consumer-side invocation was tested in the isolated trial.

There is nothing to file upstream from this evidence.
The actionable repository integration gap is preserved in [issue #1047][local-issue].

[failed-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/t3jdjq2nd3
[rootful-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/5f1hbcxtws
[control-run]: https://depot.dev/orgs/l4zncjjbj5/workflows/zlhbx5k5rq
[image-issue]: https://github.com/Aquaticats/Monochromatic/issues/1045
[local-issue]: https://github.com/Aquaticats/Monochromatic/issues/1047
