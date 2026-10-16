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
The real verification run is `7gxcgml68r`;
its result is pending at this checkpoint.

The recipe is for a disposable runner with sudo,
not a request to change the user's real libvirt state.
It uses a separate `qemu:///session`,
asserts an empty initial domain list,
and permits cleanup only for the explicitly owned trial domain names.
Guest preparation and teardown remain independently required.

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
