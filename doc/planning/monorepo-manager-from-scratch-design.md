# From-scratch monorepo manager design

## Status

- Status:
   draft;
   research pending.
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
   such as btrfs or ZFS,
   the process uses filesystem features to speed up change comparison.

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
   `findmnt` reports subvolume `/home` mounted `rw,relatime,seclabel,ssd,discard=async,space_cache=v2`.
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

## Open questions

- Tech stack:
   undecided.
   The user corrected an earlier framing that assumed Node.
- Which suites count as heavy?
   Candidates from current task names include container,
   Wayland,
   mutation,
   network,
   and instrumented device suites;
   the classification is not decided.
- Does the Linux-only statement cover the whole 0.x daemon,
   or only freezing running tasks?
- What is the environment variable name for the concurrency override?

## Design

Pending research from:

- file-enforcer,
   watch-restart,
   task-util,
   and JSON-RPC framing reuse;
- prior art for build inspection and control protocols;
- prior art for task input hashing;
- btrfs and ZFS change detection;
- task priority,
   pause,
   and resume prior art.
