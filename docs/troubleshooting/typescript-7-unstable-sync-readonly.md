# TypeScript 7.0.2 semantic lint plugins need the unstable sync API and an internal mapped-readonly flag

## Symptom

Code written for the TypeScript 6 compiler API cannot obtain a `Program` or `TypeChecker` from the repository's
installed `typescript@7.0.2` package.
Two representative failures are:

- `import * as ts from 'typescript'` loads the version-only root export,
  so `ts.createProgram` is absent;
- importing the former `typescript/lib/typescript.js` implementation fails with
  `ERR_MODULE_NOT_FOUND` because TypeScript 7 does not ship that file.

TypeScript 7.0.2 does expose a synchronous semantic API at `typescript/unstable/sync`.
That API can support a synchronous Oxlint JavaScript rule,
but it does not export a named readonly-symbol query or `CheckFlags` enum.
Mapped readonly properties therefore require an explicitly version-tested adapter around the numeric
`Symbol.checkFlags` field.

## Root cause

### The stable package root is not the compiler API

The installed `typescript@7.0.2/package.json:37-40` exports the package root as `lib/version.cjs` and the semantic API
under an explicitly unstable subpath:

```json
"exports": {
    "./package.json": "./package.json",
    ".": "./lib/version.cjs",
    "./unstable/sync": "./dist/api/sync/api.js",
```

The [TypeScript 7.0 announcement][typescript-7-announcement] states that 7.0 does not ship a stable API and expects a
new API in 7.1.
The exported unstable subpath is therefore usable by explicit project choice,
not a compatibility continuation of `createProgram`.

### The synchronous API is a native-process client

The installed `typescript@7.0.2/dist/api/sync/client.js:11-36` starts the bundled executable with `--api` and wraps it
in `SyncRpcChannel`:

```javascript
const args = [
    "--api",
    "--cwd",
    cwd,
];
// ...
const channel = new SyncRpcChannel(resolveExePath(options), args, collectTiming);
```

Calls such as `Checker.getTypeAtLocation` are synchronous RPC requests.
`client.js:55-62` serializes the request and blocks for its response:

```javascript
apiRequest(method, params) {
    const encodedPayload = JSON.stringify(params);
    const start = performance.now();
    const result = this.channel.requestSync(method, encodedPayload);
```

This shape fits Oxlint's synchronous JavaScript-rule visitors,
but the client must be process-scoped and reused rather than recreated per parameter or source file.

### Snapshots provide the project and unsaved-file lifecycle

The installed `typescript@7.0.2/dist/api/sync/api.d.ts:39` exposes `API.updateSnapshot`.
The resulting `Project.checker` exposes the required type operations at `api.d.ts:207-282`,
including:

```typescript
getTypeAtLocation(node: Node): Type | undefined;
getTypeFromTypeNode(node: TypeNode): Type | undefined;
isTypeAssignableTo(source: Type, target: Type): boolean;
getPropertiesOfType(type: Type): readonly Symbol[];
getIndexInfosOfType(type: Type): readonly IndexInfo[];
```

The API client's virtual filesystem callback lets an Oxlint rule overlay `context.sourceCode.text`.
Passing the path through `fileChanges.changed` produces a new snapshot without writing editor text to disk when the
configured project,
rather than a persistent API-open-file association,
owns later snapshots.

The production adapter initially used `openFiles` for every-file persistence.
A built-artifact test changed `SemanticFixtureBox<string>` to `Readonly<SemanticFixtureBox<string>>` in the virtual
overlay,
but the next snapshot still returned `SemanticFixtureBox<string>`.
`clearSourceFileCache()` did not change that result.

At the audited TypeScript Go revision,
`internal/project/projectcollectionbuilder.go:180-205` shows that `CloseFiles` decrements or deletes an API-open-file
association and `OpenFiles` increments it:

```go
if apiRequest.CloseFiles != nil {
    for path := range apiRequest.CloseFiles.Keys() {
        if entry, ok := b.apiState.openFiles[path]; ok {
            if entry.refCount > 1 {
                entry.refCount--
                b.apiState.openFiles[path] = entry
            } else {
                delete(b.apiState.openFiles, path)
            }
        }
    }
}

if apiRequest.OpenFiles != nil {
    for uri := range apiRequest.OpenFiles.Keys() {
        fileName := uri.FileName()
        path := b.toPath(fileName)
        // ...
        entry.refCount++
        b.apiState.openFiles[path] = entry
    }
}
```

The verified adapter now uses `openFiles` only to discover the configured project.
It then opens that `tsconfig.json`,
closes the temporary file association,
and sends later `fileChanges.changed` notifications to project-owned snapshots.
The same built test then returned `Readonly<SemanticFixtureBox<string>>` while confirming disk text was unchanged.

### Hidden disposable directories can fall into an inferred project

A stale-contract suggestion test initially created its disposable source under a dot-prefixed directory inside the
fixture `src/` tree.
`getDefaultProjectForFile` returned an inferred project whose config path was `/dev/null/inferred`,
and the configured-project snapshot then omitted that identity.
The semantic rule correctly failed closed with:

```text
project-not-found: TypeScript snapshot omitted configured project /dev/null/inferred.
```

Creating the same disposable source under a non-hidden directory inside the configured project selected the fixture
`tsconfig.json` and allowed Oxlint to apply the suggestion.
Semantic integration fixtures must therefore verify configured-project inclusion,
not infer inclusion merely from filesystem ancestry.

The TypeScript native API process can print `context canceled` while Oxlint exits successfully after the adapter's
process-exit cleanup closes the synchronous RPC channel.
Treat Oxlint's exit status and diagnostics as authoritative;
the shutdown line alone did not indicate a lint failure in the verified fixture runs.

### Mapped readonly state is exposed only as an unnamed number

`typescript@7.0.2/dist/api/sync/api.d.ts:387` exposes this field:

```typescript
readonly checkFlags: number;
```

The matching native source at
`typescript-go@168e7015edf98244febc8f4ae450b673b5d195d7/internal/ast/checkflags.go:8-12` defines the hidden meaning:

```go
CheckFlagsNone              CheckFlags = 0
CheckFlagsInstantiated      CheckFlags = 1 << 0
CheckFlagsSyntheticProperty CheckFlags = 1 << 1
CheckFlagsSyntheticMethod   CheckFlags = 1 << 2
CheckFlagsReadonly          CheckFlags = 1 << 3
```

Syntactic `readonly` modifiers cover directly declared properties.
Recursively mapped types need the transient `CheckFlagsReadonly` bit because their resolved property declarations may
point back to mutable source declarations.
The missing named API is tracked by [typescript-go issue 4080][readonly-issue].

## Verification

Verified components:

- repository package `typescript@7.0.2`;
- npm integrity recorded in `pnpm-lock.yaml`;
- `microsoft/typescript-go` source revision
  `168e7015edf98244febc8f4ae450b673b5d195d7`;
- Oxlint 1.73.0 JavaScript-plugin execution boundary;
- Linux x64 with Node 26.5.0.

A disposable Oxlint plugin imported `API` from `typescript/unstable/sync`,
opened a fixture `tsconfig.json`,
and queried source nodes through the returned project.
Its corpus contained imported aliases,
generics,
unions,
overloads,
function types,
call signatures,
method signatures,
a recursive mapped `DeepReadonly`,
direct mutation,
cross-file mutation,
and callback-propagated mutation.

Run the semantic API independently with this minimal fixture:

```typescript
// /tmp/ts7-sync-probe/input.ts
export type Mutable<T> = { value: T };
export type DeepReadonly<T> = { readonly [Key in keyof T]: DeepReadonly<T[Key]> };
export function inspect(value: DeepReadonly<Mutable<string>>): string {
  return value.value;
}
```

```json
// /tmp/ts7-sync-probe/tsconfig.json
{
  "compilerOptions": { "strict": true, "noEmit": true },
  "files": ["input.ts"]
}
```

```javascript
// /tmp/ts7-sync-probe/probe.mjs
import { createRequire } from 'node:module';

const requireFromRepository = createRequire(`${process.cwd()}/package.json`);
const { API } = requireFromRepository('typescript/unstable/sync');
const { isFunctionDeclaration } = requireFromRepository('typescript/unstable/ast/is');
const root = '/tmp/ts7-sync-probe';
const config = `${root}/tsconfig.json`;
const input = `${root}/input.ts`;
const api = new API({ cwd: root });
try {
  const snapshot = api.updateSnapshot({ openProjects: [config] });
  const project = snapshot.getProject(config);
  const source = project.program.getSourceFile(input);
  const declaration = source.statements.find(isFunctionDeclaration);
  const type = project.checker.getTypeFromTypeNode(declaration.parameters[0].type);
  const property = project.checker.getPropertiesOfType(type)[0];
  console.log(project.checker.typeToString(type));
  console.log((property.checkFlags & (1 << 3)) !== 0);
  snapshot.dispose();
} finally {
  api.close();
}
```

Run from this repository so Node resolves its installed TypeScript package:

```sh
node /tmp/ts7-sync-probe/probe.mjs
```

Verified output:

```text
DeepReadonly<Mutable<string>>
true
```

### Working catalog

- `API.updateSnapshot({ openProjects })` loads configured projects.
- `Snapshot.getProject` and `getDefaultProjectForFile` expose project ownership.
- `Program.getSourceFile` returns a traversable TypeScript 7 AST with source offsets.
- `Checker.getTypeFromTypeNode` preserves imported alias identity and generic instantiation.
- direct declaration modifiers classify ordinary readonly properties.
- `symbol.checkFlags & (1 << 3)` classifies the tested recursively mapped readonly property.
- virtual filesystem overlays plus configured-project snapshots and `fileChanges.changed` update semantic results;
- temporary `openFiles` discovery followed by `openProjects` and `closeFiles` avoids stale API-open-file semantics.
- TypeScript source offsets map to exact Oxlint diagnostic locations.

