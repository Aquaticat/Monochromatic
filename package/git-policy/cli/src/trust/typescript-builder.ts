/**
 * Private Rolldown TypeScript trust candidate builder. @module
 */
import { isBuiltin, } from 'node:module';
import {
  isAbsolute,
  relative,
} from 'node:path';
import { realpath, } from 'node:fs/promises';
import type { Plugin, } from 'rolldown';
import {
  captureTrustCandidate,
  captureTrustSource,
  TrustCandidateError,
} from './candidate.ts';
import { exactBytesEqual, } from './config-loader.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { validateMjs, } from './mjs-validator.ts';
import { TypeScriptBuildError, } from './typescript-build-error.ts';
import { assertLiteralDynamicImports, } from './typescript-syntax-validation.ts';
import type {
  CapturedTrustSource,
  TypeScriptTrustCandidate,
} from './types.ts';

/**
 * Public cli-git package import used by trusted configs.
 */
const CLI_GIT_PACKAGE_IMPORT = '@monochromatic-dev/git-policy-cli';

/**
 * Source export used to avoid rebundling cli-git's complete executable artifact.
 */
const CLI_GIT_SOURCE_IMPORT = '@monochromatic-dev/git-policy-cli/ts';

/**
 * Removes Rolldown query suffix from resolved module ID.
 *
 * @param id - resolved module ID
 *
 * @returns filesystem portion
 */
function modulePath(id: string,): string {
  /**
   * First query delimiter.
   */
  const queryIndex = id.indexOf('?',);
  return queryIndex === (-1) ? id : id.slice(
    0,
    queryIndex,
  );
}

/**
 * Asserts canonical path remains inside repository root.
 *
 * @param repositoryRoot - canonical root
 *
 * @param sourcePath - canonical source path
 */
function assertRepositorySource({
  repositoryRoot,
  sourcePath,
}: Readonly<{
  repositoryRoot: string;
  sourcePath: string;
}>,): void {
  /**
   * Component-aware relative path.
   */
  const localPath = relative(
    repositoryRoot,
    sourcePath,
  );
  if ((localPath === '') || ((!localPath.startsWith('..',)) && (!isAbsolute(localPath,))))
    return;
  throw new TypeScriptBuildError(`Relative TypeScript source escaped repository root: ${sourcePath}`,);
}

/**
 * Source-capture plugin plus build-local observations.
 */
type SourceCaptureState = Readonly<{
  /**
   * Source-capturing Rolldown plugin.
   */
  plugin: Plugin;
  /**
   * Exact captured source map.
   */
  capturedSources: ReadonlyMap<string, CapturedTrustSource>;
  /**
   * Bare package warning set.
   */
  bareImports: ReadonlySet<string>;
}>;

/**
 * Creates source-capturing Rolldown plugin.
 *
 * @param discovered - canonical TypeScript entry
 *
 * @param entrySource - exact entry snapshot
 *
 * @returns source-capturing plugin and immutable observations
 */
