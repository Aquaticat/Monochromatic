/**
 * Exact configured-project fingerprint for semantic cache invalidation.
 *
 * @module
 */

import {
  createHash,
  type Hash,
} from 'node:crypto';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

import type { Project, } from 'typescript/unstable/sync';
import type { SourceFile, } from 'typescript/unstable/ast';

import { contentDigest, } from './effect-summary-cache-identity.ts';

/**
 * Fingerprint and per-source identities for one project snapshot.
 */
export type EffectProjectFingerprint = {
  readonly digest: string;
  readonly fileListDigest: string;
  readonly sourceDigests: ReadonlyMap<string, string>;
};

/**
 * Updates digest with unambiguous string field.
 *
 * @param digest - Hash receiving length-prefixed text.
 *
 * @param value - Text field to append.
 *
 * @returns same hash for nested calls.
 *
 * @mutates digest - `digest.update` appends field length and bytes.
 */
function updateString({
  digest,
  value,
}: {
  readonly digest: Hash;
  readonly value: string;
},): Hash {
  return digest
    .update(String(value.length,),)
    .update(':',)
    .update(value,);
}

/**
 * Tests whether compiler option value is a property-bearing record.
 *
 * @param value - Compiler option value.
 *
 * @returns whether string-keyed properties can be inspected.
 */
function isPlainRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Updates digest with deterministic JSON-compatible value representation.
 *
 * @param digest - Hash receiving canonical fields.
 *
 * @param value - Compiler option value decoded by TypeScript API.
 *
 * @mutates digest - `digest.update` appends deterministic type and value representation.
 */
function updatePlainValue({
  digest,
  value,
}: {
  readonly digest: Hash;
  readonly value: unknown;
},): void {
  if (value === null) {
    updateString({
      digest,
      value: 'null',
    },);
    return;
  }
  if ((typeof value) === 'string') {
    updateString({
      digest,
      value: `string:${value}`,
    },);
    return;
  }
  if ((typeof value) === 'number') {
    updateString({
      digest,
      value: `number:${value}`,
    },);
    return;
  }
  if ((typeof value) === 'boolean') {
    updateString({
      digest,
      value: value ? 'boolean:true' : 'boolean:false',
    },);
    return;
  }
  if ((typeof value) === 'undefined') {
    updateString({
      digest,
      value: 'undefined',
    },);
    return;
  }
  if (((typeof value) === 'bigint') || ((typeof value) === 'symbol')
    || ((typeof value) === 'function'))
    throw new Error(`Unsupported compiler option value type: ${typeof value}.`,);
  if (Array.isArray(value,)) {
    updateString({
      digest,
      value: 'array',
    },);
    for (const element of value) {
      updatePlainValue({
        digest,
        value: element,
      },);
    }
    return;
  }
  if (!isPlainRecord(value,))
    throw new Error('Compiler option fingerprint supports only JSON-compatible values.',);
  updateString({
    digest,
    value: 'record',
  },);
  Object.keys(value,)
    .toSorted()
    .forEach(function updateProperty(key,): void {
      updateString({
        digest,
        value: key,
      },);
      updatePlainValue({
        digest,
        value: value[key],
      },);
    },);
}

/**
 * Sentinel when no governing pnpm lockfile exists.
 */
const LOCKFILE_NOT_FOUND: unique symbol = Symbol('governing pnpm lockfile not found',);

/**
 * Finds nearest pnpm lockfile governing configured project.
 *
 * @param configFileName - TypeScript configuration path.
 *
 * @returns lockfile path or domain-specific absent sentinel.
 */
function nearestLockfile(
  configFileName: string,
): string | typeof LOCKFILE_NOT_FOUND {
  /**
   * Mutable ancestor cursor bounded by filesystem root.
   */
  const cursor = { current: dirname(configFileName,), };
  while (true) {
    /**
     * Candidate pnpm lockfile at current ancestor.
     */
    const candidate = join(
      cursor.current,
      'pnpm-lock.yaml',
    );
    // oxlint-disable-next-line no-restricted-syntax/no-sync -- Synchronous semantic visitor resolves cache identity before analysis.
    if (existsSync(candidate,))
      return candidate;
    /**
     * Parent directory for next bounded ancestor step.
     */
    const parent = dirname(cursor.current,);
    if (parent === cursor.current)
      return LOCKFILE_NOT_FOUND;
    cursor.current = parent;
  }
}

