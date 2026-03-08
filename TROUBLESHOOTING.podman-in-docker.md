# Podman-in-Docker troubleshooting

Lessons from deploying inference-canary-viewer (2026-03-07).

## Overlay storage driver fails inside Docker volumes

`mount /var/lib/containers/storage/overlay, flags: 0x1000: permission denied`
even with `SYS_ADMIN`.

Fix: use `vfs` storage driver in `/etc/containers/storage.conf`.
VFS does full file copies instead of overlay mounts.
Performance is fine when only pulling small images infrequently.

## Fine-grained capabilities are not enough for podman

`SYS_ADMIN` + `MKNOD` + `/dev/fuse` + `seccomp=unconfined` + `label=disable`
still fails with `remount /, flags: 0x44000: permission denied`
during image layer extraction.

Fix: `privileged: true` on the outer container.
Lock down inner containers instead (`--cap-drop=ALL --read-only --network=none`).

## Cgroup v2 controllers unavailable

`controller 'pids' is not available under /sys/fs/cgroup/libpod_parent/...`

Fix: `cgroupns_mode: host` (or `--cgroupns=host`) so podman can see the host's cgroup controllers.

## Missing ca-certificates breaks TLS

`x509: certificate signed by unknown authority` when podman pulls from Docker Hub.
Minimal Debian images don't include root CA certs.
Docker itself handles TLS at the daemon level, not inside the container.

Fix: `apt-get install ca-certificates`.

## Bun requires AVX CPU instructions

Bun's JavaScriptCore crashes with segfault and massive memory allocation (13GB+ RSS)
on CPUs without AVX support.
QEMU's default CPU model does not expose AVX.

Symptoms:
- Exit code 137 (OOM kill) on any `bun -e` command
- `bun --version` works fine (no JIT needed)
- Alpine image gives a clear crash report: "CPU lacks AVX support"
- Debian image just OOMs silently

Fix: use `-cpu host` passthrough in QEMU (or `host-passthrough` in libvirt XML).

## Bun static file server binds to IPv6 loopback only

`bun --port 3000 file.html` listens on `::1`, invisible to Docker's IPv4 port mapping.
The `--hostname` flag is not recognized by the static server mode
(bun treats it as a file path argument: `error: File not found "0.0.0.0"`).

Fix: use `Bun.serve()` inline with explicit `hostname: '0.0.0.0'`:
```sh
bun -e "Bun.serve({port:3000,hostname:'0.0.0.0',fetch(r){...}})"
```

## Debugging approach

- **Measure before accusing**: when something seems slow or broken, time it.
  We guessed VFS was slow; timing showed the pull took 7 seconds.
  The real issue was AVX, completely unrelated.
- **Read the actual error, not the symptom**: exit code 137 (OOM) looked like a memory issue.
  The Alpine crash report revealed a CPU instruction set problem causing the memory blowup.
- **Test the simplest case first**: `bun --version` vs `bun -e "..."` isolated the issue to JIT compilation.
