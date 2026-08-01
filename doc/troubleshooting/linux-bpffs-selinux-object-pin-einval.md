# Linux 7.1.3 with SELinux returns `EINVAL` when `BPF_OBJ_PIN` creates a bpffs object

## Symptom

On kernel `7.1.3-ogc5.1.fc44.x86_64` with SELinux enforcing,
`wg-quicker-exempt attach` loads its map and programs and creates a cgroup BPF link,
but the first `BPF_OBJ_PIN` fails:

```text
error: attach /sys/fs/cgroup/wgq-strace-probe: Invalid argument (os error 22)
```

The syscall trace identifies the failing boundary:

```text
bpf(BPF_MAP_CREATE, ..., 168) = 5
bpf(BPF_MAP_UPDATE_ELEM, ..., 168) = 0
bpf(BPF_PROG_LOAD, ..., 168) = 6
bpf(BPF_LINK_CREATE, ..., 168) = 7
bpf(BPF_OBJ_PIN, {pathname=".../connect4", bpf_fd=7, ...}, 168) = -1 EINVAL
```

The same `EINVAL` occurs when pinning a map,
 program,
 or link at the bpffs root or in a nested directory.

A separate bpffs rule rejects any path component containing a dot with `EPERM`.
It affected the loader's first hidden staging-directory design and would affect unencoded Ghostty scope names.
This is not the cause of the `BPF_OBJ_PIN` `EINVAL` after names are encoded without dots.

## Root cause

The source trace uses upstream Linux commit
`8ba098e6b6ff0db8edf28528d1552be261af30d4` from 2026-07-30.
The running kernel is `7.1.3-ogc5.1.fc44.x86_64`.

`kernel/bpf/inode.c:491-523` routes `BPF_OBJ_PIN` through security initialization and object creation:

```c
static int bpf_obj_do_pin(int path_fd, const char __user *pathname, void *raw,
                          enum bpf_type type)
{
        /* ... */
        ret = security_path_mknod(&path, dentry, mode, 0);
        if (ret)
                goto out;

        switch (type) {
        case BPF_TYPE_PROG:
                ret = vfs_mkobj(dentry, mode, bpf_mkprog, raw);
                break;
        case BPF_TYPE_MAP:
                ret = vfs_mkobj(dentry, mode, bpf_mkmap, raw);
                break;
        case BPF_TYPE_LINK:
                ret = vfs_mkobj(dentry, mode, bpf_mklink, raw);
                break;
```

Each object creation reaches `security_inode_init_security()` at
`kernel/bpf/inode.c:363-380`:

```c
ret = security_inode_init_security(inode, dir, &dentry->d_name,
                                   bpf_fs_initxattrs, NULL);
if (ret && ret != -EOPNOTSUPP) {
        iput(inode);
        return ret;
}
```

The affected SELinux implementation initializes the inode security state before checking whether the mount supports
per-inode labels.
 `security/selinux/hooks.c:2983-2993` shows that order:

```c
if (sbsec->flags & SE_SBINITIALIZED) {
        struct inode_security_struct *isec = selinux_inode(inode);
        isec->sclass = newsclass;
        isec->sid = newsid;
        isec->initialized = LABEL_INITIALIZED;
}

if (!selinux_initialized() ||
    !(sbsec->flags & SBLABEL_MNT))
        return -EOPNOTSUPP;
```

Carlos Llamas reported this regression in the upstream thread and posted a patch on 2026-07-30.
The patch moves the `SBLABEL_MNT` check before the inode security state is initialized.
It names commit `9722955b5430` (`bpf: Add simple xattr support to bpffs`) as the regression source and requests stable
backports.

The earlier hypothesis that pin-directory depth or BPF object type caused `EINVAL` was wrong.
Root-level and nested pins fail,
 and map,
 program,
 and link pins all fail.
The same failure also occurs on a fresh bpffs mounted in a disposable mount namespace.

The independent dot-name failure is explicit in `kernel/bpf/inode.c:414-424`:

```c
/* Dots in names (e.g. "/sys/fs/bpf/foo.bar") are reserved for future
 * extensions. That allows popoulate_bpffs() create special files.
 */
if ((dir->i_mode & S_IALLUGO) &&
    strchr(dentry->d_name.name, '.'))
        return ERR_PTR(-EPERM);
```

`wg-quicker-exempt` therefore encodes canonical cgroup path bytes as chunked hexadecimal components.
That encoding is injective,
 contains no dots,
 and keeps each component within `NAME_MAX`.

## Verification

Environment:

```text
kernel: 7.1.3-ogc5.1.fc44.x86_64
SELinux: Enforcing
bpffs: /sys/fs/bpf, rw, mode=700
LSM order: lockdown,capability,yama,selinux,bpf,landlock,ipe,ima,evm
selinux-policy: 44.4-1.fc44
```

Reproduce the object-pin failure with a disposable cgroup:

```sh
cgroup=/sys/fs/cgroup/wgq-pin-repro
sudo mkdir -- "$cgroup"
sudo strace --trace=bpf \
  package/cli/wg-quicker-exempt/target/debug/wg-quicker-exempt \
  attach 8888 "$cgroup"
sudo package/cli/wg-quicker-exempt/target/debug/wg-quicker-exempt \
  detach "$cgroup" || true
sudo rmdir -- "$cgroup"
```

Working catalog:

- `BPF_MAP_CREATE` and `BPF_MAP_UPDATE_ELEM` succeed.
- `BPF_PROG_LOAD` succeeds for all four cgroup socket-address hook types.
- `BPF_LINK_CREATE` succeeds.
- Holding unpinned link descriptors marks TCP4,
   TCP6,
   UDP4,
   and UDP6 sockets with `8888`.
