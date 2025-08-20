# TODO: Refactor Typeguards for Compile-Time Safety

## Objective
Refactor all typeguards from accepting `unknown` to requiring the expected type, providing compile-time safety by catching obvious type mismatches during development.

## Rationale
While the industry standard is to use `value: unknown` for typeguards, and TypeScript already preserves type information through intersection types (e.g., `SchemaWithWeight` becomes `SchemaWithWeight & Schema` after guard), we can achieve better compile-time safety by requiring type compatibility upfront.

### Key Discovery
Through testing, we found that TypeScript's control flow analysis already preserves the original type with ALL patterns - the narrowed type becomes an intersection of the original type and the guard's predicate type. So type preservation is NOT a concern.

### The Real Trade-off
**Safety vs Flexibility:**
- **Typed/Generic patterns**: Catch obvious mistakes at compile time, but require explicit casts for union types and unknown data
- **`unknown` pattern**: Accepts anything without compile errors, validates at runtime only

Our choice: Prioritize compile-time safety to catch errors early.

## Current Pattern (to be replaced)
```typescript
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Problem: No compile-time error for obvious mistakes
isString(42); // Silently returns false, no IDE feedback
isString({ notString: true }); // No error, just returns false

// Note: TypeScript DOES preserve type information (discovered through testing)
const valueWithExtra = "hello" as string & { brand: "greeting" };
if (isString(valueWithExtra)) {
  // valueWithExtra is actually string & { brand: "greeting" }
  // NOT just string - intersection types preserve properties!
}
```

## New Pattern (to implement)
```typescript
// Simple approach - just require the expected type
export function isString(value: string): value is string {
  return typeof value === 'string';
}

// Alternative with generics for literal type preservation
export function isString<const T extends string = string>(
  value: T
): value is T {
  return typeof value === 'string';
}

// Benefit: Compile-time errors for obvious mistakes
isString(42); // ❌ IDE error - immediate feedback
isString("hello"); // ✅ Works, validates runtime type matches compile-time type

// TypeScript automatically preserves additional properties through intersections
const brandedString = "hello" as string & { brand: "greeting" };
if (isString(brandedString)) {
  // brandedString remains string & { brand: "greeting" }
  // Intersection types work automatically!
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
- [ ] `schema.basic.ts` - Refactor to refined generic pattern

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

## Implementation Guidelines

### Basic Types
```typescript
// Before
export function isNumber(value: unknown): value is number

// After  
export function isNumber(value: number): value is number
```

### Complex Types
```typescript
// Before
export function isError(value: unknown): value is Error

// After
export function isError(value: Error): value is Error
```

### Collections
```typescript
// Before
export function isMap(value: unknown): value is Map<unknown, unknown>

// After
export function isMap(value: Map<unknown, unknown>): value is Map<unknown, unknown>
```

### Generic Types (Schemas)
```typescript
// Before
export function isSchema<const MyValue = unknown>(
  value: MyValue,
): value is MyValue extends Schema<infer I, infer O> ? (MyValue & Schema<I, O>) : never

// After
export function isSchema(value: Schema): value is Schema
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

## Migration Strategy
1. Start with simple type guards (Priority 1)
2. Update tests to use new casting patterns
3. Ensure no breaking changes to runtime behavior
4. Document the pattern in CLAUDE.md for consistency

## Benefits
- **Compile-time safety**: Catches type errors during development
- **Explicit intent**: Forces developers to be clear about validating untrusted data
- **Better IDE experience**: Immediate feedback on incorrect usage
- **Type preservation**: Maintains type information through narrowing

## Notes
- This approach is unconventional but provides maximum safety
- The double cast pattern `as unknown as Type & typeof value` clearly signals untrusted data validation
- The single cast pattern `as Type & typeof value` preserves union type information for narrowing
- TypeScript will suggest "convert to unknown first" when types don't overlap, guiding developers

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
- [ ] `schema.basic.ts` - Already uses generic pattern ✅

## Testing Considerations
- Ensure all existing tests pass after refactoring
- Add tests that verify compile-time type narrowing works correctly
- Test that the generic parameter properly defaults to `unknown`

## Migration Strategy
1. Start with simple type guards (Priority 1)
2. Update tests alongside each refactor
3. Ensure no breaking changes to public API behavior
4. Document the pattern in CLAUDE.md for consistency

## Benefits
- **Compile-time safety**: Catches type errors during development
- **Better IDE experience**: Immediate feedback on incorrect usage
- **Intentional casting**: Forces developers to be explicit when checking values that definitely aren't the target type
- **Type preservation**: Maintains more specific type information through narrowing

## Notes
- This approach is more sophisticated than industry standard but provides better developer experience
- The slight verbosity when explicit casting is needed is a feature, not a bug - it shows intent
- No hybrid approach - consistency across all typeguards