#!/usr/bin/env node
import { basename, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import {
  namesWithoutQuoting,
  refusalText,
} from '../refusal-text.ts';
import { readProducerInputArguments, } from './producer-input-args.ts';
import { runProducerInputChild, } from './producer-input-child.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { runProducerInputHost, } from './producer-input-host.ts';
import { ProducerInputInterruptedError, } from './producer-input-signals.ts';

/**
 * Stated refusals remain distinct from an unexpected bootstrap fault.
 */
const REFUSAL_EXIT = 6;
/**
 * Unexpected faults are rendered without unmarked parser or subprocess bodies.
 */
const FAULT_EXIT = 5;
/**
 * Parent interruption retains the conventional signal-specific process status.
 */
const INTERRUPTED_EXIT = {
  SIGINT: 130,
  SIGTERM: 143,
} as const;

/**
 * Runs only the specialized provider-free input reconstruction or its fixed private child branch.
 * The caller must independently authenticate the frozen bootstrap and host execution platform before invoking Node.
 *
 * @throws Error when a guarded operation fails; the outer boundary renders only audited refusal text
 *
 * @example
 * ```text
 * producer-prepare --launch /absolute/launch.json --launch-sha256 <sha256> --launch-bytes <bytes>
 * ```
 */
async function main(): Promise<void> {
  /**
   * CLI tokens cannot select a provider, arbitrary entrypoint or broader operation.
   */
  const input = readProducerInputArguments(process.argv
    .slice(2));
  if (input.kind === 'help') {
    console.log('producer-prepare --launch /absolute/launch.json --launch-sha256 <sha256> --launch-bytes <bytes>\nReconstructs private, unqualified preparation inputs without provider calls.\nUse an independently reviewed frozen bootstrap and launch identity; completion is not root, phase or writer approval.');
    return;
  }
  /**
   * The standalone bundle, not an unbundled TypeScript source or broad application barrel, is the CLI.
   */
  const bootstrapPath = import.meta.filename;
  if (basename(bootstrapPath) !== 'producer-prepare.mjs')
    throw new ProducerInputRunError({
      operation: 'verify-runtime',
      locator: 'standalone bootstrap filename',
    });
  if (input.kind === 'child') {
    /**
     * The child owner imports the dedicated application only after its fixed verification sequence.
     */
    const completion = await runProducerInputChild();
    console.log(JSON.stringify(completion));
    return;
  }
  /**
   * The host owns initialization, stopped creation, inspection, start, output verification and cleanup together.
   */
  const result = await runProducerInputHost({
    launchPath: input.launchPath,
    expected: input.expected,
    bootstrapPath
  });
  console.log(JSON.stringify({
    kind: 'producer-preparation-input-host-complete',
    ...result
  }));
}

try {
  await main();
}
catch (error) {
  console.error(`producer-prepare: ${refusalText({ error })}`);
  process.exitCode = error instanceof ProducerInputInterruptedError ? INTERRUPTED_EXIT[error.signal]
    : namesWithoutQuoting(error) ? REFUSAL_EXIT : FAULT_EXIT;
}
