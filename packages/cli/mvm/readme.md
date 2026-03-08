# cli-vm (mvm)

Ephemeral Ubuntu VM manager backed by KVM/libvirt.
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

# Connect to a running VM (auto-login serial console, Ctrl+] to disconnect)
bun packages/cli/vm/src/index.ts shell dev-01

# List all managed VMs
bun packages/cli/vm/src/index.ts list

# Clone a VM (full disk copy, new hostname via cloud-init)
bun packages/cli/vm/src/index.ts clone dev-01 dev-02

# Destroy a VM and all its storage
bun packages/cli/vm/src/index.ts destroy dev-01
```

Or via mise:

```sh
mise run packages/cli/vm:run -- create dev-01
```

## Architecture

- **Base images** are cached in `~/.local/share/mvm/images/`
- **Per-VM storage** lives in `~/.local/share/mvm/vms/<name>/`
  containing `disk.qcow2`, `seed.iso`, and metadata files
- **Disks** use qcow2 backing files from the cached base image for fast creation
- **Cloud-init** seed ISOs are generated using a built-in ISO9660 writer (no `genisoimage` needed)
- **Console access** uses `virsh console` with auto-login on ttyS0 (no SSH or keys needed)
- **Networking** uses QEMU user-mode networking (SLIRP) for outbound internet access
- **Connection** uses `qemu:///session` so no root privileges or polkit prompts are needed
- All VM names are prefixed with `mvm-` in libvirt to avoid collisions

## VM defaults

- 2 vCPUs
- 2 GiB RAM
- 20 GiB root disk (thin-provisioned via qcow2)
- Ubuntu 24.04 LTS (Noble Numbat)
- User: `ubuntu` with passwordless sudo
- Serial console auto-login (disconnect with `Ctrl+]`)
