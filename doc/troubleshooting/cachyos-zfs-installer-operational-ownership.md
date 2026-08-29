# cachyos-zfs-installer 0.5.1 automates routine work but leaves local integration ownership

## Symptom

The source-only migration audit rated CachyOS with ZFS plus ZFSBootMenu at 1.5 out of 4 for operational burden.
That can sound as if normal use requires frequent manual ZFS commands.
The installer documentation instead says post-installation configuration is automatic and package hooks manage boot
environments.

Routine operation is substantially automated.
The burden appears when the copied integration needs updates,
retention must be verified,
a ZFSBootMenu image becomes stale,
or recovery crosses the out-of-tree ZFS boundary.

## Root cause

### Routine package updates are automated

The installer adds pacman pre- and post-transaction hooks.
The pre-hook creates a snapshot and clone before package changes and aborts the transaction if creation fails.
The post-hook retains 24 boot-environment datasets by default,
regenerates ZFSBootMenu under a condition,
and verifies the expected EFI image and kernel locations.

The source is:

- `src/pacman-zfs/usr/local/bin/pacman-zfs-pre:139-181`;
- `src/pacman-zfs/usr/local/bin/pacman-zfs-post:24-143`;
- `src/pacman-zfs/etc/pacman-zfs-hooks.conf:1-8`.

CachyOS also publishes `linux-cachyos-zfs` with an exact dependency on its matching kernel and a `ZFS-MODULE`
provider.
The package record is
<https://packages.cachyos.org/package/cachyos/x86_64/linux-cachyos-zfs>.
This avoids requiring the user to compile a DKMS module for the supported kernel.
It trades that work for version locking:
a kernel update must wait for the exact matching module package.
Whether CachyOS publishes both together in every future transaction was not measured.

ZFSBootMenu uses a stable EFI filename and keeps one backup image because the installer sets `EFI.Versions: false` in
`src/calamares/etc/calamares/scripts/zfsbootmenu_config.yaml:10-18`.
The shipped `generate-zbm` 3.1.0 script confirms the behavior at `bin/generate-zbm:395-398`:

```perl
my $efi_backup = sprintf( "%s-backup.EFI", $efi_prefix );
if ( -f $efi_target and rename( $efi_target, $efi_backup ) ) {
  printf "Created backup %s -> %s\n", $efi_target, $efi_backup;
```

The firmware entry therefore does not need to be rewritten after every generated image.

These are reductions in operational burden and make the original 1.5 rating too low if interpreted as routine manual
work alone.
The third-party integration risk that originally contributed to 1.5 is scored separately under installer integration;
keeping the operations rating at 1.5 would count part of that evidence twice.

### Debug evidence remains active until Calamares closes

The instrumented patched-layout installation launched Calamares through a `tee` pipeline writing to removable evidence
media.
The **All done** page reported successful installation,
but Calamares and `tee` remained active until **Done** closed the installer.
`fuser -vm /mnt/zfs-evidence` identified the active `tee` process when an early unmount failed with
`target is busy`.
After selecting **Done**,
both processes exited,
the evidence disk unmounted cleanly,
and the VM powered off.

The measured full Calamares log was
`/home/liveuser/.cache/calamares/session.log`,
not `/var/log/Calamares.log`.
Evidence procedures must copy that file before closing the live environment,
select **Done**,
confirm Calamares and `tee` exited,
then unmount the evidence medium.

### The factory baseline is created but hidden

`src/calamares/etc/calamares/scripts/create-baseline-boot-env.sh:30-36` creates
`zroot/ROOT/baseline` and then sets:

```bash
zfs set \
  org.zfsbootmenu:active=off \
  "$baseline_boot_env"
```

ZFSBootMenu 3.1.0 documents `org.zfsbootmenu:active=off` as hiding an environment whose mountpoint is `/`.
The relevant implementation is `zfsbootmenu/lib/zfsbootmenu-ui.sh:591-603`.
This conflicts with the installer README’s instruction to select `baseline` from ZFSBootMenu.

The source-level remediation is:

```bash
sudo zfs set org.zfsbootmenu:active=on zroot/ROOT/baseline
```

This property change is included in the adoption runbook but has not been executed in a consumer installation.
Pacman-created `be-*` environments do not receive `active=off` and remain candidates through their `/` mountpoint.

### Installed integration files have no package owner or update channel

