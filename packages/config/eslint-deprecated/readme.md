## Extends

Due to Oxlint configuration file help page not explicitly mentioning extends support as of 2024 August 16,
not shipping a workspace configuration file for Oxlint for now.

Use `oxlint -c packages/config/oxlint/index.json` for now.

## Comments

On <https://oxc.rs/docs/guide/usage/linter/config.html>,
it's noted only the `.json` format supports comments,
but comments work in configuration files.

The `.jsonc` format and configuration file extension works better,
but using comments in files with `.json` extension helps.

## Json schema

Using ESLint's for now.

## Ignore

The `.eslintignore` file should sync with `config/git/.gitignore` and then have other files that shouldn't require linting added.