function sourceCapturePlugin({
  discovered,
  entrySource,
}: Readonly<{
  discovered: DiscoveredConfig;
  entrySource: CapturedTrustSource;
}>,): SourceCaptureState {
  /**
   * Paths whose bytes belong to invalidation graph.
   */
  const trackedPaths = new Set<string>([entrySource.canonicalPath,],);
  /**
   * Exact build-local sources keyed by canonical path.
   */
  const capturedSources = new Map<string, CapturedTrustSource>();
  /**
   * Bare package imports originating in tracked sources.
   */
  const bareImports = new Set<string>();
  /**
   * Source-capturing plugin.
   */
  const plugin: Plugin = {
    name: 'cli-git-trust-source-capture',
    async resolveId(
      source,
      importer,
    ) {
      if ((importer === undefined) || isBuiltin(source,))
        return null;
      /**
       * Canonical importing module when filesystem-backed.
       */
      const importerPath = modulePath(importer,);
      if (!trackedPaths.has(importerPath,))
        return null;
      if (source === CLI_GIT_PACKAGE_IMPORT) {
        bareImports.add(source,);
        /**
         * Source-level package entry lets tree shaking remove direct-executable code from stored config.
         */
        const resolved = await this.resolve(
          CLI_GIT_SOURCE_IMPORT,
          importer,
          { skipSelf: true, },
        );
        if ((resolved === null) || ((resolved.external !== undefined) && (resolved.external !== false)))
          throw new TypeScriptBuildError('cli-git source authoring export did not resolve into bundle.',);
        return resolved;
      }
      if (source.startsWith('.',)) {
        /**
         * Rolldown-resolved local target.
         */
        const resolved = await this.resolve(
          source,
          importer,
          { skipSelf: true, },
        );
        if ((resolved === null) || ((resolved.external !== undefined) && (resolved.external !== false)))
          throw new TypeScriptBuildError(`Relative TypeScript import did not resolve into bundle: ${source}`,);
        /**
         * Canonical local source target.
         */
        const sourcePath = await realpath(modulePath(resolved.id,),);
        assertRepositorySource({
          repositoryRoot: discovered.repositoryRoot,
          sourcePath,
        },);
        trackedPaths.add(sourcePath,);
        return {
          ...resolved,
          id: sourcePath,
          moduleSideEffects: 'no-treeshake',
        };
      }
      if (isAbsolute(source,))
        throw new TypeScriptBuildError(`Absolute TypeScript import is outside tracked graph: ${source}`,);
      bareImports.add(source,);
      return null;
    },
    async load(id,) {
      /**
       * Filesystem-backed path without query.
       */
      const sourcePath = modulePath(id,);
      if (!trackedPaths.has(sourcePath,))
        return null;
      /**
       * Exact captured bytes supplied directly to Rolldown.
       */
      const captured = sourcePath === entrySource.canonicalPath
        ? entrySource
        : await captureTrustSource(sourcePath,);
      capturedSources.set(
        captured.canonicalPath,
        captured,
      );
      try {
        /**
         * Strict source text supplied to Rolldown.
         */
        const sourceText = new TextDecoder(
          'utf-8',
          { fatal: true, },
        ).decode(captured.bytes,);
        assertLiteralDynamicImports(this.parse(
          sourceText,
          {
          lang: sourcePath.endsWith('.tsx',) ? 'tsx' : 'ts',
          sourceType: 'module',
          astType: 'ts',
        },
        ),);
        return sourceText;
      }
      catch (error: unknown) {
        throw new TypeScriptBuildError(
          `Tracked TypeScript source is not strict UTF-8: ${sourcePath}`,
          { cause: error, },
        );
      }
    },
  };
  return {
    plugin,
    capturedSources,
    bareImports,
  };
}

/**
 * Immutable output fields needed by trust validation.
 */
type TypeScriptBuildOutput = Readonly<{
  /**
   * Output discriminator.
   */
  type: 'asset';
}> | Readonly<{
  /**
   * Output discriminator.
   */
  type: 'chunk';
  /**
   * Whether output is static entry.
   */
  isEntry: boolean;
  /**
   * Generated JavaScript.
   */
  code: string;
  /**
   * Generated output name.
   */
  fileName: string;
}>;

/**
 * Selects and validates exactly one generated JavaScript chunk.
 *
 * @param chunks - complete Rolldown output
 *
 * @returns immutable executable bytes
 */
function executableBytes({
  chunks,
}: Readonly<{
  chunks: readonly TypeScriptBuildOutput[];
}>,): Uint8Array {
  if (chunks.length !== 1)
    throw new TypeScriptBuildError(`TypeScript trust build produced ${String(chunks.length,)} outputs instead of one.`,);
  /**
   * Sole required output.
   */
  const [output,] = chunks;
  if ((output === undefined) || (output.type !== 'chunk')
    || (!output.isEntry))
    throw new TypeScriptBuildError('TypeScript trust build did not produce one JavaScript entry chunk.',);
  /**
   * Exact generated Node ESM bytes.
   */
  const bytes = new TextEncoder().encode(output.code,);
  validateMjs({
    bytes,
    sourceName: output.fileName,
  },);
  return bytes;
}

/**
 * Builds one immutable TypeScript config candidate through public Rolldown API.
 *
 * @param discovered - canonical TypeScript config
 *
 * @param buildDirectory - disposable private output directory
 *
 * @returns exact sources, bundle, identity, and package warnings
 *
 * @example
 * ```ts
 * await buildTypeScriptCandidate({ discovered, buildDirectory: '/tmp/private-build' });
 * ```
 */