`src/calamares/etc/calamares/scripts/install-pacman-zfs.sh:13-33` copies configuration and hooks directly into `/etc`
and scripts into `/usr/local/bin` and `/usr/local/lib`:

```bash
install --verbose --mode=755 \
  /tmp/pacman-zfs/usr/local/bin/pacman-zfs-post \
  /usr/local/bin/
install --verbose --mode=755 \
  /tmp/pacman-zfs/usr/local/bin/pacman-zfs-pre \
  /usr/local/bin/

install --verbose --mode=755 \
  /tmp/pacman-zfs/usr/local/lib/pacman-zfs-common.sh \
  /usr/local/lib/
```

No package manifest owns these files,
and the repository contains no installed updater for them.
A later fix to the third-party installer does not automatically reach an already installed system.
The user or a locally maintained package therefore owns integration drift after installation.

### Retention counts clones but not their origin snapshots

The pre-hook creates both an origin snapshot and a cloned boot environment.
`src/pacman-zfs/usr/local/bin/pacman-zfs-pre:147-159` contains:

```bash
snapshot_name="${ZFS_ROOT_POOL}/${current_be}@${be_name}"
...
zfs snapshot "$snapshot_name" \
  || abort_transaction "Failed to create snapshot: $snapshot_name"

zfs clone "$snapshot_name" "$full_be_path" \
  || abort_transaction "Failed to clone snapshot to: $full_be_path"
```

The package hook targets every package transaction,
not only kernel or ZFS changes:
`src/pacman-zfs/etc/pacman.d/hooks/zfs-pre-upgrade.hook:1-7` sets `Target = *`.

The post-hook lists only filesystems and destroys old `be-*` clone datasets.
`src/pacman-zfs/usr/local/bin/pacman-zfs-post:24-63` contains:

```bash
zfs list \
  -r \
  -H \
  -o name \
  -s creation \
  -t filesystem \
  "${ZFS_ROOT_POOL}" 2>/dev/null \
  | grep "/be-"
...
zfs destroy -r "$boot_env"
```

It never lists or destroys the correspondingly named origin snapshots.
OpenZFS documents that `zfs destroy -r filesystem` destroys that dataset and its children;
origin snapshots are separate objects:
<https://openzfs.github.io/openzfs-docs/man/master/8/zfs-destroy.8.html>.

The documented 24-environment retention limit therefore does not bound all generated snapshot objects.
This is a source-level retention gap.
Its disk-space effect was not measured because no installation was run.

### ZFSBootMenu regeneration is conditional and its packaged hook is inactive

The post-hook runs `generate-zbm` only after it deleted a boot environment or when `ALWAYS_REGENERATE=true`.
The shipped `/etc/pacman-zfs-hooks.conf` does not name `ALWAYS_REGENERATE`,
so that override is not discoverable from the installed configuration template.
`src/pacman-zfs/usr/local/bin/pacman-zfs-post:95-105` contains:

```bash
if [[ "$boot_envs_deleted" -gt 0 ]] || [[ "${ALWAYS_REGENERATE:-false}" == "true" ]]; then
  if command -v generate-zbm >/dev/null 2>&1; then
    echo "Regenerating ZFSBootMenu..."
    if generate-zbm; then
```

CachyOS’s `zfsbootmenu` package includes a sample pacman hook for ZFS-module upgrades,
but its PKGBUILD installs that hook under `/usr/share/doc/zfsbootmenu/hooks/`,
not an active pacman-hook directory.
The hook also targets `zfs-linux*`,
while the inspected CachyOS module package is named `linux-cachyos-zfs` and provides `ZFS-MODULE`.
Neither the package name nor that provider matches the sample target.
The sample hook also omits `zfsbootmenu` and `zfs-utils` upgrades.
The source is
`zfsbootmenu/PKGBUILD:12-20` and `zfsbootmenu/99-zfsbootmenu.hook:1-10` in CachyOS `cachyos-aur-derived`
commit `e5dffe949a0071432afc849abe328d5cfde5743f`.

The published package `zfsbootmenu-3.1.0-1-x86_64.pkg.tar.zst`,
SHA-256 `314e1086e369d778842e8bf93442c840b8f7778fc649dfc48059ed4e97271a3e`,
was listed with `bsdtar`.
It contains the hook only at `usr/share/doc/zfsbootmenu/hooks/99-zfsbootmenu.hook`.

