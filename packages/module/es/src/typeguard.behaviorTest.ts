/**
 * Comprehensive test matrix: Every test value against every guard pattern
 * Tests 12 values × 4 guards = 48 combinations to reveal complete behavior
 */

//region Type Definitions
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
//endregion Type Definitions

//region Guard Patterns
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
//endregion Guard Patterns

//region Test Value Definitions
const testValues = {
  schemaWithWeight: { parse: (x: unknown) => x, weight: 100 } as SchemaWithWeight,
  namedSchema: { parse: (x: unknown) => x, name: 'test' } as NamedSchema,
  complexSchema: { 
    parse: (x: unknown) => x, 
    weight: 100, 
    name: 'complex', 
    version: 1 
  } as ComplexSchema,
  unknownValue: { parse: (x: unknown) => x, weight: 100 } as unknown,
  anyValue: { parse: (x: unknown) => x, weight: 100 } as any,
  unionWithString: ({ parse: (x: unknown) => x } as Schema | string),
  unionWithNull: ({ parse: (x: unknown) => x } as Schema | null),
  unionWithNumber: ({ parse: (x: unknown) => x } as Schema | number),
  intersectionType: { parse: (x: unknown) => x, extraProp: true } as Schema & { extraProp: boolean },
  brandedSchema: { parse: (x: unknown) => x, weight: 100 } as SchemaWithWeight & { __brand: 'test' },
  notASchema: { notParse: 'oops' },
  definitelyNumber: 42
};
//endregion Test Value Definitions

