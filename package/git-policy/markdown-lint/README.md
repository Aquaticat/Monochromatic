# Git policy markdown-lint

Optional cli-git policy that runs `cli-markdown-lint --fix` over the Markdown files of a commit,
inside the commit transaction,
so the selected rules land their fixes in the commit itself.

The package owns the policy source and tests.
Cli-git statically bundles generated source mirrors into its single import and executable artifact.
Importing either package does not register or enable the policy.

## Why it exists

Issue #476:
a Markdown image that points at an LFS-tracked file renders as pointer text on GitHub.
The `lfs-image-url` rule of `cli-markdown-lint` rewrites such links to object URLs on the repository's LFS server,
and this policy applies that rewrite at commit time so authors keep writing relative links.

## How it works

For every candidate that is an added or modified `.md` or `.mdx` file,
the policy pipes the exact candidate bytes into
`markdown-lint --fix --format=json --stdin-path=<path> --rule=<id>...`
with the repository root as working directory.

- A changed result becomes a `markdown-autofix` finding carrying a full-content `git-unified` patch,
  which cli-git applies to its private index before real Git commits.
  At lifecycle points that cannot apply patches the same finding is report-only.
- Every violation the selected rules could not fix becomes a `markdown-violation` finding without a patch.
- Candidates that are not UTF-8 are skipped.
- A subprocess that cannot start,
  is interrupted,
  or reports a usage error raises `MarkdownLintPluginError`.

The CLI runs as a subprocess because it carries a native parser that cannot be bundled into the trusted
configuration artifact.
Candidates are processed one at a time so a large commit never starts one Node process per file at once.

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
        rules: ['lfs-image-url',],
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
  Default `['node', 'package/cli/markdown-lint/src/cli.ts']`.
- `rules`:
  rule ids markdown-lint runs.
  Default `['lfs-image-url']`,
  so prose rules never rewrite a commit unasked.
- `exclude`:
  gitignore-syntax patterns for candidates the policy leaves alone;
  also forwarded to the `lfs-image-url` rule.
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
