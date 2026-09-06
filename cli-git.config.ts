/**
 * Repository-owned cli-git policy configuration.
 *
 * @module
 */
import {
  defineConfig,
  forbiddenStringsPlugin,
  markdownLintPlugin,
  repositoryPolicyPlugin,
} from '@monochromatic-dev/git-policy-cli/ts';
import type { CliGitConfig, } from '@monochromatic-dev/git-policy-cli/ts';

/**
 * Exact trusted repository policy configuration.
 *
 * Explicitly typed because `defineConfig` returns its inferred generic argument
 * type, which `isolatedDeclarations` cannot emit for the default export; see the
 * cli-git authoring-ergonomics issue.
 */
const config: CliGitConfig = defineConfig({
  plugins: {
    markdown: markdownLintPlugin,
    mono: repositoryPolicyPlugin,
    security: forbiddenStringsPlugin,
  },
  policies: {
    // Rewrites Markdown image links that point at LFS-tracked files to the
    // LFS server's immutable object URLs inside the commit transaction, so
    // GitHub renders the image instead of the pointer (issue #476). Only the
    // lfs-image-url rule runs; package/ssg/ is excluded because those MDX
    // pages resolve images through the site build, not GitHub.
    'markdown/autofix': [
      'warn',
      {
        command: [
          'node',
          'package/cli/markdown-lint/src/cli.ts',
        ],
        rules: ['lfs-image-url',],
        exclude: ['package/ssg/',],
      },
    ],
    'mono/forbidden-root-context': 'error',
    'security/forbidden-strings': [
      'error',
      {
        executable: './package/cli/forbidden-strings/target/release/forbidden-strings',
        // The betterleaks baseline ships inside the scanner binary and the
        // policy passes --builtin-rules; the FORBIDDEN_STRINGS_RULES scratch
        // file carries only the repo appendixes
        // (doc/decision/gitignore-negations.md). Stated explicitly (it is the
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
