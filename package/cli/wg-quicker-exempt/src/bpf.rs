//! Minimal Linux `bpf(2)` UAPI bindings and the socket-marking program builder.
//!
//! The `libc` crate does not expose the BPF syscall's `bpf_attr` union or its
//! constants, so the small stable-ABI subset used here is defined directly.
//! The program marks sockets with `SO_MARK` so a policy-routing rule can send
//! their traffic outside the WireGuard tunnel.

/// Standard I/O error type used for syscall failures.
use std::io;

/// `bpf(2)` command: create a map.
const BPF_MAP_CREATE: i32 = 0;
/// `bpf(2)` command: update a map element.
const BPF_MAP_UPDATE_ELEM: i32 = 2;
/// `bpf(2)` command: load a program.
const BPF_PROG_LOAD: i32 = 5;
/// `bpf(2)` command: create a link (attach) to a target such as a cgroup.
const BPF_LINK_CREATE: i32 = 28;
/// `bpf(2)` command: pin a map/program/link to the bpf filesystem.
const BPF_OBJ_PIN: i32 = 6;

/// Map type: fixed-size array.
const BPF_MAP_TYPE_ARRAY: u32 = 2;
/// Program type: cgroup socket-address hooks (connect/sendmsg).
const BPF_PROG_TYPE_CGROUP_SOCK_ADDR: u32 = 18;

/// Attach type: IPv4 `connect()` (zero-indexed enum position 10).
pub const BPF_CGROUP_INET4_CONNECT: u32 = 10;
/// Attach type: IPv6 `connect()` (enum position 11).
pub const BPF_CGROUP_INET6_CONNECT: u32 = 11;
/// Attach type: IPv4 UDP `sendmsg()` (enum position 14).
pub const BPF_CGROUP_UDP4_SENDMSG: u32 = 14;
/// Attach type: IPv6 UDP `sendmsg()` (enum position 15).
pub const BPF_CGROUP_UDP6_SENDMSG: u32 = 15;

/// `bpf_attr` arm for map creation.
#[repr(C)]
#[derive(Clone, Copy)]
struct MapCreateAttr {
    /// Map type.
    map_type: u32,
    /// Key size in bytes.
    key_size: u32,
    /// Value size in bytes.
    value_size: u32,
    /// Maximum entry count.
    max_entries: u32,
    /// Map creation flags.
    map_flags: u32,
    /// Inner map fd (unused here).
    inner_map_fd: u32,
    /// NUMA node (unused here).
    numa_node: u32,
    /// Map name.
    map_name: [i8; 16],
}

/// `bpf_attr` arm for map element update.
#[repr(C)]
#[derive(Clone, Copy)]
struct MapUpdateAttr {
    /// Map fd.
    map_fd: u32,
    /// Pointer to the key.
    key: u64,
    /// Pointer to the value.
    value: u64,
    /// Update flags.
    flags: u64,
}

/// `bpf_attr` arm for program load, matching the kernel union field order.
#[repr(C)]
#[derive(Clone, Copy)]
struct ProgLoadAttr {
    /// Program type.
    prog_type: u32,
    /// Instruction count.
    insn_cnt: u32,
    /// Pointer to the instruction array.
    insns: u64,
    /// Pointer to the license string.
    license: u64,
    /// Verifier log level.
    log_level: u32,
    /// Verifier log buffer size.
    log_size: u32,
    /// Verifier log buffer pointer.
    log_buf: u64,
    /// Kernel version (unused for cgroup programs).
    kern_version: u32,
    /// Program flags.
    prog_flags: u32,
    /// Program name.
    prog_name: [i8; 16],
    /// Interface index for offloaded programs (unused).
    prog_ifindex: u32,
    /// Expected attach type.
    expected_attach_type: u32,
}

/// `bpf_attr` arm for link creation against a cgroup.
#[repr(C)]
#[derive(Clone, Copy)]
struct LinkCreateAttr {
    /// Program fd.
    prog_fd: u32,
    /// Target cgroup fd.
    target_fd: u32,
    /// Attach type / hook.
    attach_type: u32,
    /// Flags.
    flags: u32,
}

/// `bpf_attr` arm for pinning an object to the bpf filesystem.
#[repr(C)]
#[derive(Clone, Copy)]
struct ObjPinAttr {
    /// Pointer to the destination path.
    pathname: u64,
    /// Fd of the object to pin.
    bpf_fd: u32,
    /// File flags.
    file_flags: u32,
    /// Path fd (unused).
    path_fd: u32,
}

/// Minimal `bpf_attr` union covering the arms this loader uses.
#[repr(C)]
union BpfAttr {
    /// Map creation arm.
    map_create: MapCreateAttr,
    /// Map element update arm.
    map_update: MapUpdateAttr,
    /// Program load arm.
    prog_load: ProgLoadAttr,
    /// Link creation arm.
    link_create: LinkCreateAttr,
    /// Object pinning arm.
    obj_pin: ObjPinAttr,
    /// Raw bytes for zeroing.
    bytes: [u8; 168],
}

