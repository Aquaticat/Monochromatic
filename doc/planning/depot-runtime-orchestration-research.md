# Depot runtime and orchestration research

## Scope and execution manifest

The reopened research uses repository source `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
Executable fixtures live in the isolated branch `research/depot-runtime-orchestration-20261018`.
The main worktree receives this research note and evidence only.
The source base and the later fixture commit are separate identities.

The first campaign compares runtime prerequisites in fresh GitHub-hosted Ubuntu,
Depot GitHub Actions and native Depot CI jobs.
It probes actual device access,
graphics and display state,
user service availability,
container tools and resource metadata.
A readable character-device positive control and a deliberately absent path validate device discovery.
No emulator launches in these cloud jobs.
KVM device presence alone is not a successful guest or Android runtime result.

The fixture runs only the committed platform-observation Mise task after checkout and lock-bound Node setup.
It reads operating-system metadata and whitelisted environment fields,
runs bounded version or state queries,
and writes its own JSON artifact.
It does not enumerate credentials,
change repository settings,
install services,
or alter shared caches.
Network access is limited to existing source,
Mise and Node installation,
provider APIs and owned artifact upload.
The Actions used are the full-SHA bootstrap and artifact Actions already exercised in the prior trial.

Each cloud job has a five-minute timeout.
Depot jobs use the two-vCPU/eight-GB labels;
the GitHub job uses its standard public Ubuntu allocation and records the observed resources.
At most two parent-owned jobs run concurrently.
The first campaign has a USD 1 nominal compute-proxy bound,
separate from the other researchers' declared campaigns and from an invoice guarantee.

## Host prerequisite observation

The local observation at `2026-10-18T06:19:48.672Z` found readable and writable `/dev/kvm`,
`/dev/dri/renderD128` and `/dev/dri/renderD129` character devices.
The `/dev/null` positive control passed.
The process and systemd user-manager display fields agreed on `DISPLAY=:0` and `WAYLAND_DISPLAY=wayland-0`.
The SDK emulator and adb executables exist.
The manager reports `degraded`;
that status alone does not establish that an owned emulator unit can or cannot run.
The observation found 32 logical CPUs and `66,394,247,168` bytes of host memory,
with `51,293,712,384` free at that instant.
The advertised process cgroup path exposed no readable `memory.max` file;
no cgroup memory ceiling is inferred from that absence.

The binding Android launch form remains headful,
on the host GPU,
in an owned systemd user unit with `MemoryMax=12G`,
a private reflink AVD and isolated adb server.
The required launch section in
`doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md` was read before scripting a launch.
No headless,
Xvfb or container substitution is authorized by this research.

## Remaining execution

### Actual PR and protection campaign

The next fixture creates only the disposable base branch `research/depot-runtime-base-20261018`
and a research PR from `research/depot-runtime-orchestration-20261018`.
Its GitHub and native Depot workflows accept PRs targeting that exact base and the owned fixture paths.
They never target `main`.
The two jobs retain real event,
head,
merge-checkout,
run and attempt identities.
A fixture control deliberately fails or passes the job,
and can hold it for 90 seconds to test explicit concurrency cancellation after a new commit.

The campaign applies required checks and administrator enforcement only to that disposable base,
then tests rejection while a required job fails and acceptance after it passes.
Any merge attempt targets only the disposable base.
It preserves the original `main` protection object and checks it again after cleanup.
The owned PR and temporary protection are removed or closed after the retained evidence is complete.
No production gate,
release,
workflow routing or subscription setting changes.
Each job remains bounded to five minutes,
with at most two jobs concurrently and USD 1 nominal compute exposure for this PR campaign.

### Runtime and orchestration queue

- Compare fresh cloud prerequisite artifacts with the local observation.
- Exercise real PR check association and required-gate rejection on an isolated protected base branch.
- Exercise explicit supersession,
  native retry and rerun attempts,
  timeout behavior,
  parallel shared-state boundaries and artifact consumers.
- Run physically separate test shards against actual current-source tests,
  preserving selection and report identities.
- Evaluate native GUI,
  VM and Android runtime paths using their real prerequisites and source-bound consumers.

Research remains active.
This manifest is not an execution result or a readiness finding.

## Real PR gate controls

PR `1766` targets only `research/depot-runtime-base-20261018`.
Both required check names are bound to their observed GitHub App IDs:
`research-github-gate` to `15368`,
and `research native PR gate / research-native-gate` to `219785`.
Administrator enforcement is enabled only for this disposable base.

At head `0f45cf8730753a3e986d567c27314cb2632ad668`,
both intentional failure controls completed with failure.
The merge API rejected the attempt with HTTP `405`:
`2 of 2 required status checks are failing.`
At head `4fca286e107bc7cbe54bc004a322e3db748f21ce`,
both checks succeeded and GitHub reported `mergeStateStatus=CLEAN`.
These are gate controls,
not application test-suite acceptance.

The first supersession control did not establish cancellation:
the replacement push was rejected with `remote rejected ... (failed)`,
and both 90-second holder jobs completed before recovery.
The cause of that push rejection is not established.
A longer holder accepts only a declared 180-second delay within the existing five-minute job limit.
The replacement is sent only after a native task start marker and an executing GitHub gate are retained.
During cancellation handoff,
old and replacement generations may overlap;
the previous two-job statement describes one generation,
not a proven allocation limit during handoff.
This remains within the campaign's USD 1 nominal compute-proxy ceiling.
Cancellation status will not be reported as evidence of VM termination or billing cessation.

The longer supersession control succeeded at the job-status boundary.
Head `b043aa1d88d9f49fd8391ea05db7126826edce41` was observed executing both gates,
including the native task's own start marker.
Replacement head `c61f59f6869d5f6c733d4024f32d8fca1e25cdde` was then pushed.
GitHub run `39105751918` and native run `bx47zbxvw1` became cancelled;
the replacement GitHub run `39105819735` and native run `zptxtpxmn0` succeeded.
GitHub again reported the PR mergeable.
The ordinary merge API accepted that passing head into the disposable base,
returning merge commit `5c5fcad4acad9751c4e0cd06f51f847a75537461`.
No administrator bypass was used.
The retained collection covers every observed control head:
six GitHub runs,
six native runs,
and their source-bound artifacts and logs.
The cancelled native run has no uploaded artifact;
its start marker is retained from its live and terminal logs.

## Native step-semantics campaign manifest

A separate isolated branch `research/depot-native-orchestration-20261018`
retains the same application base and changes only research fixtures.
It will exercise retry counts,
filesystem and environment accumulation,
per-attempt timeout renewal,
job-timeout interruption of retry backoff,
parallel branch environment isolation and shared filesystem behavior,
default parallel cancellation,
`fail-fast: false`,
and downstream artifact consumption.

Two dependency chains bound this initial campaign to two concurrent jobs.
Jobs use two-vCPU/eight-GB Linux allocations,
with five-minute limits except for the two-minute job-timeout control.
The initial workflow contains five jobs and has a USD 1 nominal compute-proxy ceiling.
Intentional failing and timed-out controls are identified separately from unexpected failures.
No application source,
production workflow,
credential store or account setting changes.

### First native step result

Run `dl8cq50bl0` used harness `c23fcaa454222e0a264cd5a3466b4d0299ff1f41`.
Retry state retained exactly three ordered executions,
and the final environment and output values were both `3`.
Parallel sequential branches saw their own environment updates,
did not see the sibling's update within the group,
saw the sibling's filesystem marker,
and merged both outputs after the group.
The exhausted retry control executed twice before continuation.
The two-minute job-timeout control stopped during retry backoff after two logged executions.

The per-attempt timeout budget renewed:
the second execution began after the first minute and completed its own 50-second wait.
However,
the first Node descendant also wrote its completion file at `07:02:33.213Z`,
70.009 seconds after its own start,
despite the first step attempt's one-minute timeout.
The state assertion failed on that completion file,
so the downstream consumer correctly lacked a successful state receipt.
This is not an all-green orchestration result.

The first default-parallel observation preceded its sibling's eight-second completion horizon.
It cannot establish descendant termination.
Harness `2519664ed7` adds a nine-second observation wait;
that correction has not yet run.
Harness `44b3303eca` separately compares a single timed-out Mise/Node task on GitHub-hosted Actions,
Depot-hosted Actions and native Depot CI,
with a completed writer as a positive control and a post-deadline filesystem observation.
The paired Actions jobs run first,
then the native job,
with at most two jobs concurrently,
five-minute job limits and a separate USD 1 nominal compute-proxy ceiling.
No causal attribution to Depot or Mise follows until those controls and the relevant source paths are examined.

## Active follow-up ownership

The repository coverage researcher owns the frozen-source Android cloud build:
the existing `test:unit` and `test:instrumented:build` tasks,
both native ABIs,
and source-bound APK hashes.
The parent owns the actual local,
headful host-GPU instrumented consumer after those artifacts are available.
The parent also owns the current-source mvm guest lifecycle,
physical Depot Tests sharding,
and the immutable BuildKit service-image consumers.
The BuildKit researcher retains the service image until those consumers finish.
## Reopened current-source execution, 2026-10-18

The real PR campaign is retained in
[`depot-runtime-pr-2026-10-18.evidence.json`](../audit/depot-runtime-pr-2026-10-18.evidence.json).
PR 1766 merged only into its disposable research base.
The deliberately failing checks produced an actual merge rejection;
the replacement passing checks permitted the ordinary merge endpoint.
The temporary classic protection and base branch have been removed.
The main branch protection response remains equal to the retained pre-campaign response.
The research head stays available for reproduction.

The matched process control uses harness `44b3303eca52a58806e28a6e8b681be07d43c278`
and application base `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`.
GitHub Actions run 39107000367 exercised GitHub-hosted Ubuntu and Depot GitHub Ubuntu;
native run `cpjv1rfqzw` exercised native Depot Ubuntu.
All observed the deliberately delayed writer complete at about 70 seconds
despite a 60-second step timeout.
The completed-writer positive control passed on every provider.
The GitHub runners both reported version `2.337.0`.
These controls retract any attribution of this descendant-process observation to Depot alone.
They do not establish indefinite process survival or billing duration.
The retained raw archives and exact timestamps will be consolidated into the durable process receipt.

The current-source `mvm` campaign is admitted as a separate functional qualification:

- Frozen application base `e02be6c8b8fe9efb41a7f8f1a0b311c17796588a`;
  source and dependency inputs are compared before allocation-sensitive work.
- Ubuntu cloud image SHA-256
  `04e8f2461a16a44e78a370284471f29616cdd9baf1893df25807b71f985b6c94`,
  fetched from the official origin checksum response at `2026-10-18T07:14:59.491Z`.
  A cached search-fetch response held an older image checksum and was rejected for admission.
- Current package-owned `mvm:run` commands exercise create,
  actual guest execution,
  stdout,
  stderr and nonzero status,
  host-to-guest-to-host bytes,
  destroy,
  empty private domain inventory,
  and observed owned daemon PID exit.
- Every guest requests the existing source defaults of 4 virtual CPUs and 8192 MiB;
  hosts require the 4-CPU and 16-GB profile.
  Actual monitor responses must report a running guest with KVM enabled.
- Every host uses a disposable home and private libvirt session.
  GitHub-hosted KVM access may receive a recorded per-user ACL change inside its owned ephemeral VM.
  No local host daemon or Hetzner resource is used.
- The bounded campaign permits at most three functional jobs,
  at most two simultaneous jobs,
  a 20-minute job timeout,
  and a 16-minute inner lifecycle deadline that reserves cleanup time.
  The nominal 60 job-minute ceiling is USD 0.72 at USD 0.012 per minute,
  within a USD 1 timestamp-compute guard.
  This guard is not an invoice or a guarantee that cancellation instantly stops billing.
- Native Depot runs first;
  GitHub-hosted and Depot GitHub controls follow on the same immutable harness.
  These functional probes do not support a provider timing multiplier.

The Android cloud build is owned by the coverage researcher.
The parent will consume its exact APK artifacts in the required owned,
headful local Android unit.
The BuildKit researcher has produced a two-architecture service image;
the parent next exercises native and GitHub job-container and service-container consumers
after the digest and temporary pull credential are verified.
