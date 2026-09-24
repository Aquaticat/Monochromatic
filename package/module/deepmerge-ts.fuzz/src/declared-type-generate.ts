/**
 Case generator for declared-type soundness fuzzing.

 Each case draws declared input types (`./declared-type-ast.ts`), values that
 conform to them (`./declared-type-sample.ts`), runs deepmerge-ts on those
 values, and emits TypeScript that passes each input as `widen<T>(value)`
 (so the declared type, not the literal, drives inference) and assigns the
 runtime result, written as a literal, to a variable of the call's static
 result type. `tsc` accepting a case proves the runtime result fits the
 declared-input result type.

 Entry points covered: `deepmerge`, `deepmergeFastUnsafe`, `deepmergeInto`
 (the asserted target type against the mutated target), and
 `deepmergeCustom` with plain option objects.

 @module
 */

import {
  array,
  constantFrom,
  oneof,
  record,
  sample,
  tuple,
  type Arbitrary,
} from 'fast-check';

import {
  DECLARED_TYPE_SCOPES,
  emitType,
  SYMBOL_NAMES,
  type TypeNode,
} from './declared-type-ast.ts';
import {
  RUNTIME_SYMBOLS,
  sampleValue,
} from './declared-type-sample.ts';
import { snapshotObject, } from './shape.ts';
import { target, } from './target.ts';

/**
 Entry point exercised by a case.
 */
export type CaseKind = 'custom' | 'fast' | 'into' | 'merge';

/**
 Plain `deepmergeCustom` option objects, as source text keyed by name.
 */
export const CUSTOM_OPTIONS: Readonly<Record<string, string>> = {
  empty: '{}',
  filterValuesFalse: '{ filterValues: false }',
  implicitDefault: '{ enableImplicitDefaultMerging: true }',
  mapsFalse: '{ mergeMaps: false }',
  maxDepth2: '{ maxDepth: 2 }',
  arraysFalse: '{ mergeArrays: false }',
  recordsFalse: '{ mergeRecords: false }',
  setsFalse: '{ mergeSets: false }',
};

/**
 One drawn case before emission.
 */
export type DrawnCase = {
  readonly kind: CaseKind;
  readonly option: string;
  readonly types: readonly TypeNode[];
  readonly values: readonly unknown[];
  readonly sources: readonly string[];
};

/**
 Most inputs per call.
 */
const MAX_INPUTS = 3;

/**
 Runtime option objects matching {@link CUSTOM_OPTIONS}.
 */
const RUNTIME_OPTIONS: Readonly<Record<string, object>> = {
  empty: {},
  filterValuesFalse: { filterValues: false, },
  implicitDefault: { enableImplicitDefaultMerging: true, },
  mapsFalse: { mergeMaps: false, },
  maxDepth2: { maxDepth: 2, },
  arraysFalse: { mergeArrays: false, },
  recordsFalse: { mergeRecords: false, },
  setsFalse: { mergeSets: false, },
};

/**
 Draw types first, then values conforming to them.

 @param head - Generator of the first input's type.
 
 @param rest - Generator of the remaining inputs' types.

 @returns Arbitrary of types paired with conforming values.

 @example
 ```ts
 const pairs = typesAndValues({ head: scope.type, rest: scope.type, });
 ```
 */
function typesAndValues(
  {
    head,
    rest,
  }: {
    readonly head: Arbitrary<TypeNode>;
    readonly rest: Arbitrary<TypeNode>
  },
): Arbitrary<{
  readonly types: readonly TypeNode[];
  readonly values: readonly unknown[];
  readonly sources: readonly string[]
}> {
  return tuple(
    head,
    array(
      rest,
      {
        minLength: 1,
        maxLength: MAX_INPUTS - 1,
      },
    ),
  )
    .chain(function drawValues([first, rest,],) {
      /**
       All input types in call order.
       */
      const types = [
        first,
        ...rest,
      ];
      return tuple(...types.map(sampleValue,),)
        .map(function pair(samples,) {
        return {
          sources: samples.map(function sourceOf(sample,) {
            return sample.source;
          },),
          types,
          values: samples.map(function valueOf(sample,) {
            return sample.value;
          },),
        };
      },);
    },);
}

/**
 Generator of whole cases across every entry point.

 @param unions - Whether declared types may contain unions.

 @returns Case generator.

 @example
 ```ts
 const cases = caseArbitraryFor({ unions: true, });
 ```
 */
