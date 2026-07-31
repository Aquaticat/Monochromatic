# `wg-quicker` handover

## Goal and safety boundary

Finish a production-ready `wg-quick up/down` replacement that:

- handles a large `AllowedIPs` value without Bash's superlinear trim behavior;
- supports peer-local `AllowedIPsFromFiles = <allowed> <disallowed>` generation;
- exempts all Ghostty sockets across existing and future surface scopes;
- exempts Helium sockets;
- uses cgroup-BPF socket marking plus policy routing;
- keeps the privileged BPF loader in Rust;
- does not move Ghostty into another systemd slice.

Do not bring up the real `mx-que-mx1` tunnel without asking first.
Root and sudo are authorized only for disposable netns or VM verification.

Both TypeScript CLIs must statically import the shared module.
Do not introduce a CLI-to-CLI dependency.

## Task state at restart

- Completed task `#1`:
   assess the handover.
- Completed task `#2`:
   extract the shared AllowedIPs module.
- Completed task `#3`:
   correct `AllowedIPsFromFiles` semantics.
- Completed task `#4`:
   harden bypass routing.
- In-progress task `#5`:
   harden the Rust BPF loader lifecycle.
- Pending task `#6`:
   cover Ghostty and Helium cgroups,
   blocked by task `#5`.
- Pending task `#7`:
   complete all verification,
   blocked by tasks `#4` and `#6`.

Resume task `#5` first.

## Completed commits

The relevant completed logical units are:

```text
b8958bde1 initial inherited implementation
7e37cbf76 shared AllowedIPs module and static consumers
68eb96063 peer-local AllowedIPsFromFiles semantics
cd72d867d bypass-routing hardening work
5016bffd0 bypass-routing hardening work
7eda14e17 bypass ownership lifecycle
6d785d0a2 watcher process-group termination
c3bb6735a exact bypass route ownership persistence
```

Later unrelated documentation commits are also present at `HEAD`.
Do not alter or include unrelated issue 401 files in `wg-quicker` commits.

## Completed TypeScript work

### Shared AllowedIPs ownership

`package/module/wg-allowedips/` now owns:

- generation from allowed and disallowed text;
- parser,
   network,
   and lookup types;
- DNS and ASN lookup orchestration;
- explicit IPinfo ASN cache ownership.

Consumers use static workspace imports from
`@monochromatic-dev/module-wg-allowedips/ts`.
Runtime `import.meta.resolve()` and CLI-to-CLI imports were removed.
Built CLI and config bundles were exercised outside the workspace.

### Peer-local file generation

`AllowedIPsFromFiles` is scoped to its containing `[Peer]`.
Expansion preserves the directive's insertion point.
The parser rejects duplicate directives and conflicts with literal `AllowedIPs` in the same peer.
Multiple peers are supported.
`down` calls config loading without file,
 DNS,
 or ASN expansion.

### Bypass routing

`package/cli/wg-quicker` now provides:

- dynamic dual-stack bypass-table allocation;
- preference selection before all existing positive-priority rules;
- per-interface and global `flock` operation locks;
- fail-closed unreachable defaults for a missing address family;
- detached route watcher in the caller's network namespace;
- watcher PID,
   owner,
   start-time,
   and full-command validation;
- process-group shutdown with disappearance confirmation;
- monitor-child restart and synchronization before event-loss exposure;
- state schema version `2` with exact kernel-rendered route fingerprints;
- transition-state persistence;
- teardown of only persisted exact routes;
- state retention after cleanup failure;
- rejection of unrecorded defaults before mutation.

Protocol `201` is only a route tag.
It is not sufficient proof of ownership.

The exact iproute2 missing-family translation is documented in
`doc/troubleshooting/iproute2-family-fib-table-absence.md`.
Only exit `2` with the selected family's exact `FIB table does not exist` diagnostic and `Dump terminated` means absence.

Disposable netns integration coverage includes table and preference collisions,
 literal `/0`,
 two `/1` prefixes,
 IPv4 and
IPv6 marked routing,
 missing defaults,
 single-family fail-closed behavior,
 watcher resynchronization and restart,
 lock
contention,
 wrong-owner retention,
 unowned-default rejection,
 unrelated-route preservation,
 changed-config teardown,
 and
built CLI `up` and `down`.

Task `#4` passed `buildAndTest`,
 `lint:types`,
 `lint:oxlint`,
 Markdown lint,
 and `test:integration:bypass` before its final
commits.
An independent review found no concrete task `#4` blocker.
The real tunnel was not brought up.

## In-progress Rust loader work

Package:
 `package/cli/wg-quicker-exempt/`.

The crate continues to use only `libc` and the stable raw `bpf(2)` UAPI.
No new dependency was adopted,
 so no technology-selection report is pending.

### Uncommitted files

At this checkpoint,
 `git status --short` reports only:

```text
 M package/cli/wg-quicker-exempt/mise.toml
 M package/cli/wg-quicker-exempt/src/bpf.rs
 M package/cli/wg-quicker-exempt/src/main.rs
?? package/cli/wg-quicker-exempt/src/bpf_tests.rs
?? package/cli/wg-quicker-exempt/src/pin.rs
```

These Rust changes are not complete and have not been committed.

### Implemented during task `#5`, not fully verified

`src/bpf.rs` currently includes:

- a little-endian compile-time guard for instruction bitfield encoding;
- compile-time ABI size and offset assertions;
- `OwnedFd` ownership for map,
   program,
   and link descriptors;
