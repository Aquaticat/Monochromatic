# @monochromatic-dev/config-typescript

Shared TypeScript compiler configuration for Monochromatic packages.

## Presets

Three entry points are exported,
 each extending the next:

- `.` (default):
   environment-agnostic baseline.
  `lib: ['ESNext']`,
   `types: ['node']`.
  Use for pure-logic packages,
   stubs,
   shims,
   and test fixtures.
- `./dom`:
   adds `lib: ['ESNext', 'DOM', 'WebWorker']`.
  Use for any package that touches browser or worker globals;
  the default choice for application code.
- `./astro`:
   extends `./dom` and adds Astro-specific overrides
  (`allowJs`,
   `checkJs`,
   `types: ['astro/client', 'mdx']`,
   `isolatedDeclarations: false`).
  Use only inside Astro projects.

Pick the narrowest preset that covers your runtime surface.
Most packages in this monorepo use `./dom`;
 agnostic libraries use `.`.

## Usage

Extend the chosen preset from your package's `tsconfig.json`.
No further configuration is needed for the common case.

```json
// agnostic
{
  "extends": "@monochromatic-dev/config-typescript"
}
```

```json
// browser / worker
{
  "extends": "@monochromatic-dev/config-typescript/dom"
}
```

```json
// astro
{
  "extends": "@monochromatic-dev/config-typescript/astro"
}
```

Working examples live alongside this README as
`example.tsconfig.json`,
`dom.example.tsconfig.json`,
and `astro.example.tsconfig.json`.

## Local overrides

The base config uses `${configDir}` substitution (TypeScript 5.5+)
throughout (`include`,
 `exclude`,
 `rootDirs`,
 `paths`,
 `outDir`),
so these resolve to your consuming directory automatically.
You do **not** need to repeat the default `paths` mappings:

- `@/*` resolves to `<your-package>/*`
- `@_/*` resolves to `<your-package>/src/*`

Setting `paths` in a consuming `tsconfig.json` replaces the inherited object wholesale
(TypeScript does not deep-merge `paths` across `extends`).
Override `paths` only when you want non-default aliases,
and re-declare both mappings if you still want them.

The common legitimate override is `types`,
for packages that need additional ambient typings:

```json
{
  "extends": "@monochromatic-dev/config-typescript/dom",
  "compilerOptions": {
    "types": ["bun", "@types/chai", "@types/sinon"]
  }
}
```

## Output paths

The base config sets `outDir` to `${configDir}/dist/final/types`.
With `noEmit: true` (the default) TypeScript does not actually write to this path;
emit is handled by `tsdown` via `@monochromatic-dev/config-tsdown`.
The `outDir` value still matters for `.tsbuildinfo` placement
and for tools that read tsconfig to locate declarations.

## Project references

`composite: true` is inherited from the base,
 but no package in this monorepo uses
TypeScript project references and we have no plans to adopt them.
 `tsgo` reads source
directly via the `./ts` entry in each package's `exports` map,
 which short-circuits the
cold-rebuild cost references are meant to solve in classic-tsc workflows.

See [`.out-of-scope/typescript-project-references.md`](../../../.out-of-scope/typescript-project-references.md)
for the full decision and trade-off analysis.

If a downstream consumer **is** referenced as a project,
TypeScript raises TS6310 ("Referenced project may not disable emit");
the referenced consumer must override `noEmit: false` in its own `tsconfig.json`.

## Why each option is set the way it is

Read `tsconfig.options.json` directly.
The file is grouped by `//region` headings
that match the TypeScript compiler-options handbook sections,
and inline comments document non-default choices.
Examples:

- `module: preserve` for dependencies that ship extensionless relative `.d.ts` files
- `noEmitOnError: false` to avoid a deadlock when test files import freshly-emitted types
- the asset-extension `exclude` block as a workaround for tsgo's LSP panicking on non-source files

## Troubleshooting

Known TypeScript gotchas across this monorepo:
see [`TROUBLESHOOTING.typescript.md`](../../../doc/troubleshooting/typescript.md) at the repository root.
