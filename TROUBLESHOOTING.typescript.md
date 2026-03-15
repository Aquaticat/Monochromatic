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

## All packages must extend `config-typescript/dom`

### Problem

`tsgo --build` reports errors like `Cannot find name 'FileSystemWritableFileStream'` or
`Property 'storage' does not exist on type 'Navigator'` in a package that never uses browser APIs directly.

```txt
../../module/es/src/types/.../t opfs/p p/index.ts(8,15): error TS2304: Cannot find name 'FileSystemWritableFileStream'.
../../module/es/src/types/.../t opfs/p p/index.ts(24,38): error TS2339: Property 'storage' does not exist on type 'Navigator'.
```

### Root cause

`module-es` exports raw `.ts` source files via its `exports` map (e.g. `"./logger": "./src/..."`).
When another package imports from `module-es`, tsgo checks those source files under the **consumer's** tsconfig, not module-es's.
If the consumer extends the base config (`config-typescript`) which only has `"lib": ["ESNext"]`,
DOM types like `FileSystemWritableFileStream` and `navigator.storage` are missing.

Non-browser runtimes may adopt browser APIs over time,
so separating into `/dom` vs non-`/dom` configs provides no future-proofing benefit
and causes false positives instead.

### Solution

Every package tsconfig must extend `@monochromatic-dev/config-typescript/dom` (not the base export).
This adds `"lib": ["ESNext", "DOM", "WebWorker"]` so all standard platform types are available
regardless of the package's target runtime.

```json
{
  "extends": "@monochromatic-dev/config-typescript/dom"
}
```

## Narrowing not preserved inside function declarations

### Problem

A `const` variable narrowed by a null check before a function declaration
still reports the nullable type inside the function body:

```ts
const el = document.querySelector<HTMLDivElement>('#app');
if (el === null) {
  throw new Error('missing');
}

// TS18047: 'el' is possibly 'null'.
function setup(): void {
  console.log(el.clientWidth);
}
```

Replacing the function declaration with a function expression or arrow eliminates the error:

```ts
const setup = function (): void {
  console.log(el.clientWidth); // OK
};
```

### Root cause

TypeScript's control flow analysis extends narrowing across closure boundaries
only for certain node kinds.
The `while` loop in `checker.ts` (around line 31181 in the tsc 6.0 source) checks:

```ts
// checker.ts — getTypeOfSymbolAtLocation, inner narrowing loop
while (
    flowContainer !== declarationContainer && (
        flowContainer.kind === SyntaxKind.FunctionExpression ||
        flowContainer.kind === SyntaxKind.ArrowFunction ||
        isObjectLiteralOrClassExpressionMethodOrAccessor(flowContainer)
    ) && (
        isConstantVariable(localOrExportSymbol) && type !== autoArrayType ||
        isParameterOrMutableLocalVariable(localOrExportSymbol) && isPastLastAssignment(localOrExportSymbol, node)
    )
) {
    flowContainer = getControlFlowContainer(flowContainer);
}
```

`SyntaxKind.FunctionDeclaration` is intentionally absent.
Function declarations are hoisted,
so a call site can appear **before** the narrowing guard in source order:

```ts
const el = document.querySelector<HTMLDivElement>('#app');

setup(); // runs before the null check below

if (el === null) { throw new Error('missing'); }

function setup(): void {
  // el is genuinely nullable here at runtime
  console.log(el.clientWidth);
}
```

Because hoisting makes the call-before-guard pattern legal,
TypeScript conservatively refuses to narrow inside function declarations.
Function expressions and arrows are bound to a `const`,
so they cannot be invoked before their definition,
making narrowing safe to propagate.

This behavior is the same in tsc (6.0.1-rc) and tsgo (7.0.0-dev).

### Solutions

**Return non-null from a helper function.**
The return type carries the narrowed type into all callers
regardless of declaration kind:

```ts
function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}

const el = requireElement<HTMLDivElement>('#app');
// el is HTMLDivElement (non-null) everywhere
function setup(): void {
  console.log(el.clientWidth); // OK
}
```

**Reassign to a new `const` with an explicit type annotation**
after the null check.
The explicit annotation becomes the variable's declared type,
which is non-null regardless of closure context:

```ts
const maybeEl = document.querySelector<HTMLDivElement>('#app');
if (maybeEl === null) {
  throw new Error('missing');
}
const el: HTMLDivElement = maybeEl;

function setup(): void {
  console.log(el.clientWidth); // OK
}
```

### What does not work

