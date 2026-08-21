# TypeScript aggregator (native tsc 7.0.1-rc and classic tsc6 6.0.x): eight failure modes from dprint baseUrl warnings through a stale-declaration type check

This file aggregates eight distinct TypeScript-related failure modes
encountered across the workspace.
 Each section follows the
troubleshooting-doc canonical structure (Symptom / Root cause /
Verification / Workaround / What does not work / 5-constraint
upstream-filing audit / Draft issue if warranted).
 Sections written
before the canonicalization push use "Problem" / "Solution" / "Root
Cause" headings,
 kept as-is to preserve git history;
 the content
matches the canonical shape.

## TypeScript Path Warnings with dprint

### Problem

You see warnings when running dprint or other tools:

```txt
warn: Non-relative path "package/config/oxlint/src/index.ts" is not allowed when "baseUrl" is not set (did you forget a leading "./"?)
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

This tells TypeScript to resolve non-relative paths from the project root,
 which is necessary when using path mappings in a monorepo structure.

### Note

Setting `baseUrl` may or may not completely resolve the warnings,
 but it helps TypeScript understand that non-relative paths in the `paths` mapping should be resolved from the project root.

### Verification

Reproduced under tsc 6.0.
x and dprint 0.
x.
 Trigger:
 any `paths` map
entry without a leading `./` when `baseUrl` is unset.

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** No. TypeScript / dprint correctly require
   `baseUrl` to be set when `paths` contains non-relative entries;
    the
   warning is informative,
    not a bug.
2. **Can upstream fix it?
   ** Not applicable;
    this is documented behavior.
3. **Supporting this use case?
   ** Yes;
    `paths` + `baseUrl` is a
   first-class TypeScript feature.
4. **Will they fix it?
   ** Not applicable.
5. **Minimal-fix prototype?
   ** Not applicable.

**Decision:
 no upstream report.
** Workspace config fix is the
correct response.

## Type Predicate Assignment Errors

### Problem

You encounter TypeScript error TS2677:
 "A type predicate's type must be assignable to its parameter's type" when using complex conditional types in type predicates:

```ts
export function maybeAsyncSchemaIsSchemaAsync<
  const MyMaybeAsyncSchema extends MaybeAsyncSchema = MaybeAsyncSchema,
