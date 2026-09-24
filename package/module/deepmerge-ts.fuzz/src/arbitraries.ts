/**
 fast-check generators for merge inputs.

 Trees only: every container is freshly built and appears once, so no input
 contains a cycle or a shared container. Shared containers reach a known
 upstream defect (false cycle detection) that `src/known-defect.unit.test.ts`
 pins separately; excluding them here keeps the model comparison meaningful.

 A small key pool makes inputs overlap, so merges actually combine values
 instead of mostly unioning disjoint keys. The pool includes prototype-named
 keys (`__proto__`, `constructor`, `prototype`) and symbols, and records can
 carry null prototypes, accessors, non-enumerable keys, and a frozen state;
 `exotic: false` turns those off for `deepmergeInto` targets, which upstream
 writes into and which therefore must be writable plain data.

 @module
 */

import {
  array,
  bigInt,
  boolean,
  constant,
  constantFrom,
  date,
  double,
  integer,
  letrec,
  oneof,
  record,
  string,
  tuple,
  uniqueArray,
  type Arbitrary,
} from 'fast-check';

//region Leaves

/**
 Class used for leaf instances; merges must treat it as an opaque value.
 */
export class Point {
  /**
   Coordinate; merge results compare instances by identity, not by this.
   */
  readonly x: number;

  /**
   @param x - Coordinate stored on the instance.
   */
  constructor(x: number,) {
    this.x = x;
  }
}

/**
 Symbol keys and values; `Symbol.for` exercises registered symbols too.
 */
export const SYMBOL_POOL = [Symbol('alpha',), Symbol.for('deepmerge-ts.fuzz.beta',),] as const;

/**
 Object used only as a Map key, never as a value, so it cannot form a shared
 container.
 */
const OBJECT_MAP_KEY = Object.freeze({ mapKey: true, },);

/**
 Record keys: overlapping names, integer-like names, prototype-named keys
 other than `__proto__`, and symbols.
 */
const SAFE_RECORD_KEYS: readonly PropertyKey[] = ['a', 'b', 'c', '0', '1', 'constructor', 'prototype', 'toString', ...SYMBOL_POOL,];

/**
 Record key generator.

 @param protoKey - Whether `__proto__` joins the pool; off only for the
   `FastUnsafe` variants, which document that they do not guard it.

 @returns Key generator over the pool.

 @example
 ```ts
 const keys = recordKeyArbitrary({ protoKey: true, });
 ```
 */
function recordKeyArbitrary({ protoKey, }: { readonly protoKey: boolean; },): Arbitrary<PropertyKey> {
  return constantFrom<PropertyKey>(...SAFE_RECORD_KEYS, ...(protoKey ? ['__proto__',] : []),);
}

/**
 Map keys: primitives that collide under SameValueZero and one object key.
 */
const mapKeyArbitrary: Arbitrary<unknown> = constantFrom<unknown>('a', 'b', 1, 2, Number.NaN, OBJECT_MAP_KEY,);

/**
 Leaf generator.

 @param objectLeaves - Whether dates and class instances join the leaves; off
   only where a known defect (`src/known-defect.unit.test.ts`) makes them diverge.

 @returns Generator of every non-container value the merge must treat as a leaf.

 @example
 ```ts
 const leaves = leafArbitrary({ objectLeaves: true, });
 ```
 */
export function leafArbitrary({ objectLeaves, }: { readonly objectLeaves: boolean; },): Arbitrary<unknown> {
  return oneof(
    constant(undefined,),
    constant(null,),
    boolean(),
    integer({ min: -3, max: 3, },),
    double(),
    string({ maxLength: 3, },),
    bigInt({ min: -5n, max: 5n, },),
    constantFrom(...SYMBOL_POOL,),
    ...(objectLeaves ? [date(), integer().map((x,) => new Point(x,),),] : []),
  );
}

//endregion Leaves

//region Records

/**
 How one generated record property is defined.
 */
type EntryStyle = 'data' | 'getter' | 'hidden';

/**
 Record shape before it is materialized.
 */
type RecordPlan = {
  readonly entries: readonly (readonly [PropertyKey, unknown, EntryStyle,])[];
  readonly frozen: boolean;
  readonly nullPrototype: boolean;
};

/**
 Materialize a record plan with `defineProperty`, so `__proto__` becomes an
 own key instead of invoking the prototype setter.

 @param plan - Entries, prototype choice, and frozen flag.

 @returns Fresh record matching the plan.

 @example
 ```ts
 buildRecord({ entries: [['a', 1, 'data',],], frozen: false, nullPrototype: false, });
 ```
 */
