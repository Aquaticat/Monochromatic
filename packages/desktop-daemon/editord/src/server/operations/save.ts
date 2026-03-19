/**
 * File save operation.
 *
 * Writes content to a file on disk.
 */

import { writeFile, } from 'node:fs/promises';
import { resolve, } from 'node:path';

/**
 * Writes content to a file on disk.
 *
 * @param filePath - path to the file (relative paths resolve against cwd)
 *
 * @param content - full file content to write
 *
 * @throws {Error} when the file cannot be written
 */
export async function saveFile(filePath: string, content: string,): Promise<void> {
  const absolutePath = resolve(filePath,);
  await writeFile(absolutePath, content, 'utf8',);
}
