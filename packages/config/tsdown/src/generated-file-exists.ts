import { access, } from 'node:fs/promises';
import { fileURLToPath, } from 'node:url';

/**
 * Checks whether generated Browserslist target JSON exists.
 *
 * @param fileUrl - Generated JSON file URL to check.
 *
 * @returns Whether generated file exists on disk.
 *
 * @example
 * ```ts
 * await generatedFileExists(new URL('file:///tmp/targets.json'));
 * ```
 */
export async function generatedFileExists(fileUrl: URL,): Promise<boolean> {
  try {
    await access(fileURLToPath(fileUrl,),);
    return true;
  }
  catch (error) {
    if (!(Error.isError(error,)))
      throw error;

    return false;
  }
}
