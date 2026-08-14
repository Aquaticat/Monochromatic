# wg-quicker

Bring WireGuard interfaces up and down with `wg-quick`-compatible lifecycle behavior,
without parsing large `AllowedIPs` values through Bash pattern matching.

```console
wg-quicker up wg0
wg-quicker down wg0
```

A bare interface name resolves to `/etc/wireguard/<name>.conf`.
An explicit `.conf` path is also accepted.

When invoked as non-root,
`wg-quicker` relaunches exact current Node executable and CLI bundle through `sudo` before reading config.
Sudo inherits terminal streams for authentication and records original desktop identity in `SUDO_UID`.
This avoids both root-only config `EACCES` and sudo `secure_path` hiding workspace-local bin.

Default sudo `env_reset` drops custom settings and replaces `PATH`.
The launcher carries only allowlisted caller home,
cache,
token,
runtime,
UID,
and companion settings through a private mode-`0600` bounded file.
The root child validates file type,
ownership,
mode,
link count,
size,
schema,
and `SUDO_UID` before applying settings.
Consequently,
`AllowedIPsFromFiles = ~/...` still expands against caller home instead of `/root`.

Self-elevation intentionally authorizes current user-owned runtime,
bundle,
and selected paired or caller-path companion for root execution;
use root-owned installed artifacts when workspace integrity is not trusted.

See
[`doc/troubleshooting/sudo-1-9-secure-path-workspace-cli.md`](../../../doc/troubleshooting/sudo-1-9-secure-path-workspace-cli.md)
for source trace and verification.

## Config behavior

`wg-quicker` consumes wg-quick interface keys such as `Address`,
`DNS`,
`MTU`,
`Table`,
and lifecycle hooks.
It forwards WireGuard-native interface and peer lines to `wg addconf` through a private temporary file.
This keeps existing expanded `AllowedIPs` lines usable without Bash's superlinear trimming path.

## Automatic routing

For automatic `Table` behavior,
`wg-quicker` allocates one policy table and sets the WireGuard interface fwmark whenever at least one allowed
prefix exists.
Every allowed prefix goes in that table,
including non-default prefixes.
Main-table connected routes run first;
ordinary matching traffic then enters the policy table,
while WireGuard's marked outer UDP packets skip it and retain the physical main-table path.
This prevents a peer endpoint covered by its own `AllowedIPs` from routing recursively into the tunnel.
Automatic partial routes now use the same source-mark validation and nft ingress protection as automatic default
routes.

Separate automatic tunnels use separate policy tables.
When their allowed prefixes overlap,
policy-rule priority chooses the first table before longest-prefix matching can compare routes across tunnels.
Use explicit routing ownership when simultaneous overlapping automatic tunnels must preserve cross-interface
longest-prefix selection.

An explicit numeric `Table` continues to receive routes without automatic policy rules.
`Table = off` installs no routes.

Before creating an interface,
`wg-quicker` uses iproute2 JSON rule output to reject IVPN Desktop's exact split-tunnel rule
(`fwmark 0xca6c`,
 table `17`).
This fail-closed preflight applies in every table mode because externally marked application traffic can override
routing supplied outside automatic mode too.
IVPN inverse split tunneling marks ordinary non-DNS application traffic for a physical table and otherwise
silently bypasses custom WireGuard route selection.
Disable that conflicting feature before `up` and do not re-enable it while the tunnel is active;
the preflight is not a persistent rule monitor.
Customized IVPN mark or table constants are outside exact detection.
See
[`doc/troubleshooting/ivpn-3-15-inverse-split-tunnel-overrides-wireguard.md`](../../../doc/troubleshooting/ivpn-3-15-inverse-split-tunnel-overrides-wireguard.md)
for source trace,
diagnosis,
and verified recovery.

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
When `up` does not find this key,
it warns that Ghostty,
 Steam,
 Helium,
 and Pale Moon will use the tunnel and instructs the user to add
