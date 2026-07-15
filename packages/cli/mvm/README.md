# cli-mvm

Ephemeral VM manager with pluggable backends.
Creates always-on virtual machines you can immediately shell into.
VMs exist from creation until destruction;
 no pause,
 stop,
 or snapshot lifecycle.
Clone replaces snapshot needs.

## Backends

mvm selects a backend per invocation with `--backend <kind>` (or the
`MVM_BACKEND` env var);
 it defaults to `libvirt`.

- **libvirt** (default):
   local QEMU/KVM virtual machines.
   Linux only.
- **hetzner**:
   Hetzner Cloud servers provisioned over the HTTP API.
   Runs on any
  platform;
   provisions real,
   billed servers.

There is no record of which backend a VM lives on,
 so pass the same `--backend`
to follow-up commands (`exec`,
 `destroy`,
 etc.) that you used to create the VM.

## Prerequisites

### libvirt backend (default)

- **Linux only**:
   depends on KVM,
   libvirt,
   and `virsh`,
   none of which are available on macOS or Windows
- KVM support (`/dev/kvm` must exist)
- `virsh` and `qemu-img` installed (`sudo dnf install libvirt qemu-img`)

### hetzner backend

- `HCLOUD_TOKEN` set to a Hetzner Cloud API token (read/write)
- An OpenSSH client (`ssh`,
   `scp`) version 9.0 or newer on the host running mvm
- Cross-platform:
   no local hypervisor required

## Usage

```sh
# Create a new VM (downloads Ubuntu 24.04 LTS cloud image on first run)
mvm create dev-01

# Create a VM with a different image
mvm create --image fedora build-box
mvm create --image alpine lightweight
mvm create --image windows win-box

# Connect to a running VM (auto-login serial console, Ctrl+] to disconnect)
mvm shell dev-01

# List all managed VMs
mvm list

# Clone a VM (full disk copy, new hostname via cloud-init)
mvm create --from dev-01 dev-02

# Destroy a VM and all its storage
mvm destroy dev-01
```

Or via mise:

```sh
mise run //packages/cli/mvm:run -- create dev-01
mise run //packages/cli/mvm:run -- create --image fedora build-box
mise run //packages/cli/mvm:run -- create --image windows win-box
```

## Available images

- **ubuntu** (default):
   Ubuntu 24.04 LTS (Noble Numbat),
   user:
   `ubuntu`
- **fedora**:
   Fedora 43 Cloud Base,
   user:
   `fedora`
- **alpine**:
   Alpine 3.23 with cloud-init,
   user:
   `alpine`
- **windows**:
   Windows Server 2025 evaluation ISO,
   user:
   `Administrator`

Each image is downloaded once and cached in `~/.local/share/mvm/images/`.
A per-image template with qemu-guest-agent pre-installed is baked on first use
(e.g. `template-ubuntu.qcow2`,
 `template-fedora.qcow2`).

## Hetzner Cloud backend

Select it per command with `--backend hetzner` (or `export MVM_BACKEND=hetzner`).
It provisions real,
 billed Hetzner servers,
 so an `HCLOUD_TOKEN` must be set.

```sh
export HCLOUD_TOKEN=...   # a Hetzner Cloud API token with read/write access

# Create a server (defaults: cheapest non-deprecated type, locations fsn1,nbg1,hel1)
mvm --backend hetzner create dev-01

# Pick a server type and location series (first available wins)
mvm --backend hetzner create big \
  --server-type cpx41 --location ash,hil

# Run a command (over SSH), copy files (over SCP), open a shell, then destroy
mvm --backend hetzner exec dev-01 -- uname -a
mvm --backend hetzner push dev-01 ./setup.sh /root/setup.sh
mvm --backend hetzner shell dev-01
mvm --backend hetzner destroy dev-01

# List or destroy every mvm-managed server (scoped by the mvm=true label)
mvm --backend hetzner list
mvm --backend hetzner destroy --all
```

Notes:

- **Images** map distro shorthands (`ubuntu`,
   `debian`,
   `fedora`,
   `rocky`,
  `centos`,
   `alma`) to the newest non-deprecated Hetzner system image of that
  flavor;
   an unrecognised value is passed through as a literal Hetzner image
  slug.
   `alpine` and `windows` are not offered by Hetzner.
- **Location fallback**:
   `--location` (or `MVM_HCLOUD_LOCATIONS`) is an ordered
  list;
   mvm advances to the next location when one is out of stock
  (HTTP 412 `resource_unavailable`).
- **Cost**:
   every operation provisions or holds billed resources.
   An ephemeral
  `run`,
   or a crash between create and destroy,
   can leave an orphan;
   sweep with
  `--backend hetzner destroy --all` (or `list` to inspect).
   Tunables:
  `MVM_HCLOUD_SERVER_TYPE`,
   `MVM_HCLOUD_LOCATIONS`.
- **Differences from libvirt**:
   `exec`/`shell` run over SSH (not the guest
  agent);
   `push`/`pull` use SCP with a real absolute remote path (not a
  virtiofs filename);
   `clone` snapshots the source live (it is not shut down)
  and the intermediate snapshot is deleted once the destination boots;
   host
  keys are not persisted because Hetzner recycles public IPv4.
- **No persistent backend record**:
   pass the same `--backend hetzner` to
  follow-up commands as you used to create the VM.

A live,
 billed integration test lives at
`src/backend/hetzner/provision.expensive.unit.test.ts`.
 It is excluded from
`test:unit` (the `.expensive.` marker) and only runs when `HCLOUD_TOKEN` is set:

```sh
HCLOUD_TOKEN=... node packages/cli/mvm/src/backend/hetzner/provision.expensive.unit.test.ts
```

## Custom templates

To use an image not in the built-in registry:

1. Boot your image manually (via virt-manager,
    raw qemu,
    or any other method)
2. Install `qemu-guest-agent` inside the guest and enable it to start on boot:
   mvm relies on the guest agent for command execution via `mvm exec`
3. Shut down the guest cleanly
4. Place the resulting qcow2 disk image in `~/.local/share/mvm/images/` with a descriptive name
   (e.g. `my-custom.qcow2`)
5. Create VMs from it with `mvm create --image my-custom dev-01`

mvm uses the custom template as a qcow2 backing file directly,
 skipping the
download-and-template-bake pipeline.
 The cloud-init seed defaults to `root`
with a `/bin/sh` shell for custom images.

## Architecture

- **Base images** are cached in `~/.local/share/mvm/images/`
- **Per-image templates** are stored alongside base images (e.g. `template-ubuntu.qcow2`)
- **Per-VM storage** lives in `~/.local/share/mvm/vms/<name>/`
  containing `disk.qcow2`,
   `seed.iso`,
   and metadata files
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
