#!/usr/bin/env bun
import { build, } from './index.ts';
import type { BuildOptions, } from './index.ts';

//region CLI -- parses args and runs the build

/**
 * Parses command line arguments for the CSS build tool.
 * @returns Parsed build options
 * @throws When required arguments are missing
 * @example
 * ```bash
 * bun index.ts src/main.css dist/bundle.css
 * ```
 */
function parseArgs(): BuildOptions {
  /** Raw CLI arguments after the script path */
  const args = process.argv.slice(2);

  if (args.length < 2) {
    throw new Error('Usage: bun index.ts <input> <output>');
  }

  /** Positional arg: path to the CSS entry point */
  const input = args[0];
  /** Positional arg: path for the bundled output */
  const output = args[1];

  if (input === undefined || output === undefined) {
    throw new Error('Usage: bun index.ts <input> <output>');
  }

  return { input, output, };
}

/**
 * Entry point: runs the CSS build.
 */
async function run(): Promise<void> {
  /** Parsed CLI arguments controlling input and output paths */
  const options = parseArgs();

  console.log(`Building CSS: ${options.input} -> ${options.output}`);
  await build(options);
  console.log('Build complete');
}

await run();

//endregion CLI
