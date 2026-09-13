import { isDeepStrictEqual, } from 'node:util';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';
import type {
  ProducerRuntimeFile,
  ProducerRuntimeManifest,
} from './producer-input-runtime-model.ts';

//region Recognized sealed-build metadata, not execution approval

/**
 * Exact loader declarations emitted by the existing dedicated build.
 */
export const PRODUCER_BUILD_LOADER_NAMES = [
  'NAPI_RS_NATIVE_LIBRARY_PATH',
  'NAPI_RS_FORCE_WASI',
  'NAPI_RS_ENFORCE_VERSION_CHECK',
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_ICU_DATA',
] as const;
/**
 * The application build explicitly leaves operating-system identity to the owning runner.
 */
const SYSTEM_LIBRARY_RESPONSIBILITY = 'Runner must separately bind its operating-system image and native shared-library inputs.';
/**
 * SHA-256's canonical lowercase hexadecimal width.
 */
const SHA256_WIDTH = 64;

/**
 * Narrows JSON records without admitting arrays.
 *
 * @param value - decoded manifest field
 *
 * @returns Whether named fields can be inspected
 *
 * @example
 * ```ts
 * if (runtimeRecord(value)) inspect(value.node);
 * ```
 */
function runtimeRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value));
}

/**
 * Checks the fixed keys of a manifest record.
 *
 * @param value - narrowed record
 *
 * @param expected - keys owned by this build schema
 *
 * @returns Whether no required or additional field differs
 *
 * @example
 * ```ts
 * const valid = runtimeKeys({ value, expected: ['version', 'files'] });
 * ```
 */
function runtimeKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[]
}): boolean {
  /**
   * Key order does not create a different schema, though raw manifest identity remains exact.
   */
  const keys = Object.keys(value);
  return (keys.length === expected.length) && keys.every(function known(key): boolean {
    return expected.includes(key);
  });
}

/**
 * Validates byte identity fields without trusting a type assertion from decoded JSON.
 *
 * @param value - decoded identity
 *
 * @returns Whether exact nonnegative extent and raw SHA-256 are present
 *
 * @example
 * ```ts
 * const valid = runtimeIdentity(value);
 * ```
 */
function runtimeIdentity(value: unknown): value is ProducerInputFileIdentity {
  if ((!runtimeRecord(value)) || (typeof value.bytes) !== 'number' || (!Number.isSafeInteger(value.bytes))
    || (value.bytes < 0) || (typeof value.sha256) !== 'string' || (value.sha256.length !== SHA256_WIDTH))
    return false;
  for (let index = 0; index
    < value.sha256
    .length; index += 1) {
    if (!'0123456789abcdef'.includes(value.sha256
      .charAt(index)))
      return false;
  }
  return true;
}

/**
 * Admits only flat executable/native names owned by the sealed runtime inventory.
 *
 * @param value - decoded runtime file
 *
 * @returns Whether identity and a non-traversing runtime name are present
 *
 * @example
 * ```ts
 * const valid = runtimeFile(value);
 * ```
 */
function runtimeFile(value: unknown): value is ProducerRuntimeFile {
  return runtimeRecord(value) && ((typeof value.path) === 'string')
    && (value.path
      .length
      > 0)
    && (!value.path
      .includes('/'))
    && (!value.path
      .includes('\\'))
    && (!value.path
      .includes('\0'))
    && (value.path
      .endsWith('.mjs')
      || value.path
      .endsWith('.node'))
    && runtimeIdentity(value);
}

/**
 * Checks the current complete build description before any contained filename receives authority.
 * Exact bytes are independently checked by the caller before this semantic shape test.
 *
 * @param value - decoded manifest, never an import instruction
 *
 * @returns Whether the current sealed-build schema is fully recognized
 *
 * @example
 * ```ts
 * if (!isProducerRuntimeManifest(value)) refuseRuntime();
 * ```
 */
export function isProducerRuntimeManifest(value: unknown): value is ProducerRuntimeManifest {
  if ((!runtimeRecord(value)) || (!runtimeKeys({
    value,
    expected: [
      'version',
      'kind',
      'scope',
      'target',
      'node',
      'native',
      'loaderEnvironment',
      'systemLibraries',
      'files'
    ],
  }))
    || (value.version !== 1)
    || (value.kind !== 'sealed-node-runtime-build')
    || (value.scope !== 'application-dependencies-only')
    || (!isDeepStrictEqual(
      value.target,
      {
        platform: 'linux',
        arch: 'x64',
        libc: 'glibc'
      }
    )))
    return false;
  /**
   * Each nested record has a fixed schema rather than inheriting unknown launch capabilities.
   */
  const {
    node,
    native,
    loaderEnvironment,
    files,
  } = value;
  if ((!runtimeRecord(node)) || (!runtimeKeys({
    value: node,
    expected: [
      'version',
      'versions',
      'executable'
    ],
  }))
    || ((typeof node.version) !== 'string')
    || (node.version
      .length
      === 0)
    || (!runtimeRecord(node.versions))
    || (!Object.values(node.versions)
      .every(function stringVersion(version): boolean { return (typeof version) === 'string'; }))
    || (!runtimeRecord(node.executable))
    || (!runtimeKeys({
      value: node.executable,
      expected: [
        'bytes',
        'sha256'
      ],
    }))
    || (!runtimeIdentity(node.executable))
    || (node.executable
      .bytes
      === 0))
    return false;
  if ((!runtimeRecord(native)) || (!runtimeKeys({
    value: native,
    expected: [
      'package',
      'version',
      'path',
      'bytes',
      'sha256'
    ],
  }))
    || (native.package !== '@bruits/satteri-linux-x64-gnu')
    || ((typeof native.version) !== 'string')
    || (native.version
      .length
      === 0)
    || (!runtimeFile(native))
    || (native.path !== 'satteri_napi.linux-x64-gnu.node')
    || (native.bytes === 0))
    return false;
  if ((!runtimeRecord(loaderEnvironment)) || (!runtimeKeys({
    value: loaderEnvironment,
    expected: [
      'policy',
      'names'
    ],
  }))
    || (loaderEnvironment.policy !== 'must-be-absent-before-import')
    || (!isDeepStrictEqual(
      loaderEnvironment.names,
      PRODUCER_BUILD_LOADER_NAMES
    ))
    || (value.systemLibraries !== SYSTEM_LIBRARY_RESPONSIBILITY)
    || (!Array.isArray(files))
    || (files.length === 0))
    return false;
  /**
   * Array narrowing does not turn untrusted entries into an any-typed validation shortcut.
   */
  const entries: readonly unknown[] = files;
  return entries.every(function file(entry): boolean {
    return runtimeRecord(entry) && runtimeKeys({
      value: entry,
      expected: [
        'path',
        'bytes',
        'sha256'
      ],
    })
      && runtimeFile(entry);
  });
}

//endregion Recognized sealed-build metadata, not execution approval
