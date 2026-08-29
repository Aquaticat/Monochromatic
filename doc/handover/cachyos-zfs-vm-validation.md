# CachyOS encrypted ZFS VM validation handover

## Purpose

This handover preserves the live state of the CachyOS encrypted ZFS validation.
It must be updated after each material VM,
installer,
boot,
rollback,
or design milestone.

The current test is a disposable UEFI consumer installation on a virtual disk.
The user instructed that the VM and its disk must be retained after validation.
Do not clean up the domain,
virtual disk,
attached source images,
or evidence unless the user later authorizes cleanup.

## Current status

- **Installation result**:
  CachyOS Calamares displayed `All done.` and reported a successful installation.
- **Current transition**:
  An ACPI shutdown was requested for the live environment.
  The next action is to confirm that the domain reached `shut off`.
- **Installed path under test**:
  Third-party CachyOS encrypted ZFS installer with ZFSBootMenu.
- **Newly relaxed requirement**:
  A directly selectable boot-menu rollback target is no longer mandatory.
  Recovery from an authenticated USB environment is acceptable.
- **New open design question**:
  Determine whether an official CachyOS encrypted-ZFS installation plus a rehearsed USB recovery procedure can replace
  the third-party ZFSBootMenu integration.
- **Physical disks**:
  No physical host disk is attached to the VM.
- **Cleanup**:
  Forbidden by current user instruction.

## User control constraint

Do not capture host screenshots,
send synthetic input to the host,
or otherwise control the host desktop.

Allowed VM interaction is isolated to the guest through libvirt,
QEMU monitor input,
and the loopback-only VNC display.
Guest framebuffer captures are VM evidence,
not host screenshots.

No Cage,
`xdotool`,
Spectacle,
virt-manager window automation,
or host desktop input has been used.

## Authenticated installation input

- ISO path:
  `/var/home/user/Downloads/cachyos-desktop-linux-260809.iso`
- Measured ISO size:
  `3188850688` bytes
- Verified ISO SHA-256:
  `959f6577f45e25ee9fd8c220fd221b08e4ea79412c7315c0f922dd6d86d5e33c`
- Installer commit:
  `9d587de2d34a35ea33094735002d8599afed7eac`
- Installer archive path:
  `/var/home/user/temp/agent/cachyos-zfs-installer-9d587de2.tar.gz`
- Verified installer archive SHA-256:
  `f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c`

The archive was copied into a read-only FAT source image,
mounted inside the live guest,
and hashed again inside the guest.
The guest-reported hash matched the pinned value.

## VM identity and storage

- Libvirt connection:
  `qemu:///session`
- Domain name:
  `cachyos-zfs-validation`
- Domain UUID:
  `85886808-bc42-4ee1-8b07-b91599cae9f7`
- Firmware:
  UEFI through edk2
- Memory:
  8192 MiB
- Virtual CPUs:
  4
- Primary virtual disk:
  `/mnt/encrypted/VMs/cachyos-zfs-validation/disk.qcow2`
- Virtual disk capacity:
  128 GiB
- Storage behavior:
  Sparse qcow2 in a Btrfs directory carrying the `C` no-copy-on-write attribute
- Disposable credential record:
  `/mnt/encrypted/VMs/cachyos-zfs-validation/disposable-credentials.json`
- Credential-file mode:
  `0600`
- Labwc rehearsal image:
  `/mnt/encrypted/VMs/cachyos-zfs-validation/labwc-configs.img`
- Installer source image:
  `/mnt/encrypted/VMs/cachyos-zfs-validation/installer-source.img`

Never print or copy the credential values into this handover,
logs,
commands,
or user-facing messages.
The guest input helper can read the required JSON property directly.

## Attached guest storage

The installation session used:

- `/dev/vda`:
  primary 128 GiB qcow2 installation target;
- `/dev/vdb`:
  read-only FAT image containing the rehearsed labwc plans and configuration;