>(
  maybeAsyncSchema: MyMaybeAsyncSchema,
): maybeAsyncSchema is MyMaybeAsyncSchema extends
  SchemaAsync<infer Input, infer Output> ? SchemaAsync<Input, Output>
  : Schema & MyMaybeAsyncSchema // TS2677 error here
{
  return ('parseAsync' in maybeAsyncSchema);
}
```

### Root Cause

TypeScript cannot verify that complex conditional types in type predicates are assignable to the parameter type.
The compiler struggles with conditional types that depend on generic parameters,
 especially when trying to preserve the original type information.

### Solution

Use intersection types instead of conditional types in the type predicate:

```ts
export function maybeAsyncSchemaIsSchemaAsync<const Input = unknown,
  const Output = unknown,
  const MyMaybeAsyncSchema extends MaybeAsyncSchema<Input, Output> =
    MaybeAsyncSchema<
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
function maybeAsyncSchemaIsSchemaAsync<Input, Output,>(
  maybeAsyncSchema: MaybeAsyncSchema<Input, Output>,
): maybeAsyncSchema is SchemaAsync<Input, Output>;
```

This throws away the specific schema type information,
 making the type guard less useful for preserving types in calling code.

### Verification

Reproduced under tsc 6.0.
x (tsgo 7.0.0-dev exhibits identical
behavior).
 Trigger:
 type predicate with conditional type body
referencing the function's generic parameter.

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** Partial.
    TS2677 is a known limitation of
   conditional-type assignability in type predicates,
    documented in
   the TypeScript handbook as a constraint of the type system rather
   than a bug.
2. **Can upstream fix it?
   ** Possibly,
    but the fix would require
   extending conditional-type variance reasoning,
    a structural-core
   change touching the type relation algorithm.
    Not a small change.
3. **Supporting this use case?
   ** Conditional types in type predicates
   are not a documented first-class feature;
    the recommendation is
   intersection types as shown above.
4. **Will they fix it?
   ** Unlikely.
    Multiple long-standing tracker
   entries on conditional-type-in-predicate produce no movement.
5. **Minimal-fix prototype?
   ** Not feasible without touching the type
   relation core.

**Decision:
 no upstream report.
** The intersection-type workaround
satisfies the use case;
 the limitation is accepted as a tradeoff of
the type system's design.

## JSX.IntrinsicElements Missing in Astro MDX Files

### Problem

In VS Code,
 MDX files in Astro projects show TypeScript error ts-plugin(7026):

```txt
JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
```

This affects HTML elements like `<abbr>`,
 `<sub>`,
 `<sup>`,
 `<kbd>`,
 `<mark>`,
 etc. in MDX content.

### Root Cause

The `@types/mdx` package expects a global `JSX.IntrinsicElements` interface,
 which is normally provided by `@types/react`.
Astro defines its JSX types under `astroHTML.JSX` namespace,
 not the global `JSX` namespace.

From the MDX documentation:

> "For types to work,
>  the `JSX` namespace must be typed.
>  This is done by installing and using the types of your framework,
>  such as `@types/react`.
> "

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

- This is an IDE/editor type-checking issue;
   `skipLibCheck: true` in tsconfig prevents this from blocking builds
- Each Astro project using MDX with TypeScript needs this `env.d.ts` file
- The Astro-generated `.astro/types.d.ts` includes `astro/client` but doesn't bridge to the global `JSX` namespace

### References

- [Astro GitHub Issue #5061](https://github.com/withastro/astro/issues/5061)
- [MDX Getting Started - Types](https://mdxjs.com/docs/getting-started/#types)
- [Astro TypeScript - Extending global types](https://docs.astro.build/en/guides/typescript/#extending-global-types)

### Verification

Reproduced under Astro 4.
x with `@types/mdx@2.x` and VS Code's
TypeScript language service (any tsc 5.
x or later).
 Trigger:
 any MDX
file containing native HTML elements like `<abbr>`,
 `<sub>`,
 `<kbd>`
inside an Astro project that does not also depend on `@types/react`.

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** Distributed across Astro and @types/mdx.
    MDX
   documentation explicitly says "the JSX namespace must be typed";
   Astro chose to define JSX types under `astroHTML.JSX` namespace
   rather than the global `JSX` namespace.
    Neither side considers it
   a bug.
2. **Can upstream fix it?
   ** Yes,
    either by Astro adding a global
   `JSX` re-export or by @types/mdx accepting a different namespace
   prefix.
    Both are tractable but require coordination.
3. **Supporting this use case?
   ** Astro+MDX without React is a
   documented configuration,
    but the namespace bridging step is
   left to the user.
4. **Will they fix it?
   ** Astro issue #5061 has been open for years
   without movement.
    Low signal of a fix.
5. **Minimal-fix prototype?
   ** The workspace-side bridge
   (`src/env.d.ts`) is the minimal fix;
    no upstream code change is
   strictly required.

**Decision:
 no upstream report.
** Existing Astro issue #5061 already
tracks the namespace question;
 the workspace-side bridge satisfies
the use case.

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
When another package imports from `module-es`,
 tsgo checks those source files under the **consumer's** tsconfig,
 not module-es's.
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

### Verification

Reproduced under tsgo 7.0.0-dev `--build`,
 tsc 6.0.
x exhibits the
same.
 Trigger:
 package extends the base `@monochromatic-dev/config-typescript`
(lib:
 ESNext only) and imports a workspace package that re-exports
raw `.ts` from a module touching `FileSystemWritableFileStream`,
`navigator.storage`,
 or other DOM/WebWorker types.

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** No. TypeScript checks consumed `.ts` files
   under the consumer's tsconfig by design;
    the lib setting is
   inherited from the consumer,
    not the package.
    This is documented
   compiler behavior.
2. **Can upstream fix it?
   ** Yes (in principle:
    per-package lib
   resolution),
    but it would be a structural change to lib resolution.
3. **Supporting this use case?
   ** Workspace packages re-exporting raw
   `.ts` sources is a non-standard pattern;
    standard practice ships
   `.d.ts` declarations.
4. **Will they fix it?
   ** Not on the roadmap.
5. **Minimal-fix prototype?
   ** Workspace-side fix (extending `/dom`
   variant) is the minimal solution;
    no upstream change needed.

**Decision:
 no upstream report.
** The workspace convention (extend
`config-typescript/dom` everywhere) satisfies the constraint at the
workspace boundary.

## Narrowing not preserved inside function declarations

### Problem

A `const` variable narrowed by a null check before a function declaration
still reports the nullable type inside the function body:

```ts
const el = document.querySelector<HTMLDivElement>('#app',);
if (el === null)
  throw new Error('missing',);

// TS18047: 'el' is possibly 'null'.
function setup(): void {
  console.log(el.clientWidth,);
}
```

Replacing the function declaration with a function expression or arrow eliminates the error:

```ts
const setup = function(): void {
  console.log(el.clientWidth,); // OK
};
```

### Root cause

TypeScript's control flow analysis extends narrowing across closure boundaries
only for certain node kinds.
The `while` loop in `checker.ts` (around line 31181 in the tsc 6.0 source) checks:

```ts
// checker.ts: getTypeOfSymbolAtLocation, inner narrowing loop
while (
  flowContainer !== declarationContainer && (
    flowContainer.kind === SyntaxKind.FunctionExpression
    || flowContainer.kind === SyntaxKind.ArrowFunction
    || isObjectLiteralOrClassExpressionMethodOrAccessor(flowContainer,)
  ) && (
    isConstantVariable(localOrExportSymbol,) && type !== autoArrayType
    || isParameterOrMutableLocalVariable(localOrExportSymbol,)
      && isPastLastAssignment(localOrExportSymbol, node,)
  )
) {
  flowContainer = getControlFlowContainer(flowContainer,);
}
```

`SyntaxKind.FunctionDeclaration` is intentionally absent.
Function declarations are hoisted,
so a call site can appear **before** the narrowing guard in source order:

```ts
const el = document.querySelector<HTMLDivElement>('#app',);

