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
        // The betterleaks baseline ships inside the scanner binary; the
        // FORBIDDEN_STRINGS_RULES scratch file carries only the repo
        // appendixes (docs/decisions/gitignore-negations.md).
        builtinRules: true,
      },
    ],
  },
  trust: {
    children: true,
  },
},);

export default config;
