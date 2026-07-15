// oxlint-disable eslint/no-unused-expressions -- property accesses verify type narrowing at compile time
// oxlint-disable typescript/no-unsafe-type-assertion -- intentional `as any` and `as Type` casts test guard behavior
// oxlint-disable typescript/no-explicit-any -- any-typed test inputs verify guard behavior with untyped values
// oxlint-disable typescript/no-unsafe-member-access -- accessing members on any-typed values is part of the behavioral test
// oxlint-disable typescript/no-unsafe-assignment -- assigning any-typed results is part of the behavioral test
// oxlint-disable typescript/no-unsafe-call -- calling functions on any-typed values is part of the behavioral test
// oxlint-disable typescript/no-unsafe-argument -- passing any-typed arguments is part of the behavioral test
// oxlint-disable typescript/no-confusing-void-expression -- void returns from IIFEs are intentional
// oxlint-disable eslint/no-magic-numbers -- numeric literals in test data are self-documenting
// oxlint-disable stylistic/object-property-per-line -- compact test data on single lines
/**
 * Simplified Schema typeguard behavioral test matrix.
 *
 * Tests different typeguard implementation patterns against simplified Schema types
 * to establish baseline behavioral understanding before moving to complex generics.
 *
 * This is a BEHAVIORAL TEST FILE - not unit tests. All code demonstrates compile-time
 * and runtime behavior through TypeScript type checking and intentional `@ts-expect-error` markers.
 */

//region Simplified Type Definitions

/**
 * Base schema with a parse method accepting and returning unknown.
 */
type Schema = {
  readonly parse: (value: unknown,) => unknown;
};

/**
 * Schema with an additional numeric weight property.
 */
type SchemaWithWeight = Schema & {
  readonly weight: number;
};

/**
 * Schema with an additional string name property.
 */
type NamedSchema = Schema & {
  readonly name: string;
};

/**
 * Schema combining weight, name, and version properties.
 */
type ComplexSchema = SchemaWithWeight & {
  readonly name: string;
  readonly version: number;
};
//endregion Simplified Type Definitions

//region Simplified Guard Patterns

/**
 * Unknown pattern - accepts anything, narrows to base Schema type.
 *
 * @param value - candidate to check for schema shape
 *
 * @returns `true` when value has a callable `parse` property
 */
function isSchema_Unknown(value: unknown,): value is Schema {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  if (!('parse' in value))
    return false;
  return (typeof value.parse) === 'function';
}

/**
 * Generic pattern - preserves input structure through const generics.
 *
 * @param value - candidate to check, preserving its original type
 *
 * @returns `true` when value has a callable `parse` property
 */
function isSchema_Generic<const MyValue = unknown,>(
  value: MyValue,
): value is MyValue extends Schema ? (MyValue & Schema)
  : never
{
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  if (!('parse' in value))
    return false;
  return (typeof (value as any).parse) === 'function';
}

/**
 * Typed pattern - requires exact Schema type at call site.
 *
 * @param value - schema instance already typed as Schema
 *
 * @returns `true` when value has a callable `parse` property
 */
function isSchema_Typed(value: Schema,): value is Schema {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  if (!('parse' in value))
    return false;
  return (typeof value.parse) === 'function';
}

/**
 * Generic extends pattern - compile-time safety with inheritance support.
 *
 * @param value - schema instance constrained to Schema subtypes
 *
 * @returns `true` when value has a callable `parse` property
 */
function isSchema_GenericExtends<const T extends Schema = Schema,>(
  value: T,
): value is T {
  if (value === null)
    return false;
  if ((typeof value) !== 'object')
    return false;
  if (!('parse' in value))
    return false;
  return (typeof value.parse) === 'function';
}
//endregion Simplified Guard Patterns

//region Simplified Test Values

/**
 * Collection of schema instances with various type constraints for behavioral testing.
 */
