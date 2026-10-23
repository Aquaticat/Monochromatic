import { glob, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

//region Sources that declare an answer schema
// What `claude-schemas.unit.test.ts` reads to keep the list of schema producers honest: the family's own source files,
// and the files among them that write a `json_schema` response format.

/**
 One source file of the family.
 */
export type SourceFile = {
  /**
   Path under `package/translation-repair`, as the producer list names files.
   */
  readonly file: string;

  /**
   The file's text.
   */
  readonly text: string;
};

/**
 Directory holding the family's packages.
 */
const FAMILY_ROOT = join(import.meta.dirname, '..', '..',);

/**
 Every non-test source file of the family, with its text.

 @returns One entry per file under a package's `src`, tests and fixtures left out

 @example
 ```ts
 const sources = await familySources();
 ```
 */
export async function familySources(): Promise<readonly SourceFile[]> {
  /**
   Files read so far.
   */
  const found: SourceFile[] = [];
  for await (const file of glob('*/src/**/*.ts', { cwd: FAMILY_ROOT, },)) {
    if (file.includes('node_modules',) || file.includes('.test',))
      continue;
    found.push({ file, text: await readFile(join(FAMILY_ROOT, file,), 'utf8',), },);
  }
  return found;
}

/**
 The files that write a `json_schema` response format.

 @param sources - files searched

 @returns Paths, in the order of the sources

 @example
 ```ts
 const declaring = declaringFilesOf({ sources: await familySources(), },);
 ```
 */
export function declaringFilesOf({ sources, }: { readonly sources: readonly SourceFile[]; },): readonly string[] {
  return sources
    .filter(function writesFormat({ text, },): boolean {
      return text.includes('type: \'json_schema\'',);
    },)
    .map(function pathOf({ file, },): string {
      return file;
    },);
}

//endregion Sources that declare an answer schema
