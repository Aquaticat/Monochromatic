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
