# TypeScript Troubleshooting

## TypeScript Path Warnings with dprint

### Problem
You see warnings when running dprint or other tools:
```txt
warn: Non-relative path "packages/config/eslint/src/index.ts" is not allowed when "baseUrl" is not set (did you forget a leading "./"?)
```

### Solution
Set `baseUrl` to `"./"` in your root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "baseUrl": "./"
  }
}
```

This tells TypeScript to resolve non-relative paths from the project root, which is necessary when using path mappings in a monorepo structure.

### Note
Setting `baseUrl` may or may not completely resolve the warnings, but it helps TypeScript understand that non-relative paths in the `paths` mapping should be resolved from the project root.

## Type Predicate Assignment Errors

### Problem
You encounter TypeScript error TS2677: "A type predicate's type must be assignable to its parameter's type" when using complex conditional types in type predicates:

```ts
export function maybeAsyncSchemaIsSchemaAsync<
  const MyMaybeAsyncSchema extends MaybeAsyncSchema = MaybeAsyncSchema,
>(
  maybeAsyncSchema: MyMaybeAsyncSchema,
): maybeAsyncSchema is MyMaybeAsyncSchema extends SchemaAsync<infer Input, infer Output>
  ? SchemaAsync<Input, Output>
  : Schema & MyMaybeAsyncSchema  // TS2677 error here
{
  return ('parseAsync' in maybeAsyncSchema);
}
```

### Root Cause
TypeScript cannot verify that complex conditional types in type predicates are assignable to the parameter type.
The compiler struggles with conditional types that depend on generic parameters, especially when trying to preserve the original type information.

### Solution
Use intersection types instead of conditional types in the type predicate:

```ts
export function maybeAsyncSchemaIsSchemaAsync<const Input = unknown,
  const Output = unknown,
  const MyMaybeAsyncSchema extends MaybeAsyncSchema<Input, Output> = MaybeAsyncSchema<
    Input,
    Output
  >,>(
  maybeAsyncSchema: MyMaybeAsyncSchema,
): maybeAsyncSchema is SchemaAsync<Input, Output> & MyMaybeAsyncSchema {
  return ('parseAsync' in maybeAsyncSchema);
}
```

### Why This Works
- The intersection type `SchemaAsync<Input, Output> & MyMaybeAsyncSchema` is always assignable to `MyMaybeAsyncSchema` (since it includes it)
- It preserves the specific type information of the input parameter
- It avoids the conditional type complexity that TypeScript cannot verify
- The type guard remains useful for narrowing types in calling code

### Common Pitfall to Avoid
Don't simplify by removing generic parameters entirely:
```ts
// BAD: Loses type precision
function maybeAsyncSchemaIsSchemaAsync<Input, Output>(
  maybeAsyncSchema: MaybeAsyncSchema<Input, Output>,
): maybeAsyncSchema is SchemaAsync<Input, Output>
```
This throws away the specific schema type information, making the type guard less useful for preserving types in calling code.

## Related Documentation

- [ESLint Configuration](./TROUBLESHOOTING.eslint.md) - ESLint and TypeScript parser issues
- [VSCode](./TROUBLESHOOTING.vscode.md) - VSCode extension configuration for TypeScript tools
- [Toolchain](./TROUBLESHOOTING.toolchain.md) - Build tools and toolchain management
- [Stylelint](./TROUBLESHOOTING.stylelint.md) - CSS linting configuration issues