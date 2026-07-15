// Generated from `package/git-policy/forbidden-strings/src/index.ts` by file-enforcer; edit canonical source owner.
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
  /**
   * Whether scans also load the scanner's embedded betterleaks-ported
   * baseline via its `--builtin-rules` flag. Defaults to `true`: the
   * standalone CLI keeps the baseline pure opt-in, but a git policy exists
   * to catch leaked credentials, so the policy is baseline-on unless a
   * repository explicitly opts out.
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
    true,
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
  /**
   * Scans lifecycle-selected candidate bytes.
   *
   * @param context - Policy context exposing lazy Git candidates.
   *
   * @param options - Scanner command and built-in-rule options.
   *
   * @returns Scanner findings for selected candidates.
   *
   */
  async check({
    context,
    options,
  }): Promise<readonly PolicyFinding[]> {
    /**
     * Exact lifecycle-selected candidates; every lifecycle now supplies only
     * the operation's own delta, so no post-commit narrowing happens here.
     */
    const candidates = await context.git
      .candidates();
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
