#!/usr/bin/env node
/**
 * CLI script to convert Figma export files to Penpot format.
 *
 * Usage: node src/convert.ts <input.fig|.deck|.jam> [output.penpot]
 */

import { writeFile, } from 'node:fs/promises';
import process from 'node:process';

import {
  FIGMA_DOCUMENT_ABSENT,
  parseFigmaFile,
} from '@monochromatic-dev/figma-kiwi/ts';

import {
  convertFigmaToPenpot,
  serializePenpotZip,
} from './index.ts';

/**
 * Figma export extensions whose output path is rewritten to `.penpot`.
 */
const FIGMA_EXTENSIONS: ReadonlySet<string> = new Set([
  'fig',
  'deck',
  'jam',
],);

/**
 * Swap a known Figma export extension for `.penpot`, leaving other paths as-is.
 *
 * @param path - input file path
 *
 * @returns path with a known Figma extension replaced by `.penpot`
 *
 * @example
 * ```ts
 * swapToPenpotExtension('a.fig'); // "a.penpot"
 * ```
 */
function swapToPenpotExtension(path: string,): string {
  /**
   * Index of the final `.` in the path, or -1 when the path has no extension.
   */
  const dot = path.lastIndexOf('.',);
  if (dot === (-1))
    return path;
  /**
   * Extension text after the final `.`.
   */
  const ext = path.slice(dot + 1,);
  return FIGMA_EXTENSIONS.has(ext,)
    ? `${path.slice(
      0,
      dot,
    )}.penpot`
    : path;
}

/**
 * Positional CLI arguments: input source path and optional output path.
 */
const [inputPath, outputPath,] = process.argv
  .slice(2,);

if (inputPath === undefined) {
  console.error('Usage: node src/convert.ts <input.fig|.deck|.jam> [output.penpot]',);
  throw new Error('Missing input path',);
}

/**
 * Fully decoded {@link FigmaFile} model that the conversion pipeline consumes.
 */
const figmaFile = await parseFigmaFile(inputPath,);
/**
 * Figma's own file name, used as the Penpot file name when present.
 */
const { fileName, } = figmaFile.meta;
/**
 * Intermediate Penpot document model produced by the converter.
 */
const doc = convertFigmaToPenpot({
  figmaFile,
  options: ((typeof fileName) === 'string') && (fileName !== '')
    ? { fileName, }
    : {},
},);

/**
 * Final ZIP buffer ready to be written to disk.
 */
const zipBuffer = serializePenpotZip(doc,);
/**
 * Resolved output path: caller's argument, otherwise the input path with its extension swapped.
 */
const outPath = outputPath ?? swapToPenpotExtension(inputPath,);

await writeFile(
  outPath,
  zipBuffer,
);

/**
 * Raw NodeChange list from the decoded document, when present.
 */
const nodeChanges = figmaFile.document === FIGMA_DOCUMENT_ABSENT
  ? []
  : figmaFile.document
    .nodeChanges;
/**
 * Count of NodeChange entries logged as a quick sanity-check of conversion scope.
 */
const nodeCount = Array.isArray(nodeChanges,) ? nodeChanges.length : 0;
console.log(
  `Converted ${figmaFile.fileType} (${nodeCount} nodes) -> ${outPath} (${zipBuffer.length} bytes)`,
);
