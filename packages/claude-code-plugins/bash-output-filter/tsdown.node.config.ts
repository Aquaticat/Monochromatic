import { perEntryNodeConfig, } from '@monochromatic-dev/config-tsdown/.node.ts';
import type { UserConfig, } from 'tsdown';

/**
 * Build config for bash-output-filter, built via {@link perEntryNodeConfig}.
 *
 * The hook entry (`index.ts`) and the standalone filter script (`filter.ts`,
 * which the rewritten Bash command pipes output through as a subprocess) share
 * the `text-scan` lib. Building each entry as its own bundle keeps both outputs
 * self-contained with stable filenames instead of emitting a content-hashed
 * shared chunk.
 */
const config: UserConfig[] = perEntryNodeConfig([
  './src/index.ts',
  './src/filter.ts',
],);

export default config;
