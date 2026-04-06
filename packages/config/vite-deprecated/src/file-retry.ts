import { readFile, } from 'node:fs/promises';

//region File retry -- Read helpers with exponential backoff

/**
 * Reads a file with retry logic for EPERM errors on Windows.
 * Retries with exponential backoff when the file is temporarily locked.
 *
 * @param path - file path to read
 *
 * @param options - encoding and flag options for readFile
 *
 * @param retries - remaining retry attempts before giving up
 *
 * @param delayMs - milliseconds to wait before the next retry
 *
 * @returns file contents as a UTF-8 string
 *
 * @throws When the file cannot be read after all retries
 *
 * @example
 * ```ts
 * import { readFileWithRetry } from '\@monochromatic-dev/config-vite/file-retry.ts';
 *
 * const content = await readFileWithRetry('config.json', 'utf8');
 * ```
 */
export async function readFileWithRetry(
  path: Parameters<typeof readFile>[0],
  options: Parameters<typeof readFile>[1],
  retries = 4,
  delayMs = 10,
): Promise<string> {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- readFile with utf8 encoding returns string
    return await readFile(
      path,
      options,
    ) as string;
  }
  catch (error) {
    if (
      error instanceof Error && 'code' in error && error
          .code === 'EPERM' && retries > 0
    ) {
      // console.warn(`Retrying readFile for ${path} due to EPERM... (${retries} retries left, delay ${delayMs}ms)`);
      await wait(delayMs,);
      return readFileWithRetry(
        path,
        options,
        retries - 1,
        delayMs * 2,
      );
    }
    throw error;
  }
}

/**
 * Creates a promise that resolves after a delay.
 *
 * @param timeInMs - milliseconds to wait before resolving
 *
 * @returns promise that resolves after the specified delay
 */
function wait(timeInMs: number,): Promise<undefined> {
  // oxlint-disable-next-line promise/avoid-new
  return new Promise(function createTimeout(resolve,) {
    setTimeout(
      resolve,
      timeInMs,
    );
  },);
}

//endregion File retry
