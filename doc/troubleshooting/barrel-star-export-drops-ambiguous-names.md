# A barrel `export *` drops an ambiguous name silently

FOUND 2026-08-17 while adding a reader to `@monochromatic-dev/module-translation-repair`.

## What happened

Two new functions were added to `src/corpus-run/rendering-audit-settled-input.ts`
and re-exported from `src/corpus-barrel.ts`,
which `src/index.ts` re-exports with `export * from './corpus-barrel.ts'`.

One of the two arrived in the built package.
The other did not.

```text
settled-ish exports: assertSettledRecordAgrees, buildSettledArtifact,
buildSettledArtifactV2, countSettledPerBand, parseSettledArtifact,
parseSettledArtifactV2, readSettledArchive, settledTallyLine
```

`readSettledArchive` is there.
`readSettledArtifact`, added in the same commit, in the same `export` clause,
from the same module, is not.

## Cause

`readSettledArtifact` already existed,
in `src/artifact-read.ts`,
reaching the package through `src/sheet-barrel.ts`.
`index.ts` star-exports both barrels.

The ECMAScript module semantics for this are explicit and quiet:
when two `export *` declarations would supply the SAME name from DIFFERENT modules,
the name is excluded from the resulting namespace.
Not an error, not a warning, not a last-one-wins.
It is simply absent.

## Why nothing caught it

-   `tsc` passed.
    Every source module is internally consistent;
    the ambiguity exists only in the namespace the two star-exports produce.
-   `oxlint` passed.
    No rule looks across barrels for name collisions.
-   The bundler passed and emitted BOTH function bodies into `index.mjs`,
    so grepping the built file for the name finds it and proves nothing.
    Only the export list is affected.

The only symptom was an import failure in a test:

```text
SyntaxError: The requested module '../../dist/final/node/index.mjs'
does not provide an export named 'readSettledArtifact'
```

That message names the missing symbol and says nothing about why,
which reads exactly like a forgotten barrel line.
The barrel line was there.

## What to do about it

Rename.
`CRN` already forbids reusing an existing code name,
and this is the mechanism that punishes it:
the collision does not announce itself where it is created,
it removes an unrelated symbol somewhere downstream.
The new functions became `readArtifactSubjects` and `readArchiveSubjects`,
which also say what they return.

Do NOT add the old name to a forbidden-strings appendix.
`readSettledArtifact` is a legitimate, still-live function in `artifact-read.ts`;
a deny-list entry would flag every honest use of it.
The rejected thing was the DUPLICATE, not the name.

## How to check, since a type-check will not

Ask the built package what it actually exports:

```sh
node --input-type=module -e "
const m = await import('./dist/final/node/index.mjs');
console.log(Object.keys(m).filter((n) => n.includes('Settled')).join(', '));
"
```

Before adding a symbol to any barrel,
grep the whole package for the name first:

```sh
rg --count-matches '\bmyNewFunction\b' ./src
```

A hit outside the file being written is the collision,
and it is cheaper to find here than in a test three steps later.
