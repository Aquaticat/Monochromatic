import { createHash, } from 'node:crypto';
import { refusalText, } from '../refusal-text.ts';
import { producerInputContainerArgs, } from './producer-input-container.ts';
import { readProducerInputCommand, runProducerInputCommand, } from './producer-input-command.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import { verifyProducerInputFile, } from './producer-input-file.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { writeProducerInputControl, } from './producer-input-run.ts';

/** Native container IDs are canonical lowercase hexadecimal strings. */
const CONTAINER_ID_WIDTH = 64;

/**
 * Reads only the ID returned by the successful create operation, not a name-based ownership guess.
 *
 * @param text - bounded native creation stdout
 *
 * @returns Canonical container identity
 *
 * @throws ProducerInputRunError when native output cannot identify one created container
 *
 * @example
 * ```ts
 * const id = createdContainerId(text);
 * ```
 */
function createdContainerId(text: string): string {
  /** Podman's printed line terminator is not part of the container identity. */
  const id = text.endsWith('\n') ? text.slice(0, -1) : text;
  if (id.length !== CONTAINER_ID_WIDTH)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created container identity', });
  for (let index = 0; index < id.length; index += 1) {
    if (!'0123456789abcdef'.includes(id.charAt(index)))
      throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created container identity', });
  }
  return id;
}

/**
 * Verifies the exact local image and creates a stopped container before any child Node execution.
 * A failed or ambiguous creation leaves evidence for reconciliation, never name-based removal of another container.
 *
 * @param host - initialized cross-bound host owner
 *
 * @param signal - host interruption
 *
 * @returns Identity confirmed by creation stdout and its exclusive cidfile
 *
 * @throws ProducerInputRunError when image or creation evidence differs
 *
 * @example
 * ```ts
 * const id = await createProducerInputContainer({ host, signal });
 * ```
 */
export async function createProducerInputContainer({ host, signal, }: { readonly host: ProducerInputHost; readonly signal: AbortSignal; },): Promise<string> {
  try {
    await runProducerInputCommand({ host, stage: 'image', arguments_: ['image', 'inspect', '--format', '{{.Id}} {{.Os}} {{.Architecture}}', host.launch.imageId], signal });
    /** This projection contains no image environment values or unrelated metadata. */
    const image = await readProducerInputCommand({ host, stage: 'image' });
    if (image.trim() !== `${host.launch.imageId} linux amd64`)
      throw new ProducerInputRunError({ operation: 'launch-container', locator: 'local image identity and target', });
    await runProducerInputCommand({ host, stage: 'create', arguments_: producerInputContainerArgs(host), signal });
    /** Successful native creation output identifies only this run's container. */
    const id = createdContainerId(await readProducerInputCommand({ host, stage: 'create' }));
    await verifyProducerInputFile({ path: host.run.containerIdPath, expected: { bytes: CONTAINER_ID_WIDTH, sha256: createHash('sha256').update(id).digest('hex') }, operation: 'launch-container' });
    return id;
  }
  catch (error) {
    await writeProducerInputControl({ dir: host.run.dir, file: 'container-terminal.json', bytes: new TextEncoder().encode(JSON.stringify({
      version: 1,
      kind: 'producer-preparation-input-terminal',
      phase: 'host-creation',
      state: 'refused-before-confirmed-container',
      runId: host.run.runId,
      refusal: refusalText({ error }),
      recovery: 'Retain any cidfile and native creation evidence; do not remove a container by name or resume this run automatically.',
    })) });
    throw error;
  }
}
