# TODO: Refactor Typeguards for Type Preservation and Compile-Time Safety

## Status: CONFIRMED BENEFIT - Type Preservation IS Affected by Input Type

## Objective
Refactor typeguards from accepting `unknown` to using generic patterns that preserve original type information.

## Definitive Discovery
Through comprehensive testing with `@ts-expect-error` patterns, we found the complete truth:

### **Input Type Determines Type Preservation:**
- **`unknown`/`any` inputs**: Lose original properties, narrow to predicate type only
- **Typed inputs**: Preserve original properties through intersection types
- **The typeguard pattern itself**: Less important than input type

### **Evidence from Tests:**
**Properties LOST (need `@ts-expect-error`):**
- `any` → `Schema` loses `weight` property (lines 211, 217)
- `unknown` casting issues (lines 179, 185, 187)
- Intersection narrowing can lose properties (line 253)

**Properties PRESERVED (no `@ts-expect-error` needed):**
- `SchemaWithWeight` → `SchemaWithWeight & Schema` keeps `weight` (lines 71, 79, 86, 240, 245)
- Generic patterns preserve `any` flexibility better (line 223)
- Complex intersections work with typed inputs (lines 276-284)

## The Real Problem
The industry standard `value: unknown` pattern **loses type information** when validating already-typed values:

```typescript
const schemaWithWeight: SchemaWithWeight = { parse: (x) => x, weight: 100 };

// WRONG: loses weight property
if (isSchema(schemaWithWeight as unknown)) {
  schemaWithWeight.weight; // ❌ Error - narrowed to just Schema
}

// RIGHT: preserves weight property  
if (isSchema(schemaWithWeight)) {
  schemaWithWeight.weight; // ✅ Works - intersection SchemaWithWeight & Schema
}
```

## Solution: Generic Pattern with Type Preservation
```typescript
export function isSchema<const T extends Schema = Schema>(
  value: T
): value is T {
  return /* validation logic */;
}
```

### Benefits:
1. **Type preservation**: Maintains original properties for typed inputs
2. **Compile-time safety**: Errors on obvious mistakes like `isSchema(42)`
3. **Explicit intent**: Requires casting for `unknown` data validation
4. **Flexibility**: Works with union types, branded types, complex intersections

## Current Pattern (loses type information)
```typescript
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Problem: Casting to unknown loses properties
const valueWithExtra = "hello" as string & { brand: "greeting" };
if (isString(valueWithExtra as unknown)) {
  valueWithExtra.brand; // ❌ Error - lost during unknown casting + narrowing
}

// Works only if you don't cast to unknown
if (isString(valueWithExtra)) {
  valueWithExtra.brand; // ✅ Works - but requires TypeScript to accept mismatch
}
```

## New Pattern (preserves types + compile-time safety)
```typescript
export function isString<const T extends string = string>(
  value: T
): value is T {
  return typeof value === 'string';
}

// Benefits:
isString(42); // ❌ Compile error - immediate feedback
isString("hello"); // ✅ Works

// Type preservation for typed inputs
const brandedString = "hello" as string & { brand: "greeting" };
if (isString(brandedString)) {
  brandedString.brand; // ✅ Preserved - T maintains original type
}

// Explicit intent for unknown data
const untrusted: unknown = getData();
if (isString(untrusted as unknown as string & typeof untrusted)) {
  // Clear intent: validating potentially unsafe data
}
```

## Usage Patterns

### For Narrowing Union Types
```typescript
let potentiallyString: string | number;

// Cast preserves original type for narrowing
if (isString(potentiallyString as string & typeof potentiallyString)) {
  // potentiallyString is now narrowed to string
}
```

### For Validating Untrusted Data
```typescript
// Parsing JSON or reading files
const content = JSON.parse(await readFile('untrusted.json', 'utf8'));

// Double cast shows clear intent: treating unknown as potentially the type
if (isString(content as unknown as string & typeof content)) {
  // content is validated and typed as string
}
```

### For Known Values (Compile-Time Check)
```typescript
const definitelyString = "hello";
isString(definitelyString); // ✅ Works, runtime validation

const definitelyNotString = 42;
isString(definitelyNotString); // ❌ Compile error: Type 'number' has no overlap with 'string'
// Error suggests: "Convert to unknown first if intentional"
```

