import { perEntryNodeConfig,
  type NodeFlavorConfigs,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Build config for the markdown-lint package. The library entry (`index.ts`)
 * and the CLI entry (`cli.ts`, which carries the Node shebang) each build as
 * their own self-contained bundle.
 */
const config: NodeFlavorConfigs = perEntryNodeConfig({
  entries: [
    './src/index.ts',
    './src/cli.ts',
  ],
},);

export default config;
