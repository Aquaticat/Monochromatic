# Migrate the Bazzite desktop to encrypted CachyOS ZFS with ZFSBootMenu

## What this proves

This runbook moves the measured desktop from Bazzite 44 to CachyOS on the dedicated 2 TB NVMe while preserving the
separate 4 TB encrypted SATA SSD.
It requires a disposable UEFI installation rehearsal before the physical NVMe is erased.
It then verifies:

- native ZFS encryption on `zroot`;
- a firmware-launched ZFSBootMenu image;
- directly selectable and package-coherent `default`,
  `baseline`,
  known-good,
  and pre-transaction boot environments;
- matching CachyOS kernel and ZFS module packages;
- rollback selection and promotion in the disposable VM;
- a persistent home and data boundary outside root boot-environment rollback;
- UWSM plus labwc,
  sfwbar,
  xwayland-satellite,
  Flatpak,
  and display-manager-free tty1 startup;
- independent backup evidence before erasing the NVMe.

The migration does not prove that ZFS prevents the stalls observed on Bazzite.
It changes the filesystem and rollback architecture without claiming that Btrfs,
qgroups,
or the NVMe caused those incidents.
Single-device ZFS also does not tolerate NVMe failure.
The backup requirement remains mandatory.

## Current validation blocker

Do not execute the physical-installation sections yet.
The disposable consumer test found that the installer mounts all of `/var/lib` from persistent
`zroot/data/var/lib`,
while pacman hooks snapshot only the root boot environment.
Booting a pre-transaction environment restored root package files but left `/var/lib/pacman` at the newer state.
`pacman -Qkk tree` then reported the rolled-back package files missing.

A real-ZFS prototype corrected the boundary by keeping `zroot/data/var` and `zroot/data/var/lib` as
namespace-only parents while preserving selected child datasets.
That patch has not yet passed a complete installer,
boot,
and package-rollback rehearsal.
The physical gate remains closed until all of these checks pass:

- the patched source remains traceable to the pinned upstream archive and has its own recorded patch hash;
- the effective Calamares sequence contains every custom ZFS job;
- the patched dataset layout leaves `/var/lib/pacman` inside each root environment;
- a pacman transaction creates a bootable pre-transaction environment;
- package files and pacman database state agree in both the old and current environments;
- the known-good and baseline environments pass the same coherence check;
- native-encryption unlock,
  ZFSBootMenu regeneration,
  and the intended UWSM plus labwc session still pass;
- the authenticated-USB alternative is either fully rehearsed or removed from the accepted recovery paths.
See the [package rollback diagnosis][package-rollback-diagnosis].

## Why this is a manual runbook

CLI bridges were checked before writing this handoff:

- the host reports UEFI firmware;
- the target and protected drives have stable `/dev/disk/by-id` names;
- Fedora Media Writer 5.3.2 is installed and exposes a custom-image workflow;
- the Flatpak virt-manager installation provides QEMU 11.0.1,
  `virt-install`,
  and a session libvirt connection;
- the pinned third-party installer has no unattended disk-selection interface and launches graphical Calamares.

The remaining boundaries require physical drive isolation,
firmware interaction,
a destructive disk choice,
and encryption-passphrase entry across reboots.
Automating those boundaries from the current session would remove the human confirmation that protects the 4 TB SSD.

## Fixed identities and source pins

This runbook is for the measured machine:

- motherboard:
  Gigabyte B650 GAMING X AX,
  firmware F40;
- target NVMe:
  `SPCC M.2 PCIe SSD`,
  serial `A240827N4M204800049`,
  2,048,408,248,320 bytes;
- target stable path:
  `/dev/disk/by-id/nvme-SPCC_M.2_PCIe_SSD_A240827N4M204800049`;
- protected SATA SSD:
  `Samsung SSD 860 EVO 4TB`,
  serial `S596NE0N102120M`,
  4,000,787,030,016 bytes;
- protected stable path:
  `/dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M`;
- protected LUKS UUID:
  `d6709fe2-43cf-4b4f-b690-ac37bb470615`;
- protected Btrfs UUID:
  `01c308e7-06fa-4737-8a7b-3bb5fcba871d`;
- required installed username:
  `user`.

Pinned installation inputs:

- CachyOS desktop ISO `260809`;
- ISO SHA-256:
  `959f6577f45e25ee9fd8c220fd221b08e4ea79412c7315c0f922dd6d86d5e33c`;
- CachyOS signing-key fingerprint:
  `882D CFE4 8E20 51D4 8E25 62AB F3B6 0748 8DB3 5A47`;
- `fnichol/cachyos-zfs-installer` commit
  `9d587de2d34a35ea33094735002d8599afed7eac`,
  version 0.5.1;
- installer archive SHA-256:
  `f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c`;
- sfwbar AUR commit
  `46996951521a2b1d721382fa6db7164f25cbcd98`;
- sfwbar beta17 source-archive SHA-256:
  `a4915bc7dd0873c45d0d6b01b070e39a91fd16cfadf730d6a9e48db68a8cd09e`.

If CachyOS has replaced ISO `260809` when this runbook is executed,
do not silently substitute a newer ISO.
Either use the pinned official image while it remains available or repeat the source and VM validation for the newer
image before physical installation.

## Stop conditions

Stop without erasing the NVMe if any condition is true:

- the local and pCloud backup checks have not passed;
- the ISO checksum or signature differs;
- the installer archive checksum differs;
- the disposable VM cannot boot the encrypted pool through ZFSBootMenu;
- the VM cannot boot and promote a pre-transaction environment;
- bare-metal Calamares lists the 4 TB Samsung SSD;
- Calamares proposes erasing a disk other than the identified SPCC NVMe;
- the installation summary does not show ZFS plus encryption;
- first boot does not request the ZFS passphrase in ZFSBootMenu;
- `zroot` reports `encryption=off`;
- `linux-cachyos-zfs` does not exactly depend on the installed `linux-cachyos` version;
- the ZFSBootMenu EFI image is absent;
- pool health is not `ONLINE` or reports data errors.

Do not use `zpool upgrade`,
`zpool clear`,
`zfs rollback`,
`btrfs check --repair`,
or destructive disk-repair commands to push past a stop condition.

## Bounded execution manifest

### Third-party installer

- Candidate:
  `fnichol/cachyos-zfs-installer` 0.5.1 at the pinned commit and checksum.
- Top-level command:
  `sudo -E ./bin/install` from an extracted pinned archive on the CachyOS live ISO.
- Inspected command tree:
  `bin/install`,
  `src/calamares/`,
  `src/pacman-zfs/`,
  and vendored `libsh`.
- Expected subprocesses:
  `pacman`,
  `pacman-key`,
  `cachyos-rate-mirrors`,
  `timedatectl`,
  `calamares`,
  `dbus-launch`,
  `cp`,
  `install`,
  `sed`,
  `find`,
  `inxi`,
  `zpool`,
  `zfs`,
  `zgenhostid`,
  `mkinitcpio`,
  `generate-zbm`,
  `efibootmgr`,
  `lsblk`,
  `findmnt`,
  `useradd`,
  `userdel`,
  `tar`,
  `shred`,
  and ordinary shell text utilities.
- Expected network endpoints:
  configured CachyOS and Arch package mirrors plus their signing-key infrastructure.
- Expected writes:
  live-environment keyrings and Calamares configuration;
  the selected installation disk;
  target `/etc`,
  `/usr/local`,
  `/boot`,
  and EFI variables.
- Credentials:
  no ambient repository,
  SSH,
  browser,
  cloud,
  or agent credentials are passed.
  The encryption and user passwords are entered only into Calamares or ZFSBootMenu.
- Disposable-VM bounds:
  8 GiB RAM,
  4 vCPUs,
  128 GiB qcow2 disk,
  NAT network,
  no host write mount,
  and no physical block device.
- Bare-metal deviation:
  the selected target is the dedicated 2 TB NVMe;
  the protected SATA SSD is physically disconnected.
- Wall-clock stop:
  cancel only before partitioning starts if the installer makes no progress for 15 minutes.
  After partitioning starts,
  preserve `/home/liveuser/calamares.install.log` and reboot the live ISO before another attempt.
- Success:
  Calamares completes,
  ZFSBootMenu launches,
  one passphrase unlocks `zroot`,
  and the checks in this runbook pass.
- Failure:
  any undeclared executable,
  network destination,
  disk,
  or write boundary appears;
  any stop condition occurs;
  or Calamares exits nonzero.

### sfwbar AUR build

- Candidate:
  sfwbar 1.0 beta17 at the pinned AUR recipe commit.
- Top-level command:
  `makepkg --syncdeps --install --needed` as the unprivileged `user` account.
- Inspected commands:
  source download,
  SHA-256 verification,
  `meson`,
  `ninja`,
  and `DESTDIR` installation packaging.
- Expected network endpoints:
  AUR Git over HTTPS,
  GitHub’s `LBCrion/sfwbar` tagged archive,
  and configured package mirrors.
- Expected writes:
  user-owned build directory,
  pacman package cache,
  and package-managed files under `/usr`.
- Success:
  `pacman -Q sfwbar` prints version `1.0_beta17-1` and `sfwbar --version` exits zero.
- Failure:
  the AUR commit,
  source checksum,
  dependency list,
  or build commands differ from the reviewed recipe.

## Setup

Status:
TODO | DONE

Prepare:

- an 8 GB or larger USB drive whose contents may be erased;
- reliable wired networking if available;
- AC power;
- physical access to the desktop and its SATA data cable or motherboard SATA-port setting;
- the ZFS encryption passphrase without recording it in this document or shell history;
- the existing 4 TB data-disk passphrase;
- enough uninterrupted time to finish one disposable installation and one physical installation;
- the current Bazzite session with `/var/mnt/encrypted` and `/var/mnt/pcloud` mounted.

The 4 TB SSD is the local migration backup destination,
not its own independent backup.
The pCloud-backed Kopia repository supplies the independent copy for its configured sources.
Do not continue until a fresh Kopia snapshot and restore drill pass.

The source home filesystem currently reports 792,123,547,648 bytes used,
and the protected SSD reports 2,440,068,792,320 bytes available.
The metadata-preserving local copy can therefore write hundreds of gigabytes and adds ordinary SSD wear.
That write is intentional backup work;
do not run it repeatedly after a verified copy exists.

## Steps

Status:
TODO | DONE

### Preserve the current system

1. Close Steam,
   browsers,
   communication clients,
   IDEs,
   virtual machines,
   containers,
   and file-synchronization writes that can change home during the local copy.
   Expect the desktop to remain available with only the terminal and required mount clients running.

1. Confirm the protected data filesystem is mounted at `/var/mnt/encrypted`:

   ```bash
   findmnt --target /var/mnt/encrypted --output SOURCE,TARGET,FSTYPE,OPTIONS
   ```

   Expect `TARGET` to be `/var/mnt/encrypted`,
   `FSTYPE` to be `btrfs`,
   and `SOURCE` to be `/dev/mapper/crypt_sda`.

1. Confirm the independent Kopia repository is connected:

   ```bash
   /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
     repository status --json \
     | jq -r '.storage.type, .storage.config.path'
   ```

   Expect exactly:

   ```text
   filesystem
   /mnt/pcloud/rclone
   ```

1. Confirm that the migration backup path does not already exist:

   ```bash
   test ! -e /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs \
     && echo 'migration backup path: unused'
   ```

   Expect `migration backup path: unused`.
   Stop if the command prints nothing.

1. Create the migration directory:

   ```bash
   sudo install \
     --directory \
     --mode=0700 \
     --owner=user \
     --group=user \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs
   ```

   Expect the command to exit without an error.

1. Create a Btrfs subvolume for the home backup:

   ```bash
   sudo btrfs subvolume create \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final
   ```

   Expect output containing:
   `Create subvolume` and `home-final`.

1. Copy the complete current home into the migration subvolume:

   ```bash
   sudo rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     --numeric-ids \
     --one-file-system \
     --info=progress2 \
     /var/home/user/ \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/
   ```

   Expect rsync to exit zero.
   Do not treat the progress percentage alone as success.

1. Run a converging second home copy:

   ```bash
   sudo rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     --numeric-ids \
     --one-file-system \
     --delete \
     --info=progress2 \
     /var/home/user/ \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/
   ```

   Expect rsync to exit zero.

1. Verify home file content with an rsync checksum dry run:

   ```bash
   sudo rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     --numeric-ids \
     --one-file-system \
     --delete \
     --checksum \
     --dry-run \
     --itemize-changes \
     /var/home/user/ \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/
   ```

   Expect no itemized file output and exit status zero.
   If active software changes files during this check,
   close that software,
   repeat the converging copy,
   and repeat this check.

1. Make the verified home backup read-only:

    ```bash
    sudo btrfs property set \
      -t subvol \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final \
      ro \
      true
    ```

    Expect no error.

1. Create the system-manifest directory:

    ```bash
    install \
      --directory \
      --mode=0700 \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system
    ```

    Expect the directory to exist.

1. Record the current deployment:

    ```bash
    rpm-ostree status --json \
      > /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/rpm-ostree-status.json
    ```

    Expect the file to contain the booted version `44.20260825` or the version actually running at migration time.

1. Record system Flatpak applications:

    ```bash
    flatpak list \
      --app \
      --columns=application,origin,installation \
      > /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/flatpak-apps.tsv
    ```

    Expect the file to contain `org.virt_manager.virt-manager` and the applications still intended for migration.

1. Record storage identities and mounts:

    ```bash
    lsblk \
      --bytes \
      --output NAME,PATH,SIZE,TYPE,FSTYPE,LABEL,UUID,MODEL,SERIAL,TRAN,MOUNTPOINTS \
      > /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/lsblk.txt
    ```

    Expect `lsblk.txt` to contain both `A240827N4M204800049` and `S596NE0N102120M`.

1. Copy `/etc`:

    ```bash
    sudo rsync \
      --archive \
      --hard-links \
      --acls \
      --xattrs \
      --numeric-ids \
      --one-file-system \
      /etc/ \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/etc/
    ```

    Expect rsync to exit zero.

1. Copy `/usr/local` so the existing pCloud console client and its library remain recoverable:

    ```bash
    sudo rsync \
      --archive \
      --hard-links \
      --acls \
      --xattrs \
      --numeric-ids \
      --one-file-system \
      /usr/local/ \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/usr-local/
    ```

    Expect rsync to exit zero.

