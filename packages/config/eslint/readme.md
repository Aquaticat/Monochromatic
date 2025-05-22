## Extends

Due to Oxlint configuration file help page not explicitly mentioning extends support as of 2024 August 16,
we're not shipping a workspace configuration file for Oxlint for now.

Use `oxlint -c packages/config/oxlint/index.json` for now.

## Comments

On <https://oxc.rs/docs/guide/usage/linter/config.html>,
it is noted only the `.json` format is supported,
but we can use comments in configuration files.

I'd preferred they choose the `.jsonc` format and configuration file extension,
but I'm not complaining being able to use comments in file with `.json` extension.

## JSON Schema

Using ESLint's for now.

## Ignore

The `.eslintignore` file should be synced with `config/git/.gitignore` and then have other files that shouldn't be linted added.
