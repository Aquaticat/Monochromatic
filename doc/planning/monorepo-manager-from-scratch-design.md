# From-scratch monorepo manager design

## Status

- Status:
   draft design.
  On 2026-09-16 the stack narrowed to one remaining route:
   an all-Rust tool with file-enforcer rewritten in Rust.
  Its configuration hosting,
   rewrite scope,
   and binary build remain open,
   and no decision record exists.
- Session state,
   commits,
   and next action:
   [`doc/handover/monorepo-manager.md`](../handover/monorepo-manager.md).
- Route comparison:
   [`monorepo-manager-build-routes.md`](monorepo-manager-build-routes.md).
- Requirements checklist:
   [`tech-monorepo-manager-vet-2026-09-16.md`](../audit/tech-monorepo-manager-vet-2026-09-16.md),
   sections "Requirement checklist" and "Frozen hard constraints".
- Scope:
   design only;
   no code is written before a route is chosen.

## User-stated design requirements

Stated by the user on 2026-09-16.

### Process model

- The user runs one long-running process in its own terminal.
- Clients control that process over RPC.
- For now the process prints logs and reacts only to Ctrl+C;
   a TUI comes later.

### Default behavior

- By default the process watches the entire repository.
- On every change it builds everything affected
   and runs the default set of tests for everything affected.
- Caching is on by default,
   and at this stage it cannot be turned off.
- On filesystems that support it,
   the process uses filesystem features to speed up change comparison.
  For 0.x,
   btrfs is the only supported filesystem for this,
   per the user's correction on 2026-09-16 that dropped ZFS.
- The process may create btrfs subvolumes and snapshots whenever it wishes.

### Doctor command

- The tool provides a `doctor` command.
- `doctor` tells the user which commands to run or which files to edit,
   and why,
   to enable capabilities the environment currently blocks.
- The user's example:
   a btrfs mount lacking `user_subvol_rm_allowed`,
   which `doctor` reports with the exact change and its reason.

### Scheduling and control

- Every task given to the process has a priority,
   defaulting to 0 when unspecified.
- Concurrency defaults to the machine's available parallelism,
   with an environment variable override.
- A client can change a task's priority,
   pause a task,
   end a task,
   and perform similar task controls.

### Distribution

- Hard requirement:
   the tool ships as a single file that a user runs directly,
   as in `./meow`
   (`meow` is a placeholder name).
- Unpacking at run time is acceptable,
   as AppImage does.
- A single file that carries Node is too big,
   per the user's decision recorded in "Single-file shipping and a file-enforcer rewrite".

## Measured environment

Measured 2026-09-16 on the development machine:

- The repository is on btrfs:
   `findmnt` reports subvolume `/home` mounted `rw,relatime,seclabel,ssd,discard=async,space_cache=v2`,
   without `user_subvol_rm_allowed`.
- The repository checkout itself is not a subvolume:
   `btrfs subvolume show /var/home/user/Monochromatic` reports "Not a Btrfs subvolume".
- Node `v26.8.2` exposes `os.availableParallelism()` and `navigator.hardwareConcurrency`;
   both return 16.
  Node has no API named `availableConcurrency`,
   the term the user used.
  With the all-Rust route,
   the concurrency source is `std::thread::available_parallelism`,
   which returned `Ok(16)` under rustc `1.100.0-nightly` (0fc141305 2026-09-11)
   (`parallelism-probe/main.rs` in the session scratchpad).
- 104 packages define `test:unit` and 23 define `test`;
   rarer test tasks include `test:container`,
   `test:wayland`,
   `test:mutation`,
   `test:integration`,
   `test:conformance`,
   network resolver tests,
   and instrumented device tests.

### Answers on 2026-09-16

- Default test set:
   every test suite except heavy suites.
- Pausing:
   holds queued tasks and freezes running tasks.
- Platforms:
   only Linux support is required for 0.x.
- First-version controls besides changing priority,
   pausing,
   and ending:
   resuming a paused task,
   listing tasks and their state,
   and queueing or rerunning a task by hand.
  Changing concurrency at runtime is not in the first version.

### Further answers on 2026-09-16

- Platforms:
   everything in 0.x is Linux only.
