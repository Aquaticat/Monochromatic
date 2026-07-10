/**
 * Repository-owned cli-git policy configuration.
 *
 * @module
 */
import {
  defineConfig,
  forbiddenStringsPlugin,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/cli-git/ts';

/**
 * Exact trusted repository policy configuration.
 */
const config = defineConfig({
  plugins: {
    mono: repositoryPolicyPlugin,
    security: forbiddenStringsPlugin,
  },
  policies: {
    'mono/forbidden-root-context': 'error',
    'security/forbidden-strings': [
      'error',
      {
        executable: './packages/cli/forbidden-strings/target/release/forbidden-strings',
      },
    ],
  },
  trust: {
    children: true,
  },
},);

export default config;
