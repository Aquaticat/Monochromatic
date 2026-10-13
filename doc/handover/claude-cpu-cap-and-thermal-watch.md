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
  It was 24 threads, then 30 by user request ("still exploring the new CPU"), and is 28 after the tone-down rule.
- Tone-down rule from the user: if the system gets bad, lower the cap 2 threads at a time.
- IO pressure is non-actionable (the user's drives are slow) and is not watched.
- The temperature alert limit is 95 degrees Celsius (raised from 90 by the user).
- No deliberate stress tests: the user needs the machine to work. Temperatures are judged from real work.
- Boost and PBO stay off. The user disabled them (`/sys/devices/system/cpu/cpufreq/boost` is 0).
- Commit eagerly.
- The user allowed storing the CoolerControl token on disk and will rotate it on 2026-10-14.

## Current state

- `user.slice` and `user-1000.slice` have `AllowedCPUs=0-31`, persisted in `/etc/systemd/system.control`
  (replacing the drop-in from 2026-02-22 that held `0-15` and left threads 16 to 31 idle).
- `claude-cpu-watch.service` (user unit, enabled, linger on) re-applies the quota to the `claude-code-bash` cgroup.
  Claude Code creates that cgroup anew in every boot and has no CPU limit setting, so a service has to do it.
  The thread count is read from `~/.config/claude-cpu-cap/threads` (28 now) every 2 seconds.
- The watcher alerts on CPU pressure 40, memory pressure 10, scheduler lag 250 ms and temperature 95.
  The pressure limit of 40 was a first guess and is uncalibrated.
- It logs a sample every 10 seconds to `~/.local/share/claude-cpu-cap/samples/<date>.csv` (14 days kept):
  temperatures, package watts, per-chiplet watts, clock, pressure, load, Corsair fan RPMs and probe,
  motherboard readings, and a burst flag (2-second samples for 90 seconds after a 25 watt step).
- The fan profile "CPU Cooler (Silent)" in CoolerControl was replaced with:
  30% at 40 degrees and below, 45% at 50, 60% at 60, 85% at 70, 100% at 75 and above, from Tctl, no smoothing.
  The previous version (which already had the user's own 75-degree to 100% edit) is saved at
  `~/temp/agent/cc-spec/silent-before.json`; restore it with `PUT /profiles`.
- Session-only items that die with the session: the Monitor (30-minute expiry, re-arm each time) and a 4-hour cron
  check at 21:19 EDT on 2026-10-13 (job `90c90261`) that ends the watch if nothing weird happened.
- Other sessions were told about each change by cross-session message.
  `gate-slot.ts` (in `~/temp/agent`, outside the repo) no longer wraps commands in a `systemd-run` scope,
  so gate commands stay under the shared cap.

## Evidence so far

- Before the change, threads 0 to 15 were 15% to 98% busy and threads 16 to 31 were at 1% to 3%, with load near 30.
- One core does AES-XTS at about 4.9 GiB/s in memory (VAES AVX-512 driver), so encryption compute is not the limit.
  While writing 4 GiB to `/var/home`, the encryption workers sat near 0.3% CPU and the machine was 77% idle.
- That write ran at 88.5 MB/s; raw reads of the NVMe partition ran at 187 MB/s (one request in flight)
  and 325 MiB/s (8 parallel readers). Other sessions were doing IO at the time, so these are lower bounds.
- The NVMe is healthy (2% worn, 0 errors, 48 degrees). Its PCIe link runs at 8 GT/s x4 while it reports 16 GT/s as maximum.
  The cause of the low disk speed is not found. The volumes have no `no_read_workqueue` or `no_write_workqueue` flag.
- Hot episodes: 94.8 to 96.1 degrees at 135 W and 4483 MHz (boost off), with CPU pressure near 57.
  A later alert at 91.1 degrees had the fans at 2000 to 2600 RPM. Idle runs about 54 degrees at 60 W.
- Reference points found online (different benches): 78 degrees at 142 W on a 240 mm AIO (forum report),
  86.1 degrees at about 204 W on a water loop, 87 degrees at 200 W for an NH-D15 G2 on a 9950X.
  Neither fixes an expected value for this setup.

## Hardware facts

- CPU cooler: a dual-tower Noctua air cooler. The user says "G2" but heavily suspects it is the G1. Unconfirmed.
- Fans: 7 Noctua and 1 Lian Li, some chained, on a Corsair Commander Core XT (5 of 6 ports used; fan3 is empty).
  CoolerControl labels the controller "(broken)" but applies profiles successfully.
- The Corsair probe is attached to the top of the air cooler, so it reads exhaust air and should rise with load.
- The `fan1` reading in `sensors` belongs to the GPU, not a CPU fan. An early claim based on it was wrong.
- Motherboard: Gigabyte B650 GAMING X AX rev 1.3. The six `gigabyte_wmi` readings are unlabeled and no source maps them.
  Early data: only the third one tracked CPU load.

## Rejected or withdrawn

- A VM or loop-device test of the dm-crypt flags: the user pointed out it would not be bare metal.
- A sustained-load stress test: declined by the user.
- Boost and PBO: documented behavior says they push the chip to 95 degrees sooner for more clock, so they add heat.
- Switching to ZFS or CachyOS: not recommended yet, since nothing shows the filesystem is the limit.
  Another handover, `doc/handover/cachyos-zfs-vm-validation.md`, exists; it was not read here.

## Open questions

- Which cooler variant is installed, and is it mounted correctly (offset, paste, base shape)?
- Is 90 degrees a peak or a settled value at a given wattage? The sample log is collecting the answer.
- What do the six motherboard readings measure, and is there a usable ambient reference?
- Is the first chiplet really cores 0 to 7? Compare chiplet watts with chiplet temperatures.
- Is 40 the right pressure limit? Judge from settled data.
- `ide7`, `ide8`, and `tr-gate` units run outside the cap (their own cgroups).
- The hold paragraph in `doc/handover/cli-git-rust-implementation.md` should point to this work.
  The session `monochromatic-18` was asked to update it.
- A reboot has not been tested against the persistent setup.
- After the token rotation, the new token goes into `~/.config/claude-cpu-cap/cc-token`; until then the fan columns stay empty.

## Next actions

1. Re-arm the Monitor on each expiry; react to alerts with the tone-down rule.
2. When a session has run sustained load, run `node ~/.local/share/claude-cpu-cap/summarize-samples.ts 1`.
   It still needs a chiplet comparison and a (Tctl minus probe) per watt figure.
3. At the 4-hour check, end the watch if nothing is open; keep the service running.
4. Record every user decision and measurement in this file as the session continues.

## Commits so far

- `6bb8cc9a7d`, `25909f463a`, `609b693cf5`, `bc561191bb`, `6c8d57d685`, `59c107b737`: the runbook, in order.
