/**
 * Strict exact-snapshot trusted MJS execution.
 *
 * @module
 */
import { createRequire, } from 'node:module';
import {
  mkdtemp,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import {
  validateConfig,
  type ValidatedConfig,
} from './config-validation.ts';
import { captureTrustSource, } from './candidate.ts';
import { validateMjs, } from './mjs-validator.ts';
import { writePrivateFile, } from './registry-io.ts';
import { readPrivateFile, } from './record-validation.ts';
import type {
  LoadedTrustedConfig,
  TrustCandidate,
  TrustRecord,
} from './types.ts';

/**
 * Trusted configuration loading failure code.
 */
export type TrustedConfigFailureCode =
  | 'config-untrusted'
  | 'config-changed'
  | 'trust-failed';
/**
 * Trusted configuration loading failure.
 */
export class TrustedConfigError extends Error {
  /**
   * Stable engine failure code.
   */
  public readonly code: TrustedConfigFailureCode;

  /**
   * Creates trusted configuration failure.
   *
   * @param code - stable engine event code
   *
   * @param message - safe failure explanation
   *
   * @param options - optional underlying cause
   */
  public constructor(
    code: TrustedConfigFailureCode,
    message: string,
    options?: Readonly<ErrorOptions>,
  ) {
    super(
      message,
      options,
    );
    this.name = 'TrustedConfigError';
    this.code = code;
  }
}

/**
 * Compares exact byte sequences without hashing.
 *
 * @param left - first byte sequence
 *
 * @param right - second byte sequence
 *
 * @returns whether lengths and every byte match
 *
 * @example
 * ```ts
 * exactBytesEqual({ left: new Uint8Array([1]), right: new Uint8Array([1]) });
 * ```
 */
export function exactBytesEqual({
  left,
  right,
}: Readonly<{
  left: Uint8Array;
  right: Uint8Array;
}>,): boolean {
  if (left.byteLength !== right.byteLength)
    return false;
  return left.every(function byteMatches(
    byte,
    index,
  ) {
    return byte === right[index];
  },);
}

/**
 * Disposable exact-byte ESM execution copy.
 */
type ExecutionCopy = Readonly<{
  /** Unique MJS path used to avoid Node's immutable ESM cache. */
  path: string;
  /** Removes private execution directory. */
  [Symbol.asyncDispose]: () => Promise<void>;
}>;

/**
 * Writes verified bytes to one unique private ESM path.
 *
 * Node's synchronous ESM loader caches by canonical path and cannot evict an
 * ESM namespace through `require.cache`. A unique exact-byte copy preserves
 * relaxed rebuild behavior without importing by a computed specifier.
 *
 * @param executablePath - private stored snapshot path
 *
 * @param bytes - already validated exact executable bytes
 *
 * @returns disposable unique execution copy
 *
 * @example
 * ```ts
 * await using copy = await createExecutionCopy({ executablePath, bytes });
 * ```
 */
async function createExecutionCopy({
  executablePath,
  bytes,
}: Readonly<{
  executablePath: string;
  bytes: Uint8Array;
}>,): Promise<ExecutionCopy> {
  /** Private uniquely named directory beside trusted snapshot. */
  const directory = await mkdtemp(join(dirname(executablePath,), '.execute-',),);
  /** Stable filename inside unique directory retains ESM format classification. */
  const path = join(directory, 'config.mjs',);
  await writePrivateFile({ path, bytes, },);
  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(directory, { recursive: true, force: true, },);
    },
  };
}

/**
 * Loads stored executable snapshot and validates default export.
 *
 * @param executablePath - private stored MJS path
 *
 * @returns runtime-authoritative validated configuration
 *
 * @example
 * ```ts
 * await executeStoredConfig('/private/snapshots/config.mjs');
 * ```
 */
export async function executeStoredConfig(executablePath: string,): Promise<ValidatedConfig> {
  /**
   * Exact stored executable bytes revalidated before import.
   */
  const executableBytes = await readPrivateFile(executablePath,);
  validateMjs({
    bytes: executableBytes,
    sourceName: executablePath,
  },);
  /** Unique exact-byte path prevents stale ESM cache reuse after relaxed rebuilds. */
  await using executionCopy = await createExecutionCopy({
    executablePath,
    bytes: executableBytes,
  },);
  /** Synchronous Node ESM loader rooted at private execution copy. */
  const require = createRequire(executionCopy.path,);
  /**
   * Loaded module namespace from exact private snapshot copy only.
   */
  const imported: unknown = (function requireStoredSnapshot() {
    try {
      return require(executionCopy.path,);
    }
    catch (error: unknown) {
      throw new TrustedConfigError(
        'trust-failed',
        `Stored configuration threw during execution: ${String(error,)}`,
        { cause: error, },
      );
    }
  })();
  if (((typeof imported) !== 'object') || (imported === null)
    || (!('default' in imported)))
    throw new TrustedConfigError(
      'trust-failed',
      'Stored configuration must provide a default export.',
    );
  try {
    return validateConfig(imported.default,);
  }
  catch (error: unknown) {
    throw new TrustedConfigError(
      'trust-failed',
      `Stored configuration validation failed: ${String(error,)}`,
      {
      cause: error,
    },
    );
  }
}

