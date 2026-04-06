// oxlint-disable typescript/no-unsafe-type-assertion, init-declarations -- CLI script with argument parsing
import type {
  EmbeddingModel,
  ImageInput,
  Provider,
} from './types.ts';

/**
 * All recognized model names across providers.
 */
const VALID_MODELS: readonly string[] = [
  'voyage-multimodal-3',
  'voyage-multimodal-3.5',
  'gemini-embedding-2-preview',
];

/**
 * All recognized provider names.
 */
const VALID_PROVIDERS: readonly string[] = [
  'voyage',
  'gemini',
];

/**
 * Parse a positional image argument into an {@link ImageInput}.
 * URLs (starting with http:// or https://) become URL inputs;
 * everything else is treated as a file path.
 *
 * @param arg - CLI positional argument
 *
 * @returns parsed image input
 *
 * @example
 * ```ts
 * parseImageArg('photo.png') // { path: 'photo.png' }
 * parseImageArg('https://example.com/a.jpg') // { url: 'https://...' }
 * ```
 */
export function parseImageArg(arg: string,): ImageInput {
  if (arg.startsWith('http://',) || arg.startsWith('https://',))
    return { url: arg, };
  return { path: arg, };
}

/**
 * Parsed CLI flags extracted from argv.
 */
export type ParsedFlags = {
  /** Provider name, or undefined for all providers. */
  readonly provider: Provider | undefined;
  /** Model name override. */
  readonly model: EmbeddingModel | undefined;
  /** Remaining positional arguments. */
  readonly remaining: string[];
};

/**
 * Extract `--provider` and `--model` flags from argv.
 *
 * @param args - CLI arguments after the subcommand
 *
 * @param printUsageAndExit - callback to print usage and exit on errors
 *
 * @returns parsed flags and remaining positional args
 *
 * @example
 * ```ts
 * const { provider, model, remaining } = parseFlags(['--provider', 'voyage', 'a.png', 'b.png'], printUsageAndExit);
 * // provider === 'voyage', remaining === ['a.png', 'b.png']
 * ```
 */
export function parseFlags(
  args: string[],
  printUsageAndExit: () => never,
): ParsedFlags {
  let provider: Provider | undefined;
  let model: EmbeddingModel | undefined;
  const remaining: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined)
      break;

    if (arg === '--provider') {
      const value = args[i + 1];
      if (value === undefined) {
        console.error('Error: --provider requires a value',);
        printUsageAndExit();
      }
      if (!VALID_PROVIDERS.includes(value,)) {
        console.error(
          `Error: invalid provider "${value}". Use: ${VALID_PROVIDERS.join(', ',)}`,
        );
        printUsageAndExit();
      }
      provider = value as Provider;
      i += 2;
    }
    else if (arg === '--model') {
      const value = args[i + 1];
      if (value === undefined) {
        console.error('Error: --model requires a value',);
        printUsageAndExit();
      }
      if (!VALID_MODELS.includes(value,)) {
        console.error(
          `Error: invalid model "${value}". Use: ${VALID_MODELS.join(', ',)}`,
        );
        printUsageAndExit();
      }
      model = value as EmbeddingModel;
      i += 2;
    }
    else {
      remaining.push(arg,);
      i += 1;
    }
  }

  return {
    provider,
    model,
    remaining,
  };
}
