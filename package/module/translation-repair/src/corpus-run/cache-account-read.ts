import {
  isAsciiAlphanumeric,
  isAsciiDigits,
} from '../ascii-letters.ts';

//region Cache account read
// WHAT THE PRE-LAUNCH CACHE CHECK READS (ledger M28). Every stage cache is
// stamped with the build's digest; the version constants are defence in
// depth, and each constant's TSDoc accounts for the commits that changed its
// stage's answers since the constant last moved. M28 found the check walking
// three of six constants, the ones remembered, so this reads every declaration
// ending in `CACHE_VERSION` out of the source instead of a list.
//
// PURE READING, SPLIT FROM THE ENTRY (`cache-account-audit.ts`), which asks
// git and prints. Nothing here runs a process or reads a file.
//
// THE COMMIT THAT SET A VALUE is the newest one that ADDED its declaration on
// balance. The scratch script this replaces took the oldest commit git's
// pickaxe named, which is wrong once a value is set, changed and set back,
// and a move between files adds and removes the line in one commit, which
// sets nothing.

/**
 Opening of a declaration line this reads.
 */
const EXPORTED_DECLARATION = 'export const ';

/**
 Opening of an unexported one.
 */
const LOCAL_DECLARATION = 'const ';

/**
 Ending every cache version constant's name carries.
 */
const VERSION_NAME_ENDING = 'CACHE_VERSION';

/**
 Assignment between a constant's name and its value, as the formatter writes it.
 */
const ASSIGNMENT = ' = ';

/**
 Statement end after the value.
 */
const STATEMENT_END = ';';

/**
 Characters of a commit hash the version accounts cite.
 */
export const CITED_HASH_LENGTH = 9;

/**
 A hash as the version accounts cite it.

 @param hash - full object id

 @returns Its first nine characters

 @example
 ```ts
 citedHash({ hash: 'f6e93ed5f0000000000000000000000000000000', },); // 'f6e93ed5f'
 ```
 */
export function citedHash({ hash, }: { readonly hash: string; },): string {
  return hash.slice(
    0,
    CITED_HASH_LENGTH,
  );
}

/**
 One cache version constant as its source declares it.

 @example
 ```ts
 const version: CacheVersion = { name: 'PAIRING_CACHE_VERSION', value: 3, path: 'src/pairing-cache-version.ts', declaration: 'PAIRING_CACHE_VERSION = 3', };
 ```
 */
export type CacheVersion = {
  /**
   Constant's name.
   */
  readonly name: string;

  /**
   Its current value.
   */
  readonly value: number;

  /**
   File declaring it, as the caller named it.
   */
  readonly path: string;

  /**
   Name and value as the source writes them, the text git's pickaxe looks for.
   */
  readonly declaration: string;
};

/**
 A declaration line naming a cache version that does not read as
 `NAME = digits;`, which the check would otherwise skip without a word.

 @example
 ```ts
 throw new CacheAccountReadError({ path: 'src/a.ts', line: 'export const A_CACHE_VERSION: number = 1;', },);
 ```
 */
export class CacheAccountReadError extends Error {
  /**
   Declares this message safe to forward: it quotes one line of this
   package's own source, never corpus text.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the refusal naming the file and the line.

   @param path - file holding the line

   @param line - declaration as written

   @example
   ```ts
   new CacheAccountReadError({ path: 'src/a.ts', line: 'export const A_CACHE_VERSION: number = 1;', },);
   ```
   */
  constructor({
    path,
    line,
  }: {
    readonly path: string;
    readonly line: string;
  },) {
    super(`${path} declares a cache version the audit cannot read: "${line}". Write it as NAME = digits; so every constant is checked.`,);
    this.name = 'CacheAccountReadError';
  }
}

/**
 Openings of the declaration lines this reads, exported first.
 */
const DECLARATION_KEYWORDS = [
  EXPORTED_DECLARATION,
  LOCAL_DECLARATION,
] as const;

/**
 Length of the identifier a declaration opens with.

 @param rest - declaration after its keywords

 @returns Units up to the first character no identifier here carries

 @example
 ```ts
 identifierLength({ rest: 'A_CACHE_VERSION = 1;', },); // 15
 ```
 */
function identifierLength({ rest, }: { readonly rest: string; },): number {
  /**
   Offset of the first character outside the identifier, or the whole length.
   */
  const end = Array.from(rest,)
    .findIndex(function outside(character,): boolean {
      return !((character === '_') || isAsciiAlphanumeric({ character, },));
    },);
  return (end === (-1)) ? rest.length : end;
}

/**
 What one line says about cache versions: nothing, a version, or a
 declaration naming one that does not read as `NAME = digits;`.

 @example
 ```ts
 const reading: DeclarationReading = { kind: 'version', name: 'A_CACHE_VERSION', digits: '1', };
 ```
 */
type DeclarationReading =
  | { readonly kind: 'none'; }
  | {
    readonly kind: 'version';

    /**
     Constant's name.
     */
    readonly name: string;

    /**
     Its value as written.
     */
    readonly digits: string;
  }
  | { readonly kind: 'unreadable'; };

