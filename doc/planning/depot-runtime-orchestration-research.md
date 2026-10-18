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