An operator must therefore ensure that ZFSBootMenu is regenerated after relevant module,
userspace,
or bootloader changes,
or install an active hook that matches the actual package names.
The current source does not prove that every relevant update path performs that regeneration.
Its fallback recomputes `boot_envs_deleted` from remaining clone counts because the deletion loop runs in a pipeline
subshell.
That couples image refresh to approximate cleanup bookkeeping rather than to the packages that changed.

### Health monitoring requires selecting a scrub schedule

The checksum-verified CachyOS `zfs-utils-2.4.3-2` package,
SHA-256 `76ca7eeecae9dcab9b253a4476b4ed26a11377d13ead11ec90764f44da012675`,
ships ZED,
weekly and monthly scrub timers,
and weekly and monthly trim timers.
Its systemd preset enables ZED but does not enable a scrub or trim timer.
The installer sets `autotrim=on`,
so an additional trim timer is not required for its proposed pool.
An operator still needs to choose and enable a scrub schedule or deliberately accept no periodic scrub.

### Pool-feature and recovery compatibility require deliberate handling

OpenZFS feature activation is one-way.
Its current documentation warns that a newly active feature can prevent an older kernel,
rescue image,
or bootloader from importing the pool:
<https://openzfs.github.io/openzfs-docs/Basic%20Concepts/Pool%20Structure/Feature%20Flags.html>.

This does not require routine tuning.
It requires avoiding reflexive `zpool upgrade` and ensuring the ZFSBootMenu or rescue environment supports active pool
features before enabling them.

ZFSBootMenu offsets recovery burden by providing an embedded recovery shell,
`zfs-chroot`,
`zkexec`,
snapshot management,
and pool-health views:
<https://docs.zfsbootmenu.org/en/latest/online/recovery-shell.html>.
If the EFI image itself is unusable,
however,
recovery media must contain compatible ZFS tooling and modules.

## Verification

### Versions and artifacts

- Third-party installer:
  commit `9d587de2d34a35ea33094735002d8599afed7eac`,
  version 0.5.1,
  clone `/var/home/user/temp/agent/cachyos-zfs-installer-20260829`.
- CachyOS ZFSBootMenu packaging:
  commit `e5dffe949a0071432afc849abe328d5cfde5743f`,
  clone `/var/home/user/temp/agent/cachyos-aur-derived-20260829`.
- ZFSBootMenu package:
  version 3.1.0-1,
  SHA-256 `314e1086e369d778842e8bf93442c840b8f7778fc649dfc48059ed4e97271a3e`.
- ZFS utilities package:
  version 2.4.3-2,
  SHA-256 `76ca7eeecae9dcab9b253a4476b4ed26a11377d13ead11ec90764f44da012675`.
- Host limitation:
  no ZFS kernel module or tools are installed,
  so package hooks and boot recovery were not executed.

### Source-ownership harness

The following read-only harness checks the integration boundaries:

```python
from pathlib import Path

root = Path("/var/home/user/temp/agent/cachyos-zfs-installer-20260829")
pre_hook = (
    root / "src/pacman-zfs/etc/pacman.d/hooks/zfs-pre-upgrade.hook"
).read_text()
pre = (
    root / "src/pacman-zfs/usr/local/bin/pacman-zfs-pre"
).read_text()
post = (
    root / "src/pacman-zfs/usr/local/bin/pacman-zfs-post"
).read_text()
install = (
    root / "src/calamares/etc/calamares/scripts/install-pacman-zfs.sh"
).read_text()
baseline = (
    root / "src/calamares/etc/calamares/scripts/create-baseline-boot-env.sh"
).read_text()
pkgroot = Path(
    "/var/home/user/temp/agent/cachyos-aur-derived-20260829/zfsbootmenu"
)
pkgbuild = (pkgroot / "PKGBUILD").read_text()
sample_hook = (pkgroot / "99-zfsbootmenu.hook").read_text()

checks = {
    "every package transaction triggers pre-hook": "Target = *" in pre_hook,
    "installer hides factory baseline":
        "org.zfsbootmenu:active=off" in baseline,
    "pre-hook creates snapshot and clone":
        'zfs snapshot "$snapshot_name"' in pre
        and 'zfs clone "$snapshot_name" "$full_be_path"' in pre,
    "cleanup lists filesystems only": "-t filesystem" in post,
    "cleanup destroys boot environment datasets":
        'zfs destroy -r "$boot_env"' in post,
    "cleanup never names origin snapshots for deletion":
        'zfs destroy "$snapshot_name"' not in post and '@${be_name}' not in post,
    "image regeneration is conditional":
        '[[ "$boot_envs_deleted" -gt 0 ]]' in post,
    "integration scripts install as local files":
        "/usr/local/bin/" in install and "/usr/local/lib/" in install,
    "packaged regeneration hook is documentation only":
        "/usr/share/doc/$pkgname/hooks/99-zfsbootmenu.hook" in pkgbuild,
    "sample hook targets other ZFS package names":
        "Target = zfs-linux*" in sample_hook,
}

for name, passed in checks.items():
    print(f'{name}: {"CONFIRMED" if passed else "NOT_FOUND"}')

if not all(checks.values()):
    raise SystemExit(1)
```

