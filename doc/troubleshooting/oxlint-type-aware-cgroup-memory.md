# Oxlint 1.78.0 type-aware package lint receives `SIGKILL` in a 2 GiB container

## Symptom

The provider-free translation-repair verification runner passes its build,
pinned-corpus consumer,
types and focused tests,
then fails its unchanged package-wide `lint:oxlint` task.
The isolated runner has 2147483648 bytes of RAM allowance,
2147483648 bytes of swap allowance,
two CPUs,
512 PIDs and no network.
No resource limit is raised during diagnosis.

The R9 wrapper reports:

```text
[task-oxlint] failed to execute oxlint: Command was terminated with SIGKILL: oxlint '--format=default' --type-aware
```

A diagnostic repetition instead exposes the killed type-aware subprocess:

```text
Error running tsgolint: "exit status: exit status: 1"
Error: Command failed: .../tsgolint headless
signal: 'SIGKILL'
```

These are not successful lint runs or semantic guard detections.
The diagnostic launcher itself exits successfully after saving a failed child's status;
its `report.json` field `lintStatus` remains authoritative.

## Separate input-runner follow-up

Task 48 investigates a later source state,
not a retroactive change to the successful lint-only measurements in this report.
`producer-input-gate-check-1PX5aV` runs `format:oxlint --fix` with one worker and `GOMEMLIMIT=512MiB`.
It fails after recording `memory.peak=2147483648` and `oom_kill=2`.
That first follow-up lacks a retained container identity and also lacks the read-only Mise plugin mount.
Its attempted `vfox-cmake` discovery and the memory failure are separate observations.
No exact victim or cause is assigned from that first run alone.

The partial formatter diff is retained in
`/var/home/user/temp/agent/producer-input-format-incident-20260913`.
The owning source checkpoint is `7a3fb97ef`.
Further experiments run in the disposable
`/var/home/user/temp/agent/translation-repair-input-format-20260913` worktree,
with explicit dependency links,
451 byte-matched config/plugin files,
a freshly built owned lint configuration,
a fresh package build and read-only Mise installs plus plugins.
Only that disposable tree is writable by the formatter.
The owner’s `mise.lock` is neither copied as an overlay nor reverted.

The unchanged-source `lint512-4aR4cn` control also fails without `--fix`.
Its before/after source hashes are identical,
and its output contains no attempted plugin clone.
Therefore the later failure is not established as a formatter-only effect or as a consequence of missing plugins.
The one-worker/512 MiB recipe was sufficient for its recorded earlier source and harness,
not a universal budget guarantee.

This control retains container ID
`45c30a054052de0032b413a4c7535e2138587ee0abcf85389826c65d7fcf2e35`,
Podman inspection/events,
process samples and kernel messages.
The kernel matches that ID in `oom_memcg` and records:

```text
# lint512-4aR4cn/kernel.json, message excerpts
constraint=CONSTRAINT_MEMCG
Memory cgroup out of memory: Killed process 3237892 (node-MainThread)
```

The host PID map associates `3237892` with container PID `36`.
The control reaches `memory.peak=2147483648` and records `oom_kill=1`.
This establishes the named control's container-memory constraint,
not which allocation is unnecessary or a general upstream leak.
`lint256-J14Ich` completes analysis of 1515 files and 484 rules with 10 stylistic warnings,
no errors,
`memory.peak=1908318208` and no OOM events.
It still exits `1` because warnings are not accepted as a successful package lint.
The subsequent unchanged-source `lint512-QeoyZc` reversal also completes analysis,
with the same warnings,
`memory.peak=1972633600` and no OOM events.
This reversal does not reproduce the memory failure.
The measurements therefore do not establish that the lower Go target alone caused recovery,
or that 512 MiB must fail on the later source.

