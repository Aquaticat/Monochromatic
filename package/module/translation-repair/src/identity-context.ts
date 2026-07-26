import { isJsonRecord, } from './json-guard.ts';

//region Identity context
// Corpus pages declare who the entry is about in YAML front matter, and the two
// sides declare it in their own languages: `name: 委委-fairy` against
// `name: Acheron`, `name: 岁月封华` against `name: Suigetsu Houka`. Front matter
// is parsed onto `RepairDocument` but reached no downstream consumer, so critics
// judged names with the declaration withheld and reported correct, sourced
// renderings as unsubstantiated substitutions. Milestone three's graded sample
// scored three such false positives (Acheron, BI4PBV, Toka_ls). This module
// turns both sides' declarations into one compact block the critic prompt can
// carry, so a declared correspondence is evidence the model has rather than
// context it must guess.
//
// Only declaration fields are surfaced. Front matter carries free prose too
// (`desc`), which is document content rather than identity, and feeding it as
// authoritative would license real defects inside it.

/**
 * Front matter keys carrying identity, in the order a reader wants them.
 * `name` is the display name, `info.alias` the alternate handles, and
 * `info.location` the place name, which transliterates the same way names do.
 */
const IDENTITY_FIELDS = [
  'name',
  'alias',
  'location',
] as const;

/**
 * One side's declared identity, every field optional because corpus metadata
 * shapes vary per entry and many pages declare only a name.
 *
 * @example
 * ```ts
 * const declared: DeclaredIdentity = { name: 'Acheron', alias: 'Fairy, Acheron', };
 * ```
 */
export type DeclaredIdentity = {
  /**
   * Display name as declared, absent when the page declares none.
   */
  readonly name?: string;

  /**
   * Alternate handles as declared, comma-joined by the corpus itself.
   */
  readonly alias?: string;

  /**
   * Place name as declared.
   */
  readonly location?: string;
};

/**
 * Narrows a raw front matter value to a usable declaration. Corpus metadata is
 * `unknown` by type and hand-edited in practice, so a number, list, or null in
 * a name field must be rejected rather than coerced: a coerced value would
 * enter the prompt as an authoritative correspondence.
 *
 * @param value - raw front matter value
 *
 * @returns Whether the value is a string carrying non-whitespace content
 *
 * @example
 * ```ts
 * if (isDeclared('Mittens',)) { }
 * ```
 */
function isDeclared(value: unknown,): value is string {
  return ((typeof value) === 'string')
    && (value.trim()
      .length
      > 0);
}

/**
 * Reads one field into a fragment that spreads into a {@link DeclaredIdentity}.
 * An undeclared field yields no key at all, which is what `?:` optionality
 * means under `exactOptionalPropertyTypes`, so absence never has to travel as
 * a value.
 *
 * @param record - candidate record to read from
 *
 * @param key - field name to read
 *
 * @returns Single-entry fragment, empty when the field is not declared
 *
 * @example
 * ```ts
 * const fragment = declaredFragment({ record: { name: 'Mittens', }, key: 'name', },);
 * ```
 */
function declaredFragment(
  {
    record,
    key,
  }: {
    readonly record: Readonly<Record<string, unknown>>;
    readonly key: string;
  },
): Readonly<Record<string, string>> {
  /**
   * Raw field value, still untyped.
   */
  const value = record[key];
  return isDeclared(value,)
    ? { [key]: value.trim(), }
    : {};
}

/**
 * Extracts declared identity from one document's parsed front matter data.
 * Reads `name` at the top level and `alias`/`location` from the nested `info`
 * record, which is the shape the pinned corpus uses.
 *
 * @param data - parsed front matter value, `unknown` because shapes vary
 *
 * @returns Declared identity, empty when nothing is declared
 *
 * @example
 * ```ts
 * const identity = extractDeclaredIdentity({
 *   data: { name: 'Suigetsu Houka', info: { alias: 'Suigetsu', }, },
 * },);
 * ```
 */
export function extractDeclaredIdentity(
  { data, }: { readonly data: unknown; },
): DeclaredIdentity {
  if (!isJsonRecord(data,))
    return {};

  /**
   * Nested `info` record when present; alias and location live here.
   */
  const info = isJsonRecord(data.info,)
    ? data.info
    : {};

  return {
    ...declaredFragment({
      record: data,
      key: 'name',
    },),
    ...declaredFragment({
      record: info,
      key: 'alias',
    },),
    ...declaredFragment({
      record: info,
      key: 'location',
    },),
  };
}

/**
 * Renders one field's declared correspondence, kept only when at least one
 * side declares it. A one-sided declaration still earns its line: it tells the
 * critic the handle is sourced metadata rather than invention, which is exactly
 * the judgment that produced the graded false positives.
 *
 * @param field - identity field to render
 *
 * @param source - original side's declaration
 *
 * @param target - translation side's declaration
 *
 * @returns Single-line list for a declared field, empty when neither side
 * declares it, so callers flatten instead of filtering absent values
 *
 * @example
 * ```ts
 * const lines = renderField({ field: 'name', source, target, },);
 * ```
 */
function renderField(
  {
    field,
    source,
    target,
  }: {
    readonly field: typeof IDENTITY_FIELDS[number];
    readonly source: DeclaredIdentity;
    readonly target: DeclaredIdentity;
  },
): readonly string[] {
  /**
   * Original side's declared value for this field, when declared at all.
   */
  const sourceValue = source[field];

  /**
   * Translation side's declared value for this field, when declared at all.
   */
  const targetValue = target[field];
  if ((!isDeclared(sourceValue,)) && (!isDeclared(targetValue,)))
    return [];

  return [
    `- ${field}: ORIGINAL declares ${
      isDeclared(sourceValue,)
        ? `"${sourceValue}"`
        : '(nothing)'
    }, TRANSLATION declares ${
      isDeclared(targetValue,)
        ? `"${targetValue}"`
        : '(nothing)'
    }`,
  ];
}

/**
 * Collects the identity lines both sides' front matter declares, ready to
 * embed in a critic prompt. An empty result means neither side declared
 * anything, so callers omit the block rather than emit an empty heading;
 * absence stays a zero-length list instead of travelling as a nullish value.
 *
 * @param sourceData - original document's parsed front matter value
 *
 * @param targetData - translation document's parsed front matter value
 *
 * @returns Rendered lines, empty when no field is declared on either side
 *
 * @example
 * ```ts
 * const lines = collectIdentityLines({
 *   sourceData: { name: '委委-fairy', },
 *   targetData: { name: 'Acheron', },
 * },);
 * ```
 */
export function collectIdentityLines(
  {
    sourceData,
    targetData,
  }: {
    readonly sourceData: unknown;
    readonly targetData: unknown;
  },
): readonly string[] {
  /**
   * Original side's declared identity.
   */
  const source = extractDeclaredIdentity({ data: sourceData, },);

  /**
   * Translation side's declared identity.
   */
  const target = extractDeclaredIdentity({ data: targetData, },);

  return IDENTITY_FIELDS
    .flatMap(function toLines(field,) {
      return renderField({
        field,
        source,
        target,
      },);
    },);
}

//endregion Identity context
