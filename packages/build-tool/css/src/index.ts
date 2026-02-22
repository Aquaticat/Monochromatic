import { watch, } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from '@monochromatic-dev/module-es/ts/path/index.ts';
import { build, } from './build.ts';
import type { BuildOptions, } from './build.ts';

//region CLI -- parses args, runs the build, and optionally watches for changes

/** Minimum delay between rebuilds to avoid overlapping builds from rapid saves */
const DEBOUNCE_MS = 100;

/**
 * Parses command line arguments for the CSS build tool.
 * @returns Parsed build options
 * @throws When required arguments are missing
 * @example
 * ```bash
 * bun index.ts src/main.css dist/bundle.css
 * bun index.ts src/main.css dist/bundle.css --watch
 * ```
 */
function parseArgs(): BuildOptions {
  /** Raw CLI arguments after the script path */
  const args = process.argv.slice(2);

  if (args.length < 2) {
    throw new Error('Usage: bun index.ts <input> <output> [--watch]');
  }

  /** Positional arg: path to the CSS entry point */
  const input = args[0];
  /** Positional arg: path for the bundled output */
  const output = args[1];

  if (input === undefined || output === undefined) {
    throw new Error('Usage: bun index.ts <input> <output> [--watch]');
  }
  /** Whether to keep running and rebuild on file changes */
  const watchMode = args.includes('--watch');

  return { input, output, watch: watchMode, };
}

/**
 * Watches a directory for CSS file changes and triggers rebuilds with debouncing.
 * Uses the async iterator form of fs.watch (supported by Bun's node:fs/promises).
 * @param options - Build configuration including input/output paths
 */
async function watchAndRebuild(options: BuildOptions): Promise<void> {
  /** Directory to watch, derived from the input file's location */
  const inputDir = dirname(resolve(options.input));
  console.log(`Watching directory: ${inputDir}`);

  // Debounce state — `let` needed because the timer is replaced on each event
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  /** Async iterator from node:fs/promises that yields file system events */
  const watcher = watch(inputDir, { recursive: true, });

  // for-await is the only way to consume an AsyncIterable from fs.watch —
  // there is no functional alternative for an unbounded event stream.
  for await (const event of watcher) {
    if (event.filename === null || !event.filename.endsWith('.css')) {
      continue;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      console.log(`Change detected: ${event.filename}`);
      try {
        await build(options);
        console.log('Rebuild complete');
      } catch (rebuildError: unknown) {
        console.error('Rebuild failed:', rebuildError);
      }
    }, DEBOUNCE_MS);
  }
}

/**
 * Entry point: runs the build and optionally watches for changes.
 */
async function run(): Promise<void> {
  /** Parsed CLI arguments controlling input, output, and watch behavior */
  const options = parseArgs();

  console.log(`Building CSS: ${options.input} -> ${options.output}`);
  await build(options);
  console.log('Build complete');

  if (options.watch) {
    await watchAndRebuild(options);
  }
}

await run();

//endregion CLI
