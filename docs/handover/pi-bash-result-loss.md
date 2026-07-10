# Pi Bash result-loss and crash handover

## Priority and status

This investigation has priority over the remaining cli-git work.
Todo `#31` armed crash capture and is complete.
Todo `#32` is diagnosing the missing Bash tool results.
Todos `#33` and `#34` cover the fix or workaround,
regression evidence,
troubleshooting record,
and final handover.
Todo `#30` for cli-git issues `#353` through `#357` is pending behind `#34`.

The active affected Pi process is PID `1309170`.
Do not stop its monitor or signal-trace units while this session remains active.

## Observed symptom

Two synchronous Bash calls ran the same command:

```text
mise run //packages/cli/git:test:unit
```

The calls began at `2026-07-10T16:46:38Z` and `2026-07-10T16:49:57Z`.
Neither acquired a `toolResult` entry in the Pi session JSONL before the user restarted Pi.
The user reported the first restart at `2026-07-10T16:49:38Z` and the second at
`2026-07-10T16:57:26Z`.
The source evidence is in
`/home/user/.pi/agent/sessions/--var-home-user-Monochromatic--/2026-07-09T22-31-45-304Z_019f4902-2598-7eb1-822e-239618ee2503.jsonl`,
starting near lines `8640` and `8646`.

The test suite itself is not failing:

- A one-file-at-a-time process-tool run passed all cli-git unit tests in 27 seconds.
- The exact parallel command passed through the process tool in 5 seconds.
- The successful parallel run produced 34 stdout lines and 25 stderr lines.

This narrows the incident to the synchronous Pi Bash execution/result boundary or an interaction specific to that
boundary.
It does not establish the exact cause.
Do not repeat the same synchronous invocation to gather more evidence.
Commit `ede6fc66a` added rule `NXR` to `AGENTS.md` and generated `CLAUDE.md` so future sessions change execution paths
after a missing result or restart.

## Crash capture now armed

The current Pi process already has an unlimited soft and hard core-file limit.
The host routes core dumps through `systemd-coredump`:

```text
kernel.core_pattern = |/usr/lib/systemd/systemd-coredump %P %u %g %s %t %c %h %d %F
```

`systemd-coredump.socket` was active when checked,
and `/var/lib/systemd/coredump` had more than 400 GB available.
No Pi or Node core dump existed for either observed restart.
This means the prior incidents may have been hangs,
manual termination,
or non-dumping termination rather than fatal signals.
The next incident monitor can distinguish those cases.

The crash-surviving systemd user units are:

- `pi-crash-monitor-1309170.service`
- `pi-signal-trace-1309170.service`

Both were active after installation.
The monitor samples `/proc/1309170` once per second,
including process state,
resident and peak memory,
swap,
thread and file-descriptor counts,
children,
I/O counters,
resource limits,
cgroup,
and system CPU,
memory,
and I/O pressure.
When PID `1309170` disappears,
it writes a final event and captures journal,
coredump,
and process-list evidence.
The signal tracer records signals delivered to the active Pi process.

Artifacts live at:

```text
/var/home/user/temp/agent/pi-crash-monitor-1309170-20260710T1705/
```

Important files are:

- `samples.jsonl`
- `signals.strace`
- `monitor.json`
- `journal.log`, after process disappearance
- `coredumps.log`, after process disappearance
- `processes.log`, after process disappearance

The monitor source is:

```text
/var/home/user/temp/agent/pi-crash-monitor-1309170.mjs
```

After the next restart,
inspect the artifact directory before starting another synchronous Bash verification.
Also run `coredumpctl list` and preserve any matching dump identity before cleanup.

## Pi source trace

Installed Pi is `@earendil-works/pi-coding-agent` `0.80.6`.
A disk-backed source clone of tag `v0.80.6` is at:

```text
/var/home/user/temp/agent/pi-bash-result-loss-20260710-1329434
```

The clone is commit `2b3fda9921b5590f285165287bd442a25817f17b` from
`https://github.com/earendil-works/pi.git`.

`packages/coding-agent/src/core/tools/bash.ts:96-103` spawns a detached shell with piped stdout and stderr.
`packages/coding-agent/src/core/tools/bash.ts:123-140` streams both pipes and awaits `waitForChildProcess`.
`packages/coding-agent/src/utils/child-process.ts:38-47` says the helper is intended to avoid hangs caused by detached
descendants retaining inherited pipes.
`packages/coding-agent/src/utils/child-process.ts:88-126` arms a 100 ms post-exit idle timer and also finalizes on close.
The observed missing result therefore occurred despite the installed release containing that anti-hang path.

Do not conclude that `waitForChildProcess` is faulty until the next monitor evidence or a minimal Bash-tool harness
shows which event or promise remained unsettled.

## Next diagnostic steps

- Preserve monitor artifacts immediately after PID `1309170` disappears.
- Distinguish fatal signal,
  OOM kill,
  clean exit,
  and user termination from `signals.strace`,
  `coredumpctl`,
  and the journal.
- Build a minimal SDK harness around `createBashTool` using the same command and environment as the synchronous Pi tool.
- Compare built-in Bash execution with the process extension while holding command,
  cwd,
  environment,
  and output constant.
- Instrument only the shell `exit`,
  `close`,
  stdout `end`,
  stderr `end`,
  and idle-timer boundaries in a disposable Pi source prototype.
- Write `docs/troubleshooting/pi-bash-result-loss.md` with the complete source trace and upstream-filing decision after
  the cause or durable workaround is verified.
- Resume cli-git only after todos `#32` through `#34` are complete.
