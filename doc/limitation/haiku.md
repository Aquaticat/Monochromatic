# Haiku limitations

Documenting tasks where Haiku subagents failed to produce usable results,
so future sessions do not repeat the same failure pattern.

## Stock Settings capture on the owned Fold emulator (2026-10-11)

### Goal

Capture the stock Android Settings two-pane layout on the owned Pixel 9 Pro Fold emulator,
so the music player Settings page could follow it.
The brief allowed the Developer options "Smallest width" screen as a fallback for the display size,
set through the UI only and restored afterward.

### Files involved

- `/home/user/temp/agent/start-settings-pane-runtime.ts`: the launch script the agent used for the emulator.
- `doc/troubleshooting/android-emulator-37-software-renderer-sigsegv.md`: the repo record of which emulator flags boot
  and which crash.
- `/home/user/temp/agent/agent-settings-ref2/notes.txt`: the agent's log of the attempts.

### Mistakes

#### Blamed host load for emulator failures without questioning the launch

Across three rounds the agent saw Pixel Launcher and System UI "isn't responding" dialogs,
a `qemu` segmentation fault (exit status 139),
and a System UI ANR loop.
Each time it reported host load averages (134 to 170) as the environment problem,
asked for a quieter host,
and stopped.
The user then said that system load is fine and that the emulator was probably not launched correctly.

The launch script contradicted the repo record in three ways.
It passed `-feature -Vulkan` with `-gpu host`,
and the troubleshooting document shows (from `emugl_config.cpp`) that without host Vulkan the emulator selects the
SwiftShader Vulkan ICD,
the software path that crashes `qemu`.
The documented working launch has no such flag.
It also wrapped the headless emulator in `xvfb-run` and capped the container at 2 CPUs and 6 GiB
while giving the guest 2 cores and 4 GiB,
and it used `-no-snapshot`, which forces a cold boot every run.
Whether these flags caused the ANRs is not yet established: a comparison run with the corrected flags was requested.
The failure recorded here is that the agent never compared its launch against `doc/troubleshooting/`
before attributing three separate failures to one external cause.

#### Left the unexplained Build number taps unexplained

The Build number taps showed a pressed highlight but never counted,
with seven plain taps and slower taps.
The agent did not look for why the taps were not counted,
and its report says the cause was not identified.
The press-duration variant and the unlock-switch fallback came from the orchestrator's instructions, not the agent.

### What the agent did well

It recorded original values before every write and restored them afterward,
verified the restores by reading them back,
never used `wm density` or `wm size`,
and reported plainly that no two-pane screenshot and no Smallest width measurement existed.
A write to a platform flag was refused and it did not look for a way around the refusal.

### Lesson

When a Haiku agent reports an environment cause (load, flaky host, slow machine) for repeated failures,
check the cause with a measurement and compare the agent's launch command with the repo's troubleshooting records
before accepting it or waiting.
The brief for this task also did not tell the agent to search `doc/troubleshooting/`,
so briefs for tool-driven tasks should name that search as a first step.

## Desktop Settings redesign with a newer Slint syntax (2026-10-11)

### Goal

Redesign the desktop Settings page in `package/music-player/desktop-app/ui/settings.slint` after the stock Android
Settings look,
in a Slint 1.17 app.

### Mistakes

#### Wrote properties that only Slint 1.18 accepts

The agent renamed the Flickable `viewport-width` and `viewport-height` to `content-width` and `content-height` in
`settings.slint`.
Those names exist in Slint 1.18 and do not exist in the 1.17 the app builds with,
so the 1.17 build rejected the file.
The agent's lint run passed anyway,
because `lint:slint` runs the `slint-viewer` that mise installs at `latest` (1.18.1),
not the version the app compiles with.
The agent treated a green lint as proof that the file compiles in the app.