- `/dev/vdc`:
  read-only FAT image containing the pinned installer archive;
- `hda`:
  authenticated CachyOS ISO.

Only `/dev/vda` appeared as the Calamares installation target.
The reviewed summary named `/dev/vda` explicitly before installation was confirmed.

## VM display and guest input

The initial SPICE plus virgl display stopped exposing a QEMU screenshot surface after the live desktop started.
The domain was converted to loopback-only VNC,
and virtual GPU acceleration was disabled.
The current display resolves through:

```bash
flatpak run \
  --command=virsh \
  org.virt_manager.virt-manager \
  --connect qemu:///session \
  domdisplay cachyos-zfs-validation
```

The expected installed configuration is `vnc://127.0.0.1:0` while the VM is running.

Guest frames can be captured without touching the host desktop:

```bash
flatpak run \
  --command=gvnccapture \
  org.virt_manager.virt-manager \
  127.0.0.1:0 \
  /var/home/user/temp/agent/cachyos-zfs-validation-vnc.png
```

The VM-only QMP input helper is:

```text
/var/home/user/temp/agent/guest-vm-input.mjs
```

It is hard-coded to `cachyos-zfs-validation` and supports guest-only click,
text,
JSON-property text,
and key-chord operations.
It does not generate host input.

## UEFI evidence

Inside the live guest,
`efibootmgr --verbose` succeeded and listed:

- a UEFI QEMU DVD-ROM boot entry;
- UEFI Misc Device entries;
- an active boot order.

This proves that the installation environment booted through virtual UEFI rather than legacy BIOS.

## Installer selections actually exercised

The installed VM used:

- American English;
- time zone `America/New_York`;
- Generic 105-key PC;
- English US default keyboard layout;
- the installer page's only offered bootloader choice,
  `systemd-boot`;
- erase only `/dev/vda`;
- ZFS root;
- native ZFS encryption enabled;
- matching disposable ZFS passphrases;
- Wayfire as the selected initial desktop;
- default required CachyOS,
  shell,
  base,
  and common package groups;
- username `user`;
- hostname `cachyos-zfs-vm`;
- the disposable user password for both user and administrator access.

The current package page did not expose the kernel-choice page described by the draft runbook.
No real-time kernel was selected manually.
Installed package verification must establish the actual kernel and exact ZFS module pairing after first boot.

## Reviewed destructive summary

Before installation,
Calamares reported:

- erase disk `/dev/vda` only;
- create a new GPT partition table on `/dev/vda`;
- create a `2048 MiB` FAT32 EFI system partition;
- mount the EFI partition at `/boot/efi`;
- create a `129021 MiB` ZFS root partition;
- install CachyOS on the new ZFS system partition.

This differs from the 4 GiB CachyOS Limine layout investigated for the separate Btrfs candidate.
The ZFS validation produced a 2 GiB EFI plan.

## Installation completion evidence

The managed guest-frame watcher reached this terminal text:

```text
All done.
CachyOS has been installed on your computer.
You may now restart into your new system, or continue using the CachyOS Live environment.
```

Watcher process output was retained by the process tool under process name `wait-cachyos-install`
before process cleanup.
The latest guest completion frame is:

```text
/var/home/user/temp/agent/cachyos-zfs-validation-vnc.png
```

## Immediate next actions

1. Confirm the domain is shut off:

   ```bash
   flatpak run \
     --command=virsh \
     org.virt_manager.virt-manager \
     --connect qemu:///session \
     domstate cachyos-zfs-validation
   ```

1. Eject the CachyOS ISO from `hda` in both live and persistent configuration.
   Do not remove the ISO file.

1. Keep `/dev/vdb` and `/dev/vdc` attached because the user prohibited cleanup.

1. Start the domain and confirm that firmware launches the installed boot path.

1. Enter the disposable ZFS passphrase through the VM-only helper.