The disposable `format256-lcie4M` run then succeeds with
`OXLINT_THREADS=1 GOMEMLIMIT=256MiB`,
1515 files,
484 rules,
zero warnings/errors,
`memory.peak=1927979008` and no OOM/PID events.
Its exact formatter diff changes only the launch reader,
Podman context helper and runtime-shape reader.
Those reviewed bytes are transferred to development and committed as `522f7dc62`.
The exact development `lint:types` task succeeds in `devtypes-duhx8i`,
with peak 984588288 bytes and no OOM events.

A disposable positive control removes the `run` parameter tag and one `await file.sync()`
from the Podman helper without executing that modified helper.
`lint256-24YGKJ` emits exactly `tsdoc(require-param)` and `typescript(no-floating-promises)`.
It records one warning,
one error,
peak 1893535744 bytes and no OOM events.
The saved helper is restored by matching both mutant and original SHA-256 before replacement.
The fresh `format256-60YMRl` fixpoint check succeeds with no changed source hashes,
zero findings,
peak 1893507072 bytes and no OOM/PID events.
`input-formatter-proof-20260913` retains 171 hash-checked files totaling 9417678 bytes,
plus 21 separately indexed supplemental records.
Committed blobs in `522f7dc62` independently match the three transferred formatter-result hashes.
The final pre-removal audit covers 12979 filesystem entries and 49 empty directories,
with no root Git sentinels,
foreign owners or special entries.
All nine owned stopped containers are removed and their absence checked.

Git policy initially refuses the cleanup checks with `config-untrusted`.
The temporary configuration is reviewed and matches development's SHA-256
`11fdd22292aeeb35e4a36ddc7e7cdcee66d34e3060fe6f09873af90ded9915ea`.
It is not replaced with the independently changed main-worktree configuration.
Native temporary trust,
including the disclosed descendant authority,
is revoked before removal;
`untrust-summary` records the recursive cascade and `trust-status` reports `trusted:false`.
Directory and Git registration absence are both verified at `2026-09-13T17:56:04.692Z`.
This closes task 48's bounded formatter verification,
not task 47's absent production bootstrap or its pending tests and full suite.

The 256 MiB setting is a measured per-run configuration,
not a hard aggregate limit,
optimal value,
repository default or proof of a deterministic memory remedy.
No checks or rules are disabled and the 2 GiB/2 CPU/512 PID/no-network envelope remains unchanged.

### Later input-owner formatting remains a separate run

`devformat-9XRrS1` formats the later host/child owner source with one Oxlint worker and `GOMEMLIMIT=256MiB`.
It reaches 2147483648 bytes and records `oom_kill=2`.
Kernel `CONSTRAINT_MEMCG` records match container
`82eef0b9be1ad305773192d8c3fa36ecd5e237994d4125317ea01e1218f1cbb9`
and name `tsgolint` victims `3260053` and `3261155`.
This does not invalidate task 48's recorded successes;
it demonstrates why its per-run target was not declared a universal remedy.
The formatter's edits are inspected separately and checkpointed before another run.

The same log contains an independent logger failure:

```text
logger internal error: file sink verification failed: EROFS: read-only file system
```

The affected directory is
`package/module/translation-repair/node_modules/.monochromatic`.
The harness supplied root-level logger mounts but omitted this package-local sink.
A new owned writable mount addresses that exact path without opening the rest of dependency storage.
It is not attributed as the cause of the memory failure.

`devformat-Cfklmx` adds a per-run Node old-space limit of 384 MiB while retaining the Go target.
It still reaches 2147483648 bytes and records `oom_kill=2`.
That setting is not a demonstrated remedy.

`devformat-rpKEkF` instead uses `GOMEMLIMIT=128MiB`,
`GOGC=20` and Node `--max-old-space-size=256`.
A named nonsecret preload records Node `26.8.2`,
`heap_size_limit=318767104` and the intended Go settings in the Node task,
wrapper,
Oxlint and tsgolint-launcher processes.
The complete formatter does not finish before its configured 600-second container deadline.
Podman records exit `-1` for the container and the attached command exits `255`.
The last resource sample records peak 2137989120 bytes and zero OOM/PID events;
terminal inspection says `OOMKilled:false`,
and the interval's kernel capture has no matching OOM record.
These are bounded observations before and at termination,
not a successful formatter result or an unlimited-run guarantee.

