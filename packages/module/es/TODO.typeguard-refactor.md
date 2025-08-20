# TODO: Refactor Typeguards to Use Generic Pattern with Type Preservation

## Objective
Refactor all typeguards from accepting `unknown` to using a generic pattern that preserves the original type while providing compile-time safety.

## Rationale
While the industry standard is to use `value: unknown` for typeguards, our generic approach provides:
1. Compile-time safety by requiring type compatibility
2. Type preservation - additional properties aren't lost during narrowing
3. Explicit intent when validating untrusted data

## Current Pattern (to be replaced)
```typescript
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

// Problem 1: No compile-time error for obvious mistakes
isString(42); // Silently returns false, no IDE feedback

// Problem 2: Loses type information
const valueWithExtra = { toString: () => "hello" };
if (isString(valueWithExtra)) {
  // valueWithExtra is just 'string', lost the object info
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

// After  
export function isNumber<const MyValue extends number = number>(
  value: MyValue
): value is MyValue & number
```

### Complex Types
```typescript
// Before
export function isError(value: unknown): value is Error

// After
export function isError<const MyValue extends Error = Error>(
  value: MyValue
): value is MyValue & Error
```

### Collections
```typescript
// Before
export function isMap(value: unknown): value is Map<unknown, unknown>

// After
export function isMap<const MyValue extends Map<any, any> = Map<unknown, unknown>>(
  value: MyValue
): value is MyValue & Map<unknown, unknown>
```

### Generic Types (Schemas)
```typescript
// Before (current generic pattern)
export function isSchema<const MyValue = unknown>(
  value: MyValue,
): value is MyValue extends Schema<infer I, infer O> ? (MyValue & Schema<I, O>) : never

// After (refined generic pattern)
export function isSchema<const MySchema extends Schema = Schema>(
  value: MySchema
): value is MySchema & Schema
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
- **Test that additional properties are preserved after type guard**

## Migration Strategy
1. Start with simple type guards (Priority 1)
2. Update tests to use new casting patterns
3. Ensure no breaking changes to runtime behavior
4. Verify type preservation works correctly
5. Document the pattern in CLAUDE.md for consistency

## Benefits
- **Compile-time safety**: Catches type errors during development
- **Type preservation**: Additional properties aren't lost during narrowing
- **Explicit intent**: Forces developers to be clear about validating untrusted data
- **Better IDE experience**: Immediate feedback on incorrect usage
- **Composability**: Works well with intersection types and branded types

## Notes
- This approach is more sophisticated than industry standard but provides better safety and flexibility
- The double cast pattern `as unknown as Type & typeof value` clearly signals untrusted data validation
- The single cast pattern `as Type & typeof value` preserves union type information for narrowing
- TypeScript will suggest "convert to unknown first" when types don't overlap, guiding developers
- The generic constraint ensures compile-time type compatibility while preserving runtime type information

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