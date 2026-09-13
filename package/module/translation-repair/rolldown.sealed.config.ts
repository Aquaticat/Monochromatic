import { createHash, } from 'node:crypto';
import {
  open,
  readFile,
} from 'node:fs/promises';
import { createRequire, } from 'node:module';
import {
  dirname,
  join,
} from 'node:path';
import {
  nodeConfig,
  nodeExternal,
} from '@monochromatic-dev/config-rolldown/.node.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { OutputAsset, OutputChunk, Plugin, } from 'rolldown';
import { nodeEntries, } from './rolldown.node.config.ts';

//region Target-specific application runtime packaging

/**
 * Build diagnostics remain separate from sealed runtime content.
 */
const l = tagged({ tag: 'sealed-runtime-build', },);
/**
 * Native binding selected only for the measured Linux x64 GNU target.
 */
const NATIVE_PACKAGE = '@bruits/satteri-linux-x64-gnu';
/**
 * Generated loader's adjacent-file spelling, not an arbitrary asset name.
 */
const NATIVE_FILE = 'satteri_napi.linux-x64-gnu.node';
/**
 * Stream chunk extent bounds temporary hashing storage.
 */
const HASH_CHUNK_BYTES = 65_536;
/**
 * Declaration chunks do not execute and must not change runtime identity when only documentation changes.
 */
const DECLARATION_SUFFIXES = [
  '.d.mts',
  '.d.ts',
  '.d.cts',
] as const;
/**
 * Loader overrides must be rejected or independently bound before importing this artifact.
 */
const LOADER_ENVIRONMENT = [
  'NAPI_RS_NATIVE_LIBRARY_PATH',
  'NAPI_RS_FORCE_WASI',
  'NAPI_RS_ENFORCE_VERSION_CHECK',
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_ICU_DATA',
] as const;

/**
 * Read-only host callback view exposes only fields needed to identify emitted bytes.
 *
 * @example
 * ```ts
 * const view: SealedBundleView = bundle;
 * ```
 */
type SealedBundleView = Readonly<Record<string,
  Readonly<Pick<OutputChunk, 'type' | 'fileName' | 'code'>>
  | Readonly<Pick<OutputAsset, 'type' | 'fileName'>>
>>;

/**
 * Failure to describe the actual target must not produce a claimed sealed runtime.
 */
