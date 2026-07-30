# dprint workspace integration and formatting conflicts

This file documents four independent dprint operational issues that
share the same package surface.
 Each is treated as its own bug section
with symptom,
 root cause,
 verification,
 workarounds with tradeoffs,
what does not work,
 and a 5-constraint upstream audit.

---

## Bug 1: dprint installed as a workspace dev dependency causes 5+ second startup overhead

### Symptom

`dprint check` or `dprint fmt` invoked via `pnpm exec dprint` or
through a workspace task that depends on the npm-installed binary
spends multiple seconds on startup before producing any output,
 even
for a single small file.
 The same `dprint` binary invoked directly
(e.g. from a globally installed copy) returns in under 100ms.

### Root cause

The npm distribution of dprint is a Node wrapper that re-execs the
real native dprint binary located inside the package.
 Each invocation
pays the full Node startup cost (interpreter init,
 module resolution,
package.
json discovery) before the native binary even starts.
 In a
pnpm-isolated workspace the resolution walk traverses additional
symlink layers,
 compounding the cost.

This is a packaging choice (Node wrapper around a native binary),
 not
a dprint-internal bug.
 The native binary itself is fast;
 the wrapper
is the slow part.

### Verification

Time the two invocation paths against a stable target:

```bash
# Node-wrapped path (slow):
time pnpm exec dprint --version

# Direct binary path (fast):
time "$(mise which dprint)" --version
```

On this workspace's hardware,
 the first form measures around 2.5s
cold-cache and 1.0s warm;
 the second measures sub-100ms regardless of
cache state.

### Verified workaround

Remove dprint from the root `package.json` `devDependencies` and let
mise (via `.prototools` / `mise.toml`) manage the version instead.
Workspace tasks invoke the mise-managed binary directly.
 The npm
package is no longer installed;
 the Node wrapper is no longer in the
critical path.

Tradeoff:
 every developer must have mise installed (already a
workspace requirement).
 The pnpm dependency tree no longer pins
dprint's version explicitly;
 mise pins it via `.tool-versions` /
`mise.toml`.
 Drift between developers is bounded by mise's lockfile
behaviour.

The `config-dprint` workspace package therefore does **not** declare
`dprint` as a peer dependency:
 doing so would re-introduce the npm
install path consumers would have to depend on.

### What does not work

- `corepack`-style auto-resolution:
   dprint is not a Node package
  manager and is not in corepack's supported list.
   The native binary
  cannot be invoked through corepack.
- Configuring pnpm to skip postinstall scripts for dprint:
   the slow
  part is the Node wrapper at *invocation* time,
   not at install time.
  Postinstall behaviour is irrelevant.

### Why we do not file this upstream

1. **Is it really upstream's fault?
   ** Partly.
    The Node wrapper exists
   so dprint can be installed via npm;
    it is by design.
    The slowness
   is a consequence of the design,
    not a defect.
2. **Can upstream fix it?
   ** Not without removing npm installation,
   which is a major distribution change.
3. **Are they supporting this use case?
   ** Yes;
    the wrapper is
   documented and works correctly,
    just slowly.
4. **Will they likely fix it?
   ** No movement in that direction in
   recent dprint releases.
    The shape is stable.
5. **Have we prototyped a minimal fix?
   ** Our fix is to bypass the
   wrapper entirely (use the native binary through mise).
    That is a
   downstream choice,
    not a fix dprint can ship.

Decision:
 no upstream report.
 The native binary path solves it locally.

---

## Bug 2: dprint VS Code extension cannot find dprint in WSL with pnpm-isolated installs

### Symptom

The dprint VS Code extension,
 connected to a WSL workspace,
 fails on
startup with:

```text
[Error] dprint client: couldn't create connection to server.
Launching server using command dprint failed. Error: spawn dprint ENOENT
```

Format-on-save through the extension stops working;
 CLI invocations
still succeed.

### Root cause

The dprint VS Code extension spawns `dprint` from the user's PATH at
extension activation.
 In a pnpm-isolated workspace,
 dprint is installed
under `node_modules/.bin/`,
 not in any directory that ends up on PATH
under WSL's typical shell rc files (the extension launches the server
before any login shell runs `.profile`).

The extension exposes a `dprint.path` setting precisely for this case.
Default-PATH resolution is the failure mode.

### Verification

```bash
# Inside the WSL shell where VS Code is connected:
which dprint
# Empty output: PATH does not include node_modules/.bin

ls node_modules/.bin/dprint
# Symlink exists; this is the path the extension needs to be told about.
```

### Verified workaround

Point the extension at the workspace-local install.

For `.code-workspace` files:

```json
{
  "settings": {
    "dprint.path": "./node_modules/.bin/dprint"
  }
}
```

For `.vscode/settings.json`:

```json
{
  "dprint.path": "./node_modules/.bin/dprint"
}
```

Reload the VS Code window after editing.
 The setting is workspace-scoped;
it does not leak into other projects.

Tradeoff:
 the path is hard-coded as relative.
 If the workspace root
moves (rare),
 the setting needs to follow.
 The setting is committed,
so every team member benefits without further configuration.

### Alternative workaround

Install dprint globally inside WSL so `which dprint` resolves:

```bash
npm install -g dprint
```

Tradeoff:
 maintains a separate global install per developer;
 version
drift between the global copy and the project-pinned copy can cause
formatting discrepancies.
 Prefer the workspace-relative setting unless
multiple projects on the same machine need different setups.

### What does not work

- Adding `node_modules/.bin` to PATH via `.bashrc` / `.zshrc`:
   the
  extension launches its server before login-shell rc files run,
   so
  the PATH it sees is the system default,
   not the user's interactive
  PATH.
- Symlinking `node_modules/.bin/dprint` to `/usr/local/bin/dprint`:
  works for that one project but breaks every other workspace that
  pins a different version.

### Why we do not file this upstream

1. **Is it really upstream's fault?
   ** Borderline.
    The extension has a
   `dprint.path` setting precisely because PATH-resolution can fail in
   workspace-managed setups;
    that is upstream acknowledgement that the
   failure mode is expected.
2. **Can upstream fix it?
   ** They could auto-detect
   `node_modules/.bin/dprint` when present.
    Probably worth a feature
   request,
    not a bug report.
3. **Are they supporting this use case?
   ** Documented escape hatch
   exists;
    the use case is supported.
4. **Will they likely fix it?
   ** Unknown;
    not a critical defect.
5. **Have we prototyped a minimal fix?
   ** No.

Decision:
 no upstream report.
 The setting works;
 documenting it here
is sufficient.

---

## Bug 3: dprint emits TypeScript baseUrl warnings on non-relative paths

### Symptom

Running dprint produces warnings such as:

```text
warn: Non-relative path "package/config/oxlint/src/index.ts" is not allowed when "baseUrl" is not set (did you forget a leading "./"?)
```

Formatting still completes;
 the warnings are noise but pollute CI logs
and obscure real diagnostics.

### Root cause

dprint's TypeScript plugin loads the workspace `tsconfig.json` to
resolve module paths.
 When `baseUrl` is unset,
 non-relative module
specifiers (paths that do not start with `.` or `..`) cannot be
resolved against a known root,
 and the plugin emits a warning per
file.

