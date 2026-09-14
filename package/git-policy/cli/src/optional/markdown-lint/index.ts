// Generated from `package/git-policy/markdown-lint/src/index.ts` by file-enforcer; edit canonical source owner.
/**
 markdown-lint cli-git policy plugin: runs `cli-markdown-lint --fix` over
 Markdown candidates inside the commit transaction so selected rules land
 their fixes in the commit itself.

 @module
 */

import {
  definePlugin,
  definePolicy,
  definePolicyOptions,
  type PluginDefinition,
  type PolicyDefinition,
  type PolicyFinding,
} from '../../api/index.ts';
import * as v from 'valibot';

import { rewriteCandidates, } from './rewrite-candidates.ts';

/**
 Runtime-validated markdown-lint policy options.
 */
export type MarkdownLintPolicyOptions = Readonly<{
  /**
   Command and leading arguments that start markdown-lint, resolved from the
   repository root. Defaults to the workspace source entry.
   */
  command: readonly string[];
  /**
   Rule ids markdown-lint runs. Defaults to the LFS image rewrite alone, so
   prose rules never rewrite a commit unasked.
   */
  rules: readonly string[];
  /**
   gitignore-syntax patterns, relative to the repository root, naming
   candidates the policy leaves alone and the `lfs-image-url` rule skips.
   */
  exclude: readonly string[];
}>;

/**
 Default command: the workspace markdown-lint source entry run by Node.
 */
const DEFAULT_COMMAND: readonly string[] = [
  'node',
  'package/cli/markdown-lint/src/cli.ts',
];

/**
 Default rule set: the LFS image rewrite only.
 */
const DEFAULT_RULES: readonly string[] = ['lfs-image-url',];

/**
 markdown-lint policy option schema.
 */
const markdownLintOptions = definePolicyOptions(v.object({
  command: v.optional(
    v.pipe(
      v.array(v.string(),),
      v.readonly(),
    ),
    DEFAULT_COMMAND,
  ),
  rules: v.optional(
    v.pipe(
      v.array(v.string(),),
      v.readonly(),
    ),
    DEFAULT_RULES,
  ),
  exclude: v.optional(
    v.pipe(
      v.array(v.string(),),
      v.readonly(),
    ),
    [],
  ),
},),);

/**
 Rewrites Markdown candidates through markdown-lint fixes inside the commit
 transaction; report-only at lifecycle points that cannot apply patches.

 @example
 ```ts
 markdownLintPolicy.name;
 // => 'autofix'
 ```
 */
export const markdownLintPolicy: PolicyDefinition<
  MarkdownLintPolicyOptions,
  'autofix'
> = definePolicy({
  name: 'autofix',
  defaultSeverity: 'warn',
  warnSafe: true,
  triggers: [
    'pre-forward',
    'post-commit',
    'manual-push',
    'direct-check',
    'direct-fix',
  ],
  options: markdownLintOptions,
  /**
   Runs markdown-lint over lifecycle-selected Markdown candidates.

   @param context - Policy context exposing lazy Git candidates.

   @param options - Command, rules, and exclude patterns.

   @returns Autofix and violation findings for selected candidates.
   */
  async check({
    context,
    options,
  }): Promise<readonly PolicyFinding[]> {
    /**
     Exact lifecycle-selected candidates; every lifecycle supplies only the
     operation's own delta.
     */
    const candidates = await context.git
      .candidates();
    return await rewriteCandidates({
      command: options.command,
      rules: options.rules,
      exclude: options.exclude,
      repositoryRoot: context.command
        .repositoryRoot,
      canApplyPatches: context.canApplyPatches,
      candidates,
      signal: context.signal,
    },);
  },
},);

/**
 Optional markdown-lint policy plugin shipped inert inside cli-git.

 @example
 ```ts
 markdownLintPlugin.name;
 // => 'markdown-lint'
 ```
 */
export const markdownLintPlugin: PluginDefinition<
  readonly [typeof markdownLintPolicy],
  'markdown-lint'
> = definePlugin({
  name: 'markdown-lint',
  policies: [markdownLintPolicy,],
},);

export { MarkdownLintPluginError, } from './errors.ts';
export {
  createFullContentPatch,
  type CreateFullContentPatchParams,
} from './full-content-patch.ts';
export {
  AUTOFIX_CODE,
  isMarkdownPath,
  rewriteCandidates,
  type RewriteCandidatesParams,
  VIOLATION_CODE,
} from './rewrite-candidates.ts';
