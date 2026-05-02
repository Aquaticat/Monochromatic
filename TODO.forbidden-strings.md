# Forbidden strings: enforcement plan

Plan for blocking enumerable literal/regex strings from being introduced in commits,
both locally and in CI.
This document deliberately does not name any of the forbidden terms,
because every committed file in this repo (including this plan) is itself a place
the rule must not appear.

## Goal and threat model

Block accidental introduction of a small, enumerable list of forbidden literal/regex strings
into any committed file -- source, docs, configs, commit messages.
The defended-against case is **slip-ups by trusted contributors**, not adversarial commits.
Pre-commit hooks are bypassable with `--no-verify`, and trivial obfuscation
(string concatenation, base64, lookalike Unicode) defeats literal scanning;
the CI mirror is the actual line of defense and must be required by branch protection on `main`.

A defining constraint that separates this from generic deny-list tooling:
**the forbidden terms themselves are sensitive enough that they cannot appear in any committed file**,
including the file that defines the rules.
This rules out the dogfooded gitleaks/hk pattern (where rule files contain the literal patterns
and are simply excluded from scanning by glob), and forces an out-of-band storage architecture.

Out of scope:

- Credential/secret detection -- existing repo-level tooling and provider-side scanning cover that
- Content moderation by category (politics, brand, legal) -- regex deny-lists are a tarpit for that;
  use code review and threat-modeled per-PR checklists instead
- Already-committed history -- requires a separate `git filter-repo` operation and force-push,
  out of scope here

## Decision: hk + custom TypeScript scanner with plain-text out-of-band deny-list

Adopt **hk** (`https://hk.jdx.dev/`, `jdx/hk`) as the git hook runner
and implement the deny-list as a small TypeScript step invoked via `bun`.
The deny-list contents live in a `.gitignore`'d **plain-text** file
each contributor maintains locally;
only the scanner code, the loader, and an example template are committed.

The deny-list file format is one rule per line, with two forms:

- A bare line is a case-sensitive literal substring match
- A line of the shape `/PATTERN/FLAGS` is a regex match,
  delimited by the first `/` and the last `/`

Example shape (illustrative; real contents do not appear in this document):

```txt
PlaceholderLiteral
/placeholder.regex/i
```

Empty lines are ignored.
Lines starting with `#` are ignored as comments.
A literal that itself matches the shape `^/.+/[a-z]*$` must be expressed as a regex
(e.g. ban `/etc/passwd` literally with `/\/etc\/passwd/`).
There is no other syntax -- the format is deliberately minimal.

### Why hk over alternatives

- **Tool-family alignment.**
  hk is by the mise author; this repo is mise-heavy.
  Single mental model, single maintainer ecosystem, unified `mise use` install path.
- **Generic step model.**
  hk steps run arbitrary shell commands; a `bun run` invocation is first-class,
  honoring the AGENTS.md "no bash scripts; use TypeScript files" rule.
- **One config powers local and CI.**
  `hk run pre-commit` locally, `hk check --from-ref origin/main` in CI.
  No duplicated rule definitions across husky and a GitHub Action.
- **Production-ready.**
  `v1.44.3` released 2026-04-30, ~800 stars, active.

### Why not the alternatives

- **git-secrets** -- AWS Labs project, last tag in 2020, no CI story without scripting it yourself.
  Rules live in opaque `git config` entries (good for the out-of-band requirement)
  but the project is effectively unmaintained and ergonomics are poor for a multi-package monorepo.
- **gitleaks + custom rules** -- well-maintained and widely used,
  but the canonical pattern stores patterns in a TOML file in the repo.
  Storing patterns out-of-band is possible (`--config`-from-stdin, fetched at runtime)
  but cuts against the tool's grain.
- **trufflehog** -- custom regex detectors require a `keywords` filter,
  not a clean deny-list. Designed for credential scanning, not literal blocking.
- **secretlint with `@secretlint/secretlint-rule-pattern`** -- works,
  but pulls a JS-ecosystem secret-scanning framework for one rule type.
- **GitHub native push protection / custom patterns** --
  custom patterns require GitHub Secret Protection (paid),
  unavailable on free public repos owned by individuals.
- **Native git hook + `grep` script** --
  AGENTS.md prohibits bash scripts; would need to be rewritten in TS anyway,
  at which point hk gives the same result with better ergonomics.
- **`pre-commit/pre-commit-hooks` (Python pre-commit framework)** --
  no built-in or popular community hook for arbitrary forbidden-words enforcement.
  Pulls a Python tool into a Bun/mise repo; tool-family mismatch.

## Implementation plan

### Where the deny-list lives

The deny-list cannot be committed.
Options considered:

1. **Per-contributor gitignored file.**
   Each contributor maintains `forbidden-strings.local.txt` themselves.
   Simplest, fits a small-team or solo repo, no shared-secret distribution problem.
   Downside: enforcement is uniform only by convention; one contributor's missing rule
   means CI cannot block that term either, since CI also reads from a configured location.
2. **Shared deny-list via a private channel.**
   Distribute via a private git submodule, an encrypted file with the key out-of-band,
   1Password / a secrets manager, or fetched at hook-runtime from an authenticated endpoint.
   Stronger consistency, real distribution overhead.
3. **Hash-based deny-list, committed.**
   Store SHA-256 of each forbidden literal; scanner hashes candidate substrings
   and compares against the hash list.
   Works only for case-sensitive exact literals; breaks regex matching
   unless the scanner enumerates variants.
4. **GPG-encrypted deny-list, committed as ciphertext.**
   Each contributor decrypts at hook-runtime with their own key.
   Adds a key-management step but lets the file live in the repo.

The recommended starting point is option 1 for both local and CI.
For CI, the file is provided as a GitHub Actions secret containing the plain-text deny-list,
written to `forbidden-strings.local.txt` at job-start; same path, different source.
This means CI enforces whatever the secret holds, even if a contributor's local file diverges.

### Files to add (committed)

- `hk.pkl` -- hk configuration; one `pre-commit` step invoking the scanner
- `scripts/scan-forbidden.ts` -- Bun TypeScript scanner; reads staged blobs,
  parses `forbidden-strings.local.txt`, exits non-zero on hit
- `forbidden-strings.local.example.txt` -- placeholder template a contributor copies
  to `forbidden-strings.local.txt` on first setup;
  contains only an obviously-fake placeholder line
- `.github/workflows/forbidden-strings.yml` -- CI mirror; materializes the deny-list
  from a repository secret, then calls `hk check --from-ref origin/main`
- `mise.toml` (root) addition under `[tools]` -- pin `hk` and `pkl` versions

### Files to modify

- `.gitignore` -- add `forbidden-strings.local.txt`
- `.husky/pre-commit` -- replace the existing `yarn run -T -B monochromatic precommit` line
  with `hk run pre-commit` (or chain hk before the existing task,
  pending review of what `monochromatic precommit` still does)
- Branch protection on `main` (configured outside the repo on GitHub)
  to require the new CI check to pass before merge

### Scanner design

The scanner must read the **staged blob**, not the working-tree file,
so an unstaged edit cannot bypass or false-trigger the check.
On startup the scanner parses `forbidden-strings.local.txt` line-by-line:
empty lines and `#` comments are skipped;
a line matching `^/.+/[a-z]*$` is compiled as a regex with the trailing letters as flags;
every other non-empty line is a case-sensitive literal substring rule.
For each path passed in:

1. Runs `git show :PATH` to get the staged content
2. For each parsed rule, applies the literal `String#includes` or compiled regex
3. Reports `path:line:start-col..end-col` for every hit, plus a stable rule index (1-based)
4. Exits `1` if any rule fired, `0` otherwise

Columns are 1-based code-unit offsets within the matched line.
The range is inclusive on both ends; for a hit at column 14 spanning four characters,
the report reads `path:42:14..17`.

The scanner must explicitly **not** print the matched substring,
the rule pattern, or any surrounding line context in failure messages --
only the path, line number, column range, and the opaque rule index.
Otherwise the failing CI log itself becomes a leak surface.
The column range leaks only the length of the match,
which is an accepted tradeoff for editor-jumpable output.
A contributor wanting to know which rule fired looks up the index against their local file.

### Pkl configuration sketch

```pkl
amends "package://github.com/jdx/hk/releases/download/v1.44.3/hk@1.44.3#/Config.pkl"

hooks {
  ["pre-commit"] {
    steps {
      ["forbidden-strings"] {
        check = "bun run scripts/scan-forbidden.ts {{files}}"
      }
    }
  }
  ["check"] {
    steps = (hooks["pre-commit"].steps)
  }
}
```

### CI workflow sketch

A single GitHub Actions job on pull_request and push to main:

1. Checkout with full history (`fetch-depth: 0`) so `--from-ref` works
2. Materialize `forbidden-strings.local.txt` from a repo secret
   (e.g. `secrets.FORBIDDEN_STRINGS_LIST`) -- the secret holds the full plain-text deny-list
3. Install mise, run `mise install` to get hk and bun
4. `hk check --from-ref origin/main` -- runs the same steps the local hook runs,
   scoped to the changed files in the PR

The workflow YAML must not echo the secret.
GitHub masks secret values in logs, but the materialization step must read from
an `env:` value piped to the file (e.g. `printenv FORBIDDEN_STRINGS_LIST > path`),
not interpolate the secret into a `run:` block where shell expansion could leak it.

