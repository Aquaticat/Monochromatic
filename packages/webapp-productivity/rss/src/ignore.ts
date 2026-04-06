import { $ as mapIterableAsync, } from '@monochromatic-dev/module-es/map-iterable-async';
import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import type { Dirent, } from 'node:fs';
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { l as parentLogger, } from './log.ts';
import { IGNORE_PATH, } from './path.ts';

/** Tagged logger for the ignore module. */
const l = tagged({
  tag: 'ignore',
  l: parentLogger,
},);

//region Ignore content loading -- Reads raw JSONL content for salt derivation and link filtering

/**
 * Reads the raw text content of all ignore JSONL files.
 * Used both for content-derived memoize salt and for link filtering.
 *
 * @returns Concatenated raw text from all ignore files, or empty string if directory is missing
 *
 * @example
 * ```ts
 * const content = await getIgnoreContent();
 * ```
 */
export async function getIgnoreContent(): Promise<string> {
  const innerL = tagged({
    tag: getIgnoreContent.name,
    l,
  },);
  let filesInDir: Dirent[] = [];
  try {
    filesInDir = await readdir(
      IGNORE_PATH,
      { withFileTypes: true, },
    );
  }
  catch {
    innerL.debug('ignore directory not found',);
    return '';
  }
  const contents = await mapIterableAsync(
    function readIgnoreFile(dirent: Dirent,) {
      return readFile(
        join(
          dirent.parentPath,
          dirent.name,
        ),
        'utf8',
      );
    },
    filesInDir,
  );
  return contents.join('',);
}

/**
 * Parses ignored links from raw ignore file content.
 *
 * @param content - Raw JSONL text from ignore files
 *
 * @returns Set of link URLs that should be excluded from rendering
 *
 * @example
 * ```ts
 * const links = parseIgnoredLinks('{"link":"https://example.com"}\n');
 * ```
 */
export function parseIgnoredLinks(content: string,): Set<string> {
  const innerL = tagged({
    tag: parseIgnoredLinks.name,
    l,
  },);
  const links = new Set<string>();
  const lines = content
    .split('\n',)
    .map(function trimLine(line,) {
      return line.trim();
    },)
    .filter(function nonEmpty(line,) {
      return line.length > 0;
    },);
  for (const line of lines) {
    try {
      const parsed: unknown = JSON.parse(line,);
      if (parsed !== null && typeof parsed === 'object' && 'link' in parsed) {
        const { link, } = parsed;
        if (typeof link === 'string' && link !== '')
          links.add(link,);
      }
    }
    catch (error) {
      innerL.warn(`invalid JSON in ignore file: ${line} ${JSON.stringify(error,)}`,);
    }
  }
  innerL.debug(`${String(links.size,)} ignored links`,);
  return links;
}

//endregion Ignore content loading
