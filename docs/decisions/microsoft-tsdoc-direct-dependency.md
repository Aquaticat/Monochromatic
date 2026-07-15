# @microsoft/tsdoc direct dependency bar

## Status

Removed as a direct dependency as of 2026-06-04.

Do not add `@microsoft/tsdoc` back to any workspace package without updating this decision and redoing the
replacement survey.

## Context

`@microsoft/tsdoc` previously supported the custom oxlint TSDoc plugin:

- `packages/oxlint-plugins/tsdoc/src/tsdoc-comments.ts` imports `TSDocParser`,
  `TSDocConfiguration`,
   parser result types,
   and message types.
- `packages/oxlint-plugins/tsdoc/src/rule/tag-names.ts` imports `StandardTags`.
- `packages/oxlint-plugins/tsdoc/src/rule/param-validation.ts` and
  `packages/oxlint-plugins/tsdoc/src/rule/returns-description.ts` import `PlainTextEmitter`.
- `packages/config/oxlint/src/rule/tsdoc.ts` enables `tsdoc/valid-types`,
   which surfaces parser
  diagnostics from `@microsoft/tsdoc`.

The dependency is dev-tooling only,
 but direct dependencies still need to satisfy the repo's bar for
install weight,
 maintenance responsiveness,
 public API fit,
 and replacement cost.

## Evidence

### Package weight and artifact quality

Measured with `npm view @microsoft/tsdoc@0.16.0` and `npm pack @microsoft/tsdoc@0.16.0`:

- `dist.unpackedSize`:
   2,304,578 bytes.
- Published file count:
   362 files.
- Runtime dependencies:
   zero.
- The package ships both `lib/` and `lib-commonjs/`.
- The package has no `exports` field,
   only `main`,
   `module`,
   and `typings`.
- `.js.map` files alone account for 1,282,783 bytes,
   55.7 percent of the unpacked package.
- Removing all source maps from the unpacked package leaves 961,318 bytes.

The package is not large because of transitive dependencies.
 It is large because the published
artifact includes dual unminified builds plus inline-source source maps.

### Source scope

Measured against non-test source under `tsdoc/src`:

- 59 TypeScript files.
- 405,657 source bytes.
- 12,108 lines,
   with 7,536 code lines and 3,001 comment lines.
- `src/parser/NodeParser.ts` is 92,787 bytes and 2,659 lines.
- `src/beta/DeclarationReference.ts` is 43,467 bytes and 1,514 lines.

This is a full syntax-preserving parser,
 AST model,
 diagnostics catalog,
 emitter support,
 and beta
declaration-reference parser.
 That is broader than this repo's current need for tag names,
 param and
return blocks,
 empty-description checks,
 and malformed inline-tag diagnostics.

### Maintenance responsiveness

Measured with `gh issue list`,
 `gh issue view`,
 `gh api repos/microsoft/tsdoc/issues/<n>/events`,
and `gh pr list` on 2026-06-04:

- Open issues:
   139.
- Open issues with any comments:
   102.
- Open issues with maintainer,
   member,
   or collaborator comments:
   72.
- Open issues created since 2025-06-04:
   5.
- Recent open issues with maintainer,
   member,
   or collaborator comments:
   0 of 5.
- Recent closed issues since 2025-06-04:
   4.
- Recent closed issues with maintainer comments:
   1 of 4.
- Recent closed issues closed by a maintainer without a public comment:
   2 of 4.

Recent PR activity shows the project is not abandoned:
 maintainers merged publishing,
 dependency,
CODEOWNERS,
 and ESLint compatibility PRs in 2025 to 2026.
 The issue tracker still shows weak recent
public support.
 Treat the package as active releases with weak public issue responsiveness,
 not as a
responsive direct-dependency candidate.

### Replacement survey

Measured install totals in throwaway packages:

- `comment-parser@1.4.7`:
   399,505 bytes total install,
   maintained,
   zero runtime deps.
  It is smaller,
   but it has JSDoc semantics.
   A smoke test parsed
  `@returns arithmetic mean` as name `arithmetic` and description `mean`,
   so it needs a custom
  TSDoc adapter before it can replace the current parser.
- `@es-joy/jsdoccomment@0.87.0`:
   2,934,149 bytes total install.
  It is not smaller than `@microsoft/tsdoc` once dependencies are included.
- `doctrine@3.0.0`:
   157,762 bytes total install,
   but `eslint/doctrine` is archived.
- `eslint-plugin-tsdoc@0.5.2`:
   39,626,976 bytes total install and still depends on
  `@microsoft/tsdoc`.
- `@esm-jsdoc/parser@0.1.2`:
   4,875,340 bytes total install and parses whole files with Babel,
  which does not fit the oxlint plugin's comment-node integration.

No surveyed package is a direct replacement for authoritative TSDoc parser diagnostics.
That does not rehabilitate `@microsoft/tsdoc` as a good direct dependency;
 it means replacing it
requires either dropping parser-backed diagnostics or owning a narrow adapter.

## Decision

`@microsoft/tsdoc` does not meet the repo's bar for new direct dependencies.

Reasons:

- The installed artifact is overweight for this repo's current use.
- The source and API surface are much broader than the current rule set needs.
- Recent public issue responsiveness is weak,
   even though releases and PRs continue.
- The best small alternative,
   `comment-parser`,
   requires custom TSDoc semantics before it is safe.

## Policy

- Do not add `@microsoft/tsdoc` as a new `dependencies`,
   `devDependencies`,
  `optionalDependencies`,
   or `peerDependencies` entry in any workspace package.
- Do not deep-import `@microsoft/tsdoc/lib/**`,
   `@microsoft/tsdoc/lib-commonjs/**`,
   or
  `@microsoft/tsdoc/beta/**` from repo code.
- If another package needs parser-backed TSDoc behavior,
   depend on the workspace oxlint plugin or a
  new local adapter package,
   not on `@microsoft/tsdoc` directly.

## Reconsideration criteria

A future exception requires all of these conditions:

- Parser-backed TSDoc diagnostics become required again after local diagnostics prove insufficient.
- A local `comment-parser` adapter cannot cover the repo's required TSDoc semantics with fixture tests
  for malformed inline tags,
   `@link`,
   `@param`,
   `@returns`,
   fenced code,
   inline code,
   and escaped
  at signs.
- Upstream materially improves direct-dependency fitness:
   source maps stop shipping in the npm
  artifact,
   the package adds an `exports` map with narrow subpaths,
   and recent issue responsiveness
  shows maintainer comments or actions on user-filed issues.
