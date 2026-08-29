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
The surviving architectures are CachyOS with Btrfs plus Limine,
openSUSE Tumbleweed with Btrfs plus Snapper and GRUB,
Garuda with Btrfs plus Snapper and GRUB,
Shanios blue/green deployments,
and a manually assembled rolling distribution with ZFSBootMenu.
Siduction and openSUSE Kalpa remain in targeted screening until their direct-boot and session-packaging paths are
resolved.

## Candidate ledger

### CachyOS with encrypted Btrfs plus Limine

- **Discovery sources**:
  CachyOS official documentation,
  installer repository,
  package repositories,
  and `limine-snapper-sync` upstream source.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Serious alternative;
  targeted hard-gate confirmation in progress.
- **Key open checks**:
  current automatic partition proposal,
  LUKS boundary,
  boot-history retention,
  restore ordering,
  and user-session package parity.

### openSUSE Tumbleweed with encrypted Btrfs plus Snapper and GRUB

- **Discovery sources**:
  openSUSE installation,
  Snapper,
  rollback,
  and package documentation.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Serious alternative;
  targeted hard-gate confirmation in progress.
- **Key open checks**:
  encrypted default layout,
  GRUB snapshot menu under encryption,
  kernel placement,
  qgroup defaults,
  promotion workflow,
  and sfwbar packaging.

### Garuda with encrypted Btrfs plus Snapper and GRUB

- **Discovery sources**:
  Garuda installation documentation,
  package repositories,
  and installer/configuration repositories.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Serious alternative pending source confirmation.
- **Key open checks**:
  current default bootloader,
  encrypted automatic layout,
  kernel placement,
  read-write overlay during snapshot boot,
  and recovery promotion.

### Shanios blue/green Arch deployments

- **Discovery sources**:
  official project site and public source organization.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Serious alternative pending source confirmation.
- **Key open checks**:
  installer LUKS behavior,
  boot-menu slot selection,
  only-previous-slot history depth,
  update cadence,
  image provenance,
  package customization,
  and exit path.

### Rolling Linux with encrypted ZFS root plus ZFSBootMenu

- **Discovery sources**:
  ZFSBootMenu and OpenZFS official documentation,
  distribution package indexes,
  and third-party rolling-distribution installers.
- **Base category**:
  Inspectable open-source local technology assembled from distribution and upstream components.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Serious alternative;
  no distribution-integrated rolling installer has yet been confirmed.
- **Key open checks**:
  native-encryption unlock,
  kernel-module pairing,
  source-to-package provenance,
  boot-environment promotion,
  and maintenance ownership.

### siduction with a manually added snapshot boot pipeline

- **Discovery sources**:
  siduction and Debian package documentation.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Pending targeted evidence;
  no distribution-integrated snapshot-to-boot pipeline has been confirmed.
- **Potential exit**:
  Fails the direct-boot hard gate if the required path is only an unvalidated local assembly.

### openSUSE Kalpa

- **Discovery sources**:
  openSUSE immutable-desktop documentation and existing repository evaluation notes.
- **Base category**:
  Inspectable open-source local technology.
- **Overlays**:
  Replacement,
  native/prebuilt,
  sensitive-data,
  and high-trust boot overlays.
- **Screening result**:
  Pending targeted evidence.
- **Potential exit**:
  Fails if encrypted installation,
  direct boot selection,
  or maintainable native labwc package customization is unsupported.

### NixOS unstable

- **Discovery sources**:
  official NixOS generation and encryption documentation.
- **Screening result**:
  Excluded by explicit user constraint concerning project community and governance.
  Technical capabilities are not scored.

### KDE Linux,
AerynOS,
ObsidianOS,
and Nebula

- **Discovery sources**:
  official project pages and repository search.
- **Screening result**:
  Not promoted during initial screening because at least one of installer maturity,
  encrypted root,
  rolling cadence,
  direct boot rollback,
  or public recovery evidence remained unconfirmed.
  Candidate-specific exit evidence will be recorded before the ledger is finalized.

