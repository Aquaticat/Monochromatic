# Types Directory Organization System

This directory implements a sophisticated hierarchical organization system for TypeScript utilities, built around **return types** with fine-grained categorization and constraint specification.

## Organizational Principles

### Core Structure Pattern

```txt
type {return-type}/[type {sub-type}/]from/type {input-type}/[{operation}/][restriction {constraint}/]params {param-style}/
```

### Hierarchy Rules

```txt
restriction {constraint}/ > params {param-style}
type * > * *
```

**Meaning**:
- **Restriction constraints** (like `restriction sync/`) take precedence over parameter styles
- **Type specifications** (like `type array/`) take precedence over other modifiers

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

## Examples

### Type Guards (Boolean Returns)
```typescript
// type boolean/type is/from/type unknown/params positional/index.ts
$(value: unknown): value is string

// Pattern: return boolean ← input unknown
```

### Array Creation (Object/Array Returns)
```typescript
// type object/type array/from/type iterable/restriction sync/params positional/index.ts
$(iterable): Array // sync iterable → array, positional params

// Pattern: return array ← input iterable, sync only, positional params
```

### String Transformations
```typescript
// type string/from/type array/type <string>/concat/params positional/index.ts
// Can't omit op, had to use concat because string.from.array.string.positional.$ is ambiguous.
// (Does it concat the array to one string, or does it just run JSON.stringify?)
$(strings: string[]): string

// type string/from/type any/params positional/export/params positional/index.ts
// Although value is typed as unknown in code, because the output is theoritically reversible, the input type is shown as `any` in fs.
$(value: unknown): string

// type string/from/type unknown/params positional/inspect.ts
// Similar to util.inspect, output is irreversible, therefore input type is shown as `unknown` in fs.
$(value: unknown): string

// Pattern: return string ← input varies
```

### Generator Functions
```typescript
// type function/type generator/type <number>/from/type number/range/params positional/index.ts
$(count: number): Generator<number>

// Pattern: return generator function ← input number
```

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
├── type function/
│   └── type generator/
│       ├── from/
│       └── index.ts
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
│   │   │   │   └── index.ts
│   │   │   └── type number/
│   │   │       └── type int/
│   │   │           └── range/
│   │   │               └── params positional/
│   │   └── index.ts
│   ├── type date/
│   ├── type error/
│   ├── type globalThis/
│   ├── type iterable/
// TODO: Document this
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
├── type string/
├── type undefined/
└── type unknown/
```

## Path Resolution Examples

### Simple Type Guard
```txt
type boolean/from/type unknown/isString.ts
│    │       │    │       │
│    │       │    │       └─ Specific function: isString
│    │       │    └─ Input type: unknown values
│    │       └─ Transformation direction: from input to output
│    └─ Return type: boolean
└─ Type category prefix
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

## Benefits

### 1. Predictable Navigation
- Need a string transformer? Check `type string/from/`
- Need array creation? Check `type object/type array/from/`
- Need type guards? Check `type boolean/from/`

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

## Implementation Status

- ✅ **Core structure** - Return-type-first organization established
- ✅ **Type categories** - Major return types (string, boolean, object, function) structured
- ✅ **Sub-type hierarchy** - Complex types (array, iterable, generator) organized
- ✅ **Constraint system** - Sync/async restrictions and parameter styles implemented
- 🔄 **Migration ongoing** - Functions being moved from legacy [`src/type/`](../type/) structure
- ⏳ **Full coverage** - Complete migration of all 500+ utilities planned

This organizational system provides the precision and scalability needed for a comprehensive functional programming utilities library while maintaining intuitive navigation and clear semantic meaning.
