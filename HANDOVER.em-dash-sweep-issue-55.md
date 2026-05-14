# Handover: em-dash sweep (issue #55)

## Status (2026-05-14, mid-sweep)

Issue: [#55](https://github.com/Aquaticat/Monochromatic/issues/55).
Tracks `docs:` sweep of em-dash and en-dash prose violations against the
AGENTS.md punctuation rule.

What's done:

- Unicode em-dash (`—`) in `.md` files: 0 outside intentional content
  (commit `54c17ce0`, 33 files).
- Unicode em-dash (`—`) in `.ts` files: 0 outside intentional content
  (commit `f2b15a56`, 28 files).
- Unicode en-dash (`–`) in `.md` and `.ts` files: 0 outside intentional
  content (same two commits).
- ASCII `--` em-dash substitute in `.md` files: 1627 -> 419 remaining
  (commit `7c13761b`, 104 files). Remaining `--` is CLI args inside code
  blocks / inline backticks / CLI invocations, preserved by heuristic.
- ASCII `--` em-dash substitute in `.ts` files: 1667 -> 1164 remaining
  (commit `369b73e7`, 248 files). Conservative scope: only lines that
  start with `//` or ` *` comment markers, skipping disable directives.
- `AUDIT.em-dash.md` summary updated with post-sweep counts (uncommitted).

What's left:

- ASCII single-dash (`-`) sweep is deferred. False-positive rate is too
  high for a single-pass mechanical sweep (subtraction, negative numbers,
  date ranges, list bullets).
- A `forbidden-strings` rule to prevent regressions. Per user instruction
  during this session, this should be filed as a separate GitHub issue
  rather than completed here.

User instruction in this session: close issue #55 with a caveat noting
the deferred work and file a separate issue for the forbidden-strings
rule.

## Sweep scripts (durable copies in `.out-of-scope/`)

- `.out-of-scope/em-dash-sweep.ts` -- unicode em-dash + en-dash sweep.
  Run with `bun .out-of-scope/em-dash-sweep.ts <repo-root> <type>`
  where `<type>` is `md` or `ts`.
- `.out-of-scope/ascii-dash-sweep.ts` -- ASCII `--` sweep for markdown.
  Tracks fenced code blocks and inline backticks; skips CLI invocations.
- `.out-of-scope/ascii-dash-sweep-ts.ts` -- ASCII `--` sweep for TS.
  Only modifies lines that start with `//` or ` *` comment markers; skips
  `oxlint-disable` / `eslint-disable` / `biome-disable` / `prettier-disable`
  lines because they use ` -- ` as a syntactic rule/reason separator.

The scripts are not part of the package tree and are not built or tested
via mise tasks; they're one-shot tools kept around in case the sweep
needs to be re-run after future content additions.

## Excluded files (intentional content)

The sweep scripts skip these files entirely:

- `AUDIT.em-dash.md` -- the audit itself, contains self-references.
- `PLANNING.forbidden-strings-em-dash.md` -- forbidden-strings investigation.
- `packages/cli/forbidden-strings/README.md` -- forbidden-strings docs.
- `AGENTS.md` -- the rule statement (in backticks).
- `GLM_LIMITATIONS.md` -- documents model violations as examples.
- `TODO.claude-code-words.md` -- intentional dictionary-style definitions.
- `TODO.forbidden-strings.md` -- forbidden-strings infrastructure.
- `packages/module/hyperscript/src/css/index.unit.test.ts` -- en-dash as
  CSS counter-style test data.

## Replacement heuristics (for reference)

Em-dash (` — `) was replaced by:

- `: ` when preceded by code/bold/strikethrough/paren/bracket/brace close
  (definition / elaboration pattern).
- `; ` otherwise (linked-clause / fallback pattern).
- ` ($middle) ` when paired em-dashes bracket a short aside on the same
  line.
- Coordinate-vertex listings `(a,b) — (c,d)` became `(a,b), (c,d)`.

En-dash (`–`) was replaced by:

- ` to ` for numeric ranges (`14–22` -> `14 to 22`) and letter ranges
  (`A–E` -> `A to E`).
- `, ` for any remaining en-dash (paired-aside fallback).

ASCII `--` was replaced by the same code-marker-aware heuristic. CLI
invocations and disable directives were preserved.

## Quality trade-offs

The mechanical sweep accepts some stylistic imperfection in exchange for
scope coverage:

- Inside parentheses, ` — ` sometimes maps to `;` where a comma would
  read better (e.g. `(2026-05-12, ninth handover; visual-fix iteration)`
  reads slightly off vs `(... ninth handover, visual-fix iteration)`).
- Headings like `# Done -- Implementation plan` become `# Done;
  Implementation plan` where `:` would be more idiomatic.
- Paired em-dashes around a phrase ending in a comma can leave a missing
  comma after the closing paren (`solids (spheres for leaf, octahedra
  for non-leaf) round/diamond-silhouetted` -- a follow-up pass could
  insert the missing comma).

These are listed for completeness; none affect content correctness.
Re-run the scripts or hand-edit individual cases if cleanup is needed
later.