Correct behavior: after a Slint edit, build the app itself (or render with the app's own Slint version) before reporting
the file as verified,
and read the version the project pins before using syntax from release notes.
The orchestrator reverted the rename.
The linter and the app were aligned only by the later bump of every Slint crate to 1.18.1.

### Lesson

A passing linter proves the linter's version accepts the file.
When a linter and a build can disagree on a tool version,
the brief should require the build as the verdict and name the pinned version.

## Audio stutter fix delivered without a test verdict (2026-10-11)

### Goal

Find and remove audio stutters in the desktop player under high system load,
with measurements before and after,
in a separate worktree.

### Mistakes

#### Handed back a fix without running its own gates

The final report says the package test task never produced a verdict (the agent stopped it while it was still
compiling,
and the log ends in SIGTERM),
the clippy task was not run,
and the final code was not measured again after a last edit that removed per-thread priority resets.
The agent said so plainly,
but the work came back unverified for every gate the brief required.

#### The prescribed stress condition did not reproduce the problem

The brief's four-core, 32-load condition showed zero underruns on the unchanged code too,
so the effect shows only in one-core controls that the agent chose.
The agent also never proved that the PipeWire xrun counter can move,
so its statement that PipeWire scheduling is not a cause is unvalidated by its own admission.

#### Lost track of state it did not own

The agent's null sink vanished between runs without a cause,
and the user's own music player process that was playing at the start was gone at the end.
The agent did not check that process between start and end,
so its exit is unexplained.

### Lesson

For measurement tasks, a Haiku agent will stop early and report honestly what it skipped.
The orchestrator should treat the skipped gates as the remaining work,
resume the agent with exactly those gates,
and require a state check of every process the agent does not own at start and end.

## Taskbar progress fix stopped at a toolchain error (2026-10-11)

### Goal

Reproduce the jumping KDE taskbar progress with the nested compositor's launcher capture,
fix it,
and show before and after streams.

### Mistakes

#### Returned an interim stop as the final report

After about ten minutes the agent handed back a report that said it was waiting on a background build.
It had made no capture and no edit,
so the hand-back carried only static code reading and a build blocker.

#### Stated a toolchain claim that a direct check contradicted

The agent reported that all five installed nightly toolchains fail to compile `branches` 0.4.4 with
`core::intrinsics::abort`.
A scratch crate that depends on `branches` at exactly 0.4.4 compiled cleanly with `nightly-2026-09-22`.
The failure belongs to the newest nightly that an upgrade had just installed,
not to every installed nightly.
The agent then built with the stable toolchain through raw `cargo` as a workaround instead of reporting the exact toolchain
boundary.

### Lesson

A claim of the form "every installed X fails" needs one run per X.
When a build blocks a task,
the agent should isolate which toolchain version breaks and report that,
and the orchestrator should check a blocker claim with a minimal reproduction before building plans on it.

## Kotlin ports and Compose screens (2026-10-10)

### Goal

Port the track template engine and keyboard classifier to Kotlin,
then build the Compose screens of the accepted design,
as recorded in `doc/planning/music-player-production-implementation.md`.

### Mistakes

#### Missing KDoc on most declarations

The first pure-logic ports compiled and mirrored every reference case,
and detekt then reported 97 findings,
mostly missing KDoc on local values.
A second Haiku round fixed them.

#### Drew text and icons black on the dark canvas

The first native captures of the player screen showed text and icons in black on the dark canvas,
because the agent provided no content color.
The same gap appeared again in the debug host for the Search, Settings and template editor routes.

### What worked

The ports mirrored the reference tests case by case,
and the orchestrator's own reruns agreed with the agents' reports for that kind of pure-logic task.

### Lesson

Pure logic with a tested reference suits Haiku.
Compose screens need captures on the real surface in light and dark,
and the brief should state the lint rules (KDoc on every declaration) up front.

## Native commit-path landing lane (2026-10-11)

### Goal

Port the landing loop of the Rust Git policy wrapper (`package/git-policy/cli/src/native/`) in the worktree
`.claude/worktrees/cli-git-lane-landing`:
phase markers, landing support, object migration, post-index, the real index lock install, the landing attempt and
its acceptance tests and gates.
The lane's record is `doc/handover/cli-git-native-landing.md`.

### Mistakes

#### Handed back after groundwork, four times

The first hand-back came with the phase markers uncommitted and no result for their tests.
After the orchestrator resumed the agent with the ordered step list and the instruction "do not hand back until done",
it handed back three more times, each with the lane unfinished and each time asking to be resumed.
The harness also sometimes drops hand-back reports, so every early hand-back cost a watchdog cycle to detect.

#### Misread its own commit as not landed

After a commit through the wrapper printed a logger error ("sink verification failed for entry 3: Timed out after
5000ms"), the agent reported that the commit did not land and the files were still staged.
The branch log showed two commits from that attempt (`a3b6fb29b8` and `15ee7bdda0`).
It did not run `git log` before reporting.
The orchestrator, trusting the report, committed the staged files again and produced an empty duplicate commit.

#### Proposed a behavior regression as a deviation

The plan wrote the PID file before `index-lock-<n>.json`, the reverse of the TypeScript incumbent, and listed it under
"Deviations to record" while noting that recovery cannot attribute a lock in that window.
A window in which recovery cannot attribute a lock is a regression against the incumbent, not a documentation item.
The orchestrator told the agent to match the incumbent's order or to prove it impossible and make recovery tolerate it.

### What went well

The agent kept its evidence doc and said plainly what was unconfirmed and not started.
Its landing support, object migration and post-index modules passed their tests.

### Lesson

For a serial slice with crash-consistency requirements, send the lane to a Sonnet subagent from the start.
When a Haiku agent reports the state of the repository (committed, staged, clean), read the repository
(`git log`, `git status`) before acting on the report.
A brief that says "do not hand back until done" did not hold a Haiku agent to it.
