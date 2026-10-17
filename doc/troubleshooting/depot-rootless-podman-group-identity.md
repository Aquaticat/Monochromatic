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
The [matching patch](depot-rootless-podman-group-identity.patch)
preserves the exact task changes.

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

## Mutation work tmpfs ownership on 2026-10-17

This is a separate boundary from the `newuidmap` rejection.
In logger development request `4x77lb56cs`,
the rootful mutation adapter mapped the source owner's numeric UID and GID with `--user`.
The source task then invoked `rsync --archive` against a root-owned `/work` tmpfs.
The retained mutation logs report:

```text
rsync: [generator] chgrp "/work/." failed: Operation not permitted (1)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)
```

The source copy failed before mutant assertions.
The affected checks include the mutation CLI integration,
`conf-fork` mutation and `make-asynchronous-fork` mutation tasks.
The later matcher mutation task reached the same error before its partition budget expired.

A mount-free local control used Podman `5.8.7`,
Alpine `3.22`,
2 CPUs,
2 GiB RAM,
64 PIDs,
no network,
a read-only root filesystem and `--cap-drop=ALL`.
With container user `1000:1000`,
`/work` reported owner `0:0` and `chgrp` failed with the measured permission error.
Adding `uid=1000,gid=1000` to `--tmpfs` did not work:
Podman exited 125 with `unknown mount option "uid=1000"`.
Harness commit `d8902dcf16` preserves that rejected development attempt;
it is superseded by `153d7bc98c`.

The positive control used rootful mappings
`--uidmap 0:1000:1 --gidmap 0:1000:1 --user 0:0`.
The process and tmpfs both reported container identity `0:0`,
and the ownership check passed with the same capability and resource restrictions.
The upstream Podman `v5.8.7` source file
`docs/source/markdown/options/uidmap.container.md`
documents direct host-to-container mappings for rootful callers.
This evidence supports the mapping mechanism;
it does not yet establish a passing Depot mutation consumer.

The corrected harness derives mapping IDs from the disposable runner process,
asserts tmpfs ownership in its existing private fixture,
and verifies that the host result file belongs to the source owner.
The local result did not predict the actual cloud result.
Request `1wzr86fssk` used Podman `5.8.4` and rejected that mapping before container execution:

```text
Error: cannot unmount /sys/kernel/debug: device or resource busy
```

All 37 retained job logs contain that diagnostic;
none reached the generic source executor.
This is a separate visible boundary from the original `rsync` ownership error.
The emitting diagnostic is Podman's output;
no narrower OCI-runtime attribution or upstream cause is established.

The replacement uses a uniquely named tmpfs volume with
`--opt type=tmpfs --opt device=tmpfs --opt nocopy`
and `--opt o=rw,exec,size=...,mode=1777,uid=...,gid=...`.
Podman's versioned `v5.8.4` volume-create documentation supports that mount-option form.
It keeps the source-owner nonroot UID, original resource and capability restrictions,
and readonly source mounts without a user-namespace mapping.
The original `/work` tmpfs size is retained.
Only the owned named volume replaces that mount;
the adapter removes its unique volume and verifies absence after the child exits.

Bounded local positive and negative controls passed.
The initial local volume test also required the same SELinux relabeling on both controls;
that local label denial is distinct from UID ownership and from the cloud mapping rejection.
Actual generated-boundary controls use the source's existing `label=disable` setting.
Cloud pilot `85fv28fjkl` passed the private-manifest denial and source-owner positive control,
with verified cleanup and no added capabilities.

## Baked pnpm metadata under the nonroot mutation adapter

The same pilot then reached the unchanged mutation CLI integration and exposed another boundary:

```text
rsync: [sender] send_files failed to open "/baked/node_modules/.pnpm-workspace-state-v1.json": Permission denied (13)
rsync error: some files/attrs were not transferred (see previous errors) (code 23)
```

The generated image metadata is owned by root with mode `0600`.
The authored image's default root identity can read it;
the trial adapter's source-owner UID cannot.
The failure happens before mutant assertions and is an adapter prerequisite gap.
The consumer made 49 failed shard attempts, with every owned volume verified removed.
The proposed repair extracts only that generated file from a stopped disposable image container,
retains original image identity, bytes and mode evidence,
and binds an owned byte-identical copy readonly at its original path.
No passing repaired consumer is established yet.
The logger audit tracks the single consumer pilot and distinct issue filing.
