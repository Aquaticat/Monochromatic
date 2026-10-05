# `mvm` libvirt backend fails on a host whose libvirt exists only in the virt-manager 5.1.0 Flatpak

## Status

Diagnosed on 2026-10-05.
A scratch workaround carried one Windows-native verification run;
nothing in the repository is changed.
The fix is not chosen;
the options are in "Proposed fixes".

## Symptom

Every `mvm` libvirt operation fails before it reaches a virtual machine.
The `mvm` MCP tool `list_vms` failed twice with this message,
recorded in the `Host bridges` section of `doc/handover/scanner-native-verification.md`:

```text
Command failed: virsh --connect 'qemu:///session' list --all
```

`mvm list` from the repository root reproduces it on 2026-10-05 and exits 1.
The final lines of its output, verbatim:

```text
SubprocessError: Command failed: virsh --connect 'qemu:///session' list --all
    at getErrorInstance (file:///var/home/user/Monochromatic/package/cli/mvm/dist/final/node/ephemeral-run-B0EZr1RU.mjs:3:15068)
    at getResultError (file:///var/home/user/Monochromatic/package/cli/mvm/dist/final/node/ephemeral-run-B0EZr1RU.mjs:3:14881)
    at spawnSubprocess (file:///var/home/user/Monochromatic/package/cli/mvm/dist/final/node/ephemeral-run-B0EZr1RU.mjs:4:704)
```

Before those lines Node prints one minified line of the bundled source,
several thousand characters long.
Neither the message nor the printed stack says that `virsh` was not found.

With `virsh` bridged,
creating a VM failed next,
recorded in the same section:

```text
Unable to find a satisfying virtiofsd
```

## Root cause

`mvm` runs host executables by bare name from `PATH`.
`package/cli/mvm/src/virsh.ts:30`:

```ts
export function virsh({ args, }: { readonly args: readonly string[]; },): Promise<string> {
  return spawn({
    command: 'virsh',
    args: [
      '--connect',
      LIBVIRT_URI,
      ...args,
    ],
  },);
}
```

`LIBVIRT_URI` is the per-user daemon,
`package/cli/mvm/src/config.ts:73`:

```ts
export const LIBVIRT_URI = 'qemu:///session';
```

Disk images come from bare `qemu-img`,
`package/cli/mvm/src/create.ts:178`:

```ts
  await spawn({
    command: 'qemu-img',
```

and the domain XML always gains a virtiofs share for file transfer,
`package/cli/mvm/src/domain-xml.ts:221`:

```ts
  // virtiofs shared directory for host-guest file transfer
  if (sharedDir !== undefined) {
```

```ts
            tag: 'driver',
            attrs: { type: 'virtiofs', },
```

`push_to_vm` and `pull_from_vm` read and write that share
(`package/cli/mvm/src/file-transfer.ts:2`:
"File transfer between host and guest VM via virtiofs shared directory.").

This host provides none of those executables outside a Flatpak sandbox.
Probes run on 2026-10-05:

- `command -v virsh virtiofsd` finds neither.
- `command -v qemu-img` finds `/home/user/.local/share/mise/shims/qemu-img`,
  but running it fails:
  `mise ERROR No version is set for shim: qemu-img`.
  The shim belongs to an Android SDK tool that is not active in this repository.
- `flatpak list` shows `org.virt_manager.virt-manager` 5.1.0
  and its extension `org.virt_manager.virt_manager.Extension.Qemu` 9.2.0.
- `flatpak run --command=virsh org.virt_manager.virt-manager --version` prints `12.4.0`.
- Inside that Flatpak,
  `command -v virtiofsd` finds nothing,
  and neither `/app/libexec/virtiofsd` nor `/usr/libexec/virtiofsd` exists.

So the first `virsh` spawn fails because the executable is missing,
and once `virsh` is bridged into the Flatpak,
the libvirt daemon there cannot satisfy the virtiofs device.

## Verification

Versions:
virt-manager Flatpak 5.1.0 with libvirt 12.4.0 inside it,
mise 2026.10.0,
repository commit `3871dd434`.

Harness:

```sh
# doc/troubleshooting/mvm-libvirt-flatpak-only-host.md
cd -- /var/home/user/Monochromatic && mvm list
command -v virsh virtiofsd
flatpak run --command=virsh org.virt_manager.virt-manager --version
```

### Works

- `flatpak run --command=virsh org.virt_manager.virt-manager` and `--command=qemu-img`.
- `mvm` with the scratch shims in "Verified workarounds" first on `PATH`,
  for operations that do not need virtiofs:
  listing, and creating and running a Windows VM whose domain was redefined without the share.

### Fails

- Any `mvm` libvirt command or MCP tool with the default `PATH`:
  `Command failed: virsh --connect 'qemu:///session' list --all`.
- `mvm create --image windows` with the shims:
  `Unable to find a satisfying virtiofsd`.
- `push_to_vm` and `pull_from_vm` in any configuration on this host,
  because they need the virtiofs share.

## Verified workarounds

### Bridge `virsh` and `qemu-img` into the Flatpak

The Windows-native scanner run on 2026-10-05 used these scratch shims,
retained at `/home/user/temp/agent/scanner-windows-native-20261005/shim/`,
with that directory first on `PATH` for the `mvm` CLI:

```js
// /home/user/temp/agent/scanner-windows-native-20261005/shim/virsh
#!/usr/bin/env node
// Scratch bridge: this host's only libvirt client lives in the virt-manager Flatpak, while mvm spawns bare `virsh`.
const { spawnSync } = require('node:child_process');
const result = spawnSync(
  'flatpak',
  ['run', '--command=virsh', 'org.virt_manager.virt-manager', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
if (result.error !== undefined) {
  throw result.error;
}
process.exitCode = result.status === null ? 1 : result.status;
```

The `qemu-img` shim is identical with `--command=qemu-img`.

Tradeoffs:

- The `mvm` MCP server keeps its own `PATH`,
  so the MCP tools still fail;
  only the CLI benefits.
- That run started the session `virtqemud` explicitly;
  the exact command was not recorded.
  One piped `virsh version` call took 122 seconds there.
  That a daemon spawned by the call held the pipe open is an inference, not a measurement.

### Replace the virtiofs share with loopback HTTP

The same run redefined the domain without its `filesystem` device
(`domain-no-virtiofs.xml` in the scratch directory)
and moved files between host and guest over HTTP served on host loopback,
which a user-mode network guest reaches at `10.0.2.2`.

Tradeoffs:

- `push_to_vm` and `pull_from_vm` stay unusable;
  every transfer is a hand-written download in the guest.
- The HTTP server exposes whatever directory it serves to the guest and to the host's loopback;
  serve a private scratch directory holding only the files to transfer.

## What does not work

- The `mise` shim for `qemu-img`:
  it resolves to an inactive tool and fails.
- Expecting the Flatpak to provide `virtiofsd`:
  neither checked path exists inside it,
  and the domain cannot start with a virtiofs device.

## Proposed fixes

Not applied;
which host setup `mvm` should support is a decision for the user.

- Install host libvirt, QEMU and `virtiofsd` packages,
  so `mvm` works unchanged.
  On an image-based Fedora host that means layering packages or using a toolbox,
  which changes the host.
- Teach `mvm` to locate libvirt explicitly
  (a configured `virsh` command prefix such as `flatpak run --command=virsh org.virt_manager.virt-manager`)
  and to create domains without virtiofs when no `virtiofsd` is available,
  falling back to another transfer channel.
- Independently of either:
  when a spawned tool is missing,
  `mvm` should say which executable was not found on `PATH`
  instead of a generic `Command failed` with a stack through minified bundle code.

## Upstream filing decision

1.  Is it upstream's fault?
    No.
    `mvm` is this repository's tool and assumes host executables;
    the Flatpak is not meant to provide host command-line tools.
    Whether Flathub's virt-manager should ship `virtiofsd` was not investigated.
2.  Can upstream fix it?
    Not applicable.
3.  Is the use case supported?
    Not applicable.
4.  Would the repository welcome a contribution?
    Not applicable.
5.  Would they likely fix it?
    Not applicable.
6.  Is a minimal fix prototyped?
    Not applicable upstream;
    the local options are in "Proposed fixes".

Decision:
nothing to file upstream,
and no draft is kept.
