# Claude CPU cap and thermal watch

## Purpose

On 2026-10-13 the user asked why Claude sessions did not use all CPU threads on the 16 core, 32 thread Ryzen 9 7950X
host (62 GiB RAM, Bazzite, kernel 7.2.9).
The session found a stale limit, lifted it, capped Claude's own work at a chosen share, and added a watcher.
It then moved on to whether the machine runs too hot, which is still being measured.
This file is the running record.
The operating instructions live in `doc/runbook/claude-cpu-cap.md`.

## User decisions

- The whole account may use all 32 threads (a persistent `AllowedCPUs=0-31`).
- Claude tool commands, including gate jobs run through `gate-slot.ts`, share one cap.
  It was 24 threads, then 30 by user request ("still exploring the new CPU"), then 28 after the tone-down rule.
  The user raised it back to 30 at about 18:55 EDT because their fan curve is more aggressive (full speed from 61
  degrees instead of 65). The curve read back from CoolerControl still showed 65 at that
  moment; the user saved it a few minutes later and it now reads 100% at 61 degrees (30%/45%/60% at 40/50/60).
- Tone-down rule from the user: if the system gets bad, lower the cap 2 threads at a time.
- IO pressure is non-actionable (the user's drives are slow) and is not watched.
- The temperature alert is a throttling alert (user choice, 2026-10-13): Tctl at or above 95 degrees Celsius and the
  average clock at least 100 MHz below the boost-off clock of 4490 MHz. Plain 95 degrees no longer alerts, because
  Zen 4 regulates itself to 95 by design. The earlier plain limit of 95 was raised from 90 by the user.
- No deliberate stress tests: the user needs the machine to work. Temperatures are judged from real work.
- Boost and PBO stay off. The user disabled them (`/sys/devices/system/cpu/cpufreq/boost` is 0).
- Commit eagerly.
- The user allowed storing the CoolerControl token on disk and will rotate it on 2026-10-14.
- The user's own fan changes no longer count as an excuse for an alert: they are confident that tinkering will not
  push the CPU to 95 degrees as before, so every alert is real and no alert is exempt (2026-10-13).
- The 4-hour stop-working check is pushed back to 4 hours after every weird event (user rule, 2026-10-13).
  Weird means any alert except IO pressure, a cap change, `WATCHER-ERROR`, an unresolved `FAN-READ-FAILED`,
  or a `WATCHER-STOPPED` the session did not cause.

## Current state

- `user.slice` and `user-1000.slice` have `AllowedCPUs=0-31`, persisted in `/etc/systemd/system.control`
  (replacing the drop-in from 2026-02-22 that held `0-15` and left threads 16 to 31 idle).
- `claude-cpu-watch.service` (user unit, enabled, linger on) re-applies the quota to the `claude-code-bash` cgroup.
  Claude Code creates that cgroup anew in every boot and has no CPU limit setting, so a service has to do it.
  The thread count is read from `~/.config/claude-cpu-cap/threads` every 2 seconds
  (28 now, lowered from 30 at 20:15:53 after the 95.3 degree alert).
- The watcher alerts on CPU pressure 40, memory pressure 10, scheduler lag 250 ms and thermal throttling (100 MHz).
  The 20:15 episode (before this change) showed a clock shortfall of 60 to 180 MHz at 95 degrees, so 100 MHz can
  still fire during normal 95 degree regulation; the limit is `CPU_WATCH_LIMIT_THROTTLE_MHZ`.
  The pressure limit of 40 was a first guess and is uncalibrated.
- It logs a sample every 10 seconds to `~/.local/share/claude-cpu-cap/samples/<date>.csv` (14 days kept):
  temperatures, package watts, per-chiplet watts, clock, pressure, load, Corsair fan RPMs and probe,
  motherboard readings, and a burst flag (2-second samples for 90 seconds after a 25 watt step).
- The fan profile "CPU Cooler (Silent)" in CoolerControl was replaced by this session with:
  30% at 40 degrees and below, 45% at 50, 60% at 60, 85% at 70, 100% at 75 and above, from Tctl, no smoothing.
  The previous version (which already had the user's own 75-degree to 100% edit) is saved at
  `~/temp/agent/cc-spec/silent-before.json`; restore it with `PUT /profiles`.
  The user then changed it themselves and will keep adjusting it, because they cannot tolerate much noise while the
  machine is quiet.
  Current curve: 30% at 40, 45% at 50, 60% at 60, 100% at 61 and above (saved by the user about 18:57 EDT).
  The fan profile belongs to the user now; this session does not edit it unless asked.
- Session-only items that die with the session: the Monitor (30-minute expiry, re-arm each time) and a one-shot cron
  check that ends the watch if nothing weird happened. Its job id changes at every push, so read it with CronList;
  this file records the rule, not each id. The first setting was 21:19 EDT; since then it moved after the alerts at
  18:02:37 (CPU pressure), 19:16:45 (memory pressure), 20:11:41 (CPU pressure), 20:15:27 (temperature) and 20:24:45
  (throttle), and the throttle alert flaps, so more pushes follow. After the alert at 20:28:24 it stands at 00:31 EDT
  on 2026-10-14 (the latest weird event so far).
- The 20:11:41 CPU pressure alert (46.1, limit 40) came at cap 30 and 130 W. It was the first sustained load in the
  log: about 55 seconds at 125 to 136 W, load average up to 57 on 32 threads, pressure up to 67.8, and it cleared at
  17.2 within a minute. Tctl stayed below 95, so the cap was left at 30. Its numbers are in the evidence section.
- The 19:16:45 memory pressure alert (16.4, limit 10) came at cap 30 and 132 W; it cleared at 3.7 within about a minute.
  Tctl was 77.6 degrees and 41 GiB were available. The `claude-code-bash` cgroup held 2 GB of its 8 GB limit, and the
  host ran a 5 GB `qemu-system-x86` process. The cap was left at 30: one short blip is not a degraded system, and
  nothing shows the CPU cap caused it. A repeat or a longer episode is the trigger to lower it.
- The user raised the shared `claude-code-bash` memory limit from 8 GB to 32 GB at about 19:45 EDT.
  The live `memory.max` was written (reads 32000000000) and `CLAUDE_CODE_TOOL_MEMORY_LIMIT` in
  `~/.claude/settings.json` is now 32000000000 for sessions started later.
  `doc/troubleshooting/systemd-oomd-reaps-terminal-scope-with-the-agent-in-it.md` still shows 8000000000 as its
  example and says the limit must sit above the heaviest build's peak; it was not edited.
  Open check: a session started with the old environment might write 8 GB back; compare `memory.max` later.
- Other sessions were told about each change by cross-session message
  (the four peers got the memory limit change at about 19:46 EDT).
  `gate-slot.ts` (in `~/temp/agent`, outside the repo) no longer wraps commands in a `systemd-run` scope,
  so gate commands stay under the shared cap.

## Evidence so far

- Before the change, threads 0 to 15 were 15% to 98% busy and threads 16 to 31 were at 1% to 3%, with load near 30.
- One core does AES-XTS at about 4.9 GiB/s in memory (VAES AVX-512 driver), so encryption compute is not the limit.
  While writing 4 GiB to `/var/home`, the encryption workers sat near 0.3% CPU and the machine was 77% idle.
- That write ran at 88.5 MB/s; raw reads of the NVMe partition ran at 187 MB/s (one request in flight)
  and 325 MiB/s (8 parallel readers). Other sessions were doing IO at the time, so these are lower bounds.
- The NVMe is healthy (2% worn, 0 errors, 48 degrees).
  Its PCIe link runs at 8 GT/s x4 while it reports 16 GT/s as maximum.
  The cause of the low disk speed is not found. The volumes have no `no_read_workqueue` or `no_write_workqueue` flag.
- Hot episodes: 94.8 to 96.1 degrees at 135 W and 4483 MHz (boost off), with CPU pressure near 57.
  A later alert at 91.1 degrees had the fans at 2000 to 2600 RPM. Idle runs about 54 degrees at 60 W.
- Analysis of the sample log, 18:11 to 18:44 EDT on 2026-10-13 (336 rows, 173 of them burst rows, cap 28 throughout;
  scratch scripts `~/temp/agent/analyze-samples.ts`, `analyze-columns.ts`, `analyze-mapping.ts`, outside the repo):
  - No settled data above 80 W exists yet. The loads were three short bursts, and Tctl rose from about 65 to 94.5
    degrees in about 25 seconds as package power climbed from 105 to 149 W, then fell within 4 to 6 seconds
    once power dropped.
  - Time at or above Tctl 85 was 42 seconds, 90 was 16 seconds, 93 was 6 seconds, and 95 was 0 seconds in the window.
    Highest value 94.5 degrees at 149 W for one 2-second sample, with the first fan at about 2030 RPM,
    its highest observed speed, so the fans were already at their top at the spike.
  - Settled Tctl, 40 to 80 W: 55 degrees at 45 to 55 W, 58 at 60 to 70 W, 62 at 70 to 80 W.
    The quiet-load slope is 0.29 degrees per watt (130 rows).
    A straight-line extension to 149 W gives about 82 degrees, so the 94 degree spikes sit about 12 degrees above
    that line; this is an extrapolation, not a measurement, and fan speed also rises with load.
  - Verdict for this window: about 90 degrees was a short peak, not a settled value.
    The earlier alerts at 17:27 to 17:49 lasted at least 6 seconds each and are before the log starts,
    so whether a sustained 120 W or more settles below 95 is still unanswered.
  - The first chiplet is cores 0 to 7: in 251 of 253 rows with a clear gap, the chiplet with more watts was the one
    with the hotter CCD (Tccd1 vs Tccd2), consistent with that mapping.
    Chiplet 1 drew about 53 W against 48 W for chiplet 2 at the 149 W peak.
  - The Corsair probe stayed between 25.5 and 26.2 degrees across 42 to 149 W (correlation with watts -0.12).
    It does not follow heat from the cooler, so it measures something near room temperature.
    The cause is not known (probe not in the exhaust stream, loose contact, or a slow sensor).
    It cannot yet serve as the heatsink-exhaust reference the user wanted.
  - Motherboard readings: `board3_c` follows load (52 to 94 degrees, correlation 0.83 with watts), so it matches the
    CPU reading. `board5_c` moves a little with load (39 to 42). `board1_c`, `board2_c`, `board4_c`,
    `board6_c` move at most 2 degrees. `acpi_c` is constant at 16.8, so it is not informative.
  - Pressure stayed at or under 11.4 and the one-minute load at or under 20 in the window,
    so the 40 limit was not tested.
- First sustained load, 20:11:38 to 20:12:28 EDT on 2026-10-13 (24 rows, cap 30; script
  `~/temp/agent/analyze-episode.ts`): package power median 129.7 W (124 to 136), average clock 4490 MHz,
  Tctl median 88.8 degrees (86.5 to 92, never 95), Tccd1 86.6 and Tccd2 82.9, first fan at 2009 RPM (its top speed),
  Corsair probe 26.0 degrees. Tctl rose from 75.6 to 87.3 within 10 seconds of the load starting, then stayed flat
  at 88 to 91 for about 40 seconds, and fell to 64 within 20 seconds of the load ending.
  Reading: at 130 W with the fans at their top speed, about 89 degrees is a plateau over a 40 second window, not a
  short peak. This corrects the earlier verdict that about 90 was only a peak (that window had no sustained load).
  The 94 to 96 degree episodes happened at 135 to 150 W. A longer load could still creep up as the heatsink warms;
  one 55 second episode cannot rule that out. The quiet-load slope of 0.29 degrees per watt under-predicts this
  plateau (it predicted about 76 degrees at 130 W), so the slope is steeper at high power.
  Chiplet 1 drew 42.9 W against 38.8 W for chiplet 2 and ran 3.7 degrees hotter.
- Second sustained load, 20:15:21 EDT onward on 2026-10-13 (cap 30, then 28 from 20:15:53): Tctl pinned at
  95.3 to 95.4 degrees for more than a minute (flat to 0.1 degree), package power 134 to 140 W (down from 146 W at the
  start), average clock down from 4489 to about 4350 to 4430 MHz, first fan at 2009 to 2036 RPM,
  CPU pressure only 2 to 3,
  one-minute load 17 to 23. The chip was regulating itself to the 95 degree target.
  - TechPowerUp (Ryzen 9 7950X cooling requirements, fetched 2026-10-13) states that Zen 4 is designed to sit at
    95 degrees under load: it boosts clocks and voltage until 95, then regulates to stay at 95 by lowering clocks,
    and weaker cooling shows up as lower clocks, not higher temperature. AMD is quoted as saying the processor is
    designed to run at that temperature 24/7 without risk of damage.
    So a 95 degree reading under sustained load is expected behavior, and the 95 degree alert fires on it by design.
  - The cap was binding in the 20:11 episode (load average up to 57 on 32 threads) but not in this one
    (load 17 to 23, below the cap), so lowering the cap from 30 to 28 at 20:15 cannot have reduced this heat.
  - Reference numbers with their limits. GamersNexus (NH-D15 G2 review): the 2023 NH-D15 (the G1 design) ran
    53.3 degrees over ambient at about 198 W with 100% fans, on a Ryzen 9 3950X overclock (not Zen 4; ambient not
    stated). That is about 0.27 degrees per watt. Here: 95.4 minus the probe's 26.0 is 69.4 degrees over ambient at
    137 W, about 0.51 degrees per watt, roughly 1.9 times the reference. At the reference ratio, 137 W would sit near
    63 degrees. Noctua states the G2 is 2 to 3 degrees better than the original at 180 to 250 W, and GamersNexus
    measured about 1 degree, so the G1 versus G2 difference is small next to this gap.
  - TechPowerUp ran a single tower Noctua NH-U14S (rated 165 W) on the same chip: at full fan it held frequencies well
    above 5 GHz on all threads at 95 degrees, with a power chart that spans 100 to 225 W. This setup, with a bigger
    dual tower cooler, reaches 95 degrees at about 137 W and 4.4 GHz with boost off.
    Different platform, case, ambient and fan setup, so this is a rough comparison, not a controlled one.
  - Caveats on the 0.51 figure: a Zen 4 chip may be harder to cool than the 3950X for reasons not checked here
    (heat spreader thickness, die layout), and the probe is a loose ambient reference (see hardware facts).
    A gap this size is still more than the G1 versus G2 difference, so the contact or airflow path is the suspect.
- The same load continued: 20:16:30 to 20:25:00 EDT (59 rows, cap 28), Tctl median 95.4 (95.3 to 95.6), package power
  median 132.9 W (123 to 137), average clock median 4407 MHz (low 4289), fans at their top speeds. So the setup settles
  at about 95.4 degrees, 133 W and 4.3 to 4.4 GHz with boost off;
  this answers the earlier question about a settled value.
  The new throttle alert fired at 20:24:23 (158 MHz shortfall), cleared at 20:24:39, and fired again at 20:24:45
  (197 MHz); it flaps because the average clock jitters around the 100 MHz limit. The cap stayed at 28 (the load average
  was 21 to 45, mostly under 32 threads, and the chip regulates itself at 95 degrees).
- User's mounting answer (about 20:20 EDT): they believe all the checklist steps were done right and are considering
  buying the NH-D15 G2 in its AM5-suited version.
  Noctua sells no AM5-only SKU. The regular G2 includes the AM5 offset bars and, with the offset, matches or beats the
  LBC variant on AM5; LBC suits AM5 without the offset or for the lowest CCD and IOD temperatures;
  HBC is not recommended
  for AM5 (Noctua's G2 version FAQ and contact quality article, fetched 2026-10-13). The G2 gain over the G1 is
  2 to 3 degrees by Noctua and about 1 degree by GamersNexus, small next to the measured gap.
  The zero-cost next step is to lift the cooler and inspect the paste imprint and the base;
  no purchase decision is made.
- Memory pressure, measured at 19:30 EDT (the user asked why tasks stall with so much memory in total):
  - The host is not short of memory: `MemAvailable` 45 GiB of 62 GiB, `user-1000.slice` peaked at 46 GB against a
    `memory.high` of 59.8 GB that it never reached (0 high events).
  - The `claude-code-bash` cgroup has a 8,000,000,000 byte limit (`CLAUDE_CODE_TOOL_MEMORY_LIMIT` in
    `~/.claude/settings.json` line 9) shared by every session's tool commands. Its peak is 8,000,282,624 bytes
    and `memory.events` counts 1,055,909 `max` events since boot, so it hits its own limit constantly.
    Inside a cgroup at its limit, each allocation reclaims in that cgroup, and the stalls count as memory pressure
    for the whole host. At 19:16 the cgroup read `some avg10` 8.03, the host 8.25.
  - Other cgroups at their limit: a podman container with a 2 GB limit (540 `max` events).
  - Not proven: at the instant of the 19:16 alert the cgroup held 1.96 GB, below its limit, and `memory.peak` is a
    lifetime figure. The `max` event counter was not captured around the alert.
  - A link to the CPU cap is plausible but unproven: more parallel jobs under the same 8 GB limit means more reclaim.
  - The earlier framing in this handover and in the conversation, "RAM is full and the kernel reclaims", was wrong.
    Since-boot counters (direct reclaim 98 million pages scanned, 12.2 million swapped to zram) fit cgroup-local
    reclaim, which direct reclaim counters include.
- Reference points found online (different benches): 78 degrees at 142 W on a 240 mm AIO (forum report),
  86.1 degrees at about 204 W on a water loop, 87 degrees at 200 W for an NH-D15 G2 on a 9950X.
  Neither fixes an expected value for this setup.

## Hardware facts

- CPU cooler: a dual-tower Noctua NH-D15 G1 (the original). The user first said G2, then confirmed at about 20:17 EDT
  on 2026-10-13 that it is the G1.
- Fans: 7 Noctua and 1 Lian Li, some chained, on a Corsair Commander Core XT (5 of 6 ports used; fan3 is empty).
  CoolerControl labels the controller "(broken)" but applies profiles successfully.
- The Corsair probe sits on top of the air cooler's heatsink. Its tape cannot be bent, so the tip cannot touch the
  fins (user, 2026-10-13). It therefore reads the top surface and the air around it, which matches the flat
  25.5 to 26.2 degree reading; it is not a heatsink-fin reading. It cannot separate contact from airflow problems.
  The user's view: it still gives a room or case temperature, which is useful.
  Treat it as the ambient reference (about 25.8 degrees in the first window) when comparing Tctl against watts.
- The `fan1` reading in `sensors` belongs to the GPU, not a CPU fan. An early claim based on it was wrong.
- Motherboard: Gigabyte B650 GAMING X AX rev 1.3. The six `gigabyte_wmi` readings are unlabeled and no source maps them.
  Early data: only the third one tracked CPU load.

## Rejected or withdrawn

- A VM or loop-device test of the dm-crypt flags: the user pointed out it would not be bare metal.
- A sustained-load stress test: declined by the user.
- Boost and PBO: documented behavior says they push the chip to 95 degrees sooner for more clock, so they add heat.
- Switching to ZFS or CachyOS: not recommended yet, since nothing shows the filesystem is the limit.
  Another handover, `doc/handover/cachyos-zfs-vm-validation.md`, exists; it was not read here.

## Per-session limits (researched, nothing implemented)

The user asked on 2026-10-13 whether every session can have its own limits.
They pointed at `tweakcc` hoping to learn something, and said not to patch the binary; it was not patched.
`tweakcc unpack` of version 2.1.296 yields only a bytecode stub (no `claude-code-bash` in it),
so the findings come from reading the readable source strings inside the binary with `strings`.

- Claude Code names the tool cgroup with a constant, `claude-code-bash`, and creates it as a sibling of the cgroup
  that Claude itself runs in: `<parent of Claude's own cgroup>/claude-code-bash`, with `memory.max` set from
  `CLAUDE_CODE_TOOL_MEMORY_LIMIT`. If Claude's own cgroup path already contains a `claude-code-bash` segment,
  it logs "nested: already capped" and reuses it. The tool cgroup is not named per session.
- Every session started from a terminal surface lives in `app.slice/app-ghostty-surface-transient-N.scope`,
  so its parent is `app.slice` and all of them share `app.slice/claude-code-bash`.
  That is the whole reason it is shared.
- There is no CPU setting in Claude Code. `CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE` only picks which helper classes
  (mcp, lsp, hooks, plugin, tmux, helper, agent) stay outside the cgroup.
- Verified by a real run: `systemd-run --user --scope --slice=claude-probe.slice -- claude --print ...` put the
  session's Bash tool in `.../user@1000.service/claude.slice/claude-probe.slice/claude-code-bash`, a separate cgroup.
  (A dash in a slice name nests it: `claude-probe.slice` sits inside `claude.slice`.)
  The probe slices were stopped afterwards. Interactive sessions were not tested.
- Verified on a throwaway slice (stopped afterwards): `systemctl --user set-property claude-limittest.slice
  MemoryMax=2G CPUQuota=300%` made the slice's `memory.max` read 2147483648 and `cpu.max` read `300000 100000`,
  and the `cpu memory pids` controllers were available under `claude.slice`.
  Depth is not limited here (`cgroup.max.depth` and `cgroup.max.descendants` read `max`).
- So per-session limits need no patch: start each session in its own slice, and put `MemoryMax=` and `CPUQuota=` on that
  slice, which covers both the session and its tool cgroup. A drop-in directory `claude-.slice.d` in
  `~/.config/systemd/user/` would apply to every `claude-*.slice`, and limits on `claude.slice` would be a shared total.
- Not decided: the per-session numbers, whether to keep a shared total, and how sessions get launched
  (a `claude` wrapper in `PATH`, a shell function, or `spawn-claude`). Running sessions keep the shared cgroup until
  restarted, because Claude reads its own cgroup path once at startup.
- The CPU watcher writes `cpu.max` only into `app.slice/claude-code-bash`. Per-session slices would carry their
  limits in systemd properties, and the watcher would need a decision about how to tone those down.

## Open questions

- The cooler is the NH-D15 G1 (answered). Is it mounted correctly? The numbers in the evidence section say the heat
  path is far weaker than references; the G1 itself does not explain it. The user tightened the screws until they
  could not turn them with a normal screwdriver and little force, which matches Noctua's instruction (below).
  Noctua's NH-D15 manual and torque FAQ (fetched 2026-10-13) give this checklist, with the user's answers pending:
  - Tighten the heatsink screws 2 to 3 turns each in turn, then repeat, "gently until they stop"; maximum torque
    0.6 Nm for the spring-loaded screws and for the NM-ALS1 screws on the AMD mounting bars. The manual gives no force
    in newtons.
  - Remove the plastic protection cover from the heatsink base before mounting (the manual lists it before the
    heatsink is placed on the CPU).
  - On AM5 use the -7 mm offset hole position of the NM-AMB12 mounting bars "to ensure optimal contact quality";
    the standard position (0) is for compatibility problems.
  - NM-AMB12a ("NORTH") on the top side of the socket, NM-AMB12b ("SOUTH") on the bottom side, "CPU" arrows toward the
    CPU, plastic spacers on the stock AMD backplate, which stays in place.
  - Paste: 5 dots of NT-H1 (four of about 2 mm near the corners, one of 3 to 4 mm in the centre); too much lowers
    conductivity.
- How hard is the cooler-to-die path really? The 20:11 plateau gives 88.8 degrees at 130 W with 26 degree ambient,
  about 0.48 degrees per watt over ambient. Compare it with the 0.32 degrees per watt implied by the one online
  NH-D15 G2 report (87 degrees at 200 W, assuming a 23 degree ambient that the report does not state, so it is
  loose). A reseat or mounting check is the
  next physical step, and it is the user's call.
- What do the six motherboard readings measure? (The ambient reference is the Corsair probe; see the hardware facts.)
- The probe cannot touch the fins (answered above), so fin or exhaust temperature stays unmeasured.
  Contact versus airflow now has to be judged from Tctl against watts and fan speed.
- A higher fan floor was offered and not taken: the user is balancing noise themselves and edits the curve.
- Is 40 the right pressure limit? Judge from settled data.
- `ide7`, `ide8`, and `tr-gate` units run outside the cap (their own cgroups).
- The hold paragraph in `doc/handover/cli-git-rust-implementation.md` should point to this work.
  The session `monochromatic-18` was asked to update it.
- A reboot has not been tested against the persistent setup.
- After the token rotation, the new token goes into `~/.config/claude-cpu-cap/cc-token`;
  until then the fan columns stay empty.

## Next actions

1. Re-arm the Monitor on each expiry; react to alerts with the tone-down rule,
   and push the 4-hour check back to 4 hours after each weird event.
2. When a session has run sustained load, run `node ~/.local/share/claude-cpu-cap/summarize-samples.ts 1`.
   It still needs a chiplet comparison and a (Tctl minus probe) per watt figure.
3. At the 4-hour check, end the watch if nothing is open; keep the service running.
4. Record every user decision and measurement in this file as the session continues.

## Commits so far

- `6bb8cc9a7d`, `25909f463a`, `609b693cf5`, `bc561191bb`, `6c8d57d685`, `59c107b737`: the runbook, in order.
- `1aedd30d61`, `bdae3faedd`: this handover.
