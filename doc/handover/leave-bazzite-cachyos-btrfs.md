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
  everything must be rollback-able.
  The earlier "root snapshots only" framing was rejected by the user.
  Scope details are still open.
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

- Rollback scope:
  which subvolumes and disks are snapshotted,
  and whether root and home roll back together.
- Secure Boot mechanism on the physical desktop:
  sbctl custom keys versus shim plus MOK as rehearsed in the Hyper-V VM.
- Where the PKGBUILD is built and whether its packages are signed and served from a repository.
- What happens to the retained CachyOS Hyper-V VM on the ThinkPad as the rehearsal platform.

## Next action

Continue the grilling on the open questions,
then adapt labwc-config.
