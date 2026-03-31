# Portable VM dev environment

Declarative, immutable, rebuildable VM image for development.
Built on ucore-hci (Fedora CoreOS + libvirt/KVM/ZFS/cockpit/podman)
with KDE Plasma layered on top via a custom Containerfile.

## Architecture

```
ucore-hci (immutable, rpm-ostree, Fedora CoreOS base)
  + KDE Plasma, SDDM (baked into custom image)
  + system dev packages (baked into custom image)
  + ghostty RPM via scottames/ghostty COPR (baked into custom image)
  + mise (baked, /usr/local/bin)
  + user account (baked)
  |
  + mise toolchains (first-login, ~/. local/share/mise/)
  + dotfiles (first-login, ~/.config/)
  + librewolf RPM via LibreWolf repo (baked into custom image)
  + secrets (manual, gh auth login / SSH keys)
```

Two artifacts define the entire environment:

1.  **Custom container image** (Containerfile + build.sh) -- OS layer, rarely changes
2.  **First-login provisioner** (file-enforcer config in this monorepo) -- user layer, changes often

## Decisions made

- **Base image**: `ghcr.io/ublue-os/ucore-hci:stable` -- well-documented,
  has its own GitHub repo, includes HCI stack (libvirt, KVM, ZFS, cockpit, podman)
- **Not Bazzite**: too much gaming bloat for a dev VM
- **Not Fedora Kinoite**: poor documentation, no dedicated repo, includes unwanted defaults
- **Not openSUSE Kalpa**: alpha status, single maintainer, officially unmaintained
- **Not Alpine**: no transactional package management (`apk add` mutates root directly)
- **Not mutable distro**: immutability provides defense-in-depth against config drift,
  even on short-lived VMs
- **KDE layered on server base**: add only what we need rather than subtract what we don't
- **Custom image (not rpm-ostree layering at boot)**: faster VM startup,
  reproducible, KDE is part of the base not a fragile layer
- **Dotfiles baked into image**: `packages/config/dotfiles/` package with subdirectories
  (ghostty, mise). COPYed into `~/.config/` at image build time via widened build context.
  Only two configs needed; a separate repo and provisioner step are overkill.
- **KDE config not portable**: let KDE regenerate defaults on each VM,
  machine-specific state (display IDs, GPU paths, monitor geometry) causes more breakage than it prevents
- **No cloud-init**: everything is baked into the image or handled by the first-login provisioner
- **Secrets stay manual**: `gh auth login` and SSH key setup after provisioning,
  no encrypted vaults or automation for secrets
- **Provisioner lives in this monorepo**: versioned alongside the rest of the dev tooling,
  uses file-enforcer primitives (`exec`, `overwrite`, `cat`)
- **Provisioner triggered manually**: run `setup-dev` once after first login,
  no systemd user services or `.bash_profile` hacks
