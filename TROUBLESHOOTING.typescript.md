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

## JSX.IntrinsicElements Missing in Astro MDX Files

### Problem
In VS Code, MDX files in Astro projects show TypeScript error ts-plugin(7026):
```txt
JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
```

This affects HTML elements like `<abbr>`, `<sub>`, `<sup>`, `<kbd>`, `<mark>`, etc. in MDX content.

### Root Cause
The `@types/mdx` package expects a global `JSX.IntrinsicElements` interface, which is normally provided by `@types/react`.
Astro defines its JSX types under `astroHTML.JSX` namespace, not the global `JSX` namespace.

From the MDX documentation:
> "For types to work, the `JSX` namespace must be typed. This is done by installing and using the types of your framework, such as `@types/react`."

This creates an incompatibility when using MDX with Astro without React.

### Solution
Create `src/env.d.ts` in your Astro project that bridges the namespaces:

```ts
/// <reference types="astro/client" />

declare namespace JSX {
  type Element = astroHTML.JSX.Element;
  type IntrinsicElements = astroHTML.JSX.IntrinsicElements;
}
```

This maps Astro's JSX types to the global namespace that `@types/mdx` expects.

### Note
- This is an IDE/editor type-checking issue; `skipLibCheck: true` in tsconfig prevents this from blocking builds
- Each Astro project using MDX with TypeScript needs this `env.d.ts` file
- The Astro-generated `.astro/types.d.ts` includes `astro/client` but doesn't bridge to the global `JSX` namespace

### References
- [Astro GitHub Issue #5061](https://github.com/withastro/astro/issues/5061)
- [MDX Getting Started - Types](https://mdxjs.com/docs/getting-started/#types)
- [Astro TypeScript - Extending global types](https://docs.astro.build/en/guides/typescript/#extending-global-types)

## Related Documentation

- [ESLint Configuration](./TROUBLESHOOTING.eslint.md) - ESLint and TypeScript parser issues
- [VSCode](./TROUBLESHOOTING.vscode.md) - VSCode extension configuration for TypeScript tools
- [Toolchain](./TROUBLESHOOTING.toolchain.md) - Build tools and toolchain management
- [Stylelint](./TROUBLESHOOTING.stylelint.md) - CSS linting configuration issues
