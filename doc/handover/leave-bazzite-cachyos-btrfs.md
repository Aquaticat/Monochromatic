# Leave Bazzite for CachyOS on Btrfs with the labwc session

## Purpose

Record the 2026-09-14 grilling that reopened the desktop migration after
[the ZFS decision](../decision/cachyos-zfs-desktop.md) was superseded.
The session configuration lives in <https://github.com/Aquaticat/labwc-config>.

## Why the migration is still happening

- The Bazzite desktop stalls;
  the evidence in [the stall investigation](../troubleshooting/bazzite-desktop-input-stalls.md)
  associates the stalls with Btrfs qgroup accounting during Snapper cleanup
  and keeps the DRAM-less SPCC NVMe as a co-suspect.
- The Bazzite desktop now triggers out-of-memory kills without an apparent cause.
  That incident is undiagnosed and separate from the stalls until evidence links them.
  The user chose to skip capturing its journal before the wipe.

## Decisions

- **Filesystem**:
  Btrfs first.
  ZFS only when Btrfs is proven to be the problem.
- **ZFS trigger**:
  install on the same NVMe with Btrfs qgroups disabled
  and run the NVMe latency histogram from the stall investigation's retained diagnostic plan.
  Stalls stop:
  qgroups were the cause and Btrfs stays.
  Stalls continue with normal device latency:
  Btrfs is the cause and the ZFS runbook becomes the plan.
  Stalls continue with slow device completions:
  replace the SSD,
  because ZFS cannot hide that.
- **Distribution**:
  CachyOS.
  openSUSE Tumbleweed only when CachyOS is proven insufficient,
  meaning any of:
  the Secure Boot chain proves unstable;
  unexplained OOM kills persist and trace to a CachyOS default rather than an application;
  stalls persist after the ZFS trigger test clears both Btrfs and the SSD.
  A labwc stack breakage alone does not count.
- **Secure Boot**:
  on for the physical desktop,
  with LUKS unlocked by TPM2 plus PIN.
- **Rollback scope**:
  everything on the main NVMe must be rollback-able.
  Data that does not need that guarantee lives on the 4 TB data SSD,
  which gets no Snapper configuration.
- **Coupled boot**:
  the Limine menu must boot any coupled root plus home pair.
  If CachyOS cannot,
  openSUSE Tumbleweed is considered first.
  The user proposed snapshotting only `/`:
  `@home`,
  `@root`,
  and `@srv` fold into `@`,
  so every Snapper snapshot of `/` is a coupled pair and every limine-snapper-sync entry boots one.
  `@cache`,
  `@log`,
  and `@tmp` stay separate and unsnapshotted,
  so rollback keeps the logs that explain it and snapshots exclude regenerable data;
  the user delegated this split.
  In the existing VM,
  a snapshot boot mounts the read-only snapshot under a throwaway overlayfs,
  and `limine-snapper-restore` makes it permanent
  (`C:\Users\user\Documents\hyperv-cachyos\README.md`, section "Booting a snapshot").
- **Timeline snapshots**:
  hourly,
  bounded retention,
  cleanup at night with boot catch-up,
  qgroups off,
  and every retained snapshot kept bootable in Limine.
- **Secure Boot chain**:
  sbctl custom keys enrolled with Microsoft certificates,
  keeping the RX 7600 option ROM valid.
  The CachyOS Secure Boot guide says to skip `--firmware-builtin` on ASUS and Gigabyte boards.
  This chain cannot be rehearsed in Hyper-V,
  which has no setup mode.
- **Installer**:
  a TypeScript port of the VM's `install.sh`,
  run from the CachyOS live ISO.
- **Rehearsal**:
  a fresh Hyper-V VM built by that installer;
  the current CachyOS VM stays until the new one passes.
- **Package delivery**:
  a signed personal pacman repository built by CI.
- **Memory policy**:
  start from CachyOS defaults as researched on 2026-09-14
  (no systemd-oomd,
  zram sized to RAM,
  `vm.swappiness` raised to 150 once zram is active)
  and measure before changing them.
- **Helper language**:
  TypeScript CLI packages,
  per `SCR`.
  The waybar-era `panel-menu` and `wlr-pager` are not ported.
- **Configuration home**:
  labwc-config,
  retargeted from the Bazzite rehearsal to CachyOS.
- **Rehearsal material**:
  the Bazzite and KVM harness moves to an `archive/` directory in labwc-config.
- **Lint and TSDoc tooling for labwc-config**:
  consumed from npm.
  The user is publishing the needed `@monochromatic-dev` packages;
  as of 2026-09-14 only `@monochromatic-dev/module-logger` 0.4.0 was on npm.
- **Deployment**:
  a PKGBUILD package installs helpers,
  system drop-ins,
  default configuration,
  and dependencies.
- **Node runtime for session helpers**:
  the pacman `nodejs` package.

## Settled without asking

These were already validated or are determined by `AGENTS.md`:

- UWSM plus labwc,
  sfwbar,
  fuzzel,
  foot,
  xwayland-satellite at `DISPLAY=:12`,
  display-manager-free tty1 start,
  the black theme,
  and `uwsm app -t service` launches stay as validated on 2026-08-29.
- labwc-config prose is rewritten to the documentation standards.
- The claim in labwc-config's migration plan that UWSM cgroup isolation fixes the stutter is corrected;
  no host evidence supports it.
- The `MemoryHigh=80%` slice limit from that plan is not carried forward without evidence,
  because it manufactures reclaim pressure.

## Open questions

- Where the TypeScript installer lives.
- Where the signed pacman repository is hosted and who holds the signing key.

## Next action

Continue the grilling on the open questions,
then adapt labwc-config.
