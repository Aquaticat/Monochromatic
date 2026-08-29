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
  The first installed disk reached Ly 1.4.1 after a successful native-encryption unlock.
  It contains Wayfire because the original runbook prescribed Wayfire as a temporary graphical base.
  The user correctly identified **No Desktop** as closer to the intended UWSM plus labwc system.
  The Wayfire disk is retained as installation and encrypted-boot evidence,
  but it is no longer the target desktop-validation base.
  Task 39 created a separate no-desktop validation domain and disk without deleting the Wayfire control.
  The authenticated live environment reached CachyOS Hello.
  The first watcher remained active because its case-sensitive `CachyOS` matcher missed OCR output `CachyOs`.
  A direct guest-frame capture proved the live environment was ready.
  The first installer-launch click used an incorrect coordinate and left CachyOS Hello open.
  A current guest frame located **Launch installer** at guest coordinate `642,605`,
  and the corrected VM-only click was sent.
  That action opened stock CachyOS Calamares rather than applying the pinned ZFS installer profile first.
  Stock Calamares was canceled at its bootloader page before partitioning or confirmation.
  Its session did not mutate the virtual disk.
  The read-only installer-source image was then mounted inside the guest,
  and the archive hash again matched the pinned value.
  The pinned third-party installer was launched from the verified extracted archive.
  It again reduced the bootloader page to `systemd-boot` and the partition plan to ZFS.
  `/dev/vda` was the only installation target,
  with the same 2 GiB EFI plus 126 GiB ZFS plan.
  Native ZFS encryption was enabled with matching disposable passphrases.
  **No Desktop** is selected.
  Calamares explicitly states that this choice starts in text-only mode and permits installing a desktop later.
  Only the default CachyOS,
  shell,
  base-development,
  and common package groups remained selected.
  User `user` and hostname `cachyos-zfs-nodesktop-vm` were configured with the disposable password.
  The destructive summary again named only `/dev/vda`,
  with a new GPT,
  2048 MiB FAT32 EFI partition,
  and 129021 MiB ZFS root partition.
  **Install Now** was confirmed after reviewing that boundary.
  The no-desktop installation reached terminal success:
  `All done.` and `CachyOS has been installed on your computer.`
  **Restart now** remained disabled.
  The installer was closed.
  The first attempted `systemctl poweroff` went into System Settings search rather than Konsole and had no effect.
  Refocusing the retained Konsole window exposed the installer cleanup transcript,
  including `Failed to export pool "cannot export 'zroot': pool is busy"` despite terminal Calamares success.
  No pool repair or clear command was used.
  The corrected guest `systemctl poweroff` reached `shut off` immediately.
  Flatpak-packaged `virsh change-media --eject --config` then exited with code 139 and no diagnostic message,
  but after-state domain XML proved the ISO source had been removed from persistent `hda` configuration.
  A fresh instrumented no-desktop control reached CachyOS Hello from the authenticated ISO.
  Stock Calamares was never launched,
  and `pgrep --exact calamares` confirmed that no Calamares process existed before the pinned setup began.
  Guest block-device inspection confirmed only virtual `vda`,
  read-only `vdb` and `vdc` source images,
  and writable `vdd` evidence storage.
  The installer archive again matched the pinned SHA-256 inside the guest.
  The evidence image was mounted with live-user ownership through FAT mount options after a direct `chown` correctly failed.
  The pinned installer is running with `DEBUG=1` and teeing its terminal output to the evidence image.
  Before destructive confirmation,
  a second terminal proved that effective `/usr/share/calamares/settings.conf` contained all custom execution entries:
  script copy,
  ZFSBootMenu,
  encryption,
  mkinitcpio,
  baseline,
  pacman-ZFS,
  and user-home setup.
  The effective sequence and complete settings file were copied to the evidence image and synced.
  Calamares then selected **No Desktop** with only the required default package groups.
  The summary again named only `/dev/vda`,
  a 2048 MiB EFI partition,
  and a 129021 MiB encrypted ZFS root partition.
  **Install Now** was confirmed.
  The clean no-desktop control reached terminal Calamares success.
  Its retained log proves:

  - ZFSBootMenu image generation succeeded;
  - the EFI boot entry was created;
  - native-encryption configuration completed;
  - `zroot/ROOT/baseline` was created;
  - the ESP contains `EFI/ZFSBootMenu/vmlinuz-linux-cachyos.EFI`,
    measured at 42,821,120 bytes.

  The installer cleanup again reported `cannot export 'zroot': pool is busy`,
  so that warning is not sufficient to explain the failed run's empty ESP.
  The debug output,
  effective sequence,
  settings,
  full Calamares log,
  selected key events,
  archive hash,
  and ESP listing were synced to the writable evidence image.
  The guest entered `systemctl poweroff` after unmounting the evidence image and reached `shut off`.
  The evidence files were copied to
  `/var/home/user/temp/agent/cachyos-zfs-nodesktop-clean-evidence`,
  with SHA-256 recorded for every file.
  Persistent domain XML proves the authenticated ISO source was ejected.
  The clean no-desktop domain restarted from its installed EFI disk.
  ZFSBootMenu counted down for `zroot/ROOT/default`,
  requested the native-encryption passphrase,
  accepted the disposable credential,
  and booted to tty1.
  Login as `user` reached a fish shell with no preinstalled graphical session.
  The running root is `zroot/ROOT/default` on ZFS,
  and the pool reports healthy.
  Kernel `6.18.42-1-cachyos-lts` is paired exactly with `linux-cachyos-lts-zfs 6.18.42-1`.
  Normal kernel `7.2.2-1` and `linux-cachyos-zfs 7.2.2-1` are also installed.
  The root uses native `aes-256-gcm` encryption with passphrase format,
  encryption root `zroot`,
  and key location `file:///etc/zfs/keys/zroot.key`.
  The keyfile is root-owned,
  mode `000`,
  and 40 bytes.
  Firmware boot order starts with the ZFSBootMenu entry targeting the measured EFI image.
  The failed no-desktop domain previously restarted from its installed EFI disk,
  but the encrypted-boot watcher timed out after 635 seconds without seeing ZFSBootMenu or text login.
  A direct positive-control capture found the guest in the EDK II UEFI shell.
  UEFI mapped the 2048 MiB first partition as `FS0:`,
  but `dir` reported zero files and zero directories at its root.
  The installed ESP is empty,
  so no ZFSBootMenu image can be launched.
  This is a stop-condition failure rather than a usable no-desktop installation.
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

