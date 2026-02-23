/**
 * CLI entry point for the inference canary.
 *
 * Runs code-generation probes by default (model writes TypeScript CLIs,
 * executed in throwaway containers). Use --simple for cheap text-only checks.
 *
 * Usage:
 *   bun packages/dev-script/inference-canary/src/index.ts [options]
 *
 * Options:
 *   --provider openrouter|anthropic  API provider (default: openrouter)
 *   --model <id>                     Override model ID
 *   --runs <n>                       Consistency runs per probe (default: 2)
 *   --simple                         Run cheap text-only probes instead of code-gen
 *
 * Environment (read from .env.local via mise):
 *   INFERENCE_VALIDATION_OPENROUTER_API_KEY -- OpenRouter API key
 *   INFERENCE_VALIDATION_CLAUDE_API_KEY     -- direct Anthropic API key
 */
import { codeGenProbes, codeGenProbesAll, simpleProbes, } from './probes.ts';
import { formatReport, } from './report.ts';
import { runCanary, } from './runner.ts';

//region Provider configuration

/** OpenRouter base URL -- Anthropic SDK appends /v1/messages, so base is /api */
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api';

/** Default model when using OpenRouter */
const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6';

/** Default model when using Anthropic directly */
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6-20260217';

//endregion Provider configuration

//region CLI argument parsing

/** Raw CLI arguments after the script path */
const args = process.argv.slice(2);

/**
 * Extracts a named flag value from CLI args.
 * @param flag - flag name including dashes (e.g. "--model")
 * @returns flag value if present, undefined otherwise
 */
function getFlag(flag: string): string | undefined {
  const flagIndex = args.indexOf(flag);
  if (flagIndex === -1 || flagIndex + 1 >= args.length) return undefined;
  return args[flagIndex + 1];
}

/** Provider selection: openrouter (default) or anthropic */
const provider = getFlag('--provider') ?? 'openrouter';

/** Model override from --model flag */
const modelOverride = getFlag('--model');

/** Consistency runs override from --runs flag */
const runsOverride = getFlag('--runs');

/** Whether to run simple probes instead of code-gen */
const useSimple = args.includes('--simple');

/** Whether to include slow probes (e.g. task-scheduler with real async delays) */
const includeSlow = args.includes('--slow');

//endregion CLI argument parsing

//region Provider resolution

/**
 * Resolves API credentials and base URL from environment based on provider choice.
 * @param providerName - "openrouter" or "anthropic"
 * @returns configuration partial with apiKey, baseURL, and model defaults
 */
function resolveProvider(providerName: string): { apiKey: string; baseURL?: string; model: string } {
  if (providerName === 'openrouter') {
    const apiKey = process.env['INFERENCE_VALIDATION_OPENROUTER_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      throw new Error('INFERENCE_VALIDATION_OPENROUTER_API_KEY not set in environment');
    }
    return {
      apiKey,
      baseURL: OPENROUTER_BASE_URL,
      model: OPENROUTER_DEFAULT_MODEL,
    };
  }

  if (providerName === 'anthropic') {
    const apiKey = process.env['INFERENCE_VALIDATION_CLAUDE_API_KEY'];
    if (apiKey === undefined || apiKey === '') {
      throw new Error('INFERENCE_VALIDATION_CLAUDE_API_KEY not set in environment');
    }
    return {
      apiKey,
      model: ANTHROPIC_DEFAULT_MODEL,
    };
  }

  throw new Error(`Unknown provider: ${providerName}. Use "openrouter" or "anthropic".`);
}

//endregion Provider resolution

//region Execution

const providerConfig = resolveProvider(provider);
// eslint-disable-next-line no-nested-ternary -- simple three-way probe tier selection
const probes = useSimple ? simpleProbes : includeSlow ? codeGenProbesAll : codeGenProbes;

console.log(`[canary] provider: ${provider}`);
console.log(`[canary] probe tier: ${useSimple ? 'simple' : 'code-gen'}`);
console.log('[canary] starting inference canary check...');
console.log('');

const report = await runCanary(probes, {
  model: modelOverride ?? providerConfig.model,
  apiKey: providerConfig.apiKey,
  ...(providerConfig.baseURL !== undefined ? { baseURL: providerConfig.baseURL, } : {}),
  ...(runsOverride !== undefined ? { consistencyRuns: Number(runsOverride), } : {}),
});

console.log('');
console.log(formatReport(report));

if (report.degradationLikely) {
  throw new Error('Inference degradation detected');
}

//endregion Execution
