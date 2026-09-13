import type { ProducerInputFileIdentity, } from './producer-input-file.ts';
import { createProducerInputContainer, } from './producer-input-host-create.ts';
import { initializeProducerInputHost, } from './producer-input-host-init.ts';
import { useProducerInputContainer, } from './producer-input-host-use.ts';
import type { ProducerInputCompletion, } from './producer-input-model.ts';
import {
  assertProducerInputNotInterrupted,
  producerInputSignals,
} from './producer-input-signals.ts';

/**
 * Host result identifies existing unqualified output, never a reviewed root or writer plan.
 */
export type ProducerInputHostResult = {
  /**
   * Exclusive private run directory retained on disk.
   */
  readonly directory: string;
  /**
   * Internally consistent completion metadata after native container cleanup.
   */
  readonly completion: ProducerInputCompletion;
};

/**
 * Executes the one provider-free preparation-input operation through host-owned creation and child verification.
 * No broad application barrel, provider factory, arbitrary command or future live mode is available here.
 *
 * @param launchPath - caller-selected launch record
 *
 * @param expected - independently supplied launch extent and SHA-256
 *
 * @param bootstrapPath - actual standalone entry filename, independently authenticated by the trusted caller
 *
 * @returns Existing unqualified output after synchronized lifecycle evidence and checked container removal
 *
 * @throws Error when launch, context, execution, output or cleanup fails; the CLI renders only audited names
 *
 * @example
 * ```ts
 * const result = await runProducerInputHost({ launchPath, expected, bootstrapPath });
 * ```
 */
export async function runProducerInputHost({
  launchPath,
  expected,
  bootstrapPath,
}: {
  readonly launchPath: string;
  readonly expected: ProducerInputFileIdentity;
  readonly bootstrapPath: string;
},): Promise<ProducerInputHostResult> {
  /**
   * Parent signals remain owned until native cleanup and terminal recording have finished.
   */
  using signals = producerInputSignals();
  try {
    /**
     * Independent launch and filesystem bindings are composed by one owner, not caller-provided certificates.
     */
    const host = await initializeProducerInputHost({
      launchPath,
      expected,
      bootstrapPath
    });
    /**
     * No Node process starts before its exact native creation contract can be inspected.
     */
    const id = await createProducerInputContainer({
      host,
      signal: signals.signal
    });
    /**
     * A failure retains all run files and never resumes or substitutes inputs.
     */
    const completion = await useProducerInputContainer({
      host,
      id,
      signal: signals.signal
    });
    assertProducerInputNotInterrupted(signals.signal);
    return {
      directory: host.run
        .dir,
      completion,
    };
  }
  catch (error) {
    assertProducerInputNotInterrupted(signals.signal);
    throw error;
  }
}
