# cli-vm (mvm)

Ephemeral VM manager backed by KVM/libvirt.
Creates always-on virtual machines you can immediately shell into.
VMs exist from creation until destruction -- no pause, stop, or snapshot lifecycle.
Clone replaces snapshot needs.

## Prerequisites

- **Linux only** -- depends on KVM, libvirt, and `virsh`, none of which are available on macOS or Windows
- KVM support (`/dev/kvm` must exist)
- `virsh` and `qemu-img` installed (`sudo dnf install libvirt qemu-img`)

## Usage

```sh
# Create a new VM (downloads Ubuntu 24.04 LTS cloud image on first run)
bun packages/cli/vm/src/index.ts create dev-01

# Create a VM with a different image
bun packages/cli/vm/src/index.ts create --image fedora build-box
bun packages/cli/vm/src/index.ts create --image alpine lightweight

# Connect to a running VM (auto-login serial console, Ctrl+] to disconnect)
bun packages/cli/vm/src/index.ts shell dev-01

# List all managed VMs
bun packages/cli/vm/src/index.ts list

# Clone a VM (full disk copy, new hostname via cloud-init)
bun packages/cli/vm/src/index.ts create --from dev-01 dev-02

# Destroy a VM and all its storage
bun packages/cli/vm/src/index.ts destroy dev-01
```

Or via mise:

```sh
mise run packages/cli/vm:run -- create dev-01
mise run packages/cli/vm:run -- create --image fedora build-box
```

## Available images

- **ubuntu** (default) -- Ubuntu 24.04 LTS (Noble Numbat), user: `ubuntu`
- **fedora** -- Fedora 43 Cloud Base, user: `fedora`
- **alpine** -- Alpine 3.23 with cloud-init, user: `alpine`

Each image is downloaded once and cached in `~/.local/share/mvm/images/`.
A per-image template with qemu-guest-agent pre-installed is baked on first use
(e.g. `template-ubuntu.qcow2`, `template-fedora.qcow2`).

## Custom templates

To use an image not in the built-in registry:

1.  Boot your image manually (via virt-manager, raw qemu, or any other method)
2.  Install `qemu-guest-agent` inside the guest and enable it to start on boot --
    mvm relies on the guest agent for command execution via `mvm exec`
3.  Shut down the guest cleanly
4.  Place the resulting qcow2 disk image in `~/.local/share/mvm/images/` with a descriptive name
    (e.g. `my-custom.qcow2`)
5.  Create VMs from it with `mvm create --image my-custom dev-01`

mvm uses the custom template as a qcow2 backing file directly, skipping the
download-and-template-bake pipeline. The cloud-init seed defaults to `root`
with a `/bin/sh` shell for custom images.

## Architecture

- **Base images** are cached in `~/.local/share/mvm/images/`
- **Per-image templates** are stored alongside base images (e.g. `template-ubuntu.qcow2`)
- **Per-VM storage** lives in `~/.local/share/mvm/vms/<name>/`
  containing `disk.qcow2`, `seed.iso`, and metadata files
- **Disks** use qcow2 backing files from the cached template for fast creation
- **Cloud-init** seed ISOs are generated using a built-in ISO9660 writer (no `genisoimage` needed)
- **Console access** uses `virsh console` with auto-login on ttyS0 (no SSH or keys needed)
- **Networking** uses QEMU user-mode networking (SLIRP) for outbound internet access
- **Connection** uses `qemu:///session` so no root privileges or polkit prompts are needed
- All VM names are prefixed with `mvm-` in libvirt to avoid collisions

## VM defaults

- 4 vCPUs
- 8 GiB RAM
- 20 GiB root disk (thin-provisioned via qcow2)
- Serial console auto-login (disconnect with `Ctrl+]`)