The next read-only full-package lint,
`devlint-sU4Yps`,
completes analysis with 23 warnings and 3 errors,
peak 2121007104 bytes and no OOM events.
The remaining findings concern type-only import syntax,
readonly native-network views,
UUID grammar constants and callback layout.
Subsequent formatting exposes a nullish-union annotation,
consecutive ignored destructuring fields and the child-mount module's line budget.
They are corrected structurally:
presence is established before a readonly callback view,
UUID groups use a named slice,
and platform mount data moves into its own module with comments retained.

`devformat-Glcy9d` then completes formatting of 1523 files and 484 rules with zero findings,
peak 2145931264 bytes and no recorded OOM/PID events.
Its matching type check also succeeds.
This is a measured successful invocation at that source state,
not a universal memory margin or a proved optimal configuration.
Later host-lifecycle code and tests still require fresh checks.
All checks and the 2 GiB container bound remain enabled.

### Current lifecycle checkpoint opens task49

`devformat-TYkzp1` uses the recorded Go `128MiB`,
`GOGC=20` and Node `256MiB` controls,
but reaches its 600-second container deadline before convergence is reported.
Process samples identify six successive Oxlint Node processes:
container PIDs `36`,
`94`,
`151`,
`208`,
`265` and `323`.
The first five terminate before the next begins;
the sixth remains at the final sample.
This is not evidence that one analyzer was stuck for the whole interval.
`package/dev-script/task-util/src/oxlint-fix-loop.ts:325,338`
runs a fix invocation and a plain-lint oracle in each pass:

```ts
// package/dev-script/task-util/src/oxlint-fix-loop.ts, separate excerpts
const fixResult = await runFix();
const oracle = await runLint();
```

The task log contains only the Mise task header before forced termination.
The run changes 21 scoped source files.
No final convergence or lint result is inferred from those edits.

The final sample records memory peak `2147483648`,
`max 63`,
no OOM events and no PID-limit events.
Native inspection reports `OOMKilled: false` and exit `-1`;
events record death at the configured deadline.
The final sample precedes forced exit,
so it is not a post-exit counter reading.
`timeout-reading.json` retains the process-lifetime and resource reconciliation.

A separate read-only run,
`devlint-ONOp7h`,
does suffer memcg OOM.
Container `ba4a33f9f9af507d670ffec0b6a4a2c928ecdf3aa0921b2c3bbce16548f43945`
records `oom_kill 1` at the 2 GiB bound.
The kernel names host PID `3321998`,
`tsgolint`,
and `CONSTRAINT_MEMCG` for that container.
Its Node launcher reports `SIGKILL`;
no package lint findings were delivered.
The timeout and OOM remain separate incidents.

The Node-only `192MiB` control,
`devlint192-Av7MZz`,
terminates Oxlint with `SIGABRT`,
not a cgroup OOM event.
Peak is `1357684736` bytes,
source hashes are unchanged,
and the wrapper reports only the execution failure.
That result does not yet establish a V8 heap failure or a native panic.
A repeat enables private fatal reports while retaining every rule and the same container bounds.
The report-exclusion positive control `node-report-privacy-LoxEwL`
verifies that the environment canary and network-interface section are absent.
The first manual control supplied an explicit path and produced no report at that requested path;
the verified control uses Node's generated report filename in the owned directory.
No report contents or credentials are printed.

The instrumented repeat,
`devlint192-ho7loH`,
produces one fatal report for Oxlint container PID `36`:

```text
Allocation failed - JavaScript heap out of memory
```

