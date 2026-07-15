# Git policy forbidden strings

Optional cli-git policy adapter for the separately built `forbidden-strings` scanner.

The package owns policy source and tests.
Cli-git statically bundles generated source mirrors into its single import and executable artifact.
Importing either package does not register or enable the policy.

## Configuration

Register `forbiddenStringsPlugin` in trusted cli-git configuration,
then enable its policy ID under the consumer-owned namespace.
The policy defaults to resolving `forbidden-strings` from `PATH` when it executes.
An explicit executable path can be supplied through policy options.

The scanner runs with repository root as its working directory.
Its normal rules precedence remains `--rules`,
`FORBIDDEN_STRINGS_RULES`,
then `forbidden-strings.local.txt` at repository root.

## Build and test

```sh
mise run //packages/git-policy/forbidden-strings:build
mise run //packages/git-policy/forbidden-strings:test:unit
mise run //packages/git-policy/forbidden-strings:lint
```
