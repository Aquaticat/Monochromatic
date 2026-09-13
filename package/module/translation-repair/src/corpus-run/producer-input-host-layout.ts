import { lstat, readFile, realpath, } from 'node:fs/promises';
import { isDeepStrictEqual, } from 'node:util';
import { mapOverlapped, } from '../overlapped-map.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { producerInputPathWithin, readProducerInputHostMounts, type ProducerInputHostMount, } from './producer-input-host-mount.ts';
import type { ProducerInputLaunch, } from './producer-input-model.ts';

//region Rejection-only metadata preflight before output creation

/** Roles participate in one specialized host topology check, not arbitrary mount construction. */
type DirectoryRole = 'runtime' | 'supporting' | 'corpus' | 'output-parent';
/** Directory identity excludes timestamps that legitimate output creation necessarily changes. */
type ObservedDirectory = {
  /** Fixed launch role. */
  readonly role: DirectoryRole;
  /** Caller-authorized canonical absolute path. */
  readonly path: string;
  /** Point-in-time filesystem device observation, not an inferred mountinfo device encoding. */
  readonly device: string;
  /** Directory inode detects replacement between preflight and use. */
  readonly inode: string;
  /** Output privacy is tied to its actual owner. */
  readonly uid: number;
  /** Group observation is retained for drift checks. */
  readonly gid: number;
  /** Directory permissions cannot silently drift before input reads. */
  readonly mode: number;
};
/** Non-approval metadata remains bound to the exact directories inspected. */
export type ProducerInputHostLayout = {
  /** This profile deliberately refuses cross-mount and nested-mount ambiguity. */
  readonly scope: 'single-host-mount-input-layout';
  /** Kernel identity of the shared visible mount. */
  readonly mountId: string;
  /** Owned role identities, in the launch's fixed role order. */
  readonly directories: readonly ObservedDirectory[];
};
/** Group and other permissions cannot expose private output. */
const NON_PRIVATE_BITS = 0o077;

/**
 * Observes only directory metadata without following an unapproved canonical spelling.
 *
 * @param role - fixed input or output role
 *
 * @param path - already authorized launch locator
 *
 * @returns Owned point-in-time directory metadata
 *
 * @throws ProducerInputRunError when canonical path or directory shape differs
 *
 * @example
 * ```ts
 * const directory = await observeDirectory({ role: 'corpus', path });
 * ```
 */
async function observeDirectory({ role, path, }: { readonly role: DirectoryRole; readonly path: string; },): Promise<ObservedDirectory> {
  /** Canonicalization is metadata preflight, never permission to read content. */
  const canonical = await realpath(path);
  /** Descriptor-independent identity is rechecked after exclusive output creation. */
  const state = await lstat(path, { bigint: true });
  if (canonical !== path || !state.isDirectory())
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: path, });
  return { role, path, device: String(state.dev), inode: String(state.ino), uid: Number(state.uid), gid: Number(state.gid), mode: Number(state.mode), };
}

/**
 * Selects one unambiguous enclosing mount and rejects all nested mounts inside a participating directory.
 *
 * @param directory - canonical role metadata
 *
 * @param mounts - current kernel-reported namespace records
 *
 * @returns Unique enclosing mount ID for the deliberately restricted host profile
 *
 * @throws ProducerInputRunError when stacked, nested or missing mount evidence remains
 *
 * @example
 * ```ts
 * const id = directoryMount({ directory, mounts });
 * ```
 */
function directoryMount({ directory, mounts, }: { readonly directory: ObservedDirectory; readonly mounts: readonly ProducerInputHostMount[]; },): string {
  if (mounts.some(function nested(mount): boolean {
    return mount.point !== directory.path && producerInputPathWithin({ parent: directory.path, child: mount.point });
  }))
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: directory.path, });
  /** Component boundaries prevent a neighboring mount from being mistaken for an ancestor. */
  const covering = mounts.filter(function ancestor(mount): boolean {
    return producerInputPathWithin({ parent: mount.point, child: directory.path });
  });
  if (new Set(covering.map(function point(mount): string { return mount.point; })).size !== covering.length)
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: directory.path, });
  /** No array spread or recursive walk depends on the namespace's record count. */
  const length = covering.reduce(function longest(current, mount): number {
    return Math.max(current, mount.point.length);
  }, 0);
  /** Stacked alternatives are not ordered by mount ID or guessed from record position. */
  const closest = covering.filter(function atBoundary(mount): boolean { return mount.point.length === length; });
  /** An absent or ambiguous match grants no layout authority. */
  const [first] = closest;
  if (closest.length !== 1 || first === undefined)
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: directory.path, });
  return first.id;
}