const simplifiedTestValues = {
  // Properly typed schemas - should preserve properties
  schemaWithWeight: { parse(x: unknown,) {
    return x;
  }, weight: 100, } as SchemaWithWeight,
  namedSchema: { parse(x: unknown,) {
    return x;
  }, name: 'test', } as NamedSchema,
  complexSchema: {
    parse(x: unknown,) {
      return x;
    },
    weight: 100,
    name: 'complex',
    version: 1,
  } as ComplexSchema,

  // Loosely typed - test type narrowing behavior
  unknownValue: { parse(x: unknown,) {
    return x;
  }, weight: 100, } as unknown,
  anyValue: { parse(x: unknown,) {
    return x;
  }, weight: 100, } as any,

  // Union types - test compile-time safety and narrowing
  unionWithString: ({ parse(x: unknown,) {
    return x;
  }, } as Schema | string),
  unionWithNull: ({ parse(x: unknown,) {
    return x;
  }, } as Schema | null),
  unionWithNumber: ({ parse(x: unknown,) {
    return x;
  }, } as Schema | number),
  unionThreeWay: ({ parse(x: unknown,) {
    return x;
  }, weight: 50, } as Schema | string | number),

  // Complex type combinations
  intersectionType: { parse(x: unknown,) {
    return x;
  }, extraProp: true, } as Schema & {
    extraProp: boolean;
  },
  brandedSchema: { parse(x: unknown,) {
    return x;
  }, weight: 100, } as SchemaWithWeight & {
    __brand: 'test';
  },
  nestedIntersection: {
    parse(x: unknown,) {
      return x;
    },
    weight: 100,
    metadata: { version: '1.0', },
  } as SchemaWithWeight & { metadata: { version: string; }; },

  // Invalid inputs - test runtime vs compile-time behavior
  notASchema: { notParse: 'oops', },
  definitelyNumber: 42,
  nullValue: null,
  undefinedValue: undefined,
  emptyObject: {},

  // Edge cases
  schemaWithWrongParse: { parse: 'not a function', weight: 100, },
  objectWithParse: {
    parse(x: unknown,): unknown {
      return x;
    },
    extraStuff: [
      1,
      2,
      3,
    ],
  },
  functionValue: (function parseIdentity(x: unknown,): unknown {
    return x;
  }) as ((x: unknown,) => unknown),
  conditionalSchema: ({ parse(x: unknown,) {
    return x;
  }, } as true extends true ? Schema : never),
};
//endregion Simplified Test Values

//region Simplified Behavioral Tests
/**
 * Tests all guard patterns against SchemaWithWeight for property preservation.
 */