export async function buildTypeScriptCandidate({
  discovered,
  buildDirectory,
}: Readonly<{
  discovered: DiscoveredConfig;
  buildDirectory: string;
}>,): Promise<TypeScriptTrustCandidate> {
  if (discovered.format !== 'typescript')
    throw new TrustCandidateError('TypeScript builder requires cli-git.config.ts.',);
  /**
   * Entry identity and exact bytes captured before build.
   */
  const entry = await captureTrustCandidate(discovered,);
  /**
   * Entry source projected into complete source graph.
   */
  const entrySource: CapturedTrustSource = {
    canonicalPath: entry.discovered
      .configPath,
    bytes: entry.bytes,
    size: entry.size,
    mtimeNanoseconds: entry.mtimeNanoseconds,
  };
  /**
   * Source-capture plugin plus immutable build observations.
   */
  const sourceCapture = sourceCapturePlugin({
    discovered,
    entrySource,
  },);
  /**
   * Lazy direct Rolldown API, absent from normal wrapper command startup.
   */
  const { rolldown, } = await import('rolldown');
  /**
   * Explicitly disposable bundler whose close stops native workers.
   */
  await using build = await rolldown({
    cwd: discovered.repositoryRoot,
    input: discovered.configPath,
    platform: 'node',
    treeshake: true,
    transform: {
      define: {
        // Trusted config executes only through dynamic import, so package direct-entry branches are unreachable.
        'import.meta.main': 'false',
      },
    },
    logLevel: 'silent',
    plugins: [sourceCapture.plugin,],
  },);
  /**
   * Sole in-memory ESM output with code splitting forbidden.
   */
  const bundle = await build.generate({
    format: 'esm',
    dir: buildDirectory,
    entryFileNames: 'config.mjs',
    codeSplitting: false,
    sourcemap: false,
  },);
  /**
   * Canonically ordered complete exact source graph.
   */
  const sources = [...sourceCapture.capturedSources
    .values(),]
    .toSorted(function byCanonicalPath(
      left,
      right,
    ) {
      return left.canonicalPath
        .localeCompare(right.canonicalPath,);
    },);
  if (!sources.some(function isEntry(source,) {
    return source.canonicalPath === discovered.configPath;
  },))
    throw new TypeScriptBuildError('TypeScript trust build omitted entry from captured source graph.',);
  /**
   * Output module IDs prove every tracked source participated.
   */
  const moduleIds = new Set(bundle.output
    .flatMap(function outputModuleIds(chunk,) {
    return chunk.type === 'chunk' ? chunk.moduleIds
      .map(modulePath,) : [];
  },),);
  sources.forEach(function assertIncluded(source,) {
    if (!moduleIds.has(source.canonicalPath,))
      throw new TypeScriptBuildError(`Tracked TypeScript source is absent from output metadata: ${source.canonicalPath}`,);
  },);
  /**
   * Entry identity and bytes re-captured after build completion.
   */
  const finalEntry = await captureTrustCandidate(discovered,);
  if ((finalEntry.identity
    .filesystemId
    !== entry.identity
    .filesystemId)
    || (finalEntry.identity
      .canonicalConfigPath
      !== entry.identity
      .canonicalConfigPath)
    || (finalEntry.size !== entry.size)
    || (finalEntry.mtimeNanoseconds !== entry.mtimeNanoseconds)
    || (!exactBytesEqual({
      left: finalEntry.bytes,
      right: entry.bytes,
    }))) {
    throw new TypeScriptBuildError('TypeScript entry identity or bytes changed during bundle generation.',);
  }
  /**
   * Every tracked source re-captured after complete output generation.
   */
  const finalSources = await Promise.all(sources.map(function recaptureSource(source,) {
    return captureTrustSource(source.canonicalPath,);
  },),);
  if (sources.some(function sourceChanged(
    source,
    index,
  ) {
    /**
     * Final corresponding source snapshot.
     */
    const finalSource = finalSources[index];
    return (finalSource === undefined)
      || (finalSource.canonicalPath !== source.canonicalPath)
      || (finalSource.size !== source.size)
      || (finalSource.mtimeNanoseconds !== source.mtimeNanoseconds)
      || (!exactBytesEqual({
        left: finalSource.bytes,
        right: source.bytes,
      }));
  },)) {
    throw new TypeScriptBuildError('Tracked TypeScript source graph changed during bundle generation.',);
  }
  return {
    entry,
    sources,
    executableBytes: executableBytes({ chunks: bundle.output, }),
    barePackageImports: [...sourceCapture.bareImports,].toSorted(),
  };
}
