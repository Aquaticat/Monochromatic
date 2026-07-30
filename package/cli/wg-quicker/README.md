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

## Development

Run package checks through mise:

```console
mise run //package/cli/wg-quicker:buildAndTest
mise run //package/cli/wg-quicker:lint:oxlint
mise run //package/cli/wg-quicker:lint:types
```

State-mutating integration tests use disposable network namespaces.
Do not use the real `mx-que-mx1` interface for verification.
