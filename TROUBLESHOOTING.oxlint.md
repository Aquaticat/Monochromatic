# Oxlint Linter Troubleshooting

## Type-aware mode requires per-package execution

Oxlint `--type-aware` resolves the nearest `tsconfig.json` from the working directory.
The root `tsconfig.json` does not include each package's `src` directory,
so running oxlint from the monorepo root causes type-aware rules to silently miss type information.

The workaround is to run oxlint from each package independently.
The `lint:oxlint` task template in `mise.toml` handles this automatically --
the root `lint:oxlint` task fans out via `mise '/packages/...:lint:oxlint'`
so every package runs with its own `tsconfig.json` in scope.

## ESLint removed (2026-03-13)

ESLint was fully replaced by oxlint.
The old config is preserved at `packages/config/eslint-deprecated/`
with re-adoption instructions in its README.
See [ESLint Troubleshooting](./TROUBLESHOOTING.eslint.md) for historical configuration notes.