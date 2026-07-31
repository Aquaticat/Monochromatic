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

## Bug 4: Learning Rust HTML conflicts with repository formatting policy

### Symptom

The learning Rust workspace contains five standalone HTML pages with repeated inline CSS.
`package/learning/rust/NOTES.md` requires the CSS to remain around ten lines and to contain no presentation
beyond the approved foreground and background colors.
CSS layout itself is not prescribed.

The current stylesheet has seven nonblank CSS lines.
The preferred achromatic values are now:

```css
oklch(0.1 none none)
oklch(0.9 none none)
```

Exact prose wrapping is also not prescribed.
A formatter may join or wrap prose,
but it must not split a tight grammatical unit such as a verb from its object.
List-like wrapping is acceptable.

The affected paths are:

```text
package/learning/rust/lessons/index.html
package/learning/rust/lessons/0001-whats-different-about-this-book.html
package/learning/rust/reference/index.html
package/learning/rust/reference/reading-loop.html
package/learning/rust/reference/aquascope-decoder.html
```

The current checks are:

```bash
mise run //:lint:dprint -- \
  package/learning/rust/lessons/index.html \
  package/learning/rust/lessons/0001-whats-different-about-this-book.html \
  package/learning/rust/reference/index.html \
  package/learning/rust/reference/reading-loop.html \
  package/learning/rust/reference/aquascope-decoder.html

mise run //:lint:stylelint -- 'package/learning/rust/**/*.html'
```

Before scoped configuration,
dprint reports all five files as different.
Stylelint reports 40 errors across the pages.

### Source-level root cause

