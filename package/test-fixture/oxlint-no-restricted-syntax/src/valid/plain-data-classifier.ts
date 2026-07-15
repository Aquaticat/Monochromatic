/**
 * Semantic fixture parameters exercising strict structural plain-data
 * classification for traversal-hook narrowing.
 *
 * @module
 */

/**
 * Branded commit reference mirroring domain primitive intersections.
 */
type CommitReferenceFixture = string & {
  readonly __plainFixtureBrand: 'commit-reference';
};

/**
 * Recursive TOML-like plain value union exercising cycle memoization.
 */
type TomlLikeFixtureValue =
  | string
  | number
  | boolean
  | TomlLikeFixtureValue[]
  | { [key: string]: TomlLikeFixtureValue; };

/**
 * Object carrying a callable property disqualifying plainness.
 */
type CallablePropertyFixture = {
  readonly label: string;
  readonly run: () => void;
};

/**
 * Object carrying a declared method disqualifying plainness.
 */
type MethodFixture = {
  readonly value: string;
  mutate(): void;
};

/**
 * Class instance whose provenance disqualifies plainness despite data-only fields.
 */
export class PlainFieldFixture {
  /**
   * Data-only field.
   */
  readonly count: number = 0;
}

/**
 * Class instance with statically declared accessor hook.
 */
export class AccessorFixture {
  /**
   * Statically visible getter hook.
   */
  get label(): string {
    return 'accessor';
  }
}

/**
 * Reads primitive fixture parameter.
 *
 * @param plainPrimitive - Primitive crossing hook boundary.
 *
 * @returns same primitive.
 *
 * @example
 * ```ts
 * readPlainPrimitive('value');
 * ```
 */
export function readPlainPrimitive(plainPrimitive: string,): string {
  return plainPrimitive;
}

/**
 * Reads branded primitive fixture parameter.
 *
 * @param brandedPrimitive - Branded commit reference crossing hook boundary.
 *
 * @returns widened primitive.
 *
 * @example
 * ```ts
 * readBrandedPrimitive(reference);
 * ```
 */
export function readBrandedPrimitive(brandedPrimitive: CommitReferenceFixture,): string {
  return brandedPrimitive;
}

/**
 * Reads plain union fixture parameter.
 *
 * @param plainUnion - Union of primitives crossing hook boundary.
 *
 * @returns stringified union member.
 *
 * @example
 * ```ts
 * readPlainUnion(1);
 * ```
 */
export function readPlainUnion(plainUnion: string | number | null | undefined,): string {
  return typeof plainUnion;
}

/**
 * Reads mutable plain array fixture parameter.
 *
 * @param plainArray - Mutable primitive array crossing hook boundary.
 *
 * @returns element count.
 *
 * @example
 * ```ts
 * readPlainArray(['value']);
 * ```
 */
export function readPlainArray(plainArray: string[],): number {
  return plainArray.length;
}

/**
 * Reads readonly plain tuple fixture parameter.
 *
 * @param plainTuple - Readonly primitive tuple crossing hook boundary.
 *
 * @returns first element.
 *
 * @example
 * ```ts
 * readPlainTuple(['value', 1]);
 * ```
 */
export function readPlainTuple(plainTuple: readonly [string, number],): string {
  return plainTuple[0];
}

/**
 * Reads plain record fixture parameter.
 *
 * @param plainRecord - Primitive-valued record crossing hook boundary.
 *
 * @returns key count.
 *
 * @example
 * ```ts
 * readPlainRecord({ key: 1 });
 * ```
 */
export function readPlainRecord(plainRecord: Record<string, number>,): number {
  return Object.keys(plainRecord,).length;
}

/**
 * Reads nested plain object fixture parameter.
 *
 * @param plainNested - Nested plain structure crossing hook boundary.
 *
 * @returns nested element count.
 *
 * @example
 * ```ts
 * readPlainNested({ label: 'value', inner: { counts: [1] } });
 * ```
 */
export function readPlainNested(
  plainNested: {
    readonly label: string;
    readonly inner: {
      readonly counts: number[];
    };
  },
): number {
  return plainNested
    .inner
    .counts
    .length;
}

