import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build for this Claude Code plugin.
 *
 * Overrides the shared output directory because committed plugin bundles live
 * in the tracked `bundle/node/` directory, not gitignored `dist/`: Claude
 * Code's marketplace install copies the package as-is with no build step, so
 * the bundle must be committed at the path `plugin.json` hooks reference. See
 * `docs/decisions/gitignore-negations.md`.
 */
const config = nodeConfig({ outputDir: 'bundle/node', },);

export default config;
