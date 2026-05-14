# tsdown documentation inconsistency: default dependency bundling behavior

**tsdown version:** 0.9+ (current as of 2026-04-04)
**Severity:** documentation contradiction (misleads users about default behavior)
**Upstream:** [rolldown/tsdown](https://github.com/rolldown/tsdown)
**Commit tested:** [`9471001`](https://github.com/rolldown/tsdown/commit/9471001)

## Summary

Three pages on [tsdown.dev](https://tsdown.dev) describe incompatible default behaviors
for how tsdown handles `dependencies`, `peerDependencies`, and `optionalDependencies`.
Two pages are correct; the FAQ is wrong.

## The contradiction

### FAQ page ([tsdown.dev/guide/faq](https://tsdown.dev/guide/faq))

Source: `docs/guide/faq.md:52`

> "By default, tsdown bundles all imported modules.
> To exclude dependencies (e.g., those listed in `package.json`), use the `deps` configuration"

This claims the default is **bundle everything**, and the user must opt in to externalization.

### Dependencies page ([tsdown.dev/options/dependencies](https://tsdown.dev/options/dependencies))

Source: `docs/options/dependencies.md:9`

> "By default, `tsdown` **does not bundle dependencies** listed in your `package.json`
> under `dependencies`, `peerDependencies`, and `optionalDependencies`"

This claims the default is **externalize production dependencies** automatically.

### How It Works page ([tsdown.dev/guide/how-it-works](https://tsdown.dev/guide/how-it-works))

Source: `docs/guide/how-it-works.md:30`

> "`dependencies`, `peerDependencies`, and `optionalDependencies` are **externalized** --
> they appear as `import` / `require` statements in the output and are not included in the bundle."

Consistent with the Dependencies page. Production deps are external by default.

## Source code trace proving auto-externalization

The Dependencies and How It Works pages are correct.
The following trace through the source code shows exactly how tsdown
auto-externalizes production dependencies without any user configuration.

### Step 1: `package.json` is read at config resolution time

`src/config/options.ts:96`: `resolveOptions()` reads `package.json` from the working directory:

```typescript
const pkg = await readPackageJson(cwd,);
```

`src/utils/package.ts:13-24`: `readPackageJson()` uses `empathic/package` to locate
the nearest `package.json` and parses it:

```typescript
export async function readPackageJson(
  dir: string,
): Promise<PackageJsonWithPath | undefined> {
  const packageJsonPath = findPackage({ cwd: dir, },);
  if (!packageJsonPath)
    return;
  const contents = await readFile(packageJsonPath, 'utf8',);
  return { ...JSON.parse(contents,), packageJsonPath, };
}
```

### Step 2: `pkg` is passed into the resolved config

`src/config/options.ts:299`: the parsed `PackageJson` object is stored on the resolved config:

```typescript
const config: ResolvedConfig = {
  // ...
  pkg,
  // ...
};
```

### Step 3: `DepsPlugin` is registered whenever `pkg` exists

`src/features/rolldown.ts:115-117`: the plugin is added if there is a `package.json`
**or** if `skipNodeModulesBundle` is set.
Since any real project has a `package.json`, this plugin is effectively always active:

```typescript
if (config.pkg || config.deps.skipNodeModulesBundle)
  plugins.push(DepsPlugin(config, bundle,),);
```

### Step 4: `getProductionDeps` collects all production dependency names

`src/features/deps.ts:415-421`: on plugin creation, production deps are extracted
from `package.json`:

```typescript
/*
 * Production deps should be excluded from the bundle
 */
function getProductionDeps(pkg: PackageJson,): Set<string> {
  return new Set([
    ...Object.keys(pkg.dependencies || {},),
    ...Object.keys(pkg.peerDependencies || {},),
    ...Object.keys(pkg.optionalDependencies || {},),
  ],);
}
```

This is called at `src/features/deps.ts:169`:

```typescript
const deps = pkg && Array.from(getProductionDeps(pkg,),);
```

### Step 5: every non-entry import is checked against the production deps list

`src/features/deps.ts:296-331`: `externalStrategy()` runs for every resolved import.
If the import ID matches a production dependency name (or starts with `<dep>/`),
it returns `true` (external):

```typescript
async function externalStrategy(
  id: string,
  importer: string | undefined,
  resolved: ResolvedId | null,
): Promise<boolean | [true, string,] | 'absolute' | 'no-external'> {
  if (id === shimFile)
    return false;

  if (alwaysBundle?.(id, importer,))
    return 'no-external';

  // ...skipNodeModulesBundle check...

  if (deps) {
    if (deps.includes(id,) || deps.some(dep => id.startsWith(`${dep}/`,))) {
      const resolvedDep = await resolveDepSubpath(id, resolved,);
      return resolvedDep ? [true, resolvedDep,] : true;
    }

    // ...@types fallback for DTS...
  }

  return false;
}
```

The `resolveId` hook at `src/features/deps.ts:173-208` calls `externalStrategy()`
and marks the module as external when it returns `true`:

```typescript
let shouldExternal = await externalStrategy(id, importer, resolved,);
// ...
if (shouldExternal === true || shouldExternal === 'absolute') {
  return {
    id,
    external: shouldExternal,
    moduleSideEffects,
  };
}
```

### Step 6: bundled `node_modules` deps trigger a warning by default

`src/features/deps.ts:275-284`: when `onlyBundle` is not configured (the default),
the `generateBundle` hook scans output chunks for bundled `node_modules` deps
and emits a hint:

```typescript
} else if (onlyBundle == null && deps.size) {
  logger.info(
    nameLabel,
    `Hint: consider adding deps.onlyBundle option to avoid unintended bundling of dependencies...`
  )
}
```

A tool that bundles everything by default would not warn about bundling.

### Summary of the trace

The call chain is:

1. `resolveOptions()` reads `package.json` -> `pkg`
2. `pkg` is stored on `ResolvedConfig`
3. `DepsPlugin(config, bundle)` is registered (always, when `pkg` exists)
4. `getProductionDeps(pkg)` extracts `dependencies` + `peerDependencies` + `optionalDependencies`
5. `externalStrategy()` marks any import matching a production dep as external
6. Anything from `node_modules` that slips through triggers a warning

No user configuration is required. The FAQ's claim that "tsdown bundles all imported modules"
by default is provably false.

## The FAQ's likely origin

The FAQ entry describes the behavior of a raw bundler (Rolldown, Rollup, webpack)
with zero configuration: everything imported gets bundled unless explicitly marked external.
tsdown's `DepsPlugin` overrides this raw default by reading `package.json`
and auto-externalizing production deps.
The FAQ appears to describe the underlying bundler's behavior
rather than tsdown's actual smart-default behavior.

The FAQ also recommends `deps.skipNodeModulesBundle` as the fix,
which is a **stricter** option that externalizes all `node_modules` imports
regardless of whether they are in `package.json`.
The actual default behavior already externalizes production deps;
`skipNodeModulesBundle` goes further by also externalizing `devDependencies`
that would otherwise be bundled.

## Impact

A user reading only the FAQ would:

- Set up `deps` configuration unnecessarily (it is already the default)
- Misunderstand why their production dependencies **are not** in the output
  (expected them to be bundled, per the FAQ)
- Potentially add `deps.alwaysBundle` for packages that should remain external,
  creating duplicate copies in consumer bundles
- Use `skipNodeModulesBundle` thinking it enables externalization,
  when it actually changes the externalization scope from "production deps only"
  to "all `node_modules`"

## Related tsdown configuration

For reference, the actual dependency handling options:

- `deps.alwaysBundle`: force-bundle specific packages even if listed in production deps (equivalent to tsup's `noExternal`)
- `deps.skipNodeModulesBundle`: externalize **all** `node_modules` imports regardless of `package.json` listing
- `deps.onlyBundle`: whitelist specific `node_modules` packages; warn on anything else being bundled

---

## Draft GitHub issue

**Title:** docs(faq): "bundles all imported modules" contradicts Dependencies and How It Works pages

**Labels:** documentation

**Body:**

### Description

The FAQ entry ["Why are my dependencies being bundled?"](https://tsdown.dev/guide/faq#dependencies-bundled) (`docs/guide/faq.md:50-62`) states:

> By default, tsdown bundles all imported modules. To exclude dependencies (e.g., those listed in `package.json`), use the `deps` configuration

This contradicts two other documentation pages:

**Dependencies page** (`docs/options/dependencies.md:9`):

> By default, `tsdown` **does not bundle dependencies** listed in your `package.json` under `dependencies`, `peerDependencies`, and `optionalDependencies`

**How It Works page** (`docs/guide/how-it-works.md:30`):

> `dependencies`, `peerDependencies`, and `optionalDependencies` are **externalized**: they appear as `import` / `require` statements in the output and are not included in the bundle.

### Source code confirms the Dependencies page is correct

`DepsPlugin` (`src/features/deps.ts`) is registered whenever a `package.json` exists (`src/features/rolldown.ts:115-117`). On initialization, `getProductionDeps()` (`src/features/deps.ts:415-421`) collects all names from `dependencies`, `peerDependencies`, and `optionalDependencies`. The `externalStrategy()` function (`src/features/deps.ts:316-319`) then marks any import matching those names as external, no user configuration required.

Additionally, when `deps.onlyBundle` is not set (the default), the `generateBundle` hook (`src/features/deps.ts:275-284`) emits a warning if any `node_modules` dependencies end up bundled. A tool that bundles everything by default would not warn about bundling.

### The FAQ also recommends a stricter-than-necessary fix

The FAQ suggests `deps.skipNodeModulesBundle: true` as the solution, which externalizes **all** `node_modules` imports (including `devDependencies`). The actual default already externalizes production deps. Users following the FAQ would unknowingly switch from "externalize production deps, bundle devDeps" to "externalize everything from node_modules", a meaningful behavioral change.

### Suggested fix

Replace the FAQ entry with text consistent with the Dependencies page:

```markdown
## Why are my dependencies being bundled? {#dependencies-bundled}

By default, tsdown externalizes packages listed in your `package.json`
under `dependencies`, `peerDependencies`, and `optionalDependencies`.
Packages listed only in `devDependencies` are bundled if imported,
since consumers will not install them.

If you are seeing unexpected bundling of `node_modules` dependencies,
check that the package is listed in your production dependencies.
See [Dependencies](../options/dependencies.md) for fine-grained control
over which packages are bundled or externalized.
```
