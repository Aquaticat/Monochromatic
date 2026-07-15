import { perEntryNodeConfig,
  type NodeFlavorConfigs,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Build config for bash-output-filter, built via {@link perEntryNodeConfig}.
 *
 * The hook entry (`index.ts`) and the standalone filter script (`filter.ts`,
 * which the rewritten Bash command pipes output through as a subprocess) share
 * the `text-scan` lib. Building each entry as its own bundle keeps both outputs
 * self-contained with stable filenames instead of emitting a content-hashed
 * shared chunk.
 *
 * Every entry targets the tracked `bundle/node/` directory because committed
 * plugin bundles live there, not gitignored `dist/`; see
 * `docs/decisions/gitignore-negations.md`. The owning mise task pre-cleans the
 * shared directory once; per-entry configs never clean it themselves.
 */
const config: NodeFlavorConfigs = perEntryNodeConfig({
  entries: [
    './src/index.ts',
    './src/filter.ts',
  ],
  outputDir: 'bundle/node',
},);

export default config;
