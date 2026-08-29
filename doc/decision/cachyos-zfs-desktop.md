# Adopt encrypted CachyOS ZFS with ZFSBootMenu for the gaming desktop

## Decision status

Adoption is authorized but installation is gated.
The user authorized this choice on 2026-08-29 with:

> I'll go with your personal recommendation.
> Write a /runbook on it.

The consumer-boundary gate in
[`doc/runbook/migrate-bazzite-to-cachyos-zfsbootmenu.md`](../runbook/migrate-bazzite-to-cachyos-zfsbootmenu.md)
must pass in a disposable UEFI VM before the physical NVMe is erased.
The original gate failed because a bootable pre-transaction environment restored root package files while persistent
`/var/lib/pacman` retained the newer package database.
The dataset-boundary diagnosis and validated local patch are in the
[package rollback diagnosis][package-rollback-diagnosis].
A fresh retained VM passed patched installation,
encrypted boot,
pacman-hook,
pre-transaction rollback,
and return-to-default checks.

Corrected baseline and independently created known-good environments then passed menu selection,
boot,
package coherence,
promotion,
and return-to-default checks.
Default,
baseline,
and all retained transaction environments received the final disposable password through supported `passwd`
operations;
known-good inherited it when created.
All 7 retained environments passed a fresh `sudo` authentication check after reboot or direct selection.
The no-desktop default also passed display-manager-free UWSM plus labwc startup,
compositor-exit respawn,
xwayland-satellite,
application-service,
and dark GTK checks.
The overall gate remains closed only pending authenticated-USB recovery or explicit removal of that alternative.

Until that gate passes,
the technology-vetting lifecycle remains at source-validated finalist rather than formally `Validated`,
`Scored`,
`Recommended`,
or `Adopted`.
The authorization selects the intended adoption target without misreporting the incomplete formal lifecycle.

## Adopted target

The intended physical architecture is:

- CachyOS rolling release;
- CachyOS desktop ISO `260809` for the gated installation;
- encrypted single-device OpenZFS root pool `zroot`;
- ZFSBootMenu 3.1.0 or the version supplied by the pinned installation transaction;
- `fnichol/cachyos-zfs-installer` 0.5.1 at
  `9d587de2d34a35ea33094735002d8599afed7eac`;
- installer archive SHA-256
  `f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c`;
- normal `linux-cachyos` with its exact-version `linux-cachyos-zfs` package;
- UWSM 0.26.x plus labwc 0.20.x;
- sfwbar beta17,
  xwayland-satellite 0.8.x,
  and the rehearsed user configuration;
- Secure Boot disabled;
- the 2 TB SPCC NVMe dedicated to CachyOS;
- the separate 4 TB LUKS plus Btrfs Samsung SSD preserved outside `zroot`.

The governing choosing-technology skill is:

- commit `a05818ad70a40e5769a36de669697ba109891b31`;
- SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

The source audit is the
[rolling Linux desktop vet report][audit-report].
Its compatibility fingerprint is
`911c473022b23ef4a3fb839b75f9a348613ecd9cccf70e0dd2e25ff613dc08b0`.

## Hard constraints

The choice must continue to satisfy:

- rolling release;
- encrypted root;
- a rehearsed recovery path through either a directly selectable rollback target or authenticated USB media;
- package files and package-manager state restored as one coherent system state;
- matching root,
  kernel,
  and initramfs or EFI boot artifacts;
- AMD Radeon RX 7600 support;
- UEFI boot;
- UWSM plus labwc compatibility;
- persistent documents,
  media,
  saves,
  and 4 TB data-disk contents across root rollback;
- no dependency on NixOS;
- no requirement for Secure Boot or Windows coexistence.

## Weighting and evidence boundary

The frozen source-only rubric used weight 1 for every criterion.
It produced:

1. openSUSE Tumbleweed BLS:
   31/40;
1. Garuda Btrfs plus GRUB:
   29/40;
1. CachyOS Btrfs plus Limine:
   28.5/40;
1. CachyOS ZFS plus ZFSBootMenu:
   25.5/40;
1. Shanios blue/green:
   18.5/40.

The user adopted the personal recommendation rather than that equal-weight source order.
The deciding preference is the migration’s reason:
unresolved systemwide storage pressure makes a different filesystem,
caching,
writeback,
and I/O-scheduling architecture more valuable than the equal-weight rubric represented.
An illustrative latency criterion at weight 5 put the ZFS candidate first with 45/60,
versus Tumbleweed at 43.5/60.
That sensitivity is not a benchmark or formal score.

No evidence establishes that ZFS prevents the Bazzite stalls.
Single-device ZFS also provides integrity detection but no redundant copy from which to repair arbitrary damaged data.
Independent backup remains part of the architecture.

## Decision ranking

The adoption-context ranking is:

1. **CachyOS ZFS plus ZFSBootMenu**.
   It provides the strongest boot-environment interaction,
   materially different storage-pressure mechanisms,
   and exact-version CachyOS ZFS module packages.
1. **openSUSE Tumbleweed Btrfs plus BLS**.
   It has stronger distribution ownership but returns to Btrfs,
   qgroups,
   and snapshot-cleanup behavior that the migration is deliberately diversifying away from.
1. **Garuda Btrfs plus GRUB**.
   It avoids qgroups and snapshots encrypted `/boot`,
   but its recovery integration has less distribution-level ownership than Tumbleweed’s BLS chain.
