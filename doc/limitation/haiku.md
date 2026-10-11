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
