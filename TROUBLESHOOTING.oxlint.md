# Oxlint Linter Troubleshooting

## Type-aware mode requires per-package execution

Oxlint `--type-aware` resolves the nearest `tsconfig.json` from the working directory.
The root `tsconfig.json` does not include each package's `src` directory,
so running oxlint from the monorepo root causes type-aware rules to silently miss type information.

The workaround is to run oxlint from each package independently.
The `lint:oxlint` task template in `mise.toml` handles this automatically --
the root `lint:oxlint` task fans out via `mise '/packages/...:lint:oxlint'`
so every package runs with its own `tsconfig.json` in scope.

## Disable comment prefix matching is substring-based

Oxlint matches disable comments against rule names using **substring containment**,
not exact prefix matching.
The linter passes the bare rule name (e.g., `no-await-in-loop`) to `DisabledRule.contains()`,
and the check is `comment_text.contains(bare_name)`.
This means any prefix works: `eslint/no-await-in-loop`, `@typescript-eslint/no-await-in-loop`,
`xyzzy/no-await-in-loop`, or just `no-await-in-loop` all suppress the same rule.

For tsgo (type-aware) rules, `should_skip_diagnostic` in `tsgolint.rs` makes three separate
`contains()` calls with bare, `typescript-eslint/`, and `@typescript-eslint/` prefixes --
but the bare check already matches any comment containing the rule name.

**Source locations** (oxc commit checked: `main` as of 2026-03-13):

- `crates/oxc_linter/src/disable_directives.rs:184-216` -- `contains()` method with substring match
- `crates/oxc_linter/src/disable_directives.rs:578-595` -- `get_rule_names()` parser (splits on `,`, trims whitespace, strips `--` suffixes)
- `crates/oxc_linter/src/tsgolint.rs:1057-1079` -- `should_skip_diagnostic()` for tsgo rules

**Canonical prefixes** (matching `parse_rule_key` in `config/rules.rs`):

- eslint core: bare name, no prefix (e.g., `no-await-in-loop`, `require-await`)
- TypeScript: `typescript/` (e.g., `typescript/no-unsafe-type-assertion`)
- Import: `import/` (e.g., `import/no-unassigned-import`)
- Promise: `promise/` (e.g., `promise/avoid-new`)
- Unicorn: `unicorn/` (e.g., `unicorn/prefer-top-level-await`)
- Node: `node/` (e.g., `node/no-sync`)

**What does not work**: Nothing is truly broken -- all prefixes match.
But non-canonical prefixes (`eslint/`, `eslint-plugin-promise/`, `@typescript-eslint/`,
parentheses syntax like `eslint(rule-name)`) are misleading and should be normalized
for consistency with the config file format.

## ESLint removed (2026-03-13)

ESLint was fully replaced by oxlint.
The old config is preserved at `packages/config/eslint-deprecated/`
with re-adoption instructions in its README.
See [ESLint Troubleshooting](./TROUBLESHOOTING.eslint.md) for historical configuration notes.