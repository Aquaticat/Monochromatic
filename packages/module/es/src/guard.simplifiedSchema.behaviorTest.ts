/**
 * Simplified Schema typeguard behavioral test matrix
 * 
 * Tests different typeguard implementation patterns against simplified Schema types
 * to establish baseline behavioral understanding before moving to complex generics.
 * 
 * This is a BEHAVIORAL TEST FILE - not unit tests. All code demonstrates compile-time
 * and runtime behavior through TypeScript type checking and intentional @ts-expect-error markers.
 */

//region Simplified Type Definitions
type Schema = {
  readonly parse: (value: unknown) => unknown;
};

type SchemaWithWeight = Schema & {
  readonly weight: number;
};

type NamedSchema = Schema & { 
  readonly name: string; 
};

type ComplexSchema = SchemaWithWeight & { 
  readonly name: string; 
  readonly version: number; 
};
//endregion Simplified Type Definitions

//region Simplified Guard Patterns  
export function isSchema_Unknown(value: unknown): value is Schema {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}

export function isSchema_Generic<const MyValue = unknown>(
  value: MyValue,
): value is MyValue extends Schema 
  ? (MyValue & Schema) 
  : never {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof (value as any).parse === 'function';
}

export function isSchema_Typed(value: Schema): value is Schema {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}

export function isSchema_GenericExtends<const T extends Schema = Schema>(
  value: T
): value is T {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}
//endregion Simplified Guard Patterns

//region Simplified Test Values
const simplifiedTestValues = {
  // Properly typed schemas - should preserve properties
  schemaWithWeight: { parse: (x: unknown) => x, weight: 100 } as SchemaWithWeight,
  namedSchema: { parse: (x: unknown) => x, name: 'test' } as NamedSchema,
  complexSchema: { 
    parse: (x: unknown) => x, 
    weight: 100, 
    name: 'complex', 
    version: 1 
  } as ComplexSchema,
  
  // Loosely typed - test type narrowing behavior
  unknownValue: { parse: (x: unknown) => x, weight: 100 } as unknown,
  anyValue: { parse: (x: unknown) => x, weight: 100 } as any,
  
  // Union types - test compile-time safety and narrowing
  unionWithString: ({ parse: (x: unknown) => x } as Schema | string),
  unionWithNull: ({ parse: (x: unknown) => x } as Schema | null),
  unionWithNumber: ({ parse: (x: unknown) => x } as Schema | number),
  unionThreeWay: ({ parse: (x: unknown) => x, weight: 50 } as Schema | string | number),
  
  // Complex type combinations
  intersectionType: { parse: (x: unknown) => x, extraProp: true } as Schema & { extraProp: boolean },
  brandedSchema: { parse: (x: unknown) => x, weight: 100 } as SchemaWithWeight & { __brand: 'test' },
  nestedIntersection: { 
    parse: (x: unknown) => x, 
    weight: 100, 
    metadata: { version: '1.0' }
  } as SchemaWithWeight & { metadata: { version: string } },
  
  // Invalid inputs - test runtime vs compile-time behavior
  notASchema: { notParse: 'oops' },
  definitelyNumber: 42,
  nullValue: null as null,
  undefinedValue: undefined,
  emptyObject: {},
  
  // Edge cases
  schemaWithWrongParse: { parse: 'not a function', weight: 100 },
  objectWithParse: { parse: (x: unknown) => x, extraStuff: [1, 2, 3] },
  functionValue: ((x: unknown) => x) as ((x: unknown) => unknown),
  conditionalSchema: ({ parse: (x: unknown) => x } as true extends true ? Schema : never),
};
//endregion Simplified Test Values

//region Simplified Behavioral Tests
const testSimplifiedSchemaWithWeight = (function() {
  const value = simplifiedTestValues.schemaWithWeight;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    value.weight; // Should preserve
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.weight; // Should preserve
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    value.weight; // Should preserve
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    value.weight; // Should preserve
  }
})();

const testSimplifiedNamedSchema = (function() {
  const value = simplifiedTestValues.namedSchema;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    value.name; // Should preserve
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.name; // Should preserve
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    value.name; // Should preserve
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    value.name; // Should preserve
  }
})();

const testSimplifiedComplexSchema = (function() {
  const value = simplifiedTestValues.complexSchema;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    value.weight; // Should preserve
    value.name; // Should preserve
    value.version; // Should preserve
  }
})();