export function caseArbitraryFor({ unions, }: { readonly unions: boolean; },): Arbitrary<DrawnCase> {
  /**
   Type generators for this mode.
   */
  const scope = DECLARED_TYPE_SCOPES[unions ? 'unions' : 'noUnions'];
  /**
   Inputs of any declared type.
   */
  const anyInputs = typesAndValues({
    head: scope.type,
    rest: scope.type,
  },);
  return oneof(
    {
      weight: 4,
      arbitrary: anyInputs.map(function merge(drawn,): DrawnCase {
      return {
        ...drawn,
        kind: 'merge',
        option: 'empty',
      };
    },),
    },
    {
      weight: 1,
      arbitrary: anyInputs.map(function fast(drawn,): DrawnCase {
      return {
        ...drawn,
        kind: 'fast',
        option: 'empty',
      };
    },),
    },
    // Object sources only: a non-object source is the pinned root-level kind mismatch.
    {
      weight: 2,
      arbitrary: typesAndValues({
        head: scope.object,
        rest: scope.object,
      },)
        .map(function into(drawn,): DrawnCase {
      return {
        ...drawn,
        kind: 'into',
        option: 'empty',
      };
    },),
    },
    {
      weight: 2,
      arbitrary: record({
        drawn: anyInputs,
        option: constantFrom(...Object.keys(CUSTOM_OPTIONS,),),
      },)
        .map(function custom({
          drawn,
          option,
        },): DrawnCase {
      return {
        ...drawn,
        kind: 'custom',
        option,
      };
    },),
    },
  );
}

/**
 Constant name for a runtime symbol key.

 @param symbol - Key found on a value.

 @returns Name declared in the generated header.

 @throws When the symbol is not one of {@link RUNTIME_SYMBOLS}.

 @example
 ```ts
 symbolName(RUNTIME_SYMBOLS.SYM_A); // 'SYM_A'
 ```
 */
function symbolName(symbol: symbol,): string {
  /**
   Matching constant, when the symbol is one of ours.
   */
  const found = Object.entries(RUNTIME_SYMBOLS,)
    .find(function matches([, candidate,],) {
    return candidate === symbol;
  },);
  if (found === undefined)
    throw new Error(`unknown symbol key ${String(symbol,)}`,);
  return found[0];
}

/**
 Write a runtime result as a TypeScript expression checked against the static
 type at its position.

 Objects and arrays are contextually typed by the assignment. Sets and Maps get
 explicit type arguments computed from `typeExpression`, the static type at this
 position expressed through the header's path helpers (`PropOf`, `ElemOf`,
 `SetElem`, `MapKey`, `MapValue`), so every element is checked against the
 declared-input result type and never re-inferred. A position whose static
 type is not a Set or Map yields `never` arguments, which fail as they should.

 @param value - Runtime result or a part of it.
 
 @param typeExpression - Static type at this position.

 @returns Expression source.

 @throws When the value has no literal form.

 @example
 ```ts
 emitValue({ value: new Set([1,]), typeExpression: 'typeof merged', });
 // 'new Set<SetElem<typeof merged>>([1])'
 ```
 */