/// Invokes the `bpf(2)` syscall.
///
/// # Safety
///
/// `attr` must be valid for the active union arm of `cmd`. Callers fully
/// initialize the matching arm before the call.
unsafe fn bpf(cmd: i32, attr: *mut BpfAttr) -> io::Result<i64> {
    // SAFETY: SYS_bpf with a valid attr pointer for the given command.
    let ret = unsafe {
        libc::syscall(
            libc::SYS_bpf,
            cmd,
            attr,
            std::mem::size_of::<BpfAttr>(),
        )
    };
    if ret < 0 {
        return Err(io::Error::last_os_error());
    } else {
        return Ok(ret);
    }
}

/// eBPF instruction matching kernel `struct bpf_insn`.
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct BpfInsn {
    /// Opcode.
    code: u8,
    /// Destination (low nibble) and source (high nibble) registers.
    dst_src: u8,
    /// Signed offset.
    off: i16,
    /// Signed immediate.
    imm: i32,
}

/// Instruction construction for [`BpfInsn`].
impl BpfInsn {
    /// Builds one instruction.
    const fn new(code: u8, dst: u8, src: u8, off: i16, imm: i32) -> Self {
        return Self {
            code,
            dst_src: (src << 4) | dst,
            off,
            imm,
        };
    }
}

/// Opcode: 64-bit immediate load (`ld_imm64`).
const BPF_LD_IMM64: u8 = 0x18;
/// Opcode: 64-bit register move.
const BPF_MOV64_REG: u8 = 0xbf;
/// Opcode: 32-bit immediate move.
const BPF_MOV32_IMM: u8 = 0xb4;
/// Opcode: 64-bit register add immediate.
const BPF_ALU64_ADD: u8 = 0x07;
/// Opcode: store 32-bit immediate to memory.
const BPF_ST_MEM32: u8 = 0x7a;
/// Opcode: helper call (`BPF_JMP | BPF_CALL | BPF_X` = 0x85).
const BPF_CALL: u8 = 0x85;
/// Opcode: jump-if-equal immediate.
const BPF_JEQ_IMM: u8 = 0x15;
/// Opcode: program exit.
const BPF_EXIT: u8 = 0x95;
/// Pseudo source marking an `ld_imm64` that references a map fd.
const BPF_PSEUDO_MAP_FD: u8 = 1;
/// Helper number: `bpf_map_lookup_elem`.
const FN_MAP_LOOKUP: i32 = 1;
/// Helper number: `bpf_setsockopt`.
const FN_SETSOCKOPT: i32 = 49;
/// `SOL_SOCKET` socket level.
const SOL_SOCKET: i32 = 1;
/// `SO_MARK` socket option.
const SO_MARK: i32 = 36;

/// Builds the socket-marking program referencing a mark map fd.
///
/// Sequence: save ctx in r6, look up `mark_map[0]`, and when present call
/// `setsockopt(ctx, SOL_SOCKET, SO_MARK, value_ptr, 4)`, then return 1 (allow).
fn mark_program(map_fd: i32) -> [BpfInsn; 16] {
    return [
        BpfInsn::new(BPF_MOV64_REG, 6, 1, 0, 0),
        BpfInsn::new(BPF_LD_IMM64, 1, BPF_PSEUDO_MAP_FD, 0, map_fd),
        BpfInsn::new(0, 0, 0, 0, 0),
        BpfInsn::new(BPF_MOV64_REG, 2, 10, 0, 0),
        BpfInsn::new(BPF_ALU64_ADD, 2, 0, 0, -4),
        BpfInsn::new(BPF_ST_MEM32, 2, 0, -4, 0),
        BpfInsn::new(BPF_CALL, 0, 0, 0, FN_MAP_LOOKUP),
        BpfInsn::new(BPF_JEQ_IMM, 0, 0, 5, 0),
        BpfInsn::new(BPF_MOV64_REG, 1, 6, 0, 0),
        BpfInsn::new(BPF_MOV32_IMM, 2, 0, 0, SOL_SOCKET),
        BpfInsn::new(BPF_MOV32_IMM, 3, 0, 0, SO_MARK),
        BpfInsn::new(BPF_MOV64_REG, 4, 0, 0, 0),
        BpfInsn::new(BPF_MOV32_IMM, 5, 0, 0, 4),
        BpfInsn::new(BPF_CALL, 0, 0, 0, FN_SETSOCKOPT),
        BpfInsn::new(BPF_MOV32_IMM, 0, 0, 0, 1),
        BpfInsn::new(BPF_EXIT, 0, 0, 0, 0),
    ];
}


/// Creates the one-entry array map holding the mark value.
fn create_mark_map(mark: u32) -> io::Result<i32> {
    let mut attr = BpfAttr {
        bytes: [0; 168],
    };
    let mut map_name = [0i8; 16];
    map_name[..4].copy_from_slice(&[b'm' as i8, b'a' as i8, b'r' as i8, b'k' as i8]);
    attr.map_create = MapCreateAttr {
        map_type: BPF_MAP_TYPE_ARRAY,
        key_size: 4,
        value_size: 4,
        max_entries: 1,
        map_flags: 0,
        inner_map_fd: 0,
        numa_node: 0,
        map_name,
    };
    // SAFETY: map_create arm initialized.
    let map_fd = unsafe { bpf(BPF_MAP_CREATE, &mut attr)? } as i32;

    let key: u32 = 0;
    let mut uattr = BpfAttr {
        bytes: [0; 168],
    };
    uattr.map_update = MapUpdateAttr {
        map_fd: map_fd as u32,
        key: &key as *const u32 as u64,
        value: &mark as *const u32 as u64,
        flags: 0,
    };
    // SAFETY: map_update arm initialized; key/mark outlive the call.
    unsafe { bpf(BPF_MAP_UPDATE_ELEM, &mut uattr)? };
    return Ok(map_fd);
}

