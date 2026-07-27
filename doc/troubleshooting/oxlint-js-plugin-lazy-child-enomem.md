# Oxlint 1.74.0 default-thread JS-plugin reservations make lazy child startup fail with `ENOMEM`

## Symptom

A package-scoped run of:

```bash
mise run //package/pi-plugin/goal:lint:oxlint
```

originally reported:

```text
Finished in 276.1s on 38 files with 479 rules using 1 threads.
```

Removing the explicit worker pin without changing the semantic plugin made the run finish quickly,
but every source received this invalid replacement diagnostic:

```text
Readonly semantic analysis unavailable: api-unavailable:
TypeScript 7.0.2 synchronous API failed to start: Error: spawn ENOMEM.
```

That failed run reported:

```text
Finished in 969ms on 38 files with 479 rules using 16 threads.
```

The fast failed run was not an optimization.
It skipped semantic analysis after the TypeScript child process failed to start.

The installed versions were Oxlint `1.74.0`,
`@oxlint/plugins` `1.74.0`,
and TypeScript `7.0.2`.
The host exposed 16 processors,
62 GiB RAM,
`vm.overcommit_memory=0`,
and `vm.overcommit_ratio=50`.

## Root cause

The incident combined one repository configuration error,
one upstream allocator property,
and one lazy initialization decision in the project-owned semantic rule.

### Package lint was unnecessarily serialized

At the failing revision,
`mise.no-env.toml:589-590` set `OXLINT_THREADS=1` on every package `lint:oxlint` task:

```toml
[task_templates."lint:oxlint".env]
OXLINT_THREADS = "1"
```

That pin was based on the incorrect assumption that Oxlint runs JavaScript-plugin callbacks on separate JavaScript workers.
Oxlint `1.74.0` instead routes Rust worker requests through one N-API `ThreadsafeFunction` and executes callbacks on the main JavaScript thread.
`apps/oxlint/src/js_plugins/external_linter.rs:148-156` at Oxc commit
`2d4e8d20644e0e7446f0a381894b45ea339a0625` says:

```rust
/// Unlike `loadPlugin`, `lintFile` JS callback is not async. But `ThreadsafeFunction` executes the callback
/// on main JS thread, and therefore it may have to wait for a previous `lintFile` call to complete.
```

The plugin's process-local TypeScript bridge therefore does not require Oxlint's Rust worker count to be one.
The root repository fanout still pins child processes to one worker to prevent cross-package oversubscription.
Direct package tasks do not need that pin.

### Default workers reserve one fixed raw-transfer arena each

Without `--threads`,
Oxlint chooses the available processor count.
`apps/oxlint/src/command/lint.rs:122-136` selects `available_parallelism()` and builds Rayon's global pool with that count:

```rust
let thread_count = if let Some(thread_count) = threads
    && thread_count > 0
{
    thread_count
} else if let Ok(thread_count) = std::thread::available_parallelism() {
    thread_count.get()
} else {
    1
};

rayon::ThreadPoolBuilder::new().num_threads(thread_count).build_global().unwrap();
```

When any JavaScript plugin is active,
`crates/oxc_linter/src/service/runtime.rs:229-250` creates a fixed allocator pool sized by that worker count:

```rust
let thread_count = rayon::current_num_threads();

let (allocator_pool, js_allocator_pool) = if linter.has_external_linter() {
    if options.cross_module {
        (
            AllocatorPool::new(thread_count),
            Some(AllocatorPool::new_fixed_size(thread_count)),
        )
    } else {
        (AllocatorPool::new_fixed_size(thread_count), None)
    }
};
```

Oxc's generated constants make each block about 2 GiB and require 4 GiB alignment.
`apps/oxlint/src/generated/raw_transfer_constants.rs:15-23` contains:

```rust
pub const BLOCK_SIZE: usize = 2147483632;
pub const BLOCK_ALIGN: usize = 4294967296;
pub const BUFFER_SIZE: usize = 2147483576;
```