setup(); // runs before the null check below

if (el === null)
  throw new Error('missing',);

function setup(): void {
  // el is genuinely nullable here at runtime
  console.log(el.clientWidth,);
}
```

Because hoisting makes the call-before-guard pattern legal,
TypeScript conservatively refuses to narrow inside function declarations.
Function expressions and arrows are bound to a `const`,
so they cannot be invoked before their definition,
making narrowing safe to propagate.

This behavior is the same in tsc (6.0.1-rc) and tsgo (7.0.0-dev).

### Solutions

**Return non-null from a helper function.
**
The return type carries the narrowed type into all callers
regardless of declaration kind:

```ts
function requireElement<T extends Element,>(selector: string,): T {
  const element = document.querySelector<T>(selector,);
  if (element === null)
    throw new Error(`Missing required element: ${selector}`,);
  return element;
}

const el = requireElement<HTMLDivElement>('#app',);
// el is HTMLDivElement (non-null) everywhere
function setup(): void {
  console.log(el.clientWidth,); // OK
}
```

**Reassign to a new `const` with an explicit type annotation**
after the null check.
The explicit annotation becomes the variable's declared type,
which is non-null regardless of closure context:

```ts
const maybeEl = document.querySelector<HTMLDivElement>('#app',);
if (maybeEl === null)
  throw new Error('missing',);
const el: HTMLDivElement = maybeEl;

function setup(): void {
  console.log(el.clientWidth,); // OK
}
```

### What does not work

- Combining multiple null checks into one `if` guard:
  the same hoisting concern applies per-variable
- `asserts` functions;
   they narrow the **parameter**
  in the caller's flow,
   but the narrowed binding is still a `const`
  subject to the same closure rules
- Adding `as HTMLDivElement`:
  suppresses the error but is flagged by `no-unsafe-type-assertion`

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** No. The cited code in `checker.ts` (around
   line 31181) deliberately excludes `SyntaxKind.FunctionDeclaration`
   from the closure-narrowing loop because hoisting makes
   call-before-guard legal.
    The behavior is intentional safety,
    not
   a bug.
2. **Can upstream fix it?
   ** Possibly (via flow analysis that
   distinguishes "definitely called after the guard" from "could be
   called before"),
    but this would be a significant change to the
   control-flow analyzer that could regress soundness in edge cases.
3. **Supporting this use case?
   ** The recommended pattern is helper
   functions returning non-null or explicit reassignment with
   annotation;
    both are documented and idiomatic.
4. **Will they fix it?
   ** Not on the roadmap.
    The intentional
   exclusion has been in place across multiple TypeScript major
   versions (verified consistent in tsc 6.0.1-rc and tsgo 7.0.0-dev).
5. **Minimal-fix prototype?
   ** Not feasible without proving soundness
   of the new flow-analysis branch.

**Decision:
 no upstream report.
** Workarounds are well-understood
and idiomatic.
 The behavior is correctly defensive given hoisting
semantics.

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
The errors are all `| undefined` narrowing failures:
the library's code is correct but was not written for `noUncheckedIndexedAccess: true`.

### Root cause

Four things combine to create this problem:

**JSR ships `.ts` source files,
 not `.d.ts` declarations.
**
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

**TypeScript's bundler resolution prefers `.ts` over `.js`.
**
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
This priority order is hardcoded:
 no tsconfig option changes it.
The `extensionsTypeScript` bit is always set for regular imports
(line 117:
 `state.extensions = extensionsTypeScript | extensionsJavaScript | extensionsDeclaration`).

**`skipLibCheck` only covers `.d.ts` files,
 not `.ts` files.
**
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
under the **consumer's** tsconfig settings,
 not the library's.

**Zod was not written for `noUncheckedIndexedAccess: true`.
**
Array index access like `nonaborted[0]` returns `T | undefined` under this flag.
Zod's code assumes the index is valid after a `.length` check,
which TypeScript cannot prove:

```ts
// schemas.ts:2087-2088: TS2532 here
const nonaborted = results.filter(r => !util.aborted(r,));
if (nonaborted.length === 1)
  final.value = nonaborted[0].value; // Object is possibly 'undefined'