`markup_fmt` 0.23.1 sends every non-empty `<style>` element to `format_style` in
`markup_fmt/src/printer.rs:701-737` at
[commit `2d902a5a1`](https://github.com/g-plane/markup_fmt/commit/2d902a5a1af8d7f07e06f189ae1e3132ea344e74):

```rust
} else if tag_name.eq_ignore_ascii_case("style") {
    let formatted = ctx.format_style(
        text_node.raw,
        // ...
    );
```

Its dprint adapter synthesizes an embedded path such as `index.html#.css` in
`dprint_plugin/src/lib.rs:54-90` at the same commit:

```rust
file_name.push("#.");
file_name.push(hints.ext);
format_with_host(SyncHostFormatRequest {
    file_path: &request.file_path.with_file_name(file_name),
    file_bytes: code.as_bytes(),
    // ...
})
```

A markup option cannot disable this delegation by path.
The synthetic path can still receive a scoped Malva configuration through dprint plugin overrides.

The prose conflict is separate.
At the root `printWidth: 90`,
`markup_fmt` introduces line breaks based on width rather than grammatical structure.

### dprint override behavior

dprint 0.55.2 documents plugin `overrides` in `website/src/config.md:284-339` at
[commit `89ff90b3c`](https://github.com/dprint/dprint/commit/89ff90b3cc6f9fa211c82fb5865491c8865ea79a).
Overrides change plugin settings for already routed files.
They do not alter discovery or associations.

This verified override matches embedded learning CSS:

```json
{
  "malva": {
    "overrides": {
      "files": "package/learning/rust/**/*.html#.css",
      "singleLineBlockThreshold": 2
    }
  }
}
```

It formatted every embedded stylesheet to seven nonblank CSS lines.
A second dprint run was byte-identical.
The previously measured 20-line dprint and Stylelint fixed point is not unavoidable.

### Markup-width probes

A disposable probe counted new line-break contexts inside HTML text nodes.
The count is a change detector,
not a grammar classifier.

- width 160 produced 94 new contexts;
- width 240 produced 30;
- width 320 produced 11;
- width 500 produced 3;
- width 600 produced none.

Width 600 avoided new break contexts by joining paragraphs.
It also produced:

- 1,441 insertions;
- 1,684 deletions;
- 225 lines longer than 120 characters in `aquascope-decoder.html`;
- 61 lines longer than 200 characters;
- a maximum line length of 593.

`whitespaceSensitivity: 'strict'` was not a preservation mode.
It produced 357,
100,
and 49 new contexts at widths 90,
160,
and 200.

At width 160,
all new contexts occurred in only these pages:

- `lessons/0001-whats-different-about-this-book.html`
- `reference/aquascope-decoder.html`

A selective configuration excluded those two files and formatted the other three at width 160.
With the scoped Malva override,
it produced no new text-node break contexts and kept all five styles at seven nonblank lines.
Stylelint fix and a second dprint run were byte-identical.

### Ignore-directive behavior

The pinned schema defines different node and file directives:

- `ignoreCommentDirective`:
  `markup-fmt-ignore`;
- `ignoreFileCommentDirective`:
  `dprint-ignore-file`.

`<!-- dprint-ignore -->` before `<style>` was not a valid node-ignore probe.
`<!-- markup-fmt-ignore -->` does skip the next node.

A node ignore before `<body>` or `<main>` preserved prose,
but the raw subtree kept its old indentation while its parent was reformatted.
The resulting nesting indentation was inconsistent.

`<!-- dprint-ignore-file -->` works as the first line before the doctype.
A prior Chromium probe preserved standards mode,
the HTML doctype,
and a clean console.
A root exclusion is still easier to maintain than repeating a file directive.

A Malva `/* formatter-ignore */` comment at the start of `<style>` also protects the CSS because the shared Malva
config names that directive.
It does not solve prose wrapping.

### Exclusion behavior

A root `dprint.json` exclusion for `package/learning/rust/**/*.html` removes exactly the five affected pages while
preserving inherited exclusions and other HTML coverage.

Explicit checks of only excluded paths exit 14 unless the caller passes `--allow-no-files`.
dprint 0.55.2 tests that flag for both `fmt` and `check` in
`crates/dprint/src/commands/formatting.rs:1413-1444` at the pinned dprint commit:

```rust
assert!(run_test_cli(vec![sub_command, "--allow-no-files", "**/*.txt"], &environment).is_ok());
```

The five-path disposable-worktree check exited 0 with the flag.

### Stylelint interaction

A scoped profile passed the preferred seven-line CSS in all five pages:

```js
{
  'at-rule-empty-line-before': 'never',
  'declaration-block-single-line-max-declarations': 2,
  'declaration-empty-line-before': 'never',
  'lightness-notation': 'number',
  'unit-allowed-list': ['deg'],
  'unit-disallowed-list': null,
}
```

The existing `hue-degree-notation: 'angle'` rule remained active.
The profile rejected percentage lightness,
`turn`,
pixel units,
and bare nonzero hue.
It left all five preferred pages unchanged in fix mode.

Generic Stylelint rules do not enforce the full channel preference.
`oklch(0.1 0 none)` passes.
A bare zero hue is diagnosed toward `0deg` rather than the preferred `none`.
Strict enforcement requires a narrow custom rule,
a package assertion,
or human review.
It is not necessary to add a new checker merely to resolve the formatter boundary.

### Separate Stylelint configuration defect

The workspace intends `media-feature-name-unit-allowed-list` to require `rem` for every media feature.
`package/config/stylelint/index.mjs` uses the plain string `'/[\w-]+/'` as its regex-shaped key.
JavaScript passes `/[w-]+/` to Stylelint because the plain string consumes the backslash.

A Stylelint 17.14.1 probe accepted `height: 10em` and rejected `width: 10em`.
`width` happens to contain `w`;
`height` does not.
This is a downstream configuration defect,
not a Stylelint defect.

### Independent package-content defect

`package/learning/rust/NOTES.md` requires this element in every page:

```html
<meta name="color-scheme" content="light dark">
```

Only `reference/aquascope-decoder.html` currently contains it.
The other four pages need correction regardless of the formatting decision.

### What does not work

- Treating the seven-line example as an exact formatting contract overstates the owner's requirement.
- Raising width to 600 avoids bad breaks by creating long source lines and broad churn.
- `whitespaceSensitivity: 'strict'` does not retain arbitrary prose wrapping.
- Removing Stylelint layout rules does not stop Malva from formatting embedded CSS.
- `<!-- dprint-ignore -->` is not the configured markup node directive.
- Ignoring `<body>` or `<main>` produces inconsistent indentation around the raw subtree.
- A post-format CSS restorer cannot reconstruct acceptable prose after markup formatting has discarded it.
- Replacing all of dprint takes responsibility for unrelated formats without improving the five-page result.
- Extracting a shared stylesheet violates the explicit package contract unless the owner revises it.

### Resolution

The recommended local resolution is:

- exclude all `package/learning/rust/**/*.html` files from dprint;
- pass `--allow-no-files` at scoped dprint call sites;
- update the five colors to preferred `none` zero channels;
- add the missing color-scheme meta to four pages;
- apply the tested Stylelint rules only to this path;
- keep dprint and Stylelint for all unrelated responsibilities;
- add no `AGENTS.md` rule;
- add no custom checker unless strict machine enforcement of the zero-channel preference is wanted.

A verified alternative excludes only the two prose-heavy pages and retains dprint on the other three through width
160 and synthetic-CSS overrides.
The complete comparison and rankings are in
`doc/planning/learning-rust-formatting-boundary.md`.

### Scoped-formatting constraint

The root `format` task is not a safe scoped substitute during concurrent work.
A single HTML path reaches dprint,
but nested Stylelint,
Oxlint,
and Markdown formatter tasks still run globally.
Use an explicit scoped task or disposable worktree,
then copy only reviewed files.

### Verification requirements

A completed implementation must verify:

- scoped dprint check exits 0 with `--allow-no-files`;
- all unrelated intended dprint paths remain discovered;
- scoped Stylelint check exits 0;
- Stylelint fix leaves the pages unchanged;
- every style remains around ten nonblank lines;
- all five pages contain the color-scheme meta;
- light and dark browser modes compute the approved colors;
- pages and relative links still work through `file:///`;
- no unrelated file is changed by a global formatter.

### Upstream filing decision

`.out-of-scope/` contains no matching dprint,
`markup_fmt`,
Malva,
or Stylelint entry.

Tracker searches covered `whitespace`,
`line break`,
`style`,
and exact symptom phrases across open and closed `g-plane/markup_fmt` issues and pull requests.
Issues [g-plane/markup_fmt#16](https://github.com/g-plane/markup_fmt/issues/16) and
[g-plane/markup_fmt#242](https://github.com/g-plane/markup_fmt/issues/242) discuss preferred layouts,
not a promise to preserve arbitrary author wrapping by path.

[dprint/dprint#772](https://github.com/dprint/dprint/issues/772) requested a no-files success mode.
dprint 0.43.0 added `--allow-no-files`.
There is nothing to add to that closed issue.

1. **Is it really upstream's fault?**
   No.
   The tools perform their configured formatting and linting.
   The conflict is repository policy.
2. **Can upstream fix it?**
   Not as a bug.
   More preservation options could help,
   but upstream cannot choose this package's prose and CSS policy.
3. **Are they supporting this use case?**
   They support canonical formatting and explicit ignore controls.
   They do not promise grammatical prose wrapping.
4. **Would the repository welcome our contribution?**
   Not evaluated because no upstream defect or necessary patch remains.
5. **Will they likely fix it?**
   Not applicable without an upstream defect.
6. **Have we prototyped a compatible minimal fix?**
   The verified consumer-side fixes are dprint exclusion,
   `--allow-no-files`,
   plugin overrides,
   and scoped Stylelint policy.

Decision:
file nothing upstream.
There is no upstream draft to retain.