- Sandboxing is a must,
   using at least cgroups.
  The kernel cgroup v2 documentation lists CPU,
   memory,
   IO,
   PID,
   and cpuset controllers and a `cgroup.freeze` interface that stops every process in a cgroup and its descendants
   (<https://docs.kernel.org/admin-guide/cgroup-v2.html>);
   it provides no filesystem access control.
  Cgroups therefore cover resource limits and pausing,
   while restricting undeclared file reads needs a separate mechanism or the lint-level enforcement recorded in
   [`monorepo-manager-build-routes.md`](monorepo-manager-build-routes.md).
- Heavy suites are test files whose names match `*.expensive.*.test.*`.
  Four files match today:
  `package/dev-script/task-util/src/tsc-filter.expensive.unit.test.ts`,
  `package/module/image-diff/src/client.expensive.unit.test.ts`,
  `package/cli/vmsync/src/lifecycle.expensive.unit.test.ts`,
  and `package/cli/mvm/src/backend/hetzner/provision.expensive.unit.test.ts`.
  Suites that are heavy today only by task name,
   such as `test:container` or `test:wayland`,
   are not excluded by this rule unless their files adopt the naming.
  The user considers expensive tests without the naming a user error:
   the daemon runs them by default and does not add a fallback classification.
- The user delegated the concurrency override name.
  Chosen:
   `MONOCHROMATIC_JOBS`.
  The prefix follows the repository's existing environment variables,
   such as `MONOCHROMATIC_VERBOSE` and `MONOCHROMATIC_WARN`;
   `JOBS` follows Bazel's `--jobs` option
   (`src/main/java/com/google/devtools/build/lib/buildtool/BuildRequestOptions.java` in the Bazel source)
   and the `--jobs` convention of Make-style build tools.
  If the tool receives its own name,
   the prefix follows that name.

### Sandboxing scope answer

For 0.x,
sandboxing is cgroups only,
without restricting file reads,
per the user on 2026-09-16.
Undeclared reads stay covered by lint-level enforcement;
read restriction is left for a later version.

## Design

Research with citations and verified or unverified labels:
[`monorepo-manager-route-research/from-scratch-inputs.md`](monorepo-manager-route-research/from-scratch-inputs.md).

### Tech stack options

#### Current stack direction

As of 2026-09-16,
the only remaining route is an all-Rust tool with file-enforcer rewritten in Rust,
shipped as one binary.
Every other option is out:

- TypeScript on Node and every shape that ships Node inside the single file,
   including a TypeScript daemon with a Rust native addon
   and the Rust core with TypeScript file-enforcer children:
   Node single executables are too big,
   per the user's decision in "Single-file shipping and a file-enforcer rewrite".
  The Rust core with TypeScript children is out by inference from that reason,
   open to the user's veto.
- Kotlin JVM core,
   all Kotlin on the JVM,
   Kotlin/Native,
   Bun,
   Deno,
   Python,
   OCaml,
   and .NET:
   the user judged them not worth further research.
- Go and Zig:
   excluded by the user before design.

Being designed:
the all-Rust tool's configuration-hosting variants,
byte-for-byte output parity for file-enforcer's structured edits,
rewrite scope,
and single-binary build and size.
Candidate hosts include plain Rust code,
Starlark through `starlark-rust`,
Rhai,
Lua through `mlua`,
an embedded JavaScript engine such as `rquickjs`,
`boa`,
or `deno_core`,
declarative formats such as TOML,
KDL,
Nickel,
CUE,
or Pkl,
and WebAssembly plugins.

Measured rewrite scope,
2026-09-16:
`package/dev-script/file-enforcer/src` holds 81 non-test `.ts` files with 36,381 lines,
of which `data/packages.generated.ts` is 22,607 generated lines,
the OS package index that Meta Package Manager may replace;
the remaining 80 files hold 13,774 lines.
The root `file-enforcer.config.ts` is 2,329 lines.
Outside the package,
`package/dev-script/vm-builder/src/import.ts` and `build-and-import.ts` import `exec` from its `/ts` subpath,
and `package/test-fixture/file-enforcer-perf` benchmarks it.

The subsections from "Findings that apply to every stack" through "Running tasks under a pseudo terminal"
record how the stack narrowed,
including rankings later superseded.

#### Selection history

Every option in "Designed options and their worst problems" was designed against the same requirements until its disqualifying problems surfaced,
per rule `YKZ`;
full designs,
probes,
and citations live in the `stack-*.md` appendices of
[`monorepo-manager-route-research/`](monorepo-manager-route-research/).
An earlier surface-level ranking was withdrawn after the user's correction on 2026-09-16.
Go and Zig are excluded by the user.
Approval of a language for this scope is separate,
per `doc/planning/load-bearing-code-languages.md`.

#### Findings that apply to every stack

- glibc 2.39 and later provide `pidfd_spawn` with `posix_spawnattr_setcgroup_np`,
   which starts a child directly inside a cgroup;
   a probe from Python `ctypes` succeeded against the probe's own cgroup.
  Its only documentation is the glibc NEWS file and a header.
- The documented fallback is re-executing a launcher that joins the cgroup and then `exec`s the task,
   or `systemd-run --user --scope --expand-environment=no` per task.
- Writing `cgroup.procs` after start measured a 9.7-millisecond median on this host,
   whose cgroup mount lacks `favordynmods`.

#### Designed options and their worst problems

- TypeScript on Node
   (`stack-typescript.md`):
   cgroup placement before start and watch-overflow detection use `node:ffi`,
   documented as "Stability: 1 - Experimental" since v26.1.0;
   built-in `fs.watch` silently drops events after an inotify queue overflow;
   recursive `fs.watch` watched 41,205 paths with 662 milliseconds of blocking setup;
   Node's documentation has contradictions on the `fs.watch` and FFI pages the design uses.
  A stable fallback exists:
   `systemd-run --scope` per task and per-directory watching with periodic rescans.
- Rust core with TypeScript file-enforcer children
   (`stack-rust.md`):
   task spawning into cgroups is repository-written `unsafe` code,
   because Rust's standard library lacks `clone3` and `libc` declares `CLONE_INTO_CGROUP` as a `c_int` that overflows;
   `notify`,
   `jsonrpsee`,
   and `cgroups-rs` fail the documentation rule or the requirements,
   so the watcher and JSON-RPC framing are hand-written;
   each file-enforcer rerun pays about 147 milliseconds of Node startup;
   Rust and TypeScript event types need one shared schema.
- All Rust
   (`stack-rust.md`):
   every Rust core problem plus a rewrite of 79 file-enforcer modules and no workable host for the 2,330-line TypeScript configuration.
  The Rust core problems were later corrected by the crate-level research in "Library-level results",
   and configuration hosting is being redesigned as recorded in "Current stack direction".
- Kotlin JVM core with TypeScript file-enforcer children
   (`stack-kotlin.md`):
   Kotlin documentation pages every Kotlin option needs contradict themselves or the library source;
   `ProcessBuilder` cannot place a child in a cgroup,
   so spawning needs JDK 25's foreign-function API beside the pinned JDK 21;
   the JDK watcher is not recursive and can stop silently.
- All Kotlin on the JVM
   (`stack-kotlin.md`):
   the Kotlin JVM core problems plus a port of about 13,774 file-enforcer lines;
   GraalVM Native Image is discontinued for Java SE customers.
- Kotlin/Native
   (`stack-kotlin.md`):
   the linker toolchain is frozen at glibc 2.19 and kernel 4.9 headers with no fix date,
   leaving `pidfd_spawn` and 11 other needed functions unbound;
   Ktor's native sockets fail at file descriptors 1024 and above.
- TypeScript on Bun
   (`stack-typescript.md`):
   the pinned 1.3.14 silently ignores the `cgroup` spawn option,
   so the sandbox is off without an error;
   fixes exist only in the 1.4 rewrite that `mise.toml` distrusts;
   the design conflicts with the repository's Bun-islands policy.
- TypeScript on Deno
   (`stack-typescript.md`):
   recursive `Deno.watchFs` blocked for 131 seconds and still watched `node_modules`;
   pending async FFI calls stalled file reads for 1.9 seconds.
- Python
   (`stack-others.md`):
   named unapproved in `doc/planning/load-bearing-code-languages.md`;
   the GIL makes threaded hashing slower than serial;
   all kernel work goes through untyped `ctypes`.
- OCaml
   (`stack-others.md`):
   Eio documents that forked-child code must be C;
   mise provides no OCaml compiler.
- C# on .NET NativeAOT
   (`stack-others.md`):
   Microsoft's own interop pages disagree on whether `DllImport` works under Native AOT,
   and every kernel call in the design is a P/Invoke.

Considered and excluded before design,
with reasons in `stack-others.md`:
Swift,
Java without Kotlin,
C++,
Haskell,
Nim,
Crystal,
and Elixir or Gleam.

#### Ranking

The ranking depends on a preference the user has not stated:
whether the documentation confusion rule applies to language runtime and library documentation
at the same strictness as it applied to monorepo manager candidates.
The research agents applied it unevenly:
the Kotlin research culled on contradictions,
the TypeScript research recorded Node contradictions without culling,
and the Rust research excluded typos.

If runtime documentation problems are recorded but do not cull:
Node > Rust core with TypeScript children > Kotlin JVM core with TypeScript children > Python > Bun > Deno > OCaml > .NET >
all Kotlin on the JVM > all Rust > Kotlin/Native.

- Node over Rust core:
   Node has a stable fallback for each experimental dependency and stays in one language,
   while the Rust core hand-writes unsafe spawning,
   the watcher,
   RPC framing,
   and a cross-language schema.
- Rust core over Kotlin JVM core:
   both hand-write process control,
   but Kotlin adds a second JDK version and a watcher that can stop silently.
- Kotlin JVM core over Python:
   Python is recorded as unapproved.
- Python over Bun:
   Bun's pinned version turns the sandbox off silently and conflicts with the Bun-islands policy.
- Bun over Deno:
   Deno's watcher and FFI stalls block the core loop,
   while Bun's defects have fixes in a newer release.
- Deno over OCaml:
   OCaml requires C for cgroup placement and has no mise toolchain.
- OCaml over .NET:
   the .NET contradiction is on its own interop pages that every kernel call depends on.
- .NET over all Kotlin on the JVM,
   all Rust,
   and Kotlin/Native:
   each of those three adds a file-enforcer rewrite or port,
   and Kotlin/Native also lacks the needed glibc bindings.

If runtime documentation problems cull as strictly as for tool candidates,
Node,
every Kotlin option,
Bun,
Deno,
and .NET exit,
leaving Rust core with TypeScript children > Python > OCaml > all Rust,
for the same adjacent reasons.

#### Resolved preferences on 2026-09-16

- The documentation confusion rule records runtime and library documentation problems for building the tool
   but does not cull on them.
  The first ranking applies,
   so TypeScript on Node leads.
- The design may depend on experimental `node:ffi` for placing tasks into cgroups before they start
   and for detecting inotify queue overflow.
  Node's FFI documentation says the module can be disabled with `--no-experimental-ffi`,
   and the TypeScript research reports it enabled by default from v26.9.0;
   the repository currently resolves Node v26.8.2,
   so the minimum Node version or flag is an implementation detail to pin.

Node hashing measurement,
2026-09-16,
Node v26.8.2,
sequential `readFile` plus one hash per git-tracked file,
8,087 files and 144.5 MiB,
five runs each
(`node-hash-bench.ts` in the session scratchpad):

- SHA-256:
   minimum 417 milliseconds,
   median 437,
   maximum 843,
   the maximum from the first run.
- BLAKE2b-512:
   minimum 486 milliseconds,
   median 494,
   maximum 502.
- Resident memory after both series:
   224.0 MiB,
   which includes read buffers and is not a daemon footprint measurement.

A full sequential rehash stays under one second on this machine,
so hashing throughput does not decide the stack.

Recommended stack at that point:
TypeScript on Node,
following from these answers.
Superseded by "Library-level results" and then by the single-file decision.

#### Research gap found on 2026-09-16

The user challenged the ranking's basis:
the Node research evaluated built-in `fs.watch` although the repository already uses `chokidar`
in `package/dev-script/file-enforcer` and `package/dev-script/watch-restart`,
and the Rust research concluded that cgroup placement,
the watcher,
and JSON-RPC must be hand-written and `unsafe`
without surveying crate alternatives or the repository's existing `zbus` 5,
`tokio`,
and `ignore` dependencies.
The repository also already uses `@homebridge/dbus-native` in `package/kwin/key-helper`.
Library-level research for both leading options was redone:
`stack-node-libraries.md` and `stack-rust-crates.md`.

#### Library-level results

Revised Node design:
`chokidar` for watching with daemon-side re-hashing,
`systemd-run --user --scope` per task,
`@homebridge/dbus-native` for `FreezeUnit`,
`ThawUnit`,
and `KillUnit`,
`json-rpc-2.0` with `readLines` from `@monochromatic-dev/mcp-stdio`,
plain `child_process`,
and `node:crypto`.
Remaining Node problems:

- `chokidar` watches every file at repository scale:
   41,209 watches,
   1.74 to 1.78 seconds to ready,
   and 403 MiB resident memory (measured by the research).
  Its open issue `paulmillr/chokidar#1455`,
   "Event throttling discards updates",
   drops a second change within 50 milliseconds.
- No Node watcher library reports inotify queue overflow;
   a worker-thread canary detected losses on a fixture,
   unproven at repository scale.
- `@parcel/watcher`,
   the alternative,
   misses directories created or moved in after start without any event.
- Node's `'pipe'` stdio gives children a socket,
   so a task that writes `> /dev/stdout` fails:
   `sh -c 'echo probe > /dev/stdout'` spawned with piped stdio exited 1 with
   "/dev/stdout: No such device or address"
   (measured 2026-09-16).
- Pure-JavaScript D-Bus libraries cannot pass file descriptors,
   and systemd marks `FreezeUnit` and `ThawUnit` as not documented.
- The systemd scope model and a daemon-owned delegated cgroup need different freeze,
   kill,
   and doctor logic.

Revised Rust core design,
with no `unsafe` in repository code
(probes compiled under `#![forbid(unsafe_code)]`):
a launcher that writes its own PID into the task cgroup and calls std's `CommandExt::exec`,
direct cgroup file writes under a delegated cgroup,
the `inotify` crate with a directory walk filtered by the repository's `ignore` dependency,
`tokio-util` `LinesCodec` with `serde_json` for JSON-RPC,
`tokio::process` and `tokio::signal`,
`rustix` `ioctl_ficlone`,
and `btrfs-uapi` 0.13.0 for subvolumes and snapshots.
The development machine's systemd 259.8 user manager exposes `StartTransientUnit`,
`FreezeUnit`,
`ThawUnit`,
and `KillUnit` over D-Bus
(`busctl --user introspect`,
measured).
Remaining Rust problems:

- Moving a task into a new cgroup,
   freezing it,
   and killing it are unexercised.
- Watch correctness,
   JSON-RPC subscriptions,
   and backpressure are repository code by choice after the crate survey.
- Rust and TypeScript event types can drift;
   `yerpc` generates TypeScript types but is unchecked.
- The launcher's re-exec after a rebuild replaces the daemon binary is untested.
- `btrfs-uapi` needs `libclang` at build time.
- Rust's piped stdio does not share Node's socket problem:
   the same `/dev/stdout` probe spawned through `std::process::Command` with `Stdio::piped()` exited 0 and captured the output
   (measured 2026-09-16).

Revised ranking of the two leading options:
Rust core with TypeScript file-enforcer children over TypeScript on Node.
Node's remaining problems sit in two core requirements with no library fix found:
repository-scale watching that is heavy,
lossy,
and silent about overflow,
and task stdio that breaks common shell redirections.
The Rust core's remaining problems are repository-written code chosen after a crate survey
and a cross-language schema with a generator candidate.
Node would regain the lead if single-language maintenance outweighs both of those Node problems.

The lower-ranked stacks have not had the same library-level pass.
On 2026-09-16 the user judged none of them worth further research,
so Kotlin JVM core,
all Kotlin,
Kotlin/Native,
Bun,
Deno,
Python,
OCaml,
and .NET are out of consideration.
The stack choice was then between the Rust core with TypeScript file-enforcer children and TypeScript on Node,
with the Rust core recommended,
until the single-file decision removed both.

#### Single-file shipping and a file-enforcer rewrite

Raised by the user on 2026-09-16:
the TypeScript daemon with a Rust addon may not ship as a single file,
and the user is willing to rewrite file-enforcer in Rust.

- Node single executable applications are "Stability: 1.1 - Active development",
   with built-in generation through `--build-sea` since v25.5.0.
  Native addons ship as `assets` and load by writing the asset to a temporary file and calling `process.dlopen()`
   (<https://nodejs.org/api/single-executable-applications.html>).
  One file on disk is possible,
   but the addon is extracted at run time.
- The Rust core with TypeScript file-enforcer children also needs Node and the TypeScript sources at run time,
   so it is not a single file either.
- An all-Rust tool with file-enforcer rewritten in Rust is back under consideration;
   its configuration-hosting options are being designed.

Hard requirement,
stated by the user on 2026-09-16:
the tool ships as a single file that a user runs directly,
as in `./meow`
(`meow` is a placeholder name).
Unpacking at run time is acceptable,
as AppImage does.
So a Node single executable that extracts its addon is acceptable,
while the Rust core with TypeScript file-enforcer children fails unless Node and the TypeScript sources travel inside that one file.

Top-level await is also a hard requirement for any Node single executable,
per the user on 2026-09-16.
The Node single executable documentation offers `"mainFormat": "module"` for an ECMAScript module entry point,
and its ESM entry point example uses `await import(...)` at top level.
Probe on 2026-09-16 with Node v26.8.2:
a `main.mjs` running `await new Promise(...)` and `await import("node:os")` at top level,
built with `node --build-sea` and `"mainFormat": "module"`,
ran as `./meow` and printed `top-level await ok on linux`;
the executable was 144 MiB
(`~/temp/agent/sea-tla-probe-2026-09-16`).
ECMAScript module entry points landed in `nodejs/node#61813`,
"sea: support ESM entry point in SEA",
merged 2026-02-18 with a `backport-open-v24.x` label;
before it,
single executable entry scripts were CommonJS,
which has no top-level await.
The Node version the tool builds with must include that change.

Decision on 2026-09-16:
the user killed the TypeScript route because Node single executables are too big;
the minimal probe measured 144 MiB.
By the same reason,
every shape that ships Node inside the single file is out,
including the Rust core with TypeScript file-enforcer children,
unless the user says otherwise.
The remaining route is an all-Rust tool with file-enforcer rewritten in Rust;
its configuration-hosting variants are being designed.

#### How TypeScript monorepo tools meet the same problems

Checked 2026-09-16 after the user noted that many monorepo tools are written in TypeScript.

- The `/dev/stdout` failure comes from libuv:
   `UV_CREATE_PIPE` creates child stdio with `uv_socketpair`
   (`deps/uv/src/unix/process.c:202-207` in the Node v26.8.2 source clone).
  A pseudo terminal or a real pipe avoids it.
- Nx keeps its orchestration in TypeScript but implements these parts in its Rust native addon:
   `packages/nx/Cargo.toml` in `nrwl/nx` depends on `notify = "=9.0.0-rc.5"` for watching,
   `portable-pty` for running tasks in a pseudo terminal,
   `ignore = '0.4'` for walking,
   and `xxhash-rust` for hashing,
   and `packages/nx/src/native/` contains `watch/`,
   `pseudo_terminal/`,
   and `hasher.rs`.
- So a TypeScript daemon with a Rust native addon for watching,
   task spawning,
   and hashing is a third shape that neither stack deep dive designed.
  Its design research started on 2026-09-16 and was stopped unfinished when the user killed the TypeScript route;
   Nx's addon also runs tasks under a pseudo terminal,
   which "Running tasks under a pseudo terminal" records as disqualifying.

#### Limits no stack removes

- inotify is per directory and not recursive,
   and a full queue drops events and generates `IN_Q_OVERFLOW`
   (<https://man7.org/linux/man-pages/man7/inotify.7.html>).
  The development machine's `max_queued_events` is 16,384
   (measured).
  Per the user on 2026-09-16,
   the queue limit is not a con against any stack:
   `doctor` reads `/proc/sys/fs/inotify/max_queued_events` and `max_user_watches` without root
   and tells the user how to raise them persistently,
   for example with a drop-in under `/etc/sysctl.d/`.
- Cgroup delegation,
   a user systemd session on CI,
   frozen tasks holding locks and timers,
   daemons that escape task cgroups,
   watcher correctness logic,
   and JSON-RPC subscription logic are the same work in every stack.

#### Running tasks under a pseudo terminal

Probe on 2026-09-16:
Python `pty.openpty` with the slave as a child's stdout and stderr,
running `sh` that printed to stdout,
to stderr,
tested `test -t 1`,
and wrote `> /dev/stdout`.
The master read returned `b'out\r\nerr\r\nstdout-is-tty\r\nredirect\r\n'`,
then `EIO` instead of end of file.

- Stdout and stderr arrive as one stream,
   so the daemon cannot tell them apart.
- Output newlines become `\r\n`:
   termios `ONLCR` "Map NL to CR-NL on output"
   (<https://man7.org/linux/man-pages/man3/termios.3.html>).
- Tasks see a terminal,
   so tools switch to colors,
   progress bars,
   pagers,
   or interactive prompts,
   and logs differ from non-terminal CI runs.
- Terminal control characters generate signals under `ISIG`,
   and the task's input side needs an explicit policy.
- After the child exits,
   reading the master fails with `EIO` rather than returning end of file.
- Ptys are a bounded resource:
   `/proc/sys/kernel/pty/max` is 4,096 with 15 in use
   (measured).
- `> /dev/stdout` works under a pty,
   which is the problem a pty was proposed to solve.

The user classified these pseudo-terminal costs as disqualifying problems on 2026-09-16:
tasks do not run under a pseudo terminal by default,
and any design that does,
including Nx's `portable-pty` task runner,
carries those problems.
Proposed on 2026-09-16,
open to the user's veto:
0.x offers no pseudo-terminal opt-in.
A task needs a terminal only when a person must interact with it,
such as an editor or a terminal password prompt;
the repository's interactive `mise run --raw secrets:edit` contract
(`doc/planning/mise-removal-coverage.md`)
is that kind of command,
and it runs in the user's own terminal,
outside the unattended daemon.

A real pipe solves the same problem without those costs,
in Node as well:
a Node child spawned with a FIFO write descriptor as stdout
(`real-pipe-stdio-probe.ts` in the session scratchpad)
passed `test -p /dev/stdout`,
wrote `> /dev/stdout` successfully,
and produced `stdout-is-pipe\nredirect\n` with plain newlines and exit code 0
(measured 2026-09-16).
The `/dev/stdout` failure is therefore specific to libuv's socketpair for `'pipe'` stdio,
not to Node,
and it does not decide the stack.

### Process model

- The user starts the daemon in its own terminal under a delegated cgroup,
   such as `systemd-run --user --scope -p Delegate=yes`,
   which keeps the terminal and Ctrl+C.
- The daemon moves itself into a leaf cgroup,
   then creates one cgroup per task below its delegated root.
- The development machine's user manager delegates `cpu`,
   `io`,
   `memory`,
   `pids`,
   and `dmem`
   (`user@1000.service/cgroup.controllers`,
   measured).
- 0.x logs to the terminal and handles only Ctrl+C;
   a TUI comes later.

### RPC

- Transport:
   a filesystem Unix socket under `$XDG_RUNTIME_DIR` with owner-only permissions,
   not an abstract socket,
   because abstract sockets carry no file permissions.
- Framing:
   newline-delimited JSON-RPC 2.0.
- Methods:
   list tasks,
   get one task,
   queue or rerun a task,
   end a task,
   pause,
   resume,
   and set priority.
- Notifications:
   task started,
   progress,
   and finished events modeled on Build Server Protocol task notifications,
   plus a per-task state snapshot modeled on Tilt's `UIResource`.
- Clients resume subscriptions from a sequence number,
   modeled on Watchman clocks.
- Anyone who can connect to the socket can run tasks as the user,
   so socket permissions are the security boundary.

### Scheduler

- Every task has a priority,
   default 0;
   higher priority runs first,
   and priority changes apply in place.
- Concurrency is `MONOCHROMATIC_JOBS` when set,
   otherwise `std::thread::available_parallelism`.
- Pause freezes a running task through `cgroup.freeze` and holds a queued task.
- End kills a running task tree through `cgroup.kill`,
   which also catches children that left the task's process group,
   such as a Gradle daemon.

### Watching and affected work

- The daemon watches the entire repository.
- inotify watches are per directory:
   99,416 directories exist when only `.git` is excluded,
   against 5,480 when dependency and output directories are also excluded,
   with `max_user_watches` at 524,288
   (measured).
  The watcher excludes dependency and output directories.
- Change bursts,
   such as `pnpm install` or a branch switch,
   are coalesced before the daemon schedules affected work.
- For each change,
   the daemon builds everything affected and runs every test suite except files matching `*.expensive.*.test.*`.

### Cache

- Caching is always on.
- The cache key covers the task definition,
   argument vector,
   input file content hashes,
   declared environment,
   tool versions,
   the package's lockfile slice,
   dependency outputs,
   platform,
   and a salt.
- File-enforcer's staleness manifest is not reused as the task cache,
   because it checks size and modification time for sources.
- Content hashing is the source of truth.
  btrfs features only accelerate it.

### btrfs acceleration

- Reflink copies work without root and restore cached outputs cheaply.
- `btrfs subvolume find-new` needs privileges:
   run without root on the `/var/home` subvolume,
   it fails with "Operation not permitted"
   (measured),
   so the daemon does not rely on it.
- Snapshots need the checkout to be its own subvolume.
  The checkout is not one today,
   so converting it is a one-time copy that replaces every inode
   and can disturb editors,
   git worktrees,
   and running watchers.
- Deleting subvolumes without root needs the `user_subvol_rm_allowed` mount option.
  On this bootc host,
   research found that `/etc/fstab` btrfs options may not reach the live mount;
   the remediation path is unverified.

### Doctor

- Output follows per-capability status,
   numbered problems and warnings,
   a `--json` form,
   and a non-zero exit when problems exist,
   drawing on `flutter doctor`,
   `mise doctor`,
   and `brew doctor`.
- Checks include cgroup v2 delegation and controllers,
   the btrfs mount and `user_subvol_rm_allowed`,
   whether the checkout is a subvolume,
   and inotify limits,
   each with detection,
   the exact command or file edit,
   and the reason.

### File enforcement

- File-enforcer is rewritten in Rust and ships inside the single binary.
- Configuration hosting is open;
   "Current stack direction" lists the candidate hosts.
- Enforcement of undeclared reads depends on the host:
   the lint-level enforcement the user accepted was proposed for `file-enforcer.config.ts`,
   and a new host needs its own equivalent.
- Superseded with the TypeScript route:
   running each TypeScript configuration evaluation in a child process instead of a cache-busting re-import.
- Carried over:
   file-enforcer emits typed events,
   because today's log records carry no structured fields for the activity feed.

### Migration from Mise

- 25 TypeScript files reference `MISE_MONOREPO`,
   and 41 source files reference Mise environment variables or invoke `mise`
   (research,
   verified).
- Tool provisioning,
   environment,
   and secrets stay separate owners per `mise-removal-coverage.md`.

## Risks

- Scope:
   the task graph,
   cache,
   watcher,
   scheduler,
   cgroup sandbox,
   RPC,
   and documentation are all repository-built.
- CI:
   whether GitHub runners provide a systemd user session for delegated cgroups is unverified.
- Frozen tasks keep holding locks while timers run:
   file-enforcer's manifest lock times out after 5 seconds for other writers,
   and tests may time out after resume.
- Shared daemons:
   ending one task's cgroup can kill a Gradle daemon another task reuses.
- Undeclared inputs:
   lint-level enforcement leaves stale cache hits possible.
- The vet's HC5 lists macOS and Windows CI runners,
   while the user made 0.x Linux only.
- Rewrite:
   13,774 hand-written file-enforcer lines and the 2,329-line root configuration move to Rust and a new host,
   and structured JSON,
   TOML,
   and XML edits must keep byte-identical output.
- Build:
   `btrfs-uapi` needs `libclang` at build time,
   and the libc target and binary size of the single file are unmeasured.

## Decisions on 2026-09-16

- Tasks run Gradle with its daemon disabled,
   so ending or freezing a task cannot kill or stall shared Gradle state.
  Gradle's `--no-daemon` does not stop the Kotlin compile daemon:
   `/tmp` held 43 `kotlin-daemon` logs on the development machine
   (measured 2026-09-16).
  Gradle projects also need `kotlin.compiler.execution.strategy=in-process`
   (`monorepo-manager-route-research/stack-kotlin.md`).
- Per-task spawning through `systemd-run --scope` must pass `--expand-environment=no`;
   by default,
   systemd-run expands `${VARIABLE}` in command arguments itself when `--scope` is used
   (`man systemd-run`).
- A paused running task releases its concurrency slot.
- Affected work comes from native manifests:
   pnpm workspace dependencies,
   Cargo path dependencies,
   and Gradle projects,
   with extra rules for relationships between ecosystems.

## Open questions

- Configuration hosting for the Rust file-enforcer:
   being designed and ranked per rule `YKZ`.
- Rewrite scope:
   which file-enforcer features move as-is,
   which Meta Package Manager replaces,
   and how byte-identical output is proven.
- Single binary:
   libc target,
   static linking,
   and measured size.
- How `vm-builder` replaces its `exec` import from file-enforcer's `/ts` subpath.
- Veto open:
   the Rust core with TypeScript file-enforcer children is out by the same size reason.
- Veto open:
   0.x offers no pseudo-terminal opt-in.
- Rust approval for this scope,
   per `doc/planning/load-bearing-code-languages.md`,
   and stack acceptance;
   a decision record follows acceptance only.
