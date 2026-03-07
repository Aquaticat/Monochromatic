# cli-vm (mvm)

Ephemeral Ubuntu VM manager backed by KVM/libvirt.
Creates always-on virtual machines you can immediately shell into.
VMs exist from creation until destruction -- no pause, stop, or snapshot lifecycle.
Clone replaces snapshot needs.

## Prerequisites

- KVM support (`/dev/kvm` must exist)
- `virsh` and `qemu-img` installed (`sudo dnf install libvirt qemu-img`)
- libvirt default network active (`virsh net-start default`)
- SSH public key in `~/.ssh/` (ed25519, RSA, or ECDSA)
- User in the `libvirt` group (`sudo usermod -aG libvirt $USER`)

## Usage

```sh
# Create a new VM (downloads Ubuntu 24.04 LTS cloud image on first run)
bun packages/cli/vm/src/index.ts create dev-01

# SSH into a running VM
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
- **Networking** uses libvirt's default NAT network for internet access
- All VM names are prefixed with `mvm-` in libvirt to avoid collisions

## VM defaults

- 2 vCPUs
- 2 GiB RAM
- 20 GiB root disk (thin-provisioned via qcow2)
- Ubuntu 24.04 LTS (Noble Numbat)
- User: `ubuntu` with passwordless sudo