1. Record the existing pCloud executable checksums:

    ```bash
    sha256sum \
      /usr/local/bin/pcloudcc \
      /usr/local/lib/libpcloudcc_lib.so \
      > /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/pcloud-binaries.sha256
    ```

    Expect checksums
    `7cb76325f9efdd9dc77896f23a12d455fccec2a9af87451998048afb9806f253`
    and `48a08e70253fde0e4e2a8c6adcfaa98fdf9d76423ee4260f3a3bd53b92e89b45`.

1. Copy system libvirt state:

    ```bash
    sudo rsync \
      --archive \
      --hard-links \
      --acls \
      --xattrs \
      --numeric-ids \
      --one-file-system \
      /var/lib/libvirt/ \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/var-lib-libvirt/
    ```

    Expect rsync to exit zero.

1. Copy system container state:

    ```bash
    sudo rsync \
      --archive \
      --hard-links \
      --acls \
      --xattrs \
      --numeric-ids \
      --one-file-system \
      /var/lib/containers/ \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/var-lib-containers/
    ```

    Expect rsync to exit zero.

1. Generate a checksum manifest for ordinary files in the migration directory:

    ```bash
    cd /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs \
      && find system -type f -print0 \
      | sort --zero-terminated \
      | xargs --null sha256sum \
      > system.sha256
    ```

    Expect `system.sha256` to be nonempty.

1. Verify the system checksum manifest:

    ```bash
    cd /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs \
      && sha256sum --check system.sha256
    ```

    Expect every line to end in `OK` and the command to exit zero.

1. Create fresh independent Kopia snapshots of critical home sources:

    ```bash
    /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
      snapshot create \
      --description='pre-CachyOS-ZFS migration 2026-08-29' \
      /home/user/.config \
      /home/user/.ssh \
      /home/user/.gnupg \
      /home/user/.claude \
      /home/user/.pi \
      /home/user/Monochromatic \
      /home/user/labwc-vm-test \
      /home/user/Downloads \
      /home/user/Seafile/Plain
    ```

    Expect each source to report a completed snapshot with zero errors.

1. Create a fresh independent Kopia snapshot of `Archive`:

    ```bash
    /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
      snapshot create \
      --description='pre-CachyOS-ZFS migration 2026-08-29' \
      /var/mnt/encrypted/Archive
    ```

    Expect the snapshot to complete with zero errors.

1. Create a fresh independent Kopia snapshot of `low`:

    ```bash
    /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
      snapshot create \
      --description='pre-CachyOS-ZFS migration 2026-08-29' \
      /var/mnt/encrypted/low
    ```

    Expect the snapshot to complete with zero errors.

1. Restore the just-snapshotted `AGENTS.md` into a disposable directory:

    ```bash
    restore_root="$(mktemp --directory)" \
      && object_id="$(
        /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
          snapshot list \
          --json \
          /home/user/Monochromatic \
        | jq -r 'last.rootEntry.obj'
      )" \
      && /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
        snapshot restore \
        "$object_id/AGENTS.md" \
        "$restore_root/AGENTS.md" \
      && cmp \
        /home/user/Monochromatic/AGENTS.md \
        "$restore_root/AGENTS.md" \
      && rm --recursive -- "$restore_root" \
      && echo 'Kopia restore drill: identical'
    ```

    Expect exactly `Kopia restore drill: identical` after Kopia’s progress output.

1. Verify stored files for the protected data sources:

    ```bash
    /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
      snapshot verify \
      --sources=/var/mnt/encrypted/Archive \
      --sources=/var/mnt/encrypted/low \
      --verify-files-percent=0.1 \
      --json \
      | jq \
        --exit-status \
        '.errorCount == 0 and .stats.expectedTotalFileCount > 0 and .stats.processedObjectCount > 0'
    ```

    Expect `true` and exit status zero.
    A zero-error result with zero expected files is not accepted as backup evidence.
    A read-only positive control against these exact sources on 2026-08-29 reported zero errors,
    245,977 expected files,
    47,610 processed objects,
    and 49 read files.
    Re-run the check because that control does not verify later backup changes.

1. Flush all backup writes:

    ```bash
    sync
    ```

    Expect the command to return without an error.

### Download and authenticate the pinned media

1. Create a private download directory:

   ```bash
   install --directory --mode=0700 /home/user/Downloads/cachyos-zfs-260809
   ```

   Expect the directory to exist.

1. Download the official ISO:

   ```bash
   curl \
     --fail \
     --location \
     --output /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso \
     https://cdn77.cachyos.org/ISO/desktop/260809/cachyos-desktop-linux-260809.iso
   ```

   Expect curl to finish 3,188,850,688 bytes and exit zero.

1. Download the official checksum file:

   ```bash
   curl \
     --fail \
     --location \
     --output /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso.sha256 \
     https://mirror.cachyos.org/ISO/desktop/260809/cachyos-desktop-linux-260809.iso.sha256
   ```

   Expect curl to exit zero.

1. Download the official signature:

   ```bash
   curl \
     --fail \
     --location \
     --output /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso.sig \
     https://cdn77.cachyos.org/ISO/desktop/260809/cachyos-desktop-linux-260809.iso.sig
   ```

   Expect curl to exit zero.

1. Verify the ISO checksum:

   ```bash
   cd /home/user/Downloads/cachyos-zfs-260809 \
     && sha256sum --check cachyos-desktop-linux-260809.iso.sha256
   ```

   Expect exactly:

   ```text
   cachyos-desktop-linux-260809.iso: OK
   ```

1. Create an isolated GnuPG home:

   ```bash
   install --directory --mode=0700 /home/user/Downloads/cachyos-zfs-260809/gnupg
   ```

   Expect the directory to exist with mode `0700`.

1. Import the CachyOS signing key into the isolated GnuPG home:

   ```bash
   gpg \
     --homedir /home/user/Downloads/cachyos-zfs-260809/gnupg \
     --keyserver hkps://keys.openpgp.org \
     --recv-key F3B607488DB35A47
   ```

   Expect output naming `CachyOS <admin@cachyos.org>`.

1. Verify the complete signing-key fingerprint:

   ```bash
   gpg \
     --homedir /home/user/Downloads/cachyos-zfs-260809/gnupg \
     --with-colons \
     --fingerprint F3B607488DB35A47 \
     | awk -F: '$1=="fpr" {print $10; exit}'
   ```

   Expect exactly:

   ```text
   882DCFE48E2051D48E2562ABF3B607488DB35A47
   ```

1. Verify the ISO signature:

   ```bash
   cd /home/user/Downloads/cachyos-zfs-260809 \
     && gpg \
       --homedir gnupg \
       --verify \
       cachyos-desktop-linux-260809.iso.sig \
       cachyos-desktop-linux-260809.iso
   ```

   Expect both:

   ```text
   Good signature from "CachyOS <admin@cachyos.org>"
   Primary key fingerprint: 882D CFE4 8E20 51D4 8E25  62AB F3B6 0748 8DB3 5A47
   ```

1. Download the pinned ZFS installer archive:

    ```bash
    curl \
      --fail \
      --location \
      --output /home/user/Downloads/cachyos-zfs-260809/cachyos-zfs-installer-9d587de2.tar.gz \
      https://github.com/fnichol/cachyos-zfs-installer/archive/9d587de2d34a35ea33094735002d8599afed7eac.tar.gz
    ```

    Expect curl to exit zero.

1. Verify the installer archive checksum:

    ```bash
    printf '%s  %s\n' \
      f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c \
      /home/user/Downloads/cachyos-zfs-260809/cachyos-zfs-installer-9d587de2.tar.gz \
      | sha256sum --check
    ```

    Expect the archive path followed by `OK`.

1. Copy the authenticated media and installer archive into the protected migration directory:

    ```bash
    cp \
      --reflink=auto \
      /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso \
      /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso.sha256 \
      /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso.sig \
      /home/user/Downloads/cachyos-zfs-260809/cachyos-zfs-installer-9d587de2.tar.gz \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/
    ```

    Expect the command to exit zero.

### Build the disposable UEFI validation environment

1. Confirm no prior validation domain exists:

   ```bash
   flatpak run \
     --command=virsh \
     org.virt_manager.virt-manager \
     --connect qemu:///session \
     dominfo cachyos-zfs-validation
   ```

   Expect `Domain not found`.
   If a domain exists,
   use the Restore section before continuing.

1. Create the validation directory:

   ```bash
   install --directory --mode=0700 /home/user/cachyos-zfs-validation
   ```

   Expect the directory to exist.

1. Create a 128 MiB FAT image for the rehearsed labwc configuration:

   ```bash
   truncate \
     --size=128M \
     /home/user/cachyos-zfs-validation/labwc-configs.img \
     && mkfs.vfat \
       -n LABWCCFG \
       /home/user/cachyos-zfs-validation/labwc-configs.img
   ```

   Expect `mkfs.fat` to report successful filesystem creation.

1. Copy the labwc rehearsal artifacts into the FAT image:

   ```bash
   mcopy \
     -s \
     -i /home/user/cachyos-zfs-validation/labwc-configs.img \
     /home/user/labwc-vm-test/final-configs \
     /home/user/labwc-vm-test/HANDOVER.md \
     /home/user/labwc-vm-test/YOUR-SETUP.md \
     /home/user/labwc-vm-test/MIGRATION-PLAN.md \
     ::/
   ```

   Expect `mcopy` to exit zero.

1. Create a 256 MiB writable FAT image for installer evidence:

   ```bash
   truncate \
     --size=256M \
     /home/user/cachyos-zfs-validation/installer-evidence.img \
     && mkfs.vfat \
       -n ZFSEVID \
       /home/user/cachyos-zfs-validation/installer-evidence.img
   ```

   Expect `mkfs.fat` to report successful filesystem creation.

1. Create the bounded UEFI virtual machine:

   ```bash
   flatpak run \
     --command=virt-install \
     org.virt_manager.virt-manager \
     --connect qemu:///session \
     --name cachyos-zfs-validation \
     --memory 8192 \
     --vcpus 4 \
     --disk path=/home/user/cachyos-zfs-validation/disk.qcow2,size=128,bus=virtio,format=qcow2,sparse=yes \
     --disk path=/home/user/cachyos-zfs-validation/labwc-configs.img,device=disk,bus=virtio,readonly=on \
     --disk path=/home/user/cachyos-zfs-validation/installer-evidence.img,device=disk,bus=virtio \
     --cdrom /home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso \
     --boot uefi \
     --graphics spice,gl=on \
     --video virtio,accel3d=on \
     --network user,model=virtio \
     --osinfo detect=on,require=off \
     --noautoconsole
   ```

   Expect output ending with `Domain creation completed.`

1. Open virt-manager:

   ```bash
   flatpak run org.virt_manager.virt-manager
   ```

   Expect the **QEMU/KVM User Session** connection to list **cachyos-zfs-validation**.

1. Open **cachyos-zfs-validation**.
   Expect its console window to show the CachyOS boot media.

1. Start **cachyos-zfs-validation** if it is not already running.
   Expect the CachyOS live boot menu or desktop.

1. Select the **default CachyOS live entry** and press **Enter**.
   Expect the CachyOS live desktop.

1. Open the live terminal without clicking **Launch installer** in CachyOS Hello.
    Expect a prompt for `liveuser`.
    Stock Calamares must not run before the pinned profile is applied.

1. Confirm that no Calamares process already exists:

    ```bash
    if pgrep --exact calamares; then
      printf '%s\n' 'Unexpected stock Calamares process' >&2
      exit 1
    fi
    ```

    Expect no process ID and exit status zero.

1. Mount the writable evidence image:

    ```bash
    sudo install --directory --mode=0700 /mnt/zfs-evidence \
      && sudo mount /dev/vdc /mnt/zfs-evidence \
      && sudo chown liveuser:liveuser /mnt/zfs-evidence
    ```

    Expect `findmnt /mnt/zfs-evidence` to name `/dev/vdc`.

1. Confirm that the VM booted through UEFI:

    ```bash
    efibootmgr --verbose
    ```

    Expect boot entries rather than `EFI variables are not supported on this system.`

1. Download the pinned installer archive inside the VM:

    ```bash
    curl \
      --fail \
      --location \
      --output /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
      https://github.com/fnichol/cachyos-zfs-installer/archive/9d587de2d34a35ea33094735002d8599afed7eac.tar.gz
    ```

    Expect curl to exit zero.

1. Verify the installer archive inside the VM:

    ```bash
    printf '%s  %s\n' \
      f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c \
      /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
      | sha256sum --check
    ```

    Expect the archive path followed by `OK`.

1. Extract the installer inside the VM:

    ```bash
    install \
      --directory \
      --mode=0700 \
      /home/liveuser/cachyos-zfs-installer \
      && bsdtar \
        --extract \
        --strip-components=1 \
        --file /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
        --directory /home/liveuser/cachyos-zfs-installer
    ```

    Expect the command to exit zero.

1. Launch the pinned installer inside the VM with debug output retained:

    ```bash
    cd /home/liveuser/cachyos-zfs-installer \
      && bash \
        -o pipefail \
        -c 'sudo -E env DEBUG=1 ./bin/install 2>&1 | tee /mnt/zfs-evidence/bin-install.log'
    ```

    Expect terminal sections ending in `Launching calamares installer` and a Calamares window.

1. Open a second live terminal without closing the pinned Calamares window.
    Expect another `liveuser` prompt.

1. Verify that the effective Calamares execution sequence contains the custom jobs:

    ```bash
    grep \
      --fixed-strings \
      --line-number \
      -e 'shellprocess@copy_zfs_scripts' \
      -e 'shellprocess@configure_zfsbootmenu' \
      -e 'shellprocess@configure_zfs_encryption' \
      -e 'shellprocess@configure_mkinitcpio' \
      -e 'shellprocess@create_baseline_boot_env' \
      -e 'shellprocess@install_pacman_zfs' \
      -e 'shellprocess@setup_user_home_zfs' \
      /usr/share/calamares/settings.conf \
      | tee /mnt/zfs-evidence/effective-sequence.txt
    ```

    Expect every named custom job once.
    Stop before partition confirmation if any job is absent.

1. Preserve the full effective settings file:

    ```bash
    cp \
      /usr/share/calamares/settings.conf \
      /mnt/zfs-evidence/settings.conf
    ```

    Expect the copied file to be non-empty.

1. In Calamares,
    select the intended **Language**.
    Expect the installer text to use that language.

1. Select the intended **Region** and **Time Zone**.
    Expect the map and displayed time zone to match.

1. Select the intended **Keyboard Layout**.
    Expect the layout test field to produce the intended characters.