export function emitValue({
  value,
  typeExpression,
}: {
  readonly value: unknown;
  readonly typeExpression: string
},): string {
  if (value === undefined)
    return 'undefined';
  if ((value === null) || ((typeof value) === 'boolean')
    || ((typeof value) === 'number')
    || ((typeof value) === 'string'))
    return JSON.stringify(value,);
  if (value instanceof Date)
    return `new Date(${String(value.getTime(),)})`;
  if (value instanceof RegExp)
    return `new RegExp(${JSON.stringify(value.source,)}, ${JSON.stringify(value.flags,)})`;
  if (Array.isArray(value,)) {
    // Position as two counter tuples (index from the start, distance from the end), so ElemAt can
    // resolve both fixed prefixes and fixed tails around a rest element.
    return `[${value.map(function element(
      item: unknown,
      index: number,
    ) {
      /**
       Counter tuple of a given length.
       */
      const counter = function counterOf(length: number,): string {
        return `[${Array.from(
          { length, },
          function slot() {
          return 'unknown';
        },
        )
          .join(', ',)}]`;
      };
      return emitValue({
        typeExpression: `ElemAt<${typeExpression}, ${counter(index,)}, ${counter(value.length - index
          - 1,)}>`,
        value: item,
      },);
    },).join(', ',)}]`;
  }
  if (value instanceof Set) {
    return `new Set<SetElem<${typeExpression}>>([${[...value,].map(function element(item,) {
      return emitValue({
        typeExpression: `SetElem<${typeExpression}>`,
        value: item,
      },);
    },)
      .join(', ',)}])`;
  }
  if (value instanceof Map) {
    return `new Map<MapKey<${typeExpression}>, MapValue<${typeExpression}>>([${[...value,].map(function entry([key, entryValue,],) {
      return `[${emitValue({
        typeExpression: `MapKey<${typeExpression}>`,
        value: key,
      },)}, ${emitValue({
        typeExpression: `MapValue<${typeExpression}>`,
        value: entryValue,
      },)}]`;
    },)
      .join(', ',)}])`;
  }
  if (((typeof value) === 'object') && (value !== null)) {
    return `{ ${Reflect.ownKeys(value,)
      .map(function property(key,) {
      /**
       Key source and key type: computed symbol constant or quoted string.
       */
      const [keySource, keyType,] = (typeof key) === 'symbol'
        ? [
          `[${symbolName(key as symbol,)}]`,
          `typeof ${symbolName(key as symbol,)}`,
        ]
        : [
          JSON.stringify(key,),
          JSON.stringify(key,),
        ];
      return `${keySource}: ${emitValue({
        typeExpression: `PropOf<${typeExpression}, ${keyType}>`,
        value: Reflect.get(
          value,
          key,
        ),
      },)}`;
    },)
      .join(', ',)} }`;
  }
  throw new TypeError(`emitValue: no literal form for ${typeof value}`,);
}

/**
 Run a drawn case against the build under test.

 @param drawn - Case to run.

 @returns Runtime result: the merge result, or the mutated target for `into`.

 @example
 ```ts
 const result = runCase(drawn);
 ```
 */
export function runCase(drawn: DrawnCase,): unknown {
  if (drawn.kind === 'merge')
    return target.deepmerge(...drawn.values,);
  if (drawn.kind === 'fast')
    return target.deepmergeFastUnsafe(...drawn.values,);
  if (drawn.kind === 'custom')
    return target.deepmergeCustom(RUNTIME_OPTIONS[drawn.option] ?? {},)(...drawn.values,);
  /**
   Private copy of the target, so the drawn value stays untouched.
   */
  const intoTarget = snapshotObject(drawn.values[0] as object,);
  target.deepmergeInto(
    intoTarget,
    ...drawn.values
      .slice(1,),
  );
  return intoTarget;
}

/**
 Emit one case as a function expression returning the call result and the
 checked literal.

 @param drawn - Case to emit.
 
 @param result - Its runtime result.
 
 @param id - Case number, echoed in a comment for triage.

 @returns Source lines of the case.

 @example
 ```ts
 emitCase({ drawn, result, id: 0, });
 ```
 */
export function emitCase(
  {
    drawn,
    result,
    id,
  }: {
    readonly drawn: DrawnCase;
    readonly result: unknown;
    readonly id: number
  },
): readonly string[] {
  /**
   Inputs as `widen<T>(value)` so declared types drive inference.
   */
  const inputs = drawn.types
    .map(function input(
      type,
      position,
    ) {
    return `widen<${emitType(type,)}>(${drawn.sources[position] ?? 'undefined'})`;
  },);
  if (drawn.kind === 'into') {
    return [
      `  // case ${String(id,)} into`,
      '  () => {',
      `    const intoTarget = ${inputs[0] ?? ''};`,
      `    deepmergeInto(intoTarget, ${inputs.slice(1,)
        .join(', ',)});`,
      '    const after = intoTarget;',
      `    const check: typeof after = ${emitValue({
        typeExpression: 'typeof after',
        value: result,
      },)};`,
      '    return { merged: after, value: check, };',
      '  },',
    ];
  }
  /**
   Call expression per entry point.
   */
  const call = {
    custom: `deepmergeCustom(${CUSTOM_OPTIONS[drawn.option] ?? '{}'})(${inputs.join(', ',)})`,
    fast: `deepmergeFastUnsafe(${inputs.join(', ',)})`,
    merge: `deepmerge(${inputs.join(', ',)})`,
  }[drawn.kind];
  return [
    `  // case ${String(id,)} ${drawn.kind} ${drawn.option}`,
    '  () => {',
    `    const merged = ${call};`,
    `    const check: typeof merged = ${emitValue({
      typeExpression: 'typeof merged',
      value: result,
    },)};`,
    '    return { merged, value: check, };',
    '  },',
  ];
}

