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
import type { CliGitConfig, } from '@monochromatic-dev/cli-git/ts';

/**
 * Exact trusted repository policy configuration.
 *
 * Explicitly typed because `defineConfig` returns its inferred generic argument
 * type, which `isolatedDeclarations` cannot emit for the default export; see the
 * cli-git authoring-ergonomics issue.
 */
const config: CliGitConfig = defineConfig({
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
        // The betterleaks baseline ships inside the scanner binary and the
        // policy passes --builtin-rules; the FORBIDDEN_STRINGS_RULES scratch
        // file carries only the repo appendixes
        // (docs/decisions/gitignore-negations.md). Stated explicitly (it is the
        // schema default) because AllowedPolicySetting checks against the
        // policy's resolved-options type, in which builtinRules is required.
        builtinRules: true,
      },
    ],
  },
  trust: {
    children: true,
  },
},);

export default config;
