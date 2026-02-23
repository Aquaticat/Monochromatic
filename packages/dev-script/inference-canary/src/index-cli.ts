/**
 * CLI argument parsing for the inference canary entry point.
 */

/** Raw CLI arguments after the script path */
const args = process.argv.slice(2);

/**
 * Extracts a named flag value from CLI args.
 * @param flag - flag name including dashes (e.g. "--model")
 * @returns flag value if present, undefined otherwise
 */
export function getFlag(flag: string): string | undefined {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1 || flagIndex + 1 >= args.length) return undefined;
  return args[flagIndex + 1];
}

/** Single-model override from --model flag */
export const modelOverride = getFlag('--model');

/** Consistency runs override from --runs flag */
export const runsOverride = getFlag('--runs');

/** Whether to run simple probes instead of code-gen */
export const useSimple = args.includes('--simple');

/** Whether to include slow probes */
export const includeSlow = args.includes('--slow');

/** Retest all models even if they have recent (<24h) results */
export const retestAll = args.includes('--retest-all');
