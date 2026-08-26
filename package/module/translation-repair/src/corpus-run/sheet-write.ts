import { access, } from 'node:fs/promises';
import { join, } from 'node:path';

import { StatedRefusalError, } from '../stated-refusal.ts';
import { writeFileAtomic, } from './atomic-write.ts';

//region Sheet write
// Writing a grading sheet beside its manifest.
//
// A SHEET IS A GRADER'S WORK IN PROGRESS the moment it lands, so a rerun into
// the same runs directory must not replace it: the two writers this serves
// used to write both files in place, which replaced a sheet a grader may have
// been partway through, and a crash between the two writes left a sheet and a
// manifest from different runs beside each other. Both files are refused while
// either exists, and each is written atomically.

/**
 * Whether a file sits at a path.
 *
 * @param path - file to look for
 *
 * @returns Whether it is there
 *
 * @example
 * ```ts
 * const taken = await exists({ path, },);
 * ```
 */
async function exists({ path, }: { readonly path: string; },): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error) {
    // Absent is the ordinary answer; anything else is still an absence for
    // this purpose, and the write that follows says what is wrong with the path.
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 * Writes a sheet and its manifest, refusing to replace either.
 *
 * @param dir - directory both land in
 *
 * @param sheetName - sheet file name
 *
 * @param manifestName - manifest file name
 *
 * @param sheet - sheet text
 *
 * @param manifest - manifest text
 *
 * @returns Path the sheet landed at
 *
 * @throws {@link StatedRefusalError} when either file is already there
 *
 * @example
 * ```ts
 * const at = await writeSheetPair({ dir, sheetName: 'damage-sheet.md', manifestName: 'damage-manifest.json', sheet, manifest, },);
 * ```
 */
export async function writeSheetPair(
  {
    dir,
    sheetName,
    manifestName,
    sheet,
    manifest,
  }: {
    readonly dir: string;
    readonly sheetName: string;
    readonly manifestName: string;
    readonly sheet: string;
    readonly manifest: string;
  },
): Promise<string> {
  /**
   * Where the sheet lands.
   */
  const sheetPath = join(
    dir,
    sheetName,
  );

  /**
   * Where the manifest lands.
   */
  const manifestPath = join(
    dir,
    manifestName,
  );
  for (const path of [
    sheetPath,
    manifestPath,
  ]) {
    /* oxlint-disable no-await-in-loop -- two files, checked in order so the refusal names the first one found */
    if (await exists({ path, },))
      throw new StatedRefusalError({
        says: `${path} already exists; grade or move it before rerunning, since a rerun would replace a grader's work`,
      },);
    /* oxlint-enable no-await-in-loop */
  }
  await writeFileAtomic({
    path: manifestPath,
    text: manifest,
  },);
  await writeFileAtomic({
    path: sheetPath,
    text: sheet,
  },);
  return sheetPath;
}

//endregion Sheet write
