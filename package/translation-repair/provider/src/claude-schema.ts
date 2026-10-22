import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';

//region Claude schema
// THE SCHEMA ONE CLAUDE CALL SENDS, narrowed to what Anthropic's structured outputs accept. The bundled API skill
// (`shared/tool-use-concepts.md`, "JSON Schema Limitations", lines 541 to 558) says `additionalProperties: false` is
// required on every object, that the numeric bounds (`minimum`, `maximum`, `multipleOf`), the string bounds
// (`minLength`, `maxLength`) and the complex array bounds are not supported, and that the Python and TypeScript SDKs
// strip the bounds from what they send and check them on the reply (line 558). This client is raw HTTP, so no SDK does
// either for it; this file does.
//
// A STRIPPED BOUND IS TOLD TO THE MODEL, as the SDKs do it: step 2 of "How SDK transformation works" on the live
// Structured outputs page (https://platform.claude.com/docs/en/build-with-claude/structured-outputs, fetched
// 2026-10-22; the bundled skill has no such section) adds each unsupported constraint to the field's description, its
// example being `{minimum: 100}`. The form here is the page's: the dropped constraints of one schema node as one
// `{keyword: value, ...}` text, appended after a blank line to a description the node already has.
//
// A KEYWORD THE FEATURE REFUSES THAT NO SDK STRIPS STOPS THE BODY: `oneOf`, `not`, `if`, `then`, `else`, `pattern`,
// `patternProperties`, `propertyNames`, `contains`, `prefixItems` and any other keyword outside `ALLOWED_KEYWORDS`
// would answer HTTP 400 on every call of the stage, which the retry ladder returns unretried and the router counts as a
// lost voice. It fails here, at build time of the body, naming the keyword and where it sits.
//
// WHAT THE STRIPPED BOUNDS LEAVE TO THE READER: every stage reads its reply with its own guard, and a bound removed
// here is still enforced there. The only bound any stage schema declares is `minimum: 1` on a finding's paragraph in
// the absolute naturalness review, which `isAbsoluteNaturalnessReviewWire` rejects below 1; `claude-schemas.unit.test.ts`
// in `corpus-pass` lists what is stripped from every stage schema, so a bound added later shows there.

/**
 Refusal raised when a schema carries a keyword the structured-output feature does not support and no SDK strips.

 A THROW RATHER THAN A DATA OUTCOME, because it is a stage schema written wrong in our own code and not a thing a
 model did: the API would answer HTTP 400 to it on every call of the stage.

 @example
 ```ts
 throw new ClaudeSchemaKeywordError({ refusedKeyword: 'oneOf', schemaPath: 'root.pick', },);
 ```
 */
export class ClaudeSchemaKeywordError extends Error {
  /**
   Declares this message safe to forward: it names a schema keyword and a path of member names, both written in this
   package's own source.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds the failure.

   @param refusedKeyword - the keyword the schema carries

   @param schemaPath - dotted path of the schema node that carries it, member names included, `root` for the top

   @example
   ```ts
   new ClaudeSchemaKeywordError({ refusedKeyword: 'oneOf', schemaPath: 'root.pick', },);
   ```
   */
  public constructor(
    {
      refusedKeyword,
      schemaPath,
    }: {
      readonly refusedKeyword: string;
      readonly schemaPath: string;
    },
  ) {
    super(
      `The Claude route cannot send a schema that carries "${refusedKeyword}" at ${schemaPath}: structured outputs `
        + 'do not support it and no SDK strips it, so the API would answer HTTP 400 on every call of the stage; '
        + 'write the stage schema with the keywords the bundled API skill lists as supported, and check the reply in '
        + 'the stage\'s own guard',
    );
    this.name = 'ClaudeSchemaKeywordError';
  }
}

/**
 Keywords the structured-output feature does not support, which the SDKs strip and this file strips: the numeric
 bounds, the string bounds and the array bounds, the object-size bounds and `uniqueItems`.
 */
const STRIPPED_KEYWORDS: ReadonlySet<string> = new Set([
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'uniqueItems',
  'minProperties',
  'maxProperties',
],);