/**
 * Establishes only the measured single-mount topology before any corpus/support body I/O.
 * Different or nested mounts are refused, not interpreted with filesystem-specific device assumptions.
 *
 * @param directories - fixed authorized role locators
 *
 * @param callerUid - host identity captured before asynchronous work
 *
 * @returns Rejection-only layout snapshot
 *
 * @throws ProducerInputRunError when output privacy, containment or mount evidence differs
 *
 * @example
 * ```ts
 * const layout = await observeHostLayout({ directories, callerUid });
 * ```
 */
async function observeHostLayout({ directories, callerUid, }: {
  readonly directories: readonly { readonly role: DirectoryRole; readonly path: string; }[];
  readonly callerUid: number;
},): Promise<ProducerInputHostLayout> {
  /** Kernel mount topology is metadata; no input tree is enumerated here. */
  const mounts = readProducerInputHostMounts(await readFile('/proc/self/mountinfo', 'utf8'));
  /** Serial metadata ownership keeps failure ordering aligned with fixed launch roles. */
  const observed = await mapOverlapped({ items: directories, overlap: 1, oneItem: async function one({ item }): Promise<ObservedDirectory> {
    return await observeDirectory(item);
  } });
  /** Output parent must be privately owned, not merely writable. */
  const parent = observed.find(function output(directory): boolean { return directory.role === 'output-parent'; });
  if (parent === undefined || parent.uid !== callerUid || (parent.mode & NON_PRIVATE_BITS) !== 0)
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'output parent', });
  if (observed.some(function overlaps(directory): boolean {
    return directory.role !== 'output-parent' && (producerInputPathWithin({ parent: directory.path, child: parent.path })
      || directory.device === parent.device && directory.inode === parent.inode);
  }))
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: parent.path, });
  /** One visible mount avoids asserting that kernel device fields describe arbitrary filesystem aliases. */
  const ids = observed.map(function mount(directory): string { return directoryMount({ directory, mounts }); });
  /** The current profile does not silently broaden to cross-mount execution. */
  const [mountId] = ids;
  if (mountId === undefined || ids.some(function different(id): boolean { return id !== mountId; }))
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host mount topology', });
  return { scope: 'single-host-mount-input-layout', mountId, directories: observed, };
}

/**
 * Snapshots the launch's directory roles before creating private output or reading any input bodies.
 * This neither authenticates the launch nor approves the reconstructed inputs.
 *
 * @param launch - independently authenticated owned launch
 *
 * @returns Metadata-only layout to revalidate after exclusive creation
 *
 * @throws ProducerInputRunError when the host or directory topology is outside the verified profile
 *
 * @example
 * ```ts
 * const layout = await inspectProducerInputHostLayout(launch);
 * ```
 */
export async function inspectProducerInputHostLayout(launch: ProducerInputLaunch): Promise<ProducerInputHostLayout> {
  if (process.platform !== 'linux' || typeof process.getuid !== 'function')
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host platform', });
  /** Host owner and launch paths are captured before metadata operations yield. */
  const callerUid = process.getuid();
  /** Caller changes cannot rewrite a captured role path during canonicalization. */
  const directories: readonly { readonly role: DirectoryRole; readonly path: string; }[] = [
    { role: 'runtime', path: launch.runtime.dir },
    { role: 'supporting', path: launch.supporting.dir },
    { role: 'corpus', path: launch.corpus.dir },
    { role: 'output-parent', path: launch.outputParent },
  ];
  try {
    return await observeHostLayout({ directories, callerUid });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host directory roles', });
  }
}

/**
 * Rechecks role identities and topology after output creation but before content operations or container startup.
 *
 * @param layout - owned earlier metadata observation, not a review certificate
 *
 * @throws ProducerInputRunError when a directory or effective mount differs
 *
 * @example
 * ```ts
 * await revalidateProducerInputHostLayout(layout);
 * ```
 */
export async function revalidateProducerInputHostLayout(layout: ProducerInputHostLayout): Promise<void> {
  /** Revalidation owns its comparison rather than following mutable caller metadata. */
  const expected = structuredClone(layout);
  if (typeof process.getuid !== 'function')
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host platform', });
  try {
    /** Fresh observations establish only the present filesystem boundary. */
    const current = await observeHostLayout({ directories: expected.directories, callerUid: process.getuid() });
    if (!isDeepStrictEqual(current, expected))
      throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host directory roles', });
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'verify-host-layout', locator: 'host directory roles', });
  }
}

//endregion Rejection-only metadata preflight before output creation
