import { perEntryNodeConfig, } from '@monochromatic-dev/config-tsdown/.node.ts';
import type { UserConfig, } from 'tsdown';

/**
 * Build config for the markdown-lint package. The library entry (`index.ts`)
 * and the CLI entry (`cli.ts`, which carries the Node shebang) each build as
 * their own self-contained bundle.
 */
const config: UserConfig[] = perEntryNodeConfig([
  './src/index.ts',
  './src/cli.ts',
],);

export default config;