function buildRecord(plan: RecordPlan,): object {
  /**
   Fresh record with the planned prototype.
   */
  const built: object = plan.nullPrototype ? Object.create(null,) : {};
  for (const [key, value, style,] of plan.entries) {
    if (style === 'getter') {
      Reflect.defineProperty(built, key, { configurable: true, enumerable: true, get: () => value, },);
    } else {
      Reflect.defineProperty(built, key, {
        configurable: true,
        enumerable: style === 'data',
        value,
        writable: true,
      },);
    }
  }
  return plan.frozen ? Object.freeze(built,) : built;
}

//endregion Records

//region Trees

/**
 Maximum container nesting of one generated tree; deep enough for the
 recursive paths, far below every depth limit.
 */
const TREE_MAX_DEPTH = 4;

/**
 Maximum entries per generated container.
 */
const CONTAINER_MAX_LENGTH = 4;

/**
 Switches shaping generated trees; each defaults to on except `exotic`,
 which every caller chooses explicitly.
 */
export type TreeOptions = {
  /**
   Whether records may carry accessors, non-enumerable keys, null prototypes,
   and a frozen state.
   */
  readonly exotic: boolean;
  /**
   Whether non-container objects (dates, class instances) appear as leaves.
   */
  readonly objectLeaves?: boolean;
  /**
   Whether records may use the `__proto__` key.
   */
  readonly protoKey?: boolean;
};

/**
 Recursive generators sharing one `letrec` scope.
 */
export type TreeArbitraries = {
  readonly record: Arbitrary<object>;
  readonly tree: Arbitrary<unknown>;
};

/**
 Build the recursive tree and record generators.

 @param exotic - See {@link TreeOptions}.
 @param objectLeaves - See {@link TreeOptions}.
 @param protoKey - See {@link TreeOptions}.

 @returns Tree generator plus a record-only generator over the same scope.

 @example
 ```ts
 const { tree, record } = treeArbitraries({ exotic: true, });
 ```
 */
export function treeArbitraries({ exotic, objectLeaves = true, protoKey = true, }: TreeOptions,): TreeArbitraries {
  /**
   Entry style generator; plain data only when `exotic` is off.
   */
  const style: Arbitrary<EntryStyle> = exotic
    ? oneof(
      { weight: 6, arbitrary: constant<EntryStyle>('data',), },
      { weight: 1, arbitrary: constant<EntryStyle>('getter',), },
      { weight: 1, arbitrary: constant<EntryStyle>('hidden',), },
    )
    : constant<EntryStyle>('data',);
  /**
   Flag generator that stays false when `exotic` is off.
   */
  const flag = exotic ? boolean() : constant(false,);
  /**
   Mutually recursive generators; `tree` bounds the depth.
   */
  const scope = letrec<{ tree: unknown; container: unknown; record: object; }>((tie,) => ({
    tree: oneof({ maxDepth: TREE_MAX_DEPTH, depthIdentifier: 'tree', }, leafArbitrary({ objectLeaves, },), tie('container',),),
    container: oneof(
      { depthIdentifier: 'tree', },
      tie('record',),
      array(tie('tree',), { maxLength: CONTAINER_MAX_LENGTH, },),
      array(tie('tree',), { maxLength: CONTAINER_MAX_LENGTH, },).map((items,) => new Set(items,)),
      uniqueArray(tuple(mapKeyArbitrary, tie('tree',),), {
        comparator: 'SameValueZero',
        maxLength: CONTAINER_MAX_LENGTH,
        selector: ([key,],) => key,
      },).map((entries,) => new Map(entries,)),
    ),
    record: record({
      entries: uniqueArray(tuple(recordKeyArbitrary({ protoKey, },), tie('tree',), style,), {
        maxLength: CONTAINER_MAX_LENGTH,
        selector: ([key,],) => key,
      },),
      frozen: flag,
      nullPrototype: flag,
    },).map(buildRecord,),
  }));
  return { record: scope.record, tree: scope.tree, };
}

/**
 Argument lists for `deepmerge`: records most of the time, since that is the
 dominant use, otherwise any trees.

 @param exotic - Forwarded to {@link treeArbitraries}.
 @param objectLeaves - Forwarded to {@link treeArbitraries}.
 @param protoKey - Forwarded to {@link treeArbitraries}.

 @returns Generator of one to four merge arguments.

 @example
 ```ts
 const inputs = mergeArgumentsArbitrary({ exotic: true, });
 ```
 */
export function mergeArgumentsArbitrary({ exotic, objectLeaves = true, protoKey = true, }: TreeOptions,): Arbitrary<readonly unknown[]> {
  /**
   Generators shared by both argument shapes.
   */
  const { record: recordTree, tree, } = treeArbitraries({ exotic, objectLeaves, protoKey, },);
  return oneof(
    { weight: 3, arbitrary: array(recordTree, { minLength: 1, maxLength: CONTAINER_MAX_LENGTH, },), },
    { weight: 1, arbitrary: array(tree, { minLength: 1, maxLength: CONTAINER_MAX_LENGTH, },), },
  );
}

//endregion Trees