1. Confirm whether ZFSBootMenu lists only `default` before the hidden baseline is enabled.

1. Boot `default` and authenticate as `user` with the disposable user password.

1. Verify root dataset,
native encryption properties,
dataset layout,
kernel package,
`linux-cachyos-zfs` dependency pairing,
EFI artifacts,
and pool health.

1. Mark installation task 36 complete only after the installed encrypted system reaches a usable session.

1. Start task 38 to evaluate recovery without ZFSBootMenu.

1. Update this handover after each milestone.

## ZFSBootMenu-free recovery question

The relaxed requirement does not make snapshots independently bootable.
A valid USB recovery design must prove all of these operations:

- boot an authenticated environment with a ZFS module compatible with the pool;
- discover and import the pool without mounting datasets at unintended host paths;
- load the native encryption key;
- inspect candidate root snapshots;
- clone a chosen snapshot to a new writable root dataset or perform another explicitly safe restoration;
- preserve persistent home and data datasets;
- make the restored root the intended boot target;
- mount the EFI system partition;
- rebuild matching kernel and initramfs artifacts;
- create or repair a systemd-boot entry that names the restored root dataset;
- export the pool cleanly;
- reboot successfully without relying on the original broken root;
- retain an escape path if the first recovery attempt does not boot.

A root snapshot does not contain the FAT EFI system partition.
Without ZFSBootMenu,
matching boot artifacts become explicit recovery work rather than menu-managed state.

The evaluation must distinguish:

- official CachyOS installer ownership;
- third-party installer ownership;
- routine recovery complexity;
- emergency USB recovery complexity;
- whether native encryption and systemd-boot are supported together by the official installer;
- whether the recovery media ships a compatible OpenZFS module;
- whether a clone-based recovery can be tested without destructive in-place rollback.

Do not claim that the official CachyOS installer supports this architecture until current source
and a consumer installation prove it.
Do not change the active VM architecture mid-installation.
Use the completed ZFSBootMenu installation as evidence while testing any simpler path
in a separate disposable disk or domain.

## Existing project documents

- Migration runbook:
  `doc/runbook/migrate-bazzite-to-cachyos-zfsbootmenu.md`
- Adoption decision:
  `doc/decision/cachyos-zfs-desktop.md`
- Active technology audit:
  `doc/audit/tech-rolling-linux-desktop-with-encrypted-boot-m-911c4730-vet-2026-08-29.md`
- CachyOS ZFS operational ownership investigation:
  `doc/troubleshooting/cachyos-zfs-installer-operational-ownership.md`
- OpenZFS latency investigation:
  `doc/troubleshooting/openzfs-single-device-latency-masking.md`

These documents still describe ZFSBootMenu as part of the selected architecture.
Do not revise the adoption decision until task 38 establishes whether the official or simplified alternative
is real and recoverable.

## Task state

- Task 34,
  verify VM inputs and storage:
  completed.
- Task 35,
  create disposable UEFI VM:
  completed.
- Task 36,
  install encrypted CachyOS ZFS:
  in progress pending first installed boot.
- Task 37,
  validate rollback and desktop:
  pending after task 36.
- Task 38,
  evaluate ZFS recovery without ZFSBootMenu:
  pending after task 36.

## Stop conditions

Stop and diagnose before continuing if:

- the domain is not shut off after the requested ACPI shutdown;
- the ISO cannot be ejected from both live and persistent configuration;
- firmware does not launch the installed EFI path;
- the native ZFS passphrase is rejected;
- ZFSBootMenu cannot discover `zroot/ROOT/default`;
- boot requires a second unexpected pool passphrase;
- the running root is not a ZFS dataset under `zroot/ROOT`;
- package versions do not provide an exact CachyOS kernel and ZFS-module match;
- the pool reports data errors;
- the installed environment differs materially from the reviewed summary;
- any command would touch a physical block device;
- a recovery experiment would destroy the only working VM root;
- host desktop control would be required.
