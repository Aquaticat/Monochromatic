import { perEntryNodeConfig, } from '@monochromatic-dev/config-tsdown/.node.ts';
import type { UserConfig, } from 'tsdown';

/**
 * Per-entry configs before the bundle-directory override.
 */
const entryConfigs: UserConfig[] = perEntryNodeConfig([
  './src/index.ts',
  './src/filter.ts',
],);

/**
 * Build config for bash-output-filter, built via {@link perEntryNodeConfig}.
 *
 * The hook entry (`index.ts`) and the standalone filter script (`filter.ts`,
 * which the rewritten Bash command pipes output through as a subprocess) share
 * the `text-scan` lib. Building each entry as its own bundle keeps both outputs
 * self-contained with stable filenames instead of emitting a content-hashed
 * shared chunk.
 *
 * Every entry overrides the shared outDir because committed plugin bundles
 * live in the tracked `bundle/node/` directory, not gitignored `dist/`; see
 * `docs/decisions/gitignore-negations.md`.
 */
const config: UserConfig[] = entryConfigs
  .map(function intoBundleDir(entryConfig: UserConfig,): UserConfig {
    return {
      ...entryConfig,
      outDir: 'bundle/node',
    };
  },);

export default config;
