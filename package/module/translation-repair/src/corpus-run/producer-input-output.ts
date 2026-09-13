import { createHash, } from 'node:crypto';
import { open, } from 'node:fs/promises';
import { join, } from 'node:path';
import { isNativeError, } from 'node:util/types';
import {
  tagged,
  type Logger,
} from '@monochromatic-dev/module-logger/ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputFileIdentity, } from './producer-input-file.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Exclusive unqualified input output

/**
 * The input application cannot write caller-selected files or preparation-attempt markers.
 *
 * @example
 * ```ts
 * const file: ProducerInputOutputFile = 'complete.json';
 * ```
 */
type ProducerInputOutputFile = 'unqualified-inputs.json' | 'complete.json';

/**
 * Private output files remain inaccessible to other accounts.
 */
const PRIVATE_OUTPUT_MODE = 0o600;

/**
 * Writes and content-syncs one fixed file without overwrite, rename, resume or silent cleanup.
 * The host already created and bound this private output directory before data I/O.
 *
 * @param file - fixed artifact or completion role
 *
 * @param text - exact serialized output, never logged
 *
 * @param l - owning application logger
 *
 * @returns Raw output identity after file-content synchronization
 *
 * @throws ProducerInputRunError when exclusive write or synchronization fails
 *
 * @example
 * ```ts
 * const identity = await writeProducerInputOutput({ file: 'unqualified-inputs.json', text, l });
 * ```
 */
export async function writeProducerInputOutput({
  file,
  text,
  l,
}: {
  readonly file: ProducerInputOutputFile;
  readonly text: string;
  readonly l: Logger;
},): Promise<ProducerInputFileIdentity> {
  /**
   * Output telemetry carries fixed role names, not corpus-derived JSON.
   */
  const pl = tagged({
    tag: writeProducerInputOutput.name,
    l,
  },);
  if ((file !== 'unqualified-inputs.json') && (file !== 'complete.json'))
    throw new ProducerInputRunError({ operation: 'write-output', });
  /**
   * The mounted output root is fixed by the specialized runner.
   */
  const path = join(
    PRODUCER_INPUT_PATHS.output,
    file
  );
  pl.debug(`writing exclusive preparation input output ${JSON.stringify(file)}`);
  try {
    /**
     * Exclusive creation preserves any completed or partial file rather than reusing it.
     */
    await using handle = await open(
      path,
      'wx',
      PRIVATE_OUTPUT_MODE
    );
    await handle.writeFile(
      text,
      'utf8'
    );
    await handle.sync();
  }
  catch (error) {
    pl.warn(`preparation input output failed with ${Error.isError(error,) ? error.name : typeof error}; native details were not retained`);
    throw new ProducerInputRunError({
      operation: 'write-output',
      locator: path,
    });
  }
  /**
   * This identity describes completed bytes, not review or downstream acquisition permission.
   */
  const identity = {
    bytes: Buffer.byteLength(
      text,
      'utf8'
    ),
    sha256: createHash('sha256')
      .update(
        text,
        'utf8'
      )
      .digest('hex'),
  };
  pl.info(`synchronized preparation input output ${JSON.stringify(file)} with ${String(identity.bytes)} bytes`);
  return identity;
}

//endregion Exclusive unqualified input output
