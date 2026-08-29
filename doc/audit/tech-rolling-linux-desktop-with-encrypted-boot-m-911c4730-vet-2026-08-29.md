# Rolling Linux desktop with encrypted boot-menu rollback vet report

- **Status**:
  In progress
- **Lifecycle phase**:
  Discovery recorded;
  targeted hard-gate validation in progress
- **Subject**:
  Rolling Linux desktop with encrypted boot-menu rollback
- **Scope**:
  Choose a rolling Linux installation architecture for this user’s x86-64 UWSM plus labwc gaming desktop,
  using the dedicated 2 TB NVMe,
  encrypted root,
  and rollback targets selectable directly from the firmware-launched boot menu.
- **Started**:
  2026-08-29
- **Last updated**:
  2026-08-29
- **Governing skill commit**:
  `a05818ad70a40e5769a36de669697ba109891b31`
- **Governing skill SHA-256**:
  `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- **Compatibility fingerprint**:
  `911c473022b23ef4a3fb839b75f9a348613ecd9cccf70e0dd2e25ff613dc08b0`
- **Active audit owner**:
  Pi session `01a04220-8e59-7772-ad8a-2c5eb2dedb7b`
- **Prior compatible report**:
  None found.
  `doc/audit/tech-rolling-linux-desktop-with-encrypted-boot-m-vet-2026-08-29.md` has the incompatible
  fingerprint `636923994432fe5afbe3a13086afb7ffdc004479de4fb2c68842ea6022eff9ce` because it requires Windows
  coexistence and evaluates a KDE Plasma deployment rather than the rehearsed UWSM plus labwc session.

## Context

The incumbent is Bazzite 44 on a LUKS-backed Btrfs root.
The user is leaving after cross-application stalls coincided with extreme Btrfs transaction and storage pressure.
The initiating mechanism remains unresolved,
and a distribution change that keeps the same NVMe cannot by itself exclude device-level tail latency.
The evidence and limits are recorded in
[`doc/troubleshooting/bazzite-desktop-input-stalls.md`](../troubleshooting/bazzite-desktop-input-stalls.md).

Measured deployment:

- AMD Ryzen 7 8700F with 16 logical CPUs;
- 64 GB RAM;
- AMD Radeon RX 7600 using the upstream `amdgpu` driver;
- x86-64 UEFI firmware with TPM 2.0;
- a 2 TB NVMe now dedicated to Linux;
- a separate 4 TB LUKS plus Btrfs SATA SSD whose contents must be preserved;
- Secure Boot may be disabled;
- UWSM plus labwc,
  with sfwbar,
  xwayland-satellite,
  Flatpak,
  a display-manager-free tty1 autologin,
  and per-application systemd units.

The session design and successful VM rehearsal are documented in
`/var/home/user/labwc-vm-test/HANDOVER.md` and `/var/home/user/labwc-vm-test/YOUR-SETUP.md`.
Those documents are local evidence rather than independent upstream sources.
Package availability and behavior still require candidate-specific confirmation.

The user delegated rollback scope and installation effort.
This audit therefore prefers rollback of the operating system plus deliberately selected application configuration,
while documents,
media,
game saves,
and the separate data disk remain current.
At least one prior working system must be directly selectable at boot.
Deeper history is scored rather than treated as a hard gate.

## Classification

Every candidate component is an inspectable open-source local technology.
Applicable overlays are:

- incumbent dependency replacement;
- native kernel,
  bootloader,
  installer,
  and prebuilt-package boundaries;
- sensitive data and encryption;
- high-trust boot and recovery execution.

Managed-service and SaaS gates are not applicable because no hosted control plane is being selected.
Browser-baseline gates are not applicable because the selected system is a native operating-system stack.
Windows coexistence is not applicable because the NVMe is now dedicated to Linux.

## Hard constraints

- Rolling release.
- At least one usable rollback target selectable directly from the boot menu without first repairing the installed system.
- A rollback target must pair the root state with bootable matching kernel and initramfs or UKI artifacts.
- Root data encrypted at rest.
- AMD Radeon RX 7600 support through an actively maintained kernel and Mesa stack.
- x86-64 UEFI installation.
- Personal files and the separate encrypted data SSD must remain outside rollback promotion.
- The UWSM plus labwc session must have an inspectable,
  maintainable installation path.
- Inspectable source and source-to-package or source-to-image provenance.

Secure Boot is not a hard constraint.
ZFS and ZFSBootMenu are optional mechanisms rather than requirements.
An unencrypted FAT boot partition does not fail root encryption,
but it reduces boot-artifact confidentiality and integrity when Secure Boot is disabled and is scored accordingly.

## Frozen criteria

No relative priority among the remaining soft concerns was specified,
so every criterion has weight 1.
Ratings use the governing skill’s 0 through 4 scale.

- Rollback correctness,
  boot-menu integration,
  and selectable history depth,
  weight 1.
- Encryption architecture,
  boot-chain integrity,
  and recovery,
  weight 1.
- Rolling-update and kernel/filesystem robustness,
  weight 1.
- UWSM plus labwc stack portability,
  weight 1.
- Gaming stack currency and AMD support,
  weight 1.
- Storage-pressure exposure and background-maintenance control,
  weight 1.
- Installer and distribution integration,
  weight 1.
- Operational maintenance burden,
  weight 1.
- Inspectability,
  packaging provenance,
  and recovery documentation,
  weight 1.
- Migration,
  application-configuration rollback,
  and exit cost,
  weight 1.

Maximum score is 40.
Hard-gate failures remain outside arithmetic.
Criteria and weights are frozen before candidate-specific ratings.

## Unresolved preferences

None at this stage.
If sensitivity analysis makes the ordering depend on an unexpressed preference,
the report will return conditional rankings rather than inventing a tiebreaker.

## Discovery

### Frozen query schedule

#### Distribution and ecosystem indexes

- DistroWatch search:
  `rolling release KDE snapshot rollback`.
- ZFSBootMenu official documentation:
  supported distribution guides and boot-environment requirements.
- OpenZFS official documentation:
  supported Linux kernels and native-encryption constraints.
- Official distribution package searches for `zfs`,
  `snapper`,
  `grub-btrfs`,
  `limine`,
  `labwc`,
  `uwsm`,
  `sfwbar`,
  and `xwayland-satellite`.

#### Repository hosts

GitHub repository searches were sorted by updated date and collected in complete 100-result pages until exhaustion or
until two consecutive pages added no screening survivor:

- `linux distribution boot snapshot rollback`;
- `zfsbootmenu installer rolling linux`;
- `grub-btrfs distribution installer`;
- `limine snapper boot snapshot`;
- `nixos boot generations encryption`.

Raw GitHub responses are preserved under `/var/home/user/temp/agent/rolling-linux-discovery`.
The broad GitHub queries returned substantial unrelated and generated-repository noise;
they are useful for discovery saturation,
not candidate quality.

#### Broader web

- `rolling Linux distribution encrypted root boot snapshots KDE`;
- `CachyOS ZFSBootMenu official`;
- `CachyOS Btrfs snapshot boot official`;
- `openSUSE Tumbleweed encrypted root boot snapshot official`;
- `NixOS unstable encrypted root boot generations official`;
- `Garuda Linux encrypted root boot snapshots official`;
- `Void Linux ZFSBootMenu encrypted root official`;
- `Arch Linux ZFSBootMenu encrypted root rolling kernel compatibility`;
- `rolling Linux snapshot boot menu Windows dual boot`.

#### Incumbent and local alternatives

- Current Bazzite deployment and bootable rollback behavior;
- existing Btrfs,
  Snapper,
  LUKS,
  bootloader,
  and data-disk boundaries;
- the rehearsed UWSM plus labwc session;
- repository troubleshooting evidence for the incumbent stalls.

### Expansion round

New taxonomy terms produced one de-duplicated expansion round:

- `rolling Linux blue green boot rollback`;
- `immutable rolling Linux A B boot menu rollback`;
- `Arch immutable dual root rollback`;
- `rolling Linux Limine Snapper boot history`;
- `rolling Linux root on ZFS installer ZFSBootMenu`;
- `transactional rolling desktop boot snapshot rollback`.

The expansion schedule is frozen.
Later taxonomy terms are recorded without recursively adding queries.
No negative filters were used.

### Discovery result

Discovery is saturated with multiple screening survivors.
The hard-gate-confirmed architectures are:

- CachyOS with encrypted Btrfs plus Limine;
- openSUSE Tumbleweed with encrypted Btrfs plus Snapper and its current BLS boot stack;
- Garuda with encrypted Btrfs plus Snapper and GRUB;
- Shanios with encrypted Btrfs blue/green deployments;
- CachyOS with encrypted ZFS plus ZFSBootMenu through the third-party `cachyos-zfs-installer`.

Siduction,
openSUSE Kalpa,
KDE Linux,
AerynOS,
ObsidianOS,
and Nebula exit during targeted screening for the candidate-specific reasons recorded in the ledger.

## Candidate ledger

### CachyOS with encrypted Btrfs plus Limine

- **Discovery sources**:
  CachyOS official documentation,
  current installer source,
  package sources,
  and `limine-snapper-sync` upstream source.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Hard-gate confirmed;
  finalist validation pending.
- **Why it survives**:
  The installer creates a LUKS2 root behind an unencrypted FAT32 `/boot`;
  Limine presents Snapper snapshots directly;
  current helper source preserves and restores content-addressed matching kernel artifacts.

### openSUSE Tumbleweed with encrypted Btrfs plus Snapper and BLS

- **Discovery sources**:
  openSUSE installer,
  full-disk-encryption,
  Snapper,
  BLS,
  `sdbootutil`,
  and package documentation.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Hard-gate confirmed;
  finalist validation pending.
- **Why it survives**:
  Current YaST installs support LUKS2 FDE with systemd-boot or GRUB2-BLS;
  `sdbootutil` creates a direct boot entry for every retained bootable snapshot and associates it with matching,
  content-addressed kernel and initramfs artifacts on FAT32 boot storage.

### Garuda with encrypted Btrfs plus Snapper and GRUB

- **Discovery sources**:
  Garuda release announcement,
  installer generator,
  package sources,
  and snapshot-support sources.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Hard-gate confirmed;
  finalist validation pending.
- **Why it survives**:
  Garuda Temeraire uses LUKS2 plus Argon2 with GRUB 2.14,
  retains `/boot` inside the Btrfs root snapshot,
  generates GRUB snapshot entries,
  and installs a dracut overlay for read-only snapshot boots.

### Shanios blue/green Arch deployments

- **Discovery sources**:
  official project site,
  installer source,
  deployment source,
  image builder,
  and package sources.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Hard-gate confirmed for encryption and rollback;
  finalist validation and session portability pending.
- **Why it survives**:
  Its installer creates a LUKS root with Argon2id,
  two read-only Btrfs roots,
  and one UKI plus direct systemd-boot entry per slot.
  One prior slot remains selectable;
  deeper history exists only as non-boot-menu backup snapshots.

### CachyOS with encrypted ZFS root plus ZFSBootMenu

- **Discovery sources**:
  ZFSBootMenu and OpenZFS official documentation,
  CachyOS package sources,
  and `fnichol/cachyos-zfs-installer` 0.5.1.
- **Base category**:
  Inspectable open-source local technology assembled from distribution and upstream components.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Hard-gate confirmed at the source-architecture level;
  third-party installer runtime validation pending.
- **Why it survives**:
  ZFSBootMenu unlocks natively encrypted datasets,
  discovers matching kernel and initramfs pairs inside each boot environment,
  and directly clones,
  promotes,
  or rolls back snapshots from its boot UI.
  CachyOS ships version-locked ZFS modules for its kernels,
  but the installation and pacman integration are maintained by one third-party author rather than CachyOS.

### siduction with encrypted Btrfs plus Snapper and GRUB

- **Discovery sources**:
  siduction installation and Btrfs manuals plus `siduction-btrfs` source.
- **Screening result**:
  Hard-gate failure.
- **Reason**:
  siduction directly boots Snapper snapshots and deliberately leaves qgroups disabled,
  but its encrypted-install procedure requires an unencrypted separate `/boot`.
  Its own Btrfs manual warns that a separate `/boot` is excluded from root snapshots and can make rollback inconsistent.
  That fails the matching-kernel-artifact requirement.
- **Primary sources**:
  https://manual.siduction.org/hd-install_en.html
  and https://manual.siduction.org/sys-admin-btrfs-snapper_en.html,
  accessed 2026-08-29.

### openSUSE Kalpa

- **Discovery sources**:
  official Kalpa site and openSUSE community documentation.
- **Screening result**:
  Category-fit hard-gate failure for this deployment.
- **Reason**:
  Kalpa remains Alpha,
  says custom partitioning produces a broken unsupported system,
  and reserves host RPM mutation for strictly required host functionality.
  Replacing its supported Plasma session with the complete UWSM plus labwc host stack would create an unsupported
  custom base rather than a ready-to-use candidate.
- **Primary sources**:
  https://kalpadesktop.org/documentation/
  and https://en.opensuse.org/Portal:Kalpa,
  accessed 2026-08-29.

### NixOS unstable

- **Discovery sources**:
  official NixOS generation and encryption documentation.
- **Screening result**:
  Excluded by explicit user constraint concerning project community and governance.
  Technical capabilities are not scored.

### AerynOS

- **Discovery sources**:
  official installation,
  filesystem,
  rollback,
  and lacking-features documentation.
- **Screening result**:
  Encryption hard-gate failure.
- **Reason**:
  AerynOS offers boot-time state rollback,
  but its official missing-features page states that disk encryption is not yet supported.
- **Primary source**:
  https://aerynos.dev/faq/lacking-features/,
  accessed 2026-08-29.

### ObsidianOS

- **Discovery sources**:
  official GitHub organization,
  installer source,
  and `obsidianctl` source.
- **Screening result**:
  Encryption hard-gate failure.
- **Reason**:
  `modules/install.py:264-297` creates two FAT ESPs and five plain ext4 or F2FS partitions with `mkfs`;
  the installer has no LUKS or other root-encryption operation.
- **Clone**:
  `/var/home/user/temp/agent/obsidianos-obsidianctl-20260829` at
  `d5e62067a610e94bc4f2ff9eef9f7e2e45bf6e8a`.
- **Primary source**:
  https://github.com/Obsidian-OS/obsidianctl,
  accessed 2026-08-29.

### Nebula Linux

- **Discovery sources**:
  official site and source repository.
- **Screening result**:
  Kernel-artifact hard-gate failure.
- **Reason**:
  `profile/airootfs/etc/calamares/modules/partition.conf:16-28` deliberately places `/boot` on a separate ext4
  partition outside the snapshotted root.
  A root rollback can therefore pair old `/usr/lib/modules` with a current kernel and initramfs.
  The project also labels the release Beta while its site still warns that it is Alpha.
- **Clone**:
  `/var/home/user/temp/agent/nebula-linux-20260829` at
  `68eca22c54d30a96beb625b1bab0beac17ee6b45`.
- **Primary source**:
  https://github.com/nebula-linux-os/Nebula-Linux,
  accessed 2026-08-29.

### KDE Linux

- **Discovery sources**:
  official installation,
  rollback,
  and recovery documentation plus source repository.
- **Screening result**:
  Category-fit hard-gate failure for this deployment.
- **Reason**:
  KDE Linux has direct boot selection of prior OS generations and an encrypted-install path,
  but the only current edition is explicitly Testing and the supported host image is Plasma-specific.
  Supplying UWSM,
  labwc,
  sfwbar,
  and xwayland-satellite would require a custom system extension or image;
  ready-to-use surviving distributions make that custom implementation ineligible.
- **Primary sources**:
  https://linux.kde.org/docs/install/
  and https://linux.kde.org/docs/boot-failure-recovery/,
  accessed 2026-08-29.

## Evidence records

### CachyOS boot-history behavior

- **Candidate revision**:
  `limine-snapper-sync` 1.31.0 source at commit
  `26caede1286b4f6bc85321f9ffba9fbabed21711`.
- **Claim and relevance**:
  `SnapshotManager.historyAddSnapshot()` archives kernel,
  initramfs,
  and UKI files under content-addressed names.
  `SnapshotManager.restoreKernels()` checks the target artifacts,
  removes non-target boot files,
  and copies the archived target set back.
  A kernel update therefore does not inherently make a snapshot unusable.
- **Gate**:
  Rollback correctness and kernel-artifact hard gate.
- **Status**:
  Pass in inspected helper source;
  end-to-end installer validation remains pending.
- **Source paths**:
  `src/main/java/org/limine/snapper/processes/SnapshotManager.java:211-254`
  and `:648-697`.
- **Primary source**:
  https://gitlab.com/Zesko/limine-snapper-sync,
  accessed 2026-08-29.
- **Counterevidence**:
  CachyOS documentation still states that snapshots involving kernel updates cannot be rolled back at
  https://wiki.cachyos.org/configuration/btrfs_snapshots/.
  That statement conflicts with current helper source and the helper author’s explanation.
- **Remaining limits**:
  Snapshots predating the helper,
  missing or pruned history,
  corrupt artifacts,
  and inadequate FAT boot-partition capacity can still prevent restoration.

### CachyOS automatic Limine partition sizing

- **Candidate revision**:
  CachyOS Calamares commit `f1c20a500e14448e36991f1b9d3ebae153827761`.
- **Claim and relevance**:
  Current automatic whole-disk partitioning creates a 4,096 MiB FAT32 partition mounted at `/boot` when Limine is
  selected.
- **Gate**:
  Installer integration and restore capacity.
- **Status**:
  Pass in current source;
  ISO UI validation remains pending.
- **Source paths and excerpts**:
  `src/modules/partition/partition.conf:75-80` sets `efiSystemPartition: "/boot"` and
  `efiSystemPartitionSize: 4096M`;
  `src/libcalamares/partition/PartitionSize.cpp:30` maps `M` to `MiB`;
  `src/modules/partition/core/PartitionActions.cpp:175-198` creates a FAT32 ESP using that configured size.
- **Primary source**:
  https://github.com/CachyOS/cachyos-calamares,
  accessed 2026-08-29.
- **Documentation discrepancy**:
  The 26.01 changelog says 4,192 MB at
  https://wiki.cachyos.org/cachyos_basic/changelogs/gui_installer/.
  Current source is decisive for the present proposal and does not contain that number.
- **Historical counterevidence**:
  ISO 260124 could alternate between 2 GB and 4 GB after navigating backward at
  https://discuss.cachyos.org/t/inconsistent-calamares-behavior-when-selecting-limine-260124/22236.
  The current source has one Limine override,
  but the current UI path still needs runtime validation.

### CachyOS snapshot-pressure defaults

- **Candidate revision**:
  `CachyOS/CachyOS-PKGBUILDS` commit
  `74d4d55e0ddda0daa8823908c4d1ceccaa2ab158`.
- **Claim and relevance**:
  The shipped root Snapper template sets `QGROUP=""` and `TIMELINE_CREATE="no"`.
  Package operations still create pre/post snapshots,
  and number cleanup remains enabled.
- **Gate**:
  Storage-pressure exposure and background-maintenance control.
- **Status**:
  Pass for avoiding the incumbent qgroup configuration;
  ordinary Btrfs transaction pressure remains possible.
- **Source path**:
  `cachyos-snapper-support/snapper-template-root-cachyos`.
- **Primary source**:
  https://github.com/CachyOS/CachyOS-PKGBUILDS/blob/master/cachyos-snapper-support/snapper-template-root-cachyos,
  accessed 2026-08-29.

### openSUSE BLS snapshot-to-kernel association

- **Candidate revision**:
  `openSUSE/sdbootutil` commit `786f9a84027ac6aa351eb303206c34123bb23059`.
- **Claim and relevance**:
  The Snapper plugin runs `sdbootutil add-all-kernels` for each Tumbleweed snapshot.
  The tool reads kernels from the selected snapshot,
  generates or reuses its initramfs,
  stores content-addressed artifacts on FAT32 boot storage,
  and writes a BLS entry with that snapshot’s `rootflags`.
- **Gate**:
  Direct rollback and matching-kernel-artifact hard gates.
- **Status**:
  Pass in current source;
  end-to-end installer validation remains pending.
- **Source paths**:
  `10-sdbootutil.snapper:107-126`,
  `sdbootutil:1734-1957`,
  and `ARCHITECTURE.md` under “Introducing snapshots”.
- **Primary sources**:
  https://github.com/openSUSE/sdbootutil
  and https://news.opensuse.org/2025/11/13/tw-grub2-bls,
  accessed 2026-08-29.
- **Capacity behavior**:
  `sdbootutil:1437-1602` protects active and default snapshots,
  then prunes other boot entries from oldest to newest until a new kernel fits.
  A retained Snapper snapshot can therefore lose its boot entry before Snapper deletes the snapshot.
  The July 2026 XBOOTLDR guidance at https://news.opensuse.org/2026/07/07/xbootldr/ provides a larger separate FAT32
  boot store when the default 1 GB ESP is insufficient.

### openSUSE encryption and Snapper defaults

- **Claim and relevance**:
  Current BLS installs support LUKS2 with password,
  TPM2,
  or FIDO2 unlock.
  The root Snapper configuration shown by openSUSE uses `QGROUP=1/0`,
  while timeline creation is disabled on ordinary roots larger than 16 GiB;
  package-manager pre/post snapshots and cleanup remain enabled.
- **Gate**:
  Encryption and storage-pressure scoring.
- **Status**:
  Pass for encryption;
  scored concern for reintroducing qgroup accounting on the same NVMe.
- **Primary sources**:
  https://news.opensuse.org/2025/11/13/tw-grub2-bls
  and https://doc.opensuse.org/documentation/tumbleweed/snapper/,
  accessed 2026-08-29.
- **Evidence limit**:
  Upstream Snapper’s `data/default-config` leaves `QGROUP` empty;
  the `1/0` value is openSUSE’s installed policy rather than an invariant of Snapper itself.

### Garuda encrypted snapshot boot path

- **Candidate revisions**:
  `garuda-linux/pkgbuilds` commit `18ebb7a6fe801e1b2163e2ba6e1581799ec9e644`,
  `garuda-linux/tools/iso-profiles` commit `760f824c1c8b1971112eeb6268762190eaa8e07c`,
  and `garuda-linux/tools/garuda-tools` commit `5c45ad31dda34e409d44e2959af4501dd01a54d1`.
- **Claim and relevance**:
  The ISO uses GRUB;
  `/boot/efi` is separate but `/boot` remains in the snapshotted root;
  `snapper-support` generates GRUB entries and uses no qgroup;
  `garuda-dracut-support` overlays a writable tmpfs over a read-only snapshot boot.
- **Gate**:
  Encryption,
  direct rollback,
  matching-kernel-artifact,
  and storage-pressure gates.
- **Status**:
  Pass in source;
  end-to-end encrypted install validation remains pending.
- **Source paths**:
  `garuda-tools/lib/util-yaml.sh:278-326`,
  `iso-profiles/shared/Packages-Root`,
  `pkgbuilds/snapper-support/snapper-template-garuda`,
  and `pkgbuilds/garuda-dracut-support/snapshot-overlay.sh:1-22`.
- **Primary source**:
  https://forum.garudalinux.org/t/garuda-linux-temeraire-260819/48606,
  accessed 2026-08-29.
- **Version boundary**:
  Temeraire introduced LUKS2 plus Argon2 and ships GRUB 2.14,
  whose release added Argon2 KDF support.
  Reports about earlier LUKS1 installs do not describe the current ISO.

### Shanios blue/green behavior

- **Candidate revisions**:
  `shani8dev/os-installer-config` commit `a76296a84183e0efdd6a2dedb3cded1d72da6693`
  and `shani8dev/shani-deploy` commit `5ea6945fd1bfd7387290ca808371d89a9612582b`.
- **Claim and relevance**:
  The installer encrypts the root with LUKS plus Argon2id,
  creates `@blue` and `@green`,
  builds one signed UKI per slot,
  and writes direct systemd-boot entries.
  Deployment writes the new image only to the inactive slot and uses a boot counter for automatic fallback.
- **Gate**:
  Encryption and direct rollback hard gates.
- **Status**:
  Pass in source;
  end-to-end installer validation remains pending.
- **Source paths**:
  `scripts/install.sh:289-304`,
  `scripts/configure.sh` functions `generate_uki_entry()` and `generate_loader_conf()`,
  and `shani-deploy/README.md` under “The blue-green model”.
- **Primary sources**:
  https://github.com/shani8dev/os-installer-config
  and https://github.com/shani8dev/shani-deploy,
  accessed 2026-08-29.
- **Material limits**:
  only one previous slot is directly bootable;
  `/etc` and selected `/var` state are shared overlays and do not roll back with a slot;
  continuous `beesd` deduplication is enabled;
  all deployment and installer commits measured through the GitHub API come from one maintainer.

### ZFSBootMenu and CachyOS ZFS assembly

- **Candidate revisions**:
  ZFSBootMenu commit `e15503228f40b3c95ded551fab86e91f3e3d230f`,
  `cachyos-zfs-installer` 0.5.1 at `9d587de2d34a35ea33094735002d8599afed7eac`,
  and CachyOS package source `74d4d55e0ddda0daa8823908c4d1ceccaa2ab158`.
- **Claim and relevance**:
  ZFSBootMenu prompts for a native-encryption passphrase,
  finds kernel and initramfs pairs inside each boot environment,
  and exposes snapshot clone,
  clone-and-promote,
  and rollback actions in its boot UI.
  The third-party installer separates persistent home and application data from `zroot/ROOT/*`,
  creates a baseline environment,
  and keeps 24 pacman-created environments by default.
- **Gate**:
  Encryption,
  direct rollback,
  matching-kernel-artifact,
  and personal-data separation hard gates.
- **Status**:
  Pass in architecture and source;
  complete installer execution remains pending.
- **Primary sources**:
  https://docs.zfsbootmenu.org/en/latest/general/native-encryption.html,
  https://docs.zfsbootmenu.org/en/latest/general/bootenvs-and-you.html,
  https://docs.zfsbootmenu.org/en/latest/online/snapshot-management.html,
  and https://github.com/fnichol/cachyos-zfs-installer,
  accessed 2026-08-29.
- **Kernel pairing**:
  CachyOS packages a `linux-cachyos-zfs` module with an exact dependency such as `linux-cachyos=7.1.8-1` and
  `Provides: ZFS-MODULE` at https://packages.cachyos.org/package/cachyos/x86_64/linux-cachyos-zfs.
  This avoids an unbounded DKMS/kernel mismatch for supported CachyOS kernels,
  but OpenZFS remains an out-of-tree module and real-time kernels remain unsupported.
- **Maintenance limit**:
  the installer is 97.1 percent single-author by GitHub contribution count and is not an official CachyOS component.

### High-trust integration surface

The measured non-test integration surfaces,
using Tokei on the cited clones,
are:

- CachyOS Limine helper:
  5,333 code lines across 43 files;
- openSUSE `sdbootutil` core plus hooks:
  4,109 code lines in one main script plus hook files;
- Garuda installer and snapshot integration subset:
  658 code lines across 9 files;
- Shanios deployment and installer scripts:
  13,806 code lines across 11 files;
- third-party CachyOS ZFS installer excluding vendored code:
  941 code lines across 12 files.

These counts measure audit surface,
not quality.
They omit upstream bootloaders,
filesystems,
and general distribution installers shared by the candidates.

## Execution manifests

No third-party candidate code has been executed for the successor audit.
Read-only official documentation,
package-index queries,
and repository inspection do not cross the external-execution gate.
Any installer dry run,
VM installation,
or source test requires a separately recorded bounded execution manifest.

## Hard-gate outcomes

- CachyOS Btrfs plus Limine:
  pass;
  finalist.
- openSUSE Tumbleweed Btrfs plus Snapper and BLS:
  pass;
  finalist.
- Garuda Btrfs plus Snapper and GRUB:
  pass;
  finalist.
- Shanios blue/green:
  pass for rolling,
  encryption,
  and direct prior-slot boot;
  finalist subject to session validation.
- CachyOS ZFS plus ZFSBootMenu:
  pass at source level;
  finalist subject to third-party installer validation.
- siduction:
  fail because encrypted installs separate `/boot` from root snapshots.
- openSUSE Kalpa:
  fail deployment fit because the required host-session replacement is outside its supported customization model.
- AerynOS:
  fail because disk encryption is not supported.
- ObsidianOS:
  fail because the installer creates unencrypted roots.
- Nebula Linux:
  fail because the separate `/boot` can mismatch root snapshots.
- KDE Linux:
  fail deployment fit because a non-Plasma host session requires a custom image extension while only the Testing
  edition is available.
- NixOS:
  excluded by explicit user constraint.

## Validation

Pending equal-depth finalist validation.
No installer has been run and no disk has been repartitioned.

## Scoring and sensitivity

Pending finalist validation.
No preliminary soft score controls candidate promotion.

## Ranking and recommendation

No recommendation is available before hard-gate confirmation,
equal-depth finalist validation,
scoring,
and sensitivity analysis.