- **Host-level FDE only**: rely on host OS full-disk encryption (BitLocker on Windows,
  LUKS on Linux host) rather than per-image encryption.
  ZFS native encryption is not supported at any layer (osbuild, bootc, bootc-image-builder).
  btrfs-on-LUKS2 through bootc-image-builder is blocked (blueprint schema doesn't expose LUKS;
  bootc's `tpm2-luks` has an open deadlock bug bootc-dev/bootc#2089).
  QEMU LUKS-encrypted qcow2 works but VHDX has no format-level encryption equivalent
  (MS-VHDX spec has zero cipher/key fields), breaking vmsync cross-platform parity.
- **plasma-workspace meta-package**: full KDE desktop set rather than minimal plasma-desktop,
  since ucore-hci is a server base with no desktop components
- **Provisioner in vm-builder**: `src/provision.ts` alongside `build-and-import.ts`,
  not a separate package -- the provisioner is small enough to colocate
- **Nvim deprecated by editord**: no nvim config clone needed in the provisioner
- **Skip Ignition/Butane**: everything is baked into the image or handled by the provisioner;
  Ignition adds no value beyond what the Containerfile already provides
- **Cosign key for future use**: set up cosign even though builds are local-only,
  in case images need to be pushed to GHCR later

## Phase 1: custom container image

### Containerfile

Based on [ublue-os/image-template][image-template] pattern.
Uses `ghcr.io/ublue-os/ucore-hci:stable` as base.

Lives at `packages/dev-script/vm-builder/` in this monorepo.
Run via: `mise run //packages/dev-script/vm-builder:run`

[image-template]: https://github.com/ublue-os/image-template

- [x] Create package at `packages/dev-script/vm-builder/` in this monorepo
- [ ] Write Containerfile with multi-stage build (scratch context + ucore-hci base)
- [ ] Fill in `build-and-import.ts` system package list (stub currently)

### System packages to bake in (build.sh)

KDE Plasma desktop (full `plasma-workspace` meta-package):
- [ ] `plasma-workspace` -- full Plasma desktop (includes plasma-desktop, plasma-nm, plasma-pa, bluedevil, etc.)
- [ ] `sddm` -- display manager (+ `systemctl enable sddm`)
- [ ] `konsole` -- fallback terminal (KDE default)
- [ ] `dolphin` -- file manager (KDE default)
- [ ] `virt-manager` -- desktop GUI for libvirt/KVM (pairs with ucore-hci HCI stack)

Browser + password manager (both must be native RPM for KeePassXC browser integration):
- [ ] Add LibreWolf repo: `dnf config-manager addrepo --from-repofile=https://rpm.librewolf.net/librewolf-repo.repo`
- [ ] `librewolf`
- [ ] `keepassxc`

Terminal:
- [ ] Add scottames/ghostty COPR:
  ```
  . /etc/os-release
  curl -fsSL "https://copr.fedorainfracloud.org/coprs/scottames/ghostty/repo/fedora-${VERSION_ID}/scottames-ghostty-fedora-${VERSION_ID}.repo" \
    | tee /etc/yum.repos.d/_copr:copr.fedorainfracloud.org:scottames:ghostty.repo > /dev/null
  ```
- [ ] `ghostty`

Dev tools (system-level, mise handles the rest):
- [ ] `helix`
- [ ] `strace`
- [ ] `inotify-tools`
- [ ] `python3-devel`
- [ ] `potrace`
- [ ] `msitools`

Infrastructure:
- [ ] `mise` installed as user `user` at `~/.local/bin/mise`
- [ ] User account `user` with password, `wheel` group, passwordless sudo
- [ ] User mise config at `~/.config/mise/config.toml`
  so `mise install` works immediately on first login

### Build and convert

- [ ] Fill in Containerfile, then verify `mise run //packages/dev-script/vm-builder:run` succeeds end-to-end
- [x] Write `disk_config/disk.toml` (40 GiB root; ZFS encryption TODO pending bootc-image-builder support)
- [ ] Boot the qcow2, verify KDE starts, SDDM login works, podman runs, libvirt works

### Full-disk encryption -- decided: host-level FDE

**Decision:** rely on host OS full-disk encryption instead of per-image encryption.

Research findings (March 2026):
- **ZFS native encryption**: not supported at any layer.
  osbuild has zero ZFS stages (`mkfs` stages: ext4, xfs, btrfs, fat only).
  bootc's `Filesystem` enum has three variants: Xfs, Ext4, Btrfs.
  ucore-hci excludes ZFS from the initramfs; ZFS is runtime-only for `/var` mounts.
  Open issue bootc-dev/bootc#1240 documents the failure.
- **btrfs-on-LUKS2**: osbuild has `org.osbuild.luks2.format` stages internally,
  but the blueprint config.toml schema does not expose LUKS as a partition type.
  bootc's `--block-setup tpm2-luks` has a semaphore deadlock bug (bootc-dev/bootc#2089).
- **QEMU LUKS-encrypted qcow2**: works (supported since QEMU 2.10, XTS-AES-256),
  but VHDX has no format-level encryption (MS-VHDX spec rev 8.0 has zero cipher fields).
  Microsoft's Shielded VMs use guest-side BitLocker, not VHDX encryption.
  This breaks vmsync's cross-platform sync parity.

- [x] ~~Determine if bootc-image-builder supports ZFS pool encryption~~ -- no, not at any layer
- [x] ~~Evaluate alternatives~~ -- host-level FDE chosen over per-image encryption

### Ignition/Butane config -- decided: skip

Ignition adds no value beyond what the Containerfile already provides.
The user account is baked in, and SSH keys are handled manually post-boot.

- [x] ~~Decide if Ignition adds value~~ -- no, skipped

## Phase 2: first-login provisioner

Lives in `packages/dev-script/vm-builder/src/provision.ts` alongside `build-and-import.ts`.
Run via: `mise run //packages/dev-script/vm-builder:provision`
Uses file-enforcer primitives: `exec()`, `overwrite()`, `overwriteEach()`, `cat()`.

### Dotfiles package

Lives at `packages/config/dotfiles/` in this monorepo.
Only two configs needed: ghostty and mise.

- [ ] Create `packages/config/dotfiles/` with:
  - `ghostty/config`
  - `mise/config.toml` (global mise config)
- [x] ~~Archive `Aquaticat/nvim`~~ -- nvim is deprecated by editord in the monorepo
- [x] ~~Decide which `~/.config/` directories to include~~ -- only ghostty and mise

### Provisioner script tasks

Runs as user after first login. Idempotent (safe to re-run).

- [ ] Copy dotfiles from `packages/config/dotfiles/` into `~/.config/` via `overwriteEach()`
- [ ] Run `mise install` via `exec()` (installs all tools from global config)
- [ ] Install flatpaks via `flatpak install --user -y`:
  Flatseal, Fastmail, Gear Lever, KColorChooser, KeePassXC,
  Nextcloud, OBS, RustDesk, Ungoogled Chromium

### Provisioner trigger sequence

```bash
# 1. Manual secrets setup
gh auth login
ssh-keygen -t ed25519  # or copy key from USB

# 2. Clone monorepo
gh repo clone Aquaticat/Monochromatic ~/Monochromatic

# 3. Install dev toolchains (mise is pre-installed in image)
cd ~/Monochromatic
mise trust && mise install

# 4. Run provisioner (copies dotfiles from monorepo, installs flatpaks)
mise run //packages/dev-script/vm-builder:provision
```

## Phase 3: verification

- [ ] Boot fresh VM from qcow2
- [ ] Verify KDE Plasma starts with SDDM
- [ ] Run provisioner sequence end-to-end
- [ ] Verify mise tools work: `bun --version`, `node --version`, `cargo --version`
- [ ] Verify podman works: `podman run --rm alpine echo hello`
- [ ] Verify libvirt works: `virsh list --all`
- [ ] Verify ghostty launches (installed as RPM, not AppImage)
- [ ] Verify host-level FDE protects the qcow2 at rest
- [ ] Verify librewolf launches
- [ ] Verify KeePassXC launches
- [ ] Verify `rpm-ostree install <package>` stages for next boot and activates after reboot
- [ ] Destroy VM, rebuild from scratch, confirm full reproducibility

## Phase 4: iteration workflow

Once the base image is stable, day-to-day changes fall into two categories:

**OS-level changes** (rare): edit Containerfile/build.sh, rebuild image, convert to qcow2.
Examples: new system package, display manager config, kernel module.

**User-level changes** (frequent): edit provisioner or dotfiles, re-run provisioner.
Examples: new mise tool, editor config change, new dotfile.
No image rebuild needed -- just re-run the provisioner in the existing VM.

## Open questions

- [x] ~~Where does the provisioner live?~~ -- `src/provision.ts` in vm-builder package
- [x] Custom image repo: `packages/dev-script/vm-builder/` in this monorepo
- [x] ~~KDE Plasma package set~~ -- `plasma-workspace` meta-package (full desktop)
- [x] ~~Which flatpaks?~~ -- Flatseal, Fastmail, Gear Lever, KColorChooser, KeePassXC,
  Nextcloud, OBS, RustDesk, Ungoogled Chromium
- [x] ~~Disk encryption~~ -- host-level FDE only (ZFS/LUKS/qcow2-LUKS all ruled out; see Phase 1)
- [x] ~~Nvim repo~~ -- nvim deprecated by editord
- [x] ~~Cosign key setup~~ -- key pair at `packages/config/cosign/`, signing step in build-and-import.ts
