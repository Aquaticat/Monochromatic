# From-scratch monorepo manager design

## Status

- Status:
   draft design.
  On 2026-09-16 the stack narrowed to one remaining route:
   an all-Rust tool with file-enforcer rewritten in Rust.
  The user accepted it the same day:
   [`doc/decision/monorepo-manager-all-rust.md`](../decision/monorepo-manager-all-rust.md).
  Its declarative configuration design,
   rewrite scope,
   and several build details remain open.
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
   the route is chosen,
   but implementation has not been requested.

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
- `./meow` is meant for repositories other than Monochromatic too
   (user answer,
   2026-09-16).

### Platforms and builds

Stated by the user on 2026-09-16:

- Supported in 0.x:
   Linux on x86_64 and aarch64
   ("Sorry we need to support ARM too").
- Each supported target is built both glibc-linked and as a static musl binary:
   "build both glibc and static musl.
   Musl has known performance problems."
- "Not supporting other archs/OSs doesn't mean to never build paths for them;
   it only means an issue in these paths don't block publishing."
  So "Linux only" names the release-blocking tier,
   not a ban on code paths or CI for other systems.
- "Meow takes over only when it supports the full matrix.
   Meow 0.x doesn't need to guarantee good support for platforms other than Linux."
   (user,
   2026-09-17).
  Until then Mise keeps running the macOS and Windows jobs in `readonly-semantic-bridge.yml`;
   the user noted these two statements do not conflict.

### Configuration

Stated by the user on 2026-09-16,
answering whether configuration edits may need the Rust toolchain:
"What are we doing here, now that we're determined to take on this huge project,
that implies we have no objections of writing much more code
therefore eliminate the turing-complete requirement of the config language.
File-enforcer was written under the constraints of time."

- The configuration language does not need to be Turing-complete.
- Logic in today's `file-enforcer.config.ts` moves into code;
   the TypeScript configuration's shape reflects time constraints,
   not requirements.
- The user later pointed to OpenTofu as a precedent:
   "I think opentofu does config files properly."

### Hashing

Stated by the user on 2026-09-16:

- "We don't need a crypto hash. A non-crypto hash would do."
- "We already chose a non-crypto hash fn in music-player":
   `gxhash`,
   which "benched the best";
   the benchmark was not recorded at the time.
- "We don't need to support non-modern CPUs,
   but we do need to properly warn users when they try to use this w/o the required CPU capacities."