Its trigger is `OOMError`.
The report's executable entry matches the heap ledger and process sample after canonical path resolution;
the literal sample contains `.bin/../`,
while Node's `process.argv` normalizes that spelling.
The report records Node `v26.8.2`,
heap limit `251658240`,
used JavaScript heap `197464056` and process RSS `674902016` bytes.
The worker's container peak is `1370390528` with no OOM/PID events.
Report `externalMemory` is not treated as resident memory or summed with RSS.
There is no JavaScript allocation stack in this report,
so it does not identify a retaining rule or allocation site.
`fatal-reading.json` records the identity and privacy checks.

The read-only `224MiB` control,
`devlint224-EYOgRv`,
completes analysis and reports 48 warnings and 8 errors across 1538 files and 484 rules.
It exits `1` for those findings,
not a signal or memory failure.
Memory peak is `2147483648` bytes;
OOM/PID events and observed swap-current/peak are zero.
Source hashes are unchanged.
This is evidence that this invocation delivered analysis,
not a proved stable memory margin or a universal configuration.
Go settings,
worker count and container bounds remain unchanged.

The findings drive structural changes rather than suppressions:
inspection fields/mappings,
launch shape checks,
stop observation and command interruption move to separate owning modules.
Native token views become explicitly readonly;
abort reasons remain unknown until validated;
the CLI test fixture uses asynchronous native execution.
The package-root bootstrap configuration is formatted without changing its closure contract.
Commits `6e2ad798a`,
`3ce4ece58` and `96d58ac9e` record those changes.
Exact development normal/bootstrap builds,
`devtypes-8AUfDO` and focused `devtest-mLP7LS` pass afterward.
These are not final full-package verification.

The pending `devformat224` invocation uses the same measured memory controls
and a finite 3000-second verification deadline.
The formatter's own eight-pass cap remains unchanged.
The larger deadline addresses the observed multi-invocation cutoff,
not memory pressure.
Only owned source,
the task's bootstrap configuration and designated outputs are writable;
configuration bytes now join the before/after inventory.
`devformat224-2vLWZD` finishes with ordinary lint findings,
not a deadline or memory failure:
2 warnings and 1 error across 1543 files and 484 rules.
Its container records no OOM/PID events.
The remaining findings are inspection-module `max-lines`,
a one-line mapping callback and `strict-void-return` on `promisify(execFile)`.

Commit `f57cf9c6e` extracts native bind validation into its own module,
formats the mapping callback and replaces the promisifier with a native completion owner.
That owner resolves ordinary exits together with both captured streams,
but rejects spawn errors and signal termination.
It does not suppress the void-return rule or discard stderr.
Fresh normal/bootstrap builds,
types and focused `devtest-40QnXP` pass after these changes.
Final formatter verification continues in `input-format-node224-r2-20260913.out`.
These passes still do not establish complete package verification.
The following `devformat224-3ssI7u` run completes with 1 warning and 2 errors,
again without OOM/PID events.
The findings concern callback declaration syntax,
nullish-union spelling and the deprecated `ExecFileException` alias,
not memory pressure.
The callback is moved to the API-supplied function-expression position
and its error enters as unknown before runtime narrowing.
A fixed fixture error handles unexpected non-Error values;
new native spawn/signal tests check that execution failures are rejected rather than returned as ordinary exits.
Fresh builds,
types and `devtest-WY17PT` pass,
including actual native `ENOENT` and `SIGTERM` controls.
The current full-package read-only lint result is still pending.
Task49 stays open until the complete current result is read and remaining findings are resolved.
Neither increasing the container memory bound nor disabling a check is an accepted workaround.

## Root cause

### The kernel confirms a job-local memory constraint

The default-thread repetition's cgroup starts with `oom_kill 0`
and finishes with `oom_kill 1` and `memory.peak` of 2147483648 bytes.
The kernel records `CONSTRAINT_MEMCG`,
not a host-wide allocation failure:

```text
# root-lint-kernel-memory-20260913.out
constraint=CONSTRAINT_MEMCG
Memory cgroup out of memory: Killed process 3085719 (tsgolint)
```

