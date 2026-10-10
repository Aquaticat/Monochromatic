# Git policy markdown-lint

Optional cli-git policy that runs `monochromatic-lint --fix` over the Markdown files of a commit,
inside the commit transaction,
so the selected rules land their fixes in the commit itself.

The package owns the policy source and tests.
Cli-git statically bundles generated source mirrors into its single import and executable artifact.
Importing either package does not register or enable the policy.

## Why it exists

Issue #476:
a Markdown image that points at an LFS-tracked file renders as pointer text on GitHub.
The `markdown/lfs-image-url` rule of `monochromatic-lint` rewrites such links to object URLs on the repository's LFS server,
and this policy applies that rewrite at commit time so authors keep writing relative links.

## How it works

For every candidate that is an added or modified `.md` or `.mdx` file,
the policy pipes the exact candidate bytes into
`monochromatic-lint --config <file> --stdin --stdin-filename <path> --fix`
with the repository root as working directory.
The configuration file is written once per run into a private temporary directory,
which is removed when the run ends:
one block selecting `**/*.md` and `**/*.mdx`,
with each selected rule at `error` and the `exclude` patterns as the option of `markdown/lfs-image-url`.
The repository's own `monochromatic-lint.config.jsonc` therefore never decides what a commit rewrites.

- A changed result becomes a `markdown-autofix` finding carrying a full-content `git-unified` patch,
  which cli-git applies to its private index before real Git commits.
  At lifecycle points that cannot apply patches the same finding is report-only.
- Every violation the selected rules could not fix becomes a `markdown-violation` finding without a patch,
  read from the JSON Lines report on standard error with its line and column.
- A candidate the linter could not process,
  such as MDX that fails to parse,
  exits 2 with the reason as a `core/processing-failure` finding;
  the policy reports it as a `markdown-violation` and leaves the candidate unchanged.
- Candidates that are not UTF-8 are skipped.
- A subprocess that cannot start,
  is interrupted,
  rejects its arguments or configuration,
  or exits with a status outside 0,
  1 and 2 raises `MarkdownLintPluginError`.

The linter runs as a subprocess because it is a native executable,
which cannot be bundled into the trusted configuration artifact.
Candidates are processed one at a time so a large commit never starts one linter process per file at once.

The fixed source is read from the subprocess byte-exact through `spawn` and a stream consumer;
`nano-spawn` strips the final newline from `stdout`,
which made every candidate look rewritten.

## Working tree after a commit

The patch lands in the commit,
not in the working tree.
After a commit that rewrote a link,
`git status` shows the file as modified because the working tree still holds the relative link;
`git checkout -- <file>` syncs it.
This is how cli-git's commit transaction behaves for every autofix policy,
including the built-in `final-newline`.

## Configuration

Register `markdownLintPlugin` in trusted cli-git configuration,
then enable its policy ID under the consumer-owned namespace.

```ts
// cli-git.config.ts
import {
  defineConfig,
  markdownLintPlugin,
} from '@monochromatic-dev/git-policy-cli/ts';

export default defineConfig({
  plugins: { markdown: markdownLintPlugin, },
  policies: {
    'markdown/autofix': [
      'warn',
      {
        rules: ['markdown/lfs-image-url',],
        exclude: ['package/ssg/',],
      },
    ],
  },
},);
```

Options:

- `command`:
  executable and leading arguments,
  resolved from the repository root.
  Default `['monochromatic-lint']`,
  the executable the repository installs through mise as `cargo:monochromatic-lint`.
- `rules`:
  monochromatic-lint rule ids to enable at `error`.
  Default `['markdown/lfs-image-url']`,
  so prose rules never rewrite a commit unasked.
- `exclude`:
  gitignore-syntax patterns for candidates the policy leaves alone;
  also given to the `markdown/lfs-image-url` rule as its `exclude` option.
  Default empty.

The default severity is `warn` and the policy is warn-safe:
fixes apply,
unfixable violations are reported,
and the commit proceeds.

## Build and test

```sh
mise run //package/git-policy/markdown-lint:build
mise run //package/git-policy/markdown-lint:test:unit
mise run //package/git-policy/markdown-lint:lint
```

The unit tests start the real `monochromatic-lint` found on `PATH`,
so it has to be installed first,
which `mise install` at the repository root does.
Stand-in Node scripts cover the exit statuses and signals the real linter does not produce on demand.