- Dropping those descriptors detaches all four programs and subsequent sockets retain mark `0`.
- The detached holder preserves all four marks after the invoking CLI exits.
- Reattach changes the observed mark from `8888` to `9999`,
   and detach returns it to `0`.
- A candidate failure after all four new links attach leaves the prior `8888` holder active.
- State pointing at a wrong process blocks detach and preserves the live holder.
- Parent death before transition state closes candidate stdin and drops all untracked links.
- Recovery rejects a live candidate without a commit marker and preserves the prior holder.
- Recovery adopts a live committed candidate before performing the next replacement.
- A removed cgroup still maps to its lexical state key and detaches cleanly.
- A bpffs directory name without a dot can be created and removed.

The protocol harness is:

```sh
mise run //package/cli/wg-quicker-exempt:test:unit
test_binary=$(find package/cli/wg-quicker-exempt/target/debug/deps \
  -maxdepth 1 -type f -executable -name 'wg_quicker_exempt-*' \
  -printf '%T@ %p\n' | sort --numeric-sort --reverse | head --lines=1 | cut --delimiter=' ' --fields=2-)
sudo -- "$test_binary" --exact \
  pin_tests::all_protocol_hooks_mark_and_drop_cleanly \
  --ignored --test-threads=1 --nocapture
```

Failing `EINVAL` catalog:

- pinning `BPF_TYPE_MAP` directly under the bpffs root;
- pinning `BPF_TYPE_PROG` directly under the bpffs root;
- pinning `BPF_TYPE_LINK` directly under the bpffs root;
- pinning each object type in a nested tool-owned directory;
- pinning on a fresh bpffs mounted in a disposable mount namespace.

Failing `EPERM` catalog:

- creating `.probe` under the bpffs root;
- creating `.probe` in a nested bpffs directory.

## Verified workarounds

### Keep link descriptors open

The privileged test harness retains all four `BPF_LINK_CREATE` descriptors instead of pinning them.
All four protocols receive the requested mark while the descriptors remain open.
Dropping them cleanly detaches the marker.

Tradeoff:
 the links do not survive holder-process exit.
`wg-quicker-exempt` now starts a detached holder through a two-phase handshake,
 persists transition state,
 validates PID,
start time,
 full command,
 mark,
 and cgroup before shutdown,
 and recovers interrupted replacement.
A holder crash safely detaches its links instead of leaving unowned kernel state.

### Encode every bpffs path component without dots

The loader's hexadecimal canonical-path encoding avoids bpffs's reserved-dot rule and slash-replacement collisions.

Tradeoff:
 encoded paths are not human-readable.
The loader must compute them from the canonical cgroup path rather than expecting operators to derive them manually.

## What does not work

- A hidden staging directory fails with `EPERM` because bpffs reserves dots in names.
- A non-hidden staging directory fixes `mkdir`,
   but object pinning still fails with `EINVAL` on the affected kernel.
- Moving the pin to the bpffs root does not avoid `EINVAL`.
- Changing the pinned object from link to program or map does not avoid `EINVAL`.
- Mounting a fresh bpffs in a private mount namespace does not avoid `EINVAL`.
- Adding an explicit SELinux `context=` mount option does not avoid `EINVAL`.
- A local VM could not be used for a fixed-kernel comparison because this host lacks `qemu-img`,
   `qemu-system-x86_64`,
   and
  `virsh`.
   The failure occurred before VM startup and does not provide kernel comparison evidence.

Disabling SELinux was not attempted and is not an acceptable production workaround.

## Upstream filing decision

No `.out-of-scope/` entry covers Linux,
 bpffs,
 BPF,
 or SELinux.

GitHub searches across open and closed issues and pull requests in `torvalds/linux` found no tracker item,
 but the Linux
kernel uses mailing-list review and an exact upstream thread already exists:

- [Regression report and source diagnosis](https://lore.kernel.org/all/akWdcp6P0FkNDzBk@google.com/)
- [Proposed fix](https://lists.openwall.net/linux-kernel/2026/07/30/2199)

The filing constraints resolve as follows:

1. **Upstream fault:**
    yes.
    The proposed patch names the regressing commit and corrects SELinux state initialization order.
2. **Upstream can fix it:**
    yes.
    The patch changes `security/selinux/hooks.c` without a userspace API change.
3. **Supported use case:**
    yes.
    `BPF_OBJ_PIN` is a documented UAPI command and bpffs object creation supports maps,
    programs,
   and links in `kernel/bpf/inode.c`.
4. **Contribution policy:**
    yes.
    `Documentation/process/submitting-patches.rst` documents external patch submission and no
   AI-assistance ban was found in the checked process and code-of-conduct documents.
5. **Likely resolution:**
    yes.
    The patch is addressed to the SELinux,
    VFS,
    and BPF maintainers,
    copies `stable@kernel.org`,
    and
   has an existing review thread.
6. **Compatible minimal fix:**
    yes.
    The upstream patch moves one existing guard before inode security initialization and
   includes the affected source location and regression commit.

Do not open a duplicate report.
A test-result comment could add the released-kernel evidence,
 but external posting requires the human's decision.

Draft additive comment,
 not posted:

~~~md
Tested the reported failure on `7.1.3-ogc5.1.fc44.x86_64` with SELinux enforcing and `selinux-policy-44.4-1.fc44`.

`BPF_MAP_CREATE`, `BPF_PROG_LOAD`, and `BPF_LINK_CREATE` succeed, then `BPF_OBJ_PIN` returns `EINVAL`. I reproduced the same
result for maps, programs, and links, both at the bpffs root and in nested directories. A fresh bpffs in a private mount
namespace behaves the same way. Holding an unpinned cgroup link FD works for TCP4, TCP6, UDP4, and UDP6, which narrows the
failure to object creation in bpffs rather than loading or attaching the programs.
~~~