- Combining multiple null checks into one `if` guard --
  the same hoisting concern applies per-variable
- `asserts` functions -- they narrow the **parameter**
  in the caller's flow, but the narrowed binding is still a `const`
  subject to the same closure rules
- Adding `as HTMLDivElement` --
  suppresses the error but is flagged by `no-unsafe-type-assertion`

## JSR packages ship `.ts` source files that `skipLibCheck` cannot skip

### Problem

`tsgo --build` reports type errors **inside `node_modules`**
from JSR packages like `@zod/zod`:

```txt
node_modules/.bun/@jsr+zod__zod@4.3.6/…/src/v4/core/schemas.ts(2088,19): error TS2532: Object is possibly 'undefined'.
node_modules/.bun/@jsr+zod__zod@4.3.6/…/src/v4/core/schemas.ts(2130,17): error TS2532: Object is possibly 'undefined'.
node_modules/.bun/@jsr+zod__zod@4.3.6/…/src/v4/core/util.ts(930,41): error TS2345: Argument of type 'number | undefined' is not assignable to parameter of type 'number'.
node_modules/.bun/@jsr+zod__zod@4.3.6/…/src/v4/locales/he.ts(44,17): error TS18048: 'TypeNames.unknown' is possibly 'undefined'.
```

These errors appear despite `skipLibCheck: true` in tsconfig.
The errors are all `| undefined` narrowing failures --
the library's code is correct but was not written for `noUncheckedIndexedAccess: true`.

### Root cause

Four things combine to create this problem:

**JSR ships `.ts` source files, not `.d.ts` declarations.**
The `@jsr/zod__zod` package contains both `.ts` and `.js` for every module.
The `package.json` exports point to `.js` files,
but no `.d.ts` declaration files exist:

```jsonc
// node_modules/@jsr/zod__zod/package.json
{ "exports": { ".": { "default": "./src/index.js" } } }
```

```txt
src/v4/core/
  schemas.ts   schemas.js   schemas.js.map
  util.ts      util.js      util.js.map
  // no .d.ts files anywhere
```

**TypeScript's bundler resolution prefers `.ts` over `.js`.**
When an export points to `./src/index.js`,
the resolver strips the `.js` extension and tries candidates in a fixed priority order.
From `typescript-go/internal/module/resolver.go` line 1471:

```go
case tspath.ExtensionTs, tspath.ExtensionDts, tspath.ExtensionJs, "":
    if extensions&extensionsTypeScript != 0 {
        r.tryExtension(tspath.ExtensionTs, …)   // 1st: .ts
        r.tryExtension(tspath.ExtensionTsx, …)  // 2nd: .tsx
    }
    if extensions&extensionsDeclaration != 0 {
        r.tryExtension(tspath.ExtensionDts, …)  // 3rd: .d.ts
    }
    if extensions&extensionsJavaScript != 0 {
        r.tryExtension(tspath.ExtensionJs, …)   // 4th: .js (never reached)
    }
```

The `.ts` sibling is found at step 1 and the `.js` export is never used.
This priority order is hardcoded -- no tsconfig option changes it.
The `extensionsTypeScript` bit is always set for regular imports
(line 117: `state.extensions = extensionsTypeScript | extensionsJavaScript | extensionsDeclaration`).

**`skipLibCheck` only covers `.d.ts` files, not `.ts` files.**
From `typescript-go/internal/compiler/program.go` line 562:

```go
func (p *Program) SkipTypeChecking(sourceFile *ast.SourceFile, ignoreNoCheck bool) bool {
    return (!ignoreNoCheck && p.Options().NoCheck.IsTrue()) ||
        p.Options().SkipLibCheck.IsTrue() && sourceFile.IsDeclarationFile ||
        // …
}
```

`IsDeclarationFile` is only true for `.d.ts` files.
The `.ts` source files from JSR packages are type-checked
under the **consumer's** tsconfig settings, not the library's.

**Zod was not written for `noUncheckedIndexedAccess: true`.**
Array index access like `nonaborted[0]` returns `T | undefined` under this flag.
Zod's code assumes the index is valid after a `.length` check,
which TypeScript cannot prove:

```ts
// schemas.ts:2087-2088 — TS2532 here
const nonaborted = results.filter((r) => !util.aborted(r));
if (nonaborted.length === 1) {
    final.value = nonaborted[0].value; // Object is possibly 'undefined'
}

// util.ts:930 — TS2345 here
binaryString += String.fromCharCode(bytes[i]); // Argument of type 'number | undefined'
```

### TypeScript team's position