1. On the partition page,
    select **Erase disk** and the 128 GiB virtual disk.
    Expect no physical host disk to appear.

1. Keep **ZFS** selected as the filesystem.
    Expect the partition summary to identify ZFS for `/`.

1. Enable **Encrypt system**.
    Expect passphrase fields to appear.

1. Enter the disposable VM encryption passphrase twice.
    Expect Calamares to accept matching entries.

1. Choose **No Desktop**.
    Expect no preinstalled desktop or window-manager package group to remain selected.
    This keeps the validation base aligned with the intended UWSM plus labwc session.

1. If the installer presents a kernel chooser,
    select the normal CachyOS kernel rather than a real-time kernel.
    The pinned 260809 package page did not present a separate kernel chooser during the first VM installation,
    so verify the installed kernel and ZFS-module pairing after boot when that page is absent.

1. Create username `user` and hostname `cachyos-zfs-vm`.
    Calamares may auto-fill both fields after the full name is entered.
    Select each field’s complete existing value with **Ctrl+A** before typing the intended replacement.
    Expect the account summary to show exactly `user`,
    not an appended value such as `useruser`.

1. Enter the disposable user password twice.
    Expect Calamares to accept matching entries.

1. If the installer’s keyfile dialog requests the ZFS passphrase again,
    enter the same disposable passphrase.
    The pinned installer reused the partition-page passphrase without displaying a second dialog in the first VM run.

1. Review the installation summary without clicking **Install** yet.
    Expect the summary to erase only the 128 GiB virtual disk,
    create an EFI system partition,
    create ZFS root storage,
    and enable encryption.

1. Click **Install** only if the summary matches the expected VM layout.
    Expect an erase confirmation.

1. Confirm the erase action.
    Expect installation progress to begin.

1. Wait for Calamares to report successful completion.
    Expect no failed job and a nonempty log at `/home/liveuser/.cache/calamares/session.log`.

1. Before closing or rebooting the live environment,
    preserve the Calamares log and flush the evidence image:

    ```bash
    cp \
      /home/liveuser/.cache/calamares/session.log \
      /mnt/zfs-evidence/calamares.install.log \
      && sync \
      && test -s /mnt/zfs-evidence/calamares.install.log
    ```

    Expect exit status zero.

1. Select **Done** in Calamares.
    Expect the Calamares window to close and the debug pipeline to return to its shell prompt.

1. Confirm that neither Calamares nor its evidence writer remains active:

    ```bash
    test -z "$(pgrep --exact calamares)" \
      && test -z "$(pgrep --exact tee)"
    ```

    Expect exit status zero before unmounting the evidence image.

1. Flush and unmount the evidence image:

    ```bash
    sync \
      && sudo umount /mnt/zfs-evidence
    ```

    Expect the unmount to succeed without `target is busy`.

1. Shut down the VM from the live desktop instead of immediately rebooting.
    Expect virt-manager to show **Shutoff**.

1. Open the VM’s hardware details and select the virtual **CD-ROM**.
    Expect the CachyOS ISO path to be shown.

1. Click **Disconnect** for the virtual CD-ROM.
    Expect the CD-ROM to show no connected media.

1. Start **cachyos-zfs-validation**.
    Expect firmware to launch ZFSBootMenu.

1. Enter the disposable ZFS passphrase once.
    Expect ZFSBootMenu to list `default`.
    The installer marks `baseline` with `org.zfsbootmenu:active=off`,
    which hides it until the validation phase explicitly enables it.

1. Select **`default`** and press **Enter**.
    Expect CachyOS to reach an installed console or login path without a second ZFS passphrase.
    Do not expect a preinstalled desktop session.

### Validate encrypted rollback in the VM

1. Log in through the installed console as `user`.
   Expect a shell prompt for `user@cachyos-zfs-vm`.

1. Confirm the running root dataset:

   ```bash
   findmnt --noheadings --output SOURCE,FSTYPE,OPTIONS /
   ```

   Expect the source to name `zroot/ROOT/default` and the filesystem type to be `zfs`.

1. Confirm native encryption:

   ```bash
   sudo zfs get \
     -H \
     -o name,property,value \
     encryption,keyformat,encryptionroot,keylocation \
     zroot
   ```

   Expect `encryption` to be `aes-256-gcm`,
   `keyformat` to be `passphrase`,
   and `encryptionroot` to be `zroot`.

1. Confirm the required datasets:

   ```bash
   sudo zfs list \
     -r \
     -o name,mountpoint,canmount,encryptionroot \
     zroot
   ```

   Expect `zroot/ROOT/default`,
   `zroot/ROOT/baseline`,
   `zroot/data/home/user`,
   and `zroot/keystore`.

1. Make the factory baseline directly selectable:

   ```bash
   sudo zfs set \
     org.zfsbootmenu:active=on \
     zroot/ROOT/baseline
   ```

   Expect no error.

1. Confirm the baseline visibility property:

   ```bash
   sudo zfs get \
     -H \
     -o value \
     org.zfsbootmenu:active \
     zroot/ROOT/baseline
   ```

   Expect exactly `on`.

1. Reboot the VM to test baseline visibility:

   ```bash
   systemctl reboot
   ```

   Expect ZFSBootMenu.

1. Enter the disposable ZFS passphrase and confirm both `default` and `baseline` are listed.
   Expect direct menu entries for both environments.
   Select `default` and press **Enter** to continue.

1. Confirm ZFSBootMenu artifacts:

   ```bash
   sudo find /boot/efi/EFI/ZFSBootMenu \
     -maxdepth 1 \
     -type f \
     -printf '%f\n' \
     | sort
   ```

   Expect `vmlinuz-linux-cachyos.EFI`.

1. Generate ZFSBootMenu once to create a verified backup generation:

   ```bash
   sudo generate-zbm
   ```

   Expect output containing `Created backup` or successful image generation.

1. Confirm primary and backup EFI images:

   ```bash
   sudo find /boot/efi/EFI/ZFSBootMenu \
     -maxdepth 1 \
     -type f \
     -printf '%f\n' \
     | sort
   ```

   Expect both:

   ```text
   vmlinuz-linux-cachyos-backup.EFI
   vmlinuz-linux-cachyos.EFI
   ```

1. Confirm package pairing:

   ```bash
   pacman -Q linux-cachyos linux-cachyos-zfs zfs-utils zfsbootmenu
   ```

   Expect all packages to be installed.

1. Confirm the module package’s exact kernel dependency:

   ```bash
   installed_kernel="$(pacman -Q linux-cachyos | awk '{print $2}')" \
     && required_kernel="$(
       pacman -Qi linux-cachyos-zfs \
       | grep \
         --only-matching \
         --extended-regexp \
         'linux-cachyos=[^[:space:]]+' \
       | head --lines=1 \
       | cut --delimiter='=' --fields=2
     )" \
     && printf 'installed=%s\nrequired=%s\n' \
       "$installed_kernel" \
       "$required_kernel" \
     && test "$installed_kernel" = "$required_kernel" \
     && echo 'kernel-module pair: exact'
   ```

   Expect `kernel-module pair: exact`.

1. Confirm initial pool health:

    ```bash
    sudo zpool status -P zroot
    ```

    Expect `state: ONLINE`,
    zero read,
    write,
    and checksum errors,
    and `errors: No known data errors`.

1. Install the proposed package-name-correct regeneration hook in the disposable VM:

    ```bash
    sudo tee /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook > /dev/null <<'EOF'
    # /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook
    [Trigger]
    Operation = Install
    Operation = Upgrade
    Type = Package
    Target = linux-cachyos
    Target = linux-cachyos-zfs
    Target = zfs-meta
    Target = zfs-utils
    Target = zfsbootmenu

    [Action]
    Description = Regenerating ZFSBootMenu after boot-stack changes...
    When = PostTransaction
    Exec = /usr/bin/generate-zbm
    EOF
    ```

    Expect no error.

1. Reinstall ZFSBootMenu inside the disposable VM to exercise the hook:

    ```bash
    sudo pacman --sync zfsbootmenu
    ```

    Expect pacman to identify a reinstall,
    create a pre-transaction environment,
    and print `Regenerating ZFSBootMenu after boot-stack changes` after the transaction.

1. Confirm pacman recorded the local hook execution:

    ```bash
    sudo grep \
      --fixed-strings \
      "running 'zz-zfsbootmenu-regenerate.hook'" \
      /var/log/pacman.log \
      | tail --lines=1
    ```

    Expect one line containing `running 'zz-zfsbootmenu-regenerate.hook'`.

1. Confirm both EFI generations still exist after the hook:

    ```bash
    sudo test -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos.EFI \
      && sudo test -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos-backup.EFI \
      && echo 'regeneration hook: primary and backup present'
    ```

    Expect exactly `regeneration hook: primary and backup present`.

1. Create a state marker that must exist in the pre-transaction environment:

    ```bash
    printf 'before-package-transaction\n' \
      | sudo tee /etc/zbm-rollback-probe
    ```

    Expect exactly `before-package-transaction`.

1. Install the disposable rollback probe package:

    ```bash
    sudo pacman --sync --needed cowsay
    ```

    Expect the pacman pre-hook to print `Creating ZFS boot environment` and the transaction to finish successfully.

1. Record the newest pre-transaction environment:

    ```bash
    sudo zfs list \
      -H \
      -r \
      -t filesystem \
      -o name \
      -s creation \
      zroot/ROOT \
      | grep '/be-' \
      | tail --lines=1 \
      | sudo tee /etc/zbm-probe-environment
    ```

    Expect one dataset named like `zroot/ROOT/be-...-pre-install`.

1. Create a marker that must not exist in the pre-transaction environment:

    ```bash
    printf 'after-package-transaction\n' \
      | sudo tee /etc/zbm-after-transaction
    ```

    Expect exactly `after-package-transaction`.

1. Reboot the VM:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu.

1. Enter the disposable ZFS passphrase.
    Expect the boot-environment list.

1. Select the newest environment whose description begins **`Pre-install Packages: cowsay`** and press **Enter**.
    Expect CachyOS to boot that environment.

1. Confirm the pre-transaction root is running:

    ```bash
    current_be="$(
      sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    )" \
      && printf '%s\n' "$current_be" \
      && test "$current_be" != 'zroot/ROOT/default' \
      && echo 'direct rollback boot: selected environment'
    ```

    Expect `direct rollback boot: selected environment`.

1. Confirm the rollback boundary:

    ```bash
    test "$(cat /etc/zbm-rollback-probe)" = 'before-package-transaction' \
      && test ! -e /etc/zbm-after-transaction \
      && ! pacman -Q cowsay \
      && echo 'rollback root state: before transaction'
    ```

    Expect pacman to report that `cowsay` was not found,
    followed by `rollback root state: before transaction`.

1. Promote the selected environment in the disposable VM:

    ```bash
    current_be="$(
      sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    )" \
      && sudo zpool set "bootfs=$current_be" zroot \
      && sudo zpool get bootfs zroot
    ```

    Expect `bootfs` to equal the selected `zroot/ROOT/be-...` dataset.

1. Reboot without manually choosing an environment:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu to boot the promoted environment by default.

1. Confirm promotion survived reboot:

    ```bash
    current_be="$(
      sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    )" \
      && bootfs="$(sudo zpool get -H -o value bootfs zroot)" \
      && test "$current_be" = "$bootfs" \
      && echo 'rollback promotion: durable'
    ```

    Expect exactly `rollback promotion: durable`.

1. Restore `default` as the VM’s boot target:

    ```bash
    sudo zpool set bootfs=zroot/ROOT/default zroot \
      && sudo zpool get bootfs zroot
    ```

    Expect `zroot/ROOT/default`.

1. Reboot the VM:

    ```bash
    systemctl reboot
    ```

    Expect `default` to boot.

### Validate UWSM plus labwc in the VM

1. Install the repository packages used by the rehearsed session:

   ```bash
   sudo pacman \
     --sync \
     --needed \
     base-devel \
     git \
     jq \
     rsync \
     labwc \
     uwsm \
     xwayland-satellite \
     xorg-xwayland \
     xterm \
     fuzzel \
     foot \
     wlr-randr \
     swaync \
     cliphist \
     wl-clipboard \
     grim \
     slurp \
     swappy \
     swaylock \
     network-manager-applet \
     pavucontrol \
     python-evdev \
     inter-font \
     ttf-jetbrains-mono \
     dolphin \
     breeze \
     breeze-gtk \
     xdg-desktop-portal-wlr \
     xdg-desktop-portal-gtk \
     qt6-wayland \
     qt5-wayland \
     polkit-gnome
   ```

   Expect pacman to finish successfully and the ZFS pre-hook to create a boot environment.

1. Clone the reviewed sfwbar AUR recipe:

   ```bash
   git clone \
     https://aur.archlinux.org/sfwbar.git \
     /home/user/sfwbar-aur
   ```

   Expect a new Git checkout.

1. Check out the reviewed sfwbar recipe:

   ```bash
   git \
     -C /home/user/sfwbar-aur \
     checkout 46996951521a2b1d721382fa6db7164f25cbcd98
   ```

   Expect `HEAD is now at 4699695`.

1. Confirm the reviewed source checksum remains in `PKGBUILD`:

   ```bash
   grep \
     --fixed-strings \
     a4915bc7dd0873c45d0d6b01b070e39a91fd16cfadf730d6a9e48db68a8cd09e \
     /home/user/sfwbar-aur/PKGBUILD
   ```

   Expect one matching `sha256sums` line.

1. Build and install sfwbar as `user`:

   ```bash
   cd /home/user/sfwbar-aur \
     && makepkg --syncdeps --install --needed
   ```

   Expect the source checksum check to pass and pacman to install `sfwbar-1.0_beta17-1`.

1. Mount the read-only configuration image:

   ```bash
   sudo install --directory /mnt/labwc-configs \
     && sudo mount \
       --read-only \
       LABEL=LABWCCFG \
       /mnt/labwc-configs
   ```

   Expect `/mnt/labwc-configs/final-configs/rc.xml`.

1. Install the labwc configuration:

   ```bash
   install \
     --directory \
     /home/user/.config/labwc \
     && install \
       --mode=0644 \
       /mnt/labwc-configs/final-configs/rc.xml \
       /home/user/.config/labwc/rc.xml
   ```

   Expect `rc.xml` to exist.

