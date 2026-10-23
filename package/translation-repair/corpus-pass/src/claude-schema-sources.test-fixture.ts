import {
  glob,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

//region Sources that declare an answer schema
// What `claude-schemas.unit.test.ts` reads to keep the list of schema producers honest: the family's own source files,
// the files among them that write a `json_schema` response format, and the files that call a function which writes one.
//
// A BUILDER IS A FUNCTION THAT WRITES THE FORMAT IN ITS BODY, so each call can make a different schema. A format held
// in a constant is one schema however many files read it, and the producer list holds it once. That is why
// `blockPairingProtocol` (`slice-reading/src/block-pairing-protocol.ts`) is left out of the builders: it returns a
// clone of the constant `PAIRING_RESPONSE_FORMAT`, so every caller sends the same schema, the format text is not in its
// body, and its one caller (`pair-blocks-stage.ts`) is covered by the producer list's entry for the constant.

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
 Directory holding the family's packages.
 */
const FAMILY_ROOT = join(
  import.meta.dirname,
  '..',
  '..',
);

/**
 The list of schema producers, which calls the builders with sample labels to read the schemas they make and so is no
 stage that builds one.
 */
const PRODUCER_LIST_FILE = 'corpus-pass/src/claude-schema-producers.ts';

/**
 The characters a name can hold, so a name found inside a longer name is no call.
 */
const IDENTIFIER_CHARACTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_$';

/**
 What `indexOf` answers when the line it looks for is not there.
 */
const NOT_FOUND = -1;

/**
 What opens a top-level function declaration in the family's source, whatever else the line says.
 */
const FUNCTION_OPENINGS: readonly string[] = [
  'function ',
  'export function ',
  'async function ',
  'export async function ',
];

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
   Every file under a package's `src`, tests and fixtures not yet left out.
   */
  const files = await Array.fromAsync(glob(
    '*/src/**/*.ts',
    { cwd: FAMILY_ROOT, },
  ),);
  return await Promise.all(
    files
      .filter(function isSource(file,): boolean {
        return !(file.includes('node_modules',) || file.includes('.test',));
      },)
      .map(async function sourceOf(file,): Promise<SourceFile> {
        return {
          file,
          text: await readFile(
            join(
              FAMILY_ROOT,
              file,
            ),
            'utf8',
          ),
        };
      },),
  );
}

/**
 The positions of the lines that satisfy a test.

 @param lines - lines searched

 @param test - what a line must satisfy

 @returns Positions, in order

 @example
 ```ts
 const positions = positionsWhere({ lines: ['a', 'b', 'a',], test: (line,) => line === 'a', },);
 // => [0, 2]
 ```
 */
function positionsWhere(
  {
    lines,
    test,
  }: {
    readonly lines: readonly string[];
    readonly test: (line: string,) => boolean;
  },
): readonly number[] {
  return lines.flatMap(function positionOf(
    line,
    index,
  ): readonly number[] {
    return test(line,) ? [index,] : [];
  },);
}

/**
 Whether a line opens a block comment: its first characters are the opening mark.

 @param line - one line of a file

 @returns Whether a block comment starts the line

 @example
 ```ts
 const opens = opensBlock('  /* Builds the question.');
 // => true
 ```
 */
function opensBlock(line: string,): boolean {
  /**
   The line without its indentation.
   */
  const trimmed = line.trimStart();
  return trimmed.startsWith('/*',);
}

/**
 Whether a line holds the closing mark of a block comment, wherever it stands in the line.

 @param line - one line of a file

 @returns Whether the closing mark is in the line

 @example
 ```ts
 const closes = closesBlock(' end of the block *\/');
 // => true
 ```
 */
function closesBlock(line: string,): boolean {
  return line.includes('*/',);
}

/**
 A file's code with the comments that sit on their own lines taken out, so a call shown in documentation is no call.

 A block comment covers the lines from the one that opens it, as its first characters, through the first line at or
 after that one holding the closing mark, or to the end of the file when none does.

 @param text - file's text

 @returns Lines outside block comments and line comments that start a line

 @example
 ```ts
 const lines = codeLinesOf({ text: '// contestResponseFormat(\nexport const A = 1;\n', },);
 // => ['export const A = 1;', '']
 ```
 */
function codeLinesOf({ text, }: { readonly text: string; },): readonly string[] {
  /**
   The text's lines.
   */
  const lines = text.split('\n',);
  /**
   Lines whose first characters open a block comment.
   */
  const openers = positionsWhere({
    lines,
    test: opensBlock,
  },);
  /**
   Lines that hold the closing mark of a block comment.
   */
  const closers = positionsWhere({
    lines,
    test: closesBlock,
  },);
  /**
   Lines inside some block comment, the opening and the closing line included.
   */
  const covered = new Set(openers.flatMap(function coveredFrom(opener,): readonly number[] {
    /**
     Where the comment ends: the first closing line at or after its opener, the last line when none follows.
     */
    const end = closers.find(function closesAfter(closer,): boolean {
      return closer >= opener;
    },) ?? (lines.length - 1);
    return Array.from(
      { length: (end - opener) + 1, },
      function lineOf(
        _,
        offset,
      ): number {
        return opener + offset;
      },
    );
  },),);
  return lines.filter(function isCode(
    line,
    index,
  ): boolean {
    /**
     The line without its indentation.
     */
    const trimmed = line.trimStart();
    return (!covered.has(index,)) && (!trimmed.startsWith('//',));
  },);
}

