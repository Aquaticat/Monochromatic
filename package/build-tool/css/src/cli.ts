#!/usr/bin/env node
import { object, } from '@optique/core/constructs';
import { argument, } from '@optique/core/primitives';
import { string, } from '@optique/core/valueparser';
import { runSync, } from '@optique/run';
import {
  build,
  type BuildOptions,
} from './index.ts';

//region CLI: parses args and runs the build

/**
 * Optique parser for the CSS build tool CLI.
 *
 * @example
 * ```bash
 * build-css src/main.css dist/bundle.css
 * ```
 */
const parser = object({
  input: argument(string({ metavar: 'INPUT', },),),
  output: argument(string({ metavar: 'OUTPUT', },),),
},);

/**
 * Parsed CLI arguments cast to the shared build options type
 */
const args: BuildOptions = runSync(
  parser,
  {
    programName: 'build-css',
    help: 'option',
  },
);

console.log(`Building CSS: ${args.input} -> ${args.output}`,);
await build(args,);
console.log('Build complete',);

//endregion CLI