1. Install the labwc theme:

   ```bash
   install \
     --directory \
     /home/user/.local/share/themes/PureBlack/openbox-3 \
     && install \
       --mode=0644 \
       /mnt/labwc-configs/final-configs/themerc \
       /home/user/.local/share/themes/PureBlack/openbox-3/themerc
   ```

   Expect `themerc` to exist.

1. Install the session helper executables:

   ```bash
   install \
     --directory \
     /home/user/.local/bin \
     && install \
       --mode=0755 \
       /mnt/labwc-configs/final-configs/fuzzel-toggle \
       /mnt/labwc-configs/final-configs/launch-feedback \
       /mnt/labwc-configs/final-configs/launch-new \
       /mnt/labwc-configs/final-configs/meta-tap-launcher \
       /mnt/labwc-configs/final-configs/panel-menu \
       /mnt/labwc-configs/final-configs/toggle-shortcut-guard \
       /mnt/labwc-configs/final-configs/wlr-pager \
       /home/user/.local/bin/
   ```

   Expect each installed file to be executable.

1. Install sfwbar configuration:

    ```bash
    install \
      --directory \
      /home/user/.config/sfwbar \
      && install \
        --mode=0644 \
        /mnt/labwc-configs/final-configs/sfwbar.config \
        /mnt/labwc-configs/final-configs/cal.widget \
        /mnt/labwc-configs/final-configs/cell-focused.svg \
        /mnt/labwc-configs/final-configs/cell-normal.svg \
        /home/user/.config/sfwbar/
    ```

    Expect the four files under `/home/user/.config/sfwbar`.

1. Install fuzzel configuration:

    ```bash
    install \
      --directory \
      /home/user/.config/fuzzel \
      && install \
        --mode=0644 \
        /mnt/labwc-configs/final-configs/fuzzel.ini \
        /home/user/.config/fuzzel/fuzzel.ini
    ```

    Expect `fuzzel.ini`.

1. Install swaync styling:

    ```bash
    install \
      --directory \
      /home/user/.config/swaync \
      && install \
        --mode=0644 \
        /mnt/labwc-configs/final-configs/swaync-style.css \
        /home/user/.config/swaync/style.css
    ```

    Expect `style.css`.

1. Install GTK decoration overrides without replacing existing GTK CSS:

    ```bash
    install --directory /home/user/.config/gtk-3.0 /home/user/.config/gtk-4.0 \
      && cat /mnt/labwc-configs/final-configs/gtk3.css \
        >> /home/user/.config/gtk-3.0/gtk.css \
      && cat /mnt/labwc-configs/final-configs/gtk4.css \
        >> /home/user/.config/gtk-4.0/gtk.css
    ```

    Expect both CSS files to contain `border-radius: 0`.

1. Install the panel icon font:

    ```bash
    install \
      --directory \
      /home/user/.local/share/fonts \
      && install \
        --mode=0644 \
        /mnt/labwc-configs/final-configs/fonts/MaterialSymbolsOutlined.ttf \
        /home/user/.local/share/fonts/MaterialSymbolsOutlined.ttf \
      && fc-cache --force
    ```

    Expect `fc-cache` to exit zero.

1. Configure UWSM environment:

    ```bash
    install --directory /home/user/.config/uwsm \
      && cat > /home/user/.config/uwsm/env <<'EOF'
    # /home/user/.config/uwsm/env
    export QT_QPA_PLATFORMTHEME=kde
    export DISPLAY=:12
    export _JAVA_AWT_WM_NONREPARENTING=1
    export WLR_XWAYLAND=/nonexistent-xwayland-satellite-owns-x11
    export XCURSOR_THEME=breeze_cursors
    EOF
    ```

    Expect the file to contain `DISPLAY=:12`.

1. Install the xwayland-satellite unit override:

    ```bash
    install \
      --directory \
      /home/user/.config/systemd/user/xwayland-satellite.service.d \
      && install \
        --mode=0644 \
        /mnt/labwc-configs/final-configs/xwayland-satellite-override.conf \
        /home/user/.config/systemd/user/xwayland-satellite.service.d/override.conf
    ```

    Expect `ExecStart=/usr/bin/xwayland-satellite :12`.

1. Enable xwayland-satellite for graphical sessions:

    ```bash
    systemctl --user enable xwayland-satellite.service
    ```

    Expect a user-unit enablement symlink.

1. Create labwc autostart configuration:

    ```bash
    cat > /home/user/.config/labwc/autostart <<'EOF'
    # /home/user/.config/labwc/autostart
    uwsm app -t service -- sfwbar &
    uwsm app -t service -- swaync &
    uwsm app -t service -- wl-paste --type text --watch cliphist store &
    uwsm app -t service -- /home/user/.local/bin/meta-tap-launcher &
    uwsm app -t service -- nm-applet --indicator &
    uwsm app -t service -- /usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1 &
    EOF
    ```

    Expect six `uwsm app` lines.

1. Add `user` to the input group:

    ```bash
    sudo usermod --append --groups input user
    ```

    Expect the command to exit zero.

1. Change the login shell to Bash:

    ```bash
    chsh --shell /usr/bin/bash
    ```

    Expect a password prompt followed by no error.

1. In the VM console,
   choose **Send Key** then **Ctrl+Alt+F2**.
    Expect a text login prompt.

1. Log in as `user` on tty2.
    Expect a Bash prompt.

1. Start the candidate session manually:

    ```bash
    uwsm start -- /usr/bin/labwc
    ```

    Expect labwc,
    sfwbar,
    and the black desktop.

1. Press **Meta+Ctrl+Right**.
    Expect the pager highlight to move one cell right.

1. Press **Meta** once without another key.
    Expect fuzzel to open directly over the lower-left panel edge.

1. Press **Meta** once again.
    Expect fuzzel to close.

1. **Right-click** a running application in the sfwbar task list and select **New instance**.
    Expect another instance to open.

1. Launch the installed X11-only test client through UWSM:

    ```bash
    uwsm app -t service -- xterm
    ```

    Expect an xterm window.

1. Confirm that xterm uses xwayland-satellite:

    ```bash
    xterm_pid="$(pgrep --newest --exact xterm)" \
      && tr '\0' '\n' < "/proc/$xterm_pid/environ" \
      | grep --line-regexp 'DISPLAY=:12'
    ```

    Expect exactly `DISPLAY=:12`.

1. Open a terminal inside labwc and inspect UWSM units:

    ```bash
    systemctl --user \
      --no-pager \
      --plain \
      list-units \
      'wayland-wm@labwc.service' \
      'xwayland-satellite.service' \
      'app-*.scope' \
      'app-*.service'
    ```

    Expect active `wayland-wm@labwc.service`,
    active `xwayland-satellite.service`,
    and separate app units.

1. Exit labwc through the panel’s **Log out** action.
    Expect tty2 to return to a text login prompt.

1. Create a root-backed labwc configuration directory in the disposable VM:

    ```bash
    sudo install \
      --directory \
      --mode=0750 \
      --owner=user \
      --group=user \
      /etc/user-rollback/user/config/labwc \
      && sudo rsync \
        --archive \
        /home/user/.config/labwc/ \
        /etc/user-rollback/user/config/labwc/
    ```

    Expect `rc.xml` and `autostart` under the root-backed directory.

1. Replace the disposable VM’s labwc directory with the root-backed link:

    ```bash
    mv \
      /home/user/.config/labwc \
      /home/user/.config/labwc.persistent-before-root-link \
      && ln \
        --symbolic \
        /etc/user-rollback/user/config/labwc \
        /home/user/.config/labwc
    ```

    Expect `.config/labwc` to resolve under `/etc/user-rollback/user`.

1. Create the disposable root-backed labwc login snippet:

    ```bash
    sudo tee \
      /etc/user-rollback/user/start-labwc.sh \
      > /dev/null <<'EOF'
    # /etc/user-rollback/user/start-labwc.sh
    if uwsm check may-start; then
      exec uwsm start -- /usr/bin/labwc
    fi
    EOF
    sudo chmod 0644 /etc/user-rollback/user/start-labwc.sh
    ```

    Expect no error.

1. Create the disposable tty1 autologin override with the rehearsed agetty path:

    ```bash
    sudo install \
      --directory \
      /etc/systemd/system/getty@tty1.service.d \
      && sudo tee \
        /etc/systemd/system/getty@tty1.service.d/autologin.conf \
        > /dev/null <<'EOF'
    # /etc/systemd/system/getty@tty1.service.d/autologin.conf
    [Service]
    ExecStart=
    ExecStart=-/sbin/agetty --autologin user --noclear %I $TERM
    EOF
    ```

    Expect no error.

1. Add the disposable marked startup block to `.bash_profile`:

    ```bash
    cat >> /home/user/.bash_profile <<'EOF'
    # cachyos-zfs-labwc-start
    if test -r /etc/user-rollback/user/start-labwc.sh; then
      . /etc/user-rollback/user/start-labwc.sh
    fi
    # cachyos-zfs-labwc-end
    EOF
    ```

    Expect the two marker comments exactly once.

1. Disable the disposable VM’s initial display manager:

    ```bash
    sudo systemctl disable display-manager.service \
      && sudo systemctl daemon-reload
    ```

    Expect the display-manager enablement symlink to be removed.

1. Create the disposable known-good snapshot and clone:

    ```bash
    sudo zfs snapshot zroot/ROOT/default@known-good-validation \
      && sudo zfs clone \
        zroot/ROOT/default@known-good-validation \
        zroot/ROOT/known-good-validation \
      && sudo zfs set \
        canmount=noauto \
        mountpoint=/ \
        org.zfsbootmenu:active=on \
        'org.zfsbootmenu:description=Disposable UWSM labwc known good' \
        "org.zfsbootmenu:kernel_version=$(uname -r)" \
        'org.zfsbootmenu:commandline=%{parent}' \
        zroot/ROOT/known-good-validation
    ```

    Expect no error.

1. Reboot the disposable VM:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu to list `known-good-validation`.

1. Select **`known-good-validation`** and press **Enter**.
    Expect tty1 autologin to start UWSM plus labwc from the cloned root without a display manager.

1. Confirm the cloned root and root-backed symlink:

    ```bash
    current_be="$(
      sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    )" \
      && labwc_config="$(readlink --canonicalize /home/user/.config/labwc)" \
      && test "$current_be" = 'zroot/ROOT/known-good-validation' \
      && test "$labwc_config" = '/etc/user-rollback/user/config/labwc' \
      && echo 'known-good root-backed configuration: verified'
    ```

    Expect exactly `known-good root-backed configuration: verified`.

1. Confirm the cloned session has no enabled display manager:

    ```bash
    systemctl is-enabled display-manager.service || true
    ```

    Expect `disabled` or `not-found`.

1. Exit labwc through the panel’s **Log out** action.
    Expect getty@tty1 to respawn,
    autologin,
    and start a fresh UWSM plus labwc session.

1. Restore `default` as the disposable VM boot target:

    ```bash
    sudo zpool set bootfs=zroot/ROOT/default zroot
    ```

    Expect no error.

1. Reboot the disposable VM and select `default` if ZFSBootMenu does not choose it automatically.
    Expect the default environment.

1. Mark disposable candidate validation complete only after every VM check passes.
    Expect no unresolved VM stop condition.

### Write the authenticated ISO to USB

1. Insert the USB drive.
   Expect it to appear as a removable drive whose model and capacity differ from both internal SSDs.

1. Record the USB identity:

   ```bash
   lsblk \
     --bytes \
     --output NAME,PATH,SIZE,RM,TYPE,MODEL,SERIAL,TRAN,MOUNTPOINTS
   ```

   Expect exactly one intended removable USB disk with `RM` equal to `1`.

1. Launch Fedora Media Writer:

   ```bash
   flatpak run org.fedoraproject.MediaWriter
   ```

   Expect the **Select Image Source** screen.

1. Click **Select .iso file**.
   Expect a file chooser.

1. Select **`/home/user/Downloads/cachyos-zfs-260809/cachyos-desktop-linux-260809.iso`**.
   Expect **Custom image** and the selected filename.

1. Click **Next**.
   Expect the **Select Drive** screen.

1. Select only the USB whose model,
   serial,
   and capacity matched the recorded removable disk.
   Expect that USB to appear under **Selected**.

1. Click **Write**.
   Expect **Erase confirmation** containing the selected USB capacity.

1. Re-read the model and capacity in **Erase confirmation**.
   Expect neither `SPCC M.2 PCIe SSD` nor `Samsung SSD 860 EVO 4TB`.

1. Click **Write** in **Erase confirmation**.
    Expect **Writing** followed by **Checking the written data**.

1. Wait for **Finished!**.
    Expect `Writing ... was successful`.

1. Click **Finish**.
    Expect Fedora Media Writer to return to its initial screen.

1. Eject the USB through the desktop’s **Safely Remove** action.
    Expect the USB to disappear from the mounted-device list.

### Isolate the protected 4 TB SSD

1. Shut down Bazzite completely:

   ```bash
   systemctl poweroff
   ```

   Expect fans and system power to stop.

1. Switch off the power supply and disconnect AC power.
   Expect the motherboard lights to turn off.

1. Press the case power button once with AC disconnected.
   Expect no boot and any residual lights to extinguish.

1. Use antistatic precautions before opening the case.
   Expect no contact with powered components.

1. Disconnect the SATA data and power cables from the Samsung SSD identified as serial `S596NE0N102120M`.
   Expect the 4 TB SSD to be electrically isolated from the installation.

1. Leave the SPCC NVMe installed.
   Expect the target NVMe to remain available.

1. Close the case enough to avoid accidental contact during the installation.
   Expect no loose cable near a fan.

1. Reconnect AC power and switch on the power supply.
   Expect standby power to return.

### Install encrypted CachyOS ZFS on the physical NVMe

1. Insert the authenticated CachyOS USB.
   Expect it to be physically present before boot.

1. Power on and press **F12** for the Gigabyte boot menu.
   Expect a firmware boot-device list.

1. Select the USB entry prefixed with **UEFI**.
   Expect the CachyOS live boot menu.

1. Select the **default CachyOS live entry** and press **Enter**.
   Expect the live desktop.

1. Open the live terminal.
   Expect a `liveuser` prompt.

1. Confirm UEFI mode:

   ```bash
   efibootmgr --verbose
   ```

   Expect firmware boot entries rather than `EFI variables are not supported on this system.`

1. Confirm the protected SATA SSD is absent:

   ```bash
   lsblk \
     --bytes \
     --output NAME,PATH,SIZE,TYPE,MODEL,SERIAL,TRAN
   ```

   Expect the SPCC serial `A240827N4M204800049` and the USB.
   Expect no `Samsung SSD 860 EVO 4TB` and no serial `S596NE0N102120M`.