The kernel's `oom_memcg` names the libpod scope for container
`c2239323ee8c0d191bdd23bb908e82fbe5503d94a707aec606f39631d44da843`.
Retained Podman events bind that ID to
`translation-repair-root-inputs-baseline-lint-default-r2-20260913`.
The separate R9 events name the TypeScript `tsc` child and `node-MainThread` as victims.
`root-lint-r9-container-events-20260913.jsonl` binds their scope ID
`00bd1beb826a54161fce11722991116e88d9488ae7c7e44ef5b36abf58df1646`
to `translation-repair-root-inputs-baseline-r9-20260913`.
These remain separately recorded runs.
A signal alone did not establish this cause;
the cgroup counters,
kernel records and container identity do.

No particular leaking allocation site has been identified.
The demonstrated defect is an unbudgeted combination of processes inside this verification envelope,
not a proven general Oxlint memory leak.

### The JavaScript semantic child remains resident when tsgolint starts

Oxc source tag `apps_v1.78.0`,
commit `c42d6397eab5b2d5bb2bd6746c57bc2a9cad21bd`,
runs regular lint before its type-aware engine.
`crates/oxc_linter/src/lint_runner.rs:275-289` contains:

```rust
self.lint_service.run::<TIMINGS>(
    fs,
    files.to_owned(),
    &tx_error,
    diff_manager,
    rule_timing_store,
);
// ...
if let Some(type_aware_linter) = self.type_aware_linter.take() {
    type_aware_linter.lint(
```

These stages need not execute callbacks simultaneously to have overlapping resident processes.
The project-owned semantic plugin starts its TypeScript API at module initialization:
`package/oxlint-plugin/prefer-readonly-parameter-type/src/index.ts:82` calls
`initializeSemanticBridge()`.
Its `typescript-sync-adapter.ts:158-170` retains the API:

```ts
const api = new API({
  cwd: process.cwd(),
  fs: {
    readFile: readFileFromOverlayOrDelegate,
    fileExists: reportOverlayPresenceOrDelegate,
  },
},);
const child = nativeApiChild(api,);
configureNativeApiChildShutdown(child,);
bridgeState.api = api;
```

The same adapter's `:181-186` registers cleanup on Node's `beforeExit` event:

```ts
if (!bridgeState.beforeExitHookRegistered) {
  process.once(
    'beforeExit',
    closeSemanticBridge,
  );
  bridgeState.beforeExitHookRegistered = true;
}
```

Installed TypeScript `7.0.2` starts the native child in
`node_modules/typescript/dist/api/syncChannel.js:124-128`:

```js
this.child = spawn(exe, args, {
    stdio: ["pipe", "pipe", "inherit"],
});
```

Oxc's separate `crates/oxc_linter/src/tsgolint.rs:347-351` starts its type-aware process:

```rust
let mut cmd = std::process::Command::new(&self.executable_path);
cmd.arg("headless")
    .stdin(std::process::Stdio::piped())
    .stdout(std::process::Stdio::piped())
    .stderr(stderr());
```

The installed `oxlint-tsgolint` package is `7.0.2001`.
`go version -m` reports Go `1.26.5`,
revision `482dcf70bffce7ea56f63128c74beb67dec658a2`,
and `vcs.modified=true`.
That build metadata is not proof of an unmodified upstream source tree.

### Worker count does not budget Go-managed memory

The repository wrapper already supports a native thread override.
`package/dev-script/task-util/src/oxlint-wrapper.ts:48-50` reads:

```ts
const threadOverride = process.env
  .OXLINT_THREADS;
```

Its `:72-84` inserts `--threads` and the supplied value into the normal Oxlint arguments.
Oxc's `apps/oxlint/src/command/lint.rs:122-136` chooses that count or
`std::thread::available_parallelism()` and passes it explicitly to Rayon.
It does not assign a Go memory budget.

The one-thread control still reaches the memory limit and records an OOM kill.
The worker-count hypothesis alone therefore does not explain a valid remediation.

