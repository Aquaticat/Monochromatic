/**
 * TypeScript trust source capture and bootstrap-safe package resolution. @module
 */
import { realpath, } from 'node:fs/promises';
import { isBuiltin, } from 'node:module';
import {
  isAbsolute,
  relative,
} from 'node:path';
import { fileURLToPath, } from 'node:url';
import type { Plugin, } from 'rolldown';
import packageMetadata from '../../package.json' with { type: 'json', };
import { captureTrustSource, } from './candidate.ts';
import type { DiscoveredConfig, } from './config-discovery.ts';
import { TypeScriptBuildError, } from './typescript-build-error.ts';
import { assertLiteralDynamicImports, } from './typescript-syntax-validation.ts';
import type { CapturedTrustSource, } from './types.ts';

/**
 * Public cli-git package import used by trusted configs.
 */
const CLI_GIT_PACKAGE_IMPORT = '@monochromatic-dev/git-policy-cli';

/**
 * Dedicated source export that excludes executable startup.
 */
const CLI_GIT_SOURCE_IMPORT = '@monochromatic-dev/git-policy-cli/ts';

/**
 * Package names available from installed cli-git artifact.
 */
const ARTIFACT_RUNTIME_PACKAGE_NAMES: ReadonlySet<string> = new Set([
  CLI_GIT_PACKAGE_IMPORT,
  ...Object.keys(packageMetadata.dependencies,),
],);

/**
 * Domain absence when bare specifier does not name package.
 */
const PACKAGE_NAME_NOT_FOUND: unique symbol = Symbol('bare specifier does not name package');

/**
 * Removes Rolldown query suffix from resolved module ID.
 *
 * @param id - resolved module ID
 *
 * @returns filesystem portion
 *
 * @example
 * ```ts
 * modulePath('/tmp/config.ts?commonjs-entry');
 * ```
 */
export function modulePath(id: string,): string {
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
 * Derives manifest package name from bare root or subpath import.
 *
 * @param specifier - bare module specifier
 *
 * @returns unscoped first segment,
 * scoped first two segments,
 * or domain absence for non-package syntax
 *
 * @example
 * ```ts
 * artifactPackageName('\@scope/example/subpath');
 * ```
 */
function artifactPackageName(specifier: string,): string | typeof PACKAGE_NAME_NOT_FOUND {
  if ((specifier === '') || specifier.startsWith('#',))
    return PACKAGE_NAME_NOT_FOUND;
  /**
   * First package path delimiter.
   */
  const firstSlash = specifier.indexOf('/',);
  if (!specifier.startsWith('@',)) {
    if (firstSlash === 0)
      return PACKAGE_NAME_NOT_FOUND;
    return firstSlash === (-1) ? specifier : specifier.slice(
      0,
      firstSlash,
    );
  }
  if (firstSlash <= 1)
    return PACKAGE_NAME_NOT_FOUND;
  /**
   * Delimiter after scoped package name.
   */
  const secondSlash = specifier.indexOf(
    '/',
    firstSlash + 1,
  );
  /**
   * End of scoped package name.
   */
  const packageEnd = secondSlash === (-1) ? specifier.length : secondSlash;
  return packageEnd === (firstSlash + 1) ? PACKAGE_NAME_NOT_FOUND : specifier.slice(
    0,
    packageEnd,
  );
}

/**
 * Resolves import from running installed cli-git artifact.
 *
 * @param specifier - package root or exported subpath
 *
 * @returns absolute installed module path
 *
 * @throws When installed artifact does not provide import
 *
 * @example
 * ```ts
 * artifactImportPath('\@monochromatic-dev/git-policy-cli/ts');
 * ```
 */
function artifactImportPath(specifier: string,): string {
  try {
    return fileURLToPath(import.meta.resolve(specifier,),);
  }
  catch (error: unknown) {
    throw new TypeScriptBuildError(
      `Installed cli-git artifact did not provide package import: ${specifier}`,
      { cause: error, },
    );
  }
}

/**
 * Asserts canonical path remains inside repository root.
 *
 * @param repositoryRoot - canonical root
 *
 * @param sourcePath - canonical source path
 *
 * @throws When source escapes repository root
 *
 * @example
 * ```ts
 * assertRepositorySource({ repositoryRoot: '/repo', sourcePath: '/repo/policy.ts' });
 * ```
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
 *
 * @example
 * ```ts
 * sourceCapturePlugin({ discovered, entrySource });
 * ```
 */
export function sourceCapturePlugin({
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
   * Authoring source resolved from installed cli-git package itself.
   */
  const installedAuthoringSourcePath = artifactImportPath(CLI_GIT_SOURCE_IMPORT,);
  /**
   * Source-capturing Rolldown plugin.
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
      /**
       * Manifest package name for root or subpath import.
       */
      const packageName = artifactPackageName(source,);
      if ((source === CLI_GIT_PACKAGE_IMPORT) || (source === CLI_GIT_SOURCE_IMPORT))
        return installedAuthoringSourcePath;
      /**
       * Consumer-owned package resolution remains first.
       */
      const consumerResolved = await this.resolve(
        source,
        importer,
        { skipSelf: true, },
      );
      if ((consumerResolved !== null)
        && ((consumerResolved.external === undefined) || (consumerResolved.external === false)))
        return consumerResolved;
      if (((typeof packageName) !== 'symbol') && ARTIFACT_RUNTIME_PACKAGE_NAMES.has(packageName,))
        return artifactImportPath(source,);
      return consumerResolved;
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
