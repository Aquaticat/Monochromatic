import { watch, } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';
import { build, } from './build.ts';
import type { BuildOptions, } from './build.ts';

//region CLI

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
  const args = process.argv.slice(2);

  if (args.length < 2) {
    throw new Error('Usage: bun index.ts <input> <output> [--watch]');
  }

  const input = args[0] as string;
  const output = args[1] as string;
  const watchMode = args.includes('--watch');

  return { input, output, watch: watchMode, };
}

/**
 * Entry point: runs the build and optionally watches for changes.
 */
async function run(): Promise<void> {
  const options = parseArgs();

  console.log(`Building CSS: ${options.input} -> ${options.output}`);
  await build(options);
  console.log('Build complete');

  if (options.watch) {
    const inputDir = dirname(resolve(options.input));
    console.log(`Watching directory: ${inputDir}`);

    watch(inputDir, { recursive: true, }, async (_eventType, filename) => {
      if (filename && filename.endsWith('.css')) {
        console.log(`Change detected: ${filename}`);
        try {
          await build(options);
          console.log('Rebuild complete');
        } catch (rebuildError) {
          console.error('Rebuild failed:', rebuildError);
        }
      }
    });
  }
}

await run();

//endregion CLI
