import { readFile, realpath, } from 'node:fs/promises';
import { mapOverlapped, } from '../overlapped-map.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { readProducerInputHostMounts, type ProducerInputHostMount, } from './producer-input-host-mount.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Fixed child mount profile before application or input-body reads

/** One fixed system-mount family, never a caller-supplied mount instruction. */
type PlatformMountGroup = {
  /** Expected kernel filesystem implementation. */
  readonly filesystem: string;
  /** Fixed per-mount read/write mode. */
  readonly mode: 'ro' | 'rw';
  /** Exact allowed mountpoints, not open-ended directory prefixes. */
  readonly points: readonly string[];
  /** Required restrictions remain independent from read/write mode. */
  readonly flags: readonly string[];
};
/** System mounts observed under the pinned no-network image and OCI invocation. */
const PLATFORM_MOUNT_GROUPS: readonly PlatformMountGroup[] = [
  { filesystem: 'proc', mode: 'rw', points: ['/proc'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'proc', mode: 'ro', points: ['/proc/asound', '/proc/bus', '/proc/fs', '/proc/irq', '/proc/sys', '/proc/sysrq-trigger'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'tmpfs', mode: 'ro', points: ['/dev'], flags: ['nosuid'] },
  { filesystem: 'tmpfs', mode: 'ro', points: ['/dev/shm', '/etc/hosts', '/etc/hostname', '/run/.containerenv'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'tmpfs', mode: 'ro', points: ['/proc/acpi', '/proc/scsi', '/sys/devices/virtual/powercap', '/sys/firmware', '/sys/fs/selinux'], flags: ['nosuid', 'nodev'] },
  { filesystem: 'sysfs', mode: 'ro', points: ['/sys'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'cgroup2', mode: 'ro', points: ['/sys/fs/cgroup'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'devpts', mode: 'rw', points: ['/dev/pts'], flags: ['nosuid', 'noexec'] },
  { filesystem: 'mqueue', mode: 'rw', points: ['/dev/mqueue'], flags: ['nosuid', 'nodev', 'noexec'] },
  { filesystem: 'devtmpfs', mode: 'rw', points: ['/dev/null', '/dev/zero', '/dev/full', '/dev/tty', '/dev/random', '/dev/urandom'], flags: ['nosuid', 'noexec'] },
  { filesystem: 'devtmpfs', mode: 'ro', points: ['/proc/kcore', '/proc/keys', '/proc/latency_stats', '/proc/timer_list', '/proc/interrupts'], flags: ['nosuid'] },
];
/** Account projection files are declared platform inputs, not part of the immutable image. */
const ACCOUNT_MOUNTS: readonly string[] = ['/etc/passwd', '/etc/group'];
/** Only libatomic's declared image symlink changes its visible mountpoint. */
const ATOMIC_CANONICAL_PATH = '/usr/lib64/libatomic.so.1';
/** One privately mounted role after exact pathname and access-mode checks. */
type RoleMount = {
  /** Visible kernel pathname, never a host locator from the launch JSON. */
  readonly point: string;
  /** Output is the only writable application role. */
  readonly mode: 'ro' | 'rw';
};

/**
 * Checks per-mount access without confusing it with superblock flags.
 *
 * @param mount - current namespace observation
 *
 * @param mode - fixed access role
 *
 * @returns Whether exactly the intended read/write mode is present
 *
 * @example
 * ```ts
 * const valid = mountMode({ mount, mode: 'ro' });
 * ```
 */
function mountMode({ mount, mode, }: { readonly mount: ProducerInputHostMount; readonly mode: 'ro' | 'rw'; },): boolean {
  return mount.options.includes(mode) && !mount.options.includes(mode === 'ro' ? 'rw' : 'ro');
}

/**
 * Recognizes only declared platform mounts rather than accepting arbitrary virtual-tree prefixes.
 *
 * @param mount - kernel mount observation
 *
 * @returns Whether filesystem, pathname and required access restrictions match
 *
 * @example
 * ```ts
 * const valid = platformMount(mount);
 * ```
 */
function platformMount(mount: ProducerInputHostMount): boolean {
  if (ACCOUNT_MOUNTS.includes(mount.point)) {
    return mountMode({ mount, mode: 'ro' }) && ['nosuid', 'nodev', 'noexec'].every(function restricted(flag): boolean {
      return mount.options.includes(flag);
    });
  }
  return PLATFORM_MOUNT_GROUPS.some(function allowed(group): boolean {
    return group.filesystem === mount.filesystem && group.points.includes(mount.point)
      && mountMode({ mount, mode: group.mode }) && group.flags.every(function restricted(flag): boolean {
        return mount.options.includes(flag);
      });
  });
}

/**
 * Checks the actual child namespace before reading launch, selection, runtime or corpus bodies.
 * The caller separately binds the image and startup implementation before Node begins execution.
 *
 * @throws ProducerInputRunError when roles, aliases or platform mounts differ
 *
 * @example
 * ```ts
 * await verifyProducerInputChildMounts();
 * ```
 */
export async function verifyProducerInputChildMounts(): Promise<void> {
  try {
    /** Kernel metadata is read before any mounted application input body. */
    const mounts = readProducerInputHostMounts(await readFile('/proc/self/mountinfo', 'utf8'));
    /** Fixed application role locations do not come from supplied launch paths. */
    const paths = [PRODUCER_INPUT_PATHS.node, PRODUCER_INPUT_PATHS.bootstrap, PRODUCER_INPUT_PATHS.launch,
      PRODUCER_INPUT_PATHS.runtime, PRODUCER_INPUT_PATHS.atomicLibrary, PRODUCER_INPUT_PATHS.selection,
      PRODUCER_INPUT_PATHS.supporting, PRODUCER_INPUT_PATHS.corpus, PRODUCER_INPUT_PATHS.output];
    /** Canonicalization may follow only the independently measured image's libatomic alias. */
    const roles = await mapOverlapped({ items: paths, overlap: 1, oneItem: async function role({ item }): Promise<RoleMount> {
      /** The actual mountpoint is distinct from a declared logical image path. */
      const point = await realpath(item);
      /** Other role aliases could merge writable output with read-only inputs. */
      const expected = item === PRODUCER_INPUT_PATHS.atomicLibrary ? ATOMIC_CANONICAL_PATH : item;
      if (point !== expected)
        throw new ProducerInputRunError({ operation: 'verify-runtime', locator: item, });
      return { point, mode: item === PRODUCER_INPUT_PATHS.output ? 'rw' : 'ro' };
    } });
    /** Role stacking cannot be silently interpreted as another filesystem capability. */
    const required: readonly RoleMount[] = [...roles, { point: '/', mode: 'ro' }, { point: '/tmp', mode: 'rw' }];
    if (required.some(function missing(role): boolean {
      /** Exactly one observed role mount must carry the fixed access mode. */
      const matches = mounts.filter(function atPoint(mount): boolean { return mount.point === role.point; });
      /** Missing and stacked roles both withhold the import gate. */
      const [match] = matches;
      return matches.length !== 1 || match === undefined || !mountMode({ mount: match, mode: role.mode });
    }))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: 'child role mounts', });
    if (mounts.some(function unexpected(mount): boolean {
      if (required.some(function role(value): boolean { return value.point === mount.point; }))
        return mount.point === '/tmp' && (mount.filesystem !== 'tmpfs' || !['nosuid', 'nodev', 'noexec'].every(function restricted(flag): boolean { return mount.options.includes(flag); }));
      return !platformMount(mount);
    }))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: 'child platform mounts', });
    /** Required platform boundaries are checked even when no unexpected mount was found. */
    const platformPoints = [...ACCOUNT_MOUNTS, ...PLATFORM_MOUNT_GROUPS.flatMap(function points(group): readonly string[] { return group.points; })];
    if (platformPoints.some(function missing(point): boolean { return !mounts.some(function present(mount): boolean { return mount.point === point; }); }))
      throw new ProducerInputRunError({ operation: 'verify-runtime', locator: 'child platform mount coverage', });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError && error.operation === 'verify-runtime')
      throw error;
    throw new ProducerInputRunError({ operation: 'verify-runtime', locator: 'child mount topology', });
  }
}

//endregion Fixed child mount profile before application or input-body reads