1. Confirm Secure Boot is disabled:

   ```bash
   bootctl status 2>/dev/null | grep --fixed-strings 'Secure Boot'
   ```

   Expect `Secure Boot: disabled`.

1. Download the pinned installer archive:

   ```bash
   curl \
     --fail \
     --location \
     --output /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
     https://github.com/fnichol/cachyos-zfs-installer/archive/9d587de2d34a35ea33094735002d8599afed7eac.tar.gz
   ```

   Expect curl to exit zero.

1. Verify the installer archive:

    ```bash
    printf '%s  %s\n' \
      f83565958f5d32054c2a6dbb7bc0295eedc69b21de47d18bcdd1d65ee3d2073c \
      /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
      | sha256sum --check
    ```

    Expect the archive path followed by `OK`.

1. Extract the installer:

    ```bash
    install \
      --directory \
      --mode=0700 \
      /home/liveuser/cachyos-zfs-installer \
      && bsdtar \
        --extract \
        --strip-components=1 \
        --file /home/liveuser/cachyos-zfs-installer-9d587de2.tar.gz \
        --directory /home/liveuser/cachyos-zfs-installer
    ```

    Expect the command to exit zero.

1. Launch the pinned installer:

    ```bash
    cd /home/liveuser/cachyos-zfs-installer \
      && sudo -E ./bin/install
    ```

    Expect terminal sections ending in `Launching calamares installer` and a Calamares window.

1. Select the intended **Language**.
    Expect the installer text to use that language.

1. Select the intended **Region** and **Time Zone**.
    Expect the map and displayed time zone to match.

1. Select the intended **Keyboard Layout**.
    Expect the layout test field to produce the intended characters.

1. On the partition page,
    select **Erase disk**.
    Expect a disk selector.

1. Select only **`SPCC M.2 PCIe SSD`**,
    serial `A240827N4M204800049`,
    approximately 2.05 TB.
    Expect that exact disk to be marked for erasure.

1. Keep **ZFS** selected.
    Expect ZFS to be shown for `/`.

1. Enable **Encrypt system**.
    Expect passphrase fields.

1. Enter the permanent ZFS passphrase twice.
    Expect matching-passphrase validation.

1. Choose **No Desktop**.
    Expect no preinstalled desktop or window-manager package group to remain selected.

1. If the installer presents a kernel chooser,
    select the normal CachyOS kernel rather than a real-time kernel.
    If no chooser appears,
    continue and verify `linux-cachyos` plus its exact ZFS-module dependency after boot.

1. Keep the required CachyOS,
    shell,
    base,
    and common package groups without adding a desktop environment.
    Expect **No Desktop** to remain the installation choice.

1. Create username `user`.
    Calamares may have auto-filled the field from the full name.
    Select the complete existing value with **Ctrl+A** before typing.
    Expect the account summary to show exactly `user`,
    not an appended value such as `useruser`.

1. Choose the permanent hostname.
    Select any auto-filled value with **Ctrl+A** before typing the permanent name.
    Expect that exact hostname in the account summary.

1. Enter the permanent user password twice.
    Expect matching-password validation.

1. Enter the permanent ZFS passphrase again when the keyfile dialog requests it.
    Expect the dialog to close without an error.

1. Stop at the final summary before selecting **Install**.
    Expect only the SPCC NVMe to be erased.

1. Verify that the summary includes an EFI system partition,
    ZFS root,
    encryption,
    no preinstalled desktop,
    and user `user`.
    Verify the normal CachyOS kernel after boot if the installer did not expose a kernel chooser.
    Expect no Samsung disk and no Windows-preservation action.

1. Click **Install** only when the summary matches the required layout.
    Expect an erase confirmation naming the SPCC NVMe.

1. Confirm the erase action.
    Expect partitioning and installation progress.

1. Wait for successful completion.
    Expect no failed job and a nonempty log at `/home/liveuser/.cache/calamares/session.log`.

1. Preserve that log outside the target NVMe before closing Calamares.
    Expect the copied evidence to remain available after leaving the live environment.

1. Select **Done** without automatically rebooting if Calamares offers that choice.
    Expect the installer to close.

1. In the live terminal,
    verify that the EFI image exists on the installed target before shutdown:

    ```bash
    sudo find /tmp \
      /mnt \
      -path '*/EFI/ZFSBootMenu/vmlinuz-linux-cachyos.EFI' \
      -print 2>/dev/null
    ```

    Expect one installed-target path.
    If Calamares has already unmounted the target and nothing is printed,
    rely on the successful `configure-zfsbootmenu` job in the Calamares log rather than mounting it ad hoc.

1. Shut down the live system:

    ```bash
    systemctl poweroff
    ```

    Expect complete power-off.

1. Remove the USB.
    Expect only internal storage at the next boot.

1. Power on the desktop.
    Expect firmware to launch **ZFSBootMenu**.

1. Enter the permanent ZFS passphrase once.
    Expect `default` in the ZFSBootMenu list.
    The physical validation phase explicitly makes the installed `baseline` selectable.

1. Select **`default`** and press **Enter**.
    Expect an installed console or login path without a second ZFS passphrase.
    Do not expect a preinstalled desktop session.

### Verify and harden the physical installation

1. Open a terminal in the installed system.
   Expect a prompt for `user`.

1. Confirm the root source:

   ```bash
   findmnt --noheadings --output SOURCE,FSTYPE,OPTIONS /
   ```

   Expect `zroot/ROOT/default` and `zfs`.

1. Confirm encryption:

   ```bash
   sudo zfs get \
     -H \
     -o name,property,value \
     encryption,keyformat,encryptionroot,keylocation \
     zroot
   ```

   Expect `aes-256-gcm`,
   `passphrase`,
   and encryption root `zroot`.

1. Confirm pool health:

   ```bash
   sudo zpool status -P zroot
   ```

   Expect `state: ONLINE`,
   zero error counters,
   and `errors: No known data errors`.

1. Confirm the pool contains only the SPCC NVMe partition:

   ```bash
   sudo zpool status -P zroot \
     | grep --extended-regexp 'SPCC|nvme|Samsung|sda'
   ```

   Expect an NVMe partition path and no `Samsung` or `sda` member.

1. Confirm the boot environments:

   ```bash
   sudo zfs list -r -o name,mountpoint,canmount zroot/ROOT
   ```

   Expect `zroot/ROOT/default` and `zroot/ROOT/baseline`.

1. Make the factory baseline directly selectable:

   ```bash
   sudo zfs set \
     org.zfsbootmenu:active=on \
     zroot/ROOT/baseline
   ```

   Expect no error.

1. Confirm the baseline visibility property:

   ```bash
   sudo zfs get \
     -H \
     -o value \
     org.zfsbootmenu:active \
     zroot/ROOT/baseline
   ```

   Expect exactly `on`.

1. Confirm the persistent home boundary:

   ```bash
   findmnt --noheadings --output SOURCE,TARGET,FSTYPE /home/user
   ```

   Expect source `zroot/data/home/user` and target `/home/user`.

1. Confirm the EFI entry:

   ```bash
   sudo efibootmgr --verbose | grep --fixed-strings ZFSBootMenu
   ```

   Expect a `ZFSBootMenu` entry pointing to `\EFI\ZFSBootMenu\vmlinuz-linux-cachyos.EFI`.

1. Confirm the primary EFI image:

   ```bash
   sudo test \
     -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos.EFI \
     && echo 'ZFSBootMenu primary EFI: present'
   ```

   Expect exactly `ZFSBootMenu primary EFI: present`.

1. Generate a backup EFI generation:

    ```bash
    sudo generate-zbm
    ```

    Expect successful generation and creation of the backup when a primary image already exists.

1. Confirm the backup EFI image:

    ```bash
    sudo test \
      -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos-backup.EFI \
      && echo 'ZFSBootMenu backup EFI: present'
    ```

    Expect exactly `ZFSBootMenu backup EFI: present`.

1. Confirm exact kernel-module pairing:

    ```bash
    installed_kernel="$(pacman -Q linux-cachyos | awk '{print $2}')" \
      && required_kernel="$(
        pacman -Qi linux-cachyos-zfs \
        | grep \
          --only-matching \
          --extended-regexp \
          'linux-cachyos=[^[:space:]]+' \
        | head --lines=1 \
        | cut --delimiter='=' --fields=2
      )" \
      && test "$installed_kernel" = "$required_kernel" \
      && echo 'kernel-module pair: exact'
    ```

    Expect exactly `kernel-module pair: exact`.

1. Install a package-name-correct ZFSBootMenu regeneration hook:

    ```bash
    sudo tee /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook > /dev/null <<'EOF'
    # /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook
    [Trigger]
    Operation = Install
    Operation = Upgrade
    Type = Package
    Target = linux-cachyos
    Target = linux-cachyos-zfs
    Target = zfs-meta
    Target = zfs-utils
    Target = zfsbootmenu

    [Action]
    Description = Regenerating ZFSBootMenu after boot-stack changes...
    When = PostTransaction
    Exec = /usr/bin/generate-zbm
    EOF
    ```

    Expect the command to exit zero.

1. Check the required local-hook fields before a package transaction parses it:

    ```bash
    for required in \
      'Operation = Install' \
      'Operation = Upgrade' \
      'Type = Package' \
      'Target = linux-cachyos' \
      'Target = linux-cachyos-zfs' \
      'Target = zfs-meta' \
      'Target = zfs-utils' \
      'Target = zfsbootmenu' \
      'When = PostTransaction' \
      'Exec = /usr/bin/generate-zbm'; do
      sudo grep \
        --fixed-strings \
        --line-regexp \
        "$required" \
        /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook
    done
    ```

    Expect two operation lines,
    one type line,
    five target lines,
    one timing line,
    and one executable line.
    The first later pacman transaction is the actual parser check.

1. Enable monthly ZFS scrub scheduling:

    ```bash
    sudo systemctl enable --now zfs-scrub-monthly@zroot.timer
    ```

    Expect a symlink-creation message or successful enablement.

1. Confirm ZED is enabled and active:

    ```bash
    sudo systemctl enable --now zfs-zed.service
    ```

    Expect no error.

1. Record checksums of the locally copied pacman integration:

    ```bash
    sudo sha256sum \
      /etc/pacman-zfs-hooks.conf \
      /etc/pacman.d/hooks/zfs-post-cleanup.hook \
      /etc/pacman.d/hooks/zfs-pre-upgrade.hook \
      /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook \
      /usr/local/bin/pacman-zfs-post \
      /usr/local/bin/pacman-zfs-pre \
      /usr/local/lib/pacman-zfs-common.sh \
      | sudo tee /etc/pacman-zfs-integration.sha256
    ```

    Expect seven checksum lines.

1. Reboot and enter the ZFS passphrase:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu.

1. Select **`baseline`** and press **Enter**.
    Expect the factory baseline to boot.

1. Confirm the baseline dataset is running:

    ```bash
    sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    ```

    Expect exactly `zroot/ROOT/baseline`.

1. Reboot from the baseline environment:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu.

1. Select **`default`** and press **Enter**.
    Expect the hardened default environment to boot.

1. Confirm the default dataset is running:

    ```bash
    sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    ```

    Expect exactly `zroot/ROOT/default`.

### Reconnect and mount the protected data SSD

1. Shut down CachyOS:

   ```bash
   systemctl poweroff
   ```

   Expect complete power-off.

1. Switch off the power supply and disconnect AC power.
   Expect standby lights to turn off.

1. Press the case power button once with AC disconnected.
   Expect no boot and residual lights to extinguish.

1. Reconnect the SATA data and power cables to the Samsung SSD with serial `S596NE0N102120M`.
   Expect secure connections without moving the NVMe.

1. Close the case and reconnect AC power.
   Expect no cable near a fan.

1. Power on and boot **`default`** through ZFSBootMenu.
   Expect the normal CachyOS desktop.

1. Confirm both physical disks and their identities:

   ```bash
   lsblk \
     --bytes \
     --output NAME,PATH,SIZE,TYPE,FSTYPE,UUID,MODEL,SERIAL,TRAN
   ```

   Expect the SPCC NVMe and the Samsung SATA SSD.

1. Confirm the protected disk retains its LUKS UUID:

   ```bash
   sudo blkid \
     -s TYPE \
     -s UUID \
     /dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M
   ```

   Expect `TYPE="crypto_LUKS"` and UUID `d6709fe2-43cf-4b4f-b690-ac37bb470615`.

1. Unlock the protected disk:

   ```bash
   sudo cryptsetup open \
     /dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M \
     encrypted_data
   ```

   Expect a passphrase prompt and `/dev/mapper/encrypted_data`.

1. Create its mountpoint:

    ```bash
    sudo install --directory --mode=0755 /var/mnt/encrypted
    ```

    Expect the directory to exist.

1. Mount the protected Btrfs filesystem without changing it:

    ```bash
    sudo mount \
      --options noatime,compress=zstd:3 \
      /dev/mapper/encrypted_data \
      /var/mnt/encrypted
    ```

    Expect the command to exit zero.

1. Confirm the protected filesystem UUID:

    ```bash
    findmnt \
      --noheadings \
      --output SOURCE,TARGET,FSTYPE,UUID \
      /var/mnt/encrypted
    ```

    Expect UUID `01c308e7-06fa-4737-8a7b-3bb5fcba871d`.

1. Verify the system backup checksums again:

    ```bash
    cd /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs \
      && sha256sum --check system.sha256
    ```

    Expect every line to end in `OK`.

1. Verify the local home backup remains read-only:

    ```bash
    sudo btrfs property get \
      -t subvol \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final \
      ro
    ```

    Expect `ro=true`.

1. Preserve the pinned installer source on the installed root:

    ```bash
    sudo install \
      --directory \
      --mode=0755 \
      /usr/local/share/cachyos-zfs-installer-0.5.1 \
      && sudo bsdtar \
        --extract \
        --strip-components=1 \
        --file /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/cachyos-zfs-installer-9d587de2.tar.gz \
        --directory /usr/local/share/cachyos-zfs-installer-0.5.1
    ```

    Expect `bin/install` and `src/pacman-zfs` under the preserved source directory.

1. Add a no-automatic-unlock crypttab entry:

    ```bash
    printf '%s\n' \
      'encrypted_data UUID=d6709fe2-43cf-4b4f-b690-ac37bb470615 none noauto,luks' \
      | sudo tee -a /etc/crypttab
    ```

    Expect the exact line to print once.