### Failing or unsupported catalog

- TypeScript 6 `createProgram` and `createLanguageService` entry points are absent from the TypeScript 7 package root.
- `typescript/lib/typescript.js` is absent.
- no exported `CheckFlags` enum names the mapped readonly bit.
- no stable TypeScript 7 API contract covers this use in 7.0.
- recreating `API` for every linted parameter starts unnecessary native clients and loses snapshot reuse;
- retaining `openFiles` across changed virtual overlays returned stale type text in the built adapter test;
- a dot-prefixed disposable source directory selected `/dev/null/inferred` rather than the expected configured project.

## Verified workarounds

### Use the unstable synchronous API with a narrow adapter

Import `typescript/unstable/sync`,
keep one `API` client per plugin process,
and hide all unstable calls behind a project-owned bridge module.
Keep the readonly bit in one named constant with a TypeScript-version contract test.

Tradeoff:
minor TypeScript updates may change the unstable API or hidden flag meaning.
The adapter must fail closed and emit a bridge diagnostic instead of silently treating unknown types as readonly.

### Use snapshots and a virtual filesystem overlay

Use `openFiles` only for ancestor `tsconfig.json` discovery.
Open that configured project,
close the temporary file association,
and create replacement project snapshots with `fileChanges.changed` whenever current source changes.
Dispose superseded snapshots and close the API client at process shutdown when the host provides a lifecycle hook.

Tradeoff:
Oxlint does not currently expose an explicit plugin shutdown callback,
so process exit owns final client cleanup.
Tests must detect leaked child processes and stale overlays.

### Keep syntax effects in the Oxlint traversal

Use TypeScript 7 for symbols,
types,
resolved signatures,
and cross-file identity.
Use the current Oxlint tree and source text for diagnostics and suggestions,
with source offsets as the mapping key.

Tradeoff:
the rule maintains a deliberate two-tree boundary and must test Unicode,
BOM,
comments,
and parser-recovery span cases.

## What does not work

- **Importing the package root as the old compiler API:
  ** it returns only version metadata in TypeScript 7.0.2.
- **Importing `typescript/lib/typescript.js`:
  ** that TypeScript 6 implementation path is not shipped.
- **Using `@typescript-eslint/project-service`:
  ** its current peer range ends before TypeScript 7 and it wraps the old
  `tsserverlibrary` API.
- **Using `ts-morph`:
  ** current `ts-morph@28` bundles TypeScript 6 semantics and would not query the repository's
  installed TypeScript 7 compiler.
- **Using only declarations to detect mapped readonly state:
  ** mapped properties can resolve to mutable origin
  declarations;
   the transient readonly bit carries the projected state.
- **Using the asynchronous unstable API inside an Oxlint visitor:
  ** Oxlint JavaScript rule callbacks are synchronous and
  cannot await semantic results before reporting.

## Upstream filing decision

`.out-of-scope/` contains no matching exemption.
The existing [typescript-go issue 4080][readonly-issue] requests a supported readonly-symbol API,
so a new issue would be a duplicate.

The filing constraints resolve as follows:

1.  **Is it really upstream's fault?
    ** No for API instability,
    because TypeScript 7.0 explicitly does not promise a stable API.
    The missing readonly query is an acknowledged API gap.
2.  **Can upstream fix it?
    ** Yes,
    by exporting a readonly-symbol query or a supported flag.
3.  **Are they supporting this use case?
    ** Not as a stable TypeScript 7.0 API use case.
4.  **Would the repository welcome the contribution?
    ** Potentially.
    `CONTRIBUTING.md` permits specifically chosen AI-assisted work with human review and disclosure,
    while rejecting bulk autonomous submissions.
5.  **Will they likely fix it?
    ** Unknown.
    Issue 4080 is open in the `Post-7.0` milestone.
6.  **Was a minimal upstream fix prototyped?
    ** No.
    Constraints 1 and 3 fail,
    and the verified consumer adapter resolves this repository's immediate need.

Do not file the following draft as-is.
It is an additive comment candidate for issue 4080 only if a human decides that documenting the unstable workaround
would help upstream:

~~~md
TypeScript 7.0.2's `typescript/unstable/sync` API currently serializes `Symbol.checkFlags` as a number.
For a recursive mapped `DeepReadonly<T>` probe,
`checkFlags & (1 << 3)` matched the native `CheckFlagsReadonly` definition in
`internal/ast/checkflags.go` and distinguished the projected property from its mutable origin declaration.

That is enough for a version-pinned consumer workaround,
but it reinforces this issue's request for a supported query:
the enum meaning is not exported and the 7.0 API is explicitly unstable.
I verified the result through an Oxlint JavaScript plugin using snapshot updates and a virtual filesystem overlay.
This investigation and draft used AI assistance and was reviewed against the installed package and current Go source.
~~~

[readonly-issue]: https://github.com/microsoft/typescript-go/issues/4080
[typescript-7-announcement]: https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/
