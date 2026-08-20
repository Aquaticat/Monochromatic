import {
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import type { SliceCache, } from '../slice-cache.ts';

//region Slice cache namespace
// How two lanes share one per-entry cache directory without touching each
// other's work.
//
// A lane owns a FILE PREFIX and its own generation marker. Everything else
// follows: a lane loads only its own files, stamps only its own marker, and
// when its generation moves it deletes only its own files. One shared marker
// plus a directory-wide delete, which is what this replaced, means a translate
// change throws away every settled repair slice in the corpus and vice versa.
//
// The repair lane owns the UNPREFIXED names deliberately: those files already
// exist on disk from earlier passes, and renaming them would discard real work
// to gain nothing.

/**
 * File suffix every persisted slice carries.
 */
const JSON_SUFFIX = '.json';

/**
 * Prefixes that belong to a named lane.
 *
 * The unprefixed namespace is defined as everything NOT in this list, so adding
 * a lane here is what keeps the older one from adopting its files.
 *
 * FORGETTING TO ADD ONE IS SILENT AND HAS NOW COST FOUR TIMES. The repair lane
 * adopts the unregistered files, and its `discardNamespace` deletes them on the
 * next generation change while logging that it discarded its own slices. The
 * most recent was `picture.`, added to the store the same day it was added
 * here: opening the repair cache removed a picture reading and reported
 * "discarding 1 cached slices".
 *
 * SO: A NEW NAMESPACE IS NOT DONE UNTIL ITS PREFIX IS IN THIS LIST. Nothing
 * else enforces it, which is why `slice-cache-namespace.unit.test.ts` asserts
 * that every namespace this package defines appears here.
 */
const CLAIMED_PREFIXES: readonly string[] = [
  'translate.',
  'picture.',
];

/**
 * One lane's claim on a shared cache directory.
 *
 * @example
 * ```ts
 * const namespace: SliceNamespace = { prefix: 'translate.', marker: 'translate-generation.txt', };
 * ```
 */
export type SliceNamespace = {
  /**
   * File-name prefix this lane's slices carry; empty for the repair lane, which
   * owns the unprefixed names already on disk.
   */
  readonly prefix: string;

  /**
   * File recording which pipeline filled this lane's slices.
   *
   * Deliberately not a `.json` name, so a slice loader cannot mistake a marker
   * for a settled slice.
   */
  readonly marker: string;
};

/**
 * Repair lane's claim: the unprefixed names written by every pass so far.
 */
export const REPAIR_SLICE_NAMESPACE: SliceNamespace = {
  prefix: '',
  marker: 'generation.txt',
};

/**
 * Translate lane's claim.
 */
export const TRANSLATE_SLICE_NAMESPACE: SliceNamespace = {
  prefix: 'translate.',
  marker: 'translate-generation.txt',
};

/**
 * Block pairing's claim.
 *
 * NOT A LANE either. A pairing is bought once per document pair and read by both
 * lanes, so it retires with the entry like everything else here and can never be
 * mistaken for a settled slice.
 */
export const PAIRING_NAMESPACE: SliceNamespace = {
  prefix: 'pairing.',
  marker: 'pairing-generation.txt',
};

/**
 * Picture readings' claim.
 *
 * NOT A LANE, and named as one anyway because the store is the same. A reading
 * is neither a repair outcome nor a translated slice; it is evidence gathered
 * before either lane runs, keyed by the picture rather than by any slice.
 */
export const PICTURE_READING_NAMESPACE: SliceNamespace = {
  prefix: 'picture.',
  marker: 'picture-generation.txt',
};

/**
 * Whether a file in a shared cache directory belongs to one lane.
 *
 * @param name - file name as `readdir` returned it
 *
 * @param namespace - lane asking
 *
 * @returns True when that lane owns the file
 *
 * @example
 * ```ts
 * if (belongsToNamespace({ name, namespace, },)) resumed.set(key, parsed,);
 * ```
 */
export function belongsToNamespace(
  {
    name,
    namespace,
  }: {
    readonly name: string;
    readonly namespace: SliceNamespace;
  },
): boolean {
  if (!name.endsWith(JSON_SUFFIX,))
    return false;
  if (namespace.prefix !== '')
    return name.startsWith(namespace.prefix,);
  return !CLAIMED_PREFIXES.some(function isClaimed(prefix,): boolean {
    return name.startsWith(prefix,);
  },);
}

/**
 * Slice key a file name carries.
 *
 * @param name - file name owned by this lane
 *
 * @param namespace - lane owning it
 *
 * @returns Key the driver derived
 *
 * @example
 * ```ts
 * const key = keyOfSliceFile({ name, namespace, },);
 * ```
 */
export function keyOfSliceFile(
  {
    name,
    namespace,
  }: {
    readonly name: string;
    readonly namespace: SliceNamespace;
  },
): string {
  return name.slice(
    namespace.prefix
      .length,
    -JSON_SUFFIX.length,
  );
}

/**
 * File name one lane writes a key under.
 *
 * @param key - slice key
 *
 * @param namespace - lane writing it
 *
 * @returns File name inside the entry directory
 *
 * @example
 * ```ts
 * const name = sliceFileName({ key, namespace, },);
 * ```
 */
export function sliceFileName(
  {
    key,
    namespace,
  }: {
    readonly key: string;
    readonly namespace: SliceNamespace;
  },
): string {
  return `${namespace.prefix}${key}${JSON_SUFFIX}`;
}

/**
 * Wraps one settled slice with the key it was stored under.
 *
 * WHY THE KEY IS INSIDE THE FILE as well as in its name. The name is what a
 * loader derives the key from, so a payload sitting under the wrong name is
 * resumed as though it belonged there, and the driver splices it into a slice
 * it was never computed for. That used to be caught downstream, by both lanes
 * refusing a record whose slice index disagreed with the one they asked for;
 * taking the index out of the cache key made that check wrong, since a record
 * now legitimately answers for any slice carrying the same texts. This is the
 * check that replaces it, and it tests the thing that actually matters: not
 * where the record sat, but what question it answered.
 *
 * @param key - key this slice is being stored under
 *
 * @param serialized - record as its lane serialized it
 *
 * @returns Envelope text to write
 *
 * @example
 * ```ts
 * const text = envelopedSlice({ key, serialized, },);
 * ```
 */
function envelopedSlice(
  {
    key,
    serialized,
  }: {
    readonly key: string;
    readonly serialized: string;
  },
): string {
  return JSON.stringify({
    cacheKey: key,
    record: JSON.parse(serialized,) as unknown,
  },);
}

/**
 * Reads one cache file's envelope, when it is one this loader wrote.
 *
 * @param parsed - parsed file contents
 *
 * @param key - key the file's NAME says it answers
 *
 * @returns Record inside, or nothing when the file is not an envelope or
 * answers a different key
 *
 * @example
 * ```ts
 * const record = recordOfEnvelope({ parsed, key, },);
 * ```
 */
function recordOfEnvelope(
  {
    parsed,
    key,
  }: {
    readonly parsed: unknown;
    readonly key: string;
  },
): unknown {
  if (((typeof parsed) !== 'object') || (parsed === null))
    return undefined;
  if ((!('cacheKey' in parsed)) || (!('record' in parsed)))
    return undefined;
  if (parsed.cacheKey !== key)
    return undefined;
  return parsed.record;
}

/**
 * Loads one lane's settled slices, tolerating a missing directory and
 * half-written files.
 *
 * @param dir - per-entry cache directory
 *
 * @param namespace - lane loading
 *
 * @param isValue - guard deciding whether a parsed file is this lane's value;
 * anything it rejects is treated as absent and recomputed
 *
 * @returns Settled values keyed by slice key
 *
 * @example
 * ```ts
 * const resumed = await loadNamespacedSlices({ dir, namespace, isValue, },);
 * ```
 */
export async function loadNamespacedSlices<ValueT,>(
  {
    dir,
    namespace,
    isValue,
  }: {
    readonly dir: string;
    readonly namespace: SliceNamespace;
    readonly isValue: (value: unknown,) => value is ValueT;
  },
): Promise<Map<string, ValueT>> {
  /**
   * Settled values keyed by slice key.
   */
  const resumed = new Map<string, ValueT>();

  /**
   * File names present under the directory.
   */
  const names = await readDirectoryNames({ dir, },);
  for (const name of names) {
    if (!belongsToNamespace({
      name,
      namespace,
    },))
      continue;
    try {
      /**
       * Parsed JSON of this cache file, checked before it is trusted.
       */
      /* oxlint-disable-next-line no-await-in-loop -- small per-entry cache read sequentially at setup */
      const parsed: unknown = JSON.parse(await readFile(
        join(
          dir,
          name,
        ),
        'utf8',
      ),);

      /**
       * Key this file's NAME says it answers.
       */
      const key = keyOfSliceFile({
        name,
        namespace,
      },);

      /**
       * Record inside, absent when the file is not an envelope this loader
       * wrote or when it answers some other key. Both are treated as absent
       * rather than as failures: a slice nobody can vouch for simply costs what
       * an uncached one costs.
       */
      const record = recordOfEnvelope({
        parsed,
        key,
      },);
      if (isValue(record,))
        resumed.set(
          key,
          record,
        );
    }
    catch (error) {
      // A half-written file (SyntaxError) is recomputed; other faults surface.
      if (!(error instanceof SyntaxError))
        throw error;
    }
  }
  return resumed;
}

/**
 * Lists a directory, reporting an absent one as empty.
 *
 * @param dir - directory to list
 *
 * @returns File names, empty when the directory does not exist
 *
 * @example
 * ```ts
 * const names = await readDirectoryNames({ dir, },);
 * ```
 */
export async function readDirectoryNames(
  { dir, }: { readonly dir: string; },
): Promise<readonly string[]> {
  try {
    return await readdir(dir,);
  }
  catch (error) {
    // An absent directory (ENOENT) means no prior progress; anything else is a
    // real fault and must surface.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return [];
    throw error;
  }
}

/**
 * Reads the pipeline that filled one lane's slices.
 *
 * @param dir - per-entry cache directory
 *
 * @param namespace - lane asking
 *
 * @returns Recorded digest, empty when this lane never wrote here
 *
 * @throws Error when the marker exists and cannot be read, since treating an
 * unreadable marker as absent would DELETE the lane's settled slices
 *
 * @example
 * ```ts
 * const cached = await readNamespaceGeneration({ dir, namespace, },);
 * ```
 */
export async function readNamespaceGeneration(
  {
    dir,
    namespace,
  }: {
    readonly dir: string;
    readonly namespace: SliceNamespace;
  },
): Promise<string> {
  try {
    /**
     * Raw marker text, including its trailing newline.
     */
    const text = await readFile(
      join(
        dir,
        namespace.marker,
      ),
      'utf8',
    );
    return text.trim();
  }
  catch (error) {
    // Absent is the ordinary state for a lane that has not written here yet.
    // Anything else, a permission fault above all, must NOT read as absent:
    // that answer discards every settled slice this lane owns.
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT'))
      return '';
    throw error;
  }
}

/**
 * Opens one lane's slice cache inside a shared entry directory.
 *
 * A cache filled by a different pipeline is DISCARDED rather than resumed, and
 * only this lane's files are discarded. Resuming across pipelines is the one
 * generation defect no reader can catch: the settled artifact records a single
 * digest, so an entry built half from cached slices and half from current code
 * looks like ordinary work to every filter downstream.
 *
 * @param dir - per-entry cache directory, shared with other lanes
 *
 * @param generation - digest of the built pipeline this pass runs
 *
 * @param namespace - lane opening
 *
 * @param isValue - guard for this lane's stored value
 *
 * @returns Cache resuming this lane's settled slices and persisting new ones
 *
 * @example
 * ```ts
 * const cache = await openNamespacedCache({ dir, generation, namespace, isValue, },);
 * ```
 */
export async function openNamespacedCache<ValueT,>(
  {
    dir,
    generation,
    namespace,
    isValue,
  }: {
    readonly dir: string;
    readonly generation: string;
    readonly namespace: SliceNamespace;
    readonly isValue: (value: unknown,) => value is ValueT;
  },
): Promise<SliceCache<ValueT>> {
  await mkdir(
    dir,
    { recursive: true, },
  );

  /**
   * Pipeline that filled this lane's slices, empty when it never wrote here.
   */
  const cached = await readNamespaceGeneration({
    dir,
    namespace,
  },);

  /**
   * This lane's settled slices, kept only when the pipeline that produced them
   * is the one running now.
   */
  const resumed = (cached === generation)
    ? await loadNamespacedSlices({
      dir,
      namespace,
      isValue,
    },)
    : new Map<string, ValueT>();
  if (cached !== generation) {
    await discardNamespace({
      dir,
      namespace,
      cached,
    },);
  }

  // Written after any discard, so the marker always describes what this lane
  // now holds. A torn write reads as a mismatch on the next open, which
  // discards rather than resumes, so the failure direction is safe.
  await writeFile(
    join(
      dir,
      namespace.marker,
    ),
    `${generation}\n`,
  );

  return {
    resumed,
    persist: async function persistSlice({
      key,
      serialized,
    },): Promise<void> {
      await writeFile(
        join(
          dir,
          sliceFileName({
            key,
            namespace,
          },),
        ),
        `${
          envelopedSlice({
            key,
            serialized,
          },)
        }\n`,
      );
    },
  };
}

/**
 * Removes one lane's slices from a shared directory, leaving every other lane's
 * work in place.
 *
 * @param dir - per-entry cache directory
 *
 * @param namespace - lane whose slices go
 *
 * @param cached - digest those slices were filled by, for the log line
 *
 * @example
 * ```ts
 * await discardNamespace({ dir, namespace, cached, },);
 * ```
 */
export async function discardNamespace(
  {
    dir,
    namespace,
    cached,
  }: {
    readonly dir: string;
    readonly namespace: SliceNamespace;
    readonly cached: string;
  },
): Promise<void> {
  /**
   * This lane's files, named before any of them is removed.
   */
  const owned = (await readDirectoryNames({ dir, },))
    .filter(function isOwned(name,): boolean {
      return belongsToNamespace({
        name,
        namespace,
      },);
    },);
  if (owned.length > 0) {
    console.log(
      `SLICE discarding ${String(owned.length,)} cached slices in ${dir}: `
        + `filled by ${cached === '' ? '(unstamped)' : cached}`,
    );
  }
  await Promise.all(owned.map(async function removeOne(name,): Promise<void> {
    await rm(
      join(
        dir,
        name,
      ),
      { force: true, },
    );
  },),);
}

//endregion Slice cache namespace