1. **CachyOS Btrfs plus Limine**.
   It has current artifact-preserving rollback and qgroups disabled,
   but Garuda’s source-only rollback evidence scored slightly higher and neither provides ZFS’s architectural change.
1. **Shanios blue/green**.
   It directly boots one previous slot,
   but shared writable configuration,
   continuous `beesd`,
   a Nix-backed session path,
   and concentrated maintenance make it the least suitable finalist.

CachyOS ZFS ranks over Tumbleweed because the user accepted uncommon integration ownership in exchange for storage
architecture diversity and ZFS latency-smoothing mechanisms.
Tumbleweed ranks over Garuda because distribution-owned encryption,
BLS generation,
and recovery outweigh Garuda’s qgroups-off advantage when ZFS is unavailable.
Garuda ranks over CachyOS Btrfs because its source-only recovery path scored higher while preserving the qgroups-off
policy.
CachyOS Btrfs ranks over Shanios because it provides deeper selectable history,
native Arch package coverage for the session,
and less shared rollback state.

## Integration boundary

The runbook must apply and verify these boundaries:

- execute only the pinned installer archive,
  never the moving `curl | sudo bash` command from its README;
- physically disconnect the 4 TB Samsung SSD during physical installation;
- make the installer-created `baseline` visible by setting
  `org.zfsbootmenu:active=on`;
- retain the static primary and backup ZFSBootMenu EFI images;
- add an active pacman hook covering `linux-cachyos`,
  `linux-cachyos-zfs`,
  `zfs-meta`,
  `zfs-utils`,
  and `zfsbootmenu`;
- enable monthly `zfs-scrub@zroot` scheduling and ZED;
- audit unreferenced `@be-*` origin snapshots because installer retention deletes clone datasets but not their origin
  snapshots;
- never run `zpool upgrade` without proving boot and rescue compatibility;
- keep `/home`,
  documents,
  media,
  saves,
  logs,
  and the separate data SSD outside root boot environments;
- place only selected UWSM,
  labwc,
  sfwbar,
  launcher,
  and helper configuration under root-backed `/etc/user-rollback/user`;
- preserve pCloud plus Kopia as an independent backup path;
- create a directly selectable `known-good` environment after the migrated session passes.

The operational-ownership evidence is in the
[CachyOS ZFS installer investigation][operational-investigation].

## Migration

The controlling procedure is
[`doc/runbook/migrate-bazzite-to-cachyos-zfsbootmenu.md`](../runbook/migrate-bazzite-to-cachyos-zfsbootmenu.md).
Its order is mandatory:

1. verify local and independent backups;
1. authenticate the pinned ISO and installer;
1. execute encrypted install,
   boot selection,
   rollback,
   promotion,
   and labwc tests in the disposable UEFI VM;
1. write authenticated USB media;
1. disconnect the 4 TB SSD;
1. erase only the identified 2 TB NVMe;
1. verify encryption,
   boot artifacts,
   package pairing,
   pool health,
   and directly selectable environments;
1. reconnect and verify the protected SSD;
1. restore and exercise the rehearsed session;
1. restore applications and backups;
1. create and boot the post-migration `known-good` environment.

A failed disposable test stops physical adoption and returns the choice to Tumbleweed.
A failed physical installer does not authorize repair commands or reconnecting the protected data SSD during diagnosis.

## Exit and rollback

Before the NVMe is erased,
exit consists of deleting the disposable VM and leaving Bazzite unchanged.

After the NVMe is erased:

- boot a prior ZFS environment for a root or package regression;
- use the ZFSBootMenu recovery shell or pinned CachyOS media for boot-image repair;
- use the `known-good` environment for a complete migrated-session fallback;
- re-enable the initial Wayfire display manager from tty2 if labwc startup fails;
- reinstall Bazzite from authenticated official media if abandoning CachyOS;
- restore home and selected system state from the read-only migration copy;
- restore independently protected data through Kopia if the local copy is unavailable.

The separate 4 TB SSD is never added to `zroot` and is not reformatted by this decision.

## Revisit triggers

Reopen this decision when any condition occurs:

- the disposable encrypted-install,
  rollback,
  promotion,
  or labwc gate fails;
- CachyOS no longer publishes an exact matching `linux-cachyos-zfs` package with its normal kernel;
- ZFSBootMenu regeneration fails after a targeted package update;
- the primary and backup EFI images are both unavailable;
- unreferenced origin snapshots accumulate despite the operational audit;
- an OpenZFS feature is required that the current ZFSBootMenu or rescue image cannot import;
- the third-party installer is archived,
  abandoned,
  or incompatible with current CachyOS Calamares;
- the systemwide stalls recur and incident-time evidence identifies ZFS or the physical NVMe path;
- single-device failure tolerance becomes a requirement;
- the protected data SSD’s backup restore drill fails;
- the UWSM plus labwc package path stops working on CachyOS.

[audit-report]: ../audit/tech-rolling-linux-desktop-with-encrypted-boot-m-911c4730-vet-2026-08-29.md
[operational-investigation]: ../troubleshooting/cachyos-zfs-installer-operational-ownership.md
[package-rollback-diagnosis]: ../troubleshooting/cachyos-zfs-boot-environment-pacman-state.md
