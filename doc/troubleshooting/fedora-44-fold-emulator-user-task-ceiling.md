# Fedora 44 user process ceilings and a long-running Android Emulator 37.1.11 thread-creation failure

## Symptom

A disposable Pixel 9 Pro Fold AVD ran under a separate 6 GiB memory and
2 CPU Podman cap.
After a long-running design probe,
Android Emulator 37.1.11.0 exited with code `139` and printed:

```text
ERROR | crashhandler_die: fatal: qemu: qemu_thread_create: Resource temporarily unavailable
```

A subsequent command launcher reported `spawn /bin/bash EAGAIN`,
and a boot watcher reported `/etc/profile: fork: Resource temporarily unavailable`.
These were host process-creation failures,
not evidence that floating Gboard or a Compose layout caused the exit.
The user authorized raising the host process limits permanently.
The separate SwiftShader boot crash in
[android-emulator-37-software-renderer-sigsegv.md](android-emulator-37-software-renderer-sigsegv.md)
used a different renderer and failed before boot;
do not conflate its stack with this long-running exit.

## Root cause boundary

Two **local hardening configurations** imposed a ceiling of `8192` on this user.
The systemd user-slice policy at
`/etc/systemd/system/user-.slice.d/20-freeze-hardening.conf:1-6`
contained:

```ini
[Slice]
MemoryHigh=90%
MemoryMax=95%
TasksMax=8192
```

The PAM policy at `/etc/security/limits.d/90-freeze-hardening.conf:1-4`
contained:

```text
* soft nproc 8192
* hard nproc 8192
```

Before the change,
`systemctl --system show user-1000.slice --property=TasksMax,TasksCurrent`
reported `TasksMax=8192`,
`/proc/self/limits` reported soft and hard `Max processes` of `8192`,
and `sudo runuser --user user -- prlimit --nproc` independently reported
`SOFT 8192 HARD 8192` for a fresh PAM session.
`/sys/fs/cgroup/user.slice/user-1000.slice/pids.events` reported
`max 23347` after the exit,
but there is no before-failure count or peak task count.
Neither that accumulated counter nor the later lower task count proves which
limit produced the emulator's `qemu_thread_create` failure.
It remains possible that another resource caused the same error.

The installed `man 5 limits.conf` for PAM `1.7.2-2.fc44` documents that
`pam_limits` applies limits per login and that an individual entry takes
priority over a group/default entry.
The installed systemd version was `259.8-1.fc44`.
This diagnosis concerns locally owned configuration;
no defect in either upstream tool was established.

## Verification and applied configuration

The following owner-specific change superseded the wildcard slice policy
without editing the shared freeze-hardening file:

```sh
sudo --non-interactive systemctl --system set-property user-1000.slice TasksMax=12288
systemctl --system show user-1000.slice --property=TasksMax,TasksCurrent
systemctl --system cat user-1000.slice
```

`systemctl cat` showed the persistent system-generated override at
`/etc/systemd/system.control/user-1000.slice.d/50-TasksMax.conf:1-4`:

```ini
[Slice]
TasksMax=12288
```

The earlier `--runtime` override had lived under `/run/systemd/system.control/`;
it alone would not satisfy the user's permanent-change request.
The persistent file is present and the active slice reports `TasksMax=12288`.
A reboot was **not** performed,
so post-reboot application is not directly measured.

The account-specific PAM file
`/etc/security/limits.d/99-user-nproc.conf:1-4`
was installed root-owned with mode `0644`:

```text
# Override the wildcard freeze-hardening limit for this user only.
# Keep new login sessions aligned with user-1000.slice TasksMax.
user soft nproc 12288
user hard nproc 12288
```

After installation,
`sudo runuser --user user -- prlimit --nproc` reported
`SOFT 12288 HARD 12288`.
This fresh-session check is a positive control:
the same command reported `8192` before the file was installed.
The current Pi process,
its parent shell and Ghostty process,
and the already-running disposable QEMU process received the same soft and
hard limit through `sudo prlimit --pid <measured-pid> --nproc=12288:12288`.
Existing unrelated processes were not changed;
a new login obtains the PAM setting without the per-process adjustment.

`podman inspect` still reported `6442450944` memory bytes and
`2000000000` NanoCPUs for the disposable emulator container,
corresponding to the original 6 GiB/2 CPU cap.
No production app code or original AVD settings were changed.
The disposable AVD subsequently reported `sys.boot_completed=1`,
but neither its long-running stability nor the cause of the first exit
has been established by that boot check.

## Verified workaround and tradeoffs

Keep the account-specific persistent systemd and PAM overrides aligned at
`12288` rather than editing the global wildcard policy.
The higher ceilings allow this user's sessions to create more tasks;
they do **not** replace the disposable emulator's separate memory and CPU cap.
The systemd slice still bounds the entire user to `12288`,
and the local freeze-hardening memory settings remain unchanged.
Future resource pressure is possible before reaching either ceiling.
To restore the former effective ceiling,
set `user-1000.slice` back to `TasksMax=8192` with `systemctl set-property`
and remove only `/etc/security/limits.d/99-user-nproc.conf`;
already-running processes retain their current `prlimit` until changed or restarted.
Do not use `systemctl revert user-1000.slice` as a shortcut:
that slice also has unrelated CPU and memory control drop-ins.

## What does not work

- Raising only the running Pi/QEMU limits:
  a new PAM session still tested at `8192` before the account-specific file.
- Applying only `systemctl --runtime set-property`:
  the resulting override was under `/run/`,
  not persistent storage.
- Treating the emulator's exit code `139` as proof of the earlier SwiftShader
  boot bug:
  this run printed the distinct `qemu_thread_create` diagnostic after boot.
- Stressing the host to recreate `EAGAIN`:
  not attempted because intentional task exhaustion would endanger the desktop.

## Upstream filing decision

No upstream issue is filed or drafted.
The `.out-of-scope/` entries contain no exemption specific to this local
systemd/PAM setting,
but no upstream defect is identified:

1. Upstream fault is unproven;
   both measured ceilings came from local freeze-hardening configuration.
2. Upstream could change its own behavior,
   but there is no verified upstream defect to target here.
3. The emulator supports this AVD use,
   yet support does not identify the cause of the late thread-creation exit.
4. Contribution policy for a specific defective upstream path was not assessed
   because no such path has been established.
5. Expected maintainer action is unknown;
   no issue search would turn this local configuration change into an upstream bug.
6. No upstream patch was proposed or verified;
   the tested fix is local configuration only.

Nothing is ready to send upstream.
