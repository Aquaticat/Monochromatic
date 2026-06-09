# Stylelint 16.x: HTML parsing fails because `postcss-html` is an undeclared peer dependency

## Symptom

Running stylelint over `.html` files (or any custom-syntax setup that
loads `postcss-html`) fails at startup with:

```text
Error: Cannot resolve custom syntax module "postcss-html". Check that module "postcss-html" is available and spelled correctly.
Caused by: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'postcss-html' imported from C:\Users\user\AppData\Local\pnpm\store\v10\links\stylelint\16.19.1\...\node_modules\stylelint\lib\utils\dynamicImport.cjs
```

Affects pnpm installs in particular because pnpm enforces strict
peer-dependency resolution;
 non-isolated installers may pick up the
package via hoisting and mask the bug.

## Root cause

Stylelint 16.
x dynamically imports `postcss-html` when configured with
`customSyntax: 'postcss-html'`,
 but does not declare it as a dependency
or peer dependency in its own `package.json`.
 The dynamic import goes
through `stylelint/lib/utils/dynamicImport.cjs`;
 resolution starts at
stylelint's own `node_modules`,
 so when pnpm isolates stylelint's
install,
 the lookup fails immediately.

This is a packaging defect,
 not a stylelint runtime bug.
 The dynamic
import itself works once the package is reachable.

## Verified workaround

Patch stylelint's manifest at install time via pnpm's
`packageExtensions` so resolution succeeds without modifying consuming
projects:

```yaml
# pnpm-workspace.yaml
packageExtensions:
  stylelint:
    dependencies:
      'postcss-html': '*'
```

Tradeoff:
 the workaround is pnpm-specific.
 npm and yarn ignore
`packageExtensions`;
 users on those package managers must add
`postcss-html` to their own `dependencies` (or `devDependencies`)
instead.
 Version range `*` accepts any released `postcss-html`;
 if a
future major break diverges from stylelint's expected API,
 narrow the
range to match the upstream version stylelint was tested against at the
time of writing.

## What does not work

- Declaring `postcss-html` only as a `devDependency` at the consuming
  package level:
   pnpm isolation still prevents stylelint's own
  `node_modules` from seeing it.
   The dynamic import resolves relative
  to stylelint,
   not to the consumer.
- Hoisting `postcss-html` via `public-hoist-pattern` in
  `.npmrc`/`pnpm-workspace.yaml`:
   works coincidentally but is fragile;
  any other package that ends up hoisted at the same path can mask or
  conflict with it.

## Why we do not file this upstream

This repo's policy is to report an issue upstream only when all five
constraints hold (see `TROUBLESHOOTING.resharp.md` for the canonical
walkthrough).

1. **Is it really upstream's fault?
   ** Yes.
    A package that imports
   `postcss-html` at runtime must declare it as a dependency or peer
   dependency.
2. **Can upstream fix it?
   ** Yes;
    a single-line addition to stylelint's
   `package.json` resolves the issue.
3. **Are they supporting this use case?
   ** Yes;
    `customSyntax:
   'postcss-html'` is documented in the stylelint README.
4. **Will they likely fix it?
   ** Existing upstream issues already track
   this;
    no need to file a duplicate.
    The fix has been requested
   repeatedly and not landed,
    so the practical state is "use the
   workaround.
   "
5. **Have we prototyped a minimal fix?
   ** Not relevant:
    the upstream
   change is the obvious one-line addition;
    no architectural design is
   needed.

The decision is to maintain the `packageExtensions` workaround and
revisit if stylelint declares `postcss-html` upstream.