## No-desktop VM identity and storage

- Libvirt connection:
  `qemu:///session`
- Domain name:
  `cachyos-zfs-nodesktop-validation`
- Domain UUID:
  `2bb347c3-34ec-4d61-af26-1f691923693e`
- Firmware:
  UEFI through edk2
- Memory:
  8192 MiB
- Virtual CPUs:
  4
- Primary virtual disk:
  `/mnt/encrypted/VMs/cachyos-zfs-nodesktop-validation/disk.qcow2`
- Virtual disk capacity:
  128 GiB
- Storage behavior:
  Sparse qcow2 with the `C` no-copy-on-write attribute
- Disposable credential record:
  `/mnt/encrypted/VMs/cachyos-zfs-nodesktop-validation/disposable-credentials.json`
- Guest display:
  loopback-only VNC
- Guest framebuffer evidence:
  `/var/home/user/temp/agent/cachyos-zfs-nodesktop-vnc.png`

This domain reuses the read-only labwc and installer-source images from the retained Wayfire control.
The authenticated ISO is attached only as virtual CD-ROM installation media.
No physical host block device is attached.

Use the VM-only input helper with this environment variable:

```bash
VM_DOMAIN=cachyos-zfs-nodesktop-validation \
  node /var/home/user/temp/agent/guest-vm-input.mjs
```

## Clean no-desktop control identity and storage

- Domain name:
  `cachyos-zfs-nodesktop-clean-validation`
- Domain UUID:
  `f9a2f58d-7740-4037-b2c1-86d4effea718`
- Primary virtual disk:
  `/mnt/encrypted/VMs/cachyos-zfs-nodesktop-clean-validation/disk.qcow2`
- Virtual disk capacity:
  128 GiB sparse qcow2
- Disposable credential record:
  `/mnt/encrypted/VMs/cachyos-zfs-nodesktop-clean-validation/disposable-credentials.json`
- Writable 256 MiB evidence image:
  `/mnt/encrypted/VMs/cachyos-zfs-nodesktop-clean-validation/installer-evidence.img`
- Guest framebuffer evidence:
  `/var/home/user/temp/agent/cachyos-zfs-nodesktop-clean-vnc.png`

This control uses UEFI,
8192 MiB memory,
four virtual CPUs,
loopback-only VNC,
and no virtual GPU acceleration.
It reuses the authenticated ISO and read-only source images.
No physical block device is attached.

The evidence image must retain:

- pinned-installer debug output;
- the effective Calamares settings and custom execution sequence;
- the complete Calamares installation log.

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

## No-desktop boot failure under investigation

The no-desktop installer reported terminal success despite producing an empty ESP.
The retained Konsole transcript also showed Calamares fail to export `zroot` during cleanup because the pool was busy.
No destructive repair was attempted.

The initial hypothesis that **No Desktop** omitted every installed kernel package was wrong.
An authenticated-ISO inspection imported the same pool read-only after confirming no concurrent VM used it.
The first import correctly refused the stale host-id evidence left by the failed installer export.
A forced but still read-only import then reported `pool 'zroot' is healthy`,
and the disposable native-encryption passphrase loaded the key successfully.