1. Add a no-automatic-mount fstab entry:

    ```bash
    printf '%s\n' \
      'UUID=01c308e7-06fa-4737-8a7b-3bb5fcba871d /var/mnt/encrypted btrfs noauto,nofail,noatime,compress=zstd:3 0 0' \
      | sudo tee -a /etc/fstab
    ```

    Expect the exact line to print once.

1. Validate fstab without remounting:

    ```bash
    sudo findmnt --verify --verbose
    ```

    Expect `Success, no errors or warnings detected` or equivalent zero-error completion.

### Install and activate the physical labwc session

1. Update the complete system without performing a partial upgrade:

   ```bash
   sudo pacman --sync --refresh --sysupgrade
   ```

   Expect the pre-hook to create a boot environment and the transaction to finish successfully.

1. Confirm the ZFSBootMenu local hook ran if a targeted boot-stack package changed:

   ```bash
   sudo grep \
     --fixed-strings \
     "running 'zz-zfsbootmenu-regenerate.hook'" \
     /var/log/pacman.log \
     | tail --lines=1
   ```

   Expect a pacman log line containing `running 'zz-zfsbootmenu-regenerate.hook'` when a targeted package changed.
   No line is expected when none changed.
   Pacman hook descriptions are console output;
   they are not a reliable system-journal query.

1. Install the repository packages used by the physical session:

   ```bash
   sudo pacman \
     --sync \
     --needed \
     base-devel \
     git \
     jq \
     rsync \
     labwc \
     uwsm \
     xwayland-satellite \
     xorg-xwayland \
     xterm \
     fuzzel \
     foot \
     wlr-randr \
     swaync \
     cliphist \
     wl-clipboard \
     grim \
     slurp \
     swappy \
     swaylock \
     network-manager-applet \
     pavucontrol \
     python-evdev \
     inter-font \
     ttf-jetbrains-mono \
     dolphin \
     breeze \
     breeze-gtk \
     xdg-desktop-portal-wlr \
     xdg-desktop-portal-gtk \
     qt6-wayland \
     qt5-wayland \
     polkit-gnome \
     flatpak \
     fuse2
   ```

   Expect pacman to finish successfully.

1. Clone the reviewed sfwbar AUR recipe:

   ```bash
   git clone https://aur.archlinux.org/sfwbar.git /home/user/sfwbar-aur
   ```

   Expect a new Git checkout.

1. Check out the reviewed sfwbar recipe:

   ```bash
   git \
     -C /home/user/sfwbar-aur \
     checkout 46996951521a2b1d721382fa6db7164f25cbcd98
   ```

   Expect `HEAD is now at 4699695`.

1. Confirm the reviewed sfwbar checksum:

   ```bash
   grep \
     --fixed-strings \
     a4915bc7dd0873c45d0d6b01b070e39a91fd16cfadf730d6a9e48db68a8cd09e \
     /home/user/sfwbar-aur/PKGBUILD
   ```

   Expect one matching `sha256sums` line.

1. Build and install sfwbar as `user`:

   ```bash
   cd /home/user/sfwbar-aur \
     && makepkg --syncdeps --install --needed
   ```

   Expect the checksum check to pass and pacman to install `sfwbar-1.0_beta17-1`.

1. Restore the rehearsed labwc project directory:

   ```bash
   rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/labwc-vm-test/ \
     /home/user/labwc-vm-test/
   ```

   Expect rsync to exit zero.

1. Install the labwc configuration:

   ```bash
   install \
     --directory \
     /home/user/.config/labwc \
     && install \
       --mode=0644 \
       /home/user/labwc-vm-test/final-configs/rc.xml \
       /home/user/.config/labwc/rc.xml
   ```

   Expect `rc.xml`.

1. Install the labwc theme:

    ```bash
    install \
      --directory \
      /home/user/.local/share/themes/PureBlack/openbox-3 \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/themerc \
        /home/user/.local/share/themes/PureBlack/openbox-3/themerc
    ```

    Expect `themerc`.

1. Install the session helper executables:

    ```bash
    install \
      --directory \
      /home/user/.local/bin \
      && install \
        --mode=0755 \
        /home/user/labwc-vm-test/final-configs/fuzzel-toggle \
        /home/user/labwc-vm-test/final-configs/launch-feedback \
        /home/user/labwc-vm-test/final-configs/launch-new \
        /home/user/labwc-vm-test/final-configs/meta-tap-launcher \
        /home/user/labwc-vm-test/final-configs/panel-menu \
        /home/user/labwc-vm-test/final-configs/toggle-shortcut-guard \
        /home/user/labwc-vm-test/final-configs/wlr-pager \
        /home/user/.local/bin/
    ```

    Expect each helper to be executable.

1. Install sfwbar configuration:

    ```bash
    install \
      --directory \
      /home/user/.config/sfwbar \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/sfwbar.config \
        /home/user/labwc-vm-test/final-configs/cal.widget \
        /home/user/labwc-vm-test/final-configs/cell-focused.svg \
        /home/user/labwc-vm-test/final-configs/cell-normal.svg \
        /home/user/.config/sfwbar/
    ```

    Expect the four files under `.config/sfwbar`.

1. Install fuzzel configuration:

    ```bash
    install \
      --directory \
      /home/user/.config/fuzzel \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/fuzzel.ini \
        /home/user/.config/fuzzel/fuzzel.ini
    ```

    Expect `fuzzel.ini`.

1. Install swaync styling:

    ```bash
    install \
      --directory \
      /home/user/.config/swaync \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/swaync-style.css \
        /home/user/.config/swaync/style.css
    ```

    Expect `style.css`.

1. Append the GTK decoration overrides:

    ```bash
    install --directory /home/user/.config/gtk-3.0 /home/user/.config/gtk-4.0 \
      && cat /home/user/labwc-vm-test/final-configs/gtk3.css \
        >> /home/user/.config/gtk-3.0/gtk.css \
      && cat /home/user/labwc-vm-test/final-configs/gtk4.css \
        >> /home/user/.config/gtk-4.0/gtk.css
    ```

    Expect both CSS files to contain `border-radius: 0`.

1. Permit Flatpak GTK applications to read the theme overrides:

    ```bash
    flatpak override \
      --user \
      --filesystem=xdg-config/gtk-3.0:ro \
      --filesystem=xdg-config/gtk-4.0:ro
    ```

    Expect the command to exit zero.

1. Install the panel icon font:

    ```bash
    install \
      --directory \
      /home/user/.local/share/fonts \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/fonts/MaterialSymbolsOutlined.ttf \
        /home/user/.local/share/fonts/MaterialSymbolsOutlined.ttf \
      && fc-cache --force
    ```

    Expect `fc-cache` to exit zero.

1. Configure UWSM environment:

    ```bash
    install --directory /home/user/.config/uwsm \
      && cat > /home/user/.config/uwsm/env <<'EOF'
    # /home/user/.config/uwsm/env
    export QT_QPA_PLATFORMTHEME=kde
    export DISPLAY=:12
    export _JAVA_AWT_WM_NONREPARENTING=1
    export WLR_XWAYLAND=/nonexistent-xwayland-satellite-owns-x11
    export XCURSOR_THEME=breeze_cursors
    EOF
    ```

    Expect the file to contain `DISPLAY=:12`.

1. Install the xwayland-satellite override:

    ```bash
    install \
      --directory \
      /home/user/.config/systemd/user/xwayland-satellite.service.d \
      && install \
        --mode=0644 \
        /home/user/labwc-vm-test/final-configs/xwayland-satellite-override.conf \
        /home/user/.config/systemd/user/xwayland-satellite.service.d/override.conf
    ```

    Expect `ExecStart=/usr/bin/xwayland-satellite :12`.

1. Enable xwayland-satellite for graphical sessions:

    ```bash
    systemctl --user enable xwayland-satellite.service
    ```

    Expect a user-unit enablement symlink.

1. Create labwc autostart configuration:

    ```bash
    cat > /home/user/.config/labwc/autostart <<'EOF'
    # /home/user/.config/labwc/autostart
    uwsm app -t service -- sfwbar &
    uwsm app -t service -- swaync &
    uwsm app -t service -- wl-paste --type text --watch cliphist store &
    uwsm app -t service -- /home/user/.local/bin/meta-tap-launcher &
    uwsm app -t service -- nm-applet --indicator &
    uwsm app -t service -- /usr/lib/polkit-gnome/polkit-gnome-authentication-agent-1 &
    EOF
    ```

    Expect six `uwsm app` lines.

1. Add `user` to the input group:

    ```bash
    sudo usermod --append --groups input user
    ```

    Expect no error.

1. Change the login shell from CachyOS’s default fish to Bash:

    ```bash
    chsh --shell /usr/bin/bash
    ```

    Expect a password prompt followed by no error.

1. Reboot to apply group and login-shell changes:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu and then the installed console or login path.

1. Switch to tty2 with **Ctrl+Alt+F2**.
    Expect a text login prompt.

1. Log in as `user`.
    Expect a Bash prompt.

1. Start labwc manually through UWSM:

    ```bash
    uwsm start -- /usr/bin/labwc
    ```

    Expect the rehearsed black labwc desktop and sfwbar.

1. Repeat the pager,
    launcher,
    taskbar **New instance**,
    xwayland-satellite,
    and UWSM-unit checks from the VM phase.
    Expect the same observed behavior on the RX 7600 host.

1. Exit labwc through the panel’s **Log out** action.
    Expect tty2.

1. Create the tty1 autologin override:

    ```bash
    sudo install \
      --directory \
      /etc/systemd/system/getty@tty1.service.d \
      && sudo tee \
        /etc/systemd/system/getty@tty1.service.d/autologin.conf \
        > /dev/null <<'EOF'
    # /etc/systemd/system/getty@tty1.service.d/autologin.conf
    [Service]
    ExecStart=
    ExecStart=-/sbin/agetty --autologin user --noclear %I $TERM
    EOF
    ```

    Expect the command to exit zero.

1. Create the root-backed login snippet:

    ```bash
    sudo install \
      --directory \
      --mode=0755 \
      /etc/user-rollback/user \
      && sudo tee \
        /etc/user-rollback/user/start-labwc.sh \
        > /dev/null <<'EOF'
    # /etc/user-rollback/user/start-labwc.sh
    if uwsm check may-start; then
      exec uwsm start -- /usr/bin/labwc
    fi
    EOF
    ```

    Expect the command to exit zero.

1. Make the login snippet readable:

    ```bash
    sudo chmod 0644 /etc/user-rollback/user/start-labwc.sh
    ```

    Expect no error.

1. Add one marked source block to `.bash_profile`:

    ```bash
    cat >> /home/user/.bash_profile <<'EOF'
    # cachyos-zfs-labwc-start
    if test -r /etc/user-rollback/user/start-labwc.sh; then
      . /etc/user-rollback/user/start-labwc.sh
    fi
    # cachyos-zfs-labwc-end
    EOF
    ```

    Expect the two marker comments exactly once.

1. Disable the initial display manager only after the manual labwc test passed:

    ```bash
    sudo systemctl disable display-manager.service
    ```

    Expect removal of the display-manager enablement symlink.

1. Reload systemd configuration:

    ```bash
    sudo systemctl daemon-reload
    ```

    Expect no error.

1. Reboot into the display-manager-free session:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu,
    tty1 autologin,
    and automatic UWSM plus labwc startup.

1. Confirm no display manager is enabled:

    ```bash
    systemctl is-enabled display-manager.service || true
    ```

    Expect `disabled` or `not-found`.

### Tie selected session configuration to root rollback

1. Create root-backed configuration directories with user ownership:

   ```bash
   sudo install \
     --directory \
     --mode=0750 \
     --owner=user \
     --group=user \
     /etc/user-rollback/user/config \
     /etc/user-rollback/user/local-bin \
     /etc/user-rollback/user/systemd-user \
     /etc/user-rollback/user/themes
   ```

   Expect all directories to exist under `/etc/user-rollback/user`.

1. Copy selected session configuration into the current root environment:

   ```bash
   for name in labwc uwsm sfwbar fuzzel swaync; do
     sudo rsync \
       --archive \
       "/home/user/.config/$name/" \
       "/etc/user-rollback/user/config/$name/"
   done
   ```

   Expect each named directory under `/etc/user-rollback/user/config`.

1. Replace the selected persistent configuration directories with root-backed symlinks:

   ```bash
   for name in labwc uwsm sfwbar fuzzel swaync; do
     mv \
       "/home/user/.config/$name" \
       "/home/user/.config/$name.persistent-before-root-link"
     ln \
       --symbolic \
       "/etc/user-rollback/user/config/$name" \
       "/home/user/.config/$name"
   done
   ```

   Expect each selected `.config` path to be a symlink into `/etc/user-rollback/user/config`.

1. Copy selected session helpers into the current root environment:

   ```bash
   for name in \
     fuzzel-toggle \
     launch-feedback \
     launch-new \
     meta-tap-launcher \
     panel-menu \
     toggle-shortcut-guard \
     wlr-pager; do
     sudo install \
       --mode=0755 \
       --owner=user \
       --group=user \
       "/home/user/.local/bin/$name" \
       "/etc/user-rollback/user/local-bin/$name"
   done
   ```

   Expect seven executable files in `/etc/user-rollback/user/local-bin`.

1. Replace selected persistent helper files with root-backed symlinks:

   ```bash
   for name in \
     fuzzel-toggle \
     launch-feedback \
     launch-new \
     meta-tap-launcher \
     panel-menu \
     toggle-shortcut-guard \
     wlr-pager; do
     mv \
       "/home/user/.local/bin/$name" \
       "/home/user/.local/bin/$name.persistent-before-root-link"
     ln \
       --symbolic \
       "/etc/user-rollback/user/local-bin/$name" \
       "/home/user/.local/bin/$name"
   done
   ```

   Expect seven symlinks into `/etc/user-rollback/user/local-bin`.

1. Move the xwayland-satellite override into the root-backed configuration:

   ```bash
   sudo rsync \
     --archive \
     /home/user/.config/systemd/user/xwayland-satellite.service.d/ \
     /etc/user-rollback/user/systemd-user/xwayland-satellite.service.d/
   ```

   Expect `override.conf` under the root-backed path.

1. Replace the persistent xwayland-satellite override with a root-backed symlink:

   ```bash
   mv \
     /home/user/.config/systemd/user/xwayland-satellite.service.d \
     /home/user/.config/systemd/user/xwayland-satellite.service.d.persistent-before-root-link \
     && ln \
       --symbolic \
       /etc/user-rollback/user/systemd-user/xwayland-satellite.service.d \
       /home/user/.config/systemd/user/xwayland-satellite.service.d
   ```

   Expect the service drop-in path to be a symlink.

