# Types Directory Organization System

This directory implements a sophisticated hierarchical organization system for TypeScript utilities, built around **return types** with fine-grained categorization and constraint specification.

## Organizational Principles

### Core Structure Pattern

```
type {return-type}/[type {sub-type}/]from/type {input-type}/[restriction {constraint}/][params {param-style}/]
```

### Hierarchy Rules

```
restriction * > params *
type * > * *
```

**Meaning**:
- **Restriction constraints** (like `restriction sync/`) take precedence over parameter styles
- **Type specifications** (like `type array/`) take precedence over other modifiers

### Path Components

#### 1. Return Type Category
- `type string/` - Functions returning `string` or `Promise<string>`
- `type boolean/` - Functions returning `boolean` (including type guards)
- `type object/` - Functions returning object types
- `type function/` - Functions returning function types
- `type number/` - Functions returning numeric types

#### 2. Sub-Type Specification (Optional)
- `type object/type array/` - Functions returning array objects
- `type object/type iterable/` - Functions returning iterable objects  
- `type function/type generator/` - Functions returning generator functions

#### 3. Transformation Direction
- `from/` - Indicates transformation from input type to return type

#### 4. Input Type Specification  
- `type iterable/` - Takes iterables as input
- `type array/` - Takes arrays as input
- `type unknown/` - Takes unknown values as input
- `type string/` - Takes strings as input
- `type number/` - Takes numbers as input

#### 5. Restrictions/Constraints (Optional)
- `restriction sync/` - Synchronous operations only
- `restriction async/` - Asynchronous operations only

#### 6. Parameter Style (Optional)
- `params positional/` - Uses positional parameters
- `params named/` - Uses named/object parameters

## Examples

### Type Guards (Boolean Returns)
```typescript
// type boolean/from/type unknown/isString.ts
type boolean/from/type unknown/isString.ts
└─ isString(value: unknown): value is string

// Pattern: return boolean ← input unknown
```

### Array Creation (Object/Array Returns)
```typescript
// type object/type array/from/type iterable/restriction sync/params positional/
type object/type array/from/type iterable/restriction sync/params positional/index.ts
└─ $(iterable): Array // sync iterable → array, positional params

// Pattern: return array ← input iterable, sync only, positional params
```

### String Transformations
```typescript
// type string/from/type array/concat.ts  
type string/from/type array/concat.ts
└─ concat(strings: string[]): string

// type string/from/unknown/export.ts
type string/from/unknown/export.ts  
└─ export(value: unknown): string

// Pattern: return string ← input varies
```

### Generator Functions
```typescript
// type function/type generator/from/number/range.ts
type function/type generator/from/number/range.ts
└─ range(count: number): Generator<number>

// Pattern: return generator function ← input number
```

## Directory Tree Structure

```
types/
├── type any/
├── type bigint/
├── type boolean/
│   ├── from/
│   │   ├── type any/
│   │   ├── type array/
│   │   ├── type string/
│   │   └── type unknown/
│   │       ├── index.ts
│   │       └── isString.ts
│   └── type is/
├── type function/
│   └── type generator/
│       ├── from/
│       │   ├── any/
│       │   ├── array/
│       │   │   └── positional/
│       │   ├── iterable/
│       │   └── number/
│       │       ├── index.ts
│       │       └── range.ts
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
│   ├── from/
│   │   ├── async/
│   │   ├── css/
│   │   ├── path/
│   │   ├── random/
│   │   ├── string/
│   │   │   ├── hash.ts
│   │   │   └── trim.ts
│   │   ├── type array/
│   │   │   ├── concat.ts
│   │   │   └── index.ts
│   │   └── unknown/
│   │       ├── export.ts
│   │       ├── index.ts
│   │       └── typeOf.ts
│   └── index.ts
├── type undefined/
└── type unknown/
```

## Path Resolution Examples

### Simple Type Guard
```
type boolean/from/type unknown/isString.ts
│    │       │    │       │
│    │       │    │       └─ Specific function: isString
│    │       │    └─ Input type: unknown values
│    │       └─ Transformation direction: from input to output
│    └─ Return type: boolean
└─ Type category prefix
```

### Complex Array Transformation
```
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

## Migration from Legacy Structure

This organization supersedes the simpler return-type approach outlined in [`TODO.return-type-refactor.md`](../TODO.return-type-refactor.md). Key differences:

### Legacy Pattern (Planned)
```
string/from/unknown/export.ts
boolean/from/string/isDigits.ts  
array/from/number/range.ts
```

### Current Pattern (Implemented)
```
type string/from/unknown/export.ts
type boolean/from/type string/isDigits.ts
type object/type array/from/type number/range.ts
```

### Advantages of Current Approach
1. **Explicit type prefixes** eliminate ambiguity
2. **Sub-type categorization** (e.g., `type array` within `type object`)
3. **Constraint specification** (`restriction sync/`, `params positional/`)
4. **Hierarchical precision** enables complex type relationships

## Implementation Status

- ✅ **Core structure** - Return-type-first organization established
- ✅ **Type categories** - Major return types (string, boolean, object, function) structured  
- ✅ **Sub-type hierarchy** - Complex types (array, iterable, generator) organized
- ✅ **Constraint system** - Sync/async restrictions and parameter styles implemented
- 🔄 **Migration ongoing** - Functions being moved from legacy [`src/type/`](../type/) structure
- ⏳ **Full coverage** - Complete migration of all 500+ utilities planned

This organizational system provides the precision and scalability needed for a comprehensive functional programming utilities library while maintaining intuitive navigation and clear semantic meaning.