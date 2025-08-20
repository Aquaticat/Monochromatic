/**
 * Test file to verify typeguard behavior with additional properties
 */

// Test type definitions
type Schema = {
  readonly parse: (value: unknown) => unknown;
};

type SchemaWithWeight = Schema & {
  readonly weight: number;
};

// Pattern 1: Traditional unknown typeguard
export function isSchema_Unknown(value: unknown): value is Schema {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}

// Pattern 2: Generic with type preservation (simplified without Schema generics)
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

// Pattern 3: Simple typed parameter
export function isSchema_Typed(value: Schema): value is Schema {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}

// Pattern 4: Generic with extends constraint
export function isSchema_GenericExtends<const T extends Schema = Schema>(
  value: T
): value is T & Schema {
  if (value === null) return false;
  if (typeof value !== 'object') return false;
  if (!('parse' in value)) return false;
  return typeof value.parse === 'function';
}

// Test scenarios
function testScenarios(): void {
  const schemaWithWeight: SchemaWithWeight = {
    parse: (x) => x,
    weight: 100,
  };

  const notASchema = { notParse: 'oops' };
  const definitelyNumber = 42;
  
  // Union types for narrowing tests
  const unionWithSchema: SchemaWithWeight | string = Math.random() > 0.5 ? schemaWithWeight : "not a schema";
  const unionWithNull: Schema | null = Math.random() > 0.5 ? schemaWithWeight : null;
  const unionMultiple: Schema | number | { other: string } = schemaWithWeight;

  // === Test 1: Unknown pattern ===
  
  // Happy path - already typed as SchemaWithWeight
  if (isSchema_Unknown(schemaWithWeight)) {
    // Hover over schemaWithWeight - what type is it?
    schemaWithWeight.parse('test'); // ✅ Works
    schemaWithWeight.weight; // Does this work? Check IDE hover
  }

  // Failure case - not a schema
  if (isSchema_Unknown(notASchema)) {
    // This should fail at runtime but no compile error
    notASchema; // What type shows here?
  }

  // Obvious wrong type
  if (isSchema_Unknown(definitelyNumber)) {
    // No compile error with unknown! Just returns false at runtime
    definitelyNumber; // Still number
  }

  // Union narrowing
  if (isSchema_Unknown(unionWithSchema)) {
    // Should narrow from SchemaWithWeight | string to just Schema
    unionWithSchema.parse('test');
    // unionWithSchema.weight; // Does this work? Probably not!
  }

  // === Test 2: Generic pattern (current) ===
  
  // Happy path
  if (isSchema_Generic(schemaWithWeight)) {
    schemaWithWeight.parse('test'); // ✅ Works
    schemaWithWeight.weight; // Does this work? Check IDE hover
  }

  // Failure case - should get compile error?
  // isSchema_Generic(notASchema); // Uncomment to see if error
  // isSchema_Generic(definitelyNumber); // Uncomment to see if error

  // Union narrowing - needs cast
  if (isSchema_Generic(unionWithSchema as Schema & typeof unionWithSchema)) {
    unionWithSchema.parse('test');
    // What's the type here?
  }

  // === Test 3: Simple typed ===
  
  // Happy path
  if (isSchema_Typed(schemaWithWeight)) {
    schemaWithWeight.parse('test'); // ✅ Works
    schemaWithWeight.weight; // Does this work? Check IDE hover
  }

  // Failure cases - should get compile errors
  // isSchema_Typed(notASchema); // Uncomment - should error!
  // isSchema_Typed(definitelyNumber); // Uncomment - should error!
  
  // Union narrowing - needs cast
  if (isSchema_Typed(unionWithSchema as Schema & typeof unionWithSchema)) {
    unionWithSchema.parse('test');
    // What type is unionWithSchema here?
  }

  // === Test 4: Generic with extends ===
  
  // Happy path
  if (isSchema_GenericExtends(schemaWithWeight)) {
    schemaWithWeight.parse('test'); // ✅ Works  
    schemaWithWeight.weight; // Does this work? Check IDE hover
  }

  // Failure cases - should get compile errors
  // isSchema_GenericExtends(notASchema); // Uncomment - should error!
  // isSchema_GenericExtends(definitelyNumber); // Uncomment - should error!

  // Union narrowing - needs cast
  if (isSchema_GenericExtends(unionWithSchema as Schema & typeof unionWithSchema)) {
    unionWithSchema.parse('test');
    // Type should preserve weight if it was SchemaWithWeight
  }

  // === Test with null checks ===
  
  if (unionWithNull && isSchema_Unknown(unionWithNull)) {
    unionWithNull.parse('test'); // Works
    // Type of unionWithNull here? Schema
  }

  if (unionWithNull && isSchema_GenericExtends(unionWithNull)) {
    unionWithNull.parse('test');
    // Type here?
  }

  // === Test with unknown data ===
  const unknownData: unknown = schemaWithWeight;
  
  if (isSchema_Unknown(unknownData)) {
    unknownData.parse('test'); // Works
    // Type should be Schema
    // unknownData.weight; // Should NOT work - doesn't exist on Schema
  }

  // With generic - needs double cast for unknown
  if (isSchema_GenericExtends(unknownData as unknown as Schema & typeof unknownData)) {
    unknownData.parse('test');
    // What type?
  }

  // === Test where additional properties matter ===
  const processSchema = (s: SchemaWithWeight) => {
    // Need access to both parse and weight
    if (isSchema_Unknown(s)) {
      s.parse('test');
      console.log(s.weight); // Does this still work after the guard?
    }

    if (isSchema_GenericExtends(s)) {
      s.parse('test');
      console.log(s.weight); // Does this still work after the guard?
    }
  };

  // === Test with complex union ===
  if (typeof unionMultiple !== 'number' && 'parse' in unionMultiple) {
    // Manual narrowing first
    if (isSchema_Unknown(unionMultiple)) {
      unionMultiple.parse('test');
      // Type here?
    }
  }
}

// Another test with a different shape
type NamedSchema = Schema & { name: string };

function testNamed(): void {
  const named: NamedSchema = {
    parse: (x) => x,
    name: 'MySchema'
  };

  // After traditional guard
  if (isSchema_Unknown(named)) {
    // Hover over 'named' - is it Schema or NamedSchema?
    named.parse('test');
    named.name; // Check if this works
  }

  // After generic guard  
  if (isSchema_GenericExtends(named)) {
    // Hover over 'named' - is it NamedSchema & Schema?
    named.parse('test');
    named.name; // Check if this works
  }
}