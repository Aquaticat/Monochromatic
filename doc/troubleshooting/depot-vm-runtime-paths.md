# Libvirt 10.0.0 rejects long private guest-agent socket paths in Depot CI

## Symptom

Depot run `99tl7zjfgp` installed Ubuntu package `libvirt-daemon 10.0.0-2ubuntu8.19`
and started private session daemons.
Preparing an Ubuntu guest failed with this libvirt diagnostic:

```text
error: internal error: UNIX socket path '/home/runner/temp/agent/depot-complete-vm-home-OEnKBv/runtime/libvirt/qemu/run/channel/1-mvm-template-setup/org.qemu.guest_agent.0' too long
```

The run's private domain list was empty before preparation and after cleanup.
No guest execution is established by this attempt.

## Root cause

The trial put `XDG_RUNTIME_DIR` inside a long private home path.
Libvirt appends its own state and guest-channel directories.
Upstream tag `v10.0.0`,
commit `1899d7df34576e414c49e4d91c68e6e2348f37f2`,
contains the relevant source;
this trace does not claim every Ubuntu patch is identical to that tag.

`src/util/virutil.c:531` appends the library directory:

```c
// libvirt, src/util/virutil.c:531 at v10.0.0
return g_build_filename(g_get_user_runtime_dir(), "libvirt", NULL);
```

`src/qemu/qemu_conf.c:190` builds session state and channel directories:

```c
// libvirt, src/qemu/qemu_conf.c:190 at v10.0.0
rundir = virGetUserRuntimeDirectory();
cfg->stateDir = g_strdup_printf("%s/qemu/run", rundir);
cfg->swtpmStateDir = g_strdup_printf("%s/swtpm", cfg->stateDir);
cfg->channelTargetDir = g_strdup_printf("%s/channel", cfg->stateDir);
```

`src/qemu/qemu_command.c:4965` rejects a path that does not fit `sockaddr_un.sun_path`:

```c
// libvirt, src/qemu/qemu_command.c:4965 at v10.0.0
if (virStrcpyStatic(addr.sun_path, dev->data.nix.path) < 0) {
    virReportError(VIR_ERR_INTERNAL_ERROR,
                   _("UNIX socket path '%1$s' too long"),
                   dev->data.nix.path);
```

The same operating-system boundary is documented for the nested compositor in
[nested Wayland footguns](nested-wayland-gui-test-footguns.md).
Changing the VM disk image cannot shorten this host socket address.

## Verification

The failing catalog includes the full path and provider run in Symptom.
Successful preparation boundaries in that run were the source bundle build,
package installation,
both daemon starts,
empty private session listing,
and the actual source `mvm --help` invocation.
Those successes do not prove guest boot.
The retained `logger-vm-evidence` artifact contains each command's complete stdout and stderr.

Trial harness `906bf436de` moved sockets to a unique directory under the inherited `XDG_RUNTIME_DIR`
and asserted the complete worst-case channel address was shorter than 108 bytes.
Retry `8wfm7bfgjv` found that environment variable absent and stopped at the harness assertion:

```text
AssertionError [ERR_ASSERTION]: Cloud user runtime directory must exist before creating private libvirt sockets
```

This is a separate failed setup assumption,
not another libvirt socket-length rejection.
It occurred before VM command recording and produced no VM evidence artifact.

## Candidate workaround and tradeoffs

Harness `295045dd82` on branch `trial/depot-complete-vm-20261016`
creates `/run/user/<uid>` with owner-only permissions when missing,
then allocates a unique `v-` directory inside it.
Only sockets and daemon PID files use that runtime path.
Images and configuration remain in the private home under `temp/agent`.
The full channel address must still fit the byte-length assertion.
Run `7gxcgml68r` crossed the runtime setup gate,
then exposed another long socket under the private configuration directory:
the QEMU `monitor.sock`.
Harness `0bcfa40820` also moves private configuration into the short runtime directory
and checks that complete monitor address.
Run `rv6hfj76w9` crossed both socket-length gates and progressed through template preparation.
The final prepared guest then failed with a different diagnostic:
QEMU could not connect to its virtiofs socket because the connection was refused.
That result does not establish why virtiofsd exited.
Diagnostic harness `01c948cac2` retains private QEMU and virtiofs daemon logs before cleanup.
Both socket failures are tracked in issue `#1074`;
the independently verified missing-runtime repair is closed in `#1075`.
Run `rv6hfj76w9` actually booted the template,
received `guest agent on template-setup is ready`,
shut the guest down,
and saved its standalone template image.
Those executed boundaries verify the short runtime and monitor paths,
so `#1074` is closed.
They do not establish a working shared-directory guest or lifecycle suite.