/**
 Header shared by every generated case file.

 @param exportName - Name of the exported case array.

 @returns Source lines before the cases.

 @example
 ```ts
 emitHeader('DECLARED_TYPE_CASES');
 ```
 */
export function emitHeader(exportName: string,): readonly string[] {
  return [
    '// Generated by src/declared-type-generate.ts. Do not edit.',
    '// Each case type-checks only if the runtime result fits the declared-input result type.',
    'import { deepmerge, deepmergeCustom, deepmergeFastUnsafe, deepmergeInto, } from \'deepmerge-ts\';',
    '',
    'export type DeclaredTypeCase = () => { readonly merged: unknown; readonly value: unknown; };',
    '',
    'type FuzzBrand = number & { readonly fuzzBrand?: \'declared-type-fuzz\'; };',
    'type Box<T> = { v: T; tag: string; };',
    ...SYMBOL_NAMES.map(function declareSymbol(name,) {
      return `const ${name}: unique symbol = Symbol(${JSON.stringify(name,)},);`;
    },),
    '',
    '// Pass a value through its declared type, so control flow cannot narrow it to the literal.',
    'function widen<T,>(value: T,): T {',
    '  return value;',
    '}',
    '',
    '// Static type at a position of a result, for explicit Set and Map type arguments.',
    '// Each distributes over unions and drops members that lack the position.',
    '// A member that admits any such value (for example `{}` or `object`) yields `unknown`.',
    'type PropOf<T, K extends PropertyKey,> = T extends unknown ? (K extends keyof T ? T[K] : ({} extends T ? unknown : never)) : never;',
    'type AtFromEnd<T, K extends unknown[],> = T extends readonly [...infer Head, infer Last,] ? (K extends [] ? Last : AtFromEnd<Head, K extends [unknown, ...infer R,] ? R : []>) : (T extends readonly (infer E)[] ? E : never);',
    'type ElemAt<T, I extends unknown[], K extends unknown[],> = T extends readonly unknown[]',
    '  ? (number extends T["length"] ? (T extends readonly [infer First, ...infer Rest,] ? (I extends [] ? First : ElemAt<Rest, I extends [unknown, ...infer R,] ? R : [], K>) : AtFromEnd<T, K>) : T[I["length"]])',
    '  : (unknown[] extends T ? unknown : never);',
    'type SetElem<T,> = T extends ReadonlySet<infer V> ? V : (Set<unknown> extends T ? unknown : never);',
    'type MapKey<T,> = T extends ReadonlyMap<infer K, unknown> ? K : (Map<unknown, unknown> extends T ? unknown : never);',
    'type MapValue<T,> = T extends ReadonlyMap<unknown, infer V> ? V : (Map<unknown, unknown> extends T ? unknown : never);',
    '',
    '// Keep the brand alias referenced even when no case draws it.',
    'export type DeclaredTypeBrand = FuzzBrand;',
    '',
    `export const ${exportName}: readonly DeclaredTypeCase[] = [`,
  ];
}

/**
 Draw and run cases from a seed.

 @param seed - fast-check seed.
 
 @param size - Number of cases.
 
 @param unions - Whether declared types may contain unions.

 @returns Drawn cases with their runtime results; draws whose run throws are dropped.

 @example
 ```ts
 const cases = drawCases({ seed: 1, size: 10, unions: true, });
 ```
 */
export function drawCases(
  {
    seed,
    size,
    unions,
  }: {
    readonly seed: number;
    readonly size: number;
    readonly unions: boolean
  },
): readonly {
  readonly drawn: DrawnCase;
  readonly result: unknown
}[] {
  return sample(
    caseArbitraryFor({ unions, },),
    {
      numRuns: size,
      seed,
    },
  )
    .flatMap(function run(drawn,) {
    try {
      return [{
        drawn,
        result: runCase(drawn,),
      },];
    } catch (error) {
      // A throwing merge is a runtime finding for other suites, not a type case.
      console.warn(`declared-type-generate: dropped a ${drawn.kind} case whose run threw: ${String(error,)}`,);
      return [];
    }
  },);
}
