/**
 * Figma-to-Penpot file converter.
 *
 * Converts decoded Figma Kiwi documents (from `@monochromatic-dev/figma-kiwi`)
 * into Penpot binfile-v3 format: a ZIP archive of JSON files following the
 * penpot/export-files schema.
 *
 * @module figma-to-penpot
 */

import type { FigmaFile, } from '@monochromatic-dev/figma-kiwi/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { convertFigmaToPenpot, } from './document.ts';
import type { ConvertOptions, } from './types.ts';
import { serializePenpotZip, } from './zip.ts';

export { figmaColorToHex, } from './color.ts';
export { convertFigmaToPenpot, } from './document.ts';
export type {
  ConvertOptions,
  PenpotDocument,
  PenpotFile,
  PenpotFill,
  PenpotManifest,
  PenpotMedia,
  PenpotPage,
  PenpotSelRect,
  PenpotShape,
  PenpotShapeType,
  PenpotStorageObject,
  PenpotStroke,
  PenpotTransform,
} from './types.ts';
export { serializePenpotZip, } from './zip.ts';

/**
 * Convert a parsed Figma file to a Penpot export file.
 *
 * Converts the node tree to Penpot's JSON model and writes a `.penpot` ZIP,
 * optionally persisting it to disk.
 *
 * @param figmaFile - decoded Figma file from {@link parseFigmaFile}
 *
 * @param outputPath - path to write the `.penpot` file; omitted returns only the buffer
 *
 * @param options - conversion options
 *
 * @returns ZIP archive bytes
 *
 * @example
 * ```ts
 * const bytes = await figmaToPenpot({ figmaFile, outputPath: 'out.penpot', });
 * ```
 */
export async function figmaToPenpot(
  {
    figmaFile,
    outputPath,
    options = {},
  }: {
    readonly figmaFile: ForeignBorrowed<FigmaFile>;
    readonly outputPath?: string;
    readonly options?: ConvertOptions;
  },
): Promise<Uint8Array> {
  /**
   * Intermediate Penpot document model assembled before serialization.
   */
  const doc = convertFigmaToPenpot({
    figmaFile,
    options,
  },);
  /**
   * Final ZIP buffer returned to the caller and optionally written to disk.
   */
  const zipBuffer = serializePenpotZip(doc,);

  if (outputPath !== undefined) {
    /**
     * Lazy `node:fs/promises` import so the converter works without a filesystem when no output path is given.
     */
    const { writeFile, } = await import('node:fs/promises');
    await writeFile(
      outputPath,
      zipBuffer,
    );
  }

  return zipBuffer;
}
