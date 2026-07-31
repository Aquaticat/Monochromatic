# Issue 401 formatting investigation handover

## Status

Investigation is active.
No implementation decision has been accepted.
GitHub issue [Aquaticat/Monochromatic#401](https://github.com/Aquaticat/Monochromatic/issues/401) is open.

Current repository `HEAD` when this handover was created:
`ada86560a4cf5eabad35f031f6ded140847bd1e2`.
The main worktree also contains unrelated `package/cli/wg-quicker/` and
`doc/troubleshooting/iproute2-family-fib-table-absence.md` changes.
Do not alter,
stage,
or commit those files.

## User requirements

- Investigate issue 401 more thoroughly than the earlier Claude analysis.
- Back suggestions with measurements,
  pinned upstream source,
  primary documentation,
  or executable probes.
- Update issue 401 incrementally as evidence develops.
- Reject prose breaks that split a tight grammatical unit.
  `I ate\na chicken.` is unacceptable.
  List-like breaks such as `I ate a chicken,\na pig,\nand a cow.` are acceptable.
  Exact authored prose line preservation is not required.
- Keep the learning CSS between five and twenty nonblank lines and add no presentation rules beyond the approved
  colors.
  CSS layout within that explicit line budget is not prescribed.
- For affected `oklch()` values,
  prefer lightness as `<number>`,
  chroma as `none` when zero or `<number>` otherwise,
  and hue as `none` when zero or `<number>deg` otherwise.
  Treat repository-wide scope for this syntax as unresolved unless the user broadens it.
- Consider repository-owned formatting and linting logic.
- Do not exclude the learning HTML from dprint.
  A formatter exemption would make formatter coverage untrustworthy and undermine the repository formatter over
  time.
- Treat replacing dprint as only one family of solutions.
- Treat replacing Stylelint as an intended direction because its dependency footprint is already considered
  excessive.
- Do not evaluate another existing CSS formatter or linter as the replacement.
  The current direction is repository-owned CSS tooling.
- Be comprehensive vertically,
  from immediate symptom mitigation through durable architecture.
- Be comprehensive horizontally,
  across materially different policy,
  configuration,
  workflow,
  assertion,
  generation,
  custom-tool,
  replacement,
  and upstream approaches.
- Maintain this handover after major evidence,
  corrections,
  decisions,
  issue updates,
  and before compaction or completion.
- Keep this policy package-local.
  Do not propose an `AGENTS.md` rule for it.

This is an investigation and proposal task.
Do not implement a selected product change until the user accepts or delegates the decision.
Documentation and disposable probes are authorized.

## Canonical affected sources

The five pages are:

- `package/learning/rust/lessons/index.html`
- `package/learning/rust/lessons/0001-whats-different-about-this-book.html`
- `package/learning/rust/reference/index.html`
- `package/learning/rust/reference/reading-loop.html`
- `package/learning/rust/reference/aquascope-decoder.html`

`package/learning/rust/NOTES.md` defines the package-local CSS contract.
It shows a seven-nonblank-line canonical example and requires CSS near ten lines with no extra presentation rules.
The user defined the accepted interpretation as five to twenty nonblank lines.
Formatting within that range is unconstrained.
The shown `oklch(0.1 0 0)` and `oklch(0.9 0 0)` values do not match the later preferred zero-channel syntax;
the preferred forms are `oklch(0.1 none none)` and `oklch(0.9 none none)`.
They also clarified that prose may reflow,
but a formatter must not split tight grammatical units such as a verb from its object.
List-like breaks are acceptable.
All five pages contained byte-identical embedded stylesheet content when probed at
`HEAD` `68eb96063`.
`NOTES.md` also requires `<meta name="color-scheme" content="light dark">` on every page.
Only `reference/aquascope-decoder.html` currently has it;
the other four affected pages do not.
This is a separate package-content defect and prevents treating the current corpus as a valid golden source.

Primary repository artifacts:

- `doc/planning/learning-rust-formatting-boundary.md`
- `doc/troubleshooting/dprint.md`
- `doc/troubleshooting/stylelint.md`
- `package/learning/rust/NOTES.md`
- `package/config/dprint/index.json`
- `package/config/stylelint/index.mjs`
- `dprint.json`
- `stylelint.config.mjs`
- `mise.toml`

## Verified current-tool behavior

### Formatter conflict

At the measured revision,
dprint 0.55.2 with `markup_fmt` 0.23.1 and Malva 0.14.1 reflowed prose at `printWidth: 90`.
Formatting two representative prose pages produced 200 insertions and 153 deletions.
The shared dprint and Stylelint fixed point expanded the seven-nonblank-line example to 20 lines.
That violates the approximate line-count budget.
Its particular formatting is not otherwise a contract violation.

`<!-- dprint-ignore-file -->` protects an entire HTML file.
`<!-- dprint-ignore -->` immediately before `<style>` does not protect the embedded stylesheet.
A Malva `/* formatter-ignore */` directive at the start of the style content protects that CSS,
but repeats local mechanism in every page.

Excluding `package/learning/rust/**/*.html` in root `dprint.json` removes exactly the five pages while retaining
other inherited excludes and ten other HTML files.
Explicit checks of excluded paths fail with dprint exit 14 unless the caller passes `--allow-no-files`.
A disposable-worktree probe of all five paths with that flag exited 0.

### Pinned source trace

Exact upstream versions were cloned and inspected:

- dprint 0.55.2
- `markup_fmt` 0.23.1
- Malva 0.14.1
- Stylelint 17.14.1
- `stylelint-config-standard` 40.0.0

`markup_fmt/src/printer.rs:701-737` always sends non-empty `<style>` content to `format_style`.
`dprint_plugin/src/lib.rs:54-90` gives embedded content a synthetic `#.css` path and delegates it to the host
formatter.
The schema has path overrides,
indent controls,
and ignore directives,
but no path option that disables embedded-style delegation while markup formatting continues.
This rules out exact arbitrary line preservation,
but exact preservation is no longer a requirement.
Path-specific width and CSS layout settings remain live candidates.

Dprint's `crates/dprint/src/commands/formatting.rs:1413-1444` tests `--allow-no-files` for both `fmt` and `check`.
Upstream issue `dprint/dprint#772` requested that behavior and records its release in dprint 0.43.0.

Broader tracker searches found related `markup_fmt` layout requests,
including issues 16 and 242,
but no defect promising arbitrary authored line-break preservation by path.
The conflict is local policy,
so no upstream issue is currently justified.

### Current-tool configuration reopened by the clarified contract

dprint 0.55.2 documents per-plugin `overrides` in `website/src/config.md:284-339`.
The embedded Malva request uses a synthetic `index.html#.css`-style path.
A verified override matching `package/learning/rust/**/*.html#.css` with
`singleLineBlockThreshold: 2` formatted each embedded style to seven nonblank CSS lines.
It retained the preferred `oklch(0.1 none none)` and `oklch(0.9 none none)` values and was idempotent.

Markup width probes counted newly introduced line-break contexts inside HTML text nodes:

- width 160 produced 94;
- width 240 produced 30;
- width 320 produced 11;
- width 500 produced 3;
- width 600 produced none.

Width 600 avoids new grammatical splits by joining paragraphs.
Its costs are 1,441 insertions and 1,684 deletions across the five files,
plus 225 lines longer than 120 characters and 61 longer than 200 in `aquascope-decoder.html`.
The longest generated line measured 593 characters.
`whitespaceSensitivity: 'strict'` produced 357,
100,
and 49 new contexts at widths 90,
160,
and 200;
it is not a preservation mode.

At width 160,
all new break contexts occurred in the two prose-heavy pages:
`lessons/0001-whats-different-about-this-book.html` and
`reference/aquascope-decoder.html`.
The other three pages produced none.
A selective two-file dprint exclusion plus width 160 and the scoped Malva override is therefore a live branch.
It retains more formatter coverage than excluding all five.

The valid node-ignore directive is `<!-- markup-fmt-ignore -->`,
not `<!-- dprint-ignore -->`.
The pinned schema uses `markup-fmt-ignore` for one node and `dprint-ignore-file` for a whole file.
Node-ignore probes before `<body>` and `<main>` preserved the prose,
but the raw subtree kept its old indentation while its parent was reformatted.
The mechanism works;
the resulting indentation makes exclusion or file ignore cleaner here.

### Stylelint surface

At the measured revision:

- Stylelint discovered 51 CSS or HTML paths;
- root ignores removed 32 paths;
- the active surface was 19 files containing 14 actual CSS regions;
- the merged config enabled 82 rules;
- 34 enabled rules advertised fixes and 48 did not;
- the repository-wide run reported 185 diagnostics;
- those diagnostics came from eight rule names;
- the five learning pages contributed 40 diagnostics.

The current Stylelint config requires percentage lightness and angle hue.
That conflicts with the newly stated affected-CSS preference for numeric lightness and `none` zero channels.

A path-scoped profile using `at-rule-empty-line-before: 'never'`,
`declaration-block-single-line-max-declarations: 2`,
`declaration-empty-line-before: 'never'`,
`lightness-notation: 'number'`,
`unit-allowed-list: ['deg']`,
and `unit-disallowed-list: null` produced zero diagnostics on all five formatted pages.
Stylelint fix mode and the next dprint run both left the files byte-identical.
The unit allow-list rejected percentage,
turn,
and pixel probes.

The generic rules still miss one desired condition.
`oklch(0.1 0 none)` passes,
and a bare zero hue is fixed toward `0deg` rather than `none`.
A package-local assertion,
one narrow repository-owned Stylelint rule,
or deliberate manual review is needed for exact zero-channel notation.

The eight triggered names do not establish replacement parity.
Every enabled rule needs an explicit port,
drop,
or temporary-retention decision before Stylelint can be retired deliberately.

### Live Stylelint configuration defect

`package/config/stylelint/index.mjs` intends
`media-feature-name-unit-allowed-list` to require `rem` for every media-feature name.
Its plain string key `'/[\w-]+/'` reaches Stylelint as `/[w-]+/` because JavaScript consumes the backslash.
The adjacent comment correctly says `String.raw` is necessary,
and neighboring patterns already use it.

A runtime probe through `mise run //:lint:stylelint -- --no-cache` accepted `height: 10em` and rejected
`width: 10em`.
`width` happens to contain `w`;
`height` does not.
This is a downstream config defect,
not Stylelint behavior.
Any parity suite must reject `height: 10em` and `width: 10em` and accept `height: 10rem`.

## Verified repository-owned tooling feasibility

`package/module/css-edit/` is a strict,
immutable,
byte-preserving CSS CST based on `@csstools/css-tokenizer`.
It follows the same repository edit-family precedent as `package/module/jsonc-edit/` and
`package/module/toml-edit/`.

Disposable probes established:

- the compact nested learning stylesheet parses;
- nested media rules and declarations remain distinct nodes;
- tokens retain source offsets;
- serialization is byte-identical;
- every one of the 14 active CSS regions parses and round-trips byte-identically.

The existing `@lezer/html` dependency exposes embedded style content as `StyleText` nodes with host offsets.
An adversarial probe found the real style region and ignored false `<style>` text in a comment and quoted
attribute.
This supports host-position diagnostics without serializing surrounding HTML.

Measured implementation surfaces:

- `module-css-edit` has ten production TypeScript files and 1,728 source lines;
- installed Stylelint production `lib/` has 357 JavaScript modules and 34,348 source lines;
- Stylelint 17.14.1 declares 35 direct runtime dependencies.

These are auditability measurements,
not evidence of semantic parity or proof that custom ownership is preferable.

A promising narrow custom seam is:

```ts
checkSources({ paths }): CheckReport;
fixSources({ paths }): FixReport;
```

Required invariants:

- check mode never writes;
- surrounding HTML is never reserialized;
- a CSS-only checker leaves surrounding HTML untouched;
- any markup formatter avoids breaks inside tight grammatical units;
- CSS fixes may change layout but keep the result around ten lines;
- diagnostics for embedded CSS use host HTML positions;
- fixes replace only narrowly approved token ranges;
- every fix is idempotent;
- semantic policy is separate from layout policy;
- package-specific line-budget and allowed-presentation checks stay outside generic CSS rules.

This is one candidate architecture,
not an accepted decision.
A full dprint replacement is not justified by issue 401 alone.
At one measured revision,
dprint resolved 775 paths across JSON,
TOML,
YAML,
CSS,
HTML,
XML,
and SVG,
with 724 paths in unrelated data or XML-family domains.

## Comprehensive solution space to finish

Do not collapse the investigation into a binary keep-or-replace question.
Evaluate each family at every relevant layer.

### Vertical layers

- **Symptom layer:**
  Leave source unchanged.
  Use scoped ignores.
  Or change individual conflicting rule values.
- **File layer:**
  Use near-ten-line and allowed-rule fixtures.
  Use formatter-ignore directives.
  Use file-specific lint profiles.
  Or use source-preserving region edits.
- **Package layer:**
  Declare the learning pages an authored-document boundary.
  Add package-owned check tasks.
  Generate shared style fragments.
  Or use package-local configuration.
- **Repository layer:**
  Use root path exclusions.
  Split check orchestration.
  Share semantic policy.
  Coordinate CI and editor behavior.
- **Architecture layer:**
  Use generic external tools.
  Own narrow repository rules.
  Generate sources.
  Or replace whole tools.

### Horizontal families

- Preserve the current source contract and exempt only these files from formatting.
- Revise the package contract to accept the common dprint and Stylelint fixed point.
- Keep dprint and Stylelint,
  but re-point only conflicting Stylelint rules for this path.
- Keep dprint markup formatting while protecting embedded CSS with supported Malva directives.
- Split markup and CSS ownership through orchestration or extracted regions.
- Replace formatter convergence with package-local line-budget and allowed-presentation checks.
- Make one stylesheet authoritative and generate or inject copies without turning prose into generated HTML.
- Move the style to a shared external CSS asset if offline and file-URL behavior remains correct.
- Use a package-local checker that validates the approximate line budget and semantic style constraints.
- Build a repository-owned semantic CSS checker over `css-edit`,
  initially in shadow mode.
- Build only the missing narrow lint rules while retaining Stylelint for generic syntax coverage.
- Retain dprint for unrelated formats while retiring only Malva,
  Stylelint,
  or both from the affected seam.
- Replace Stylelint or dprint entirely only if broader repository evidence justifies that ownership.
- Propose an upstream feature only if a pinned-source audit and tracker search establish an upstream-supported gap.
- Accept the current inconsistency temporarily if its operational cost is lower than all migrations.

For every serious option,
record evidence,
coverage retained and lost,
source fidelity,
maintenance owner,
editor and CI behavior,
migration reversibility,
and failure modes.
Give pros,
cons,
and a fully sorted ranking with reasons between adjacent entries.

## Current recommendation status

The previously posted recommendation is withdrawn.
Neither the all-five nor selective dprint exclusion is acceptable because both weaken trust in the repository's
active formatter.
The former first and second options are now disqualified rather than merely re-ranked.

The explicit CSS budget is five to twenty nonblank lines.
The seven-line Malva result remains valid,
and the previously described twenty-line fixed point is also within budget.
Line count no longer distinguishes those outputs.

Stylelint retention is no longer the default.
Do not run an external technology-selection comparison.
The current direction is a repository-owned CSS tool whose formatting and linting responsibilities must be made
explicit against Malva and all eighty-two active Stylelint rules.
No revised recommendation is ready until non-exclusion dprint solutions and the repository-owned design are
validated.
No source or configuration implementation has been made.

## GitHub updates already posted

- Initial evidence checkpoint:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139282431>
- Source-preserving in-house feasibility checkpoint:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139335872>
- Stylelint regex-string enforcement defect:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139346649>
- Package-local CSS contract correction:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139391488>
- Reopened current-tool configuration paths:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139475030>
- Superseded synthesis and rankings:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139562950>
- Correction withdrawing formatter exclusions and reopening Stylelint replacement:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139615382>
- Direction correction toward repository-owned CSS tooling:
  <https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5139620214>

The original issue comment is:
<https://github.com/Aquaticat/Monochromatic/issues/401#issuecomment-5124915718>

Post the next issue update only after the comprehensive option space has new verified evidence.
Do not repeatedly restate old checkpoints.

## Scratch artifacts

Prepared upstream clones:

- `/var/home/user/temp/agent/dprint-401-2026-07-30`
- `/var/home/user/temp/agent/markup-fmt-401-2026-07-30`
- `/var/home/user/temp/agent/malva-401-2026-07-30`
- `/var/home/user/temp/agent/stylelint-401-2026-07-30`
- `/var/home/user/temp/agent/stylelint-standard-401-2026-07-30`

Disposable probe sources include:

- `/var/home/user/temp/agent/issue401-css-edit-probe.ts`
- `/var/home/user/temp/agent/issue401-css-edit-corpus-probe.ts`
- `/var/home/user/temp/agent/issue401-lezer-html-probe.ts`
- `/var/home/user/temp/agent/issue401-lezer-html-cases.ts`
- `/var/home/user/temp/agent/issue401-style-region-hashes.ts`
- `/var/home/user/temp/agent/issue401-media-unit-probe.css`

A disposable worktree was created at:
`/var/home/user/temp/agent/issue401-worktree.LykdMVxQ`.

## Documentation checkpoint

Commit `8d2bc2f2a9f4d85d22ed007c25d4bcf6d7c6efd3` records:

- `doc/planning/learning-rust-formatting-boundary.md`;
- `doc/troubleshooting/dprint.md`;
- this handover.

The planning document contains the corrected package contract,
formatter and linter measurements,
current-tool configuration probes,
repository-owned feasibility,
horizontal and vertical option families,
fully sorted rankings,
and the proposed resolution.

The troubleshooting document records the corrected directive names,
dprint override behavior,
width and strict-whitespace probes,
Stylelint fixed point and semantic gap,
content-meta defect,
workarounds,
and upstream filing decision.

Follow-up commit `56e1ae851` records the first checkpoint update to this handover.
Both commits reached the upstream branch.
The three paths passed the scoped Markdown lint task and `git diff --check` before commit.
Unrelated `package/cli/wg-quicker/` changes remain in the worktree and were not staged.

## Exact next action

1. Post an issue correction withdrawing formatter exclusions and recording the five-to-twenty-line CSS budget.
2. Evaluate dprint configurations that retain all five HTML pages under formatter ownership.
3. Design and validate repository-owned CSS tooling without evaluating external replacement candidates.
4. Correct and re-rank the planning and troubleshooting documents.
5. Post the new evidence and recommendation to issue 401.
6. Leave implementation unstarted until the owner accepts or delegates the revised recommendation.