Go `1.26.5`,
commit `c19862e5f8415b4f24b189d065ed739517c548ba`,
reads the independent heap-management setting in `src/runtime/mgcpacer.go:1416-1426`:

```go
func readGOMEMLIMIT() int64 {
    p := gogetenv("GOMEMLIMIT")
    if p == "" || p == "off" {
        return math.MaxInt64
    }
    n, ok := parseByteCount(p)
    if !ok {
        print("GOMEMLIMIT=", p, "\n")
        throw("malformed GOMEMLIMIT; see `go doc runtime/debug.SetMemoryLimit`")
    }
    return n
}
```

`src/runtime/debug/garbage.go:181-195` describes a soft target that adjusts collection frequency
and returns managed memory more aggressively.
It excludes memory outside the Go runtime.
The [Go GC guide](https://go.dev/doc/gc-guide#Memory_limit) explicitly allows exceeding the target to avoid thrashing.
It is not a replacement for the container's hard aggregate limit.

## Verification

The workload stays at source checkpoint `21b09216f` and 1501 package files with 484 rules.
The container keeps its Node `26.8.2` preload,
independent runtime ledger,
read-only dependencies and corpus,
owned outputs and existing resource limits.

The native task inside that prepared container is:

```bash
# Owned verification container, not an unbounded host benchmark.
MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false MISE_NODE_VERSION=26.8.2 \
  mise run --no-deps --skip-tools //package/module/translation-repair:lint:oxlint
```

### Failing catalog

- Default thread selection and default Go target:
  lint exits one,
  memory peak 2147483648 bytes,
  one observed OOM kill.
- `OXLINT_THREADS=1` alone:
  lint exits one,
  memory peak 2147483648 bytes,
  one observed OOM kill.
- Removing `GOMEMLIMIT` after the successful controls while retaining one thread:
  lint exits one,
  memory peak 2147442688 bytes,
  one observed OOM kill.
  The reversal prevents attributing recovery merely to earlier runs populating caches.

### Working catalog

- `OXLINT_THREADS=1 GOMEMLIMIT=512MiB`:
  zero warnings and errors on all 1501 files,
  memory peak 2015842304 bytes,
  no OOM or PID-limit event.
- A disposable positive-control patch removes `await` from a known `symlink` promise
  and removes the public owner's `@param input` documentation.
  The same complete lint emits both `typescript(no-floating-promises)`
  and `tsdoc(require-param)` and exits one.
- Restoring both exact source byte snapshots returns the same complete lint to zero findings.
  Combined positive/restored memory peak is 1952813056 bytes,
  with no OOM or PID-limit event.

The positive controls establish that the type-aware and JavaScript-plugin paths still execute.
No rule,
file,
contract or semantic check is suppressed.
No comparative timing claim is made.

Evidence is retained under `/var/home/user/temp/agent/semantic-root-guard-proof-20260913/runs/`
in `lint-default-r2`,
`lint-one`,
`lint-go512`,
`lint-positive512` and `lint-one-recheck`.
The launchers were generated by `prepare-root-lint-probe-20260913.mts`,
retained in the proof's `drivers/` directory alongside
`root-lint-kernel-memory-20260913.out`,
`root-lint-default-container-events-20260913.jsonl` and
`root-lint-r9-container-events-20260913.jsonl`.
The original verification worktree is removed after audited proof retention;
recreate its recorded fixture before using a launcher rather than invoking a path into the removed worktree.

## Verified workaround

Assign this resource-specific environment only to the isolated lint phase:

```bash
# Same bounded container and unchanged package-wide type-aware task.
OXLINT_THREADS=1 GOMEMLIMIT=512MiB \
  MISE_AUTO_INSTALL=false MISE_TASK_RUN_AUTO_INSTALL=false MISE_NODE_VERSION=26.8.2 \
  mise run --no-deps --skip-tools //package/module/translation-repair:lint:oxlint
```

The thread cap reduces native parallelism.
The Go setting trades collection work for managed-memory restraint and applies per inheriting Go process,
not to the aggregate job.
The measured value belongs to this workload and envelope;
it is not a universal package default or a guarantee against OOM on other inputs.
The container's hard limits remain unchanged.

R10 repeats the original complete verification sequence successfully:
build,
pinned-corpus consumer,
types,
focused tests,
package lint and full unit tests.
`r10/lint.out` reports zero findings on 1501 files with 484 rules;
`r10/full-unit.out:10690` records `test:unit exit 0`.
Every one of the 630 designated unit entries is present in the nonce- and phase-filtered Node `26.8.2` ledger.
Whole-sequence memory peak is 1958432768 bytes,
with no OOM or PID-limit event.

The complete-run fixture also has explicitly provisioned dependencies:
the config package's read-only `node_modules` link and an additional read-only mount of the existing Mise plugin directory.
The latter avoids a missing CMake plugin lookup in the disposable home.
These are disclosed harness inputs,
not an environment-only comparison with R9.
The diagnostic A/B/A controls themselves use the same dependency arrangement and vary the Go target.
Only R10's lint phase receives the Go target and Oxlint thread cap.

One thread has not been shown necessary in combination with the Go target,
and 512 MiB has not been shown optimal.
The tested combined configuration is sufficient for this recorded workload.
No production package task or installed dependency is patched.

## What does not work

- Treating a successful diagnostic launcher as a successful linter ignores `lintStatus`.
- Treating `SIGKILL` alone as OOM ignores external-kill alternatives.
- Merely selecting one Rust worker does not constrain the resident Go engines.
- Reusing the earlier [lazy-child `ENOMEM` diagnosis](oxlint-js-plugin-lazy-child-enomem.md)
  misclassifies this incident:
  early initialization is already present,
  and these processes start before the kernel kills them.
- A missing disposable lint-config dependency directory was an earlier,
  separate setup failure.
  An explicit dependency link permits a fresh native config build;
  it does not fix the later OOM.
- The first metric probe assumed `cpuset.cpus.effective` was exposed.
  Its `ENOENT` occurs before lint and is not a lint reproduction.
- Disabling type-aware checks,
  reducing file scope,
  fabricating mutation contracts or increasing container limits is not this workaround.

## Upstream filing decision

The `.out-of-scope/` search finds no Oxlint memory exemption.
Searches for `GOMEMLIMIT` in Oxc issues/PRs and `tsgolint out of memory` in Oxc issues find no matches.
Wider Oxc `OOM` and tsgolint `memory` searches find related work.
The complete bodies and comments of
[Oxc issue 20331](https://github.com/oxc-project/oxc/issues/20331)
and [tsgolint issue 295](https://github.com/oxc-project/tsgolint/issues/295)
were read.
The allocator-creation panic in issue 20331 and the larger profiling discussion in issue 295
are not proof of this job's specific cause.

1.  Upstream fault:
    not established.
    The demonstrated remediation is a budget in the resource-owning verification runner.
2.  Upstream ability:
    memory handling can be changed,
    but no upstream implementation change is required by the measured workaround.
3.  Supported use:
    type-aware and JavaScript-plugin lint are supported;
    no guarantee of fitting this combined workload inside 2 GiB was identified.
4.  Contribution policy:
    Oxc's `CONTRIBUTING.md:12-22` and its linked contribution guide require disclosure,
    understanding and validation of AI-assisted contributions.
    No external filing is authorized or prepared here.
5.  Upstream intent:
    the related threads show active investigation,
    not a refusal to improve memory behavior.
    Their proposed fixes are not adopted as this incident's diagnosis.
6.  Compatible prototype:
    the consumer environment patch is exercised with positive and reversal controls.
    There is no upstream code patch;
    the upstream-fault condition is not met.

Nothing is filed.
No additive upstream claim beyond a local constrained-runner configuration has been established.