/**
 * Reads recursive TOML-like fixture parameter.
 *
 * @param tomlLikeValue - Recursive plain union crossing hook boundary.
 *
 * @returns runtime type tag.
 *
 * @example
 * ```ts
 * readTomlLikeValue({ key: [1, 'value'] });
 * ```
 */
export function readTomlLikeValue(tomlLikeValue: TomlLikeFixtureValue,): string {
  return typeof tomlLikeValue;
}

/**
 * Reads unknown fixture parameter.
 *
 * @param unknownValue - Unknown value failing closed at hook boundary.
 *
 * @returns runtime type tag.
 *
 * @example
 * ```ts
 * readUnknownValue('value');
 * ```
 */
export function readUnknownValue(unknownValue: unknown,): string {
  return typeof unknownValue;
}

/**
 * Reads broad object fixture parameter.
 *
 * @param objectValue - Broad object failing closed at hook boundary.
 *
 * @returns runtime type tag.
 *
 * @example
 * ```ts
 * readObjectValue({});
 * ```
 */
export function readObjectValue(objectValue: object,): string {
  return typeof objectValue;
}

/**
 * Reads unknown-valued index signature fixture parameter.
 *
 * @param unknownIndexValue - Record with unknown values failing closed.
 *
 * @returns key count.
 *
 * @example
 * ```ts
 * readUnknownIndexValue({ key: 'value' });
 * ```
 */
export function readUnknownIndexValue(
  unknownIndexValue: { readonly [key: string]: unknown; },
): number {
  return Object.keys(unknownIndexValue,).length;
}

/**
 * Reads callable-property fixture parameter.
 *
 * @param callableProperty - Object carrying invocable capability.
 *
 * @returns label field.
 *
 * @example
 * ```ts
 * readCallableProperty({ label: 'value', run: () => {} });
 * ```
 */
export function readCallableProperty(callableProperty: CallablePropertyFixture,): string {
  return callableProperty.label;
}

/**
 * Reads method-carrying fixture parameter.
 *
 * @param methodValue - Object carrying declared method.
 *
 * @returns value field.
 *
 * @example
 * ```ts
 * readMethodValue(capability);
 * ```
 */
export function readMethodValue(methodValue: MethodFixture,): string {
  return methodValue.value;
}

/**
 * Reads function fixture parameter.
 *
 * @param functionValue - Directly callable value.
 *
 * @returns runtime type tag.
 *
 * @example
 * ```ts
 * readFunctionValue(() => {});
 * ```
 */
export function readFunctionValue(functionValue: () => void,): string {
  return typeof functionValue;
}

/**
 * Reads class-instance fixture parameter.
 *
 * @param classInstance - Instance whose class provenance fails closed.
 *
 * @returns count field.
 *
 * @example
 * ```ts
 * readClassInstance(new PlainFieldFixture());
 * ```
 */
export function readClassInstance(classInstance: PlainFieldFixture,): number {
  return classInstance.count;
}

/**
 * Reads accessor-instance fixture parameter.
 *
 * @param accessorInstance - Instance carrying statically declared getter.
 *
 * @returns label through accessor.
 *
 * @example
 * ```ts
 * readAccessorInstance(new AccessorFixture());
 * ```
 */
export function readAccessorInstance(accessorInstance: AccessorFixture,): string {
  return accessorInstance.label;
}

/**
 * Reads collection fixture parameter.
 *
 * @param mapValue - Standard collection carrying intrinsic methods.
 *
 * @returns entry count.
 *
 * @example
 * ```ts
 * readMapValue(new Map());
 * ```
 */
export function readMapValue(mapValue: ReadonlyMap<string, string>,): number {
  return mapValue.size;
}

/**
 * Reads generic fixture parameter.
 *
 * @param genericValue - Unresolved type parameter failing closed.
 *
 * @returns same value.
 *
 * @example
 * ```ts
 * readGenericValue('value');
 * ```
 */
export function readGenericValue<Value,>(genericValue: Value,): Value {
  return genericValue;
}
