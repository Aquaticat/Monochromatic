# Claude CPU cap and degradation watch

This runbook records how Claude sessions on the 16 core, 32 thread host are limited and watched,
and how to tone the limit down or up.
The user decided on 2026-10-13: the whole account may use all 32 threads,
and Claude tool commands (including gate jobs run through `gate-slot.ts`) share one cap,
currently 30 threads.

## What enforces the limits

Whole account: `AllowedCPUs=0-31` on `user.slice` and `user-1000.slice`,
persisted by `systemctl set-property` into `/etc/systemd/system.control`.
Before 2026-10-13 a drop-in from 2026-02-22 held `0-15`, which left the SMT siblings (threads 16 to 31) idle.

Claude tool commands: the `claude-code-bash` cgroup under
`/sys/fs/cgroup/user.slice/user-1000.slice/user@1000.service/app.slice/`.
Claude Code creates it anew in each boot (it exists because `CLAUDE_CODE_TOOL_MEMORY_LIMIT` is set)
and has no CPU limit setting, so a user service re-applies `cpu.max` to it.

The service is `claude-cpu-watch.service` (`~/.config/systemd/user/`, enabled, linger on),
running `~/.local/share/claude-cpu-cap/cpu-watch.ts`.
It reads the thread count from `~/.config/claude-cpu-cap/threads` every 2 seconds
and writes `<threads * 100000> 100000` into the cgroup's `cpu.max` when the value differs.

## Tone the cap down or up

Write the new thread count to the file; the service applies it within seconds:

```bash
# ~/.config/claude-cpu-cap/threads holds one integer from 1 to 32.
echo 28 > ~/.config/claude-cpu-cap/threads
```

Tone down 2 threads at a time while the user explores the CPU, as they asked.
`nproc` inside a new shell reports the cap.

## What the watch reports

The service prints a line only for an event, never for routine samples.
Read them with `journalctl --user --unit=claude-cpu-watch --follow --lines=0 --output=cat`.

- `ALERT <metric>=<value>`: the metric stayed at or above its limit for 3 samples (6 seconds).
- `CLEAR <metric>`: it stayed below for 5 samples.
- `CAP-APPLIED`: the quota was rewritten (the cgroup is new, or the file changed).
- `WATCHER-STOPPED` or a systemd stop line: nothing is watching until the unit restarts.

Limits: CPU pressure `some avg10` 40, memory pressure `some avg10` 10,
CPU temperature 95 degrees Celsius (raised from 90 by the user on 2026-10-13), scheduler lag 250 ms.
IO pressure is not watched on purpose: the user's drives are slow, and the user decided on 2026-10-13
that IO pressure is non-actionable.

## Sample log for judging temperatures

Every 10 seconds the service appends one CSV line to
`~/.local/share/claude-cpu-cap/samples/<local date>.csv` and keeps 14 days.
The columns are UTC time, Tctl, Tccd1, Tccd2, package watts, average clock, CPU pressure, one-minute load and the cap,
then the six Corsair fan RPMs and the Corsair temperature reading.
The meaning of that last reading is unconfirmed: CoolerControl labels it `temp1`, and the controller is a Commander Core XT.
The fan values come from the local CoolerControl API with an access token kept in
`~/.config/claude-cpu-cap/cc-token` (owner-only permissions).
When the token is rejected, for example after the user rotates it, the service prints one `FAN-READ-FAILED` line,
leaves the fan columns empty, and prints `FAN-READ-RECOVERED` once a working token is in the file.
Alert lines carry package watts and the average clock, but not fan speed:
the only hwmon fan sensor is the GPU's, and the case fans sit behind the Corsair controller.

Read the settled temperature per power bucket with `node ~/.local/share/claude-cpu-cap/summarize-samples.ts <days>`.
A sample counts as settled when the previous 2 minutes stayed in the same 20 watt bucket,
so alert-time spikes do not hide the steady state.
No stress test is run for this; it only records what the machine does under real work (user decision, 2026-10-13).

## Known gaps

- Units started with `systemd-run --user` (`ide7-gate*`, `tr-gate-*`) get their own cgroup in `app.slice`
  and are outside the cap.
- The cap is shared by all sessions, not per session.
- Processes started under the old `0-15` limit kept a narrowed affinity; a reboot clears that.