/**
 The name of the function a line opens, empty when the line opens none.

 @param line - one line of code

 @returns Name, without type parameters or parameters

 @example
 ```ts
 const name = functionNameOpenedBy({ line: 'export function contestResponseFormat(', },);
 // => 'contestResponseFormat'
 ```
 */
function functionNameOpenedBy({ line, }: { readonly line: string; },): string {
  /**
   The opening the line starts with, absent when it starts with none.
   */
  const opening = FUNCTION_OPENINGS.find(function startsLine(candidate,): boolean {
    return line.startsWith(candidate,);
  },);
  if (opening === undefined)
    return '';
  /**
   What follows the opening, up to the end of the line.
   */
  const afterOpening = line.slice(opening.length,);
  /**
   The name and what follows it up to the first parameter list.
   */
  const [beforeParameters = '',] = afterOpening.split('(',);
  /**
   The name alone, cut before type parameters.
   */
  const [name = '',] = beforeParameters.split('<',);
  return name;
}

/**
 Whether code calls a function: its name, not part of a longer name, then an opening parenthesis.

 @param code - lines of code

 @param name - function's name

 @returns Whether some occurrence of the name is a call

 @example
 ```ts
 const calls = callsFunction({ code: ['const a = build({});',], name: 'build', },);
 // => true
 ```
 */
function callsFunction(
  {
    code,
    name,
  }: {
    readonly code: readonly string[];
    readonly name: string;
  },
): boolean {
  return code.some(function lineCalls(line,): boolean {
    /**
     The line cut at every occurrence of the name.
     */
    const pieces = line.split(name,);
    /**
     The pieces that have an occurrence of the name after them.
     */
    const beforeOccurrences = pieces.slice(
      0,
      -1,
    );
    return beforeOccurrences.some(function occurrenceIsCall(
      before,
      index,
    ): boolean {
      /**
       The character before the occurrence, empty at the start of the line.
       */
      const previous = before.at(-1,) ?? '';
      /**
       What follows the occurrence, without its indentation.
       */
      const after = (pieces[index + 1] ?? '').trimStart();
      /**
       Whether the name stands alone and is followed by an opening parenthesis.
       */
      const standsAlone = (previous === '') || (!IDENTIFIER_CHARACTERS.includes(previous,));
      return standsAlone && after.startsWith('(',);
    },);
  },);
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
  return sources.flatMap(function buildersInFile(source,): readonly SchemaBuilder[] {
    if (notStageSchemas.has(source.file,))
      return [];
    /**
     The file's code.
     */
    const code = codeLinesOf({ text: source.text, },);
    return code.flatMap(function builderOpenedAt(
      line,
      index,
    ): readonly SchemaBuilder[] {
      /**
       The function the line opens, empty when it opens none.
       */
      const name = functionNameOpenedBy({ line, },);
      if (name === '')
        return [];
      /**
       Where the declaration ends: the next line that is a closing brace and nothing else.
       */
      const end = code.indexOf(
        '}',
        index,
      );
      /**
       Where the slice of the declaration stops: after the closing brace, or at the end of the file when none follows.
       */
      const stop = (end === NOT_FOUND) ? code.length : (end + 1);
      /**
       The declaration's lines.
       */
      const body = code.slice(
        index,
        stop,
      );
      return body.some(function writesFormat(bodyLine,): boolean {
        return bodyLine.includes('type: \'json_schema\'',);
      },)
        ? [
          {
            name,
            file: source.file,
          },
        ]
        : [];
    },);
  },);
}

/**
 The files that call a builder, the one that declares it and the producer list left out.

 @param sources - files searched

 @param builder - builder whose calls are looked for

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
  return sources
    .filter(function callsBuilder(source,): boolean {
      return (source.file !== builder.file)
        && (source.file !== PRODUCER_LIST_FILE)
        && callsFunction({
          code: codeLinesOf({ text: source.text, },),
          name: builder.name,
        },);
    },)
    .map(function pathOf(source,): string {
      return source.file;
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
   Builders found in the sources.
   */
  const builders = buildersOf({
    sources,
    notStageSchemas,
  },);
  /**
   Files that call some builder.
   */
  const calling = new Set(
    builders.flatMap(function callersOfBuilder(builder,): readonly string[] {
      return callersOf({
        sources,
        builder,
      },);
    },),
  );
  return sources
    .filter(function writesOrCalls(source,): boolean {
      /**
       The file's path and text.
       */
      const {
        file,
        text,
      } = source;
      /**
       Whether the file writes the format itself.
       */
      const writes = text.includes('type: \'json_schema\'',);
      return writes || calling.has(file,);
    },)
    .map(function pathOf(source,): string {
      return source.file;
    },);
}

//endregion Sources that declare an answer schema
