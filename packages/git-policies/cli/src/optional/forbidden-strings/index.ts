// Generated from `packages/git-policies/forbidden-strings/src/index.ts` by file-enforcer; edit canonical source owner.
/**
 * Forbidden-strings cli-git policy plugin.
 *
 * @module
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
import { scanCandidates, } from './scan-candidates.ts';

/**
 * Runtime-validated forbidden-strings policy options.
 */
export type ForbiddenStringsPolicyOptions = Readonly<{
  /**
   * PATH-resolved command or explicit scanner executable path.
   */
  executable: string;
}>;

/**
 * Forbidden-strings policy option schema.
 */
const forbiddenStringsOptions = definePolicyOptions(v.object({
  executable: v.optional(
    v.string(),
    'forbidden-strings',
  ),
},),);

/**
 * Scans exact candidate content through separately built forbidden-strings binary.
 *
 * @example
 * ```ts
 * forbiddenStringsPolicy.name;
 * // => 'forbidden-strings'
 * ```
 */
export const forbiddenStringsPolicy: PolicyDefinition<
  ForbiddenStringsPolicyOptions,
  'forbidden-strings'
> = definePolicy({
  name: 'forbidden-strings',
  defaultSeverity: 'error',
  warnSafe: false,
  triggers: [
    'pre-forward',
    'post-commit',
    'manual-push',
    'direct-check',
  ],
  options: forbiddenStringsOptions,
  async check({
    context,
    options,
  }): Promise<readonly PolicyFinding[]> {
    /**
     * Exact candidates, limited to landed delta after commit.
     */
    const candidates = (await context.git
      .candidates())
      .filter(function isRelevantCandidate(candidate,) {
        return (context.trigger !== 'post-commit') || (candidate.change !== 'unchanged');
      },);
    return await scanCandidates({
      executable: options.executable,
      repositoryRoot: context.command
        .repositoryRoot,
      candidates,
      signal: context.signal,
    },);
  },
},);

/**
 * Optional forbidden-strings policy plugin shipped inert inside cli-git.
 *
 * @example
 * ```ts
 * forbiddenStringsPlugin.name;
 * // => 'forbidden-strings'
 * ```
 */
export const forbiddenStringsPlugin: PluginDefinition<
  readonly [typeof forbiddenStringsPolicy],
  'forbidden-strings'
> = definePlugin({
  name: 'forbidden-strings',
  policies: [forbiddenStringsPolicy,],
},);

export { ForbiddenStringsPluginError, } from './errors.ts';
export { parseScannerOutput, } from './scanner-output.ts';
export { scanCandidates, } from './scan-candidates.ts';
