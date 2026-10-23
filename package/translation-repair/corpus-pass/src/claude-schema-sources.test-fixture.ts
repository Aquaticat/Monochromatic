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
 The list of schema producers, which calls the builders with sample labels to read the schemas they make and so is no
 stage that builds one.
 */
const PRODUCER_LIST_FILE = 'corpus-pass/src/claude-schema-producers.ts';

/**
 A function that builds an answer schema when called, with the file that declares it.
 */
export type SchemaBuilder = {
  /**
   The function's name.
   */
  readonly name: string;

  /**
   Path of the file that declares it.
   */
  readonly file: string;
};

/**
 A file's code with the comments that sit on their own lines taken out, so a call shown in documentation is no call.

 @param text - the file's text

 @returns Text without block comments or line comments that start a line

 @example
 ```ts
 const code = codeOf({ text: '// contestResponseFormat(\nexport const A = 1;\n', },);
 ```
 */
function codeOf({ text, }: { readonly text: string; },): string {
  return text
    .replaceAll(/^[ \t]*\/\*[\s\S]*?\*\//gmu, '',)
    .replaceAll(/^[ \t]*\/\/.*$/gmu, '',);
}

/**
 The functions that write a `json_schema` response format inside their body, so each call can make a different schema.

 A format in a constant is one schema however many files read it, so a constant is no builder.

 @param sources - files searched
 @param notStageSchemas - paths of files that write the format without building a stage's answer schema

 @returns One entry per function, in the order of the sources

 @example
 ```ts
 const builders = buildersOf({ sources: await familySources(), notStageSchemas: new Set(), },);
 ```
 */
export function buildersOf(
  {
    sources,
    notStageSchemas,
  }: {
    readonly sources: readonly SourceFile[];
    readonly notStageSchemas: ReadonlySet<string>;
  },
): readonly SchemaBuilder[] {
  return sources.flatMap(function buildersInFile({ file, text, },): readonly SchemaBuilder[] {
    if (notStageSchemas.has(file,))
      return [];
    /**
     Functions found in this file, by name.
     */
    const found = new Map<string, SchemaBuilder>();
    /**
     Name of the top-level function the scan is inside, absent between functions.
     */
    let current: string | undefined;
    for (const line of codeOf({ text, },).split('\n',)) {
      const start = /^(?:export )?(?:async )?function (\w+)/u.exec(line,);
      if (start?.[1] !== undefined)
        current = start[1];
      else if (line === '}')
        current = undefined;
      if (current !== undefined && line.includes('type: \'json_schema\'',))
        found.set(current, { name: current, file, },);
    }
    return [...found.values(),];
  },);
}

/**
 The files that call a builder, the one that declares it and the producer list left out.

 @param sources - files searched
 @param builder - the builder whose calls are looked for

 @returns Paths, in the order of the sources

 @example
 ```ts
 const callers = callersOf({ sources, builder: { name: 'contestResponseFormat', file: 'a.ts', }, },);
 ```
 */
export function callersOf(
  {
    sources,
    builder,
  }: {
    readonly sources: readonly SourceFile[];
    readonly builder: SchemaBuilder;
  },
): readonly string[] {
  /**
   A call of the builder: its name, then an opening parenthesis.
   */
  const call = new RegExp(`\\b${builder.name}\\s*\\(`, 'u',);
  return sources
    .filter(function callsBuilder({ file, text, },): boolean {
      return (file !== builder.file) && (file !== PRODUCER_LIST_FILE) && call.test(codeOf({ text, },),);
    },)
    .map(function pathOf({ file, },): string {
      return file;
    },);
}

/**
 The files that write a `json_schema` response format, or call a builder of one.

 @param sources - files searched
 @param notStageSchemas - paths of files that write the format without building a stage's answer schema

 @returns Paths, in the order of the sources

 @example
 ```ts
 const declaring = declaringFilesOf({ sources: await familySources(), notStageSchemas: new Set(), },);
 ```
 */
export function declaringFilesOf(
  {
    sources,
    notStageSchemas,
  }: {
    readonly sources: readonly SourceFile[];
    readonly notStageSchemas: ReadonlySet<string>;
  },
): readonly string[] {
  /**
   Files that call some builder.
   */
  const calling = new Set(
    buildersOf({ sources, notStageSchemas, },).flatMap(function callersOfBuilder(builder,): readonly string[] {
      return callersOf({ sources, builder, },);
    },),
  );
  return sources
    .filter(function writesOrCalls({ file, text, },): boolean {
      return text.includes('type: \'json_schema\'',) || calling.has(file,);
    },)
    .map(function pathOf({ file, },): string {
      return file;
    },);
}

//endregion Sources that declare an answer schema