/**
 * Verifies live bytes against record and executes only stored snapshot.
 *
 * @param recordDirectory - exact record directory
 *
 * @param candidate - freshly captured live source
 *
 * @param record - validated record
 *
 * @returns loaded trusted config
 *
 * @example
 * ```ts
 * await loadStrictMjs({ recordDirectory, candidate, record });
 * ```
 */
export async function loadStrictMjs({
  recordDirectory,
  candidate,
  record,
}: Readonly<{
  recordDirectory: string;
  candidate: TrustCandidate;
  record: TrustRecord;
}>,): Promise<LoadedTrustedConfig> {
  /**
   * Canonical sole MJS source record.
   */
  const [source,] = record.sources;
  if ((record.format !== 'mjs') || (source === undefined)
    || (record.sources
      .length
      !== 1)
    || (record.identity
      .filesystemId
      !== candidate.identity
      .filesystemId)
    || (record.identity
      .canonicalConfigPath
      !== candidate.identity
      .canonicalConfigPath)
    || (record.repositoryRoot
      !== candidate.discovered
      .repositoryRoot)
    || (source.canonicalPath
      !== candidate.discovered
      .configPath))
    throw new TrustedConfigError(
      'trust-failed',
      'Trust record identity or source metadata does not match candidate.',
    );
  /**
   * Private executable snapshot path.
   */
  const snapshotPath = join(
    recordDirectory,
    record.executableSnapshotFile,
  );
  /**
   * Exact stored bytes compared directly without hashing.
   */
  const snapshotBytes = await readPrivateFile(snapshotPath,);
  if (!exactBytesEqual({
    left: candidate.bytes,
    right: snapshotBytes,
  })) {
    throw new TrustedConfigError(
      'config-changed',
      'cli-git configuration bytes changed; run `git cli-git trust` to review and trust the new snapshot.',
    );
  }
  /**
   * Runtime-authoritative config imported from stored path.
   */
  const validated = await executeStoredConfig(snapshotPath,);
  return {
    validated,
    record,
  };
}

/**
 * Verifies every tracked TypeScript source and executes stored bundle.
 *
 * @param recordDirectory - exact record directory
 *
 * @param candidate - freshly captured live entry
 *
 * @param record - validated TypeScript record
 *
 * @returns loaded trusted config
 *
 * @example
 * ```ts
 * await loadStrictTypeScript({ recordDirectory, candidate, record });
 * ```
 */
export async function loadStrictTypeScript({
  recordDirectory,
  candidate,
  record,
}: Readonly<{
  recordDirectory: string;
  candidate: TrustCandidate;
  record: TrustRecord;
}>,): Promise<LoadedTrustedConfig> {
  if ((record.format !== 'typescript')
    || (record.identity
      .filesystemId
      !== candidate.identity
      .filesystemId)
    || (record.identity
      .canonicalConfigPath
      !== candidate.identity
      .canonicalConfigPath)
    || (record.repositoryRoot
      !== candidate.discovered
      .repositoryRoot)
    || (!record.sources
      .some(function entrySource(source,) {
      return source.canonicalPath
        === candidate.discovered
        .configPath;
    },))) {
    throw new TrustedConfigError(
      'trust-failed',
      'TypeScript trust record identity or entry metadata does not match candidate.',
    );
  }
  /**
   * Exact comparison result for every tracked source.
   */
  const sourceMatches = await Promise.all(record.sources
    .map(async function sourceMatchesSnapshot(source,) {
    try {
      /**
       * Fresh exact live source bytes.
       */
      const liveBytes = source.canonicalPath
        === candidate.discovered
        .configPath
        ? candidate.bytes
        : (await captureTrustSource(source.canonicalPath,)).bytes;
      /**
       * Exact private source snapshot bytes.
       */
      const storedBytes = await readPrivateFile(join(
        recordDirectory,
        source.snapshotFile,
      ),);
      return exactBytesEqual({
        left: liveBytes,
        right: storedBytes,
      });
    }
    catch (error: unknown) {
      throw new TrustedConfigError(
        'config-changed',
        `Tracked TypeScript source is unavailable or changed: ${source.canonicalPath}`,
        { cause: error, },
      );
    }
  },),);
  if (sourceMatches.some(function changed(matches,) {
    return !matches;
  },)) {
    throw new TrustedConfigError(
      'config-changed',
      'Tracked TypeScript source bytes changed; run `git cli-git trust` to rebuild and review the bundle.',
    );
  }
  /**
   * Private executable bundle path.
   */
  const executablePath = join(
    recordDirectory,
    record.executableSnapshotFile,
  );
  /**
   * Runtime-authoritative config imported only from stored bundle.
   */
  const validated = await executeStoredConfig(executablePath,);
  return {
    validated,
    record,
  };
}