// util.ts:930: TS2345 here
binaryString += String.fromCharCode(bytes[i],); // Argument of type 'number | undefined'
```

### TypeScript team's position

The TypeScript team has closed multiple issues about this as **"Working as Intended"**:

- [microsoft/TypeScript#41883](https://github.com/microsoft/TypeScript/issues/41883):
  `skipLibCheck` ignored when `types` points to `.ts`.
  Ryan Cavanaugh:
   "skipLibCheck causes the 'check each top-level statement or declaration' step
  to not occur for `.d.ts` files.
   It has no other effect.
   It does nothing in `.ts` files.
  "
- [microsoft/TypeScript#44205](https://github.com/microsoft/TypeScript/issues/44205):
  request to not apply strict checks to `node_modules`.
   **Declined.
  **
  "The only correct path forward is to not have a .
  ts file in your node_modules.
  "
- [microsoft/TypeScript#48779](https://github.com/microsoft/TypeScript/issues/48779):
  `noUncheckedIndexedAccess` errors in `node_modules`.
  Closed as duplicate of #44205.
- [microsoft/TypeScript#40426](https://github.com/microsoft/TypeScript/issues/40426):
  "Disable type checking for node_modules entirely.
  "
  Still open,
   labeled "Awaiting More Feedback",
   no action.

tsgo inherits the same semantics.
 No planned fix.

### Solution: wrapper script that strips `node_modules` errors

Since no tsconfig option can suppress these errors,
the `lint:types` mise task wraps the native `tsc --build`
in a script that filters out diagnostics originating from `node_modules` paths.

The wrapper:

1. Runs `tsc --build` (or `tsc --build --noEmit`,
    etc.) with all original arguments
2. Captures stdout/stderr line by line
3. Drops any line whose file path contains `/node_modules/`
4. Drops continuation lines (indented lines following a dropped diagnostic)
5. Preserves the exit code:
    exits non-zero only if non-`node_modules` errors remain

This is the least invasive option because:

- It does not modify `node_modules` (unlike `bun patch`)
- It does not sacrifice type safety (unlike `declare module` with `any`)
- It does not introduce version-drift risk (unlike installing npm zod alongside JSR zod)
- It does not require maintaining generated `.d.ts` files across package updates
- It works for **any** JSR package that ships `.ts`,
   not just zod

### Alternatives considered

**Switch to npm zod.
**
The npm `zod` package ships `.d.ts` + `.js`,
 so `skipLibCheck` works.
This is the simplest fix but ties us to npm
and loses JSR's advantage of direct `.ts` source for editor go-to-definition.

**`bun patch` to convert `.ts` to `.d.ts`.
**
Patch the JSR package to generate `.d.ts` files and delete `.ts` sources.
Works in principle,
 but zod's complex types may fail declaration generation,
and the patch must be re-applied on every zod update.

**`paths` redirect with explicit `.d.ts` extension.
**
`resolver.go` line 1225 shows that `paths` substitutions with an explicit file extension
call `tryFile` directly,
 bypassing the `.ts`-sibling preference:

```go
if extension := tspath.TryGetExtensionFromPath(subst); extension != "" {
    if path, ok := r.tryFile(candidate, onlyRecordFailures); ok {
        return &resolved{path: path, extension: extension}
    }
}
```

So `"paths": { "zod": ["./typings/zod.d.ts"] }` would resolve directly to the `.d.ts`
and `skipLibCheck` would cover it.
 But you need a source for the `.d.ts` types:
either generating them (same fragility as the patch approach)
or installing npm zod in parallel (version drift).

**`declare module 'zod'` ambient override.
**
Ambient module declarations only take effect when normal resolution fails.
Since `zod` resolves fine through `node_modules`,
 the ambient declaration is ignored.

### References

- [JSR @zod/zod](https://jsr.io/@zod/zod):
   the source of the `.ts`-shipping package
- [TypeScript tsconfig: skipLibCheck](https://www.typescriptlang.org/tsconfig/skipLibCheck.html):
   only `.d.ts`
- [typescript-go resolver.go](https://github.com/microsoft/typescript-go/blob/main/internal/module/resolver.go):
   extension priority and `paths` bypass
- [typescript-go program.go](https://github.com/microsoft/typescript-go/blob/main/internal/compiler/program.go):
   `SkipTypeChecking` implementation

### Why we do not file this upstream

5-constraint walk:

1. **Upstream's fault?
   ** No,
    per the TypeScript team's repeated
   stance.
    Cited issues (#41883,
    #44205,
    #48779,
    #40426) all
   closed or stalled with "Working as Intended" or "The only correct
   path forward is to not have a .
   ts file in your node_modules.
   "
   `skipLibCheck` is documented as `.d.ts`-only.
2. **Can upstream fix it?
   ** Yes (extend `skipLibCheck` to cover `.ts`
   in `node_modules`,
    or add a separate `skipNodeModulesCheck`
   option),
    but they have explicitly declined to do so.
3. **Supporting this use case?
   ** JSR's `.ts`-shipping is a JSR
   convention;
    TypeScript does not endorse it.
    The TypeScript team's
   stated path is "don't ship .
   ts to node_modules.
   "
4. **Will they fix it?
   ** No. Multiple closed-as-WAI issues with the
   same request.
    Filing a new one would duplicate #44205,
    #48779,
   #41883 without changing the outcome.
5. **Minimal-fix prototype?
   ** Even with a prototype,
    the team's
   position is structural ("don't have .
   ts in node_modules"),
    not
   missing-implementation.

**Decision:
 no upstream report.
** Filing would duplicate already-
declined issues.
 The workspace wrapper script that strips
`node_modules` diagnostics is the correct boundary fix.

## tsgo LSP panics on non-source files (SVG, PNG, etc.)

### Problem

The tsgo LSP crashes with a panic when a non-source file
exists in a directory covered by a `tsconfig.json`:

```txt
panic: ScriptKind must be specified when parsing source file:
  /var/home/user/Monochromatic/package/module/test/architecture.svg