- Asked how aarch64 tests should avoid the `gxhash` debug-build panic (issue #111):
   "Dirty room (crediting ogxd) reimplement gxhash ourselves. Or forking it.
   Also, there are many optimization opportunities the original seemingly didn't have time to take,
   so we are doing it."
  `gxhash` 3.5.0 is MIT-licensed,
   by Olivier Giniaux,
   with 979 lines under `src/` and 58 `unsafe` occurrences
   (measured in the cached crate).

Design detail is in "Cache".

### Managed file edits

Answered by the user on 2026-09-16:

- Generated files may change once in a reviewed commit when the Rust tool takes over;
   today's exact bytes are not required.
- "but we must still handle comment-preserving jsonc editing and toml editing properly."
- "XML comments must also be properly preserved."
- A malformed managed XML file fails with a diagnostic instead of a best-effort splice.

### Installs for probes

Authorized by the user on 2026-09-16:
"You may install anything and everything except invoking rpm-ostree install."

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
   the prefix follows that name;
   since `./meow` also serves other repositories,
   a repository-named prefix no longer fits.

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

The all-Rust design,
its configuration-hosting ranking,
and the questions it leaves for the user are in "All-Rust tool".

The subsections from "Findings that apply to every stack" through "Running tasks under a pseudo terminal"
record how the stack narrowed,
including rankings later superseded.

#### Selection history

Every option in "Designed options and their worst problems" was designed against the same requirements
until its disqualifying problems surfaced,
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
   every Rust core problem plus a rewrite of 79 file-enforcer modules
   and no workable host for the 2,330-line TypeScript configuration.
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
Node > Rust core with TypeScript children > Kotlin JVM core with TypeScript children >
Python > Bun > Deno > OCaml > .NET >
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
   the same `/dev/stdout` probe spawned through `std::process::Command` with `Stdio::piped()`
   exited 0 and captured the output
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
while the Rust core with TypeScript file-enforcer children fails
unless Node and the TypeScript sources travel inside that one file.

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
Accepted by the user on 2026-09-16:
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

### All-Rust tool

Research:
[`stack-all-rust-rewrite.md`](monorepo-manager-route-research/stack-all-rust-rewrite.md),
2026-09-16.
Its Cargo builds ran offline because the research agent could not reach `index.crates.io`,
so engines missing from the local crate cache were judged from documentation,
source,
and release assets.

#### Rewrite scope

- Production code:
   77 modules,
   13,396 lines,
   6,469 code lines,
   excluding tests,
   a fuzz budget,
   a regression fixture,
   a container test,
   and the generated package index
   (re-running the research's `allrust/fe-count.ts` reproduced these totals).
- Leaves the port:
   FE18 and FE19 go to Meta Package Manager
   (10 modules,
   943 code lines,
   plus the generated index),
   and FE21 to FE23 watch mode is replaced by the daemon watcher
   (9 modules,
   1,027 code lines).
- Plugins compiled into the tool:
   FE14 Cargo
   (4 modules,
   241 code lines)
   and FE15 JetBrains
   (5 modules,
   711 code lines).
- Core to port:
   49 modules and 3,547 code lines,
   including 20 staleness modules with 1,420 code lines,
   plus the `module-toml-edit` formatting and placement rules file-enforcer reaches
   and 56 test files with 11,126 lines.
- The root `file-enforcer.config.ts` is 2,329 lines.
- Consumers outside the package:
   `package/dev-script/vm-builder` imports `exec` from the `/ts` subpath in two files;
   `package/test-fixture/file-enforcer-perf` benchmarks the TypeScript implementation;
   a `prefer-readonly-parameter-type` unit test reads `cargo/apply-plan.ts` as a fixture;
   and the `sync:files` and `watch:sync:files` Mise tasks run the TypeScript CLI.
- Recorded decision in conflict:
   `package/dev-script/file-enforcer/DECISION.rust-migration.md`,
   "Decision: no Rust migration for file-enforcer",
   whose reasons do not address single-file shipping;
   it is superseded only after the user accepts a variant.

#### Byte-identical output

- Crate defaults change today's bytes.
  `toml_edit` 0.25.13 `Table::insert` resets an existing key's formatting through `entry.key_mut().fmt()`
   (`src/table.rs:429-443` in the cached crate,
   read 2026-09-16),
   which deleted the comment above a key in the probe;
   arrays,
   inline-table trailing commas,
   and new top-level key placement also differ.
- `serde_json` differs from `JSON.stringify` in key order for array-index keys and in number formatting.
- Repository-written emulation layers matched every probed TOML,
   JSON,
   glob-mirror,
   and well-formed XML case.
- Malformed XML still differs:
   `quick-xml` and `roxmltree` fail where `@lezer/xml` recovers and today's code splices anyway.
- A mismatch rewrites managed files,
   including `CLAUDE.md`,
   so a differential harness in a throwaway worktree gates the switch.

#### Single binary

- A no-engine daemon skeleton built stripped with LTO for glibc is 2,055,536 bytes,
   or 3,134,664 bytes with `zbus`.
- When the research ran,
   this host had only the `x86_64-unknown-linux-gnu` target and no static glibc.
  The user then authorized installing the musl target,
   and `rustup target add x86_64-unknown-linux-musl` installed it for the active nightly-2026-09-12 toolchain.
- Static probe,
   2026-09-16:
   the same skeleton with BLAKE3 and SHA-256 replaced by `xxhash-rust` 0.8.15 XXH3-128
   (`allrust/skeleton-musl` in the session scratchpad,
   `cargo build --offline --release --jobs 4`)
   measured 1,983,424 bytes for glibc and 2,098,120 bytes for `x86_64-unknown-linux-musl`,
   which `file` reports as "static-pie linked".
  Run as `skeleton-musl run <throwaway directory>`,
   the static binary added inotify watches,
   walked,
   matched a glob,
   hashed,
   parsed TOML,
   JSON,
   and XML,
   read the btrfs `statfs` magic `2435016766`,
   bound a Unix socket,
   spawned a child,
   and exited 0.
  Binding the socket under the long session scratchpad path failed with "path must be shorter than SUN_LEN",
   so the daemon's socket path needs a length check.
- C sources in QuickJS-ng,
   vendored Lua,
   and Wasmtime's helper need a musl-targeting C compiler for a static build;
   the `blake3` crate also compiles assembly through `cc` unless its `pure` feature is set
   (`build.rs:228-229` in `blake3` 1.8.7).
- The stated requirement is one file that runs directly,
   with AppImage-style unpacking acceptable;
   it does not say static linking,
   and a glibc-linked binary is also one file,
   tied to the host glibc.

#### Configuration-hosting variants

These variants were designed on the premise that the configuration keeps today's logic;
the user's statement in "Configuration" removed that premise.
Worst problems per variant:

- A1,
   TypeScript on `rquickjs` (QuickJS-ng):
   no disqualifying problem found.
  Needs repository-written shims for the Node modules the configuration imports
   and a `.d.ts` kept in step with them;
   type stripping needs an unmeasured `oxc` dependency or JavaScript with JSDoc types;
   C sources;
   single-threaded evaluation.
  Most of the 2,329 configuration lines stay as they are.
- A2,
   TypeScript on Boa:
   A1's shim and stripping work,
   plus a size bounded only by the 33.8 MB Boa CLI;
   pure Rust.
- A3,
   TypeScript on `deno_core` (V8):
   V8's compressed static library is 39,784,686 bytes and the host `deno` binary is 95,600,728 bytes.
- B,
   Starlark:
   `async`,
   `try`,
   `except`,
   `while`,
   and `class` are reserved,
   so the configuration is a full rewrite;
   no released language-server binary.
- C,
   Rhai:
   no async per its maintainer;
   language server last pushed 2023-03-17;
   full rewrite.
- D,
   Lua through `mlua`:
   async support and a small engine;
   full rewrite;
   vendored C sources.
- E,
   Rune:
   one release in the past year,
   low adoption,
   language server only as a 2023 nightly asset;
   full rewrite.
- F,
   Rust compiled into the tool:
   every configuration edit needs `cargo` and restarts the daemon,
   untracked `std::fs` reads are blocked only by lint,
   and the binary carries one repository's configuration.
- G,
   Rust configuration crate run as a child binary:
   `cargo` on every fresh clone and version skew between the tool and the configuration library.
- H,
   WebAssembly guest on `wasmtime`:
   `cargo` and a WebAssembly target for edits,
   or a committed `.wasm`;
   71 `wasmtime` releases in the past year;
   component-model size unmeasured.
- I,
   declarative TOML or KDL with built-in Rust generators:
   logic edits behave like F,
   and each bespoke generator needs its own schema.
- J,
   Nickel or Jsonnet:
   Nickel has no effects and a 19,498,430-byte static library;
   Jsonnet's Rust evaluator has had no stable release since 2021.
- Excluded before design:
   Pkl needs its 101,977,360-byte binary on `PATH`,
   CUE embedding needs Go,
   Dhall has no host effects,
   and dynamically loaded Rust plugins cannot load from a static musl binary.

Shared by every variant:
the byte-identical output work,
the unexercised cgroup,
watcher,
and RPC risks from `stack-rust-crates.md`,
and `browserslist-rs`,
whose data follows crate releases instead of the pnpm lock and whose output is unprobed.

#### Ranking from the research

Withdrawn as a recommendation by "Correction on 2026-09-16";
kept as evidence.

A1 > A2 > D > B > C > E > H > I > F > G > Jsonnet > Nickel > A3.

- A1 over A2:
   both keep TypeScript,
   but QuickJS-ng has size evidence under 2.6 MB while Boa's only bound is 33.8 MB.
- A2 over D:
   A2 keeps most of the configuration and rule `AD2`'s TypeScript wording;
   D rewrites everything into a language no repository rule names.
- D over B:
   Lua keeps async and error handling;
   Starlark has neither.
- B over C:
   Starlark has a maintained language-server library;
   Rhai's language server is stale and neither has async.
- C over E:
   Rhai releases and is adopted more.
- E over H:
   Rune needs no compiler for edits.
- H over I:
   WebAssembly hot-loads and sandboxes;
   I restarts the daemon and invents schemas.
- I over F:
   I's data-only edits need no compiler or restart.
- F over G:
   an unedited F configuration runs without `cargo`.
- G over Jsonnet:
   G's toolchain is maintained.
- Jsonnet over Nickel:
   Jsonnet can read through native callbacks and its CLI is 3.3 MB.
- Nickel over A3:
   Nickel's size is bounded at 19.5 MB,
   while V8 sits closer to the size that killed Node.

#### Correction on 2026-09-16

- The question put to the user,
   whether configuration edits may need the Rust toolchain,
   assumed the configuration must stay Turing-complete to host today's logic.
  The user removed that assumption
   ("Configuration").
- Retracted:
   the A1 recommendation,
   and counting "most of the 2,329 lines stay as they are" as a benefit.
  Keeping the time-constrained configuration's shape is not a goal.
- Moot:
   whether F,
   G,
   H,
   and I fail the single-file requirement,
   and A3's size threshold.
- New direction:
   a declarative configuration,
   with today's configuration logic moved into general built-in features of the tool
   or into ordinary repository tasks with declared inputs and outputs,
   since `./meow` also serves other repositories.
  Research designing the format options and placing every unit of today's logic is running,
   with OpenTofu as the lead precedent.
- Process gap:
   the configuration-hosting research carried the incumbent's Turing-complete shape as a requirement
   instead of asking whether it survives the new project scope.

#### Adopted from settled requirements

Open to the user's veto:

- File-enforcement work runs as a child that re-executes the single file,
   such as `/proc/self/exe` with an internal subcommand,
   inside a task cgroup,
   not in the daemon process.
  Cgroup sandboxing is a must,
   and pause and end act through `cgroup.freeze` and `cgroup.kill`,
   which cannot target in-process work.
  Event types stay shared inside one binary.
- A declarative configuration stays config-as-data under rule `AD2`,
   so `AD2` needs no change for the tool's own configuration.

#### Next measurements

- Done 2026-09-16:
   a static musl daemon skeleton
   ("Single binary").
- Run the differential output harness in a throwaway worktree.
- Measure the chosen configuration format's parser in the static build.

### Declarative configuration

Research:
[`stack-declarative-config.md`](monorepo-manager-route-research/stack-declarative-config.md),
2026-09-16.
Cargo reached crates.io this time,
so its sizes come from static musl builds.
Spot-checked on 2026-09-17:
the size table matches `declarative/sizes/out/summary.txt` in the session scratchpad,
and the tests of `starlark` 0.14.2 expect recursion to run until "Starlark call stack overflow"
(`src/tests/call.rs:63-65` in the cached crate).

#### Correction to the research premise

The research treated Turing-completeness as forbidden,
because the decision record and this design said the configuration is "not Turing-complete".
The user said the Turing-complete requirement is eliminated,
not that Turing-completeness is forbidden;
both documents were corrected on 2026-09-17,
and the question is being asked.
Options G (Starlark) and H (KCL) are disqualified only under the forbidding reading.

#### Logic inventory

Today's `file-enforcer.config.ts` splits into 27 units:

- General built-in features:
   13,
   such as the forbidden `CONTEXT.md` check,
   `LICENSE`,
   `CLAUDE.md`,
   git-policy mirrors,
   license texts,
   Cargo manifest keys,
   JetBrains settings,
   the skill mirror,
   scheduling,
   events,
   and input tracking.
- Repository tasks:
   3,
   the forbidden-strings rule compilation,
   the pnpr configuration generator,
   and resolved Browserslist targets.
- Plain data:
   5.
- Retired:
   6,
   including `mise.toml` generation once Mise leaves CI.

Awkward placements:
per-manifest Cargo derivations,
writes outside the repository (JetBrains settings and the scanner cache),
license pruning broader than today's,
and `mise.toml` while Mise stays on the macOS and Windows runners.

#### Format options and ranking

Static musl size added over a 385,656-byte baseline:
`jsonc-parser` 180,224 bytes,
`toml` 208,896,
`toml_edit` 225,280,
`kdl` 303,104,
`hcl-edit` 344,064,
`serde-saphyr` 942,216,
`hcl-rs` with its evaluator 1,052,776,
`serde_dhall` 1,785,992,
`cel` 2,662,824,
and `regorus` 7,038,952.

Ranking from the research:
A (OpenTofu-shaped HCL) > B (TOML) > F (TOML with CEL) > E (JSONC) > D (YAML) > C (KDL) > I (Dhall) > J (Rego) > G (Starlark) > H (KCL).

- A over B:
   native expressions keep per-file derivations in one general language,
   following the user's OpenTofu pointer and the repository's OpenTofu incumbent;
   the gaps in A are repository code the user accepted writing.
- Worst problems of A:
   `hcl-rs` has no built-in functions (issue #484 open)
   and drops source locations on evaluation errors,
   `hcl-edit` has no formatter and warns "Expect breaking changes at any time",
   and its round trip joined a four-line `&&` condition onto one line.
- OpenTofu 1.12.6 expressed `CLAUDE.md`,
   the skill mirror map,
   SPDX text mapping,
   and pnpr entry-point selection with built-in functions only.
- The remaining adjacent reasons are in "8. Ranking" of the appendix.

#### Settled without asking

Each follows from recorded decisions:

- Ordering comes from declared reads,
   writes,
   and explicit `depends_on`,
   which keeps author control over sequencing where it matters (FE01).
- Skill-mirror ownership moves into the tool's state;
   both mirror roots are gitignored.
- The pnpr configuration and Browserslist targets become TypeScript tasks in their own packages,
   which already hold that code.
- The research's byte-identity question was already answered:
   a one-time reviewed change.

#### Answers on 2026-09-17

- Expression power:
   "Full language allowed".
  Turing-completeness is permitted,
   so G (Starlark) and H (KCL) lose their only disqualifier.
  A stays first:
   the user endorsed HCL,
   while `starlark` 0.14.2 fails to build on the repository nightly and pulls a C compiler,
   and KCL is not published on crates.io.
  Author-defined functions and recursion are allowed within the chosen syntax.
- Syntax:
   "HCL syntax is fine. This is only a light endorsement."
- Rules that write outside the repository,
   such as the JetBrains settings,
   live in a per-user `meow` configuration.
- Forbidden-strings rule compilation uses the published scanner,
   not a repository build:
   the user noted "We already publish it to crates.io and GitHub releases and cargo-binstall should discover it fine."
  `forbidden-strings` 0.4.1 is on crates.io (API read 2026-09-17).
  The research carried over today's local path,
   `package/cli/forbidden-strings/target/release/forbidden-strings` (`file-enforcer.config.ts:182-184`),
   and asked whether to build it first.
  A released scanner older than the repository cannot corrupt the compiled cache:
   the cache has a magic header (`package/cli/forbidden-strings/src/runtime_cache/envelope.rs:20`)
   and the scanner reports "compile-from-text" recovery on a mismatch (`src/runtime_cache/warning.rs:78`).

#### Root `mise.toml` and where meow is built

Answered by the user on 2026-09-17:
"Hand-maintained file, and we're obviously going to build meow in a new worktree."

- Clarified by the user the same day:
   "mise.toml: hand-maintained now, once meow takes over, mise is out."
  The root `mise.toml` is hand-maintained from now on,
   meow gets no Mise-specific rule,
   and Mise is removed entirely when meow takes over,
   which happens only once meow supports the full platform matrix
   ("Platforms and builds").
- "`meow` doesn't need to own the MPM lifecycle":
   installing and updating Meta Package Manager stays outside meow.
- meow is built in a separate git worktree,
   so the TypeScript file-enforcer and meow never enforce the same tree during development,
   and the lock interoperability concern for coexisting enforcers does not arise.

### Platform probes

Research:
[`probe-platforms.md`](monorepo-manager-route-research/probe-platforms.md),
2026-09-17,
using the daemon skeleton with `gxhash` 3.5.0 on nightly-2026-09-12.
Spot-checked the same day:
`file` output for every built binary,
the aarch64 musl target spec,
the installed `qemu-user-static-aarch64` 10.2.2 package,
and the `rustix` auxv source.

#### Build matrix

- `x86_64-unknown-linux-gnu`:
   1,983,504 bytes on the host,
   1,980,536 bytes in a Debian bookworm container,
   PIE.
- `x86_64-unknown-linux-musl`:
   2,098,120 bytes,
   static-pie.
- `aarch64-unknown-linux-gnu`:
   1,709,080 bytes,
   PIE,
   built in Debian bookworm with `aarch64-linux-gnu-gcc` and the `libc6-dev-arm64-cross` 2.36 sysroot.
- `aarch64-unknown-linux-musl`:
   1,744,728 bytes,
   statically linked but not position-independent,
   because the built-in target spec lacks `static-position-independent-executables`
   (checked with `rustc -Z unstable-options --print target-spec-json`),
   so the binary gets no ASLR.
  A custom target spec copying that target with `static-position-independent-executables` set,
   built with `-Z build-std=std,panic_abort -Z json-target-spec` and `rust-lld`,
   produced a static-pie binary (`readelf` type `DYN`)
   that passed the CPU check and hashed under QEMU;
   it needed musl's self-contained startup objects linked under the custom target name in the rustup sysroot.
- Both glibc builds need glibc 2.34:
   they ran on UBI 9 (2.34) and failed on Fedora 34 (2.33) with "version `GLIBC_2.34' not found".
  The host-built binary also carries weak `GLIBC_2.39` references (`pidfd_spawnp`, `pidfd_getpid`)
   and prints "weak version `GLIBC_2.39' not found" on glibc 2.34 and 2.35;
   the bookworm-built binaries print nothing.
- Every aarch64 skeleton exited 0 under QEMU with the same `gxhash128` output as x86_64.

#### Missing CPU capabilities

- Without the check,
   the skeleton exits 132 (SIGILL) on x86_64 `Nehalem` and `qemu64`
   and on a `cortex-a72` patched to drop the crypto extension,
   for musl and glibc builds.
- The prototype check,
   compiled under `#![forbid(unsafe_code)]`,
   prints a diagnostic naming the missing capability and stating there is no fallback,
   then exits 3;
   with AES present it hashes and exits 0.
- `is_x86_feature_detected!("aes")` and `is_aarch64_feature_detected!("aes")` printed `true` on CPUs without AES,
   confirming they cannot perform the check.

#### gxhash issue #111

- Not reproduced on aarch64 Linux under QEMU:
   no panic for `gxhash64`,
   `gxhash128`,
   or `GxHasher` over input lengths 0 to 67,
   or the issue's reproducer,
   in debug-assertion builds on nightly and Rust 1.84.0,
   while a deliberate overlapping `copy_nonoverlapping` did panic with the issue's message.
- `gxhash` still reads past the end of short inputs.

#### Settled from the probes

- The aarch64 check also requires `HWCAP_PMULL`,
   because Rust's aarch64 `aes` target feature implies PMULL,
   so a `+aes` build may use it
   (`std_detect/src/detect/arch/aarch64.rs:117-118`).
- `rustix` is built with `use-libc-auxv`:
   its default auxv reader unwraps and aborts when both `PR_GET_AUXV` and `/proc/self/auxv` fail
   (`src/backend/linux_raw/param/auxv.rs:267-316` in `rustix` 1.1.4),
   while `use-libc-auxv` reads libc's `getauxval`.
- Probe containers that run QEMU pass `--init`:
   without it a SIGILL run hung because QEMU ran as PID 1.

### Managed file editing

Research:
[`rust-structured-edits.md`](monorepo-manager-route-research/rust-structured-edits.md),
2026-09-17.
Scores come from `structured-edits/probe/scores.md` in the session scratchpad;
the `toml_edit` wrapper's 21 passes were recounted there.

#### Chosen editors

- TOML:
   `toml_edit` behind a repository wrapper passed all 21 cases,
   while `toml_edit` as-is passed 12:
   setting a value dropped its same-line comment,
   removing an array element moved a comment onto the wrong element,
   and deleting a key deleted a header comment separated by a blank line.
  `taplo` 0.14.0 passed 6 and rejects TOML 1.1 forms the current editor already writes.
- JSONC:
   the `jsonc-parser` 0.33.2 CST behind a wrapper passed all 16 cases,
   with no dependencies,
   adding 134,536 bytes.
- XML:
   `roxmltree` with byte-range splicing passed all 9 cases,
   fails malformed files with line and column,
   and adds 77,072 bytes;
   `xot`,
   `xmltree`,
   and `xml-rs` wrote raw tabs or newlines into attribute values.
- The repository's TypeScript editors fall short:
   `module-toml-edit` passed 15 of 21,
   `module-jsonc-edit` 7 of 16,
   and file-enforcer's XML splicing 4 of 9.

#### Requirements after the user's answers

- Comments must survive edits and never move to a different node
   ("Managed file edits").
- "'untouched bytes identical' rule and preserve CRLF per file - no need."
  (user,
   2026-09-17):
   formatting outside edited nodes may change,
   and line endings may be normalized.
- Settled by those answers:
  - JSONC and TOML files may be reformatted canonically on write,
     so files `toml_edit` cannot round-trip byte for byte are rewritten, not rejected.
  - Comments directly above a deleted node leave with it;
     leaving them behind would attach them to a different node.
  - Owned XML options are edited at attribute level,
     so comments inside an entry survive.
  - JSONC editing is a general capability,
     since today's file-enforcer edits no JSONC and meow serves other repositories.

#### Research notes

- Cargo builds hit the `/tmp` quota,
   so that research built under `~/temp/agent/structured-edits-target-2026-09-16/`.
- The research identified tool quirks worth `doc/troubleshooting/` entries:
   `toml_edit` comment loss,
   `taplo` rejecting TOML 1.1,
   `jsonc-parser` accepting JSON5 by default,
   `json-five` writing an unterminated block comment,
   and XML crates corrupting attribute whitespace.

#### Build and format answers on 2026-09-17

- aarch64 musl ships from the custom static-pie target,
   so all four binaries get ASLR.
- Local glibc builds use the host (Fedora 44):
   "we don't directly ship the build outputs on local dev machines to GitHub Releases."
  Release binaries follow the repository's existing pipeline,
   `.github/workflows/cargo-publish.yml`,
   which builds natively on `ubuntu-latest` and `ubuntu-24.04-arm`
   and installs `musl-tools` for musl targets;
   the minimum glibc of binaries built there is unmeasured.
- New TOML inline tables use the TOML 1.1 style `{ a = 1, }`,
   an answer given on a false premise:
   the question said this matches today's Cargo manifests,
   but no tracked `Cargo.toml` contains an inline-table trailing comma
   (`git ls-files -z '*Cargo.toml' | xargs --null rg --multiline --count ',\s*\}'` matched 0 files on 2026-09-17);
   the form comes from `module-toml-edit` (`package/module/toml-edit/src/toml-set.unit.test.ts:484`),
   and taplo 0.14 rejects it; the question is asked again.
- file-enforcer keeps generating the root `mise.toml` for now.
  Read together with "hand-maintained now",
   meow never generates `mise.toml`,
   and Mise and its file leave when meow takes over.

### Repository-owned gxhash

Research:
[`gxhash-owned.md`](monorepo-manager-route-research/gxhash-owned.md),
2026-09-17,
with a prototype reimplementation,
differential test,
benchmarks,
and collision reproducer under `gxhash/lab/` in the session scratchpad.

#### Findings

- A prototype reimplementation written from the algorithm notes,
   with no raw pointer reads,
   matched `gxhash` 3.5.0 on 97,545 input and seed pairs on x86_64,
   on aarch64 under QEMU,
   and against the upstream `hybrid` build.
- Undefined behavior in 3.5.0:
   Miri stops on inputs of 1 to 16 bytes with
   "attempting to access 16 bytes, but got alloc311 which is only 8 bytes from the end of the allocation".
  The music player always hashes at least 24 bytes;
   89 git-tracked files are under 16 bytes,
   so meow would hit it.
  The prototype runs clean under Miri.
- One-byte collisions in `gxhash128`,
   reproduced independently on 2026-09-17 with the lab's `onebyte` binary
   (`BASE=random SEEDS=0,1,987654321 onebyte 4096 gxhash128 xxh3_128`):
   among all 1,044,480 single-byte variants of one random 4096-byte input,
   `gxhash128` produced 1 full 128-bit collision
   (bytes 354 and 877,
   both in block 6 of a lane group),
   equal under all three seeds,
   while XXH3-128 produced 0.
  For a content cache,
   two different one-byte edits of the same file can share a key.
- Issue #111 did not reproduce on aarch64 Linux in either investigation.
- Upstream reasons against runtime detection and stable VAES are outdated:
   safe `#[target_feature]` functions are stable since Rust 1.86 and VAES intrinsics since 1.89.
- Upstream has had no commits since 2025-05-18 and no release since 2025-03-12;
   #118,
   the inline-assembly read fix,
   is merged but unreleased.
- Benchmarks,
   x86_64 in `podman --memory=2g --cpus=2`,
   with run-to-run bands of 19.3% on fingerprint material and 23.6% on files:
   on music-player fingerprint material `gxhash128` was 31% to 37% faster than XXH3-128,
   beyond the band;
   on the 8,093 git-tracked files `gxhash` reached 45 to 47 GiB/s,
   where memory access rather than the hash limits throughput;
   `gxhash64` and `gxhash128` showed no measurable difference on file contents.

#### Settled from the findings

- Ownership shape:
   dirty-room reimplementation crediting ogxd,
   not a fork:
   a fork starts from 56 `unsafe` uses and undocumented items that rules `MXR` and `RDC` would force rewriting anyway,
   and upstream is idle.
- License:
   `LGPL-3.0-or-later`,
   the repository's license for Rust crates
   (`package/cli/forbidden-strings/Cargo.toml:21`),
   plus the upstream MIT copyright notice,
   "Copyright (c) 2023 Olivier Giniaux",
   for the derived code.
- API:
   one-shot hashing;
   `Hasher` and `HashMap` support are left out because nothing in the repository uses them.
- The undefined behavior and the one-byte collisions go through the `troubleshooting-doc` skill,
   whose upstream filing audit decides whether anything is offered upstream.

#### Upstream reports of the collisions

Read 2026-09-17 with `gh issue view`:

- #83,
   opened 2024-06-02 and open,
   "Hash has arbitrary seed-independent multicollisions, is not DoS resistant".
  ogxd replied "Let's see if we can improve DoS resistance without compromising performance",
   later clarified the README security section (2024-11-05),
   and after a comment that "`compress_all` is completely independent from the seed"
   wrote on 2024-12-10:
   "Mixing the seed at the start instead of the end should significantly improve DoS resistance.
   I'm currently (slowly) exploring this path."
- #124,
   opened 2025-11-14 and open,
   "seems to be failing some tests on smhasher3";
   ogxd replied "I fail to see why gxhash would have to comply to all benchmarks in the www",
   and the reporter noted the README claims every SMHasher test passes.
- The README still states "GxHash passes all [SMHasher](https://github.com/rurban/smhasher) tests"
   (`README.md:19` in the 2026-09-16 clone),
   which names the original SMHasher rather than SMHasher3.

#### Answers on 2026-09-17

- CPU capabilities:
   `+aes` target-feature builds with the startup check,
   not a runtime detection token.
- The owned hash crate is published on crates.io;
   the name `gxhash` is taken,
   so naming research comes before publishing.
- aarch64 benchmarks run on `ssh m1`,
   once the user powers it on;
   the user asked to be told to turn it on only when it is strongly needed.
- The cache key output question was answered with questions about upstream reports,
   answered in "Upstream reports of the collisions",
   and is asked again.

#### Cache key hash after the collision findings

Answered by the user on 2026-09-17,
to the repeated cache key output question:
"Pick some other hash that has hardware acceleration on x86 and ARM instead."

- meow's cache keys stop using `gxhash`;
   the user delegated choosing a replacement with hardware acceleration on x86 and ARM.
- The selection runs through the choosing-technology workflow,
   carrying over the 128-bit key width,
   stable output for persisted keys,
   static musl builds on both architectures,
   and a clear warning on CPUs lacking required capabilities.
- Superseded for meow:
   the `gxhash128` key choice and the `+aes`-specific build and startup check,
   whose target features and check follow the chosen hash.
- Music player:
   the user decided on 2026-09-17 that it must switch away from `gxhash`, tracked in issue #545;
   this design work does not touch the music player.

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
- Entry contents,
   answered by the user on 2026-09-16:
  - Every run is cached,
     failures included:
     "Cache everything, because a flaky task is a user error and users should know better.
     We also provide a retry mechanism for unfixably flaky tasks."
  - Captured stdout and stderr are stored and replayed on a hit.
  - Outputs are recorded only as pointers to their locations with content hashes;
     a changed or missing output means the task runs again.
    The user first answered "We only record pointers and reflinks",
     then on 2026-09-17 dropped reflinks:
     "There's no need to restore an earlier build because builds are by definition ephermal.
     In addition, we consider switching git branches in place a user error."
  - Eviction uses a size cap plus a maximum age.
  - The size cap counts bytes only the cache pins (user,
     2026-09-16).
    With pointers only,
     the cache holds no output data,
     so those bytes are the plain size of its records and logs;
     the pinned-bytes research started for reflinks was stopped unfinished on 2026-09-17.
  - The default maximum age is 30 days since an entry was last used,
     matching Cargo's one-month threshold for regenerable global-cache files
     (`doc/book/src/reference/config.md`, "Global caches", in `rust-lang/cargo`).
  - Retries are declared for unfixably flaky tasks;
     a pass after a failed attempt is recorded as a pass marked flaky,
     with every attempt's logs kept.
- Measuring cache size with reflinks,
   kept as evidence for the dropped reflink design,
   probe on 2026-09-16 in a throwaway directory on the development machine's btrfs:
   an 8 MiB random file plus a `cp --reflink=always` clone reported
   `Total 16.00MiB`, `Exclusive 0.00B`, `Set shared 8.00MiB` from unprivileged `btrfs filesystem du --summarize`.
  After overwriting the original's first 1 MiB in place,
   per-file output was `clone.bin` exclusive `0.00B` shared `8.00MiB`
   and `original.bin` exclusive `1.00MiB` shared `7.00MiB`.
  So apparent size double-counts reflinked data,
   and per-file exclusive bytes miss the old extent the clone alone still pins.
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
- Hash:
   `gxhash` 3,
   the repository incumbent in `package/music-player/desktop-app` and `android-app/rust`,
   with `gxhash128` for cache keys
   (`src/gxhash/mod.rs:49` in `gxhash` 3.5.0;
   the music player uses `gxhash64`).
  The user chose the 128-bit width on 2026-09-16;
   a false hit needs a new key equal to a stored one,
   so its odds scale with stored entries times lookups divided by 2 to the key width.
- No cryptographic hash is used:
   the cache is local only,
   and file-enforcer's SHA-256 uses,
   the staleness manifest (`package/dev-script/file-enforcer/src/io/staleness-hash.ts:20`)
   and skill-mirror ownership digests (`file-enforcer.config.ts:1103`),
   detect change and ownership rather than defend against crafted input.
  A shared or remote cache would need this revisited.
- `gxhash` constraints,
   from `doc/troubleshooting/gxhash-aes-target-feature.md`:
   the build needs `-C target-feature=+aes,+sse2`,
   output is stable only within a major version,
   aarch64 debug builds can panic (upstream issue #111),
   and a CPU without AES-NI crashes with SIGILL because there is no software fallback.
- CPU check:
   the tool checks for AES and SSE2 at startup,
   before any hashing,
   and exits with a diagnostic naming the missing capability,
   explaining that the tool requires it and has no fallback;
   `doctor` reports the same check.
  `is_x86_feature_detected!("aes")` cannot perform this check in a `+aes` build:
   its macro evaluates `cfg!(target_feature = ...)` before runtime detection
   (`library/std_detect/src/detect/macros.rs:9-10` in the nightly-2026-09-12 sources,
   with `aes` declared without the cfg-check opt-out at `std_detect/src/detect/arch/x86.rs:124`),
   so it is `true` at compile time.
  The check calls `core::arch::x86_64::__cpuid(1)` directly,
   a safe function in that toolchain (`stdarch/crates/core_arch/src/x86/cpuid.rs:107`),
   and reads ECX bit 25 for AES and EDX bit 26 for SSE2,
   the bits std uses (`std_detect/src/detect/os/x86.rs:108`, `:118`).
  On aarch64 the same short-circuit applies,
   because `aes` is declared without the cfg-check opt-out (`std_detect/src/detect/arch/aarch64.rs:123`);
   the check reads `AT_HWCAP` bit 3,
   the bit std uses on Linux (`std_detect/src/detect/os/linux/aarch64.rs:147`),
   through the safe `rustix::param::linux_hwcap` (`src/param/auxv.rs:66` in `rustix` 1.1.4),
   and `gxhash` on aarch64 also needs `neon`.
  Exercised on 2026-09-17 under QEMU user mode
   ("Platform probes");
   an earlier note here that QEMU user mode was absent came from checking only the x86_64 binary names,
   while `qemu-user-static-aarch64` 10.2.2 was installed.
- Static probe,
   2026-09-16:
   the daemon skeleton with `gxhash128`,
   built for `x86_64-unknown-linux-musl` with `RUSTFLAGS='-C target-feature=+aes,+sse2'`
   (`allrust/skeleton-gxhash` in the session scratchpad),
   measured 2,098,120 bytes and ran its probe to exit 0;
   the XXH3-128 variant measured the same size.

### btrfs acceleration

- Reflink copies work without root,
   but the cache does not use them:
   outputs are pointers only
   ("Cache").
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
- The configuration language no longer needs to be Turing-complete;
   its format and the placement of today's configuration logic are being designed
   ("Correction on 2026-09-16").
- File-enforcement work runs in a re-executed child of the single file inside a task cgroup,
   as adopted in "All-Rust tool".
- Reads come from the tool's own code and declared task inputs,
   so undeclared reads are limited to repository tasks,
   which keep the cache risk recorded under "Risks".
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
- The vet's HC5 lists macOS and Windows CI runners;
   the user keeps Mise on those runners for now,
   and issues on unsupported systems do not block publishing.
- Rewrite:
   49 core modules,
   the Cargo and JetBrains plugins,
   `module-toml-edit` formatting behavior,
   and their tests move to Rust,
   and the 2,329-line root configuration moves to a new host.
- Output:
   every candidate crate changes today's bytes by default,
   and a missed formatting rule rewrites managed files including `CLAUDE.md`.
- Build:
   `btrfs-uapi` needs `libclang` at build time,
   `gxhash` needs the `+aes,+sse2` target features,
   and the size of the full binary is unmeasured beyond the static skeleton.
- CPU:
   the startup AES check is unexercised on a CPU without AES-NI.

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

Research in progress;
user choices it raises are asked as they arise (rule `FLG`):

- Repository-owned `gxhash`:
   dirty-room reimplementation or fork,
   output compatibility with `gxhash` 3,
   whether the music player moves to it,
   and which optimizations to take.
- Comment-preserving JSONC,
   TOML,
   and XML editing in Rust.
- aarch64 builds and the missing-AES warning under QEMU.

Design work not yet started:

- The HCL evaluator,
   function library,
   formatter,
   and language server,
   given the gaps in `hcl-rs` and `hcl-edit`.
- Discovery and precedence of the per-user `meow` configuration.
- How `vm-builder` replaces its `exec` import from file-enforcer's `/ts` subpath.
