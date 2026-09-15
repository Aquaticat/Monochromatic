// Generated from `package/git-policy/repository/src/manifest-text.ts` by file-enforcer; edit canonical source owner.
/**
 Reads dependency facts from `package.json` text and rewrites its top-level `version` in place.

 @module
 */

//region Manifest facts

/**
 Manifest fields installers resolve, so every workspace package named there is a dependent edge.
 */
const RUNTIME_DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 Dependency facts read from one manifest.

 @example
 ```ts
 const facts: ManifestDependencyFacts = { name: '@scope/a', runtimeDependencyNames: ['@scope/b'], devDependencyNames: [] };
 ```
 */
export type ManifestDependencyFacts = Readonly<{
  /**
   Package name.
   */
  name: string;
  /**
   Version, absent when the manifest declares none.
   */
  version?: string;
  /**
   Names under `dependencies`, `peerDependencies`, and `optionalDependencies`.
   */
  runtimeDependencyNames: readonly string[];
  /**
   Names under `devDependencies`.
   */
  devDependencyNames: readonly string[];
}>;

/**
 Thrown when manifest text cannot supply the facts a dependent bump needs.

 @example
 ```ts
 throw new ManifestShapeError('package/module/a/package.json has no string "name"');
 ```
 */
export class ManifestShapeError extends Error {
  /**
   Creates an error with the manifest problem.

   @param message - Problem naming the manifest path.
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'ManifestShapeError';
  }
}

/**
 Reports whether a parsed JSON value is a plain object.

 @param value - Parsed JSON value.

 @returns Whether properties can be read by key.

 @example
 ```ts
 isJsonObject({});
 // => true
 ```
 */
function isJsonObject(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (typeof value === 'object') && (value !== null) && (!Array.isArray(value,));
}

/**
 Lists the keys of one dependency map, or nothing when the field is absent.

 @param manifest - Parsed manifest object.

 @param field - Dependency field name.

 @returns Dependency names in manifest order.

 @example
 ```ts
 dependencyNames({ manifest: { dependencies: { a: '1' } }, field: 'dependencies' });
 // => ['a']
 ```
 */
function dependencyNames({
  manifest,
  field,
}: Readonly<{
  manifest: Readonly<Record<string, unknown>>;
  field: string;
}>,): readonly string[] {
  /**
   Raw field value.
   */
  const dependencies = manifest[field];
  return isJsonObject(dependencies,)
    ? Object.keys(dependencies,)
    : [];
}

/**
 Parses the dependency facts of one manifest.

 @param path - Repository-relative manifest path, named in errors.

 @param text - Manifest text.

 @returns Name, optional version, and dependency names.

 @throws ManifestShapeError when the text is not a JSON object with a string `name`, or `version` is not a string.

 @example
 ```ts
 readManifestDependencyFacts({ path: 'package/module/a/package.json', text: '{"name":"@scope/a"}' });
 ```
 */
export function readManifestDependencyFacts({
  path,
  text,
}: Readonly<{
  path: string;
  text: string;
}>,): ManifestDependencyFacts {
  /**
   Parsed manifest.
   */
  const manifest: unknown = JSON.parse(text,);
  if (!isJsonObject(manifest,))
    throw new ManifestShapeError(`${path} is not a JSON object`,);
  if (typeof manifest.name !== 'string')
    throw new ManifestShapeError(`${path} has no string "name"`,);
  if ((manifest.version !== undefined) && (typeof manifest.version !== 'string'))
    throw new ManifestShapeError(`${path} has a non-string "version"`,);
  return {
    name: manifest.name,
    ...(typeof manifest.version === 'string' ? { version: manifest.version, } : {}),
    runtimeDependencyNames: RUNTIME_DEPENDENCY_FIELDS.flatMap(function namesIn(field,) {
      return dependencyNames({
        manifest,
        field,
      },);
    },),
    devDependencyNames: dependencyNames({
      manifest,
      field: 'devDependencies',
    },),
  };
}

//endregion Manifest facts

//region Version rewrite

/**
 Finds the end of a JSON string literal that starts at a quote.

 @param text - JSON text.

 @param start - Index of the opening quote.

 @returns Index of the closing quote.

 @throws ManifestShapeError when the literal never closes.

 @example
 ```ts
 stringLiteralEnd({ text: '"a"', start: 0 });
 // => 2
 ```
 */
function stringLiteralEnd({
  text,
  start,
}: Readonly<{
  text: string;
  start: number;
}>,): number {
  for (let index = start + 1; index < text.length; index += 1) {
    /**
     Character at this position.
     */
    const character = text.charAt(index,);
    if (character === '\\')
      index += 1;
    else if (character === '"')
      return index;
  }
  throw new ManifestShapeError('manifest ends inside a string literal',);
}

/**
 Skips JSON whitespace.

 @param text - JSON text.

 @param start - Index to start from.

 @returns Index of the next non-whitespace character, or the text length.

 @example
 ```ts
 skipWhitespace({ text: '  x', start: 0 });
 // => 2
 ```
 */
function skipWhitespace({
  text,
  start,
}: Readonly<{
  text: string;
  start: number;
}>,): number {
  /**
   Cursor over whitespace.
   */
  const cursor = { index: start, };
  while ((cursor.index < text.length) && ' \t\r\n'.includes(text.charAt(cursor.index,),))
    cursor.index += 1;
  return cursor.index;
}

/**
 Replaces the top-level `version` value in manifest text, leaving every other byte unchanged.

 @param path - Repository-relative manifest path, named in errors.

 @param text - Manifest text.

 @param from - Version the manifest must currently declare.

 @param to - Replacement version.

 @returns Manifest text with only the version value changed.

 @throws ManifestShapeError when no top-level `version` holds exactly `from`.

 @example
 ```ts
 replaceManifestVersion({ path: 'package.json', text: '{"version": "1.0.0"}', from: '1.0.0', to: '1.0.1' });
 // => '{"version": "1.0.1"}'
 ```
 */
export function replaceManifestVersion({
  path,
  text,
  from,
  to,
}: Readonly<{
  path: string;
  text: string;
  from: string;
  to: string;
}>,): string {
  /**
   Scanner state: object and array nesting depth.
   */
  const state = { depth: 0, };
  for (let index = 0; index < text.length; index += 1) {
    /**
     Character at this position.
     */
    const character = text.charAt(index,);
    if ((character === '{') || (character === '['))
      state.depth += 1;
    else if ((character === '}') || (character === ']'))
      state.depth -= 1;
    else if (character === '"') {
      /**
       Closing quote of this string literal.
       */
      const end = stringLiteralEnd({
        text,
        start: index,
      },);
      /**
       Position after optional whitespace, where a key's colon would be.
       */
      const afterLiteral = skipWhitespace({
        text,
        start: end + 1,
      },);
      if ((state.depth === 1) && (text.slice(index, end + 1,) === '"version"') && (text.charAt(afterLiteral,) === ':')) {
        /**
         Opening quote of the value.
         */
        const valueStart = skipWhitespace({
          text,
          start: afterLiteral + 1,
        },);
        if (text.charAt(valueStart,) !== '"')
          throw new ManifestShapeError(`${path} has a non-string top-level "version"`,);
        /**
         Closing quote of the value.
         */
        const valueEnd = stringLiteralEnd({
          text,
          start: valueStart,
        },);
        if (text.slice(valueStart, valueEnd + 1,) !== JSON.stringify(from,))
          throw new ManifestShapeError(`${path} declares version ${text.slice(valueStart, valueEnd + 1,)}, expected ${JSON.stringify(from,)}`,);
        return `${text.slice(0, valueStart,)}${JSON.stringify(to,)}${text.slice(valueEnd + 1,)}`;
      }
      index = end;
    }
  }
  throw new ManifestShapeError(`${path} has no top-level "version"`,);
}

//endregion Version rewrite