const testSimplifiedSchemaWithWeight = (function testSimplifiedSchemaWithWeight(): void {
  /**
   * `SchemaWithWeight` instance under test; every guard pattern below narrows {@link value} to verify `weight` survives.
   */
  const value = simplifiedTestValues.schemaWithWeight;

  // Unknown guard
  if (isSchema_Unknown(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
  }

  // Generic guard
  if (isSchema_Generic(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
  }

  // Typed guard
  if (isSchema_Typed(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
  }

  // Generic extends guard
  if (isSchema_GenericExtends(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
  }
})();

/**
 * Tests all guard patterns against NamedSchema for name property preservation.
 */
const testSimplifiedNamedSchema = (function testSimplifiedNamedSchema(): void {
  /**
   * `NamedSchema` instance under test; each guard below should keep `name` accessible after narrowing.
   */
  const value = simplifiedTestValues.namedSchema;

  // Unknown guard
  if (isSchema_Unknown(value,)) {
    value.parse('test',);
    value.name; // Should preserve
  }

  // Generic guard
  if (isSchema_Generic(value,)) {
    value.parse('test',);
    value.name; // Should preserve
  }

  // Typed guard
  if (isSchema_Typed(value,)) {
    value.parse('test',);
    value.name; // Should preserve
  }

  // Generic extends guard
  if (isSchema_GenericExtends(value,)) {
    value.parse('test',);
    value.name; // Should preserve
  }
})();

/**
 * Tests all guard patterns against ComplexSchema for multi-property preservation.
 */
const testSimplifiedComplexSchema = (function testSimplifiedComplexSchema(): void {
  /**
   * `ComplexSchema` instance under test; verifies `weight`, `name`, and `version` all survive the four guards.
   */
  const value = simplifiedTestValues.complexSchema;

  // Unknown guard
  if (isSchema_Unknown(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }

  // Generic guard
  if (isSchema_Generic(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }

  // Typed guard
  if (isSchema_Typed(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }

  // Generic extends guard
  if (isSchema_GenericExtends(value,)) {
    value.parse('test',);
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }
})();

/**
 * Tests guard patterns against unknown-typed value for narrowing behavior.
 */
const testSimplifiedUnknownValue = (function testSimplifiedUnknownValue(): void {
  /**
   * Value cast to `unknown`; verifies the guards still narrow and that extra props collapse to errors.
   */
  const value = simplifiedTestValues.unknownValue;

  // Unknown guard
  if (isSchema_Unknown(value,)) {
    value.parse('test',);
    // @ts-expect-error; unknown input narrowed to Schema, weight property lost
    value.weight;
  }

  // Generic guard
  if (isSchema_Generic(value,)) {
    // @ts-expect-error; unknown creates never type in generic pattern
    value.parse('test',);
    // @ts-expect-error; unknown creates never type, no weight property
    value.weight;
  }

  // Typed guard (can't call without cast)
  // @ts-expect-error; unknown is not Schema
  isSchema_Typed(value,);

  // Generic extends guard (can't call without cast)
  // @ts-expect-error; unknown can't extend Schema
  isSchema_GenericExtends(value,);
})();

/**
 * Tests guard patterns against any-typed value for type preservation.
 */
const testSimplifiedAnyValue = (function testSimplifiedAnyValue(): void {
  /**
   * Value cast to `any`; demonstrates Generic patterns preserve `weight` better than Unknown/Typed for `any` sources.
   */
  const value = simplifiedTestValues.anyValue;

  // Unknown guard
  if (isSchema_Unknown(value,)) {
    value.parse('test',);
    // @ts-expect-error; any input gets narrowed to Schema, losing weight
    value.weight;
  }

  // Generic guard
  if (isSchema_Generic(value,)) {
    value.parse('test',);
    value.weight; // KEY: Generic preserves any better
  }

  // Typed guard
  if (isSchema_Typed(value,)) {
    value.parse('test',);
    // @ts-expect-error; any input gets narrowed to Schema, losing weight
    value.weight;
  }

  // Generic extends guard
  if (isSchema_GenericExtends(value,)) {
    value.parse('test',);
    value.weight; // KEY: Generic extends preserves any
  }
})();

/**
 * Tests guard patterns against union types for compile-time safety.
 */
const testSimplifiedUnionTypes = (function testSimplifiedUnionTypes(): void {
  // Union with string
  /**
   * `Schema | string` union extracted via destructuring; verifies each guard's behavior when a non-schema branch is present.
   */
  const { unionWithString, } = simplifiedTestValues;

  // Unknown guard - direct call
  if (isSchema_Unknown(unionWithString,))
    unionWithString.parse('test',); // Should narrow to Schema

  // Generic guard - direct call
  if (isSchema_Generic(unionWithString,))
    unionWithString.parse('test',); // Does generic handle union directly?

  // Typed guard - direct call (can't call)
  // @ts-expect-error; union type is not assignable to Schema
  isSchema_Typed(unionWithString,);

  // Generic extends guard - direct call (can't call)
  // @ts-expect-error; union type can't extend Schema
  isSchema_GenericExtends(unionWithString,);

  // Union with null
  /**
   * `Schema | null` union extracted via destructuring; tests narrowing when `null` is in the union.
   */
  const { unionWithNull, } = simplifiedTestValues;

  if (isSchema_Unknown(unionWithNull,)) {
    unionWithNull.parse('test',);
    // @ts-expect-error; union narrowing loses weight property
    unionWithNull.weight;
  }

  if (isSchema_Generic(unionWithNull,)) {
    unionWithNull.parse('test',);
    // @ts-expect-error; union narrowing loses weight property
    unionWithNull.weight;
  }
})();

/**
 * Tests guard patterns against intersection types for property preservation.
 */
const testSimplifiedIntersectionTypes =
  (function testSimplifiedIntersectionTypes(): void {
    /**
     * `Schema & { extraProp: boolean }` instance; checks each guard keeps the intersected extra property.
     */
    const intersectionValue = simplifiedTestValues.intersectionType;

    // Unknown guard
    if (isSchema_Unknown(intersectionValue,)) {
      intersectionValue.parse('test',);
      intersectionValue.extraProp; // Should preserve
    }

    // Generic guard
    if (isSchema_Generic(intersectionValue,)) {
      intersectionValue.parse('test',);
      intersectionValue.extraProp; // Should preserve
    }

    // Typed guard
    if (isSchema_Typed(intersectionValue,)) {
      intersectionValue.parse('test',);
      intersectionValue.extraProp; // Should preserve
    }

    // Generic extends guard
    if (isSchema_GenericExtends(intersectionValue,)) {
      intersectionValue.parse('test',);
      intersectionValue.extraProp; // Should preserve
    }
  })();

/**
 * Tests guard patterns against edge cases: invalid schemas, nulls, and untyped objects.
 */
const testSimplifiedEdgeCases = (function testSimplifiedEdgeCases(): void {
  // Invalid schemas
  /**
   * Object without `parse` extracted via destructuring; verifies Unknown false-positives and Generic correctly returns never.
   */
  const { notASchema, } = simplifiedTestValues;

  if (isSchema_Unknown(notASchema,))
    notASchema.parse('test',); // Type narrowed to Schema, but runtime fails

  if (isSchema_Generic(notASchema,)) {
    // @ts-expect-error; notASchema creates never type in generic
    notASchema.parse('test',);
  }

  // Null and undefined
  /**
   * `null` literal alias; verifies Unknown's narrowing never enters the body even though it type-checks.
   */
  const nullVal = simplifiedTestValues.nullValue;
  /**
   * `undefined` literal alias; mirrors {@link nullVal} for the `undefined` arm of the falsy edge cases.
   */
  const undefinedVal = simplifiedTestValues.undefinedValue;

  if (isSchema_Unknown(nullVal,))
    nullVal; // Never executes, but what type?

  if (isSchema_Unknown(undefinedVal,))
    undefinedVal; // Never executes, but what type?

  // Object with parse but not typed as Schema
  /**
   * Plain object that happens to carry `parse`; verifies Unknown and Generic both keep `extraStuff` after narrowing.
   */
  const objWithParse = simplifiedTestValues.objectWithParse;

  if (isSchema_Unknown(objWithParse,)) {
    objWithParse.parse('test',); // Should work
    objWithParse.extraStuff; // Preserved; Unknown pattern now retains original properties
  }

  if (isSchema_Generic(objWithParse,)) {
    objWithParse.parse('test',); // Should work
    objWithParse.extraStuff; // Should preserve - generic pattern advantage!
  }

  if (isSchema_Unknown(objWithParse,)) {
    objWithParse.parse('test',); // Should work
    objWithParse.extraStuff; // Should preserve - Unknown pattern behavior updated
  }
})();
//endregion Simplified Behavioral Tests

//region Simplified Analysis Matrix
/**
 * SIMPLIFIED SCHEMA BEHAVIORAL ANALYSIS MATRIX
 *
 * This matrix documents the behavior of all typeguard patterns against
 * simplified Schema types (parse: (unknown) => unknown).
 *
 * LEGEND:
 * 🎯 = Properties preserved correctly (ideal behavior)
 * 🔥 = Properties lost during narrowing (type information destroyed)
 * 🚫 = Compile-time rejection (requires explicit casting)
 * 💣 = False safety (compiles but runtime hazard)
 *
 * ┌─────────────────────┬─────────┬─────────┬───────┬────────────┐
 * │ Input Type          │ Unknown │ Generic │ Typed │ GenExtends │
 * ├─────────────────────┼─────────┼─────────┼───────┼────────────┤
 * │ schemaWithWeight    │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ namedSchema         │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ complexSchema       │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ unknownValue        │   🔥    │   🔥    │  🚫   │    🚫     │
 * │ anyValue            │   🔥    │   🎯    │  🔥   │     🎯     │
 * │ unionWithString     │   🎯    │   💣    │  🚫   │    🚫     │
 * │ unionWithNull       │   🔥    │   🔥    │  🚫   │    🚫     │
 * │ intersectionType    │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ brandedSchema       │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ nestedIntersection  │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ notASchema          │   💣    │   💣    │  🚫   │    🚫     │
 * │ nullValue           │   💣    │   💣    │  🚫   │    🚫     │
 * │ emptyObject         │   💣    │   💣    │  🚫   │    🚫     │
 * │ objectWithParse     │   🔥    │   🎯    │  🚫   │    🚫     │
 * └─────────────────────┴─────────┴─────────┴───────┴────────────┘
 *
 * KEY INSIGHTS FROM SIMPLIFIED TESTING:
 *
 * 1. **WELL-TYPED INPUTS**: All patterns preserve properties for properly typed schemas
 * 2. **ANY TYPE ADVANTAGE**: Generic patterns handle `any` better than Unknown/Typed
 * 3. **UNION CHALLENGES**: All patterns struggle with unions containing non-Schema types
 * 4. **COMPILE-TIME SAFETY**: Typed/GenExtends catch more errors but require casting
 * 5. **GENERIC PATTERN STRENGTH**: Better preservation of untyped object properties
 *
 * LIMITATIONS OF SIMPLIFIED TESTING:
 *
 * ⚠️  **INPUT/OUTPUT CONSTRAINTS**: Cannot test specific type transformations
 * ⚠️  **GENERIC INFERENCE**: No infer MyInput, infer MyOutput behavior testing
 * ⚠️  **ASYNC SUPPORT**: No Promisable<Output> or parseAsync testing
 * ⚠️  **REAL CONSTRAINTS**: Missing actual Schema<Input, Output> complexity
 *
 * This simplified analysis provides baseline understanding but is insufficient
 * for real-world typeguard decisions. See guard.genericsSchema.behaviorTest.ts
 * for comprehensive testing with actual generic Schema<Input, Output> constraints.
 */
//endregion Simplified Analysis Matrix

export {};
