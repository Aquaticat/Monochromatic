import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';

//region Claude schema
// THE SCHEMA ONE CLAUDE CALL SENDS, narrowed to what Anthropic's structured outputs accept. The bundled API skill
// (`shared/tool-use-concepts.md`, "JSON Schema Limitations") says `additionalProperties: false` is required on every
// object, that the numeric bounds (`minimum`, `maximum`, `multipleOf`), the string bounds (`minLength`, `maxLength`)
// and the complex array bounds are not supported, and that the Python and TypeScript SDKs strip the bounds from what
// they send and check them on the reply. This client is raw HTTP, so no SDK does either for it; this file does.
//
// WHAT THE STRIPPED BOUNDS LEAVE TO THE READER: every stage reads its reply with its own guard, and a bound removed
// here is still enforced there. The only bound any stage schema declares is `minimum: 1` on a finding's paragraph in
// the absolute naturalness review, which `isAbsoluteNaturalnessReviewWire` rejects below 1; `claude-schemas.unit.test.ts`
// in `corpus-pass` lists what is stripped from every stage schema, so a bound added later shows there.

/**
 Keywords the structured-output feature does not support, which the SDKs strip and this file strips: the numeric
 bounds, the string bounds and the array bounds, the object-size bounds and `uniqueItems`.
 */
const UNSUPPORTED_KEYWORDS: ReadonlySet<string> = new Set([
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
 Keywords whose value maps a NAME to a schema. The names are the caller's, so a member called `minimum` is kept, and
 only the schemas under it are narrowed.
 */
const NAMED_SCHEMA_MAPS: ReadonlySet<string> = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
],);

/**
 Keywords whose value is one schema, or in the older tuple form a list of them.
 */
const SCHEMA_VALUED: ReadonlySet<string> = new Set([
  'items',
  'not',
  'if',
  'then',
  'else',
  'contains',
  'propertyNames',
],);

/**
 Keywords whose value is a list of schemas.
 */
const SCHEMA_LISTS: ReadonlySet<string> = new Set([
  'anyOf',
  'allOf',
  'oneOf',
  'prefixItems',
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

 @returns The narrowed copy

 @example
 ```ts
 const narrowed = narrowedValue({ value: { type: 'object', }, },);
 ```
 */
function narrowedValue({ value, }: { readonly value: unknown; },): unknown {
  if (Array.isArray(value,)) {
    return value.map(function narrowItem(item: unknown,): unknown {
      return narrowedValue({ value: item, },);
    },);
  }
  if (!isJsonRecord(value,))
    return value;
  return claudeSchemaOf({ schema: value, },);
}

/**
 Narrows each schema of a name-to-schema map, keeping the names.

 @param map - the map, as the schema wrote it

 @returns A copy whose values are narrowed

 @example
 ```ts
 const members = narrowedMap({ map: { age: { type: 'integer', minimum: 1, }, }, },);
 ```
 */
function narrowedMap({ map, }: { readonly map: unknown; },): unknown {
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
          narrowedValue({ value: member, },),
        ];
      },),
  );
}

/**
 Narrows a JSON Schema to what Anthropic's structured outputs accept: every object gets `additionalProperties: false`
 and the unsupported bounds are dropped. Nothing else changes.

 A BOUNDED WALK OVER THE SCHEMA'S OWN NESTING, which a stage writes by hand and which is a few levels deep; the schema
 is a tree (no `$ref` cycle is followed, since `$ref` is a string here), so the walk ends.

 @param schema - schema as the stage wrote it, never edited

 @returns A new schema that shares no object with the one given

 @example
 ```ts
 const sent = claudeSchemaOf({ schema: { type: 'object', properties: { age: { type: 'integer', minimum: 1, }, }, }, },);
 // => { type: 'object', properties: { age: { type: 'integer', }, }, additionalProperties: false, }
 ```
 */
export function claudeSchemaOf(
  { schema, }: { readonly schema: Readonly<Record<string, unknown>>; },
): Record<string, unknown> {
  /**
   The members that survive, each narrowed by what it holds.
   */
  const kept = Object.fromEntries(
    Object.entries(schema,)
      .filter(function isSupported([keyword,],): boolean {
        return !UNSUPPORTED_KEYWORDS.has(keyword,);
      },)
      .map(function narrowEntry([keyword, value,],): readonly [
        string,
        unknown
      ] {
        if (NAMED_SCHEMA_MAPS.has(keyword,))
          return [
            keyword,
            narrowedMap({ map: value, },),
          ];
        if (SCHEMA_VALUED.has(keyword,) || SCHEMA_LISTS.has(keyword,))
          return [
            keyword,
            narrowedValue({ value, },),
          ];
        return [
          keyword,
          structuredClone(value,),
        ];
      },),
  );
  if (!describesObject({ schema, },))
    return kept;
  return {
    ...kept,
    additionalProperties: false,
  };
}

//endregion Claude schema