### For Objects with Additional Properties
```typescript
const schemaWithWeight = { 
  parse: (x) => x,
  weight: 100 
};

// After guard, weight property is still accessible
if (isSchema(schemaWithWeight)) {
  console.log(schemaWithWeight.weight); // ✅ Still has weight property!
}
```

## Implementation Guidelines

### Basic Types
```typescript
// Before
export function isNumber(value: unknown): value is number

// After - Simple approach (recommended)
export function isNumber(value: number): value is number

// After - With generic for literal preservation (optional)
export function isNumber<const T extends number = number>(
  value: T
): value is T
```

### Complex Types
```typescript
// Before
export function isError(value: unknown): value is Error

// After - Simple approach (recommended)
export function isError(value: Error): value is Error

// After - With generic (optional)
export function isError<const T extends Error = Error>(
  value: T
): value is T
```

### Collections
```typescript
// Before
export function isMap(value: unknown): value is Map<unknown, unknown>

// After - Simple approach (recommended)
export function isMap(value: Map<any, any>): value is Map<unknown, unknown>

// After - With generic (optional)
export function isMap<const T extends Map<any, any> = Map<unknown, unknown>>(
  value: T
): value is T & Map<unknown, unknown>
```

### Generic Types (Schemas)
```typescript
// Before (accepts unknown)
export function isSchema<const MyValue = unknown>(
  value: MyValue,
): value is MyValue extends Schema<infer I, infer O> ? (MyValue & Schema<I, O>) : never

// After - Simple approach (recommended)
export function isSchema(value: Schema): value is Schema

// After - With generic for subtypes (optional)
export function isSchema<const T extends Schema = Schema>(
  value: T
): value is T
```

## Files to Refactor

### Priority 1 - Basic Type Guards
- [ ] `string.is.ts` - `isString`
- [ ] `numeric.bigint.ts` - `isBigint`, `isNumeric`
- [ ] `numeric.int.ts` - `isPositiveInt`, `isNegativeInt`, `isNonNegativeInt`
- [ ] `numeric.date.ts` - `isObjectDate`
- [ ] `object.is.ts` - `isObject`
- [ ] `array.empty.ts` - `isEmptyArray`
- [ ] `error.is.ts` - `isError`

### Priority 2 - Collection Type Guards
- [ ] `map.is.ts` - `isMap`
- [ ] `set.is.ts` - `isSet`, `isWeakSet`
- [ ] `promise.is.ts` - `isPromise`
- [ ] `iterable.is.ts` - `isIterable`
- [ ] `generator.is.ts` - `isGenerator`, `isAsyncGenerator`

### Priority 3 - String Validators
- [ ] `string.digits.ts` - `isDigitString`, `isNo0DigitString`, `isDigitsString`
- [ ] `string.letters.ts` - Letter validation functions
- [ ] `string.numbers.ts` - All numeric string validators

### Priority 4 - Complex Types
- [ ] `jsonl.basic.ts` - `isJsonl`
- [ ] `function.is.ts` - `isAsyncFunction`, `isSyncFunction`
- [ ] `schema.basic.ts` - Refactor to new pattern

## Testing Considerations
- Ensure all existing tests pass after refactoring
- Update tests to use proper casting patterns
- Test that compile-time errors occur for obvious type mismatches
- Verify narrowing works correctly with union types
- Confirm that TypeScript's automatic type preservation through intersection types is working

## Migration Strategy
1. Start with simple type guards (Priority 1)
2. Update tests to use proper casting patterns
3. Ensure no breaking changes to runtime behavior
4. Document the pattern in CLAUDE.md for consistency

## Benefits
- **Compile-time safety**: Catches type errors during development (main benefit)
- **Explicit intent**: Forces developers to be clear about validating untrusted data
- **Better IDE experience**: Immediate feedback on incorrect usage
- **Type safety**: TypeScript will suggest "convert to unknown first" when types don't overlap

## Notes
- TypeScript automatically preserves type information through intersection types (discovered through testing)
- The approach trades flexibility for safety - requires explicit casts for union types and unknown data
- The double cast pattern `as unknown as Type & typeof value` clearly signals untrusted data validation
- The single cast pattern `as Type & typeof value` preserves union type information for narrowing
- Simple non-generic approach is recommended for most cases, with generics as optional for literal type preservation