```

### Root cause

The proximate cause is a missing `ScriptKind` guard in the LSP's `compilerHost.GetSourceFile`.
When a file with an unrecognized extension (like `.svg`) reaches the parser,
the parser panics because `ScriptKind` is `Unknown`.

All source references below are from commit `c0703e66` of `microsoft/typescript-go`.

**Step 1:
 `diskFile.Kind()` returns `ScriptKindUnknown` for `.svg`.
**

`internal/project/overlayfs.go:100-102`:

```go
func (f *diskFile) Kind() core.ScriptKind {
	return core.GetScriptKindFromFileName(f.fileName)
}
```

`internal/core/core.go:512-529` (the switch only handles TS/JS/JSON extensions):

```go
func GetScriptKindFromFileName(fileName string) ScriptKind {
	dotPos := strings.LastIndex(fileName, ".")
	if dotPos >= 0 {
		switch strings.ToLower(fileName[dotPos:]) {
		case tspath.ExtensionJs, tspath.ExtensionCjs, tspath.ExtensionMjs:
			return ScriptKindJS
		case tspath.ExtensionJsx:
			return ScriptKindJSX
		case tspath.ExtensionTs, tspath.ExtensionCts, tspath.ExtensionMts:
			return ScriptKindTS
		case tspath.ExtensionTsx:
			return ScriptKindTSX
		case tspath.ExtensionJson:
			return ScriptKindJSON
		}
	}
	return ScriptKindUnknown  // ← .svg lands here
}
```

**Step 2:
 `compilerHost.GetSourceFile` passes `Unknown` to the parse cache without checking.
**

`internal/project/compilerhost.go:95-102`:

```go
func (c *compilerHost) GetSourceFile(opts ast.SourceFileParseOptions) *ast.SourceFile {
	c.ensureAlive()
	if fh := c.sourceFS.GetFileByPath(opts.FileName, opts.Path); fh != nil {
		key := NewParseCacheKey(opts, fh.Hash(), fh.Kind())  // ← Kind() = ScriptKindUnknown
		return c.builder.parseCache.Acquire(key, fh)
	}
	return nil
}
```

**Step 3:
 the parse cache calls `parser.ParseSourceFile` with `ScriptKindUnknown`.
**

`internal/project/parsecache.go:30-38`:

```go
func NewParseCache(options RefCountCacheOptions) *ParseCache {
	return NewRefCountCache(
		options,
		func(key ParseCacheKey, fh FileHandle) *ast.SourceFile {
			file := parser.ParseSourceFile(key.SourceFileParseOptions, fh.Content(), key.ScriptKind)
			//                                                                       ^^^^^^^^^^^
			//                                                                       ScriptKindUnknown
			file.Hash = fh.Hash()
			return file
		},
	)
}
```

**Step 4:
 the parser panics.
**

`internal/parser/parser.go:288-291`:

```go
func (p *Parser) initializeState(opts ast.SourceFileParseOptions, sourceText string, scriptKind core.ScriptKind) {
	if scriptKind == core.ScriptKindUnknown {
		panic("ScriptKind must be specified when parsing source file: " + opts.FileName)
	}
```

**The extension guard in the file loader exists but is bypassed.
**

`internal/compiler/filesparser.go:68-95` has a guard in `parseTask.load()`:

```go
if tspath.HasExtension(t.normalizedFilePath) {
	compilerOptions := loader.opts.Config.CompilerOptions()
	allowNonTsExtensions := compilerOptions.AllowNonTsExtensions.IsTrue()
	if !allowNonTsExtensions {
		canonicalFileName := tspath.GetCanonicalFileName(t.normalizedFilePath, ...)
		if !loader.isSupportedExtension(canonicalFileName) {
			// ... add diagnostic and return early (line 93)
			return
		}
	}
}
```

This guard is bypassed for **inferred projects** because `NewInferredProject`
(`internal/project/project.go:100-121`) sets `AllowNonTsExtensions: core.TSTrue`
in its default compiler options:

```go
func NewInferredProject(
	currentDirectory string,
	compilerOptions *core.CompilerOptions,
	rootFileNames []string,
	builder *ProjectCollectionBuilder,
	logger *logging.LogTree,
) *Project {
	p := NewProject(inferredProjectName, KindInferred, currentDirectory, builder, logger)
	if compilerOptions == nil {
		compilerOptions = &core.CompilerOptions{
			AllowNonTsExtensions:       core.TSTrue,  // ← bypasses the guard
			// ...
		}
	}
```

When `AllowNonTsExtensions` is true,
 the guard at `filesparser.go:71` is skipped entirely,
and the file proceeds to `loader.parseSourceFile(t)` at line 108,
which calls `compilerHost.GetSourceFile` (step 2 above),
which passes the `ScriptKindUnknown` to the parser (step 4).

**The file scanning correctly filters by extension,
 but the SVG enters through a different path.
**

The `matchFiles` function (`internal/vfs/vfsmatch/vfsmatch.go:604-606`) checks extensions
during directory scanning:

```go
for _, file := range entries.Files {
	if len(v.extensions) > 0 && !tspath.FileExtensionIsOneOf(file, v.extensions) {
		continue  // ← SVG would be skipped here
	}
```

Confirmed:
 `tsgo --showConfig` resolves the `include` patterns correctly,
and the SVG does not match any include pattern.
The SVG enters the project through a path that bypasses this extension filter:
either through the inferred project's `AllowNonTsExtensions` override,
or through project reference resolution that feeds files directly to `compilerHost.GetSourceFile`
without checking `isSupportedExtension` first.

### Current status: partially mitigated, not fully resolved

The crash is triggered by editord forwarding non-source files to tsgo.
Two distinct paths lead to the panic:

1. **Spawn trigger**:
    when a non-source file is the first file opened
   for a project root,
    `pool.resolve({ type: 'tsgo' })` spawns tsgo
   with that file as the trigger.
    tsgo adds the file to the project
   during initialization and panics on the unsupported extension.

2. **Reuse + feature request**:
    when tsgo is already running
   (spawned earlier from a `.ts` file),
    and a non-source file is opened,
   feature request handlers (`withClient` for hover,
    inlayHints,
    etc.)
   call `pool.resolve()` which returns the existing client.
   The handler sends the request with the non-source file's URI.
   tsgo creates an inferred project for the unknown file,
   which triggers parsing and the ScriptKind panic.

tsgo does NOT crash from its own directory scanning:
`include`/`exclude` patterns work correctly during normal project loading
from a `.ts` trigger.

### Mitigations in place

**Include filter in `resolve()` gating ALL tsgo access** (`lsp-pool.ts`):
the `#resolveTsgoWithIncludeCheck` method runs the tsconfig include check
before returning ANY tsgo client:
 both reuse of existing clients and new spawns.
Files outside the project's declared include scope get `null`,
so tsgo never receives a non-source file URI through any code path:
`resolveAll` (didOpen lifecycle),
 `withClient` (feature requests),
 or direct calls.
The resolved include patterns are cached with a 2-minute TTL
via `resolveTsconfigIncludes` (`tsconfig-includes.ts`).

**Crash recovery with ScriptKind-aware retry** (`lsp-pool.ts`,
 `lsp-client.ts`):
on unexpected exit,
 editord parses stderr for the ScriptKind panic pattern.
For this specific crash,
 retry uses a flat 1 s interval (no backoff escalation)
since the crash resolves as soon as the user navigates away from the
non-source file.
 For other crashes,
 exponential backoff applies
(2 s base,
 doubling to 60 s cap).

**Base tsconfig `exclude` for non-source extensions** (`tsconfig.options.json`):
added as belt-and-suspenders for the CLI path.
Verified to work for `tsgo --build` but does not prevent the LSP crash.

### What does not work

- **tsconfig `include`/`exclude` patterns in LSP mode**:
  these work for CLI `tsgo --build` and for normal project loading
  when tsgo is spawned by a `.ts` trigger,
  but do not prevent the crash when tsgo is spawned by a non-source trigger.
  The LSP's `DidOpenFile` → `ensureConfiguredProjectAndAncestorsForFile`
  likely adds the trigger file as a root file name,
  bypassing `matchFiles` extension filtering.
- **Shadow root / symlink directory**:
  pnpm workspace `node_modules` resolution breaks because `${configDir}`
  resolves to the shadow path and the nested `node_modules` structure
  does not contain hoisted dependencies.
- **Restarting without any delay**:
  creates a crash loop;
   the 1 s flat retry gives time for the user
  to navigate away from the problematic file.

### Previously broken: filtering only spawns, not reuse

Two earlier approaches failed because they only gated part of the problem:

1. **Filtering only in `resolveAll`**:
   feature request handlers call `pool.resolve()` directly via `withClient`,
   bypassing the `resolveAll` include filter entirely.
2. **Filtering only before spawning in `resolve()`**:
   returning an existing tsgo client for a non-source file is just as
   dangerous as spawning a new one:
    the feature request sends the file URI
   to tsgo,
    which creates an inferred project and panics.

**Fixed** by checking tsconfig includes as the very first step in `resolve()`
for tsgo,
 before both pool cache lookup and spawn.
`#resolveTsgoWithIncludeCheck` returns `null` for non-matching files
regardless of whether a tsgo client exists for the project root.

### References

- [microsoft/typescript-go PR #437](https://github.com/microsoft/typescript-go/pull/437):
   original extension guard (later bypassed)
- [microsoft/typescript-go PR #2004](https://github.com/microsoft/typescript-go/pull/2004):
   removed "unsupported extensions" concept
- [microsoft/typescript-go PR #1556](https://github.com/microsoft/typescript-go/pull/1556):
   improved panic message to include filename
- [microsoft/typescript-go#2669](https://github.com/microsoft/typescript-go/issues/2669):
  same crash in the completions LSP path,
   fixed by [PR #2679](https://github.com/microsoft/typescript-go/pull/2679)
- [denoland/deno#31423](https://github.com/denoland/deno/issues/31423):
  CSS imports causing the same `ScriptKind` panic
- [neovim/nvim-lspconfig#4018](https://github.com/neovim/nvim-lspconfig/issues/4018):
  filetype mismatch triggering the same crash
- Source commit:
   `c0703e66` of `microsoft/typescript-go`
- `internal/core/core.go:512-529`:
   `GetScriptKindFromFileName`
- `internal/parser/parser.go:288-291`:
   panic site
- `internal/project/compilerhost.go:95-102`:
   `GetSourceFile` missing guard
- `internal/project/overlayfs.go:100-102`:
   `diskFile.Kind()` returning `Unknown`
- `internal/project/parsecache.go:30-38`:
   parse cache forwarding `Unknown` to parser
- `internal/project/project.go:100-121`:
   `NewInferredProject` setting `AllowNonTsExtensions`
- `internal/compiler/filesparser.go:68-95`:
   extension guard (bypassed by `AllowNonTsExtensions`)

### Why we would file this upstream (5 constraints)

5-constraint walk:

1. **Upstream's fault?
   ** Yes.
    `compilerHost.GetSourceFile` passes
   `ScriptKindUnknown` to the parse cache without guarding,
    leading
   to a deliberate panic in `parser.initializeState`.
    The parser
   panic site exists specifically to flag this misuse (line
   288-291),
    so the calling code is buggy by the parser's own
   contract.
2. **Can upstream fix it?
   ** Yes;
    the suggested fix is a 4-line guard
   in `compilerHost.GetSourceFile`.
    PR #2679 already implemented the
   equivalent fix for the completions code path (issue #2669);
    the
   same pattern applies here.
3. **Supporting this use case?
   ** Yes.
    LSP support for projects
   containing mixed file types (SVG icons alongside .
   ts source) is a
   first-class scenario;
    the panic crashes the entire LSP,
    which is
   never the intended response.
4. **Will they fix it?
   ** Likely yes given the existing PR #2679 fix
   pattern.
    The completions team accepted the same shape of fix.
5. **Minimal-fix prototype?
   ** Yes;
    the suggested patch below is
   the prototype,
    with related-issue evidence that the fix shape is
   accepted upstream.

**Decision:
 file upstream.
** All five constraints hold.
 The draft
below is ready;
 re-validate against current microsoft/typescript-go
HEAD before filing in case the path got fixed in the meantime.

### Draft upstream issue (do not file as-is; re-validate against current microsoft/typescript-go HEAD before filing)

````md
**Title:** LSP panics on ScriptKindUnknown when non-source file reaches parser via compilerHost.GetSourceFile

**Labels:** bug, LSP

**Summary:**

The LSP server panics when it receives a feature request (e.g. hover,
inlayHints) for a non-source file (e.g. `.svg`, `.png`, `.css`).
tsgo creates an inferred project for the file, which triggers parsing
with `ScriptKindUnknown` and panics in `parser.initializeState`.

**tsgo version:** 7.0.0-dev.20260404.1

**Reproduction:**

1. Create a directory with a `tsconfig.json`:

   ```json
   {
     "compilerOptions": { "strict": true },
     "include": ["src/**/*.ts"]
   }
   ```

2. Add `src/index.ts` (any valid TypeScript file).
3. Add `architecture.svg` (any SVG file) in the same directory.
4. Start `tsgo --lsp --stdio` and send an `initialize` request with
   `rootUri` pointing to this directory.
5. Open `src/index.ts` via `textDocument/didOpen`.

tsgo panics with:

```text
panic: ScriptKind must be specified when parsing source file: /path/to/architecture.svg
```

**Root cause analysis:**

`compilerHost.GetSourceFile` (`internal/project/compilerhost.go:95-102`)
passes `fh.Kind()` to the parse cache without checking for
`ScriptKindUnknown`. `diskFile.Kind()`
(`internal/project/overlayfs.go:100-102`) delegates to
`GetScriptKindFromFileName` (`internal/core/core.go:512-529`),
which returns `ScriptKindUnknown` for any unrecognized extension.
The parse cache forwards this to `parser.ParseSourceFile`, which
panics at `internal/parser/parser.go:289-290`.

The extension guard in `filesparser.go:68-95` exists but is bypassed
when `AllowNonTsExtensions` is true (as set by `NewInferredProject`
at `internal/project/project.go:119`).

The `include` patterns correctly exclude the SVG (confirmed by
`--showConfig` and by `matchFiles` in `vfsmatch.go:604-606` filtering
by supported extensions). The file enters the project through a path
that bypasses the `matchFiles` extension filter.

**Suggested fix:**

Add a `ScriptKindUnknown` check in `compilerHost.GetSourceFile`
before calling `parseCache.Acquire`:

```go
func (c *compilerHost) GetSourceFile(opts ast.SourceFileParseOptions) *ast.SourceFile {
    c.ensureAlive()
    if fh := c.sourceFS.GetFileByPath(opts.FileName, opts.Path); fh != nil {
        kind := fh.Kind()
        if kind == core.ScriptKindUnknown {
            return nil
        }
        key := NewParseCacheKey(opts, fh.Hash(), kind)
        return c.builder.parseCache.Acquire(key, fh)
    }
    return nil
}
```

This is consistent with how the CLI's file loader handles
unsupported extensions (returning early with a diagnostic rather than
panicking).

**Related issues:**

- microsoft/typescript-go#2669 and #2679: same crash fixed in the
  completions code path.
- denoland/deno#31423: CSS imports causing the same panic.
- neovim/nvim-lspconfig#4018: filetype mismatch in LSP.
````

## Type check of a test file is only as current as the last build

### Symptom

`mise run //package/<path>:lint:types` reports zero errors while test files in
that package carry real type errors.
The same command,
 run again after `mise run //package/<path>:build` and with no source change in
between,
 reports them.

Observed 2026-08-20 in `package/module/translation-repair`,
 adding two required fields to `ChunkRepairOutcome`:
 the type check named the source construction sites,
 stayed silent about five test files whose fixtures were missing the same
fields,
 and named all seven test-file errors on the next run after a build.

### Root cause

Test files in this package import the BUILT bundle,
 not the source:

```ts
// package/module/translation-repair/src/repair-round-record.unit.test.ts
import { describeJudgedRound, } from '../dist/final/node/index.mjs';
```

251 of the package's test files import `../dist/final/node/index.mjs` or
`../../dist/final/node/index.mjs`.
TypeScript resolves those imports to `dist/final/node/index.d.mts`,
 which rolldown emits during `build` and which `lint:types` never regenerates.

So a test file is always checked against the declarations of the last
successful build.
Change a type in `src/`,
 run `lint:types`,
 and every source file is checked against the change while every test file is
checked against the shape it had before.

### Verification

A positive control,
 with the same source state throughout and only the build between the two runs:

```bash
# One required field added to a widely constructed type, filled in at every
# source construction site so the source half is clean.
mise run //package/module/translation-repair:lint:types   # 0 errors
mise run //package/module/translation-repair:build
mise run //package/module/translation-repair:lint:types   # 7 errors, 5 test files
```

### Workaround

Build before type-checking whenever a change could reach a test file:

```bash
mise run //package/<path>:build && mise run //package/<path>:lint:types
```

`mise run //package/module/translation-repair:buildAndTest` already does this
for the test half,
 and its description says so:
 "Build the node bundle,
 then run unit tests against the built dist".
The same ordering is what the type check needs and nothing states it.

### What does not work

Deleting `dist/final/types/tsconfig.tsbuildinfo` does not surface the errors.
The incremental build info is not involved,
 and clearing it was the first cause guessed here.
Verified by clearing it against a stale `index.d.mts`:
 the test-file errors stayed hidden.
Only the rebuild changes the answer.

### Why we do not file this upstream

Not a TypeScript defect.
TypeScript resolves a declaration file that exists on disk and reports what it
says;
 the declarations being stale is a property of when this repo runs its own
build.
The fix,
 if the ordering is judged worth enforcing rather than documenting,
 belongs in the `lint:types` task definition.

## Related Documentation

- [VSCode](vscode.md):
   VSCode extension configuration for TypeScript tools.
- [Toolchain](./TROUBLESHOOTING.toolchain.md):
   build tools and toolchain management.
- [Stylelint](stylelint.md):
   CSS linting configuration issues.