/**
 Keywords a schema may carry into the request: the bundled API skill's supported list (basic types, `enum`, `const`,
 `anyOf`, `allOf`, `$ref` and `$defs`, string `format`, `additionalProperties`), the structure that list assumes
 (`properties`, `required`, `items`, `definitions`), `default` (the live Structured outputs page lists it as supported),
 and the annotations `description` and `title`, which the model reads and the feature does not constrain.
 */
const ALLOWED_KEYWORDS: ReadonlySet<string> = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'const',
  'anyOf',
  'allOf',
  '$ref',
  '$defs',
  'definitions',
  'default',
  'format',
  'additionalProperties',
  'description',
  'title',
],);

/**
 Keywords whose value maps a NAME to a schema. The names are the caller's, so a member called `minimum` is kept, and
 only the schemas under it are narrowed.
 */
const NAMED_SCHEMA_MAPS: ReadonlySet<string> = new Set([
  'properties',
  '$defs',
  'definitions',
],);

/**
 Keywords whose value is one schema, or in the older tuple form a list of them.
 */
const SCHEMA_VALUED: ReadonlySet<string> = new Set(['items',],);

/**
 Keywords whose value is a list of schemas.
 */
const SCHEMA_LISTS: ReadonlySet<string> = new Set([
  'anyOf',
  'allOf',
],);

/**
 Whether a schema describes an object: it says so by `type`, or it declares members.

 @param schema - schema read, a record

 @returns Whether the feature requires `additionalProperties: false` on it

 @example
 ```ts
 const closed = describesObject({ schema: { type: 'object', }, },);
 ```
 */
function describesObject({ schema, }: { readonly schema: Readonly<Record<string, unknown>>; },): boolean {
  /**
   The `type` member, one name or a list of them.
   */
  const { type, } = schema;
  if (type === 'object')
    return true;
  if (Array.isArray(type,) && type.includes('object',))
    return true;
  return isJsonRecord(schema.properties,);
}

/**
 Narrows one value that is a schema, or passes it through where it is not a record (a boolean schema).

 @param value - value in a schema position

 @param path - where the value sits

 @returns The narrowed copy

 @throws {@link ClaudeSchemaKeywordError} when a schema under the value carries a keyword the feature refuses

 @example
 ```ts
 const narrowed = narrowedValue({ value: { type: 'object', }, path: 'root', },);
 ```
 */
function narrowedValue(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): unknown {
  if (Array.isArray(value,)) {
    return value.map(function narrowItem(
      item: unknown,
      index,
    ): unknown {
      return narrowedValue({
        value: item,
        path: `${path}[${String(index,)}]`,
      },);
    },);
  }
  if (!isJsonRecord(value,))
    return value;
  return narrowedSchema({
    schema: value,
    path,
  },);
}

/**
 Narrows each schema of a name-to-schema map, keeping the names.

 @param map - the map, as the schema wrote it

 @param path - where the map's node sits

 @param keyword - the keyword the map is the value of, which names the path of its members when it is not `properties`

 @returns A copy whose values are narrowed

 @throws {@link ClaudeSchemaKeywordError} when a schema under the map carries a keyword the feature refuses

 @example
 ```ts
 const members = narrowedMap({ map: { age: { type: 'integer', minimum: 1, }, }, path: 'root', keyword: 'properties', },);
 ```
 */
function narrowedMap(
  {
    map,
    path,
    keyword,
  }: {
    readonly map: unknown;
    readonly path: string;
    readonly keyword: string;
  },
): unknown {
  if (!isJsonRecord(map,))
    return map;
  return Object.fromEntries(
    Object.entries(map,)
      .map(function narrowMember([name, member,],): readonly [
        string,
        unknown
      ] {
        return [
          name,
          narrowedValue({
            value: member,
            path: (keyword === 'properties') ? `${path}.${name}` : `${path}.${keyword}.${name}`,
          },),
        ];
      },),
  );
}

/**
 Text that tells the model which constraints were dropped from a schema node, in the form the live Structured outputs
 page gives (`{minimum: 100}`).

 @param dropped - the dropped keywords and their values, in the order the schema wrote them

 @returns The text, braces included

 @example
 ```ts
 const told = droppedConstraintsText({ dropped: [['minimum', 1,],], },);
 // => '{minimum: 1}'
 ```
 */