## Evidence records

### CachyOS boot-history behavior

- **Candidate revision**:
  `limine-snapper-sync` 1.31.0 source at commit
  `26caede1286b4f6bc85321f9ffba9fbabed21711`.
- **Claim and relevance**:
  Current helper source archives kernel,
  initramfs,
  and UKI artifacts associated with a snapshot and restores matching artifacts during rollback.
  A kernel update therefore does not inherently make a snapshot unusable.
- **Gate**:
  Rollback correctness and kernel-artifact hard gate.
- **Status**:
  Pass in inspected helper source;
  end-to-end installer validation remains pending.
- **Primary source**:
  https://gitlab.com/Zesko/limine-snapper-sync,
  accessed 2026-08-29.
- **Clone**:
  `/var/home/user/temp/agent/limine-snapper-sync-20260829` at the pinned commit.
- **Counterevidence**:
  CachyOS documentation still states that snapshots involving kernel updates cannot be rolled back at
  https://wiki.cachyos.org/configuration/btrfs_snapshots/.
  That statement conflicts with current helper source and the helper author’s explanation.
- **Remaining limits**:
  Snapshots predating the helper,
  missing or pruned history,
  corrupt artifacts,
  and inadequate FAT boot-partition capacity can still prevent restoration.

### CachyOS boot-partition sizing

- **Candidate revision**:
  CachyOS GUI installer changelog 26.01 at wiki commit
  `d6f3fd48a5265588fb8fb19b049b955316b1e914`.
- **Claim and relevance**:
  The official changelog says the Limine boot partition was increased to 4,192 MB,
  and the manual guide requires at least 4,096 MiB FAT32 mounted at `/boot`.
- **Gate**:
  Installer integration and restore capacity.
- **Status**:
  Documentation evidence only;
  current automatic behavior is not yet source- or ISO-validated.
- **Primary sources**:
  https://wiki.cachyos.org/cachyos_basic/changelogs/gui_installer/
  and https://wiki.cachyos.org/installation/installation_on_root/,
  accessed 2026-08-29.
- **Counterevidence**:
  A January 2026 user report shows installer navigation alternating between 2 GB and 4 GB proposals at
  https://discuss.cachyos.org/t/inconsistent-calamares-behavior-when-selecting-limine-260124/22236.
  This is direct evidence about ISO 260124,
  not proof of current behavior.
- **Outcome**:
  Do not rely on the automatic proposal until the current ISO or its exact profile source is validated.
  Manual partitioning can reserve more capacity,
  but its separation from the reported UI state bug also requires confirmation.

### CachyOS session package availability

- **Candidate revision**:
  Current Arch and CachyOS package indexes as accessed 2026-08-29.
- **Claim and relevance**:
  `labwc`,
  `uwsm`,
  and `xwayland-satellite` are directly packaged;
  sfwbar is available through the Arch User Repository rather than the official Arch repositories.
- **Gate**:
  Maintainable UWSM plus labwc installation path.
- **Status**:
  Pass with a third-party-source packaging caveat for sfwbar.
- **Primary sources**:
  https://archlinux.org/packages/,
  https://packages.cachyos.org/,
  and https://aur.archlinux.org/,
  accessed 2026-08-29.
- **Outcome**:
  Native package coverage is strong,
  while sfwbar requires AUR provenance and maintenance validation.

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
  pending complete confirmation;
  current source resolves the kernel-update objection.
- openSUSE Tumbleweed:
  pending complete confirmation.
- Garuda:
  pending complete confirmation.
- Shanios:
  pending complete confirmation.
- ZFSBootMenu assembly:
  pending complete confirmation.
- siduction:
  pending direct-boot evidence.
- openSUSE Kalpa:
  pending direct-boot and customization evidence.
- NixOS:
  excluded by user constraint.
- Other discovered early-stage systems:
  pending documented exits.

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
