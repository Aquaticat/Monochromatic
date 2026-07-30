# `wg-quicker` handover

## Human's goal

Build a production-ready replacement for `wg-quick up/down` that:

- handles the existing 91 KB `AllowedIPs` line without Bash's quadratic hang;
- keeps `/etc/wireguard/mx-que-mx1.conf` usable as-is;
- can instead compute `AllowedIPs` directly from `allowed.txt` and `disallowed.txt`;
- exempts every Ghostty socket, including commands in every surface scope, from the VPN;
- exempts Helium browser from the VPN;
- uses cgroup-BPF socket marking and policy routing for precise application exemption;
- implements the privileged BPF loader in Rust, not C;
- does not move Ghostty into a different systemd slice.

Do not bring up the real `mx-que-mx1` tunnel without asking first. The human interrupted an earlier real-up attempt with
"Sorry, not yet". Root and sudo are authorized for disposable netns/VM verification.

## Latest requirement, highest priority

The human explicitly requested:

> Split the common parts of both pkgs into a new module/* pkg and use static imports.

This supersedes the current direct dependency from `wg-quicker` to the `wg-allowedips` CLI package.

Create a shared library package, likely:

- directory: `package/module/wg-allowedips/`;
- package name: `@monochromatic-dev/module-wg-allowedips`;
- static TypeScript source export: `./ts`;
- exported public function: `generateAllowedIps({ allowedText, disallowedText })`;
- shared parser/network/lookup types and generation logic moved out of the CLI package;
- both `package/cli/wg-allowedips` and `package/cli/wg-quicker` consume that module through static workspace imports.

Do not leave an import from one CLI package to another.

The current implementation in
`package/cli/wg-quicker/src/config-expand.ts` imports
`@monochromatic-dev/cli-wg-allowedips/ts`. This is temporary and must be replaced.

The current generated bundle fails at runtime with:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@monochromatic-dev/config-tofu'
imported from package/cli/wg-quicker/dist/final/node/index.mjs
```

The immediate cause is `package/cli/wg-allowedips/src/asn-lookup.ts`:

```ts
const CONFIG_ASN_MODULE_URL = import.meta.resolve(
  '@monochromatic-dev/config-tofu/ts/asn-networks.ts',
);
```

That runtime package resolution remains in the bundled artifact. The new shared module must use static imports and must not
require runtime `import.meta.resolve()` to locate source. Redesign the ASN cache/data boundary rather than papering over this
with another runtime package lookup.

## Root-cause diagnosis already complete

`wg-quick up mx-que-mx1` hangs in Bash before `wg` sees the config.

The relevant `wg-quick` parser performs extglob trimming such as:

```bash
${value%%*([[:space:]])}
```

On the 91 KB `AllowedIPs` line this matching is superlinear. The Bash process stayed near full CPU indefinitely.

Measured facts:

- config path: `/etc/wireguard/mx-que-mx1.conf`;
- config size: 91,334 bytes;
- `AllowedIPs` line length: 91,075 characters;
- prefix count: 4,102;
- `wg addconf`/`wg set` parses the same value in about a millisecond;
- a 64 KB Bash trim probe took about 1.65 seconds and scaled superlinearly;
- endpoint: `121.127.43.196:2049`;
- interface addresses:
  - `172.17.170.170/32`;
  - `fd00:4956:504e:ffff::ac11:aaaa/128`;
- DNS: `198.245.51.147,1.1.1.1`;
- LAN: `192.168.253.0/24`, gateway `192.168.253.1`, device `wlan0`.

The fix is to bypass the Bash parser. `wg-quicker` parses only wg-quick-specific interface keys and forwards WireGuard-native
config text to `wg addconf` through a private temporary file.

## Important real-config routing fact

The real config does not contain `0.0.0.0/0` or `::/0`.

Its first prefixes look like:

```text
0.0.0.1/32, 0.0.0.2/31, 0.0.0.4/30, ...
```

It is a full-tunnel-by-exclusion prefix expansion generated from the human's allowed/disallowed inputs. Because there is no
literal `/0`, stock `wg-quick` does not enter its `add_default` policy-routing path. It adds all covered prefixes to the main
table.

Consequences proven in disposable netns tests:

- an exempt socket mark sent to `table main` still follows covered WireGuard routes;
- `table main suppress_prefixlength 0` was not a reliable solution with the surrounding rule order;
- a dedicated bypass table containing the pre-tunnel physical default works:
  - unmarked public traffic uses the WireGuard interface;
  - mark 8888 public traffic uses the physical interface;
  - the same works for LAN/private destinations.

The current source now implements the dedicated bypass-table design in
`package/cli/wg-quicker/src/tunnel-firewall.ts`:

- table number: `100`;
- exempt-rule preference: `50`;
- capture IPv4 physical default into table 100;
- add IPv4 and IPv6 mark rules concurrently;
- remove both rules and flush table 100 on down.

This exact source version has not yet been rerun end-to-end after the latest bypass-table edit. The mechanism was proven
manually in a netns. Verify the current implementation before trusting it.

Remaining bypass concerns:

- table 100 can collide with an existing table;
- `runAllowingFailure` currently hides add failures;
- only the IPv4 physical default is copied;
- default-route changes after up, for example DHCP or Wi-Fi roaming, are not resynchronized;
- teardown must never flush an unrelated pre-existing table 100;
- identify ownership, choose a dynamically free bypass table, and persist/discover it for teardown.

## Current packages

### `package/cli/wg-quicker`

Implemented files:

- `src/index.ts`: CLI entry, `up|down <interface|config-path>`;
- `src/config.ts`: linear parser and async config loading;
- `src/config-expand.ts`: temporary `AllowedIPsFromFiles` integration;
- `src/config-parse-values.ts`: interface-value validation and path parsing;
- `src/config.unit.test.ts`: parser tests;
- `src/errors.ts`;
- `src/runner.ts`: command runner with EPIPE handling;
- `src/tempdir.ts`: `await using` temporary-directory cleanup;
- `src/text.ts`: linear whitespace/token helpers, no regex;
- `src/tunnel.ts`: up/down lifecycle;
- `src/tunnel-firewall.ts`: nft rules, bypass table, exemption rules;
- `src/tunnel-fwmark.ts`;
- `src/tunnel-route-add.ts`: route batching through real temporary files;
- `src/tunnel-route.ts`: allowed-prefix and policy orchestration;
- `src/tunnel-table.ts`: free policy-table scan;
- `src/tunnel-util.ts`;
- package/build/license files and lint rationale document.

The package currently declares this dependency, which must change after extraction:

```json
"@monochromatic-dev/cli-wg-allowedips": "workspace:*"
```

Replace it with the new shared module dependency.

### `package/cli/wg-quicker-exempt`

Rust crate using only `libc`. It hand-defines the stable UAPI subset needed for raw `bpf(2)` syscalls.

Implemented behavior:

- create one-entry `BPF_MAP_TYPE_ARRAY` holding the socket mark;
- load `BPF_PROG_TYPE_CGROUP_SOCK_ADDR` program;
- attach four hooks:
  - connect4;
  - connect6;
  - UDP4 sendmsg;
  - UDP6 sendmsg;
- set `SO_MARK` through `bpf_setsockopt` using a map-value pointer;
- create BPF links;
- pin links under `/sys/fs/bpf/wg-quicker-exempt/` so attachment survives process exit;
- command currently supported:

```text
wg-quicker-exempt attach <mark> <cgroup-dir>...
```

Verified on the host as root:

```text
attached mark=8888 to /sys/fs/cgroup/wgq-test-exempt (4 links pinned)
SO_MARK: 8888
```

The mark persisted after loader exit.

Known Rust implementation facts and prior fixes:

- `libc` does not expose the needed BPF UAPI structs, so `src/bpf.rs` defines the minimal ABI;
- `bpf_attr` union size must be 168 bytes on this host;
- `ProgLoadAttr` must include `prog_ifindex` before `expected_attach_type`;
- attach types:
  - INET4_CONNECT = 10;
  - INET6_CONNECT = 11;
  - UDP4_SENDMSG = 14;
  - UDP6_SENDMSG = 15;
- `BPF_CALL` opcode = `0x85`;
- the verifier rejects a bare map pointer for `bpf_setsockopt`; use `map_lookup_elem` and pass the map-value pointer;
- BPF link FDs alone do not survive process exit; pin every link.

Known Rust hardening still required:

- add `detach` command;
- remove stale pins before reattach, without losing a working attachment on failure;
- rollback partial four-hook failure;
- use a collision-resistant pin directory key (current slash-to-`__` conversion can collide);
- check bpffs with `statfs` magic, not only path existence;
- inspect and act on `bpf_setsockopt` return value;
- correct/verify the `BPF_ST_MEM32 = 0x7a` naming and instruction width;
- verify the null-jump offset;
- add ABI size/offset assertions or a vendored UAPI source;
- document target-endianness support;
- add functional coverage for TCP4, TCP6, UDP4, UDP6, persistence, detach, and repeated attach.

Rust lint state before the latest TypeScript work:

- `cargo clippy --release --all-targets -- -D warnings`: clean;
- repo Rust linter: zero errors;
- release build: clean.

## Ghostty and Helium requirements

The human does not want Ghostty moved into another slice.

Observed cgroups:

- Ghostty service:
  `app-com.mitchellh.ghostty@<id>.service`;
- each Ghostty window/shell:
  `app-ghostty-surface-transient-<pid>.scope`;
- this session was observed in one of those transient surface scopes;
- Helium is an AppImage under `flatpak-session-helper.service` and has multiple processes.

Required Ghostty design:

- attach to the existing Ghostty service cgroup;
- enumerate and attach every existing `app-ghostty-surface-transient-*.scope`;
- watch `app.slice` with inotify for `IN_CREATE | IN_MOVED_TO`;
- rescan after installing the watch to close the create race;
- attach to every future Ghostty surface scope;
- do not change Ghostty's slice or desktop launcher slice.

Current Rust CLI does not implement the watcher. One-shot attachment does not cover future Ghostty windows.

Helium may use a `systemd-run --user --scope --collect` wrapper if needed. Confirm all renderer, zygote, crashpad, and restarted
processes remain under the chosen scope before declaring coverage.

## `wg-quicker` behavior already fixed

Advisor review found and the implementation addressed these issues:

- one shared fwmark/policy table for both IPv4 and IPv6;
- teardown discovers the live interface fwmark rather than assuming 51820;
- `ip route restore` was wrong because it expects binary `ip route save` data;
- batching now uses `ip -batch <real-temp-file>` with textual `route add` commands;
- `wg addconf` uses a real private temp file because Node-spawned `/dev/stdin` failed with `fopen`;
- nft postrouting saves packet mark to conntrack:
  `ct mark set mark`;
- nft prerouting restores conntrack mark to packet:
  `meta mark set ct mark`;
- up order now follows wg-quick more closely:
  link, PreUp, addconf, addresses, MTU/up, DNS, routes, PostUp;
- failed-up cleanup does not run PreDown/PostDown;
- DNS adds routing domain `~.` when DNS servers are present;
- automatic MTU discovers the physical default's device MTU and subtracts WireGuard overhead;
- numeric `MTU`, numeric `Table`, and `ExemptMark` values are validated;
- IPv4/IPv6 exempt-rule operations use `Promise.all`, not unnecessary sequential awaits;
- stdin EPIPE is handled so a child's real failure surfaces.

The nft ruleset was validated with `nft --check` in a disposable netns.

## Direct allowed/disallowed input feature

A new optional `[Interface]` key is partially implemented:

```ini
AllowedIPsFromFiles = ~/allowed.txt ~/disallowed.txt
```

Current parser behavior:

- accepts exactly two whitespace-delimited paths;
- expands `~` and `~/` using `homedir()`;
- consumes the key so `wg addconf` never sees it;
- `loadConfig()` reads both files;
- generates minimized prefixes;
- appends one `AllowedIPs = ...` line to the forwarded peer config.

Important semantic issue to settle during shared-module extraction:

- the appended `AllowedIPs` line currently goes at the end of `wgConfig`;
- this assumes the intended target is the last peer;
- robust parsing should associate the directive with a specific `[Peer]` section, or define and document that the directive
  must occur inside the target `[Peer]` section and replace it there;
- reject simultaneous literal `AllowedIPs` and `AllowedIPsFromFiles` for the same peer, or define deterministic replacement;
- reject the directive when no peer exists;
- down should avoid DNS/ASN resolution if it does not need regenerated prefixes, unless routes require reading the live
  interface state only.

The user's actual files:

- `~/allowed.txt` contains `0.0.0.0/0, ::/0`;
- `~/disallowed.txt` contains private ranges plus Anthropic/OpenAI/Stripe IPs, domains, and ASNs.

The human is concerned that Anthropic IP exclusions may be incomplete. The cgroup-BPF app exemption is the safety net.

## Shared-module extraction plan

Use static imports at every code boundary.

Suggested vertical sequence:

1. Create `package/module/wg-allowedips/` by mirroring a sibling module package's `package.json`, `mise.toml`, `tsconfig.json`,
   rolldown config, README, licenses, and tests.
2. Move library code from `package/cli/wg-allowedips` into the module:
   - generation public API;
   - set/CIDR parsing and subtraction;
   - hostname lookup seam and types;
   - ASN lookup seam and types;
   - production lookup adapters only if they can use static imports and explicit data/cache paths.
3. Keep only CLI parsing/output in `package/cli/wg-allowedips`.
4. Make both CLIs depend on `@monochromatic-dev/module-wg-allowedips` with `workspace:*`.
5. Remove the CLI-to-CLI dependency from `wg-quicker`.
6. Eliminate runtime `import.meta.resolve('@monochromatic-dev/config-tofu/...')`.
7. Prefer an explicit cache/data-directory parameter or move/cache the required static data in the shared module.
8. Run both packages' existing tests, then add module tests covering every exported branch.
9. Build both CLIs and execute each built artifact from its consumer boundary.

Inspect these sources before moving code:

- `package/cli/wg-allowedips/src/generate.ts`;
- `package/cli/wg-allowedips/src/generate-with-lookup.ts`;
- `package/cli/wg-allowedips/src/networks.ts`;
- `package/cli/wg-allowedips/src/asn-lookup.ts`;
- `package/cli/wg-allowedips/src/index.ts`;
- all existing `*.unit.test.ts` files;
- `package/config/tofu/src/asn-networks.ts`;
- `package/config/tofu/package.json`.

## Verification evidence and current state

Before the latest shared-module requirement:

- TypeScript types: zero errors;
- oxlint: zero warnings and zero errors;
- build passed;
- parser test suite passed, including the 4,000-prefix linearity test;
- nft syntax passed `nft --check`;
- current Rust marker build and lint passed;
- multiple disposable netns `up/down` probes cleaned policy rules, nft table, and interface.

Do not interpret that as final completion. The current tree changed afterward:

- `AllowedIPsFromFiles` was added;
- bypass-table source was edited;
- the shared-module extraction is not started;
- built direct-file expansion currently fails from the CLI-to-CLI/runtime-resolve design;
- current bypass-table implementation still needs an end-to-end rerun and ownership hardening;
- route/tunnel exported-path tests remain incomplete.

Current `git status`:

```text
 M pnpm-lock.yaml
?? doc/handover/wg-quicker.md
?? doc/planning/wg-quicker.md
?? package/cli/wg-quicker-exempt/
?? package/cli/wg-quicker/
```

No commits have been created in this work. All package files are untracked except the modified lockfile.

## Remaining tracked tasks

Completed:

- study package conventions;
- design wg-quicker semantics;
- implement source and scaffolding;
- research cgroup-BPF and app cgroups;
- build initial Rust marker;
- fix shared policy table/fwmark;
- fix batching, covered-route checks, and connmark direction;
- fix up order and rollback hooks;
- fix DNS semantics, MTU discovery, and numeric validation.

In progress:

- tests for every exported path;
- exemption routing integration.

Pending:

- final lint/typecheck/user-boundary verification;
- Rust pin/rollback/detach/ABI hardening;
- Ghostty future-scope watcher;
- full netns integration tests.

Add a new task immediately in the fresh session for the shared module extraction and make it the active task.

## Exact next actions

1. Create the shared `package/module/wg-allowedips` package and move common implementation into it.
2. Replace both CLI imports with static imports from the shared module.
3. Remove every runtime `import.meta.resolve()` from this path.
4. Add module unit tests and preserve all existing `wg-allowedips` behavior.
5. Fix the `AllowedIPsFromFiles` peer-association semantics and test them.
6. Rebuild both CLIs and run built-artifact tests.
7. Harden and rerun the dedicated bypass-table implementation for:
   - literal `/0` configs;
   - real full-tunnel-by-exclusion shape;
   - marked and unmarked IPv4;
   - IPv6;
   - clean teardown;
   - occupied-table collision;
   - missing physical default;
   - route change after up.
8. Continue Rust hardening and implement Ghostty watch/rescan.
9. Ask before any real `mx-que-mx1` up.

## Commands

From repo root:

```sh
mise run //package/cli/wg-quicker:format:oxlint
mise run //package/cli/wg-quicker:lint:oxlint
mise run //package/cli/wg-quicker:lint:types
mise run //package/cli/wg-quicker:build
mise run //package/cli/wg-quicker:test:unit
```

Rust package:

```sh
cd package/cli/wg-quicker-exempt
cargo build --release
cargo clippy --release --all-targets -- -D warnings
cargo run --quiet --manifest-path ../../linter/rust/Cargo.toml -- .
```

Project rules require builds and tasks through `mise run` when suitable tasks exist. TypeScript edits require an explicit
`lint:types` run. Never run `bun test` directly. Use disposable netns or fixtures for state-mutating verification.
