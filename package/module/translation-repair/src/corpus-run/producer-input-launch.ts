import {
  isAbsolute,
  resolve,
} from 'node:path';
import { ProducerInputRunError, } from './producer-input-error.ts';
import {
  readProducerInputFile,
  type ProducerInputFileIdentity,
} from './producer-input-file.ts';
import type {
  ProducerInputLaunch,
  ProducerInputLocatedFile,
} from './producer-input-model.ts';

//region Closed launch decoding before application import

/**
 * Narrows native JSON objects without asserting a record type over arbitrary objects or arrays.
 *
 * @param value - decoded launch field
 *
 * @returns Whether named JSON fields can be inspected
 *
 * @example
 * ```ts
 * if (isLaunchRecord(value)) inspect(value.version);
 * ```
 */
function isLaunchRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return (typeof value) === 'object' && (value !== null) && (!Array.isArray(value));
}

/**
 * Reads one JSON object only when its exact fixed key set is present.
 *
 * @param value - decoded launch field
 *
 * @param keys - fixed keys owned by this launch schema
 *
 * @param locator - authored field name for a privacy-safe refusal
 *
 * @returns Original JSON record after closed-shape validation
 *
 * @throws ProducerInputRunError when required keys or object shape differ
 *
 * @example
 * ```ts
 * const runtime = launchRecord({ value, keys: ['dir', 'manifest'], locator: 'launch.runtime' });
 * ```
 */
function launchRecord({
  value,
  keys,
  locator,
}: {
  readonly value: unknown;
  readonly keys: readonly string[];
  readonly locator: string;
},): Readonly<Record<string, unknown>> {
  if (!isLaunchRecord(value))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  /**
   * Native JSON object keys cannot silently add a command, mode, mount or environment override.
   */
  const actual = Object.keys(value);
  if ((actual.length !== keys.length) || (!actual.every(function expected(key): boolean {
    return keys.includes(key);
  })))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}

/**
 * Validates fixed-width lowercase hexadecimal identity without a regular-expression parser.
 *
 * @param value - untrusted JSON identity field
 *
 * @param length - exact width of the owning digest domain
 *
 * @param locator - authored field name
 *
 * @returns Original canonical identity spelling
 *
 * @throws ProducerInputRunError when identity grammar differs
 *
 * @example
 * ```ts
 * const sha256 = launchHex({ value, length: 64, locator: 'launch.bootstrap.sha256' });
 * ```
 */
function launchHex({
  value,
  length,
  locator,
}: {
  readonly value: unknown;
  readonly length: number;
  readonly locator: string;
},): string {
  if (((typeof value) !== 'string') || (value.length !== length))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  for (let index = 0; index < value.length; index += 1) {
    if (!'0123456789abcdef'.includes(value.charAt(index)))
      throw new ProducerInputRunError({
        operation: 'read-launch',
        locator,
      });
  }
  return value;
}

/**
 * Reads a safe exact byte allowance rather than silently rounding JSON numbers.
 *
 * @param value - untrusted extent
 *
 * @param locator - authored field name
 *
 * @returns Nonnegative safe integer extent
 *
 * @throws ProducerInputRunError when extent cannot bound an exact file read
 *
 * @example
 * ```ts
 * const bytes = launchBytes({ value, locator: 'launch.selection.bytes' });
 * ```
 */