1. Move the PureBlack theme into the root-backed configuration:

   ```bash
   sudo rsync \
     --archive \
     /home/user/.local/share/themes/PureBlack/ \
     /etc/user-rollback/user/themes/PureBlack/
   ```

   Expect the root-backed `openbox-3/themerc`.

1. Replace the persistent PureBlack theme with a root-backed symlink:

   ```bash
   mv \
     /home/user/.local/share/themes/PureBlack \
     /home/user/.local/share/themes/PureBlack.persistent-before-root-link \
     && ln \
       --symbolic \
       /etc/user-rollback/user/themes/PureBlack \
       /home/user/.local/share/themes/PureBlack
   ```

   Expect `PureBlack` to be a symlink.

1. Reload the user manager:

    ```bash
    systemctl --user daemon-reload
    ```

    Expect no error.

1. Confirm every selected link resolves inside `/etc/user-rollback/user`:

    ```bash
    readlink --canonicalize \
      /home/user/.config/labwc \
      /home/user/.config/uwsm \
      /home/user/.config/sfwbar \
      /home/user/.config/fuzzel \
      /home/user/.config/swaync \
      /home/user/.local/bin/wlr-pager \
      /home/user/.local/share/themes/PureBlack
    ```

    Expect every output path to begin `/etc/user-rollback/user/`.

User documents,
media,
saves,
browser profiles,
Flatpak state,
and the rest of home remain under `zroot/data/home/user` and therefore stay current when a root environment is
selected.

### Restore applications and personal state

1. Unlock the protected SSD after the display-manager-free reboot:

   ```bash
   sudo cryptsetup open \
     /dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M \
     encrypted_data
   ```

   Expect one protected-disk passphrase prompt and `/dev/mapper/encrypted_data`.

1. Mount the protected SSD through the verified fstab entry:

   ```bash
   sudo mount /var/mnt/encrypted
   ```

   Expect no error.

1. Reconfirm the protected filesystem before reading migration files:

   ```bash
   findmnt \
     --noheadings \
     --output UUID,TARGET,FSTYPE \
     /var/mnt/encrypted
   ```

   Expect UUID `01c308e7-06fa-4737-8a7b-3bb5fcba871d`,
   target `/var/mnt/encrypted`,
   and filesystem type `btrfs`.

1. Restore the exact pCloud console-client executable and library from the verified system backup:

   ```bash
   sudo install \
     --mode=0755 \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/usr-local/bin/pcloudcc \
     /usr/local/bin/pcloudcc \
     && sudo install \
       --mode=0755 \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/usr-local/lib/libpcloudcc_lib.so \
       /usr/local/lib/libpcloudcc_lib.so
   ```

   Expect no error.

1. Verify the restored pCloud binaries against their pre-migration checksums:

   ```bash
   cd / \
     && sha256sum \
       --check \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/pcloud-binaries.sha256
   ```

   Expect both lines to end in `OK`.

1. Check that every pCloud runtime library resolves on CachyOS:

   ```bash
   ldd /usr/local/bin/pcloudcc \
     | tee /tmp/pcloudcc-ldd.txt \
     && ! grep --fixed-strings 'not found' /tmp/pcloudcc-ldd.txt \
     && echo 'pCloud runtime libraries: resolved'
   ```

   Expect exactly `pCloud runtime libraries: resolved` after the library list.

1. Restore pCloud configuration and its user service without printing account data:

   ```bash
   rsync \
     --archive \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.config/pcloud/ \
     /home/user/.config/pcloud/ \
     && install \
       --directory \
       /home/user/.config/systemd/user \
     && install \
       --mode=0600 \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.config/systemd/user/pcloud.service \
       /home/user/.config/systemd/user/pcloud.service
   ```

   Expect no error.
   Do not paste the service contents into diagnostics because it contains the account identifier.

1. Point pCloud’s state directory at the protected SSD and create its mountpoint:

   ```bash
   ln \
     --force \
     --no-dereference \
     --symbolic \
     /var/mnt/encrypted/pcloud \
     /home/user/.pcloud \
     && sudo install \
       --directory \
       --mode=0755 \
       /mnt/pcloud
   ```

   Expect `/home/user/.pcloud` to resolve to `/var/mnt/encrypted/pcloud`.

1. Start the restored pCloud service for the current boot without enabling a boot-time failure loop:

   ```bash
   systemctl --user daemon-reload \
     && systemctl --user disable pcloud.service \
     && systemctl --user start pcloud.service
   ```

   Expect `pcloud.service` to be active but disabled and `/mnt/pcloud` to be a FUSE mount.
   The protected disk uses deliberate manual unlock,
   so pCloud must not start before that mount exists.

1. Restore the same Kopia installation and repository configuration:

   ```bash
   install \
     --directory \
     /home/user/.local/share/mise/installs \
     /home/user/.config/kopia \
     && rsync \
       --archive \
       --acls \
       --xattrs \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.local/share/mise/installs/kopia/ \
       /home/user/.local/share/mise/installs/kopia/ \
     && rsync \
       --archive \
       --acls \
       --xattrs \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.config/kopia/ \
       /home/user/.config/kopia/
   ```

   Expect no error.

1. Confirm the restored pCloud mount:

   ```bash
   findmnt --target /mnt/pcloud/rclone --output SOURCE,TARGET,FSTYPE,OPTIONS
   ```

   Expect source `pCloud.fs`,
   filesystem type `fuse`,
   and a target resolving under `/mnt/pcloud`.

1. Confirm the restored Kopia repository connection:

   ```bash
   /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
     repository status --json \
     | jq -r '.storage.type, .storage.config.path'
   ```

   Expect exactly:

   ```text
   filesystem
   /mnt/pcloud/rclone
   ```

1. Exercise the idempotent protected-storage startup sequence used after each later boot:

   ```bash
   if ! sudo cryptsetup status encrypted_data > /dev/null 2>&1; then
     sudo cryptsetup open \
       /dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M \
       encrypted_data
   fi
   if ! mountpoint --quiet /var/mnt/encrypted; then
     sudo mount /var/mnt/encrypted
   fi
   systemctl --user start pcloud.service
   ```

   On the current boot,
   expect no additional passphrase because the disk is already open.
   After a fresh boot,
   expect one protected-disk passphrase prompt,
   `/var/mnt/encrypted`,
   `/mnt/pcloud`,
   and an active `pcloud.service`.

1. Add Flathub if it is absent:

   ```bash
   sudo flatpak remote-add \
     --if-not-exists \
     flathub \
     https://dl.flathub.org/repo/flathub.flatpakrepo
   ```

   Expect no error and `flatpak remotes` to list `flathub`.

1. Reinstall the recorded system Flatpaks:

   ```bash
   cut \
     --fields=1 \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/flatpak-apps.tsv \
     | xargs \
       --no-run-if-empty \
       sudo flatpak install \
       --system \
       --noninteractive \
       flathub
   ```

   Expect installed applications or explicit unavailable-application errors to review individually.
   Do not substitute unrelated applications for unavailable IDs.

1. Create the Flatpak per-user state parent before any application is launched:

   ```bash
   install --directory /home/user/.var/app
   ```

   Expect the directory to exist.

1. Restore Flatpak per-user state while Flatpak applications are closed:

   ```bash
   rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.var/app/ \
     /home/user/.var/app/
   ```

   Expect rsync to exit zero.

1. Restore SSH state with preserved permissions:

   ```bash
   rsync \
     --archive \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.ssh/ \
     /home/user/.ssh/
   ```

   Expect rsync to exit zero and private keys to remain mode `0600` or stricter.

1. Restore GnuPG state with preserved permissions:

   ```bash
   rsync \
     --archive \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.gnupg/ \
     /home/user/.gnupg/
   ```

   Expect rsync to exit zero and `.gnupg` to remain mode `0700`.

1. Restore the Monochromatic repository:

   ```bash
   rsync \
     --archive \
     --hard-links \
     --acls \
     --xattrs \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/Monochromatic/ \
     /home/user/Monochromatic/
   ```

   Expect the repository and `.git` directory.

1. Restore named personal top-level directories that should return to the NVMe home:

   ```bash
   for name in \
     'AppImages' \
     'Applications' \
     'Calibre Library' \
     'Desktop' \
     'Documents' \
     'Downloads' \
     'Games' \
     'Music' \
     'Pictures' \
     'Public' \
     'Seafile' \
     'Templates' \
     'Videos'; do
     if test -e "/var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/$name"; then
       rsync \
         --archive \
         --hard-links \
         --acls \
         --xattrs \
         "/var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/$name/" \
         "/home/user/$name/"
     fi
   done
   ```

   Expect each existing source directory to copy without error.

1. Review non-Flatpak application configuration without bulk-merging it into the new desktop:

   ```bash
   find \
     /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.config \
     -mindepth 1 \
     -maxdepth 1 \
     -printf '%f\n' \
     | sort
   ```

   Expect the complete old configuration inventory.
   Restore a named application directory only after installing and closing that application.
   Keep desktop-wide KDE,
   portal,
   systemd-user,
   GTK,
   labwc,
   UWSM,
   sfwbar,
   fuzzel,
   and swaync directories under the explicit migration steps rather than bulk-copying `.config`.

1. Install CachyOS’s gaming dependency set:

   ```bash
   sudo pacman --sync --needed cachyos-gaming-meta
   ```

   Expect pacman to finish successfully.

1. Install CachyOS’s native gaming applications if native Steam,
    Heroic,
    Lutris,
    Faugus,
    Gamescope,
    GOverlay,
    and MangoHud are wanted:

    ```bash
    sudo pacman --sync --needed cachyos-gaming-applications
    ```

    Expect pacman to list those applications before confirmation and finish successfully after confirmation.

1. Launch native **Steam** once so CachyOS creates its home-level compatibility paths.
   Expect the client updater or sign-in window.

1. Open Steam’s **Steam** menu and select **Exit**.
   Expect every Steam process to stop.

1. Restore Steam state while native Steam is closed:

   ```bash
   install --directory /home/user/.local/share/Steam \
     && rsync \
       --archive \
       --hard-links \
       --acls \
       --xattrs \
       /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/.local/share/Steam/ \
       /home/user/.local/share/Steam/
   ```

   Expect rsync to exit zero when the source exists.
   Do not copy the old `.steam` directory because its absolute links point through Bazzite’s `/var/home` layout.

1. Verify Steam’s primary compatibility link:

   ```bash
   readlink --canonicalize /home/user/.steam/root \
     | grep --line-regexp '/home/user/.local/share/Steam'
   ```

   Expect exactly `/home/user/.local/share/Steam`.

1. Create a post-migration home snapshot with delegated user permission:

    ```bash
    zfs snapshot zroot/data/home/user@post-migration
    ```

    Expect no permission error.

1. Confirm the named post-migration root target does not already exist:

    ```bash
    ! sudo zfs list zroot/ROOT/known-good >/dev/null 2>&1 \
      && ! sudo zfs list zroot/ROOT/default@known-good >/dev/null 2>&1 \
      && echo 'known-good names: unused'
    ```

    Expect exactly `known-good names: unused`.

1. Snapshot the configured default environment:

    ```bash
    sudo zfs snapshot zroot/ROOT/default@known-good
    ```

    Expect no error.

1. Clone the snapshot into a directly bootable known-good environment:

    ```bash
    sudo zfs clone \
      zroot/ROOT/default@known-good \
      zroot/ROOT/known-good
    ```

    Expect no error.

1. Set the known-good boot properties:

    ```bash
    sudo zfs set \
      canmount=noauto \
      mountpoint=/ \
      org.zfsbootmenu:active=on \
      'org.zfsbootmenu:description=Post-migration UWSM labwc known good' \
      "org.zfsbootmenu:kernel_version=$(uname -r)" \
      'org.zfsbootmenu:commandline=%{parent}' \
      zroot/ROOT/known-good
    ```

    Expect no error.

1. Reboot to exercise the known-good environment:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu to list `default`,
    `baseline`,
    `known-good`,
    and retained pre-transaction environments.

1. Select **`known-good`** and press **Enter**.
    Expect the display-manager-free UWSM plus labwc desktop with the selected root-backed configuration.

1. Confirm the known-good root:

    ```bash
    sudo zfs list -H -o name,mounted,mountpoint \
      | awk '$2=="yes" && $3=="/" {print $1}'
    ```

    Expect exactly `zroot/ROOT/known-good`.

1. Reboot from known-good:

    ```bash
    systemctl reboot
    ```

    Expect ZFSBootMenu.

1. Select **`default`** and press **Enter**.
    Expect the normal UWSM plus labwc desktop.

1. Unlock the protected SSD,
   mount it,
   and start pCloud after the final default boot:

   ```bash
   sudo cryptsetup open \
     /dev/disk/by-id/ata-Samsung_SSD_860_EVO_4TB_S596NE0N102120M \
     encrypted_data \
     && sudo mount /var/mnt/encrypted \
     && systemctl --user start pcloud.service
   ```

   Expect one protected-disk passphrase prompt,
   both protected mounts,
   and active pCloud.

1. Keep the read-only Bazzite home backup and authenticated installer media until the new system has completed normal
    updates,
    reboots,
    game launches,
    and application restores.
    Expect no backup deletion during initial adoption.

## What to check

Status:
TODO | DONE

Run the following checks from the physical `default` environment.

1. Verify the boot and encryption boundary:

   ```bash
   current_be="$(
     sudo zfs list -H -o name,mounted,mountpoint \
     | awk '$2=="yes" && $3=="/" {print $1}'
   )" \
     && encryption="$(sudo zfs get -H -o value encryption zroot)" \
     && keyformat="$(sudo zfs get -H -o value keyformat zroot)" \
     && test "$current_be" = 'zroot/ROOT/default' \
     && test "$encryption" = 'aes-256-gcm' \
     && test "$keyformat" = 'passphrase' \
     && echo 'boot and encryption boundary: verified'
   ```

   Expect exactly `boot and encryption boundary: verified`.