- corrected `BPF_ST_MEM32` opcode `0x62`;
- named four-byte `SO_MARK` option length;
- null map lookup jumping directly to allow;
- explicit inspection of `bpf_setsockopt` helper result;
- fail-closed deny return when marking fails;
- rollback of earlier pins after a partial four-hook attach failure;
- test-only instruction snapshots.

The installed Linux UAPI header confirms `BPF_FUNC_setsockopt` is helper `49`.
An advisor incorrectly suggested helper `35`;
 do not change the verified value `49`.

`src/pin.rs` currently includes:

- `/sys/fs/bpf` `statfs` magic validation using `0xcafe4a11`;
- mount-boundary validation through differing device identities from `/sys/fs`;
- exact mirrored canonical cgroup paths under `/sys/fs/bpf/wg-quicker-exempt/`;
- no collision-prone slash replacement and no hashing dependency;
- a global `/run/wg-quicker-exempt.lock` `flock` lifecycle lock;
- same-parent staging directories on bpffs;
- exact four-pin deletion followed by `rmdir` only;
- stale staging cleanup while holding the lifecycle lock;
- first attach through plain rename;
- reattach through atomic `renameat2(RENAME_EXCHANGE)`;
- rollback of staged new pins if exchange fails;
- detach through exact persisted pin removal.

A disposable host probe confirmed that directory `RENAME_EXCHANGE` succeeds on the mounted bpffs when invoked correctly with
no-target-directory semantics.

`src/main.rs` now parses:

```text
wg-quicker-exempt attach <mark> <cgroup-dir>...
wg-quicker-exempt detach <cgroup-dir>...
```

`src/bpf_tests.rs` has instruction tests for the 32-bit key store,
 null jump,
 helper call,
 and helper-result verdict.
`mise.toml` has a new `test:unit` task and includes it in `buildAndTest`.

### Verification already run on this uncommitted Rust state

These commands passed after the edits listed here:

```text
mise run //package/cli/wg-quicker-exempt:build:debug
mise run //package/cli/wg-quicker-exempt:lint
mise run //package/cli/wg-quicker-exempt:lint:clippy
mise run //package/cli/wg-quicker-exempt:lint:rust
```

The Clippy pass occurred after fixing explicit lock-file truncate behavior and closure returns.
The unit tests were added after that pass and have not yet been run.
The latest stale-staging and cleanup edits also require rerunning all checks.

### Required task `#5` follow-up

Before committing task `#5`:

1. Run `test:unit`,
    `buildAndTest`,
    and every package lint task.
2. Review `src/pin.rs` transaction behavior for all cleanup-error branches.
3. Ensure failed attach rollback reports cleanup failure rather than hiding it.
4. Add tests for collision-free canonical pin mapping and exact detach behavior.
5. Add privileged functional tests in a disposable cgroup fixture for:
   - TCP4 connect;
   - TCP6 connect;
   - UDP4 sendmsg;
   - UDP6 sendmsg;
   - link persistence after loader exit;
   - detach;
   - repeated attach with a changed mark;
   - partial four-hook rollback;
   - failed replacement preserving the prior working attachment.
6. Verify replacement using observable socket marks and,
    if practical through raw UAPI,
    changed BPF link identity.
7. Update `package/cli/wg-quicker-exempt/README.md` with detach,
    mirrored pin paths,
    bpffs validation,
    atomic replacement,
   fail-closed helper behavior,
    and little-endian support.
8. Run an independent review.
9. Commit only the package files for task `#5` after all checks pass.

Do not use `bpftool` as an assumed runtime dependency.
It was not installed on the host when checked.

## Task `#6`: Ghostty and Helium coverage

Do not move Ghostty into another slice.

Observed Ghostty cgroups have these forms:

```text
app-com.mitchellh.ghostty@<id>.service
app-ghostty-surface-transient-<pid>.scope
```

Required behavior:

- attach to the existing Ghostty service cgroup;
- enumerate every existing surface scope;
- watch `app.slice` for newly created or moved-in surface scopes;
- install the watch before rescanning to close the creation race;
- attach every future surface scope;
- cover sockets from commands running inside every surface scope;
- detach and clean persisted links safely on tunnel down.

Helium is an AppImage observed under `flatpak-session-helper.service` with multiple processes.
Choose a cgroup boundary that contains browser,
 renderer,
 zygote,
 crashpad,
 and restarted descendants.
Verify that containment rather than assuming it.

## Task `#7`: final verification

After tasks `#5` and `#6`:

- rerun all affected package builds,
   tests,
   TypeScript lint,
   Rust checks,
   and Markdown lint;
- rerun disposable netns routing integration;
- exercise both built CLIs at their consumer boundaries;
- exercise all four BPF protocol hooks and application lifecycle integration;
- confirm teardown leaves no owned rules,
   routes,
   watcher,
   state,
   or pins;
- confirm unrelated policy routes and pins remain untouched;
- inspect `git status` and commit each completed logical unit;
- update this handover to completion state.

Ask before any command that could bring up `mx-que-mx1`.

## Commands for immediate resume

From repository root:

```sh
mise run //package/cli/wg-quicker-exempt:test:unit
mise run //package/cli/wg-quicker-exempt:buildAndTest
mise run //package/cli/wg-quicker-exempt:lint:clippy
mise run //package/cli/wg-quicker-exempt:lint:rust
```

Use repository `mise` tasks rather than raw Cargo when a suitable task exists.
Use disposable fixtures for state-mutating verification.
