#!/usr/bin/env bun
// oxlint-disable typescript/no-unsafe-type-assertion, init-declarations, prefer-destructuring -- CLI script with argument parsing; type assertions for parsed JSON
/**
 * CLI for perceptual image difference comparison using multimodal embeddings.
 * Supports Voyage AI and Google Gemini backends.
 *
 * @example
 * ```sh
 * # Compare using all providers (default)
 * image-diff compare before.png after.png
 *
 * # Compare with a specific provider
 * image-diff compare --provider gemini before.png after.png
 *
 * # Embed with a specific model
 * image-diff embed --provider voyage --model voyage-multimodal-3.5 photo.png
 *
 * # Embed using all providers
 * image-diff embed photo.png
 * ```
 *
 * @packageDocumentation
 */

import { compare, compareAll, embed, embedAll } from './client.ts';
import type { EmbeddingModel, ImageInput, Provider } from './types.ts';
import { l, tagged } from './log.ts';

/**
 * Exit code for usage errors (missing args, bad flags).
 */
const EXIT_USAGE = 2;

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
const VALID_PROVIDERS: readonly string[] = ['voyage', 'gemini'];

/**
 * Print usage information to stderr and exit with code 2.
 *
 * @throws exits the process via process.exitCode and throw
 */
function printUsageAndExit(): never {
  console.error(`Usage:
  image-diff compare <imageA> <imageB> [--provider <provider>] [--model <model>]
  image-diff embed <image> [--provider <provider>] [--model <model>]

Arguments:
  <image>      File path or URL to an image (png, jpeg, webp, gif)

Options:
  --provider   Embedding provider (voyage or gemini). Omit to use all providers.
  --model      Model override (voyage-multimodal-3, voyage-multimodal-3.5, gemini-embedding-2-preview)

Environment:
  IMAGE_DIFF_VOYAGE_API_KEY       Voyage AI API key (fallback: VOYAGE_API_KEY)
  IMAGE_DIFF_GEMINI_API_KEY       Gemini API key (fallback: GEMINI_API_KEY)
  IMAGE_DIFF_OPENROUTER_API_KEY   OpenRouter API key (fallback: OPENROUTER_API_KEY)

Examples:
  image-diff compare before.png after.png
  image-diff compare --provider gemini a.png b.png
  image-diff embed photo.png
  image-diff embed --provider voyage --model voyage-multimodal-3.5 photo.png`);
  process.exitCode = EXIT_USAGE;
  throw new Error('Missing or invalid arguments');
}

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
function parseImageArg(arg: string): ImageInput {
  if (arg.startsWith('http://') || arg.startsWith('https://')) {
    return { url: arg };
  }
  return { path: arg };
}

/**
 * Parsed CLI flags extracted from argv.
 */
type ParsedFlags = {
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
 * @returns parsed flags and remaining positional args
 */
function parseFlags(args: string[]): ParsedFlags {
  let provider: Provider | undefined;
  let model: EmbeddingModel | undefined;
  const remaining: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) break;

    if (arg === '--provider') {
      const value = args[i + 1];
      if (value === undefined) {
        console.error('Error: --provider requires a value');
        printUsageAndExit();
      }
      if (!VALID_PROVIDERS.includes(value)) {
        console.error(`Error: invalid provider "${value}". Use: ${VALID_PROVIDERS.join(', ')}`);
        printUsageAndExit();
      }
      provider = value as Provider;
      i += 2;
    } else if (arg === '--model') {
      const value = args[i + 1];
      if (value === undefined) {
        console.error('Error: --model requires a value');
        printUsageAndExit();
      }
      if (!VALID_MODELS.includes(value)) {
        console.error(`Error: invalid model "${value}". Use: ${VALID_MODELS.join(', ')}`);
        printUsageAndExit();
      }
      model = value as EmbeddingModel;
      i += 2;
    } else {
      remaining.push(arg);
      i += 1;
    }
  }

  return { provider, model, remaining };
}

/**
 * Handle the `compare` subcommand.
 *
 * @param args - CLI arguments after "compare"
 */
async function handleCompare(args: string[]): Promise<void> {
  const rl = tagged({ tag: handleCompare.name, l });
  const { provider, model, remaining } = parseFlags(args);

  if (remaining.length !== 2) {
    console.error('Error: compare requires exactly 2 image arguments');
    printUsageAndExit();
  }

  const argA = remaining[0];
  const argB = remaining[1];
  if (argA === undefined || argB === undefined) {
    console.error('Error: compare requires exactly 2 image arguments');
    printUsageAndExit();
  }
  const imageA = parseImageArg(argA);
  const imageB = parseImageArg(argB);

  if (provider !== undefined) {
    rl.debug(`comparing via ${provider}`);
    const config = {
      provider,
      ...(model !== undefined ? { model } : {}),
    };
    const result = await compare(imageA, imageB, config);

    console.log(JSON.stringify({
      provider,
      similarity: result.similarity,
      distance: result.distance,
      embeddingDimensions: result.embeddingA.length,
      description: result.description,
    }, null, 2));
  } else {
    rl.debug('comparing via all providers');
    const results = await compareAll(imageA, imageB);

    console.log(JSON.stringify(
      results.map(function formatEntry(entry) {
        return {
          provider: entry.provider,
          similarity: entry.result.similarity,
          distance: entry.result.distance,
          embeddingDimensions: entry.result.embeddingA.length,
          description: entry.result.description,
        };
      }),
      null,
      2,
    ));
  }
}

/**
 * Handle the `embed` subcommand.
 *
 * @param args - CLI arguments after "embed"
 */
async function handleEmbed(args: string[]): Promise<void> {
  const rl = tagged({ tag: handleEmbed.name, l });
  const { provider, model, remaining } = parseFlags(args);

  if (remaining.length !== 1) {
    console.error('Error: embed requires exactly 1 image argument');
    printUsageAndExit();
  }

  const embedArg = remaining[0];
  if (embedArg === undefined) {
    console.error('Error: embed requires exactly 1 image argument');
    printUsageAndExit();
  }
  const image = parseImageArg(embedArg);

  if (provider !== undefined) {
    rl.debug(`embedding via ${provider}`);
    const config = {
      provider,
      ...(model !== undefined ? { model } : {}),
    };
    const result = await embed(image, config);

    console.log(JSON.stringify({
      provider,
      dimensions: result.embedding.length,
      usage: result.usage,
      embedding: result.embedding,
    }, null, 2));
  } else {
    rl.debug('embedding via all providers');
    const results = await embedAll(image);

    console.log(JSON.stringify(
      results.map(function formatEntry(entry) {
        return {
          provider: entry.provider,
          dimensions: entry.result.embedding.length,
          usage: entry.result.usage,
          embedding: entry.result.embedding,
        };
      }),
      null,
      2,
    ));
  }
}

/** Raw CLI arguments after the Node/Bun binary and script path. */
const args = process.argv.slice(2);
/** First positional argument selecting the subcommand (`compare` or `embed`). */
const subcommand = args[0];
/** Remaining arguments passed through to the subcommand handler. */
const subArgs = args.slice(1);

if (subcommand === 'compare') {
  await handleCompare(subArgs);
} else if (subcommand === 'embed') {
  await handleEmbed(subArgs);
} else {
  if (subcommand !== undefined) {
    console.error(`Error: unknown subcommand "${subcommand}"`);
  }
  printUsageAndExit();
}
