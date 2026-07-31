# wg-quicker

Bring WireGuard interfaces up and down with `wg-quick`-compatible lifecycle behavior,
without parsing large `AllowedIPs` values through Bash pattern matching.

```console
wg-quicker up wg0
wg-quicker down wg0
```

A bare interface name resolves to `/etc/wireguard/<name>.conf`.
An explicit `.conf` path is also accepted.

## Config behavior

`wg-quicker` consumes wg-quick interface keys such as `Address`,
`DNS`,
`MTU`,
`Table`,
and lifecycle hooks.
It forwards WireGuard-native interface and peer lines to `wg addconf` through a private temporary file.
This keeps existing expanded `AllowedIPs` lines usable without Bash's superlinear trimming path.

## Generate AllowedIPs from files

A peer may replace literal `AllowedIPs` with `AllowedIPsFromFiles`:

```ini
[Peer]
PublicKey = peer-public-key
AllowedIPsFromFiles = ~/allowed.txt ~/disallowed.txt
Endpoint = vpn.example:51820
```

The directive must occur inside its owning `[Peer]` section.
Each peer may contain either one literal `AllowedIPs` value or one `AllowedIPsFromFiles` directive,
not both.
Multiple peers can use independent source files.
The generated line is inserted where the directive occurred.

Each source file uses the format documented by `package/cli/wg-allowedips/README.md`.
Generation comes from `@monochromatic-dev/module-wg-allowedips` through a static source import.
ASN refreshes use `IPINFO_TOKEN` and the cache directory described by that module.

`down` parses source directives but does not read their files,
resolve domains,
or refresh ASN data.
Only `up` generates peer prefixes.

## Application exemptions

`ExemptMark = <positive integer>` enables socket-mark policy routing used by the Rust
`wg-quicker-exempt` companion.
The companion attaches cgroup-BPF programs to selected application cgroups.
The tunnel lifecycle does not move Ghostty into another systemd slice.

On `up`,
 application bypass routing:

- claims a free route table after checking IPv4 and IPv6 routes and rules;
- chooses a free positive rule preference that runs before every existing positive-priority rule;
- holds per-interface and global allocation `flock` locks under `/run/wg-quicker`
  until routes and rules make ownership visible;
- copies each physical main-table default into the claimed table;
- installs an unreachable default for a family with no physical default,
  preventing marked traffic from falling through to tunnel policy;
- tags owned rules and routes with route protocol `201`,
  reserved exclusively for `wg-quicker` on managed hosts;
- persists interface name,
  mark,
  table,
  preference,
  and ownership token in a root-owned state file;
- starts a detached route watcher in the caller's privilege and network namespace.

The watcher resynchronizes owned defaults after DHCP,
IPv6 router-advertisement,
and roaming changes.
It starts route monitoring before synchronization so changes are queued across that boundary,
and restarts an unexpectedly exited monitor child.
A state-owner token,
PID,
process start time,
and complete command-line check prevent signaling a reused or unrelated PID during teardown.

On `down`,
 persisted state identifies the exact watcher,
rules,
and routes to remove.
Teardown does not flush whole tables and does not depend on current config values,
so unrelated routes and configuration edits made after `up` are preserved.

## Development

Run package checks through mise:

```console
mise run //package/cli/wg-quicker:buildAndTest
mise run //package/cli/wg-quicker:test:integration:bypass
mise run //package/cli/wg-quicker:lint:oxlint
mise run //package/cli/wg-quicker:lint:types
```

State-mutating integration tests use disposable network namespaces.
Do not use the real `mx-que-mx1` interface for verification.
