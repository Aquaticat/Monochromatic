# Oxlint Linter Troubleshooting

## Type-aware mode requires per-package execution

Oxlint `--type-aware` resolves the nearest `tsconfig.json` from the working directory.
The root `tsconfig.json` does not include each package's `src` directory,
so running oxlint from the monorepo root causes type-aware rules to silently miss type information.

The workaround is to run oxlint from each package independently.
The `lint:oxlint` task template in `mise.toml` handles this automatically --
the root `lint:oxlint` task fans out via `mise '/packages/...:lint:oxlint'`
so every package runs with its own `tsconfig.json` in scope.

## Integration with ESLint

Oxlint is used alongside ESLint in this project.
See [ESLint Troubleshooting](./TROUBLESHOOTING.eslint.md) for configuration details when both linters are used together.