The cross-reference doc
([`TROUBLESHOOTING.typescript.md`](typescript.md#typescript-path-warnings-with-dprint))
covers the canonical fix:
 set `baseUrl: "./"` in the root
`tsconfig.json`.

### Verified workaround

See
[`TROUBLESHOOTING.typescript.md`](typescript.md#typescript-path-warnings-with-dprint).

Tradeoff:
 setting `baseUrl` changes how TypeScript resolves modules in
the rest of the workspace.
 The setting is opt-in for that reason;
 the
workspace has accepted it because every package's `tsconfig.json`
inherits the same base and behaves consistently.

### What does not work

- Adding `"./"` prefix to every import in the codebase:
   relative
  prefixes cure the warning but lose the monorepo's package-name
  imports that consumers rely on.
- Ignoring the warnings via dprint config:
   there is no per-rule
  suppression for this diagnostic;
   it surfaces as an unconditional
  log entry.

### Why we do not file this upstream

The warning correctly identifies a TypeScript configuration ambiguity.
Suppressing it would silently mask real misconfigurations;
 dprint's
diagnostic is appropriate.

1. **Is it really upstream's fault?
   ** No.
2. **Can upstream fix it?
   ** Nothing to fix.
3. **Are they supporting this use case?
   ** Yes;
    the warning explicitly
   names the missing setting.
4. **Will they likely fix it?
   ** N/A.
5. **Have we prototyped a minimal fix?
   ** N/A.

Decision:
 no upstream report.
 Fix is on our side via the tsconfig
`baseUrl` setting.

---

## Bug 4: Learning Rust's canonical compact HTML conflicts with repository formatting policy

### Symptom

The learning Rust package requires every standalone HTML page to repeat exact compact CSS recorded in
`package/learning/rust/NOTES.md`.
The source uses decimal `oklch()` lightness,
unitless zero hue,
nested one-line media rules,
and one-line declaration blocks.

The repository's dprint and Stylelint checks reject every current page:

```text
package/learning/rust/lessons/index.html
package/learning/rust/lessons/0001-whats-different-about-this-book.html
package/learning/rust/reference/index.html
package/learning/rust/reference/reading-loop.html
package/learning/rust/reference/aquascope-decoder.html
```

Run the checks from repository root:

```bash
mise run //:lint:dprint -- \
  package/learning/rust/lessons/index.html \
  package/learning/rust/lessons/0001-whats-different-about-this-book.html \
  package/learning/rust/reference/index.html \
  package/learning/rust/reference/reading-loop.html \
  package/learning/rust/reference/aquascope-decoder.html

mise run //:lint:stylelint -- 'package/learning/rust/**/*.html'
```

At dprint 0.55.2,
every file is listed as unformatted and the task exits 20.
At Stylelint 17.14.1 with `stylelint-config-standard` 40.0.0,
each file emits the same 8 errors:

- 2 `lightness-notation` errors;
- 2 `hue-degree-notation` errors;
- 2 `at-rule-empty-line-before` errors;
- 1 `declaration-block-single-line-max-declarations` error;
- 1 `declaration-empty-line-before` error.

The package therefore emits 40 Stylelint errors in total.

### Root cause

This is a downstream source-policy conflict,
not an upstream defect in dprint or Stylelint.

`package/learning/rust/` is not a package,
despite the wording used elsewhere in this section.
It has no `package.json` and no `mise.toml`,
the pnpm workspace glob `package/*/*` needs a `package.json` to match,
and nothing in the repository references it except this document.
The accurate framing is an authored learning-content contract conflicting with root tooling defaults,
which is why `add a package verifier` is not actionable as written.

`package/config/dprint/index.json` associates every HTML file with
`markup_fmt` 0.23.1 and embedded CSS with Malva 0.14.1.
The configured markup formatter uses 90-column wrapping and single quotes.
Formatting the decoder at commit `70e92d983` changed 3,419 diff lines:
1,969 insertions and 1,450 deletions.
The corrective commit `05f640f50` restored the compact package contract.

`stylelint-config-standard` 40.0.0 enables the relevant rules in its `index.js`:

- `lightness-notation: percentage`;
- `hue-degree-notation: angle`;
- `declaration-block-single-line-max-declarations: 1`;
- blank-line rules for at-rules and ordinary rules.

The workspace config also requires blank lines before ordinary declarations in
`package/config/stylelint/index.mjs`.
Its `unit-disallowed-list` bans `deg` and says to use `turn`.
Stylelint's automatic fix changes unitless hue zero to `0deg`,
then the workspace rule rejects that generated unit.
Starting from canonical CSS,
`stylelint --fix` therefore stops with 2 `unit-disallowed-list` errors and the single-line declaration error.

Both tools can share a stable output.
A disposable fixture passed both checks after it used percentage lightness,
`0turn` hue,
expanded declaration blocks,
required blank lines,
and dprint's HTML layout.
The conflict is between that shared format and the exact compact source contract,
not between the tools' final formats.

### Measured behaviour of the ignore and override mechanisms

Measured in a throwaway worktree at `HEAD` `aa4747a1e` with the tool versions recorded in this section.

`<!-- dprint-ignore-file -->` is honoured by `markup_fmt` 0.23.1,
but only as the very first line of the file,
ahead of `<!doctype html>`.
`dprint check` then exits 0 and `dprint fmt` leaves the file byte-identical.
Placed on line 2, after the doctype, the directive is ignored:
`dprint check` exits 20 and `dprint fmt` reformats the file.
The rejected `markup.ignoreCommentDirective` configuration key is unrelated to the built-in directive.

The pre-doctype placement is safe in Chromium.
Measured through `agent-browser` on a disposable copy:
`document.compatMode` stays `CSS1Compat`,
`document.doctype.name` stays `html`,
`document.firstChild.nodeType` is 8, the comment node,
and no console errors appear.
The HTML parser's initial insertion mode inserts a leading comment into the document
without entering quirks mode.

`<!-- dprint-ignore -->` placed immediately before `<style>` does not protect the embedded CSS.
Malva still expands the compact one-line `@media` rules.

A Malva `/* formatter-ignore */` comment as the first thing inside `<style>` does protect the block,
because this repository already sets `"ignoreCommentDirective": "formatter-ignore"`.
`/* formatter-ignore-file */` and `/* dprint-ignore */` do not.

An `excludes` entry in the root `dprint.json` works and preserves inherited excludes.
Adding `"package/learning/rust/**/*.html"` drops `dprint output-file-paths` from 767 to 762 entries,
removing exactly the five learning pages,
while `node_modules`, `dist`, `src/i18n`, and the `toml-edit` fixtures stay excluded.
Ten other HTML files remain covered.
Invoking `dprint check` with those paths explicitly then exits 14 with `No files found to format`.

`markup_fmt` reflows prose at `printWidth: 90`.
Formatting `package/learning/rust/reference/reading-loop.html` split a single authored `<li>` sentence
between `required` and `concepts`,
a boundary chosen by column count.
The two prose pages formatted together produced 200 insertions and 153 deletions.
The recurring cost is that later prose edits reflow neighbouring lines,
so `broad one-time HTML churn` describes only the initial conversion.

The shared fixed point that passes both tools is 20 lines of CSS,
against 8 in the canonical snippet.
`package/learning/rust/NOTES.md` also requires keeping the CSS `near ten lines`,
so revising the contract breaches a second rule in the same file.
Blank lines between consecutive custom properties are rejected by `custom-property-empty-line-before`;
only `background-color` takes a preceding blank line.

Stylelint coverage is not all-or-nothing.
A root `overrides` entry scoped to `package/learning/rust/**/*.html` can re-point the five conflicting rules
to `lightness-notation: 'number'`,
`hue-degree-notation: 'number'`,
`at-rule-empty-line-before: 'never'`,
`declaration-block-single-line-max-declarations: 2`,
and `declaration-empty-line-before: 'never'`.
The five canonical pages then exit 0,
`stylelint --fix` leaves them byte-identical,
and the rules affirmatively reject drift from the compact form.
`color-named`,
`function-disallowed-list`,
`unit-disallowed-list`,
`media-feature-name-unit-allowed-list`,
`media-feature-range-notation`,
and `media-feature-name-disallowed-list` all still fire inside the boundary,
and the five rules keep their standard values outside it.

Because `stylelint --fix` becomes a no-op on the canonical CSS under those values,
the auto-fix trap recorded in this section is resolved rather than avoided.

### Resolution options

The recommendation below predates those measurements and is superseded by
`doc/planning/learning-rust-formatting-boundary.md`,
which ranks a dprint-only exclusion plus re-pointed Stylelint rules first.
The options are kept here as the original record.

#### Superseded recommendation: revise the package source contract

Change `package/learning/rust/NOTES.md` from an exact compact snippet to a semantic contract,
then update and dprint-format every affected HTML file.
Use `10%` and `90%` lightness,
`0turn` hue,
expanded declaration blocks,
and required blank lines before running dprint.

Pros:
all repository checks cover the files;
no lint rule,
exclusion,
or suppression is added;
rendered light and dark behavior remains unchanged.

Cons:
the source is no longer the learner-approved compact form;
the initial formatting pass creates broad one-time HTML churn.

#### Exclude the package and add a package-specific verifier

Exclude `package/learning/rust/**/*.html` from dprint and Stylelint,
then add a verifier for exact CSS,
HTML parsing,
local links,
and browser rendering.

Pros:
preserves the exact authored source;
makes the exception explicit and testable.

Cons:
removes general formatter and CSS-linter coverage;
requires approved lint-policy loosening and permanent custom verification.

#### Add repeated local ignore and disable directives

Mark each file ignored by dprint and wrap its CSS in scoped Stylelint disables with rationale.

Pros:
preserves global configuration and current rendered behavior.

Cons:
clutters every teaching file;
still removes tool coverage;
requires suppression documentation;
repeats maintenance in every new page.

Ranking:
revise contract > exclude plus verifier > local directives.
Revising ranks above exclusion because it retains repository-wide guardrails without exceptions.
Exclusion ranks above directives because a single explicit package boundary is easier to audit than repeated local suppressions.

### Scoped-formatting constraint

The root `format` task is not a safe scoped substitute during concurrent work.
A dry run with a single HTML path sends that path to `dprint fmt`,
but its nested Stylelint,
Oxlint,
and Markdown formatter tasks still run globally.
Implementation should add an explicit scoped dprint task or use a disposable worktree,
then copy only reviewed package files.

### Verification requirements

A resolution is complete when:

- `package/learning/rust/NOTES.md` records the chosen source policy;
- every affected HTML file passes the scoped dprint check;
- every affected HTML file passes the scoped Stylelint check,
  or an approved exclusion has an equivalent package verifier;
- every page still opens through `file:///`;
- automatic light and dark colors remain correct;
- local navigation and interactive details still work;
- no unrelated file is changed by a global auto-fix.

### Why we do not file this upstream

Both tools behave according to their current configuration.
Dprint formats associated HTML and embedded CSS;
Stylelint enforces rules selected by this repository.
The exact compact snippet is also a repository decision.
Upstream projects cannot choose which local policy should win,
so resolution belongs in this repository.
