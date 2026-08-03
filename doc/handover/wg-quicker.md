# `wg-quicker` completion handover

## Goal and safety boundary

The production replacement for `wg-quick up/down` is complete.
It:

- handles large `AllowedIPs` values without Bash pattern matching;
- generates peer-local `AllowedIPs` from allowed and disallowed source files;
- owns collision-safe dual-stack bypass routing;
- exempts Ghostty, Steam, and Helium sockets through cgroup-BPF;
- keeps privileged BPF implementation in Rust;
- does not move Ghostty into another systemd slice.

The human brought real `mx-que-mx1` up during follow-up diagnosis and then brought it down after connectivity
stopped.
It is currently down.
Do not bring it up,
restart it,
or mutate live routing without explicit authorization.
IVPN Desktop split tunneling is currently disabled after its supported `ivpn splittun -off` recovery.
`/etc/wireguard/mx-que-mx1.conf` now contains `ExemptMark = 8888` under `[Interface]`.
The atomic edit preserved root ownership,
mode `0600`,
single-link status,
and the down physical endpoint route.

## Completed tasks

- Task `#1`:
   assess inherited handover.
- Task `#2`:
   extract shared AllowedIPs module.
- Task `#3`:
   correct peer-local `AllowedIPsFromFiles` semantics.
- Task `#4`:
   harden bypass routing and route watcher.
- Task `#5`:
   harden Rust BPF loader lifecycle.
- Task `#6`:
   cover Ghostty and Helium cgroups.
- Task `#7`:
   run final cross-package verification and update this handover.
- Blocker task `#8`:
   work around Linux bpffs SELinux pin regression.
- Tasks `#9` through `#14`:
   diagnose and harden self-elevation,
   caller-context preservation,
   exact companion resolution,
   and scrubbed-sudo verification.
- Tasks `#15` through `#17`:
   diagnose system-wide ISP egress,
   trace interacting IVPN and endpoint routes,
   and prevent endpoint recursion.

No tracked implementation task remains.

## Relevant commits

```text
b8958bde1 initial inherited implementation
7e37cbf76 shared AllowedIPs module and static consumers
68eb96063 peer-local AllowedIPsFromFiles semantics
cd72d867d bypass-routing hardening work
5016bffd0 bypass-routing hardening work
7eda14e17 bypass ownership lifecycle
6d785d0a2 watcher process-group termination
c3bb6735a exact bypass route ownership persistence
1bb08f1e4 restart checkpoint handover
4bef73b4e hardened Rust BPF link lifecycle and SELinux fallback
3b92eb5c8 Ghostty and Helium application watcher integration
e43e24afa self-elevation before config access
de20d4b26 privilege-process ownership boundary
c520bd996 caller context across sudo env reset
6cabed890 exact Rust companion resolution
94c907045 effective-UID privilege gate
622fd9844 caller-context schema regression tests
6805239fa and a8c2746c6 sudo troubleshooting documentation
2d94b86fd endpoint-recursion prevention and IVPN conflict preflight
ff9081828 normalized conflict detection and dual-stack route coverage
a41cb8efb missing-ExemptMark warning and live config note
743581a55 configured-exemption warning-path coverage
492b6914e actionable config-specific warning wording
```

Other commits interleaved at `HEAD` belong to concurrent work and are unrelated.

## Shared AllowedIPs ownership

`package/module/wg-allowedips/` owns:

- allowed and disallowed input generation;
- CIDR parsing,
   normalization,
   minimization,
   and subtraction;
- DNS and ASN lookup seams and types;
- IPinfo ASN cache validation and atomic replacement;
- explicit cache-directory selection.

Both CLIs use static workspace imports from
`@monochromatic-dev/module-wg-allowedips/ts`.
There is no CLI-to-CLI dependency and no runtime `import.meta.resolve()` source lookup.
Built bundles work outside workspace package resolution.

## Peer-local file generation

