# Portable VM dev environment

Declarative, immutable, rebuildable VM image for development.
Built on ucore-hci (Fedora CoreOS + libvirt/KVM/ZFS/cockpit/podman)
with KDE Plasma layered on top via a custom Containerfile.

## Architecture

```
ucore-hci (immutable, rpm-ostree, Fedora CoreOS base)
  + KDE Plasma, SDDM (baked into custom image)
  + system dev packages (baked into custom image)
  + mise (baked, /usr/local/bin)
  + user account (baked)
  |
  + mise toolchains (first-login, ~/. local/share/mise/)
  + dotfiles (first-login, ~/.config/)
  + ghostty AppImage (first-login, ~/Applications/)
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
- **Dotfiles in a single repo**: one `Aquaticat/dotfiles` repo with subdirectories,
  not per-tool repos (only nvim has enough complexity to warrant its own repo)
- **KDE config not portable**: let KDE regenerate defaults on each VM,
  machine-specific state (display IDs, GPU paths, monitor geometry) causes more breakage than it prevents
- **No cloud-init**: everything is baked into the image or handled by the first-login provisioner
- **Secrets stay manual**: `gh auth login` and SSH key setup after provisioning,
  no encrypted vaults or automation for secrets
- **Provisioner lives in this monorepo**: versioned alongside the rest of the dev tooling,
  uses file-enforcer primitives (`exec`, `overwrite`, `cat`)
- **Provisioner triggered manually**: run `setup-dev` once after first login,
  no systemd user services or `.bash_profile` hacks

## Phase 1: custom container image

### Containerfile

Based on [ublue-os/image-template][image-template] pattern.
Uses `ghcr.io/ublue-os/ucore-hci:stable` as base.

[image-template]: https://github.com/ublue-os/image-template

- [ ] Create repo (private GitHub repo or directory in this monorepo)
- [ ] Write Containerfile with multi-stage build (scratch context + ucore-hci base)
- [ ] Write `build.sh` with system packages

### System packages to bake in (build.sh)

KDE Plasma desktop:
- [ ] `plasma-desktop` -- core Plasma shell
- [ ] `sddm` -- display manager (+ `systemctl enable sddm`)
- [ ] `konsole` -- fallback terminal (KDE default)
- [ ] `dolphin` -- file manager (KDE default)

Browser + password manager (both must be native RPM for KeePassXC browser integration):
- [ ] Add LibreWolf repo: `dnf config-manager addrepo --from-repofile=https://rpm.librewolf.net/librewolf-repo.repo`
- [ ] `librewolf`
- [ ] `keepassxc`

Dev tools (system-level, mise handles the rest):
- [ ] `helix`
- [ ] `strace`
- [ ] `inotify-tools`
- [ ] `python3-devel`
- [ ] `potrace`
- [ ] `msitools`

Infrastructure:
- [ ] `mise` installed system-wide at `/usr/local/bin/mise`
- [ ] User account `user` with password, `wheel` group, passwordless sudo
- [ ] Global mise config at `/etc/skel/.config/mise/config.toml`
  so `mise install` works immediately on first login

### Build and convert

- [ ] Verify `podman build` produces a valid container image
- [ ] Convert to qcow2 with bootc-image-builder:
  ```
  sudo podman run --rm -it --privileged \
    --security-opt label=type:unconfined_t \
    -v ./output:/output \
    -v /var/lib/containers/storage:/var/lib/containers/storage \
    quay.io/centos-bootc/bootc-image-builder:latest \
    --type qcow2 \
    localhost/my-dev:latest
  ```
- [ ] Write `disk_config/disk.toml` (root filesystem size, btrfs)
- [ ] Boot the qcow2, verify KDE starts, SDDM login works, podman runs, libvirt works

### Ignition/Butane config (optional)

ucore inherits Fedora CoreOS Ignition support.
A Butane YAML can configure first-boot behavior (user, SSH keys, systemd units)
without cloud-init. Evaluate whether this is needed given the user account is baked in.

- [ ] Decide if Ignition adds value beyond what the Containerfile already provides
- [ ] If yes, write a Butane config for SSH key injection and hostname

## Phase 2: first-login provisioner

File-enforcer config in this monorepo at a location TBD (e.g. `packages/dev-script/setup-dev/`).
Uses file-enforcer primitives: `exec()`, `overwrite()`, `overwriteEach()`, `cat()`.

### Dotfiles repo

- [ ] Create `Aquaticat/dotfiles` repo with subdirectories:
  - `ghostty/` (1 file: `config`)
  - `contour/` (1 file: `contour.yml`)
  - `xremap/` (1 file: `config.yml`)
  - `git/` (1 file: `ignore`)
  - `mise/` (1 file: `config.toml` -- global mise config)
  - `crush/` (config files)
- [ ] Archive `Aquaticat/nvim` content into dotfiles repo or keep separate
  (nvim config is complex enough to justify its own repo)
- [ ] Decide which other `~/.config/` directories belong in the dotfiles repo
  (candidates: gh, neovide, fcitx5)

### Provisioner script tasks

Runs as user after first login. Idempotent (safe to re-run).

- [ ] Clone dotfiles: `gh repo clone Aquaticat/dotfiles ~/.dotfiles`
- [ ] Clone nvim config: `gh repo clone Aquaticat/nvim ~/.config/nvim`
- [ ] Symlink or copy dotfiles into `~/.config/` via `overwriteEach()`
- [ ] Run `mise install` via `exec()` (installs all tools from global config)
- [ ] Install ghostty AppImage:
  - Download from [pkgforge-dev/ghostty-appimage][ghostty-appimage] to `~/Applications/`
  - Set up auto-updates via `appimaged` or AM/AppMan
- [ ] Install any flatpaks needed for dev work
  (candidates: Flatseal, virt-manager if not already in ucore-hci)

[ghostty-appimage]: https://github.com/pkgforge-dev/ghostty-appimage

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

# 4. Run provisioner
bun packages/dev-script/setup-dev/src/setup-dev.config.ts
```

## Phase 3: verification

- [ ] Boot fresh VM from qcow2
- [ ] Verify KDE Plasma starts with SDDM
- [ ] Run provisioner sequence end-to-end
- [ ] Verify mise tools work: `bun --version`, `node --version`, `cargo --version`
- [ ] Verify podman works: `podman run --rm alpine echo hello`
- [ ] Verify libvirt works: `virsh list --all`
- [ ] Verify ghostty launches
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

- [ ] Where exactly in the monorepo does the provisioner package live?
  Candidates: `packages/dev-script/setup-dev/`, root-level script, separate repo
- [ ] Should the custom image repo be a separate private GitHub repo
  or a directory inside this monorepo?
- [ ] Exact KDE Plasma package set -- `plasma-desktop` is minimal,
  may need additional packages (`plasma-workspace`, `plasma-nm`, `bluedevil`, etc.)
  depending on what ucore-hci already provides for networking/Bluetooth
- [ ] Which flatpaks belong in the provisioner?
  Review the full flatpak list when feeling better
- [ ] Ghostty AppImage auto-update mechanism:
  `appimaged` vs AM/AppMan vs manual download script
- [ ] Whether to keep nvim as a separate repo or fold it into the dotfiles repo
- [ ] Cosign key setup for image signing (needed if pushing to GHCR, not needed for local-only builds)
