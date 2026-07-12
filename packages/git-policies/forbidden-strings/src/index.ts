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
} from '@monochromatic-dev/git-policy-api/ts';
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
  /**
   * Whether scans also load the scanner's embedded betterleaks-ported
   * baseline via its opt-in `--builtin-rules` flag.
   */
  builtinRules: boolean;
}>;

/**
 * Forbidden-strings policy option schema.
 */
const forbiddenStringsOptions = definePolicyOptions(v.object({
  executable: v.optional(
    v.string(),
    'forbidden-strings',
  ),
  builtinRules: v.optional(
    v.boolean(),
    false,
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
      builtinRules: options.builtinRules,
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
