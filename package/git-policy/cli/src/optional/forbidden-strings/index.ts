// Generated from `package/git-policy/forbidden-strings/src/index.ts` by file-enforcer; edit canonical source owner.
/**
 Forbidden-strings cli-git policy plugin.
 
 @module
 */
import {
  definePlugin,
  definePolicy,
  definePolicyOptions,
  type PluginDefinition,
  type PolicyDefinition,
  type PolicyFinding,
  type PolicyInputs,
} from '../../api/index.ts';
import * as v from 'valibot';
import { scanCandidates, } from './scan-candidates.ts';

/**
 Runtime-validated forbidden-strings policy options.
 */
export type ForbiddenStringsPolicyOptions = Readonly<{
  /**
   PATH-resolved command or explicit scanner executable path.
   */
  executable: string;
  /**
   Whether scans also load the scanner's embedded betterleaks-ported
   baseline via its `--builtin-rules` flag. Defaults to `true`: the
   standalone CLI keeps the baseline pure opt-in, but a git policy exists
   to catch leaked credentials, so the policy is baseline-on unless a
   repository explicitly opts out.
   */
  builtinRules: boolean;
}>;

/**
 Forbidden-strings policy option schema.
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
 Rules file the scanner reads when `FORBIDDEN_STRINGS_RULES` is unset, relative to its working directory.
 */
const DEFAULT_RULES_PATH = 'forbidden-strings.local.txt';

/**
 What the scanner reads besides candidate bytes:
 its executable,
 which embeds the built-in rules,
 and the one rules file `FORBIDDEN_STRINGS_RULES` names,
 or the default file in the repository root.
 The rules path is a literal pathspec,
 so a path outside the repository cannot be fingerprinted and the policy always re-runs.
 The scanner's compiled-rules cache is keyed by rules content,
 so it is not an input.
 It also looks for `.git` above its working directory,
 which is fixed for a commit.

 @param options - validated scanner options

 @returns declared inputs

 @example
 ```ts
 forbiddenStringsInputs({ executable: 'forbidden-strings', builtinRules: true });
 ```
 */
export function forbiddenStringsInputs(options: ForbiddenStringsPolicyOptions,): PolicyInputs {
  /**
   Rules file the scanner reads, relative to the repository root unless absolute.
   */
  const rulesPath = process.env
    .FORBIDDEN_STRINGS_RULES
    ?? DEFAULT_RULES_PATH;
  return {
    external: [
      {
        kind: 'executable',
        path: options.executable,
      },
      {
        kind: 'env',
        name: 'FORBIDDEN_STRINGS_RULES',
      },
      {
        kind: 'worktree',
        pathspecs: [`:(literal)${rulesPath}`,],
      },
    ],
  };
}

/**
 Scans exact candidate content through separately built forbidden-strings binary.
 
 @example
 ```ts
 forbiddenStringsPolicy.name;
 // => 'forbidden-strings'
 ```
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
  inputs: forbiddenStringsInputs,
  /**
   Scans lifecycle-selected candidate bytes.
   
   @param context - Policy context exposing lazy Git candidates.
   
   @param options - Scanner command and built-in-rule options.
   
   @returns Scanner findings for selected candidates.
   
   */
  async check({
    context,
    options,
  }): Promise<readonly PolicyFinding[]> {
    /**
     Exact lifecycle-selected candidates; every lifecycle now supplies only
     the operation's own delta, so no post-commit narrowing happens here.
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
 Optional forbidden-strings policy plugin shipped inert inside cli-git.
 
 @example
 ```ts
 forbiddenStringsPlugin.name;
 // => 'forbidden-strings'
 ```
 */
export const forbiddenStringsPlugin: PluginDefinition<
  readonly [typeof forbiddenStringsPolicy],
  'forbidden-strings'
> = definePlugin({
  name: 'forbidden-strings',
  policies: [forbiddenStringsPolicy,],
},);

export { parseCacheWarning, } from './cache-warning.ts';
export { ForbiddenStringsPluginError, } from './errors.ts';
export { parseScannerOutput, } from './scanner-output.ts';
export { scanCandidates, } from './scan-candidates.ts';