Every check printed `CONFIRMED`,
and the harness exited zero.
The result establishes source behavior,
not its unmeasured runtime impact.

### Behavior catalog

Automatically handled:

- pre-transaction boot-environment creation;
- package-transaction refusal when snapshot creation fails;
- clone-dataset retention;
- static ZFSBootMenu EFI path with one backup image;
- exact-version ZFS module packaging for the supported CachyOS kernel;
- ZED enabled through the package preset;
- available scrub and trim timer units;
- one passphrase prompt on normal encrypted boots.

Operator-owned or unresolved:

- changing the installer-created baseline from hidden to directly selectable;
- updates to copied `/usr/local` integration scripts;
- checking origin-snapshot accumulation and actual space use;
- ensuring ZFSBootMenu regeneration after relevant upgrades;
- deliberate pool-feature activation;
- ZFS-capable recovery when the EFI image cannot start;
- kernel updates within versions that have matching ZFS modules;
- selecting and enabling a periodic scrub timer.

## Verified workarounds

No runtime workaround is verified because the candidate was not installed.
Source-supported controls are:

- package the `/usr/local` scripts and hook files locally so upgrades and ownership are explicit;
- install an active pacman hook that regenerates ZFSBootMenu for actual CachyOS ZFS and ZFSBootMenu package names;
- list both filesystems and snapshots when auditing retention;
- run `generate-zbm` deliberately after relevant updates and confirm both primary and backup EFI images;
- leave pool features disabled until every intended boot and rescue environment supports them.

Each adds local configuration ownership.
Automatic package delivery would be preferable to maintaining these controls manually.

## What does not work

- Assuming the installer-created baseline is listed while it has `org.zfsbootmenu:active=off`.
- Treating the 24 cloned boot environments as a bound on all origin snapshots.
- Assuming files copied to `/usr/local` receive fixes when the GitHub installer changes.
- Assuming the sample `99-zfsbootmenu.hook` is active from its `/usr/share/doc` location.
- Running `zpool upgrade` merely because `zpool status` advertises new features.
- Treating an exact-version module package as support for every CachyOS kernel variant.
- Treating the unexecuted source concerns as proof that a current installation necessarily fails.

## Upstream filing decision

No `.out-of-scope/` entry covers the installer.
Searches of issues and pull requests found no report matching origin-snapshot retention or conditional ZFSBootMenu
regeneration.
Existing issue <https://github.com/fnichol/cachyos-zfs-installer/issues/1> concerns an installation
and UEFI-entry failure,
not these paths.

1. **Is it upstream’s fault?**
   Not yet established at the consumer boundary.
   Current source exposes retention and regeneration gaps,
   but no installed-system failure was reproduced.
1. **Can upstream fix it?**
   Yes if runtime validation confirms the source-level gaps.
   The installer can package its integration,
   delete eligible origin snapshots,
   and install a package-name-correct regeneration hook.
1. **Are they supporting this use case?**
   Yes.
   The README and `docs/zfs-be-hooks-readme.md` promise automatic retention and boot-menu updates.
1. **Would the repository welcome a contribution?**
   The README invites issues and pull requests and states no AI-specific prohibition.
1. **Will they likely fix it?**
   No refusal signal was found,
   but the repository has one maintainer and sparse tracker history.
1. **Has a minimal fix been prototyped?**
   No.
   The candidate-fix applicability gate is not met because no current installation reproduced either concern.

Do not file or post upstream from this source-only audit.
