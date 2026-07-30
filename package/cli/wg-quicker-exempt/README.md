# wg-quicker-exempt

Marks sockets from chosen app cgroups so their traffic bypasses the WireGuard
tunnel set up by `wg-quicker`.

## Why

`wg-quicker` brings up a full-tunnel WireGuard interface using policy routing
(`not fwmark <tunnel> table <tunnel>` + `table main suppress_prefixlength 0`).
To exempt specific applications (Ghostty, Helium) without enumerating their
destination IPs, this tool marks their sockets at the cgroup level and a
single `ip rule` sends marked traffic to the main table.

## How it works

1. A minimal cgroup-BPF program is attached (via `BPF_LINK_CREATE`) to the
   `connect4`, `connect6`, `udp4_sendmsg`, and `udp6_sendmsg` hooks of each
   target cgroup. It sets `SO_MARK` from a one-entry `BPF_MAP_TYPE_ARRAY`.
2. The four links are pinned under `/sys/fs/bpf/wg-quicker-exempt/<cgroup>/`
   so the attachment persists after this process exits. Removing a pinned link
   detaches it.
3. `wg-quicker` installs `ip rule add fwmark <exempt-mark> table main pref 100`,
   evaluated before the tunnel rule, so marked traffic uses the main table.

No libbpf or bpftool: raw `bpf(2)` syscalls via `libc`, so it runs on rpm-ostree
(Atomic) hosts where those tools are not installed.

## Usage

```sh
wg-quicker-exempt attach <mark> <cgroup-dir>...
```

Example (exempt Ghostty's current window scopes and the main process):

```sh
wg-quicker-exempt attach 8888 \
  /sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/app-com.mitchellh.ghostty@<id>.service \
  /sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/app-ghostty-surface-transient-<pid>.scope
```

Requires root (`CAP_BPF` / `CAP_NET_ADMIN` and cgroup attach permission).

## Caveats

- Only new connections are marked; sockets connected before attachment keep
  their existing route.
- A new Ghostty window creates a fresh surface scope that must be attached
  separately (see the `wg-quicker` integration for how cgroups are enumerated).