class SealedRuntimeBuildError extends Error {
  /**
   * Names the failed build prerequisite without inventing runtime authority.
   *
   * @param message - controlled prerequisite diagnostic
   *
   * @example
   * ```ts
   * throw new SealedRuntimeBuildError('Unsupported sealed-runtime target.');
   * ```
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'SealedRuntimeBuildError';
  }
}

/**
 * Reads a package version from the actual resolved package rather than a generated loader literal.
 *
 * @param path - resolved package manifest
 *
 * @param expectedName - package identity owning the resolved file
 *
 * @returns Exact installed version
 *
 * @throws SealedRuntimeBuildError when metadata names a different or unidentified package
 *
 * @example
 * ```ts
 * const version = await packageVersion({ path, expectedName: 'satteri' });
 * ```
 */
async function packageVersion({
  path,
  expectedName,
}: {
  readonly path: string;
  readonly expectedName: string;
},): Promise<string> {
  /**
   * Parsed metadata is inspected before its version receives authority.
   */
  const value: unknown = JSON.parse(await readFile(
    path,
    'utf8',
  ),);
  if (((typeof value) !== 'object') || (value === null)
    || Array.isArray(value,)
    || (!('name' in value))
    || (value.name !== expectedName)
    || (!('version' in value))
    || ((typeof value.version) !== 'string')
    || (value.version
      .length
      === 0))
    throw new SealedRuntimeBuildError('Resolved native-runtime package metadata does not match its expected identity.',);
  return value.version;
}

/**
 * Hashes the executed Node binary without retaining its complete bytes in memory.
 *
 * @param path - current executable path supplied by Node
 *
 * @returns Exact observed executable extent and SHA-256
 *
 * @throws SealedRuntimeBuildError when the regular-file extent changes during hashing
 *
 * @example
 * ```ts
 * const executable = await binaryIdentity(process.execPath);
 * ```
 */
async function binaryIdentity(path: string,): Promise<{
  readonly bytes: number;
  readonly sha256: string
}> {
  /**
   * Build-owned descriptor pins the observed executable while hashing.
   */
  await using handle = await open(
    path,
    'r',
  );
  /**
   * Independently observed extent bounds this build read, not an arbitrary global ceiling.
   */
  const before = await handle.stat();
  if ((!before.isFile()) || (!Number.isSafeInteger(before.size))
    || (before.size <= 0))
    throw new SealedRuntimeBuildError('Executed Node binary must be a nonempty regular file with a safe byte extent.',);
  /**
   * Hash and count consume the same bounded byte stream.
   */
  const hash = createHash('sha256',);
  /**
   * Mutable counter belongs exclusively to this stream observation.
   */
  const observed = { bytes: 0, };
  for await (const chunk of handle.createReadStream({
    start: 0,
    end: before.size - 1,
    highWaterMark: HASH_CHUNK_BYTES,
    autoClose: false,
  },)) {
    if (!Buffer.isBuffer(chunk,))
      throw new SealedRuntimeBuildError('Executed Node binary stream did not yield raw bytes.',);
    observed.bytes += chunk.length;
    hash.update(chunk,);
  }
  /**
   * A different final extent invalidates this description.
   */
  const after = await handle.stat();
  if ((observed.bytes !== before.size) || (after.size !== before.size)
    || (after.mtimeMs !== before.mtimeMs)
    || (after.ctimeMs !== before.ctimeMs))
    throw new SealedRuntimeBuildError('Executed Node binary changed while its build identity was recorded.',);
  return {
    bytes: observed.bytes,
    sha256: hash.digest('hex',),
  };
}

/**
 * Node's report distinguishes GNU libc from the separate musl native target.
 */
const report: unknown = process.report
  .getReport();
if ((process.platform !== 'linux') || (process.arch !== 'x64')
  || ((typeof report) !== 'object')
  || (report === null)
  || (!('header' in report))
  || ((typeof report.header) !== 'object')
  || (report.header === null)
  || (!('glibcVersionRuntime' in report.header))
  || ((typeof report.header
    .glibcVersionRuntime) !== 'string'))
  throw new SealedRuntimeBuildError('This sealed-runtime build requires Linux x64 with GNU libc.',);

/**
 * Resolve native assets through the same installed Satteri instance as the package entry.
 */
const require = createRequire(import.meta.url,);
/**
 * Direct package entry establishes its package-relative optional dependency lookup.
 */
const satteriEntry = require.resolve('satteri',);
/**
 * Native package entry is the file copied into the sealed output.
 */
const nativePath = createRequire(satteriEntry,)
  .resolve(NATIVE_PACKAGE,);
/**
 * JavaScript package version is evidence from its installed manifest.
 */
const satteriVersion = await packageVersion({
  path: join(
    dirname(satteriEntry,),
    '..',
    'package.json',
  ),
  expectedName: 'satteri',
},);
/**
 * Native package must match the JavaScript package, not a stale generated version string.
 */
const nativeVersion = await packageVersion({
  path: join(
    dirname(nativePath,),
    'package.json',
  ),
  expectedName: NATIVE_PACKAGE,
},);
if (nativeVersion !== satteriVersion)
  throw new SealedRuntimeBuildError('Satteri JavaScript and native package versions differ.',);
/**
 * Native asset bytes are build-owned and emitted without transformation.
 */
const nativeBytes = await readFile(nativePath,);
/**
 * Node executable identity is separate from the application file inventory.
 */
const executable = await binaryIdentity(process.execPath,);

/**
 * Emits the native dependency and a path-independent description of the application runtime.
 * This manifest is build evidence, not root review or generation approval.
 *
 * @example
 * ```ts
 * const plugins = [config.plugins, sealedRuntimeAssets];
 * ```
 */
const sealedRuntimeAssets: Plugin = {
  name: 'translation-sealed-runtime-assets',
  generateBundle: {
    order: 'post',
    handler(
      _options: unknown,
      bundle: SealedBundleView,
    ): void {
      /**
       * The bundle's final code strings provide identities without source-location paths.
       */
      const files = Object.values(bundle,)
        .filter(function executableChunk(item,): boolean {
        return (item.type === 'chunk') && (!DECLARATION_SUFFIXES.some(function declaration(suffix,): boolean {
          return item.fileName
            .endsWith(suffix,);
        },));
      },)
        .map(function chunkIdentity(item,): {
          readonly path: string;
          readonly bytes: number;
          readonly sha256: string
        } {
        if (item.type !== 'chunk')
          throw new SealedRuntimeBuildError('Expected a generated executable chunk in sealed runtime inventory.',);
        return {
          path: item.fileName,
          bytes: Buffer.byteLength(
            item.code,
            'utf8',
          ),
          sha256: createHash('sha256',)
            .update(item.code,)
            .digest('hex',),
        };
      },);
      /**
       * Native bytes belong to the same application inventory as JavaScript.
       */
      const native = {
        path: NATIVE_FILE,
        bytes: nativeBytes.length,
        sha256: createHash('sha256',)
          .update(nativeBytes,)
          .digest('hex',),
      };
      this.emitFile({
        type: 'asset',
        fileName: NATIVE_FILE,
        source: nativeBytes,
      },);
      /**
       * Neither absolute build paths nor timestamps enter reproducible runtime evidence.
       */
      const manifest = {
        version: 1,
        kind: 'sealed-node-runtime-build',
        scope: 'application-dependencies-only',
        target: {
          platform: 'linux',
          arch: 'x64',
          libc: 'glibc',
        },
        node: {
          version: process.version,
          versions: process.versions,
          executable,
        },
        native: {
          package: NATIVE_PACKAGE,
          version: nativeVersion,
          ...native,
        },
        loaderEnvironment: {
          policy: 'must-be-absent-before-import',
          names: LOADER_ENVIRONMENT,
        },
        systemLibraries: 'Runner must separately bind its operating-system image and native shared-library inputs.',
        files: [
          ...files,
          native,
        ].toSorted(function byPath(
          left,
          right,
        ): number {
          return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
        },),
      };
      this.emitFile({
        type: 'asset',
        fileName: 'sealed-runtime.json',
        source: JSON.stringify(
          manifest,
          null,
          2,
        ),
      },);
      l.info(`sealed build described ${String(manifest.files
        .length,)} application files without review or execution authority`,);
    },
  },
};

/**
 * Dedicated output keeps the ordinary package build and external-resolution behavior unchanged.
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: nodeEntries,
  outputDir: 'dist/final/sealed-node',
  external: await nodeExternal({ alwaysBundle: ['**',], },),
},);
/**
 * Explicit configuration type permits declaration emission without inferring an exported object spread.
 */
const sealedConfig: ReturnType<typeof nodeConfig> = {
  ...config,
  plugins: [
    config.plugins,
    sealedRuntimeAssets,
  ],
};
export default sealedConfig;

//endregion Target-specific application runtime packaging
