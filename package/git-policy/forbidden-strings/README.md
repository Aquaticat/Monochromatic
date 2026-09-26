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

The adapter writes exact candidate bytes to private synthetic content files,
then passes each candidate's validated repository-relative name through the scanner's
paired `--name-path` option.
The scanner matches each name segment independently and masks the entire offending segment.
Name findings use a segment position instead of a content line and never report columns.
An opaque operand index preserves identity when different candidates mask to the same displayed path.
The adapter validates every output path against its indexed candidate and returns only
scanner-masked paths in policy events.
Path-name matching cannot be disabled.

## Build and test

```sh
mise run //package/git-policy/forbidden-strings:build
mise run //package/git-policy/forbidden-strings:test:unit
mise run //package/git-policy/forbidden-strings:lint
```
