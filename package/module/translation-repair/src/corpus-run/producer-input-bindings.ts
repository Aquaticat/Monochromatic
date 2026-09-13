import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

/**
 * One fixed host-to-child filesystem role, not an arbitrary mount request.
 */
export type ProducerInputBinding = {
  /**
   * Canonical authorized source selected by the host owner.
   */
  readonly source: string;
  /**
   * Fixed child role path.
   */
  readonly target: string;
  /**
   * Only the private output role is writable.
   */
  readonly writable: boolean;
};

/**
 * Derives the entire application mount set from one initialized host instead of independent path arguments.
 *
 * @param host - owned launch, executable locations and exclusive run
 *
 * @returns Fixed mount roles shared by command construction and pre-start inspection
 *
 * @example
 * ```ts
 * const bindings = producerInputBindings(host);
 * ```
 */
export function producerInputBindings(host: ProducerInputHost): readonly ProducerInputBinding[] {
  return [
    {
      source: host.nodePath,
      target: PRODUCER_INPUT_PATHS.node,
      writable: false
    },
    {
      source: host.bootstrapPath,
      target: PRODUCER_INPUT_PATHS.bootstrap,
      writable: false
    },
    {
      source: host.run
        .launchPath,
      target: PRODUCER_INPUT_PATHS.launch,
      writable: false
    },
    {
      source: host.launch
        .runtime
        .dir,
      target: PRODUCER_INPUT_PATHS.runtime,
      writable: false
    },
    {
      source: host.launch
        .atomicLibrary
        .path,
      target: PRODUCER_INPUT_PATHS.atomicLibrary,
      writable: false
    },
    {
      source: host.launch
        .selection
        .path,
      target: PRODUCER_INPUT_PATHS.selection,
      writable: false
    },
    {
      source: host.launch
        .supporting
        .dir,
      target: PRODUCER_INPUT_PATHS.supporting,
      writable: false
    },
    {
      source: host.launch
        .corpus
        .dir,
      target: PRODUCER_INPUT_PATHS.corpus,
      writable: false
    },
    {
      source: host.run
        .outputDir,
      target: PRODUCER_INPUT_PATHS.output,
      writable: true
    },
  ];
}