const testSimplifiedUnknownValue = (function() {
  const value = simplifiedTestValues.unknownValue;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    // @ts-expect-error -- unknown input narrowed to Schema, weight property lost
    value.weight;
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    // @ts-expect-error -- unknown creates never type in generic pattern
    value.parse('test');
    // @ts-expect-error -- unknown creates never type, no weight property
    value.weight;
  }
  
  // Typed guard (can't call without cast)
  // @ts-expect-error -- unknown is not Schema
  isSchema_Typed(value);
  
  // Generic extends guard (can't call without cast)
  // @ts-expect-error -- unknown can't extend Schema
  isSchema_GenericExtends(value);
})();

const testSimplifiedAnyValue = (function() {
  const value = simplifiedTestValues.anyValue;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    // @ts-expect-error -- any input gets narrowed to Schema, losing weight
    value.weight;
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.weight; // KEY: Generic preserves any better
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    // @ts-expect-error -- any input gets narrowed to Schema, losing weight
    value.weight;
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    value.weight; // KEY: Generic extends preserves any
  }
})();

const testSimplifiedUnionTypes = (function() {
  // Union with string
  const unionWithString = simplifiedTestValues.unionWithString;
  
  // Unknown guard - direct call
  if (isSchema_Unknown(unionWithString)) {
    unionWithString.parse('test'); // Should narrow to Schema
  }
  
  // Generic guard - direct call
  if (isSchema_Generic(unionWithString)) {
    unionWithString.parse('test'); // Does generic handle union directly?
  }
  
  // Typed guard - direct call (can't call)
  // @ts-expect-error -- union type is not assignable to Schema
  isSchema_Typed(unionWithString);
  
  // Generic extends guard - direct call (can't call) 
  // @ts-expect-error -- union type can't extend Schema
  isSchema_GenericExtends(unionWithString);
  
  // Union with null
  const unionWithNull = simplifiedTestValues.unionWithNull;
  
  if (isSchema_Unknown(unionWithNull)) {
    unionWithNull.parse('test');
    // @ts-expect-error -- union narrowing loses weight property  
    unionWithNull.weight;
  }
  
  if (isSchema_Generic(unionWithNull)) {
    unionWithNull.parse('test');
    // @ts-expect-error -- union narrowing loses weight property
    unionWithNull.weight;
  }
})();

const testSimplifiedIntersectionTypes = (function() {
  const intersectionValue = simplifiedTestValues.intersectionType;
  
  // Unknown guard
  if (isSchema_Unknown(intersectionValue)) {
    intersectionValue.parse('test');
    intersectionValue.extraProp; // Should preserve
  }
  
  // Generic guard
  if (isSchema_Generic(intersectionValue)) {
    intersectionValue.parse('test');
    intersectionValue.extraProp; // Should preserve
  }
  
  // Typed guard
  if (isSchema_Typed(intersectionValue)) {
    intersectionValue.parse('test');
    intersectionValue.extraProp; // Should preserve
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(intersectionValue)) {
    intersectionValue.parse('test');
    intersectionValue.extraProp; // Should preserve
  }
})();

const testSimplifiedEdgeCases = (function() {
  // Invalid schemas
  const notASchema = simplifiedTestValues.notASchema;
  
  if (isSchema_Unknown(notASchema)) {
    notASchema.parse('test'); // Type narrowed to Schema, but runtime fails
  }
  
  if (isSchema_Generic(notASchema)) {
    // @ts-expect-error -- notASchema creates never type in generic
    notASchema.parse('test');
  }
  
  // Null and undefined
  const nullVal = simplifiedTestValues.nullValue;
  const undefinedVal = simplifiedTestValues.undefinedValue;
  
  if (isSchema_Unknown(nullVal)) {
    nullVal; // Never executes, but what type?
  }
  
  if (isSchema_Unknown(undefinedVal)) {
    undefinedVal; // Never executes, but what type?
  }
  
  // Object with parse but not typed as Schema
  const objWithParse = simplifiedTestValues.objectWithParse;
  
  if (isSchema_Unknown(objWithParse)) {
    objWithParse.parse('test'); // Should work
    // @ts-expect-error -- extraStuff lost during narrowing to Schema type
    objWithParse.extraStuff;
  }
  
  if (isSchema_Generic(objWithParse)) {
    objWithParse.parse('test'); // Should work  
    objWithParse.extraStuff; // Should preserve - generic pattern advantage!
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
 * │ nestedIntersection  │   🎯    │   🎯    │  🎯   │     🎯     │
 * │ brandedSchema       │   🎯    │   🎯    │  🎯   │     🎯     │
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