The installed root contains:

- `linux-cachyos 7.2.2-1`;
- `linux-cachyos-zfs 7.2.2-1`;
- `linux-cachyos-lts 6.18.42-1`;
- `linux-cachyos-lts-zfs 6.18.42-1`;
- both kernel images and both initramfs images under root-backed `/boot`.

The exact kernel-module pairs are therefore present.
The same inspection found:

- no installed `zfsbootmenu` package;
- no installed `zfs-meta` package;
- no `zroot/ROOT/baseline` dataset;
- no pacman-ZFS hook artifacts;
- no ZFSBootMenu image or any other file on the ESP.

The package log records the base ZFS and exact kernel-module installation,
but no ZFSBootMenu package transaction.
This proves that the custom post-install pipeline did not execute or persist,
not that image generation lacked a kernel.
The reason the custom jobs were skipped remains unresolved.
Launching and canceling stock Calamares before the pinned installer is a contamination unique to this run,
so a fresh no-desktop control must avoid that sequence.

After inspection,
ordinary ZFS unmounts completed but export still reported the pool busy.
`fuser` named live-system systemd namespace-resource processes as holders.
No forced export,
clear,
or repair was used;
the live guest was shut down to release the disposable pool.

## Desktop-selection correction

The Calamares desktop page visibly offered **No Desktop**.
The runbook nevertheless prescribed Wayfire as a known graphical fallback,
and that instruction was followed without reconsidering whether the fallback matched the target architecture.
That was an error.

Wayfire adds an unrelated compositor,
its packages,
and a preconfigured graphical login path before the intended UWSM plus labwc stack is tested.
This weakens the consumer-boundary test because successful graphics could depend on the fallback environment.
**No Desktop** is the correct installation choice for this migration.
It forces the validation to prove that the intended session packages,
services,
portal selection,
login flow,
and configuration are sufficient by themselves.

The first disk remains useful for:

- authenticated installer execution;
- the `/dev/vda`-only erase boundary;
- native ZFS encryption;
- ZFSBootMenu launch and passphrase prompt;
- first installed boot to Ly.

It is not accepted as the final UWSM plus labwc validation environment.
A second retained disk and domain must repeat installation with **No Desktop**.
The migration runbook was corrected before that repeat installation began.

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

## Shutdown transition evidence

The host-side ACPI request did not stop the live environment within 2 minutes.
This did not prove that CachyOS cannot shut down.
Guest evidence showed that the first terminal command was mistyped because input began before Konsole had focus:

```text
ls poweroff
ls: cannot access 'poweroff': No such file or directory
```

The command was not a `systemctl` failure.
The corrected `systemctl poweroff` was entered only after the terminal was visibly focused.
Process `wait-cachyos-poweroff-retry` observed `shut off` immediately and exited successfully.

## Installed boot transition

After the successful installer result:

- the live system reached `shut off` through guest `systemctl poweroff`;
- the authenticated ISO was ejected from persistent `hda` configuration;
- XML inspection found no remaining ISO source path;
- `/dev/vdb` and `/dev/vdc` remained attached as instructed;
- the domain started successfully;
- its VM-only display returned at `vnc://127.0.0.1:0`.

ZFSBootMenu reached an 8-second automatic-boot countdown for `zroot/ROOT/default` without prior input.
This countdown alone does not establish that encryption was bypassed:
ZFSBootMenu can discover an encrypted environment before requesting its key during boot selection.
The next watcher distinguished the states successfully.
After the countdown,
ZFSBootMenu displayed `Enter passphrase for 'zroot':`.
No second input had been sent before that prompt appeared.
The disposable ZFS passphrase was accepted for the continuing boot attempt.
Boot then reached Ly 1.4.1 with the intended hostname,
Wayfire session,
and `user` login.

## Immediate next actions

1. Under task 37,
verify the installed automatic boot-environment hooks and regeneration behavior.

1. Enable and boot the hidden baseline only after preserving a fallback.

1. Create and boot a known-good environment independently of the installer baseline.

1. Exercise clone or promotion rollback on disposable state.

1. Install and validate the intended UWSM plus labwc session from the text-only base.

1. Under task 38,
evaluate authenticated-USB recovery without ZFSBootMenu in a separate disposable architecture.

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
  completed after ZFSBootMenu unlock and installed boot reached Ly 1.4.1.
- Task 37,
  validate rollback and desktop:
  in progress on the clean no-desktop control.
- Task 38,
  evaluate ZFS recovery without ZFSBootMenu:
  pending.
- Task 39,
  install no-desktop CachyOS validation:
  completed after encrypted boot reached the authenticated tty1 user shell.

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
