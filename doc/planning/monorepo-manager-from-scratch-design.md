# From-scratch monorepo manager design

## Status

- Status:
   draft design;
   the tech stack and several behaviors remain open.
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
  The tech stack is undecided,
   so the concurrency source depends on the chosen runtime.
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

## Open questions

- Tech stack:
   undecided.
   The user corrected an earlier framing that assumed Node.

Resolved:
for 0.x,
sandboxing is cgroups only,
without restricting file reads,
per the user on 2026-09-16.
Undeclared reads stay covered by lint-level enforcement;
read restriction is left for a later version.

## Design

Research with citations and verified or unverified labels:
[`monorepo-manager-route-research/from-scratch-inputs.md`](monorepo-manager-route-research/from-scratch-inputs.md).

### Tech stack options

The stack is undecided;
these options are ranked for the user's choice.
Approval of a language for this scope is separate,
per `doc/planning/load-bearing-code-languages.md`.

- Option A,
   TypeScript on Node:
  - Pros:
     reuses file-enforcer,
     `watch-restart`,
     `task-util`,
     and the JSON-RPC framing in `@monochromatic-dev/mcp-stdio` directly.
  - Cons:
     a task must join its cgroup before it starts children,
     and Node's documented `child_process` API has no hook for that.
    Each task would start through `systemd-run --user --scope`,
     which runs the command itself inside a transient scope
     (`man systemd-run`),
     or through a per-task launcher process that joins the cgroup first;
     the per-task overhead of either is unmeasured.
- Option B,
   Rust:
  - Pros:
     `std::os::unix::process::CommandExt::pre_exec` runs a closure in the child after `fork` and before `exec`
     (<https://doc.rust-lang.org/std/os/unix/process/trait.CommandExt.html>),
     so a task can join its cgroup before it runs anything.
  - Cons:
     file-enforcer is TypeScript,
     so it would run as child processes or be rewritten.
- Option C,
   Rust daemon core with TypeScript file-enforcer evaluation in child processes:
  - Pros:
     native cgroup placement and process control,
     plus file-enforcer reuse through the child-process evaluation the research already recommends.
  - Cons:
     two languages in one tool,
     with a documented boundary between them.

Superseded ranking:
C > A > B was based on surface pros and cons.
On 2026-09-16 the user rejected it:
`systemd-run --scope` is not disqualifying for Option A,
the option set omitted alternatives such as Kotlin/Native,
and every option must be designed deeply enough to surface its disqualifying problems before ranking.
A deeper comparison replaces this section.

Excluded by the user on 2026-09-16:
Go and Zig.

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
   otherwise the runtime's available parallelism.
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

- File-enforcer runs as daemon tasks.
- Each configuration evaluation runs in a child process instead of a cache-busting re-import,
   and emits typed events,
   because log records carry no structured fields for the activity feed.
- The root `file-enforcer.config.ts` already reads files directly,
   so lint-level enforcement of undeclared reads applies there too.

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

## Decisions on 2026-09-16

- Tasks run Gradle with its daemon disabled,
   so ending or freezing a task cannot kill or stall shared Gradle state.
- A paused running task releases its concurrency slot.
- Affected work comes from native manifests:
   pnpm workspace dependencies,
   Cargo path dependencies,
   and Gradle projects,
   with extra rules for relationships between ecosystems.

## Open questions

- Which stack,
   after a deep comparison of every plausible option.