The TypeScript team has closed multiple issues about this as **"Working as Intended"**:

- [microsoft/TypeScript#41883](https://github.com/microsoft/TypeScript/issues/41883) --
  `skipLibCheck` ignored when `types` points to `.ts`.
  Ryan Cavanaugh: "skipLibCheck causes the 'check each top-level statement or declaration' step
  to not occur for `.d.ts` files. It has no other effect. It does nothing in `.ts` files."
- [microsoft/TypeScript#44205](https://github.com/microsoft/TypeScript/issues/44205) --
  request to not apply strict checks to `node_modules`. **Declined.**
  "The only correct path forward is to not have a .ts file in your node_modules."
- [microsoft/TypeScript#48779](https://github.com/microsoft/TypeScript/issues/48779) --
  `noUncheckedIndexedAccess` errors in `node_modules`.
  Closed as duplicate of #44205.
- [microsoft/TypeScript#40426](https://github.com/microsoft/TypeScript/issues/40426) --
  "Disable type checking for node_modules entirely."
  Still open, labeled "Awaiting More Feedback", no action.

tsgo inherits the same semantics. No planned fix.

### Solution: wrapper script that strips `node_modules` errors

Since no tsconfig option can suppress these errors,
the `lint:types` mise task wraps `tsgo --build`
in a script that filters out diagnostics originating from `node_modules` paths.

The wrapper:
1. Runs `tsgo --build` (or `tsgo --build --noEmit`, etc.) with all original arguments
2. Captures stdout/stderr line by line
3. Drops any line whose file path contains `/node_modules/`
4. Drops continuation lines (indented lines following a dropped diagnostic)
5. Preserves the exit code: exits non-zero only if non-`node_modules` errors remain

This is the least invasive option because:
- It does not modify `node_modules` (unlike `bun patch`)
- It does not sacrifice type safety (unlike `declare module` with `any`)
- It does not introduce version-drift risk (unlike installing npm zod alongside JSR zod)
- It does not require maintaining generated `.d.ts` files across package updates
- It works for **any** JSR package that ships `.ts`, not just zod

### Alternatives considered

**Switch to npm zod.**
The npm `zod` package ships `.d.ts` + `.js`, so `skipLibCheck` works.
This is the simplest fix but ties us to npm
and loses JSR's advantage of direct `.ts` source for editor go-to-definition.

**`bun patch` to convert `.ts` to `.d.ts`.**
Patch the JSR package to generate `.d.ts` files and delete `.ts` sources.
Works in principle, but zod's complex types may fail declaration generation,
and the patch must be re-applied on every zod update.

**`paths` redirect with explicit `.d.ts` extension.**
`resolver.go` line 1225 shows that `paths` substitutions with an explicit file extension
call `tryFile` directly, bypassing the `.ts`-sibling preference:

```go
if extension := tspath.TryGetExtensionFromPath(subst); extension != "" {
    if path, ok := r.tryFile(candidate, onlyRecordFailures); ok {
        return &resolved{path: path, extension: extension}
    }
}
```

So `"paths": { "zod": ["./typings/zod.d.ts"] }` would resolve directly to the `.d.ts`
and `skipLibCheck` would cover it. But you need a source for the `.d.ts` types --
either generating them (same fragility as the patch approach)
or installing npm zod in parallel (version drift).

**`declare module 'zod'` ambient override.**
Ambient module declarations only take effect when normal resolution fails.
Since `zod` resolves fine through `node_modules`, the ambient declaration is ignored.

### References

- [JSR @zod/zod](https://jsr.io/@zod/zod) -- the source of the `.ts`-shipping package
- [TypeScript tsconfig: skipLibCheck](https://www.typescriptlang.org/tsconfig/skipLibCheck.html) -- only `.d.ts`
- [typescript-go resolver.go](https://github.com/microsoft/typescript-go/blob/main/internal/module/resolver.go) -- extension priority and `paths` bypass
- [typescript-go program.go](https://github.com/microsoft/typescript-go/blob/main/internal/compiler/program.go) -- `SkipTypeChecking` implementation

## Related Documentation

- [ESLint Configuration](./TROUBLESHOOTING.eslint.md) - ESLint and TypeScript parser issues
- [VSCode](./TROUBLESHOOTING.vscode.md) - VSCode extension configuration for TypeScript tools
- [Toolchain](./TROUBLESHOOTING.toolchain.md) - Build tools and toolchain management
- [Stylelint](./TROUBLESHOOTING.stylelint.md) - CSS linting configuration issues
