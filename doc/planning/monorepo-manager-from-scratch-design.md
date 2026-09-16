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
   the term the user used,
   so the design reads `os.availableParallelism()`.

## Open questions

- Which tests form the default test set for an affected package?
- What is the environment variable name for the concurrency override?
- Beyond changing priority,
   pausing,
   and ending,
   which controls does the first version include,
   such as resuming,
   rerunning,
   or listing queued work?
- Does pausing a task mean pausing its running process tree,
   or only withholding it from the queue before it starts?

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
