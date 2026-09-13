//region Fixed platform mount vocabulary, separate from namespace observation

/**
 * One fixed system-mount family, never a caller-supplied mount instruction.
 */
type PlatformMountGroup = {
  /**
   * Expected kernel filesystem implementation.
   */
  readonly filesystem: string;
  /**
   * Fixed per-mount read/write mode.
   */
  readonly mode: 'ro' | 'rw';
  /**
   * Exact allowed mountpoints, not open-ended directory prefixes.
   */
  readonly points: readonly string[];
  /**
   * Required restrictions remain independent from read/write mode.
   */
  readonly flags: readonly string[];
};
/**
 * System mounts observed under the pinned no-network image and OCI invocation.
 */
export const PLATFORM_MOUNT_GROUPS: readonly PlatformMountGroup[] = [
  {
    filesystem: 'proc',
    mode: 'rw',
    points: ['/proc'],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'proc',
    mode: 'ro',
    points: [
      '/proc/asound',
      '/proc/bus',
      '/proc/fs',
      '/proc/irq',
      '/proc/sys',
      '/proc/sysrq-trigger'
    ],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'tmpfs',
    mode: 'ro',
    points: ['/dev'],
    flags: ['nosuid']
  },
  {
    filesystem: 'tmpfs',
    mode: 'ro',
    points: [
      '/dev/shm',
      '/etc/hosts',
      '/etc/hostname',
      '/run/.containerenv'
    ],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'tmpfs',
    mode: 'ro',
    points: [
      '/proc/acpi',
      '/proc/scsi',
      '/sys/devices/virtual/powercap',
      '/sys/firmware',
      '/sys/fs/selinux'
    ],
    flags: [
      'nosuid',
      'nodev'
    ]
  },
  {
    filesystem: 'sysfs',
    mode: 'ro',
    points: ['/sys'],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'cgroup2',
    mode: 'ro',
    points: ['/sys/fs/cgroup'],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'devpts',
    mode: 'rw',
    points: ['/dev/pts'],
    flags: [
      'nosuid',
      'noexec'
    ]
  },
  {
    filesystem: 'mqueue',
    mode: 'rw',
    points: ['/dev/mqueue'],
    flags: [
      'nosuid',
      'nodev',
      'noexec'
    ]
  },
  {
    filesystem: 'devtmpfs',
    mode: 'rw',
    points: [
      '/dev/null',
      '/dev/zero',
      '/dev/full',
      '/dev/tty',
      '/dev/random',
      '/dev/urandom'
    ],
    flags: [
      'nosuid',
      'noexec'
    ]
  },
  {
    filesystem: 'devtmpfs',
    mode: 'ro',
    points: [
      '/proc/kcore',
      '/proc/keys',
      '/proc/latency_stats',
      '/proc/timer_list',
      '/proc/interrupts'
    ],
    flags: ['nosuid']
  },
];
/**
 * Account projection files are declared platform inputs, not part of the immutable image.
 */
export const ACCOUNT_MOUNTS: readonly string[] = [
  '/etc/passwd',
  '/etc/group'
];

//endregion Fixed platform mount vocabulary, separate from namespace observation
