# pnpm's pnpmfile loader recognises only `.cjs` and `.mjs`, so `.pnpmfile.ts` is not loadable; `.mts` fails on two independent grounds

This file records the constraint that forces the repo's
dependency blocklist hook to live at `.pnpmfile.mjs` with JSDoc
types rather than `.pnpmfile.ts` with native TypeScript. Source
citations against `pnpm/pnpm` HEAD (clone in
`/tmp/pnpm-investigate`).

## Symptom

A reasonable assumption: pnpm loads any sensible source file
that defines hooks, so `.pnpmfile.ts` or `.pnpmfile.mts`
should work like `.pnpmfile.cjs` and `.pnpmfile.mjs`.

Reality: `.pnpmfile.ts` is silently ignored (pnpm reports no
pnpmfile found). `.pnpmfile.mts` fails on two independent
grounds (see Root cause). Only `.cjs` and `.mjs` are
auto-discovered; `.cts` is loadable only via the explicit
`--pnpmfile` flag with the right Node options.

## Root cause

pnpm's pnpmfile loader recognises exactly two extensions:
`.cjs` (loaded via `require()`) and `.mjs` (loaded via dynamic
`import()`). No `.ts`, `.mts`, `.cts`, or `.js` path exists.
The loader ships no transpiler.

### Loader branch

`hooks/pnpmfile/src/requirePnpmfile.ts`, lines 46-56:

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

The check is a literal `endsWith('.mjs')`, not "extension
contains `m`". Anything that does not end in `.mjs` takes the
`require()` branch.

### Existence check

Same file, lines 110-115:

```ts
function pnpmFileExistsSync(pnpmFilePath: string,): boolean {
  const pnpmFileRealName =
    pnpmFilePath.endsWith('.cjs',) || pnpmFilePath.endsWith('.mjs',)
      ? pnpmFilePath
      : `${pnpmFilePath}.cjs`;
  return fs.existsSync(pnpmFileRealName,);
}
```

Any explicit `--pnpmfile <path>` argument that does not already
end in `.cjs` or `.mjs` gets `.cjs` appended for the existence
check. No `.ts`/`.mts`/`.cts`/`.js` enumeration anywhere.

### Auto-discovery order