/// Loads the mark program for one hook and returns its fd.
fn load_prog(map_fd: i32, attach_type: u32) -> io::Result<i32> {
    let prog = mark_program(map_fd);
    let mut logbuf = vec![0u8; 65536];
    let license = b"GPL\0";
    let mut attr = BpfAttr {
        bytes: [0; 168],
    };
    attr.prog_load = ProgLoadAttr {
        prog_type: BPF_PROG_TYPE_CGROUP_SOCK_ADDR,
        insn_cnt: prog.len() as u32,
        insns: prog.as_ptr() as u64,
        license: license.as_ptr() as u64,
        log_level: 1,
        log_size: logbuf.len() as u32,
        log_buf: logbuf.as_mut_ptr() as u64,
        kern_version: 0,
        prog_flags: 0,
        prog_name: [0; 16],
        prog_ifindex: 0,
        expected_attach_type: attach_type,
    };
    // SAFETY: prog_load arm initialized; prog/license/logbuf outlive the call.
    let fd = unsafe { bpf(BPF_PROG_LOAD, &mut attr) }.map_err(|e| {
        let log = String::from_utf8_lossy(&logbuf);
        return io::Error::new(e.kind(), format!("{e}; verifier log: {log}"));
    })?;
    return Ok(fd as i32);
}

/// Pins a bpf object fd to a path in the bpf filesystem so it survives process exit.
fn pin_obj(fd: i32, path: &std::ffi::CStr) -> io::Result<()> {
    let mut attr = BpfAttr {
        bytes: [0; 168],
    };
    attr.obj_pin = ObjPinAttr {
        pathname: path.as_ptr() as u64,
        bpf_fd: fd as u32,
        file_flags: 0,
        path_fd: 0,
    };
    // SAFETY: obj_pin arm initialized; path outlives the call.
    unsafe { bpf(BPF_OBJ_PIN, &mut attr)? };
    return Ok(());
}

/// Attaches a program to a cgroup via `BPF_LINK_CREATE`, returning the link fd.
fn attach_link(prog_fd: i32, cgroup_fd: i32, attach_type: u32) -> io::Result<i32> {
    let mut attr = BpfAttr {
        bytes: [0; 168],
    };
    attr.link_create = LinkCreateAttr {
        prog_fd: prog_fd as u32,
        target_fd: cgroup_fd as u32,
        attach_type,
        flags: 0,
    };
    // SAFETY: link_create arm initialized.
    let fd = unsafe { bpf(BPF_LINK_CREATE, &mut attr)? };
    return Ok(fd as i32);
}

/// All hooks the marker installs, covering TCP connect and UDP sendmsg, v4 and v6.
pub const HOOKS: [u32; 4] = [
    BPF_CGROUP_INET4_CONNECT,
    BPF_CGROUP_INET6_CONNECT,
    BPF_CGROUP_UDP4_SENDMSG,
    BPF_CGROUP_UDP6_SENDMSG,
];

/// Hook names used for pinned-link file names, parallel to [`HOOKS`].
const HOOK_NAMES: [&str; 4] = [
    "connect4",
    "connect6",
    "udp4_sendmsg",
    "udp6_sendmsg",
];

/// Attaches the socket-marking program to one cgroup for every hook and pins each
/// resulting link under `pin_dir` so the attachment survives process exit.
///
/// Returns the pinned link paths (one per hook). Removing those files detaches.
pub fn attach_marker(cgroup_fd: i32, mark: u32, pin_dir: &str) -> io::Result<Vec<String>> {
    let map_fd = create_mark_map(mark)?;
    let mut pinned = Vec::with_capacity(HOOKS.len());
    for (index, hook) in HOOKS.iter().enumerate() {
        let prog_fd = load_prog(map_fd, *hook)?;
        let link_fd = attach_link(prog_fd, cgroup_fd, *hook)?;
        let path = format!("{pin_dir}/{}", HOOK_NAMES[index]);
        let c_path = std::ffi::CString::new(path.clone()).map_err(|_| {
            return io::Error::new(io::ErrorKind::InvalidInput, "pin path contains NUL");
        })?;
        // Best-effort remove of a stale pin from a prior run before pinning.
        let _ = std::fs::remove_file(&path);
        pin_obj(link_fd, &c_path)?;
        pinned.push(path);
        // The pinned link persists; close our fds.
        unsafe {
            libc::close(link_fd);
            libc::close(prog_fd);
        }
    }
    unsafe {
        libc::close(map_fd);
    }
    return Ok(pinned);
}