1. Verify the direct rollback targets and boot image:

   ```bash
   sudo zfs list \
     -H \
     -o name \
     zroot/ROOT/default \
     zroot/ROOT/baseline \
     zroot/ROOT/known-good \
     && test "$(
       sudo zfs get -H -o value org.zfsbootmenu:active zroot/ROOT/baseline
     )" = 'on' \
     && test "$(
       sudo zfs get -H -o value org.zfsbootmenu:active zroot/ROOT/known-good
     )" = 'on' \
     && sudo test -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos.EFI \
     && sudo test -f /boot/efi/EFI/ZFSBootMenu/vmlinuz-linux-cachyos-backup.EFI \
     && echo 'rollback targets and EFI images: verified'
   ```

   Expect exactly `rollback targets and EFI images: verified` after the three dataset names.

1. Verify pool health:

   ```bash
   sudo zpool status -x zroot
   ```

   Expect exactly:

   ```text
   pool 'zroot' is healthy
   ```

1. Verify scheduling and ZED:

   ```bash
   systemctl is-enabled zfs-scrub-monthly@zroot.timer \
     && systemctl is-active zfs-scrub-monthly@zroot.timer \
     && systemctl is-enabled zfs-zed.service \
     && systemctl is-active zfs-zed.service
   ```

   Expect four lines containing `enabled`,
   `active`,
   `enabled`,
   and `active` in that order.

1. Verify the local boot-stack hook and copied integration checksums:

   ```bash
   sudo test -f /etc/pacman.d/hooks/zz-zfsbootmenu-regenerate.hook \
     && sudo sha256sum --check /etc/pacman-zfs-integration.sha256
   ```

   Expect every checksum line to end in `OK`.

1. Audit origin snapshots no longer referenced by clones:

   ```bash
   sudo zfs get \
     -H \
     -r \
     -t snapshot \
     -o name,value \
     clones \
     zroot/ROOT \
     | awk '$1 ~ /@be-/ && $2 == "-" {print $1}'
   ```

   Expect no output on a new installation.
   If names appear after old boot-environment clones have been removed,
   review each name against `zfs list -t all -r zroot/ROOT` before destroying anything.

1. Verify the protected SSD remains outside `zroot`:

   ```bash
   sudo zpool status -P zroot \
     && findmnt --noheadings --output SOURCE,TARGET,FSTYPE,UUID /var/mnt/encrypted
   ```

   Expect only an NVMe member in `zroot` and Btrfs UUID `01c308e7-06fa-4737-8a7b-3bb5fcba871d` at
   `/var/mnt/encrypted`.

1. Verify protected-storage and pCloud manual-start state:

   ```bash
   mountpoint /var/mnt/encrypted \
     && mountpoint /mnt/pcloud \
     && test "$(systemctl --user is-active pcloud.service)" = 'active' \
     && test "$(
       systemctl --user is-enabled pcloud.service 2> /dev/null || true
     )" = 'disabled' \
     && echo 'protected storage and pCloud: verified'
   ```

   Expect both paths to report mountpoints,
   followed by `protected storage and pCloud: verified`.

1. Verify UWSM and xwayland-satellite:

   ```bash
   systemctl --user is-active wayland-wm@labwc.service \
     && systemctl --user is-active xwayland-satellite.service \
     && systemctl --user show-environment \
     | grep --fixed-strings 'DISPLAY=:12'
   ```

   Expect two `active` lines and `DISPLAY=:12`.

1. Verify app isolation:

   ```bash
   systemctl --user \
     --no-legend \
     --plain \
     list-units 'app-*.scope' 'app-*.service'
   ```

   Expect launched applications to occupy separate app units rather than the compositor unit.

1. Verify selected configuration follows root boot environments:

    ```bash
    readlink --canonicalize \
      /home/user/.config/labwc \
      /home/user/.config/uwsm \
      /home/user/.config/sfwbar \
      /home/user/.local/bin/wlr-pager \
      /home/user/.local/share/themes/PureBlack
    ```

    Expect every path to begin `/etc/user-rollback/user/`.

1. Verify ordinary personal state remains persistent:

    ```bash
    findmnt --noheadings --output SOURCE,TARGET,FSTYPE /home/user \
      && test ! -L /home/user/Documents \
      && echo 'persistent home boundary: verified'
    ```

    Expect `zroot/data/home/user` and `persistent home boundary: verified`.

1. Verify the RX 7600 driver:

    ```bash
    lspci -k \
      | grep \
        --after-context=3 \
        --extended-regexp 'VGA compatible controller.*(Navi 33|RX 7600)'
    ```

    Expect `Kernel driver in use: amdgpu`.

1. Verify Flatpak application inventory after restoration:

    ```bash
    flatpak list --app --columns=application | sort \
      > /tmp/cachyos-flatpaks.txt \
      && cut \
        --fields=1 \
        /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/system/flatpak-apps.tsv \
      | sort \
      > /tmp/bazzite-flatpaks.txt \
      && comm \
        -23 \
        /tmp/bazzite-flatpaks.txt \
        /tmp/cachyos-flatpaks.txt
    ```

    Expect no output for a complete Flatpak migration.
    Any printed application ID is a specific unresolved restore item.

1. Verify the migration backup remains readable:

    ```bash
    cmp \
      /home/user/Monochromatic/AGENTS.md \
      /var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final/Monochromatic/AGENTS.md \
      && echo 'local migration backup: readable'
    ```

    Expect exactly `local migration backup: readable`.

1. Verify the independent repository after migration when pCloud is mounted:

    ```bash
    /home/user/.local/share/mise/installs/kopia/latest/kopia-0.23.1-linux-x64/kopia \
      repository status --json \
      | jq -r '.storage.type, .storage.config.path'
    ```

    Expect `filesystem` and `/mnt/pcloud/rclone`.
    If the old mise-managed Kopia binary was not restored,
    install the same Kopia version and reconnect using the existing repository configuration without exposing its
    password.

## Restore

Status:
TODO | DONE

### Remove only the disposable validation state

1. Shut down the validation VM:

   ```bash
   flatpak run \
     --command=virsh \
     org.virt_manager.virt-manager \
     --connect qemu:///session \
     shutdown cachyos-zfs-validation
   ```

   Expect the domain to reach `shut off`.

1. Undefine the validation domain after physical migration succeeds:

   ```bash
   flatpak run \
     --command=virsh \
     org.virt_manager.virt-manager \
     --connect qemu:///session \
     undefine cachyos-zfs-validation \
     --nvram
   ```

   Expect confirmation that the domain was undefined.

1. Remove only the two named validation storage files:

   ```bash
   rm \
     --force \
     /home/user/cachyos-zfs-validation/disk.qcow2 \
     /home/user/cachyos-zfs-validation/labwc-configs.img \
     && rmdir /home/user/cachyos-zfs-validation
   ```

   Expect the directory to be removed if empty.

### Recover when the physical installer fails

1. Do not reconnect the 4 TB SSD during installer diagnosis.
   Expect the protected disk to remain physically isolated.

1. Reboot the CachyOS USB after any failed Calamares attempt.
   Expect a fresh live environment rather than reused mounts from the failed attempt.

1. Save the failed installer log to another USB or a network destination before another attempt:

   ```bash
   cp \
     /home/liveuser/calamares.install.log \
     /path/to/other-mounted-media/calamares.install.log
   ```

   Expect the copied file to be nonempty.
   Replace `/path/to/other-mounted-media` only with confirmed disposable media,
   never the installation target.

1. Inspect pools without importing them:

   ```bash
   sudo zpool import
   ```

   Expect either no `zroot` after an early failure or one exportable `zroot` after pool creation.

1. If a complete `zroot` exists but the EFI entry failed,
   import it with an alternate root:

   ```bash
   sudo zpool import -N -R /mnt zroot
   ```

   Expect `zroot` imported without mounting datasets.

1. Load the key from an interactive prompt:

   ```bash
   sudo zfs load-key -L prompt zroot
   ```

   Expect one ZFS passphrase prompt and no error.

1. Mount the pool datasets under the alternate root:

   ```bash
   sudo zfs mount zroot/ROOT/default \
     && sudo zfs mount -a
   ```

   Expect `/mnt` to contain the installed root.

1. Mount the ESP identified by `lsblk --fs` at the installed EFI path:

   ```bash
   sudo mount /dev/nvme0n1p1 /mnt/boot/efi
   ```

   Expect `/mnt/boot/efi/EFI`.
   Stop if partition 1 is not the FAT32 ESP on the SPCC NVMe.

1. Enter the installed system with the available chroot bridge:

   ```bash
   if command -v arch-chroot > /dev/null; then
     sudo arch-chroot /mnt
   else
     sudo mount --rbind /dev /mnt/dev
     sudo mount --make-rslave /mnt/dev
     sudo mount --types proc proc /mnt/proc
     sudo mount --rbind /sys /mnt/sys
     sudo mount --make-rslave /mnt/sys
     sudo mount --rbind /run /mnt/run
     sudo mount --make-rslave /mnt/run
     sudo chroot /mnt /bin/bash
   fi
   ```

   Expect a root prompt whose `/etc/os-release` names CachyOS.

1. Regenerate ZFSBootMenu from inside the chroot:

    ```bash
    generate-zbm
    ```

    Expect successful EFI image generation.

1. Recreate the firmware entry from inside the chroot:

    ```bash
    efibootmgr \
      --create \
      --disk /dev/nvme0n1 \
      --part 1 \
      --label ZFSBootMenu \
      --loader '\EFI\ZFSBootMenu\vmlinuz-linux-cachyos.EFI'
    ```

    Expect a new `ZFSBootMenu` boot number.
    If firmware does not choose it on the next boot,
    press **F12** and select **ZFSBootMenu** once.

1. Exit the chroot:

    ```bash
    exit
    ```

    Expect the live-environment prompt.

1. Remove any fallback chroot bind mounts that remain:

    ```bash
    for target in /mnt/run /mnt/sys /mnt/proc /mnt/dev; do
      if mountpoint --quiet "$target"; then
        sudo umount --recursive "$target"
      fi
    done
    ```

    Expect no busy-mount error.

1. Export the pool before reboot:

    ```bash
    sudo umount /mnt/boot/efi \
      && sudo zfs unmount -a \
      && sudo zpool export zroot
    ```

    Expect no busy-mount error.

1. Reboot and test ZFSBootMenu.
    Expect the passphrase prompt and environment list.

### Recover when labwc or tty1 startup fails

1. Switch to tty2 with **Ctrl+Alt+F2**.
   Expect a text login prompt independent of labwc.

1. Log in as `user`.
   Expect a Bash prompt.

1. Re-enable the initial display manager:

   ```bash
   sudo systemctl enable display-manager.service
   ```

   Expect a display-manager enablement symlink.

1. Remove the tty1 autologin override:

   ```bash
   sudo rm \
     --force \
     /etc/systemd/system/getty@tty1.service.d/autologin.conf
   ```

   Expect the file to be absent.

1. Remove only the marked labwc block from `.bash_profile`:

   ```bash
   python3 - <<'PY'
   # /home/user/.bash_profile
   from pathlib import Path

   path = Path('/home/user/.bash_profile')
   text = path.read_text()
   start = '# cachyos-zfs-labwc-start\n'
   end = '# cachyos-zfs-labwc-end\n'
   prefix, separator, tail = text.partition(start)
   if not separator:
       raise SystemExit('start marker not found')
   discarded, separator, suffix = tail.partition(end)
   if not separator:
       raise SystemExit('end marker not found')
   path.write_text(prefix + suffix)
   PY
   ```

   Expect exit status zero.

1. Reload systemd and reboot:

   ```bash
   sudo systemctl daemon-reload \
     && systemctl reboot
   ```

   Expect the installed console or login path without automatic labwc startup.

1. Keep the root-backed labwc files for diagnosis.
   Expect them to remain available without starting a graphical session.

### Return selected configuration to persistent home

1. Stop labwc and work from tty2.
   Expect no selected configuration file to be open for writing.

1. Remove a selected configuration symlink only after confirming its persistent backup exists:

   ```bash
   test -d /home/user/.config/labwc.persistent-before-root-link \
     && rm /home/user/.config/labwc \
     && mv \
       /home/user/.config/labwc.persistent-before-root-link \
       /home/user/.config/labwc
   ```

   Expect `.config/labwc` to be a normal directory.

1. Repeat the same explicit pattern for `uwsm`,
   `sfwbar`,
   `fuzzel`,
   and `swaync` only if uncoupling them from root rollback is intended.
   Expect each restored path to be a normal directory.

1. Restore helper files from their `.persistent-before-root-link` copies only after checking each copy.
   Expect each restored helper to be a normal executable file.

1. Do not delete `/etc/user-rollback/user` until every symlink into it has been removed:

   ```bash
   find /home/user \
     -type l \
     -lname '/etc/user-rollback/user/*' \
     -print
   ```

   Expect no output before deleting the root-backed directory.

### Return to Bazzite after the NVMe has been erased

There is no instantaneous in-place rollback after the SPCC NVMe is erased.
Returning to Bazzite means reinstalling Bazzite on the NVMe and restoring user data from the migration backup.
The 4 TB SSD must remain disconnected during that reinstall for the same reason it was disconnected for CachyOS.

1. Download the current Bazzite desktop AMD image from
   `https://bazzite.gg/#image-picker` on another working system.
   Expect the image picker to identify desktop hardware,
   AMD graphics,
   and KDE if reproducing the former environment.

1. Authenticate the Bazzite image using the checksum and verification instructions supplied by the image picker.
   Expect the downloaded image to pass before writing it.

1. Write the authenticated Bazzite image with Fedora Media Writer’s **Select .iso file** workflow.
   Expect **Finished!**
   and successful written-data verification.

1. Disconnect the Samsung 4 TB SSD before the Bazzite installation.
   Expect only the SPCC NVMe and installer USB in the installer disk list.

1. Follow Bazzite’s current official installation guide at
   `https://docs.bazzite.gg/General/Installation_Guide/install-guide/`.
   Expect a bootable encrypted Bazzite installation on the SPCC NVMe.

1. Reconnect and unlock the Samsung SSD only after Bazzite boots successfully.
   Expect the preserved Btrfs UUID `01c308e7-06fa-4737-8a7b-3bb5fcba871d`.

1. Restore `/var/home/user` from
   `/var/mnt/encrypted/Migration/bazzite-to-cachyos-zfs/home-final` with the same rsync metadata flags used in the
   backup phase.
   Expect the checksum dry run to report no difference after restoration.

1. Keep the CachyOS ZFS qcow2 VM until Bazzite restoration and required files are verified.
   Expect an independent bootable record of the selected architecture even after returning to Bazzite.

[package-rollback-diagnosis]: ../troubleshooting/cachyos-zfs-boot-environment-pacman-state.md
