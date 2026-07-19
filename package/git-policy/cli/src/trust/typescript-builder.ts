/**
 * Private Rolldown TypeScript trust candidate builder. @module
 */
import {
  captureTrustCandidate,
  captureTrustSource,
  TrustCandidateError,
} from './candidate.ts';
import { exactBytesEqual, } from './config-loader.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { validateMjs, } from './mjs-validator.ts';
import { TypeScriptBuildError, } from './typescript-build-error.ts';
import {
  modulePath,
  sourceCapturePlugin,
} from './typescript-source-capture.ts';
import type {
  CapturedTrustSource,
  TypeScriptTrustCandidate,
} from './types.ts';

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
    tsconfig: false,
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
    if (chunk.type !== 'chunk')
      return [];
    /**
     * Owned module ID list detached from Rolldown output.
     */
    const detachedModuleIds = [...chunk.moduleIds,];
    return detachedModuleIds.map(function normalizeModuleId(id,) {
      return modulePath(id,);
    },);
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
