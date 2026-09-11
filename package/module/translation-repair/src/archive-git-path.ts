//region Git path identity
// Compare the requested literal path with Git's C-quoted metadata spelling.

/**
 * C escapes emitted by Git for special path characters.
 */
const PATH_ESCAPES: Readonly<Record<string, string>> = {
  '\u0007': String.raw`\a`,
  '\b': String.raw`\b`,
  '\t': String.raw`\t`,
  '\n': String.raw`\n`,
  '\v': String.raw`\v`,
  '\f': String.raw`\f`,
  '\r': String.raw`\r`,
  '"': String.raw`\"`,
  '\\': String.raw`\\`,
};
/**
 * First printable ASCII code point.
 */
const FIRST_PRINTABLE = 32;
/**
 * Delete character, which Git octal-escapes in paths.
 */
const DELETE_CHARACTER = 127;
/**
 * Radix of Git's remaining control-character escapes.
 */
const OCTAL_RADIX = 8;
/**
 * Width of each escaped byte in Git's path representation.
 */
const OCTAL_WIDTH = 3;

/**
 * Encodes one path character under Git's core.quotePath=false convention.
 *
 * @param character - code point from a literal repository path
 *
 * @returns Exact C-style spelling, preserving ordinary Unicode
 *
 * @example
 * ```ts
 * gitPathCharacter('\t'); // '\\t'
 * ```
 */
function gitPathCharacter(character: string,): string {
  /**
   * Dedicated C escape, when Git has one.
   */
  const escaped = PATH_ESCAPES[character];
  if (escaped !== undefined)
    return escaped;
  /**
   * ASCII unit; non-ASCII text is copied under core.quotePath=false.
   */
  const unit = character.codePointAt(0,) ?? FIRST_PRINTABLE;
  if ((unit < FIRST_PRINTABLE) || (unit === DELETE_CHARACTER)) {
    /**
     * Octal byte spelling before width padding.
     */
    const octal = unit.toString(OCTAL_RADIX,);
    return `\\${octal.padStart(
      OCTAL_WIDTH,
      '0',
    )}`;
  }
  return character;
}

/**
 * Recognizes only the canonical spelling of the requested path.
 * Accepting both raw and quoted strings would confuse a literal backslash-n
 * filename with a renamed path containing a newline.
 *
 * @param wirePath - filename metadata emitted by Git
 *
 * @param relPath - requested literal repository-relative path
 *
 * @returns Whether the origin is on that same path
 *
 * @example
 * ```ts
 * sameGitPath({ wirePath: 'people/cat/page.en.md', relPath: 'people/cat/page.en.md' });
 * ```
 */
export function sameGitPath({
  wirePath,
  relPath,
}: {
  readonly wirePath: string;
  readonly relPath: string;
},): boolean {
  /**
   * Escaped path contents without surrounding quotes.
   */
  const escaped = Array.from(
    relPath,
    gitPathCharacter,
  )
    .join('',);
  /**
   * Git adds quotes only when a character required escaping.
   */
  const expected = escaped === relPath ? relPath : `"${escaped}"`;
  return wirePath === expected;
}

//endregion Git path identity
