# Types Directory Organization System

A sophisticated hierarchical organization system for TypeScript utilities, built around **return types** with fine-grained categorization and constraint specification.

## Table of Contents

- [Quick Reference Guide](#quick-reference-guide)
- [Organizational Principles](#organizational-principles)
- [Concrete Examples](#concrete-examples)
- [Directory Tree Structure](#directory-tree-structure)
- [Path Resolution Examples](#path-resolution-examples)
- [Navigation Guide](#navigation-guide)
- [Developer Guidelines](#developer-guidelines)
- [Migration Reference](#migration-reference)
- [Best Practices](#best-practices)
- [Troubleshooting Guide](#troubleshooting-guide)
- [Benefits](#benefits)
- [Implementation Status](#implementation-status)

## Quick Reference Guide

### Common Use Cases

**"I need to..."**

| Use Case | Path Pattern | Example |
|----------|--------------|---------|
| Check if value is string | `type boolean/type is/type param string/from/type unknown/` | [`import { $ as isString }`](type%20boolean/type%20is/type%20param%20string/from/type%20unknown/restriction%20sync/params%20positional/index.ts) |
| Convert any value to export string | `type string/from/type any/export/` | [`import { $ as toExport }`](type%20string/from/type%20any/export/restriction%20sync/params%20positional/index.ts) |
| Generate UUID | `type string/type uuid/from/type never/random/` | [`import { $ as randomUUID }`](type%20string/type%20uuid/from/type%20never/random/restriction%20sync/params%20positional/index.ts) |
| Convert iterable to array | `type object/type array/from/type iterable/` | [`import { $ as iterableToArray }`](type%20object/type%20array/from/type%20iterable/restriction%20sync/params%20positional/index.ts) |
| Generate number sequence | `type function/type generator/type param number/from/type number/range/` | [`import { $ as rangeGenerator }`](<type function/type generator/type param number/from/type number/range/restriction sync/params positional/index.ts>) |
| Join string array | `type string/from/type array/type param string/concat/` | [`import { $ as arrayConcat }`](type%20string/from/type%20array/type%20param%20string/concat/restriction%20sync/params%20positional/index.ts) |

### Type-Based Lookup

| Return Type | Base Path | Common Operations |
|-------------|-----------|-------------------|
| `string` | [`type string/`](type%20string/) | from any, from array, concat, transform |
| `boolean` | [`type boolean/`](type%20boolean/) | type guards (is), validation, comparison |
| `Array<T>` | [`type object/type array/`](type%20object/type%20array/) | from iterable, from range, transformation |
| `Generator<T>` | [`type function/type generator/`](type%20function/type%20generator/) | ranges, sequences, lazy iteration |

### Operation-Based Lookup

| Operation | Pattern | Examples |
|-----------|---------|----------|
| Type guards | `type boolean/type is/type param {type}/from/type unknown/` | string, number, object checks |
| Conversions | `type {output}/from/type {input}/` | any to string, iterable to array |
| Generators | `type function/type generator/type param {type}/from/` | ranges, sequences |
| Exports | `type string/from/type any/export/` | serialization, code generation |

### Constraint Filtering

| Constraint | Suffix | Purpose |
|------------|--------|---------|
| Sync only | `restriction sync/` | No async operations |
| Positional params | `params positional/` | Function(a, b, c) style |
| Named params | `params named/` | Function({a, b, c}) style |

## Organizational Principles

### Core Structure Pattern

```txt
type {return-type}/[type {sub-type}/]from/type {input-type}/[type {input-sub-type}/][{operation}/][restriction {constraint}/]params {param-style}/
```

### Path Components

#### 1. Return Type Category (Required)
- `type string/` - Functions returning `string` or `Promise<string>`
- `type boolean/` - Functions returning `boolean` (including type guards)
- `type object/` - Functions returning object types
- `type function/` - Functions returning function types
- `type number/` - Functions returning numeric types

#### 2. Sub-Type Specification (Optional)
- `type object/type array/` - Functions returning array objects
- `type object/type iterable/` - Functions returning iterable objects
- `type function/type generator/` - Functions returning generator functions
- `type object/type array/type param string/` - `string[]`

#### 3. Transformation Direction (Required)
- `from/` - Indicates transformation from input type to return type

#### 4. Input Type Specification (Required)
- `type iterable/` - Takes iterables as input
- `type array/` - Takes arrays as input
- `type unknown/` - Takes unknown values as input
- `type string/` - Takes strings as input
- `type number/` - Takes numbers as input

#### 5. Restrictions/Constraints (Optional)
- `restriction sync/` - Synchronous operations only
- `restriction async/` - Asynchronous operations only

#### 6. Parameter Style (Required)
- `params positional/` - Uses positional parameters
- `params named/` - Uses named/object parameters

## Concrete Examples

### Type Guards (Boolean Returns)

**String Type Guard**: [`type boolean/type is/type param string/from/type unknown/restriction sync/params positional/index.ts`](type%20boolean/type%20is/type%20param%20string/from/type%20unknown/restriction%20sync/params%20positional/index.ts)

```typescript
/**
 * Type guard that checks if a value is a string type using JavaScript typeof operator.
 */
export function $(value: unknown): value is string {
  return typeof value === 'string';
}

// Usage examples:
import { $ as isString } from './index.ts';

const input: unknown = "hello";
if (isString(input)) {
  // input is now typed as string
  console.log(input.toUpperCase()); // "HELLO"
}

isString("text"); // true
isString(123); // false
isString(null); // false
```

**Pattern**: `return boolean ← input unknown` (Type narrowing)

### String Transformations

**Export Code Generator**: [`type string/from/type any/export/restriction sync/params positional/index.ts`](type%20string/from/type%20any/export/restriction%20sync/params%20positional/index.ts)

```typescript
/**
 * Converts any JavaScript value into its string representation as frozen export code.
 * Handles primitive types and complex data structures with immutable wrapping.
 */
export function $(obj: unknown): string {
  // Complex serialization logic with recursive handling
}

// Usage examples:
import { $ as toExport } from './index.ts';

toExport(true); // "true"
toExport("hello"); // '"hello"'
toExport([1, 2, 3]); // "Object.freeze([1,2,3])"
toExport({ a: 1, b: 2 }); // "Object.freeze(Object.fromEntries([["a",1],["b",2]]))"
```

**String Array Concatenation**: [`type string/from/type array/type param string/concat/restriction sync/params positional/index.ts`](type%20string/from/type%20array/type%20param%20string/concat/restriction%20sync/params%20positional/index.ts)

```typescript
/**
 * Concatenates array of strings into a single string.
 */
export function $(strings: string[]): string {
  return strings.join('');
}

// Usage examples:
import { $ as arrayConcat } from './index.ts';

arrayConcat(['Hello', ' ', 'World']); // "Hello World"
arrayConcat(['A', 'B', 'C']); // "ABC"
```

**Pattern**: `return string ← input varies`

### Array Creation (Object/Array Returns)

**Iterable to Array Converter**: [`type object/type array/from/type iterable/restriction sync/params positional/index.ts`](type%20object/type%20array/from/type%20iterable/restriction%20sync/params%20positional/index.ts)

```typescript
/**
 * Converts any iterable to an array with full type preservation.
 */
export function $<const MyIterable extends $>(
  iterable: MyIterable,
): MyIterable extends $<infer T> ? T[] : never {
  if (Array.isArray(iterable)) {
    return iterable as any;
  }
  return Array.from(iterable) as any;
}

// Usage examples:
import { $ as iterableToArray } from './index.ts';

iterableToArray('hello'); // ['h', 'e', 'l', 'l', 'o']
iterableToArray(new Set([1, 2, 3])); // [1, 2, 3]
iterableToArray([1, 2, 3]); // [1, 2, 3] (identity for arrays)
```

**Pattern**: `return array ← input iterable, sync only, positional params`

### UUID Generation

**Random UUID**: [`type string/type uuid/from/type never/random/restriction sync/params positional/index.ts`](type%20string/type%20uuid/from/type%20never/random/restriction%20sync/params%20positional/index.ts)

```typescript
/**
 * Generates cryptographically secure random UUIDs using the Web Crypto API.
 */
export const $: typeof crypto.randomUUID = crypto.randomUUID;

// Usage examples:
import { $ as randomUUID } from './index.ts';

randomUUID(); // "f47ac10b-58cc-4372-a567-0e02b2c3d479"
```

**Pattern**: `return string ← no input (type never), random generation`

### Generator Functions

**Number Range Generator**: [`type function/type generator/type param number/from/type number/range/params positional/index.ts`](<type function/type generator/type param number/from/type number/range/restriction sync/params positional/index.ts>)

```typescript
/**
 * Creates a generator that yields consecutive integers starting from 0 up to length-1.
 * Memory-efficient iteration over integer sequences without creating arrays in memory.
 */
export function* $(length: number): Generator<number, void, undefined> {
  if (length < 0)
    throw new RangeError('Length must be non-negative');

  for (let index = 0; index < length; index++)
    yield index;
}

// Usage examples:
import { $ as rangeGenerator } from './index.ts';

const rangeGen = rangeGenerator(5);
for (const value of rangeGen) {
  console.log(value); // 0, 1, 2, 3, 4
}

// Memory-efficient processing
for (const index of rangeGenerator(1000000)) {
  if (index > 100) break; // Early termination
  console.log(`Processing item ${index}`);
}

// Convert to array when needed
const rangeArray = [...rangeGenerator(3)]; // [0, 1, 2]
```

**Pattern**: `return generator function ← input number`

## Directory Tree Structure

```txt
types/
├── type any/
├── type bigint/
├── type boolean/
│   ├── from/
│   │   ├── type any/
│   │   ├── type array/
│   │   ├── type string/
│   │   └── type unknown/
│   └── type is/
│       └── type param string/
│           └── from/
│               └── type unknown/
│                   └── restriction sync/
│                       └── params positional/
│                           └── index.ts
├── type function/
│   ├── type generator/
│   │   ├── from/
│   │   │   └── type array/
│   │   └── type param number/
│   │       └── from/
│   │           └── type number/
│   │               └── range/
│   ├── type is/
│   │   └── type/
│   │       └── restriction sync/
│   │           └── params positional/
│   │               └── index.ts
│   └── type sink/
│       ├── type/
│       │   ├── params positional/
│       │   │   └── index.ts
│       │   └── restriction sync/
│       │       └── params positional/
│       │           └── index.ts
│       └── type param string/
│           └── type/
│               ├── params positional/
│               │   └── index.ts
│               └── restriction sync/
│                   └── params positional/
│                       └── index.ts
├── type never/
├── type number/
├── type numeric/
├── type object/
│   ├── type array/
│   │   ├── from/
│   │   │   ├── type iterable/
│   │   │   │   ├── params positional/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── restriction sync/
│   │   │   │   │   ├── params positional/
│   │   │   │   │   │   └── index.ts
│   │   │   │   │   └── index.ts
│   │   │   ├── type number/
│   │   │   ├── type int/
│   │   │       └── range/
│   │   └── index.ts
│   ├── type date/
│   ├── type error/
│   ├── type globalThis/
│   ├── type iterable/
│   │   └── type/
│   │       ├── restriction sync/
│   │       │   └── index.ts
│   │       └── index.ts
│   ├── type map/
│   ├── type null/
│   ├── type promise/
│   ├── type proxy/
│   ├── type record/
│   └── type regexp/
│       └── from/
│           └── type object/
│               └── restriction sync/
│                   └── params positional/
│                       └── index.ts
├── type string/
│   ├── from/
│   │   ├── type any/
│   │   │   └── export/
│   │   │       └── restriction sync/
│   │   │           └── params positional/
│   │   │               └── index.ts
│   │   └── type array/
│   │       └── type param string/
│   │           └── concat/
│   │               └── restriction sync/
│   │                   └── params positional/
│   │                       └── index.ts
│   ├── type nonEmpty/
│   │   └── type/
│   ├── type typeof/
│   │   ├── from/
│   │   │   └── type unknown/
│   │   │       └── restriction sync/
│   │   │           └── params positional/
│   │   │               └── index.ts
│   │   └── type/
│   └── type uuid/
│       └── from/
│           └── type never/
│               └── random/
│                   └── restriction sync/
│                       └── params positional/
│                           └── index.ts
├── type undefined/
└── type unknown/
```

## Path Resolution Examples

### Simple Type Guard
```txt
type boolean/type is/type param string/from/type unknown/restriction sync/params positional/
│    │       │    │   │    │      │    │       │    │           │   │      │
│    │       │    │   │    │      │    │       │    │           │   │      └─ Parameter style
│    │       │    │   │    │      │    │       │    │           │   └─ Params category
│    │       │    │   │    │      │    │       │    │           └─ Constraint: sync only
│    │       │    │   │    │      │    │       │    └─ Input type: unknown values
│    │       │    │   │    │      │    │       └─ Transformation direction
│    │       │    │   │    │      └─ Input type category
│    │       │    │   │    └─ Operation: type checking/guarding
│    │       │    │   └─ Specific type: string parameter checking
│    │       │    └─ Operation category: type checking
│    │       └─ Return type: boolean
│    └─ Type category prefix
└─ Root types directory
```

### Complex Array Transformation
```txt
type object/type array/from/type iterable/restriction sync/params positional/
│    │      │    │     │    │    │        │           │   │      │
│    │      │    │     │    │    │        │           │   │      └─ Parameter style
│    │      │    │     │    │    │        │           │   └─ Params category
│    │      │    │     │    │    │        │           └─ Constraint: sync only
│    │      │    │     │    │    │        └─ Restriction category
│    │      │    │     │    │    └─ Input type: iterables
│    │      │    │     │    └─ Input type category
│    │      │    │     └─ Transformation direction
│    │      │    └─ Sub-type: arrays
│    │      └─ Sub-type category
│    └─ Return type: objects
└─ Type category prefix
```

### UUID Generation Path
```txt
type string/type uuid/from/type never/random/restriction sync/params positional/
│    │      │    │    │    │    │     │      │           │   │      │
│    │      │    │    │    │    │     │      │           │   │      └─ Parameter style
│    │      │    │    │    │    │     │      │           │   └─ Params category
│    │      │    │    │    │    │     │      │           └─ Constraint: sync only
│    │      │    │    │    │    │     │      └─ Restriction category
│    │      │    │    │    │    │     └─ Operation: random generation
│    │      │    │    │    │    └─ Input type: never (no input required)
│    │      │    │    │    └─ Input type category
│    │      │    │    └─ Transformation direction
│    │      │    └─ Sub-type: UUID strings
│    │      └─ Sub-type category
│    └─ Return type: string
└─ Type category prefix
```

## Navigation Guide

### Search Patterns

**Finding Utilities by Intent:**
1. **Start with return type**: What do you want to get back?
   - `type string/` for string results
   - `type boolean/` for boolean results (type guards)
   - `type object/type array/` for array results

2. **Navigate by input type**: What are you starting with?
   - `from/type unknown/` for any input
   - `from/type iterable/` for iterable inputs
   - `from/type array/` for array inputs

3. **Filter by constraints**: What limitations do you have?
   - `restriction sync/` for synchronous only
   - `params positional/` for function-style parameters

### Common Navigation Shortcuts

| Want to... | Navigate to... | Then look for... |
|------------|---------------|------------------|
| Convert anything to string | `type string/from/` | `type any/`, `type unknown/` |
| Create type guards | `type boolean/type is/` | `type param {type}/from/type unknown/` |
| Generate sequences | `type function/type generator/` | `from/type number/range/` |
| Transform arrays | `type string/from/type array/` | Specific operations like `concat/` |
| Create arrays | `type object/type array/from/` | Input type like `type iterable/` |

### Cross-Reference System

**Related Utilities** (functions that work well together):

- **String Type Guard** → **String Transformations**: First check type, then transform
- **Array Creation** → **String Transformations**: Create array, then join to string
- **Number Range Generation** → **Array Creation**: Generate sequence, then convert to array
- **Type Guards** → **Any Operation**: Verify type safety before operations

### Visual Path Breakdown Examples

```txt
Utility: "Convert iterable to array synchronously with positional parameters"

Step 1: Return type
       types/ → type object/
                     ↓
Step 2: Sub-type specification
       type object/ → type array/
                           ↓
Step 3: Transformation direction
       type array/ → from/
                      ↓
Step 4: Input type
       from/ → type iterable/
                    ↓
Step 5: Constraints
       type iterable/ → restriction sync/
                             ↓
Step 6: Parameter style
       restriction sync/ → params positional/
                                ↓
Final: Implementation
       params positional/ → index.ts
```

## Developer Guidelines

### Adding New Utilities

#### Step-by-Step Process

1. **Analyze Your Function**
   ```typescript
   // Example function to categorize:
   function isValidEmail(email: string): boolean {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   }
   ```

2. **Determine Path Components**
   - **Return type**: `boolean` → `type boolean/`
   - **Sub-type**: Type guard → `type is/`
   - **Parameter type**: Email string → `type param string/`
   - **Input type**: String → `from/type string/`
   - **Operation**: Email validation → `email/` (specific operation)
   - **Constraint**: Synchronous → `restriction sync/`
   - **Parameters**: Single parameter → `params positional/`

3. **Construct Full Path**
   ```txt
   type boolean/type is/type param string/from/type string/email/restriction sync/params positional/
   ```

4. **Create Directory Structure**
   ```bash
   mkdir -p "type boolean/type is/type param string/from/type string/email/restriction sync/params positional"
   ```

5. **Create Implementation File**
   ```typescript
   // type boolean/type is/type param string/from/type string/email/restriction sync/params positional/index.ts

   /**
    * Type guard that validates if a string is a valid email address format.
    * Uses RFC-compliant regex pattern for email validation.
    *
    * @param email - String to validate as email
    * @returns True if string matches email format, false otherwise
    * @example
    * ```ts
    * isValidEmail("user@example.com"); // true
    * isValidEmail("invalid-email"); // false
    *
    * const input: string = getUserInput();
    * if (isValidEmail(input)) {
    *   // input is validated as email format
    *   sendEmail(input);
    * }
    * ```
    */
   export function $(email: string): boolean {
     return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
   }
   ```

6. **Add Tests**
   ```typescript
   // type boolean/type is/type param string/from/type string/email/restriction sync/params positional/index.unit.test.ts

   import { $ as isValidEmail } from './index.ts';
   import { describe, test, expect } from 'vitest';

   describe('Email validation type guard', () => {
     test('validates correct email formats', () => {
       expect(isValidEmail('user@example.com')).toBe(true);
       expect(isValidEmail('test.email+tag@example.co.uk')).toBe(true);
     });

     test('rejects invalid email formats', () => {
       expect(isValidEmail('invalid-email')).toBe(false);
       expect(isValidEmail('user@')).toBe(false);
       expect(isValidEmail('@example.com')).toBe(false);
     });
   });
   ```

7. **Update Index Files**
   Create or update index files in parent directories to export the new utility.

### Naming Conventions

#### Path Construction Rules

1. **Always start with return type**: `type {return-type}/`
2. **Use specific sub-types when applicable**: `type object/type array/` instead of just `type object/`
3. **Include `from/` for transformations**: Indicates input-to-output relationship
4. **Specify input types precisely**: `type unknown/` vs `type any/` vs `type string/`
5. **Add operation names for clarity**: `concat/`, `email/`, `export/` when multiple operations exist
6. **Always end with constraints**: `restriction sync/params positional/`

#### File Naming Standards

- **Implementation**: `index.ts`
- **Unit tests**: `index.unit.test.ts`
- **Browser tests**: `index.browser.test.ts`
- **Documentation**: `README.md` (for complex categories)

#### Function Naming

- **Export function**: Always use `$` for consistency

### Testing Requirements

#### Test Coverage Goals

- **100% line coverage** for all utilities
- **100% branch coverage** for conditional logic
- **Type-level testing** for complex generics
- **Error case testing** for all thrown exceptions

#### Test Structure

```typescript
import { $ as myFunction } from './index.ts';
import { describe, test, expect, expectTypeOf } from 'vitest';

describe('Function category: specific function', () => {
  test('handles basic case', () => {
    expect(myFunction('input')).toBe('expected');
  });

  test('handles edge cases', () => {
    expect(myFunction('')).toBe('default');
    expect(() => myFunction(null as any)).toThrow();
  });

  test('provides correct TypeScript types', () => {
    expectTypeOf(myFunction('test')).toEqualTypeOf<string>();
  });
});
```

### Code Style Guidelines

#### Import Organization

```typescript
// 1. Node.js built-in modules
import { readFile } from 'fs/promises';

// 2. External dependencies
import { match } from 'ts-pattern';

// 3. Internal workspace packages
import { $ as helperFunction } from '@monochromatic-dev/module-es';

// 4. Type-only + relative imports
import type { $ as Options } from './type/index.ts';
```

#### Function Implementation

```typescript
/**
 * [TSDoc here]
 */
export function $(param: InputType): OutputType {
  // Input validation first
  if (invalidCondition) {
    throw new TypeError('Descriptive error message');
  }

  // Main logic
  const result = processInput(param);

  // Return result
  return result;
}

// Type assertion for consistency checking
const _typeCheck: ExpectedFunctionType = $;
```

### Integration with Existing Utilities

#### Reusing Components

Before creating new utilities, check if existing components can be reused:

1. **Type guards**: Look in `type boolean/type is/`
2. **Basic transformations**: Check `type string/from/` and `type object/type array/from/`
3. **Generators**: Examine `type function/type generator/`
4. **Validation**: Review existing type checking utilities

#### Cross-References

When utilities work together, document the relationships:

```typescript
/**
 * Converts validated email string to user object.
 *
 * @see {@link isValidEmail} - Use this first to validate input
 * @see {@link userFromObject} - Alternative constructor from object
 */
export function $(email: string): User {
  // Implementation assumes email is pre-validated
}
```

## Migration Reference

### Legacy `src/type/` Structure Mapping

The utilities are being migrated from the legacy [`../type/`](../type/) directory structure to the new organized system. Here's how the mappings work:

#### Directory Mapping

| Legacy Path | New Path | Status |
|-------------|----------|---------|
| `../type/typeof/string/` | `type string/type typeof/from/type unknown/` | ✅ Migrated |
| `../type/custom/string/jsonc/` | `type string/from/type string/jsonc/` | 🔄 In Progress |
| `../type/custom/object/array/` | `type object/type array/from/` | 🔄 In Progress |
| `../type/typeof/boolean/` | `type boolean/type is/from/type unknown/` | ✅ Migrated |

#### Function Name Mapping

Legacy functions used descriptive names; new structure uses `$` for consistency:

| Legacy | New | Import Pattern |
|--------|-----|----------------|
| `isString(value)` | `export function $(value)` | `import { $ as isString }` |
| `arrayFromIterable(iter)` | `export function $(iter)` | `import { $ as arrayFromIterable }` |
| `generateUUID()` | `export function $()` | `import { $ as generateUUID }` |

### Migration Checklist for Developers

When migrating utilities from legacy structure:

- [ ] **Analyze function signature** to determine new path
- [ ] **Create new directory structure** following naming conventions
- [ ] **Copy and update implementation** with new export pattern
- [ ] **Update TSDoc** with comprehensive examples
- [ ] **Create test files** with 100% coverage
- [ ] **Update index files** to export new utility
- [ ] **Add deprecation notice** to legacy location
- [ ] **Update internal references** to use new paths
- [ ] **Document migration** in this README

### Breaking Changes

The migration involves some breaking changes:

1. **Import paths change**: Update all imports to new structure
2. **Function names normalize**: All exports become `$` with aliasing
3. **Directory structure**: Completely reorganized hierarchy
4. **Documentation format**: Enhanced TSDoc requirements

## Best Practices

### When to Create New Utilities

#### Create New Utilities When:

✅ **Solving a common problem**
```typescript
// Good: Email validation is commonly needed
type boolean/type is/type param string/from/type unknown/email/restriction sync/params positional/
```

✅ **Input/output types are clearly different**
```typescript
// Good: Clear transformation from iterable to array
type object/type array/from/type iterable/restriction sync/params positional/
```

✅ **Function has single responsibility**
```typescript
// Good: Only concatenates strings
type string/from/type array/type param string/concat/restriction sync/params positional/
```

✅ **Reusable across multiple contexts**
```typescript
// Good: UUID generation useful everywhere
type string/type uuid/from/type never/random/restriction sync/params positional/
```

#### Extend Existing Utilities When:

❌ **Adding minor variations**
```typescript
// Instead of creating separate utility:
type string/from/type array/type param string/concatWithSpace/

// Extend existing with options:
type string/from/type array/type param string/concatWith/type string/restriction sync/params positional/
```

❌ **Functionality is too specific**
```typescript
// Too specific for shared library:
type string/from/type array/type param string/concatForEmailSubject/

// Better: Use general concat with specific delimiter
```

### Type Safety Guidelines

#### Strict Input Validation

```typescript
// ✅ Good: Validate inputs and throw descriptive errors
export function $(length: number): Generator<number, void, undefined> {
  if (length < 0) {
    throw new RangeError('Length must be non-negative');
  }
  if (!Number.isInteger(length)) {
    throw new TypeError('Length must be an integer');
  }
  // Implementation...
}
```

#### Type Assertion Patterns

```typescript
// ✅ Good: Type guards for runtime safety
export function $(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

// ❌ Avoid: Unsafe type assertions
export function $(value: unknown): string[] {
  return value as string[]; // No runtime validation
}
```

#### Generic Constraints

```typescript
// ✅ Good: Meaningful constraints that provide safety
export function $<const T extends readonly string[]>(
  array: T
): T[number] {
  return array[0];
}

// ❌ Avoid: Overly broad or meaningless constraints
export function $<T extends any>(value: T): T {
  return value; // Constraint doesn't add value
}
```

### Documentation Requirements

#### Essential Documentation Elements

1. **Purpose**: What does this utility solve?
2. **Behavior**: How does it work internally?
3. **Parameters**: What inputs are expected?
4. **Returns**: What outputs are provided?
5. **Exceptions**: When and why does it throw?
6. **Examples**: How should it be used?
7. **Related**: What utilities work together?

#### Documentation Anti-patterns

❌ **Don't repeat the obvious**
```typescript
/**
 * Returns a string
 * @param input - A string input
 * @returns A string
 */
export function $(input: string): string {
  return input;
}
```

✅ **Explain the purpose and context**
```typescript
/**
 * Normalizes whitespace in strings by collapsing multiple spaces into single spaces
 * and trimming leading/trailing whitespace. Essential for text processing and
 * consistent formatting.
 *
 * @param input - String that may contain irregular whitespace
 * @returns String with normalized whitespace
 */
export function $(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Path Resolution Problems

**Problem**: "Cannot find module" errors when importing utilities

```typescript
// ❌ Error: Module not found
import { $ } from './types/type string/from/type array';
```

**Solutions**:
1. **Check path completeness**: Always include full path to index file
   ```typescript
   // ✅ Correct: Full path with index file
   import { $ } from './types/type string/from/type array/type param string/concat/restriction sync/params positional/index.ts';
   ```

2. **Use proper aliases**: Import with descriptive aliases
   ```typescript
   // ✅ Better: Aliased import
   import { $ as stringArrayConcat } from './types/type string/from/type array/type param string/concat/restriction sync/params positional/index.ts';
   ```

3. **Check directory structure**: Verify all intermediate directories exist
   ```bash
   # Use this to check structure
   find types/ -name "index.ts" -type f
   ```

#### Type Inference Issues

**Problem**: TypeScript can't infer types correctly

```typescript
// ❌ Problem: TypeScript shows 'any' instead of proper type
const result = someUtility(input); // result: any
```

**Solutions**:
1. **Add explicit type parameters**: Help TypeScript understand your intent
   ```typescript
   // ✅ Solution: Explicit type parameter
   const result = someUtility<string>(input); // result: string
   ```

2. **Use type assertions carefully**: Only when you're certain of the type
   ```typescript
   // ✅ Solution: Proper type assertion with validation
   const result = someUtility(input) as string;
   console.assert(typeof result === 'string', 'Expected string result');
   ```

3. **Check utility's generic constraints**: Ensure input meets expected constraints
   ```typescript
   // ✅ Solution: Ensure input meets constraints
   const constrainedInput: readonly string[] = ['a', 'b', 'c'];
   const result = someUtility(constrainedInput); // Now properly typed
   ```

#### Import/Export Patterns

**Problem**: Confusing import syntax and export patterns

**Common Import Patterns**:
```typescript
// Single utility with alias
import { $ as isString } from './types/type boolean/type is/type param string/from/type unknown/restriction sync/params positional/index.ts';

// Multiple utilities from same category
import { $ as stringConcat } from './types/type string/from/type array/type param string/concat/restriction sync/params positional/index.ts';
import { $ as stringExport } from './types/type string/from/type any/export/restriction sync/params positional/index.ts';

// Type-only imports
import type { $ as SomeType } from './types/type object/index.ts';
```

**Export Verification**:
```typescript
// Check that your utility exports correctly
const _typeCheck: (input: InputType) => OutputType = $;
```

#### Testing Setup

**Problem**: Tests fail to run or find utilities

**Solutions**:
1. **Correct test file naming**: Follow naming conventions
   ```typescript
   // ✅ Correct naming
   // index.ts -> index.unit.test.ts
   // index.ts -> index.browser.test.ts
   // index.ts -> index.type.test.ts
   ```

2. **Proper test imports**: Always import from package entrypoint to test generated code.
   ```typescript
   // ✅ Correct test import
   import { $ as myUtility } from '@monochromatic-dev/module-es';
   import { describe, test, expect } from 'vitest';
   ```

3. **Test file location**: Place tests alongside implementations
   ```txt
   type string/from/type array/
   ├── index.ts
   ├── index.unit.test.ts
   └── README.md
   ```

#### Runtime Errors

**Problem**: Utilities throw unexpected errors at runtime

**Common Error Types and Solutions**:

1. **Type Validation Errors**
   ```typescript
   // Error: TypeError: Expected string, got number
   // Solution: Add proper input validation
   export function $(input: unknown): string {
     if (typeof input !== 'string') {
       throw new TypeError(`Expected string, got ${typeof input}`);
     }
     return processString(input);
   }
   ```

2. **Range/Boundary Errors**
   ```typescript
   // Error: RangeError: Length must be non-negative
   // Solution: Validate numeric inputs
   export function $(length: number): Generator<number> {
     if (length < 0) {
       throw new RangeError('Length must be non-negative');
     }
     // Implementation...
   }
   ```

3. **Null/Undefined Errors**
   ```typescript
   // Error: Cannot read property 'method' of undefined
   // Solution: Use nullish checks and provide defaults
   export function $(value: unknown): string {
     if (value == null) {
       return ''; // or throw descriptive error
     }
     return processValue(value);
   }
   ```

### Debugging Techniques

#### Utility Behavior Debugging

```typescript
// Add temporary logging to understand utility behavior
export function $(input: InputType): OutputType {
  console.log('Input:', input, 'Type:', typeof input);

  const result = processInput(input);

  console.log('Output:', result, 'Type:', typeof result);
  return result;
}
```

#### Type System Debugging

```typescript
// Use type utilities to debug type inference
type DebugInput<T> = T extends infer U ? { input: U } : never;
type DebugOutput<T> = T extends (...args: any[]) => infer R ? R : never;

// Apply to your utility to see what TypeScript infers
type InputDebug = DebugInput<Parameters<typeof $>[0]>;
type OutputDebug = DebugOutput<typeof $>;
```

#### Path Resolution Debugging

```bash
# Check if path exists
ls -la "types/type string/from/type array/type param string/concat/restriction sync/params positional/index.ts"

# Find similar paths
find types/ -name "*concat*" -type f

# List directory contents
tree types/type\ string/from/type\ array/
```

## Benefits

### 1. Predictable Navigation
- Need a string transformer? Check [`type string/from/`](type%20string/from/)
- Need array creation? Check [`type object/type array/from/`](type%20object/type%20array/from/)
- Need type guards? Check [`type boolean/type is/`](type%20boolean/type%20is/)

### 2. Constraint Specification
- Sync vs async requirements clearly separated
- Parameter style preferences explicit
- Input/output types unambiguous

### 3. Scalable Hierarchy
- Handles complex nested types systematically
- Sub-type categorization prevents flat namespace pollution
- Constraint layers provide fine-grained organization

### 4. Semantic Clarity
- Every path component has specific meaning
- Function purpose immediately obvious from location
- Compositional relationships clear from structure

### 5. Developer Experience
- **Intelligent IDE suggestions**: Path structure guides auto-completion
- **Clear mental model**: Return-type-first organization matches developer intent
- **Easy discovery**: Logical hierarchy reveals related functionality
- **Consistent patterns**: Same organizational principles across all utilities

### 6. Maintainability
- **Single responsibility**: Each directory has clear purpose
- **Systematic testing**: Path structure guides test organization
- **Documentation consistency**: Standardized approach across all utilities
- **Refactoring safety**: Type-safe migrations between similar utilities

## Implementation Status

- ✅ **Core structure** - Return-type-first organization established
- ✅ **Type categories** - Major return types (string, boolean, object, function) structured
- ✅ **Sub-type hierarchy** - Complex types (array, iterable, generator) organized
- ✅ **Constraint system** - Sync/async restrictions and parameter styles implemented
- ✅ **Concrete examples** - Real utilities documented with usage patterns
- ✅ **Navigation system** - Search patterns and cross-references established
- ✅ **Developer guidelines** - Comprehensive instructions for adding utilities
- 🔄 **Migration ongoing** - Functions being moved from legacy [`src/type/`](../type/) structure
- ⏳ **Full coverage** - Complete migration of all 500+ utilities planned

This organizational system provides the precision and scalability needed for a comprehensive functional programming utilities library while maintaining intuitive navigation and clear semantic meaning.