/**
 * Reads exact source text from active overlay or filesystem.
 *
 * @param project - TypeScript project providing fallback decoded source.
 *
 * @param activeSourceFile - Active Oxlint overlay source.
 *
 * @param fileName - Program source path to fingerprint.
 *
 * @returns exact source text.
 */
function projectSourceText({
  project,
  activeSourceFile,
  fileName,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
  readonly fileName: string;
},): string {
  if (fileName === activeSourceFile.fileName)
    return activeSourceFile.text;
  try {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor hashes project files once on cache lookup. */
    /**
     * Disk source text matching configured project snapshot.
     */
    const text = readFileSync(
      fileName,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    return text;
  }
  catch (error) {
    /**
     * Decoded virtual or bundled source unavailable through ordinary filesystem.
     */
    const fallback = project.program
      .getSourceFile(fileName,)
      ?.text;
    if (fallback !== undefined)
      return fallback;
    throw new Error(
      `Cannot fingerprint project source ${fileName}: ${String(error,)}`,
      { cause: error },
    );
  }
}

/**
 * Computes exact semantic project fingerprint and source digest map.
 *
 * @param project - Configured TypeScript project.
 *
 * @param activeSourceFile - Current overlay source.
 *
 * @returns project digest,
 * file-list digest,
 * and per-source digests.
 *
 * @example
 * ```ts
 * const fingerprint = effectProjectFingerprint({ project, activeSourceFile });
 * ```
 */
export function effectProjectFingerprint({
  project,
  activeSourceFile,
}: {
  readonly project: Project;
  readonly activeSourceFile: SourceFile;
},): EffectProjectFingerprint {
  /**
   * Stable program file order independent from TypeScript insertion order.
   */
  const fileNames = project.program
    .getSourceFileNames()
    .toSorted();
  /**
   * Digest detecting project graph membership changes.
   */
  const fileListDigest = contentDigest(fileNames.join('\0',),);
  /**
   * Per-source content identities retained for process-local active-file hits.
   */
  const sourceDigests = new Map<string, string>();
  /**
   * Complete semantic identity digest.
   */
  const digest = createHash('sha256',);
  updateString({
    digest,
    value: project.configFileName,
  },);
  updatePlainValue({
    digest,
    value: project.compilerOptions,
  },);
  fileNames.forEach(function hashSource(fileName,): void {
    /**
     * Exact source text from overlay or configured snapshot.
     */
    const sourceText = projectSourceText({
      project,
      activeSourceFile,
      fileName,
    },);
    /**
     * Source content identity.
     */
    const sourceDigest = contentDigest(sourceText,);
    sourceDigests.set(
      fileName,
      sourceDigest,
    );
    updateString({
      digest,
      value: fileName,
    },);
    updateString({
      digest,
      value: sourceDigest,
    },);
  },);
  /**
   * Governing lockfile whose package identities affect resolution.
   */
  const lockfile = nearestLockfile(project.configFileName,);
  if ((typeof lockfile) !== 'symbol') {
    /* oxlint-disable no-restricted-syntax/no-sync -- Synchronous semantic visitor includes exact lockfile identity once per project cache miss. */
    /**
     * Lockfile text for package-resolution invalidation.
     */
    const lockfileText = readFileSync(
      lockfile,
      'utf8',
    );
    /* oxlint-enable no-restricted-syntax/no-sync */
    updateString({
      digest,
      value: lockfile,
    },);
    updateString({
      digest,
      value: contentDigest(lockfileText,),
    },);
  }
  return {
    digest: digest.digest('hex',),
    fileListDigest,
    sourceDigests,
  };
}
