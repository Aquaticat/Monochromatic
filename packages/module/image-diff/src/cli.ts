#!/usr/bin/env bun
// oxlint-disable prefer-destructuring -- CLI entry point with argv array access
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

import { handleCompare, } from './cli.compare.ts';
import { handleEmbed, } from './cli.embed.ts';

/**
 * Exit code for usage errors (missing args, bad flags).
 */
const EXIT_USAGE = 2;

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
  image-diff embed --provider voyage --model voyage-multimodal-3.5 photo.png`,);
  process.exitCode = EXIT_USAGE;
  throw new Error('Missing or invalid arguments',);
}

/** Raw CLI arguments after the Node/Bun binary and script path. */
const args = process.argv.slice(2,);
/** First positional argument selecting the subcommand (`compare` or `embed`). */
const subcommand = args[0];
/** Remaining arguments passed through to the subcommand handler. */
const subArgs = args.slice(1,);

if (subcommand === 'compare')
  await handleCompare(subArgs, printUsageAndExit,);
else if (subcommand === 'embed')
  await handleEmbed(subArgs, printUsageAndExit,);
else {
  if (subcommand !== undefined)
    console.error(`Error: unknown subcommand "${subcommand}"`,);
  printUsageAndExit();
}