//region Test Matrix - Each Value Against All Guards
const testSchemaWithWeight = (function testSchemaWithWeight() {
  const value = testValues.schemaWithWeight;
  
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

const testNamedSchema = (function testNamedSchema() {
  const value = testValues.namedSchema;
  
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

const testComplexSchema = (function testComplexSchema() {
  const value = testValues.complexSchema;
  
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

const testUnknownValue = (function testUnknownValue() {
  const value = testValues.unknownValue;
  
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
  
  // Typed guard WITH cast
  if (isSchema_Typed(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- unknown remains unknown even after casting
    value.parse('test');
    // @ts-expect-error -- unknown remains unknown even after casting
    value.weight;
  }
  
  // Generic extends guard (can't call without cast)
  // @ts-expect-error -- unknown can't extend Schema
  isSchema_GenericExtends(value);
  
  // Generic extends guard WITH cast
  if (isSchema_GenericExtends(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- unknown remains unknown even after casting
    value.parse('test');
    // @ts-expect-error -- unknown remains unknown even after casting
    value.weight;
  }
})();

const testAnyValue = (function testAnyValue() {
  const value = testValues.anyValue;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    // @ts-expect-error -- any input gets narrowed to Schema, losing weight
    value.weight;
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.weight; // KEY: Does generic preserve any better?
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
    value.weight; // KEY: Does generic extends preserve any?
  }
})();

const testUnionWithString = (function testUnionWithString() {
  const value = testValues.unionWithString;
  
  // Unknown guard - direct call
  if (isSchema_Unknown(value)) {
    value.parse('test'); // Should narrow to Schema
  }
  
  // Generic guard - direct call (should work)
  if (isSchema_Generic(value)) {
    value.parse('test'); // Does generic handle union directly?
  }
  
  // Typed guard - direct call (can't call)
  // @ts-expect-error -- union type is not assignable to Schema
  isSchema_Typed(value);
  
  // Typed guard WITH cast
  if (isSchema_Typed(value as Schema & typeof value)) {
    // @ts-expect-error -- parse doesn't exist on string branch of union
    value.parse('test');
  }
  
  // Generic extends guard - direct call (can't call) 
  // @ts-expect-error -- union type can't extend Schema
  isSchema_GenericExtends(value);
  
  // Generic extends guard WITH cast
  if (isSchema_GenericExtends(value as Schema & typeof value)) {
    // @ts-expect-error -- parse doesn't exist on string branch of union
    value.parse('test');
  }
})();

const testUnionWithNull = (function testUnionWithNull() {
  const value = testValues.unionWithNull;
  
  // Unknown guard
  if (value && isSchema_Unknown(value)) {
    value.parse('test');
  }
  
  // Generic guard
  if (value && isSchema_Generic(value)) {
    value.parse('test');
  }
  
  // Typed guard
  if (value && isSchema_Typed(value)) {
    value.parse('test');
  }
  
  // Generic extends guard
  if (value && isSchema_GenericExtends(value)) {
    value.parse('test');
  }
})();

const testUnionWithNumber = (function testUnionWithNumber() {
  const value = testValues.unionWithNumber;
  
  // Unknown guard - direct call
  if (isSchema_Unknown(value)) {
    value.parse('test'); // Should narrow to Schema
  }
  
  // Generic guard - direct call
  if (isSchema_Generic(value)) {
    value.parse('test'); // Does generic handle union directly?
  }
  
  // Typed guard - direct call (can't call)
  // @ts-expect-error -- union type is not assignable to Schema
  isSchema_Typed(value);
  
  // Typed guard WITH cast
  if (isSchema_Typed(value as Schema & typeof value)) {
    // @ts-expect-error -- parse doesn't exist on number branch of union
    value.parse('test');
  }
  
  // Generic extends guard - direct call (can't call)
  // @ts-expect-error -- union type can't extend Schema
  isSchema_GenericExtends(value);
  
  // Generic extends guard WITH cast
  if (isSchema_GenericExtends(value as Schema & typeof value)) {
    // @ts-expect-error -- parse doesn't exist on number branch of union
    value.parse('test');
  }
})();

const testIntersectionType = (function testIntersectionType() {
  const value = testValues.intersectionType;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    // @ts-expect-error -- intersection narrowing loses weight property
    value.weight;
    value.extraProp; // Should preserve
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    // @ts-expect-error -- intersection narrowing loses weight property
    value.weight;
    value.extraProp; // Should preserve
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    // @ts-expect-error -- intersection narrowing loses weight property
    value.weight;
    value.extraProp; // Should preserve
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    // @ts-expect-error -- intersection narrowing loses weight property even with generic extends
    value.weight;
    value.extraProp; // Should preserve
  }
})();

const testBrandedSchema = (function testBrandedSchema() {
  const value = testValues.brandedSchema;
  
  // Unknown guard
  if (isSchema_Unknown(value)) {
    value.parse('test');
    value.weight; // Should preserve
    // value.__brand; // Brand preserved?
  }
  
  // Generic guard
  if (isSchema_Generic(value)) {
    value.parse('test');
    value.weight; // Should preserve
    // value.__brand; // Brand preserved?
  }
  
  // Typed guard
  if (isSchema_Typed(value)) {
    value.parse('test');
    value.weight; // Should preserve
    // value.__brand; // Brand preserved?
  }
  
  // Generic extends guard
  if (isSchema_GenericExtends(value)) {
    value.parse('test');
    value.weight; // Should preserve
    // value.__brand; // Brand preserved?
  }
})();

const testNotASchema = (function testNotASchema() {
  const value = testValues.notASchema;
  
  // Unknown guard (should compile, return false)
  if (isSchema_Unknown(value)) {
    value; // What type?
  }
  
  // Generic guard (should compile, return false)
  if (isSchema_Generic(value)) {
    value; // What type?
  }
  
  // Typed guard - direct call (should NOT compile)
  // @ts-expect-error -- Object without parse method is not Schema
  isSchema_Typed(value);
  
  // Typed guard WITH cast (should compile but fail at runtime)
  if (isSchema_Typed(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- value remains as original notASchema type
    value.parse('test');
  }
  
  // Generic extends guard - direct call (should NOT compile)
  // @ts-expect-error -- Object without parse method can't extend Schema
  isSchema_GenericExtends(value);
  
  // Generic extends guard WITH cast (should compile but fail at runtime)
  if (isSchema_GenericExtends(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- value remains as original notASchema type
    value.parse('test');
  }
})();

const testDefinitelyNumber = (function testDefinitelyNumber() {
  const value = testValues.definitelyNumber;
  
  // Unknown guard (should compile, return false)
  if (isSchema_Unknown(value)) {
    value; // What type?
  }
  
  // Generic guard (should compile, return false)
  if (isSchema_Generic(value)) {
    value; // What type?
  }
  
  // Typed guard - direct call (should NOT compile)
  // @ts-expect-error -- Number is not Schema
  isSchema_Typed(value);
  
  // Typed guard WITH cast (should compile but fail at runtime)
  if (isSchema_Typed(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- value remains as number type
    value.parse('test');
  }
  
  // Generic extends guard - direct call (should NOT compile)
  // @ts-expect-error -- Number can't extend Schema
  isSchema_GenericExtends(value);
  
  // Generic extends guard WITH cast (should compile but fail at runtime)
  if (isSchema_GenericExtends(value as unknown as Schema & typeof value)) {
    // @ts-expect-error -- value remains as number type
    value.parse('test');
  }
})();

const testEdgeCasesWithCasting = (function testEdgeCasesWithCasting() {
  // Unknown with double casting
  const unknownValue = testValues.unknownValue;
  
  if (isSchema_GenericExtends(unknownValue as unknown as Schema & typeof unknownValue)) {
    // @ts-expect-error -- unknown remains unknown even after casting and guard
    unknownValue.parse('test');
  }
  
  if (isSchema_Typed(unknownValue as unknown as Schema & typeof unknownValue)) {
    // @ts-expect-error -- unknown remains unknown even after casting and guard
    unknownValue.parse('test');
  }
  
  // Any with casting patterns
  const anyValue = testValues.anyValue;
  if (isSchema_GenericExtends(anyValue as Schema & typeof anyValue)) {
    anyValue.parse('test');
    anyValue.weight; // Does cast help any?
  }
  
  // Union casting patterns
  const unionValue = testValues.unionWithString;
  if (isSchema_Unknown(unionValue as Schema & typeof unionValue)) {
    // @ts-expect-error -- parse doesn't exist on string branch of union
    unionValue.parse('test');
    // @ts-expect-error -- weight doesn't exist on string branch of union
    unionValue.weight;
  }
})();
//endregion Test Matrix - Each Value Against All Guards

//region Analysis Matrix
/**
 * COMPLETE ANALYSIS MATRIX - Check IDE behavior for each combination:
 * 
 * ✅ = Property preserved
 * ❌ = Property lost (has @ts-expect-error)
 * 🚫 = Compile error (can't call)
 * 
 * | Value              | Unknown | Generic | Typed | GenExtends |
 * |--------------------|---------|---------|-------|------------|
 * | schemaWithWeight   |   ✅    |   ✅    |  ✅   |     ✅      |
 * | namedSchema        |   ✅    |   ✅    |  ✅   |     ✅      |
 * | complexSchema      |   ✅    |   ✅    |  ✅   |     ✅      |
 * | unknownValue       |   ❌    |   ❌    |  🚫   |    🚫      |
 * | anyValue           |   ❌    |   ✅    |  ❌   |     ✅      |
 * | unionWithString    |   ✅    |   ❌*   |  ❌*  |    ❌*     |
 * | unionWithNull      |   ✅    |   ✅    |  ✅   |     ✅      |
 * | unionWithNumber    |   ✅    |   ❌*   |  ❌*  |    ❌*     |
 * | intersectionType   |   ❌    |   ❌    |  ❌   |     ❌      |
 * | brandedSchema      |   ✅    |   ✅    |  ✅   |     ✅      |
 * | notASchema         |   ✅    |   ✅    |  🚫   |    🚫      |
 * | definitelyNumber   |   ✅    |   ✅    |  🚫   |    🚫      |
 * 
 * * = Requires casting, causes union access issues
 * 
 * KEY FINDINGS:
 * 1. Typed inputs (schemaWithWeight, namedSchema, etc.) preserve properties across ALL patterns
 * 2. unknown inputs lose properties with ALL patterns
 * 3. any inputs: Generic patterns preserve better than Unknown/Typed patterns
 * 4. Union types have access issues even with casting
 * 5. Intersection types lose original properties during narrowing
 * 6. Compile-time safety: Typed/GenericExtends catch wrong types, Unknown/Generic accept all
 */
//endregion Analysis Matrix