A peer may contain:

```ini
[Peer]
PublicKey = peer-public-key
AllowedIPsFromFiles = ~/allowed.txt ~/disallowed.txt
Endpoint = vpn.example:51820
```

The directive belongs to containing `[Peer]`.
Expansion preserves directive insertion point.
Parser rejects:

- directive outside a peer;
- duplicate source directives in one peer;
- literal `AllowedIPs` and `AllowedIPsFromFiles` in same peer;
- malformed source path count.

Multiple peers can use independent source files.
`down` retains metadata without reading files,
resolving domains,
or refreshing ASN caches.

## Automatic tunnel routing

Automatic mode now puts every allowed prefix in one interface-specific policy table,
not only literal `/0` routes.
The WireGuard fwmark lets outer endpoint packets skip that table and retain physical main-table routing,
including when a non-default allowed prefix covers the endpoint.
Main non-default routes are evaluated first for connected physical and LAN paths.

Separate automatic tunnels use separate policy tables.
Overlapping allowed prefixes are therefore selected by policy-rule order before routes in different tables can
compete by prefix length.
Use explicit route ownership if simultaneous overlapping tunnels need cross-interface longest-prefix behavior.
Automatic partial tunnels now receive the source-mark validation and nft ingress protection previously reached
only by literal-default mode.

`up` rejects IVPN Desktop's exact active split-tunnel rule before interface creation.
The check recognizes mark `0xca6c` with table `17` or `ivpn-exclude-tbl` from both family JSON rule listings.
It is a one-shot preflight;
do not re-enable IVPN split tunneling while `wg-quicker` remains active.
See `doc/troubleshooting/ivpn-3-15-inverse-split-tunnel-overrides-wireguard.md`.

## Bypass routing

`package/cli/wg-quicker` now provides:

- dynamic dual-stack bypass-table allocation;
- preference selection before every existing positive-priority rule;
- per-interface and global `flock` operation locks;
- exact transition-state persistence;
- exact kernel-rendered route fingerprints;
- fail-closed unreachable defaults for a missing address family;
- route monitoring before initial synchronization;
- monitor-child restart;
- owner,
  PID,
  start-time,
  and full-command validation;
- validated process-group shutdown;
- state retention after cleanup failure;
- teardown of only persisted routes.

Route protocol `201` is a tag,
not ownership proof.
Teardown never flushes a whole table and preserves unrelated protocol-`201` routes.

Only exit `2` with selected family's exact `FIB table does not exist` diagnostic plus `Dump terminated` means an absent
iproute2 family table.
See `doc/troubleshooting/iproute2-family-fib-table-absence.md`.

## Rust BPF loader

Package:
 `package/cli/wg-quicker-exempt/`.

Public commands:

```text
wg-quicker-exempt attach <mark> <cgroup-dir>...
wg-quicker-exempt detach <cgroup-dir>...
wg-quicker-exempt list-targets <uid>
wg-quicker-exempt watch-start <key> <mark> <uid>
wg-quicker-exempt watch-stop <key>
```

The crate depends only on `libc` and uses stable raw `bpf(2)` UAPI.
No unvetted hashing or BPF library dependency was added.

### Program correctness

- ABI size and offset assertions cover every used `bpf_attr` arm.
- Big-endian targets fail at compile time.
- `BPF_ST_MEM32` is opcode `0x62` and writes at correct stack offset.
- Null map lookup jumps directly to allow return.
- `bpf_setsockopt` helper `49` receives four-byte `SO_MARK` value.
- Helper success allows socket operation.
- Helper failure denies socket operation.
- `OwnedFd` closes map,
  program,
  and link descriptors through all error paths.

### Pin lifecycle

Canonical cgroup path bytes are encoded injectively as chunked hexadecimal components.
This avoids slash replacement collisions,
bpffs-reserved dots,
and component-length overflow for supported paths.

The loader verifies:

- `/sys/fs/bpf` has bpffs magic `0xcafe4a11`;
- bpffs is a distinct mount boundary;
- staging and final directories are on same filesystem.

Four new links are created in staging.
First attach uses rename.
Replacement uses `renameat2(RENAME_EXCHANGE)`.
Failed attachment removes earlier new pins and preserves prior complete set.
Detach removes only four exact expected names,
then calls `rmdir` so unrelated entries block removal.

### Linux SELinux pin regression

Kernel `7.1.3-ogc5.1.fc44.x86_64` returns `EINVAL` from `BPF_OBJ_PIN` because SELinux initializes inode security state before
checking `SBLABEL_MNT` on bpffs.
The package detects typed `BPF_OBJ_PIN EINVAL` without diagnostic-string matching.

On affected kernels it uses detached descriptor keeper:

- candidate creates all links before readiness;
- candidate exits on parent-pipe EOF before commit;
- parent persists transition state before sending `COMMIT`;
- child writes commit marker before `COMMITTED`;
- recovery rejects uncommitted candidate and preserves prior holder;
- recovery adopts committed candidate;
- detach validates PID,
  start time,
  full command,
  mark,
  and cgroup;
- shutdown escalates validated process from `SIGTERM` to `SIGKILL` when required;
- removed cgroups still map to lexical state key for cleanup.

See `doc/troubleshooting/linux-bpffs-selinux-object-pin-einval.md` for source trace,
reproduction,
upstream patch,
and filing decision.

## Ghostty, Steam, and Helium coverage

`wg-quicker` starts Rust watcher only after bypass route exists.
It stops watcher before removing bypass routing.
Changed config without `ExemptMark` still stops watcher when persisted bypass state proves prior ownership.

Every `up` whose parsed config omits `ExemptMark` emits a non-fatal warning before network mutation.
It states that Ghostty, Steam, and Helium will use the tunnel and instructs the user to add
`ExemptMark = 8888` under
`[Interface]`,
then bring the interface down and up again so application exemptions attach.
`down` does not emit this warning.

Target UID precedence:

1. `WG_QUICKER_EXEMPT_UID`;
2. `SUDO_UID`;
3. non-root effective UID.

Direct root execution without explicit or sudo identity fails closed.
A non-root `wg-quicker` process relaunches exact current Node runtime and CLI bundle through sudo before config access.
This avoids root-only config `EACCES` and sudo `secure_path` lookup failure while preserving `SUDO_UID`.
A private bounded caller-context file carries allowlisted home,
cache,
token,
runtime,
UID,
and companion settings through sudo `env_reset`.
Root child validates file type,
ownership,
mode,
link count,
size,
schema,
and caller identity before applying it.

Before network mutation,
application exemption command resolves to exact configured path,
paired repository Rust build,
privileged installed command,
or captured caller-path command.
Missing configured companion fails before interface creation.

Watcher behavior:

- watches existing user `app.slice`;
- installs inotify before first scan;
- attaches Ghostty main service;
- attaches every existing Ghostty surface scope;
- drains queued creation events and rescans before readiness;
- attaches future Ghostty surface scopes;
- identifies Steam's `app-steam@*.service` immediately;
- identifies Helium Chrome application-ID service immediately;
- maps live Helium,
  renderer,
  zygote,
  and crashpad executables to current cgroups;
- periodically rescans processes entering existing cgroups;
- retains known Helium cgroups through process restarts until cgroup removal;
- holds links directly for watcher lifetime;
- drops every link on validated watcher shutdown.

Final read-only host audit found all current targets:

- all `11` Ghostty service and surface cgroups were listed;
- all `16` live Helium executable processes mapped to listed cgroups;
- no current target was missing.

No real application cgroup was marked during this audit.
State-mutating watcher tests used disposable cgroups.

## Verification evidence

### AllowedIPs packages

Passed:

```text
mise run //package/module/wg-allowedips:buildAndTest
mise run //package/module/wg-allowedips:lint:types
mise run //package/module/wg-allowedips:lint:oxlint
mise run //package/cli/wg-allowedips:buildAndTest
mise run //package/cli/wg-allowedips:lint:types
mise run //package/cli/wg-allowedips:lint:oxlint
```

Built CLI tests cover minimized output,
complete subtraction,
missing options,
unknown options,
positional input,
unreadable files,
parser failures,
DNS absence warnings,
and empty allowed input.

### OpenTofu consumer

Passed:

```text
mise run //package/config/tofu:test
mise run //package/config/tofu:lint
```

OpenTofu validation succeeded.
ASN cache tests covered filtering,
atomic replacement,
corrupt cache rejection,
and malformed records.

### `wg-quicker`

Passed:

```text
mise run //package/cli/wg-quicker:buildAndTest
mise run //package/cli/wg-quicker:lint:types
mise run //package/cli/wg-quicker:lint:oxlint
mise run //package/cli/wg-quicker:test:integration:bypass
mise run //package/cli/wg-quicker:test:integration:route
```

Disposable netns integration covers:

- table and preference collisions;
- literal `/0` and two-`/1` full-tunnel forms;
- marked and unmarked IPv4 and IPv6 routing;
- missing physical defaults;
- single-family fail-closed defaults;
- watcher resynchronization and monitor restart;
- operation-lock contention;
- wrong-owner state retention;
- unowned-default rejection;
- unrelated route preservation;
- changed-config teardown;
- built CLI `up` and `down`;
- exact IPv4 and IPv6 IVPN conflict rejection before interface creation;
- physical connected-route precedence over broad dual-stack policy prefixes;
- an IPv4 endpoint covered by non-default `AllowedIPs`;
- marked physical endpoint routing and bidirectional WireGuard transfer;
- actionable missing-`ExemptMark` warning on `up` and warning absence on `down`.

### `wg-quicker-exempt`

Passed:

```text
mise run //package/cli/wg-quicker-exempt:buildAndTest
mise run //package/cli/wg-quicker-exempt:test:functional
```

Privileged disposable-cgroup tests cover:

- TCP4 connect;
- TCP6 connect;
- UDP4 sendmsg;
- UDP6 sendmsg;
- process-exit persistence;
- repeated attach with changed mark;
- exact detach;
- partial-link rollback;
- failed candidate replacement preserving prior holder;
- pre-transition parent death;
- committed and uncommitted transition recovery;
- wrong-owner state retention;
- removed-cgroup cleanup;
- existing and future Ghostty scope coverage;
- public watcher start and stop lifecycle.

Unit tests additionally cover target-name precision,
fake procfs Helium mapping,
path-key injectivity,
exact cleanup,
atomic exchange,
failed-exchange preservation,
instruction width,
and control-flow offsets.

### Documentation and workspace state

Markdown lint passed for affected documentation.
`git diff --check` passed before each commit.
No watcher,
disposable cgroup,
runtime state,
or unexpected pin remained after final verification.

## Operational notes

- Build `wg-quicker-exempt` release artifact or install it in privileged or caller `PATH`.
- Use `WG_QUICKER_EXEMPT_COMMAND` for an explicit executable;
  launcher resolves it before network mutation.
- Use root-owned installed artifacts when workspace integrity is not trusted.
- Use `ExemptMark = 8888` or another positive mark in `[Interface]`.
- Invoke `wg-quicker` normally;
  it uses sudo before config access and preserves original identity through `SUDO_UID`.
- Set `WG_QUICKER_EXEMPT_UID` explicitly for direct root or service execution.
- Use `wg-quicker-exempt list-targets <uid>` for read-only coverage audit.
- Keep IVPN Desktop split tunneling disabled while this tunnel is active.
- Ask before bringing up `mx-que-mx1` or mutating its live routes.
