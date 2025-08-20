# Troubleshooting: TypeScript Typeguards and Type Preservation

## Critical Discovery: Input Type Determines Type Preservation

### The Real Rule
**TypeScript typeguards preserve properties based on the INPUT type, not the guard pattern:**

- **Typed inputs**: Properties preserved through intersection types
- **`unknown`/`any` inputs**: Properties lost, narrowed to predicate type only

## Common Misconceptions Corrected

### Myth: "TypeScript always preserves type information"
**PARTIALLY FALSE** - It depends on the input type.

```typescript
type SchemaWithWeight = Schema & { weight: number };
const schema: SchemaWithWeight = { parse: (x) => x, weight: 100 };

// ✅ PRESERVES properties - typed input
if (isSchema(schema)) {
  schema.weight; // Works! Type: SchemaWithWeight & Schema
}

// ❌ LOSES properties - unknown input
const unknownSchema: unknown = schema;
if (isSchema(unknownSchema)) {
  unknownSchema.weight; // Error! Type: Schema only
}
```

### Myth: "`any` bypasses type narrowing"
**FALSE** - `any` still gets narrowed by typeguards.

```typescript
const anySchema: any = { parse: (x) => x, weight: 100 };

if (isSchema(anySchema)) {
  anySchema.weight; // ❌ Error! Even any gets narrowed to Schema
}

// Exception: Generic patterns may preserve any better
if (isSchemaGeneric(anySchema)) {
  anySchema.weight; // ✅ May work - depends on generic implementation
}
```

## The Industry Standard Problem

**The `value: unknown` pattern loses type information:**

```typescript
// Common pattern - loses properties
function isSchema(value: unknown): value is Schema { /* */ }

const richSchema = { parse: (x) => x, weight: 100, name: 'test' };

// Problem: Must cast to unknown, losing all type info
if (isSchema(richSchema as unknown)) {
  richSchema.weight; // ❌ Error - lost in narrowing
  richSchema.name;   // ❌ Error - lost in narrowing
}

// Solution: Don't cast to unknown
if (isSchema(richSchema)) {
  richSchema.weight; // ✅ Works - intersection preserves properties
  richSchema.name;   // ✅ Works - intersection preserves properties
}
```

## Better Patterns for Type Preservation

### Pattern 1: Generic with extends constraint
```typescript
function isSchema<const T extends Schema = Schema>(
  value: T
): value is T {
  return /* validation */;
}

// Preserves ALL original type information
// Provides compile-time safety
// Forces explicit casting for unknown data
```

### Pattern 2: Simple typed parameter
```typescript
function isSchema(value: Schema): value is Schema {
  return /* validation */;
}

// Preserves properties for typed inputs
// Simpler than generic approach
// Still requires casting for unknown data
```

## Practical Guidelines

### For Validating Unknown Data
```typescript
const untrusted: unknown = JSON.parse(data);

// Make the unknown → typed conversion explicit
if (isSchema(untrusted as unknown as Schema & typeof untrusted)) {
  untrusted.parse('test'); // ✅ Validated
  // No additional properties expected from unknown
}
```

### For Narrowing Typed Values  
```typescript
const typed: SchemaWithWeight | string = getValue();

// Preserve properties during narrowing
if (isSchema(typed as Schema & typeof typed)) {
  typed.weight; // ✅ Preserved if it was SchemaWithWeight
}
```

### For Objects with Additional Properties
```typescript
const enriched = { parse: (x) => x, weight: 100, metadata: {...} };

// DON'T cast to unknown - loses all properties
if (isSchema(enriched as unknown)) {
  enriched.weight; // ❌ Lost
}

// DO use direct validation - preserves properties
if (isSchema(enriched)) {
  enriched.weight; // ✅ Preserved
  enriched.metadata; // ✅ Preserved
}
```

## Testing Type Behavior

Use `packages/module/es/src/typeguard.behaviorTest.ts` to verify behavior:
- Lines with `@ts-expect-error`: Properties get lost
- Lines without: Properties preserved
- This pattern reveals the complete type preservation rules

## Recommendation

**Refactor to generic pattern for better type preservation** - the input type really does matter for maintaining property information during validation.