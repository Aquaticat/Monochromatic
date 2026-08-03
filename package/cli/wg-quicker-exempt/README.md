# wg-quicker-exempt

Marks sockets from selected cgroups so policy routing can keep application traffic outside a WireGuard tunnel.

## Why

`wg-quicker` installs a dedicated bypass table and an `ip rule` matching an exemption mark.
This loader applies that mark to sockets created in Ghostty,
 Steam,
 Helium,
 and Pale Moon cgroups without enumerating their destination IPs.

## How it works

For each cgroup,
 the Rust loader:

1. creates a one-entry `BPF_MAP_TYPE_ARRAY` containing the socket mark;
2. loads `BPF_PROG_TYPE_CGROUP_SOCK_ADDR` programs for TCP connect and UDP sendmsg,
    IPv4 and IPv6;
3. calls `bpf_setsockopt(SOL_SOCKET, SO_MARK)` with the map-value pointer;
4. denies the socket operation if `bpf_setsockopt` fails;
5. creates one BPF link for each hook;
6. pins all four links under `/sys/fs/bpf/wg-quicker-exempt/`;
7. falls back to a detached descriptor keeper when the detected SELinux regression makes `BPF_OBJ_PIN` return `EINVAL`.

The loader uses raw stable `bpf(2)` UAPI through `libc`.
It does not require libbpf or bpftool.

## Usage

Attach or atomically replace the marker for one or more cgroups:

```sh
wg-quicker-exempt attach <mark> <cgroup-dir>...
```

Detach exact persisted links:

```sh
wg-quicker-exempt detach <cgroup-dir>...
```

List Ghostty,
 Steam,
 Helium,
 and Pale Moon targets without attaching:

```sh
wg-quicker-exempt list-targets <uid>
```

Start or stop detached application watcher owned by tunnel key:

```sh
wg-quicker-exempt watch-start <key> <mark> <uid>
wg-quicker-exempt watch-stop <key>
```

Example:

```sh
wg-quicker-exempt attach 8888 \
  /sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/app-com.mitchellh.ghostty@id.service \
  /sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/app-ghostty-surface-transient-123.scope
```

Root or equivalent BPF,
 network-administration,
 and cgroup attach capabilities are required.

## Persistence and replacement

Canonical cgroup path bytes are encoded as chunked hexadecimal path components.
This mapping is injective and avoids dots,
 which bpffs reserves for future extensions.
It also avoids collisions from replacing slashes with a delimiter.

A new four-link set is created under the tool's staging directory.
First attach renames the completed staging directory into place.
Replacement uses `renameat2(RENAME_EXCHANGE)`,
 then removes only the four old link pins.
A failed attach removes partial new pins and leaves the prior complete set active.

Attach and detach hold `/run/wg-quicker-exempt.lock` through the full lifecycle mutation.
The loader verifies that `/sys/fs/bpf` is a distinct bpffs mount before creating pins.

The descriptor-keeper fallback uses a two-phase handshake.
A candidate creates all links before the parent writes transition state and sends `COMMIT`.
The child records a commit marker,
 the parent validates and stops the prior holder,
 then finalizes active state.
Recovery retains the prior holder if an uncommitted candidate died and adopts a live committed candidate after interruption.
Detach checks PID,
 process start time,
 full command,
 mark,
 and canonical cgroup before sending `SIGTERM`.

## Platform support

The instruction encoder currently supports little-endian Linux targets only.
A compile-time error rejects big-endian targets rather than producing incorrectly packed register fields.

The raw ABI has compile-time size and offset assertions for every `bpf_attr` arm used by the loader.
The instruction tests verify stack-store width and offset,
 null lookup control flow,
 helper ID,
 and helper-result verdicts.

## Linux 7.1 SELinux regression

Kernel `7.1.3-ogc5.1.fc44.x86_64` was observed returning `EINVAL` from `BPF_OBJ_PIN` after map creation,
 program load,
 and link
creation all succeeded.
The same failure affected maps,
 programs,
 and links at root and nested bpffs paths.

An upstream fix moves the SELinux `SBLABEL_MNT` check before inode security-state initialization and requests stable
backports.
The loader reports the affected regression commit when `BPF_OBJ_PIN` returns `EINVAL`,
 then automatically uses its
crash-recoverable descriptor keeper.
See [`doc/troubleshooting/linux-bpffs-selinux-object-pin-einval.md`](../../../doc/troubleshooting/linux-bpffs-selinux-object-pin-einval.md).

## Verification

Run unprivileged unit,
 build,
 and lint checks:

```sh
mise run //package/cli/wg-quicker-exempt:buildAndTest
```

Privileged ignored tests use disposable cgroups.
They cover all four protocols,
 process-exit persistence,
 repeated attach,
 exact detach,
 partial-link rollback,
 failed
candidate replacement,
 pre-transition parent death,
 committed and uncommitted transition recovery,
 removed cgroups,
 and wrong-owner cleanup retention.
On an affected kernel,
 the same tests exercise the descriptor-keeper fallback.

## Caveats

- Only socket operations occurring after attachment receive the mark.
- Every new cgroup needs its own attachment.
   Detached application watcher owns Ghostty and Steam enumeration,
   future-cgroup inotify coverage,
   and Helium and Pale Moon process rescans.
- Process discovery attaches entire current cgroup.
   If Helium or Pale Moon shares that cgroup with another process,
   every sibling's newly created sockets receive exemption until cgroup disappears or watcher stops.
- A newly started process-discovered application can create sockets before next periodic rescan,
   whose interval is 250 milliseconds.
   Existing applications are attached before watcher readiness.
- Detach removes only the four exact expected pin names and uses `rmdir`,
   so unrelated entries prevent directory removal.
- On affected kernels,
   persistence depends on the validated holder process.
   A holder crash safely detaches its links,
   and the
  next lifecycle command recovers its transition state.
