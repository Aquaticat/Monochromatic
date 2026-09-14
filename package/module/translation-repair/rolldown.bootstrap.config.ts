import { createHash, } from 'node:crypto';
import { isBuiltin, } from 'node:module';
import {
  nodeConfig,
  nodeExternal,
} from '@monochromatic-dev/config-rolldown/.node.ts';
import type {
  OutputAsset,
  OutputChunk,
  Plugin,
} from 'rolldown';

//region Separate single-file preparation bootstrap packaging

/**
 * Build evidence cannot be emitted for an unexpected executable closure.
 */
class PreparationBootstrapBuildError extends Error {
  /**
   * @param message - fixed build-contract diagnostic, never input data
   *
   * @example
   * ```ts
   * throw new PreparationBootstrapBuildError('Unexpected bootstrap chunks.');
   * ```
   */
  constructor(message: string) {
    super(message);
    this.name = 'PreparationBootstrapBuildError';
  }
}

/**
 * Readonly plugin view includes only the generated closure fields inspected by this build.
 */
type BootstrapBundle = Readonly<Record<string,
  (Readonly<Pick<OutputChunk, 'type' | 'fileName' | 'code'>> & {
    /**
     * Static import names are observed without mutating the bundler's array.
     */
    readonly imports: readonly string[];
    /**
     * Statically resolved dynamic imports must remain absent.
     */
    readonly dynamicImports: readonly string[];
  })
  | Readonly<Pick<OutputAsset, 'type' | 'fileName'>>
>>;

/**
 * Describes the generated bootstrap without treating its self-digest as review or authentication.
 *
 * @example
 * ```ts
 * const plugins = [config.plugins, bootstrapManifest];
 * ```
 */
const bootstrapManifest: Plugin = {
  name: 'preparation-input-bootstrap-manifest',
  generateBundle: {
    order: 'post',
    handler(
      _options: unknown,
      bundle: BootstrapBundle,
    ): void {
      /**
       * Declaration output is not executable bootstrap content.
       */
      const chunks = Object.values(bundle)
        .filter(function executable(value): boolean {
          return (value.type === 'chunk')
            && value.fileName
            .endsWith('.mjs');
        });
      /**
       * The host and child execute the same one-file bootstrap.
       */
      const [entry] = chunks;
      if ((chunks.length !== 1)
        || (entry === undefined)
        || (entry.type !== 'chunk')
        || (entry.fileName !== 'producer-prepare.mjs'))
        throw new PreparationBootstrapBuildError('Preparation bootstrap must emit exactly one producer-prepare.mjs executable.');
      if (entry.imports
        .some(function external(name): boolean {
          return !isBuiltin(name);
        })
        || (entry.dynamicImports
          .length
          > 0))
        throw new PreparationBootstrapBuildError('Preparation bootstrap contains an external or statically resolved application dependency.');
      /**
       * The guarded application import remains an opaque fixed URL expression, audited separately at the consumer boundary.
       */
      const manifest = {
        version: 1,
        kind: 'producer-preparation-bootstrap-build',
        scope: 'provider-free-input-reconstruction-only',
        file: {
          path: entry.fileName,
          bytes: Buffer.byteLength(
            entry.code,
            'utf8',
          ),
          sha256: createHash('sha256')
            .update(entry.code)
            .digest('hex'),
        },
        staticNodeImports: entry.imports
          .toSorted(),
        node: {
          version: process.version,
          versions: process.versions,
        },
        authority: 'Build identity only. Trusted caller must authenticate the frozen bootstrap and host before Node starts.',
      };
      this.emitFile({
        type: 'asset',
        fileName: 'producer-bootstrap.json',
        source: JSON.stringify(
          manifest,
          null,
          2,
        ),
      });
    },
  },
};

/**
 * Candidate packaging never overwrites an executing frozen bootstrap or normal application dist.
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: { 'producer-prepare': './src/corpus-run/producer-prepare.ts' },
  outputDir: 'node_modules/.producer-bootstrap-candidate',
  external: await nodeExternal({ alwaysBundle: ['**'] }),
  outputOverrides: { codeSplitting: false },
});
/**
 * Explicit output type keeps declaration inference independent from plugin object spreads.
 */
const bootstrapConfig: ReturnType<typeof nodeConfig> = {
  ...config,
  plugins: [
    config.plugins,
    bootstrapManifest,
  ],
};
export default bootstrapConfig;

//endregion Separate single-file preparation bootstrap packaging
