/**
 * Oxlint JS plugin keeping tests pointed at the artifact their package ships.
 *
 * The plugin's public API is its default export. Everything else this module
 * re-exports is marked `\@internal`: those symbols exist so this package's own
 * tests can exercise each classifier through the built artifact, which is the
 * very convention {@link requireEventualArtifact} enforces. They carry no
 * compatibility promise.
 *
 * @module
 */

import {
  eslintCompatPlugin,
  type Plugin,
} from '@oxlint/plugins';

import { requireEventualArtifact, } from './require-eventual-artifact.ts';

export {
  DEFAULT_FIXTURE_PATTERNS,
  isCheckedFile,
  isFixtureModule,
  isTestFile,
} from './checked-file.ts';

export {
  declaresBuildTask,
  isBuildTaskName,
  taskNameOfHeader,
} from './build-task.ts';

export { eventualDirectories, } from './eventual-directory.ts';

export {
  classifyImport,
  type ImportOutcome,
} from './import-classification.ts';

export {
  type OwningPackage,
  owningPackage,
  PACKAGE_UNRESOLVED,
} from './owning-package.ts';

export {
  isPackageManifest,
  type PackageManifest,
  shippingTargets,
  stringTargets,
} from './package-manifest.ts';

export {
  matchesAnyGlob,
  matchesGlob,
} from './path-glob.ts';

export {
  isUnderAnyDirectory,
  isUnderDirectory,
  resolvePosix,
  toPosixPath,
} from './posix-path.ts';

export { requireEventualArtifact, } from './require-eventual-artifact.ts';

/**
 * Oxlint JS plugin providing the test-import ruleset.
 *
 * Registers one rule, so diagnostics render as
 * `test-import/require-eventual-artifact`.
 *
 * @example
 * ```typescript
 * // oxlint.config.ts
 * import { defineConfig } from 'oxlint';
 * export default defineConfig({
 *   jsPlugins: ['\@monochromatic-dev/oxlint-plugin-test-import'],
 * });
 * ```
 */
const plugin: Plugin = eslintCompatPlugin({
  meta: {
    name: 'test-import',
  },
  rules: {
    //region Artifact boundary
    'require-eventual-artifact': requireEventualArtifact,
    //endregion Artifact boundary
  },
},);

export default plugin;