`ExemptMark = 8888` under `[Interface]`,
then bring the interface down and up again so application exemptions attach.
The warning is non-fatal;
tunnel activation continues.
The companion attaches cgroup-BPF programs to selected application cgroups.
The tunnel lifecycle does not move Ghostty into another systemd slice.

Before network mutation,
`wg-quicker` resolves `wg-quicker-exempt` to exact executable path.
It prefers explicit `WG_QUICKER_EXEMPT_COMMAND`,
then paired repository release or debug build,
then installed command in privileged or captured caller `PATH`.
An unavailable configured companion fails before interface creation.
The watched desktop UID comes from `WG_QUICKER_EXEMPT_UID`,
 then `SUDO_UID`,
 then non-root effective UID.
Direct root execution without an explicit or sudo identity fails instead of watching root's app slice.

The Rust watcher installs inotify on user's existing `app.slice` before its first scan,
attaches the Ghostty service,
every `app-ghostty-surface-transient-*.scope`,
and Steam's `app-steam@*.service`,
drains queued events,
and scans again to close creation race.
It reacts to future cgroup creation and periodically maps every live Helium executable,
including renderer,
zygote,
and crashpad processes,
and both Pale Moon executable names back to their current cgroups.
Known process-discovered cgroups remain attached until directory disappears,
covering process restarts inside same service or scope.
Process discovery attaches entire current cgroup,
so sibling processes in a shared cgroup also bypass tunnel until cgroup disappears or watcher stops.
A newly started Helium or Pale Moon process can create sockets before next 250-millisecond rescan;
applications already running during watcher startup are attached before readiness.
Watcher state validates PID,
process start time,
and complete command before shutdown.

On `up`,
 application bypass routing:

- claims a free route table after checking IPv4 and IPv6 routes and rules;
- chooses a free positive rule preference that runs before every existing positive-priority rule;
- holds per-interface and global allocation `flock` locks under `/run/wg-quicker`
  until routes and rules make ownership visible;
- copies each physical main-table default into the claimed table;
- installs an unreachable default for a family with no physical default,
  preventing marked traffic from falling through to tunnel policy;
- tags owned rules and routes with route protocol `201`;
- persists interface name,
  mark,
  table,
  preference,
  ownership token,
  and exact kernel-rendered route fingerprints in a root-owned state file;
- starts a detached route watcher in the caller's privilege and network namespace.

The watcher resynchronizes owned defaults after DHCP,
IPv6 router-advertisement,
and roaming changes.
It starts route monitoring before synchronization so changes are queued across that boundary,
and restarts an unexpectedly exited monitor child.
A state-owner token,
PID,
process start time,
nonempty executable argument,
and exact watcher-script and state arguments prevent signaling a reused or unrelated PID during teardown.
The executable installation path may differ after a Node runtime update.
Shutdown signals the validated detached process group
so monitor and in-flight route-command children terminate before ownership release.
See
[`doc/troubleshooting/node-runtime-watcher-upgrade.md`](doc/troubleshooting/node-runtime-watcher-upgrade.md)
for the diagnosed upgrade failure and verified recovery.

On `down`,
 persisted state identifies the exact watcher,
rules,
and routes to remove.
Teardown deletes only persisted route fingerprints,
not every route carrying protocol `201`.
It does not flush whole tables and does not depend on current config values,
so unrelated routes and configuration edits made after `up` are preserved.
Synchronization refuses a table containing an unrecorded default before mutation.

## Development

Run package checks through mise:

```console
mise run //package/cli/wg-quicker:buildAndTest
mise run //package/cli/wg-quicker:test:integration:bypass
mise run //package/cli/wg-quicker:test:integration:route
mise run //package/cli/wg-quicker:lint:oxlint
mise run //package/cli/wg-quicker:lint:types
```

State-mutating integration tests use disposable network namespaces.
Do not use the real `mx-que-mx1` interface for verification.
