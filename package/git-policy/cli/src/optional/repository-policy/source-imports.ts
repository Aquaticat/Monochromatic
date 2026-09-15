// Generated from `package/git-policy/repository/src/source-imports.ts` by file-enforcer; edit canonical source owner.
/**
 Decides whether a development dependency is bundled, from the module specifiers in non-test source.

 @module
 */

//region Source paths

/**
 Extensions of source files a bundler follows imports from.
 */
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
] as const;

/**
 Reports whether a repository path is non-test source of a package.

 @param directory - Repository-relative package directory without trailing slash.

 @param path - Repository-relative file path.

 @returns Whether the file is under the package's `src/`, has a source extension, and its name has no `.test.` segment.

 @example
 ```ts
 isNonTestSourcePath({ directory: 'package/module/a', path: 'package/module/a/src/index.ts' });
 // => true
 ```
 */
export function isNonTestSourcePath({
  directory,
  path,
}: Readonly<{
  directory: string;
  path: string;
}>,): boolean {
  if (!path.startsWith(`${directory}/src/`,))
    return false;
  /**
   Final path segment.
   */
  const fileName = path.slice(path.lastIndexOf('/',) + 1,);
  return SOURCE_EXTENSIONS.some(function hasExtension(extension,): boolean {
    return fileName.endsWith(extension,);
  },)
    && (!fileName.includes('.test.',));
}

//endregion Source paths

//region Module specifiers

/**
 Keywords that introduce a module specifier directly before its string literal.
 */
const SPECIFIER_KEYWORDS = [
  'from',
  'import',
] as const;

/**
 Callees whose first argument is a module specifier.
 */
const SPECIFIER_CALLEES = [
  'import',
  'require',
] as const;

/**
 Reports whether a character can continue a JavaScript identifier, for keyword boundary checks.

 @param character - One UTF-16 unit, or empty text at the start of input.

 @returns Whether the character is an ASCII letter, digit, `_`, or `$`.

 @example
 ```ts
 isIdentifierCharacter('a');
 // => true
 ```
 */
function isIdentifierCharacter(character: string,): boolean {
  return ((character >= 'a') && (character <= 'z'))
    || ((character >= 'A') && (character <= 'Z'))
    || ((character >= '0') && (character <= '9'))
    || (character === '_')
    || (character === '$');
}

/**
 Moves backwards over whitespace.

 @param text - Source text.

 @param end - Exclusive index to start before.

 @returns Exclusive end index of the preceding non-whitespace text.

 @example
 ```ts
 skipWhitespaceBackwards({ text: 'from  ', end: 6 });
 // => 4
 ```
 */
function skipWhitespaceBackwards({
  text,
  end,
}: Readonly<{
  text: string;
  end: number;
}>,): number {
  /**
   Cursor over whitespace.
   */
  const cursor = { index: end, };
  while ((cursor.index > 0) && ' \t\r\n'.includes(text.charAt(cursor.index - 1,),))
    cursor.index -= 1;
  return cursor.index;
}

/**
 Reports whether a whole keyword ends exactly at an index.

 @param text - Source text.

 @param end - Exclusive end index.

 @param keywords - Candidate keywords.

 @returns Whether one keyword ends there with an identifier boundary before it.

 @example
 ```ts
 endsWithKeyword({ text: 'import', end: 6, keywords: ['import'] });
 // => true
 ```
 */
function endsWithKeyword({
  text,
  end,
  keywords,
}: Readonly<{
  text: string;
  end: number;
  keywords: readonly string[];
}>,): boolean {
  return keywords.some(function matchesKeyword(keyword,): boolean {
    /**
     Index where the keyword would start.
     */
    const start = end - keyword.length;
    return (start >= 0)
      && (text.slice(
        start,
        end,
      ) === keyword)
      && (!isIdentifierCharacter(start > 0 ? text.charAt(start - 1,) : '',));
  },);
}

/**
 Reports whether a string literal starting at an index sits in module-specifier position.

 @param text - Source text.

 @param quoteIndex - Index of the literal's opening quote.

 @returns Whether `from`, `import`, `import(`, or `require(` directly precedes the literal.

 @example
 ```ts
 isSpecifierPosition({ text: "from 'a'", quoteIndex: 5 });
 // => true
 ```
 */
function isSpecifierPosition({
  text,
  quoteIndex,
}: Readonly<{
  text: string;
  quoteIndex: number;
}>,): boolean {
  /**
   End of the token before the literal.
   */
  const tokenEnd = skipWhitespaceBackwards({
    text,
    end: quoteIndex,
  },);
  if (endsWithKeyword({
    text,
    end: tokenEnd,
    keywords: SPECIFIER_KEYWORDS,
  },))
    return true;
  return (text.charAt(tokenEnd - 1,) === '(')
    && endsWithKeyword({
      text,
      end: skipWhitespaceBackwards({
        text,
        end: tokenEnd - 1,
      },),
      keywords: SPECIFIER_CALLEES,
    },);
}

/**
 Reports whether source text imports a package or one of its subpaths.

 @param sourceText - JavaScript or TypeScript source.

 @param packageName - Package name to look for.

 @returns Whether a quoted specifier equal to the name, or starting with the name and `/`, follows `from`, `import`, `import(`, or `require(`.

 @example
 ```ts
 importsPackage({ sourceText: "import { x } from '@scope/b/ts';", packageName: '@scope/b' });
 // => true
 ```
 */
export function importsPackage({
  sourceText,
  packageName,
}: Readonly<{
  sourceText: string;
  packageName: string;
}>,): boolean {
  /**
   Scan cursor over occurrences of the package name.
   */
  const cursor = { index: sourceText.indexOf(packageName,), };
  while (cursor.index !== (-1)) {
    /**
     Character before the occurrence, which must open a string literal.
     */
    const quote = cursor.index > 0 ? sourceText.charAt(cursor.index - 1,) : '';
    /**
     Character after the occurrence, which must close the literal or start a subpath.
     */
    const following = sourceText.charAt(cursor.index + packageName.length,);
    if (((quote === "'") || (quote === '"')
      || (quote === '`'))
      && ((following === quote) || (following === '/'))
      && isSpecifierPosition({
        text: sourceText,
        quoteIndex: cursor.index - 1,
      },))
      return true;
    cursor.index = sourceText.indexOf(
      packageName,
      cursor.index + packageName.length,
    );
  }
  return false;
}

//endregion Module specifiers
