# pnpm pnpmfile is JavaScript-only

## Why this file exists

The repo's dependency blocklist hook lives at `.pnpmfile.mjs` with JSDoc types,
not at `.pnpmfile.ts` with native TypeScript.
This document records why, with source citations,
so future agents do not re-investigate the same constraint.

## Constraint

pnpm's pnpmfile loader recognises exactly two extensions:
`.cjs` (loaded via `require()`) and `.mjs` (loaded via dynamic `import()`).
No `.ts`, `.mts`, `.cts`, or `.js` path exists.
The loader ships no transpiler.

## Source trace

Verified against `pnpm/pnpm` HEAD (clone in `/tmp/pnpm-investigate`).

### Loader branch

`hooks/pnpmfile/src/requirePnpmfile.ts`, lines 46 to 56:

```ts
export async function requirePnpmfile (pnpmFilePath: string, prefix: string): ... {
  try {
    let pnpmfile: Pnpmfile
    // Check if it's an ESM module (ends with .mjs)
    if (pnpmFilePath.endsWith('.mjs')) {
      const url = pathToFileURL(path.resolve(pnpmFilePath)).href
      pnpmfile = await import(url)
    } else {
      // Use require for CommonJS modules
      pnpmfile = require(pnpmFilePath)
    }
```

The check is a literal `endsWith('.mjs')`, not "extension contains m".
Anything that does not end in `.mjs` takes the `require()` branch.

### Existence check

Same file, lines 110 to 115:

```ts
function pnpmFileExistsSync (pnpmFilePath: string): boolean {
  const pnpmFileRealName = pnpmFilePath.endsWith('.cjs') || pnpmFilePath.endsWith('.mjs')
    ? pnpmFilePath
    : `${pnpmFilePath}.cjs`
  return fs.existsSync(fileRealName)
}
```

Any explicit `--pnpmfile <path>` argument that does not already end in `.cjs` or `.mjs`
gets `.cjs` appended for the existence check.
No `.ts`/`.mts`/`.cts`/`.js` enumeration anywhere.

### Auto-discovery order

`hooks/pnpmfile/src/requireHooks.ts`, lines 71 to 91:
default mode tries `.pnpmfile.mjs` first, then falls back to `.pnpmfile.cjs`.
ESM support was added in PR
[pnpm/pnpm#9730](https://github.com/pnpm/pnpm/pull/9730),
commit `e146e988ea`.

## What works, what does not

### Auto-discovered by pnpm

- `.pnpmfile.mjs`: ESM branch, no flags.
- `.pnpmfile.cjs`: CJS branch, no flags.

### Loadable only via explicit `--pnpmfile <path>`

- `.cts`: works on Node 23+ with `NODE_OPTIONS='--experimental-strip-types'`. Goes through `require()`, which the type-stripper extends to `.cts`.

### Does not work at all

- `.mts`: rejected at both layers (see below).
- `.ts`, `.js`: not recognised by the existence check; if explicit, take the `require()` branch and fail on bare-extension resolution.

### Why `.mts` fails

`.mts` fails on two independent grounds:

1.  The loader sends anything not ending in `.mjs` through `require()`.
   `.mts` is always ESM; pnpm's CJS-context `require('.pnpmfile.mts')` will not resolve a bare `.mts`
   even with `--experimental-require-module --experimental-strip-types`.
2.  `pnpmFileExistsSync` produces `.pnpmfile.mts.cjs` and finds nothing, so the explicit-flag path also fails.

Patching `.mts` support requires editing both the loader branch and the existence check upstream.

## Maintainer rationale

Issue [pnpm/pnpm#2728](https://github.com/pnpm/pnpm/issues/2728),
"Support typescript version of pnpmfile (pnpmfile.ts)",
open since 2020-07-29.
Zoltan Kochan (lead maintainer) replied once:

> Only if it doesn't require us to ship typescript with pnpm.

No subsequent maintainer comment, no implementation PR ever filed
(`gh search prs --repo pnpm/pnpm "pnpmfile.ts"` returns empty).
The constraint is operational (binary size, dependency surface), not fundamental.

## Industry comparison

Neither Yarn Berry nor npm load TypeScript natively at hook runtime:

- Yarn Berry plugins are pre-bundled JS produced by the Yarn builder; plugin TS is compiled at plugin-build time, not at hook-runtime.
- npm has no in-process hook file; lifecycle scripts are shell-invoked binaries.

pnpm's `.cjs`/`.mjs`-only loader matches the wider ecosystem.

## Workarounds and the rejected pre-strip option

### Native type stripping (Node 23+)

```bash
NODE_OPTIONS='--experimental-strip-types' pnpm --pnpmfile .pnpmfile.cts install
```

Works for `.cts` because `require()` with type stripping handles it.
Requires every developer (and CI) to remember the flag and the explicit `--pnpmfile` argument.
Brittle.

### Pre-strip via file-enforcer + ts-blank-space (considered, rejected)

The pattern would mirror `file-enforcer.config.ts`'s `CLAUDE.md` and `mise.toml` generators:
write `.pnpmfile.ts` as the source of truth, run `ts-blank-space` to emit `.pnpmfile.mjs`,
commit the generated artifact, add a CI drift check.

```ts
import tsBlankSpace from 'ts-blank-space';

async function generatePnpmfile(): Promise<void> {
  const tsSource = await cat(['./.pnpmfile.ts',]);
  await overwrite(
    './.pnpmfile.mjs',
    `// Generated from .pnpmfile.ts by file-enforcer.
${tsBlankSpace(tsSource,)}`,
  );
}
```

Rejected for this repo because the current `.pnpmfile.mjs` is already type-checked via JSDoc
(`@typedef Policy`, `@type {Readonly<Record<string, Policy>>}`, `@param`/`@returns` throughout).
The pre-strip pipeline would add a new dev dependency, a new file-enforcer generator,
a committed generated artifact, a CI drift check, and a two-file mental model on every edit,
in exchange for cosmetic improvements (cleaner type syntax)
on a 122-line file touched rarely.
Revisit if the blocklist grows into multiple files or pulls in shared types from elsewhere.

## Getting the `satisfies Hooks` check without a build step

The one type-safety win TS would give that JSDoc does not is `satisfies Hooks` against
`@pnpm/pnpmfile`'s exported type. JSDoc has the same primitive:

```js
/** @satisfies {import('@pnpm/pnpmfile/lib/Hooks').Hooks} */
export const hooks = {
  readPackage(pkg) { return applyBlocklist({ pkg }); },
};
```

This catches hook-signature drift if pnpm changes the `Hooks` shape upstream,
with zero build pipeline.

## References

- pnpm source: `hooks/pnpmfile/src/requirePnpmfile.ts`, `hooks/pnpmfile/src/requireHooks.ts`
- Upstream issue: [pnpm/pnpm#2728](https://github.com/pnpm/pnpm/issues/2728)
- ESM support PR: [pnpm/pnpm#9730](https://github.com/pnpm/pnpm/pull/9730)
- Repo file using the constraint: `.pnpmfile.mjs`
- Policy doc: `docs/dependency-blocklist.md`
