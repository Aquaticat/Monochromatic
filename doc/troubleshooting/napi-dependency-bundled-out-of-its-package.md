# A napi dependency bundled out of its own package cannot find its native binding

## Symptom

Every import of `@monochromatic-dev/module-translation-repair` throws before
reaching any pipeline code,
after that package started importing `@monochromatic-dev/cli-markdown-lint`:

```text
Cannot find native binding. npm has a bug related to optional dependencies
(https://github.com/npm/cli/issues/4828). Please try `npm i` again after
removing both package-lock.json and node_modules directory.
```

The message names npm and optional dependencies,
and both are red herrings here.

## Root cause

`satteri` is a napi package.
Its loader does `require("@bruits/satteri-<platform>")` and resolves that
relative to wherever the loader's own file sits.

The shared rolldown Node config always bundles `@monochromatic-dev/**`
and keeps only DECLARED dependencies external
(`package/config/rolldown/src/index.node.ts`, `README.md`).
So importing the markdown-lint workspace package inlined its source,
including its `satteri` import and satteri's loader,
into `package/module/translation-repair/dist/final/node/`.

That directory is not satteri's package directory.
Resolution from there walks up and finds no `@bruits/*` link,
because pnpm links those under satteri's own location and nowhere else.

## What the failure is NOT

THE BINDINGS ARE INSTALLED.
`node_modules/.pnpm` carries
`@bruits+satteri-linux-x64-gnu@0.9.5` and its siblings for every supported
architecture.

SATTERI RESOLVES THEM CORRECTLY FROM ITS OWN LOCATION.
Two independent checks:
`node package/cli/markdown-lint/dist/final/node/cli.mjs <file>` lints and exits 0,
and a scratch script importing markdown-lint's own `dist` ran the fixer over
sixty-four passages without a binding error.

So there is no unresolvable import for a manifest edit to fix.

## Why `packageExtensions` does not apply

`packageExtensions` adds dependencies to another package's manifest so pnpm
links them under it.
It cures the case where a package imports something it never declared,
which under this workspace's strict isolation
(`hoist: false`, `nodeLinker: isolated`)
is unresolvable FROM THAT PACKAGE'S OWN LOCATION.
`pnpm-workspace.yaml` carries exactly one such entry,
`mitata` reaching for `@mitata/counters`,
and its comment states that shape precisely.

This failure has the opposite shape.
Nothing is missing from satteri's location;
the code was copied OUT of that location by the bundler.
Editing satteri's manifest changes what pnpm links under satteri,
which the inlined copy in `dist/final/node/` never consults.

## Fix

Declare the transitive runtime dependency in the consuming package:

```jsonc
// package/module/translation-repair/package.json
"satteri": "catalog:",
```

Declared means external,
so the bundle emits a runtime import rather than a copy,
and node resolves it from the consuming package's own `node_modules`,
where satteri sits beside the `@bruits/*` links its loader needs.

The declaration is honest rather than a workaround:
markdown-lint's parser really is on this package's runtime path now.

## Verification

Read the built bundle rather than trusting the fix:

```bash
grep -oh 'from"satteri"' package/module/translation-repair/dist/final/node/*.mjs
grep -l 'Cannot find native binding' package/module/translation-repair/dist/final/node/*.mjs
grep -oh '@bruits/satteri-[a-z0-9-]*' package/module/translation-repair/dist/final/node/*.mjs
```

After the fix the first prints one match,
and the second and third print nothing:
the loader is no longer in the bundle
and no binding name is baked into it.

## Prevention

Pulling a workspace package into a bundle pulls its whole dependency closure in
with it,
because workspace packages are always bundled.
Any napi package anywhere in that closure has to be declared by the consumer,
or it will be inlined somewhere its bindings cannot be found.
The failure surfaces at import time rather than at build time,
so a green build says nothing about it.