function launchBytes({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): number {
  if (((typeof value) !== 'number') || (!Number.isSafeInteger(value))
    || (value < 0))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}

/**
 * Refuses relative or lexically changing locators before mount construction.
 * Filesystem canonicalization and ownership remain host checks, not claims made by this parser.
 *
 * @param value - untrusted path field
 *
 * @param locator - authored field name
 *
 * @returns Absolute lexically canonical path
 *
 * @throws ProducerInputRunError when path syntax differs
 *
 * @example
 * ```ts
 * const dir = launchPath({ value, locator: 'launch.runtime.dir' });
 * ```
 */
function launchPath({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): string {
  if (((typeof value) !== 'string') || (!isAbsolute(value))
    || value.includes('\0')
    || (resolve(value) !== value))
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return value;
}

/**
 * SHA-256 is represented by exactly this many lowercase hexadecimal characters.
 */
const SHA256_HEX_LENGTH = 64;
/**
 * The current native corpus pin uses the existing forty-character Git object domain.
 */
const CORPUS_HEX_LENGTH = 40;

/**
 * Reads one nonempty file identity; body-free supporting extents use their separate measured allowance.
 *
 * @param value - raw identity object
 *
 * @param locator - authored field name
 *
 * @returns Owned identity values
 *
 * @throws ProducerInputRunError when identity shape or extent differs
 *
 * @example
 * ```ts
 * const identity = launchIdentity({ value, locator: 'launch.bootstrap' });
 * ```
 */
function launchIdentity({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): ProducerInputFileIdentity {
  /**
   * Identity records accept no location or executable-selection field.
   */
  const record = launchRecord({
    value,
    keys: [
      'bytes',
      'sha256'
    ],
    locator,
  });
  /**
   * Executables, manifests and the original selection cannot be empty in this launch contract.
   */
  const bytes = launchBytes({
    value: record.bytes,
    locator,
  });
  if (bytes === 0)
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator,
    });
  return {
    bytes,
    sha256: launchHex({
      value: record.sha256,
      length: SHA256_HEX_LENGTH,
      locator,
    }),
  };
}

/**
 * Reads a located nonempty file without treating its path as an execution instruction.
 *
 * @param value - raw located-file object
 *
 * @param locator - authored field name
 *
 * @returns Owned file location and identity
 *
 * @throws ProducerInputRunError when location or identity differs
 *
 * @example
 * ```ts
 * const file = launchLocatedFile({ value, locator: 'launch.selection' });
 * ```
 */
function launchLocatedFile({
  value,
  locator,
}: {
  readonly value: unknown;
  readonly locator: string
}): ProducerInputLocatedFile {
  /**
   * The file's location and identity have one fixed representation.
   */
  const record = launchRecord({
    value,
    keys: [
      'path',
      'bytes',
      'sha256'
    ],
    locator,
  });
  return {
    path: launchPath({
      value: record.path,
      locator,
    }),
    ...launchIdentity({
      value: {
        bytes: record.bytes,
        sha256: record.sha256
      },
      locator,
    }),
  };
}

/**
 * Reads the exact independently identified launch before any application or supporting file is loaded.
 * No defaults, future operation modes, arbitrary mounts or caller-selected application entry are admitted.
 *
 * @param path - launch file selected by the trusted caller
 *
 * @param expected - independently recorded launch SHA-256 and byte extent
 *
 * @returns Owned closed launch data, not model or phase approval
 *
 * @throws ProducerInputRunError when bytes, decoding or launch fields differ
 *
 * @example
 * ```ts
 * const launch = await readProducerInputLaunch({ path, expected });
 * ```
 */
export async function readProducerInputLaunch({
  path,
  expected,
}: {
  readonly path: string;
  readonly expected: ProducerInputFileIdentity;
},): Promise<ProducerInputLaunch> {
  /**
   * File extent and raw hash are checked before JSON decoding.
   */
  const bytes = await readProducerInputFile({
    path,
    expected,
    operation: 'read-launch',
  });
  try {
    /**
     * Fatal UTF-8 decoding never turns altered bytes into replacement-character launch data.
     */
    const text = new TextDecoder(
      'utf-8',
      {
        fatal: true,
        ignoreBOM: true,
      }
    ).decode(bytes);
    /**
     * Native JSON parser details remain inside this controlled refusal boundary.
     */
    const value: unknown = JSON.parse(text);
    /**
     * The only supported launch operation has a closed field vocabulary.
     */
    const record = launchRecord({
      value,
      keys: [
        'version',
        'kind',
        'bootstrap',
        'podman',
        'imageId',
        'runtime',
        'atomicLibrary',
        'selection',
        'supporting',
        'corpus',
        'outputParent'
      ],
      locator: 'launch',
    });
    if ((record.version !== 1) || (record.kind !== 'producer-preparation-input-launch'))
      throw new ProducerInputRunError({
        operation: 'read-launch',
        locator: path,
      });
    /**
     * Runtime location does not choose the fixed application entry.
     */
    const runtime = launchRecord({
      value: record.runtime,
      keys: [
        'dir',
        'manifest'
      ],
      locator: 'launch.runtime',
    });
    /**
     * Supporting file discovery is limited to this root and caller-authorized total.
     */
    const supporting = launchRecord({
      value: record.supporting,
      keys: [
        'dir',
        'maximumBytes'
      ],
      locator: 'launch.supporting',
    });
    /**
     * Corpus semantics remain independently checked by the native input owner.
     */
    const corpus = launchRecord({
      value: record.corpus,
      keys: [
        'dir',
        'commitSha'
      ],
      locator: 'launch.corpus',
    });
    return {
      version: 1,
      kind: 'producer-preparation-input-launch',
      bootstrap: launchIdentity({
        value: record.bootstrap,
        locator: 'launch.bootstrap',
      }),
      podman: launchLocatedFile({
        value: record.podman,
        locator: 'launch.podman',
      }),
      imageId: launchHex({
        value: record.imageId,
        length: SHA256_HEX_LENGTH,
        locator: 'launch.imageId',
      }),
      runtime: {
        dir: launchPath({
          value: runtime.dir,
          locator: 'launch.runtime.dir',
        }),
        manifest: launchIdentity({
          value: runtime.manifest,
          locator: 'launch.runtime.manifest',
        }),
      },
      atomicLibrary: launchLocatedFile({
        value: record.atomicLibrary,
        locator: 'launch.atomicLibrary',
      }),
      selection: launchLocatedFile({
        value: record.selection,
        locator: 'launch.selection',
      }),
      supporting: {
        dir: launchPath({
          value: supporting.dir,
          locator: 'launch.supporting.dir',
        }),
        maximumBytes: launchBytes({
          value: supporting.maximumBytes,
          locator: 'launch.supporting.maximumBytes',
        }),
      },
      corpus: {
        dir: launchPath({
          value: corpus.dir,
          locator: 'launch.corpus.dir',
        }),
        commitSha: launchHex({
          value: corpus.commitSha,
          length: CORPUS_HEX_LENGTH,
          locator: 'launch.corpus.commitSha',
        }),
      },
      outputParent: launchPath({
        value: record.outputParent,
        locator: 'launch.outputParent',
      }),
    };
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    // Neither decoder nor parser exceptions may export launch bytes through an error cause.
    throw new ProducerInputRunError({
      operation: 'read-launch',
      locator: path,
    });
  }
}

//endregion Closed launch decoding before application import