/**
 Reads one source line as a cache version declaration, the one reading both
 the current source and the lines of a diff go through.

 A NAME IS READ WHOLE, never found inside a longer one: `SLICE_CACHE_VERSION`
 sits inside `TRANSLATE_SLICE_CACHE_VERSION`, and `= 3` at the start of
 `= 34`, so a substring would mistake one version for another (ledger B23).

 @param line - one line, trimmed

 @returns What the line declares

 @example
 ```ts
 readDeclaration({ line: 'export const PAIRING_CACHE_VERSION = 3;', },); // { kind: 'version', name: 'PAIRING_CACHE_VERSION', digits: '3' }
 ```
 */
function readDeclaration({ line, }: { readonly line: string; },): DeclarationReading {
  /**
   Keywords the line opens with, when it declares a constant.
   */
  const keyword = DECLARATION_KEYWORDS.find(function opens(candidate,): boolean {
    return line.startsWith(candidate,);
  },);
  if (keyword === undefined)
    return { kind: 'none', };
  /**
   Declaration after its keywords.
   */
  const rest = line.slice(keyword.length,);
  /**
   Constant's name.
   */
  const name = rest.slice(
    0,
    identifierLength({ rest, },),
  );
  if (!name.endsWith(VERSION_NAME_ENDING,))
    return { kind: 'none', };
  /**
   What follows the name, which has to be the assignment of a number.
   */
  const assigned = rest.slice(name.length,);
  /**
   Digits between the assignment and the statement end.
   */
  const digits = assigned.slice(
    ASSIGNMENT.length,
    -STATEMENT_END.length,
  );
  /**
   Whether the name is assigned a whole number and the statement ends there.
   */
  const readable = assigned.startsWith(ASSIGNMENT,)
    && assigned.endsWith(STATEMENT_END,)
    && isAsciiDigits({ text: digits, },);
  if (!readable)
    return { kind: 'unreadable', };
  return {
    kind: 'version',
    name,
    digits,
  };
}

/**
 Every cache version constant one source file declares.

 @param path - file's name, carried into each result

 @param text - file's contents

 @returns Constants in line order

 @throws CacheAccountReadError where a declaration naming a cache version
 does not read as `NAME = digits;`

 @example
 ```ts
 cacheVersionsIn({ path: 'src/pairing-cache-version.ts', text: 'export const PAIRING_CACHE_VERSION = 3;', },);
 ```
 */
export function cacheVersionsIn(
  {
    path,
    text,
  }: {
    readonly path: string;
    readonly text: string;
  },
): readonly CacheVersion[] {
  return text
    .split('\n',)
    .flatMap(function versionOf(raw,): readonly CacheVersion[] {
      /**
       Line without its indentation.
       */
      const line = raw.trim();
      /**
       What the line declares.
       */
      const reading = readDeclaration({ line, },);
      if (reading.kind === 'none')
        return [];
      if (reading.kind === 'unreadable')
        throw new CacheAccountReadError({
          path,
          line,
        },);
      return [{
        name: reading.name,
        value: Number(reading.digits,),
        path,
        declaration: `${reading.name}${ASSIGNMENT}${reading.digits}`,
      },];
    },);
}

/**
 Lines a unified diff adds and removes that declare one version at its
 current value, read as {@link cacheVersionsIn} reads the source.

 A HISTORICAL LINE THAT DOES NOT READ is no declaration of this value and is
 left uncounted, not refused: the source may once have written one another
 way, and only the current source has to read.

 @param diff - `git show` output for one commit

 @param version - constant and value looked for

 @returns Counts of added and removed declarations of that value

 @example
 ```ts
 declarationLineCounts({ diff: '+export const A_CACHE_VERSION = 2;', version, },); // { added: 1, removed: 0 }
 ```
 */
export function declarationLineCounts(
  {
    diff,
    version,
  }: {
    readonly diff: string;
    readonly version: Pick<CacheVersion, 'name' | 'value'>;
  },
): {
  readonly added: number;
  readonly removed: number;
} {
  /**
   Changed lines declaring this constant at this value, file headers aside.
   */
  const declaring = diff
    .split('\n',)
    .filter(function declaresVersion(line,): boolean {
      if (line.startsWith('+++',) || line.startsWith('---',))
        return false;
      /**
       Whether the diff adds or removes this line.
       */
      const changed = line.startsWith('+',) || line.startsWith('-',);
      if (!changed)
        return false;
      /**
       The changed line, its diff mark removed.
       */
      const written = line
        .slice(1,)
        .trim();
      /**
       What it declares.
       */
      const reading = readDeclaration({ line: written, },);
      return (reading.kind === 'version')
        && (reading.name === version.name)
        && (Number(reading.digits,) === version.value);
    },);
  /**
   Those the diff adds.
   */
  const added = declaring.filter(function isAdded(line,): boolean {
    return line.startsWith('+',);
  },);
  return {
    added: added.length,
    removed: declaring.length - added.length,
  };
}

//endregion Cache account read