The 16-worker host therefore established a large virtual-memory reservation before the first rule callback.
This is the same allocator family tracked by upstream
[issue 20331](https://github.com/oxc-project/oxc/issues/20331),
which documents Linux failures under commit-accounting constraints.

### The semantic rule started its child too late

Before the fix,
`openSemanticFile()` lazily reached `getApi()` from the first file's `Program` visitor.
`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/typescript-sync-adapter.ts:142-170`
shows that API creation owns the TypeScript child:

```ts
function getApi(): API {
  if (bridgeState.api !== NO_API)
    return bridgeState.api;

  const api = new API({
    cwd: process.cwd(),
    fs: {
      readFile: readFileFromOverlayOrDelegate,
      fileExists: reportOverlayPresenceOrDelegate,
    },
  });
  const child = nativeApiChild(api,);
  configureNativeApiChildShutdown(child,);
  bridgeState.api = api;
}
```

TypeScript `7.0.2` performs the POSIX startup with `child_process.spawn`.
`node_modules/.pnpm/typescript@7.0.2/node_modules/typescript/dist/api/syncChannel.js:124-128` contains:

```js
this.child = spawn(exe, args, {
    stdio: ["pipe", "pipe", "inherit"],
});
```

On this host,
that spawn returned `ENOMEM` after Oxlint had created the default fixed allocator pool.
Because bridge startup remained uninitialized,
every later file retried startup and emitted another unavailable diagnostic.

The earlier reading that process-local semantic state required `--threads 1` was wrong.
Oxlint's own callback source proves JavaScript execution remains on the main thread.
The actual ordering requirement is narrower:
start the TypeScript child before Oxlint creates its fixed allocator pool.

## Verification

### Reproduction harness

The failing configuration used the repository goal package and the exact package task:

```bash
mise run //package/pi-plugin/goal:lint:oxlint
```

For per-rule timing during diagnosis,
the wrapper temporarily added Oxlint's documented `--debug=timings` flag.
That temporary flag was removed after measurement.

The upstream source audit used tag `apps_v1.74.0`,
commit `2d4e8d20644e0e7446f0a381894b45ea339a0625`.

### Failing catalog

- Explicit one worker, cold semantic cache, lazy child: valid diagnostics but 276.1 seconds.
- Default 16 workers, lazy child: 969 milliseconds, but 58 semantic startup errors containing `spawn ENOMEM`.
- Merely removing `OXLINT_THREADS=1`: invalid because semantic analysis did not run.

### Working catalog

- Explicit four workers with a warm cache: valid diagnostics in 6.0 seconds.
- Default 16 workers with early child startup and a cold analyzer cache: valid diagnostics in 30.3 seconds.
- Default 16 workers with early child startup and a warm cache: valid diagnostics in 3.3 seconds.
- The built semantic-rule test suite passed its new 16-worker startup regression together with existing rule cases.

The cold and warm timings are separate facts.
Persistent effect summaries intentionally make later unchanged runs faster.
No code or effect analysis was removed to obtain them.

### Follow-up zram snapshot

A follow-up check on 2026-07-27 found the 16 GiB zram swap almost full while `free` reported
18 to 23 GiB available memory across successive snapshots.
These values describe different resources and are not contradictory.

The host configuration caps `/dev/zram0` at 16 GiB and selects `zstd`:

```toml
# /etc/systemd/zram-generator.conf
[zram0]
compression-algorithm=zstd
zram-size = min(ram / 2, 16384)
```

`zramctl` reported 15.5 GiB of uncompressed data occupying 11.2 GiB of physical RAM,
including allocator overhead:

```text
NAME       DISKSIZE  DATA COMPR TOTAL ALGORITHM
/dev/zram0      16G 15.5G 11.1G 11.2G zstd
```

The running OGC kernel source at tag `v7.1.3-ogc5`,
commit `2abd6857d30a0c0e0a7fb0d49b734c06b2451b2a`,
explains both numbers.
`Documentation/admin-guide/blockdev/zram.rst:8-12` says zram keeps compressed pages in RAM:

```text
The zram module creates RAM-based block devices named /dev/zram<id>
(<id> = 0, 1, ...). Pages written to these disks are compressed and stored
in memory itself.
```

`Documentation/admin-guide/blockdev/zram.rst:260-273` defines `orig_data_size` as uncompressed data
and `mem_used_total` as physical allocation including fragmentation and metadata.
The full 16 GiB device therefore consumed 11.2 GiB of RAM in this snapshot,
not another 16 GiB outside RAM.

`Documentation/filesystems/proc.rst:1125-1133` defines `MemAvailable` as an estimate containing
free memory, reclaimable slab, and reclaimable file-cache pages:

```text
MemAvailable
              An estimate of how much memory is available for starting new
              applications, without swapping. Calculated from MemFree,
              SReclaimable, the size of the file LRU lists, and the low
              watermarks in each zone.
```

The initial snapshot had 7.2 GiB free and 17 GiB in buffer and cache.
Much of the reported 23 GiB was therefore reclaimable cache rather than unused RAM.

The swapped pages had an identifiable owner.
PID 7319, `/home/user/AppImages/odytty.appimage`, had run since 2026-07-23 and reported:

```text
VmRSS:   6655708 kB
VmSwap: 11931316 kB
```

That process alone held 74.7 percent of the private anonymous swap attributed through
`/proc/*/status` in the snapshot.
`Documentation/filesystems/proc.rst:268-269` confirms that `VmSwap` counts anonymous private data,
not shared-memory swap.
The process's cgroup had no configured memory or swap maximum and recorded no cgroup OOM event.
This identifies the holder but does not establish whether its memory growth was intended.

Linux does not proactively read all of those pages back merely because file cache later becomes reclaimable.
`mm/memory.c:4795-4892` enters `do_swap_page()` for a page fault and starts swap-in there:

```c
vm_fault_t do_swap_page(struct vm_fault *vmf)
{
    // ...
    folio = swapin_readahead(entry, GFP_HIGHUSER_MOVABLE, vmf);
}
```

The host's `vm.swappiness=60` also permits reclaim to balance swap-backed pages against file cache.
`Documentation/admin-guide/sysctl/vm.rst:985-998` defines that balance and names 60 as the default.
The immediate `vmstat` sample showed no new swap-out,
and both current memory-pressure stall averages were zero.
The full device was retained state from prior reclaim,
not evidence of current global memory exhaustion.

This snapshot can reduce headroom for the earlier `spawn ENOMEM`,
but it does not replace the demonstrated ordering cause.
`Documentation/admin-guide/sysctl/vm.rst:836-842` says the active `vm.overcommit_memory=0` mode
rejects obvious overcommits after comparing a request against memory plus swap.
A full zram device leaves little free swap for that heuristic,
while `MemAvailable` is not a promise that an arbitrary child-process request will succeed.
Starting the TypeScript child before Oxlint's allocator reservations remained the controlled change
that made the same child startup succeed.

## Verified workarounds

### Start the semantic child while loading the plugin

`package/oxlint-plugin/prefer-readonly-parameter-type/src/index.ts:77` now calls:

```ts
initializeSemanticBridge();
```

`package/oxlint-plugin/prefer-readonly-parameter-type/src/prefer-readonly-parameter-types/typescript-sync-adapter.ts:191-205`
starts the existing API without changing its analysis:

```ts
export function initializeSemanticBridge(): void {
  getApi();
}
```

Plugin loading happens before Oxlint constructs the runtime fixed allocator pool.
The tradeoff is that importing the package entry starts TypeScript immediately,
even when a consumer imports only a named analysis helper.
The package is primarily an Oxlint plugin,
and existing test and plugin consumers already require the semantic runtime.

### Leave direct package tasks at Oxlint's default worker count

`mise.no-env.toml:580-595` no longer assigns `OXLINT_THREADS` to package lint or format templates.
Native parsing and type-aware rules can therefore use Oxlint's available parallelism.

The repository-wide `lint` fanout retains `OXLINT_THREADS=1` at
`mise.no-env.toml:829-831`.
Its tradeoff is deliberate serialization inside each simultaneously running package process,
which avoids multiplying package concurrency by host-core concurrency.

### Temporary worker cap

Setting `OXLINT_THREADS=4` produced a valid six-second warm run before early startup landed.
This remains a recovery option if an external plugin cannot control when it starts a child process.
Its tradeoff is reduced native-rule parallelism and a host-specific number.
It is not the package-task default.

## What does not work

- Keeping `OXLINT_THREADS=1` preserves correctness but caused the measured 276.1-second cold run.
- Removing the pin without changing startup ordering produced fast but invalid semantic-unavailable diagnostics.
- Adding false `@mutates` contracts or effect-catalog entries would weaken semantic guarantees and would not change child startup.
- Removing runtime-verifier code would hide the workload that exposed the problem without fixing the allocator and child ordering.
- Treating the 969-millisecond failed run as a performance win would silently skip the project-owned semantic rule.
- Treating full zram as proof of current RAM exhaustion confuses occupied swap slots with `MemAvailable`,
  which includes reclaimable cache.
- Treating the follow-up snapshot as proof that full swap caused the earlier `ENOMEM` ignores the successful
  startup-order experiment and lacks a memory snapshot from the failing system call.

## Upstream filing decision

No `.out-of-scope/` entry matches Oxlint,
JavaScript plugins,
or allocator behavior.
The zram follow-up matches the running kernel's documented behavior,
so it does not warrant a Linux issue.

The duplicate search found upstream
[issue 20331](https://github.com/oxc-project/oxc/issues/20331)
and the broader allocator design
[issue 20513](https://github.com/oxc-project/oxc/issues/20513).
A new issue would be a duplicate.

1.  **Is it really upstream's fault?** No for the reported 276.1-second package run.
    The repository explicitly forced one worker,
    and its plugin waited until the first file visitor to start a child.
    Oxc's allocator made the ordering failure visible,
    but the local configuration and initialization fully remediate this incident.
2.  **Can upstream fix it?** Yes.
    Issue 20513 describes platform virtual-memory reservation instead of committed fixed blocks.
3.  **Are they supporting this use case?** Yes.
    Oxlint documents custom JavaScript plugins and issue 20331 tracks their Linux allocator failures.
4.  **Would the repository welcome the contribution?** Yes with review and disclosure.
    Oxc's `CONTRIBUTING.md:12-21` permits AI assistance,
    requires disclosure,
    and requires contributors to understand and test submissions.
5.  **Will they likely fix it?** Yes.
    Issue 20331 is open and assigned,
    and the maintainer stated that the Linux allocator work is active.
6.  **Have we prototyped a minimal upstream fix compatible with their architecture?** No.
    The incident has a complete consumer-side fix,
    constraint one fails,
    and duplicating the allocator work already active in issues 20331 and 20513 would not be justified.

The following additive comment advances issue 20331 with a distinct child-start ordering symptom,
but it is **do not post as-is** because the incident's primary fault and fix are local:

~~~md
AI-assisted investigation, reviewed against Oxlint 1.74.0 source and reproduced locally.

A related Linux failure mode can occur after Oxlint successfully creates its JS-plugin allocator pool.
Our JS plugin lazily starts a TypeScript 7 synchronous API child from its first `Program` visitor.
With 16 default workers, that later `child_process.spawn()` returned `ENOMEM` on a 62 GiB host using
`vm.overcommit_memory=0` and `vm.overcommit_ratio=50`.
Oxlint then completed quickly, but every file carried a semantic-plugin startup error.

Starting the child while the JS plugin module loads, before `Runtime::new()` creates
`AllocatorPool::new_fixed_size(thread_count)`, removed the `ENOMEM` without reducing Oxlint's worker count.
The same package then produced valid diagnostics with 16 workers.

Measured runs on the same source:

- lazy startup, 16 workers: 969 ms, invalid because child startup failed;
- early startup, 16 workers, cold semantic cache: 30.3 s, valid;
- early startup, 16 workers, warm semantic cache: 3.3 s, valid.

This does not replace the allocator fix tracked here.
It may be useful to document that plugins which spawn helper processes should do so during module loading,
not from the first file visitor, until Linux virtual-memory reservation work lands.
~~~