The recipe is for a disposable runner with sudo,
not a request to change the user's real libvirt state.
It uses a separate `qemu:///session`,
asserts an empty initial domain list,
and permits cleanup only for the explicitly owned trial domain names.
Guest preparation and teardown remain independently required.

## Separate virtiofs primary-group prerequisite

Run `22b5683gx8`,
attempt `w1zscshgq1`,
used diagnostic harness `01c948cac225276eedf76c5c062227eea9ba90c3`
and unchanged historical source `ef01490f5e960f8ca0b424c12242caeb3c5a2b5e`.
Its `logger-vm-evidence` artifact is 18,429 bytes,
SHA-256 `05e1a751216a14332fa458a4c3538cd5869f0bdff9574abb5e553216546c3581`.
The retained `daemon-mvm-depot-preparation-ubuntu-fs0-virtiofsd.log`
identifies why the shared-directory daemon did not accept QEMU's connection:

```text
[2026-10-16T04:09:02Z ERROR virtiofsd::sandbox] sandbox: couldn't setup id mappings: write to uid map failed: newuidmap: Target process 3476 is owned by a different user: uid:1001 pw_uid:1001 st_uid:1001, gid:1001 pw_gid:117 st_gid:1001
```

The process and target GID are 1001,
while passwd requires primary GID 117.
This is the same ownership guard independently traced for
[rootless Podman](depot-rootless-podman-group-identity.md),
but a different consumer boundary.
The observed virtiofs daemon diagnostic establishes this VM preparation failure;
the Podman result alone would not establish it.

The current inspected Shadow revision `e9bc595fd20558cf51aef096db262232090e8fb8`
still rejects the mismatch in `src/newuidmap.c:132`:

```c
/* Shadow, src/newuidmap.c:132 */
if ((getuid() != pw->pw_uid) ||
    (!getdef_bool("GRANT_AUX_GROUP_SUBIDS") && (getgid() != pw->pw_gid)) ||
    (pw->pw_uid != st.st_uid) ||
    (getgid() != st.st_gid)) {
```

That source guard and the actual daemon log support a group-identity rejection.
They do not establish why the prepared sandbox inherited this group,
or establish a libvirt or Shadow defect.
The deprecated `-o` option warning in the same log is separate from the fatal diagnostic.
Changing only socket paths cannot correct the observed primary-group mismatch.

Harness `a683cd54f9` records runner process and passwd group identities,
then relaunches the disposable harness with the same UID and passwd primary GID when needed.
It uses `sudo --non-interactive --preserve-env setpriv`
with `--reuid`,
`--regid`,
and `--init-groups`.
A marker prevents recursive relaunch;
an assertion rejects a second mismatch.
This candidate changes only the disposable cloud process identity,
not passwd,
the workstation account,
or historical source.
It is awaiting a real invocation and consumer verification.

The fifth run built the historical source bundle,
again measured the original package task's separate working-directory failure,
booted and shut down the template,
and failed final guest preparation.
Cleanup errors were empty,
and the private domain list was empty after cleanup.
No Ubuntu/Windows lifecycle test pass follows from this attempt.
The original task remains tracked by `#1076`;
running the source suite from the repository root cannot replace that task result.

## What does not work

- A long private home is appropriate for image isolation but may exceed UNIX socket address limits.
- Assuming every cloud shell inherits `XDG_RUNTIME_DIR` failed in the measured retry.
- Successful daemon startup does not verify paths created only when a guest starts.
- A missing artifact does not erase a failed provider attempt from cost accounting.

## Upstream filing decision

1.  Upstream fault is not established:
    libvirt rejects a path outside the host socket representation,
    and the harness chose the path.
2.  The consumer can choose a shorter runtime path.
3.  Session daemons and their runtime locations are documented in the
    [libvirtd manual](https://libvirt.org/manpages/libvirtd.html).
4.  Contribution-policy assessment is unnecessary without a proposed upstream change.
5.  The measured impact is failed guest preparation,
    with no guest checks executed.
6.  The original failure is reproduced in the provider log;
    the corrected runtime setup is under verification.

A GitHub mirror issue search for `socket path too long` returned no matches.
That result is not evidence that the behavior has never been reported elsewhere.
No upstream issue or comment is warranted from this consumer configuration failure.
There is no fileable upstream draft.