`hooks/pnpmfile/src/requireHooks.ts`, lines 71-91: default mode
tries `.pnpmfile.mjs` first, then falls back to
`.pnpmfile.cjs`. ESM support was added in
[pnpm/pnpm#9730](https://github.com/pnpm/pnpm/pull/9730),
commit `e146e988ea`.

### Why `.mts` fails on two grounds

1. The loader sends anything not ending in `.mjs` through
   `require()`. `.mts` is always ESM; pnpm's CJS-context
   `require('.pnpmfile.mts')` will not resolve a bare `.mts`
   even with `--experimental-require-module
   --experimental-strip-types`.
2. `pnpmFileExistsSync` produces `.pnpmfile.mts.cjs` and finds
   nothing, so the explicit-flag path also fails.

Patching `.mts` support requires editing both the loader
branch and the existence check upstream.

## Verification

Versions under test:

- pnpm HEAD (cloned into `/tmp/pnpm-investigate` for the
  citations).
- Repo file using the constraint: `.pnpmfile.mjs`.
- Policy doc: `docs/dependency-blocklist.md`.

Loadability matrix (verified against HEAD):

- Auto-discovered: `.pnpmfile.mjs` (ESM branch),
  `.pnpmfile.cjs` (CJS branch).
- Loadable only via explicit `--pnpmfile <path>`: `.cts` on
  Node 23+ with `NODE_OPTIONS='--experimental-strip-types'`;
  goes through `require()`, which the type-stripper extends to
  `.cts`.
- Not loadable at all: `.mts`, `.ts`, `.js` (per the citations
  above).

## Maintainer rationale

Issue [pnpm/pnpm#2728](https://github.com/pnpm/pnpm/issues/2728),
"Support typescript version of pnpmfile (pnpmfile.ts)", open
since 2020-07-29. Zoltan Kochan (lead maintainer) replied
once:

> Only if it doesn't require us to ship typescript with pnpm.

No subsequent maintainer comment, no implementation PR ever
filed (`gh search prs --repo pnpm/pnpm "pnpmfile.ts"` returns
empty). The constraint is operational (binary size, dependency
surface), not fundamental.

## Industry comparison

Neither Yarn Berry nor npm load TypeScript natively at hook
runtime:

- Yarn Berry plugins are pre-bundled JS produced by the Yarn
  builder; plugin TS is compiled at plugin-build time, not at
  hook-runtime.
- npm has no in-process hook file; lifecycle scripts are
  shell-invoked binaries.

pnpm's `.cjs`/`.mjs`-only loader matches the wider ecosystem.

## Verified workarounds

### `.pnpmfile.mjs` with JSDoc types (this repo's choice)

Use `.pnpmfile.mjs` and annotate with JSDoc:

```js
/** @satisfies {import('@pnpm/pnpmfile/lib/Hooks').Hooks} */
export const hooks = {
  readPackage(pkg,) {
    return applyBlocklist({ pkg, },);
  },
};
```

The `satisfies` check catches hook-signature drift if pnpm
changes the `Hooks` shape upstream, with zero build pipeline.

Tradeoff: types live in JSDoc rather than native TS syntax.
The current `.pnpmfile.mjs` is 122 lines and rarely touched;
the cost is small.

### Native type stripping (Node 23+; rejected)

```bash
NODE_OPTIONS='--experimental-strip-types' pnpm --pnpmfile .pnpmfile.cts install
```

Works for `.cts` because `require()` with type stripping
handles it. Tradeoff: every developer (and CI) must remember
the env var and the explicit `--pnpmfile` argument. Brittle.

### Pre-strip via file-enforcer + ts-blank-space (considered, rejected)

Pattern would mirror `file-enforcer.config.ts`'s `CLAUDE.md`
and `mise.toml` generators: write `.pnpmfile.ts` as source of
truth, run `ts-blank-space` to emit `.pnpmfile.mjs`, commit
the generated artifact, add a CI drift check.

```ts
import tsBlankSpace from 'ts-blank-space';

async function generatePnpmfile(): Promise<void> {
  const tsSource = await cat(['./.pnpmfile.ts',],);
  await overwrite(
    './.pnpmfile.mjs',
    `// Generated from .pnpmfile.ts by file-enforcer.
${tsBlankSpace(tsSource,)}`,
  );
}
```

Tradeoff: adds a new dev dependency, a new file-enforcer
generator, a committed generated artifact, a CI drift check,
and a two-file mental model on every edit, in exchange for
cosmetic improvements (cleaner type syntax) on a 122-line file
touched rarely. Revisit if the blocklist grows into multiple
files or pulls in shared types from elsewhere.

## What does not work

- Renaming to `.pnpmfile.ts`: silently ignored by
  auto-discovery; `--pnpmfile .pnpmfile.ts` appends `.cjs` and
  fails the existence check.
- Renaming to `.pnpmfile.mts`: fails on both the loader branch
  (`require` cannot load bare `.mts`) and the existence check
  (produces `.pnpmfile.mts.cjs`).
- Setting `--pnpmfile .pnpmfile.js`: takes the `require()`
  branch but pnpm's package context is CJS, so ESM-only
  imports inside the file break at runtime; plus the existence
  check requires the explicit path.

## Why we do not file this upstream

The constraint is upstream's intentional choice. Walking the 5
constraints:

1. **Is it really upstream's fault?** Borderline. The
   constraint exists by design (no bundled TS compiler) but
   the existence-check shape makes even `.cts` unusable
   without flags.
2. **Can upstream fix it?** Yes; either accept a bundled
   stripper or add explicit `.cts` auto-discovery when Node
   supports it. Both are non-trivial commitments.
3. **Are they supporting this use case?** No; the maintainer
   reply on #2728 is explicit.
4. **Will they likely fix it?** No, given five years of
   inactivity on #2728.
5. **Have we prototyped a minimal fix?** No.

Decision: no upstream report. The JSDoc approach matches the
ecosystem norm and the project preference.

## References

- pnpm source: `hooks/pnpmfile/src/requirePnpmfile.ts`,
  `hooks/pnpmfile/src/requireHooks.ts`.
- Upstream issue:
  [pnpm/pnpm#2728](https://github.com/pnpm/pnpm/issues/2728).
- ESM support PR:
  [pnpm/pnpm#9730](https://github.com/pnpm/pnpm/pull/9730).
- Repo file using the constraint: `.pnpmfile.mjs`.
- Policy doc: `docs/dependency-blocklist.md`.
