/**
 * Repository-owned cli-git policy configuration.
 *
 * @module
 */
import {
  defineConfig,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/cli-git/ts';

/**
 * Exact trusted repository policy configuration.
 */
const config = defineConfig({
  plugins: {
    mono: repositoryPolicyPlugin,
  },
  policies: {
    'mono/forbidden-root-context': 'error',
  },
  trust: {
    children: true,
  },
},);

export default config;