function droppedConstraintsText(
  {
    dropped,
  }: {
    readonly dropped: readonly (readonly [
      string,
      unknown
    ])[];
  },
): string {
  return `{${
    dropped
      .map(function pairText([keyword, value,],): string {
        return `${keyword}: ${JSON.stringify(value,)}`;
      },)
      .join(', ',)
  }}`;
}

/**
 Narrows one schema node and everything under it.

 @param schema - the node, as the stage wrote it, never edited

 @param path - where the node sits, `root` for the top

 @returns A new node that shares no object with the one given

 @throws {@link ClaudeSchemaKeywordError} when the node carries a keyword the feature refuses

 @example
 ```ts
 const node = narrowedSchema({ schema: { type: 'integer', minimum: 1, }, path: 'root', },);
 ```
 */
function narrowedSchema(
  {
    schema,
    path,
  }: {
    readonly schema: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): Record<string, unknown> {
  /**
   The node's keywords and values in the order the schema wrote them.
   */
  const entries = Object.entries(schema,);
  for (const [keyword,] of entries) {
    if (!(STRIPPED_KEYWORDS.has(keyword,) || ALLOWED_KEYWORDS.has(keyword,))) {
      throw new ClaudeSchemaKeywordError({
        refusedKeyword: keyword,
        schemaPath: path,
      },);
    }
  }

  /**
   The constraints this node drops, which the model is told in the description.
   */
  const dropped = entries.filter(function isStripped([keyword,],): boolean {
    return STRIPPED_KEYWORDS.has(keyword,);
  },);

  /**
   The members that survive, each narrowed by what it holds.
   */
  const kept = Object.fromEntries(
    entries
      .filter(function isSupported([keyword,],): boolean {
        return !STRIPPED_KEYWORDS.has(keyword,);
      },)
      .map(function narrowEntry([keyword, value,],): readonly [
        string,
        unknown
      ] {
        if (NAMED_SCHEMA_MAPS.has(keyword,))
          return [
            keyword,
            narrowedMap({
              map: value,
              path,
              keyword,
            },),
          ];
        if (SCHEMA_VALUED.has(keyword,))
          return [
            keyword,
            narrowedValue({
              value,
              path: `${path}.${keyword}`,
            },),
          ];
        if (SCHEMA_LISTS.has(keyword,))
          return [
            keyword,
            narrowedValue({
              value,
              path: `${path}.${keyword}`,
            },),
          ];
        return [
          keyword,
          structuredClone(value,),
        ];
      },),
  );

  /**
   The description the node carries to the wire: its own, with the dropped constraints told after it.
   */
  const told = (dropped.length === 0)
    ? {}
    : {
      description: ((typeof kept.description) === 'string')
        ? `${kept.description}\n\n${droppedConstraintsText({ dropped, },)}`
        : droppedConstraintsText({ dropped, },),
    };
  return {
    ...kept,
    ...told,
    ...(describesObject({ schema, },) ? { additionalProperties: false, } : {}),
  };
}

/**
 Narrows a JSON Schema to what Anthropic's structured outputs accept: every object gets `additionalProperties: false`,
 the unsupported bounds are dropped and told to the model in the field's description, and a keyword the feature does
 not support that no SDK strips is refused. Nothing else changes.

 A BOUNDED WALK OVER THE SCHEMA'S OWN NESTING, which a stage writes by hand and which is a few levels deep; the schema
 is a tree (no `$ref` cycle is followed, since `$ref` is a string here), so the walk ends.

 @param schema - schema as the stage wrote it, never edited

 @returns A new schema that shares no object with the one given

 @throws {@link ClaudeSchemaKeywordError} when a node of the schema carries a keyword outside the allowlist that is not
 one of the stripped bounds

 @example
 ```ts
 const sent = claudeSchemaOf({ schema: { type: 'object', properties: { age: { type: 'integer', minimum: 1, }, }, }, },);
 // => { type: 'object', properties: { age: { type: 'integer', description: '{minimum: 1}', }, }, additionalProperties: false, }
 ```
 */
export function claudeSchemaOf(
  { schema, }: { readonly schema: Readonly<Record<string, unknown>>; },
): Record<string, unknown> {
  return narrowedSchema({
    schema,
    path: 'root',
  },);
}

//endregion Claude schema