Make this a required check in branch protection so `--no-verify` locally cannot land on `main`.

## Caveats and known limitations

- **`--no-verify` bypasses the local hook.**
  This is true of every option in this category.
  CI is the enforcement; the hook is the fast feedback loop.
- **Obfuscation defeats literal scanning.**
  Anyone who wants to bypass can split the string, encode it, or use Unicode lookalikes.
  Deny-lists work for accident prevention only.
- **`{{files}}` passes working-tree paths.**
  The scanner must read the staged blob via `git show :PATH` to scan the actual content
  that would be committed. Trusting the working tree is the most common bug in this pattern.
- **Already-committed instances of forbidden strings remain in history.**
  Searching with `git log -S` and GitHub search will still surface them.
  Cleanup requires `git filter-repo` and a force-push -- a separate, destructive operation
  not in scope here.
- **The deny-list grows by accretion.**
  Without periodic review, false positives accumulate
  and contributors learn to `--no-verify` reflexively.
  Plan: review the list quarterly, remove unused rules, document why each entry exists.
- **Pkl is a new config language for this repo.**
  Reviewers will need a one-time orientation;
  pinning the Pkl version via `mise` mitigates surprise.
- **Performance.**
  Reading every staged blob via `git show` per commit is fine for normal PR sizes
  but could become noticeable on large refactors.
- **Failure messages must be redacted.**
  Printing the matched substring or surrounding lines in error output
  turns a CI log into a leak surface;
  the scanner reports only `path:line:start-col..end-col` and the opaque rule index.
  The column range leaks the match length only, which is the accepted floor.

## Rollout

1. Land hk + the scanner with the loader pointing at a `.local.txt` file that contains
   only an obviously-fake placeholder rule.
   Verify the local hook fires and the CI job runs green on a no-op PR.
2. Configure the GitHub Actions secret holding the real plain-text deny-list.
   Confirm CI fails on a test PR introducing a deny-listed term.
3. Distribute the real `forbidden-strings.local.txt` to each contributor via a private channel.
4. Enable branch protection on `main` to require the CI check.
5. Document the workflow for adding a new forbidden string in `docs/agents/forbidden-strings.md`
   (or extend an existing agent doc):
   how to update the local file, how to update the CI secret,
   and how to format new rules.

## Open questions

- **Scope of files scanned.**
  Source files only, or also documentation, commit messages, and config files?
  Default: every staged file. Excluding any class of file is a request to allow the term there,
  which should be a deliberate, justified decision.
- **Documents that legitimately need to discuss a forbidden term**
  (e.g. an incident postmortem referencing a customer name).
  The minimal format has no per-rule path filter,
  so this means either: (a) the scanner gains a global exclude list of paths
  (a second simple file) or (b) docs always use a deliberate alias.
  Decide before adding any rule whose forbidden term might appear in legitimate discussion.
- **Commit-message scanning.**
  hk supports a `commit-msg` hook;
  do we want the deny-list to fire there too?
  Default: yes, since commit messages are committed and historical.
- **Interaction with the existing `.husky/pre-commit`.**
  Current line is `yarn run -T -B monochromatic precommit`,
  which appears stale (the repo uses pnpm).
  Confirm whether that command still runs anything; if not, replace outright.
- **History cleanup policy.**
  Should we run a history search for each new rule before adding it,
  to know whether existing history already contains the term?
  If so, what's the policy -- block adding the rule until history is clean,
  or accept that the rule prevents future introductions only?
- **Distribution channel for the real deny-list.**
  Per-contributor manual setup (simplest) versus a private submodule, encrypted file,
  or fetched-from-private-endpoint (more robust, more setup overhead).
- **Whether option 4 (GPG-encrypted committed file) is preferable to option 1 + CI secret.**
  Tradeoff: GPG adds key management for every contributor;
  CI secret only enforces in CI and depends on contributors maintaining their own copy locally.

## Prior art consulted

- hk: `https://hk.jdx.dev/`, `https://github.com/jdx/hk`
- gitleaks: `https://github.com/gitleaks/gitleaks` (custom rules supported, well-maintained)
- git-secrets: `https://github.com/awslabs/git-secrets` (stale, last tag 2020)
- trufflehog: `https://github.com/trufflesecurity/trufflehog`
  (custom regex requires keyword filter, not a pure deny-list)
- secretlint: `https://github.com/secretlint/secretlint`
  (`@secretlint/secretlint-rule-pattern` accepts arbitrary regex)
- pre-commit framework: `https://pre-commit.com/`
  (no popular community hook for arbitrary forbidden words)
- GitHub Secret Protection custom patterns:
  `https://docs.github.com/en/code-security/secret-scanning/`
  (paid; not available on free public repos)
