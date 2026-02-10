# CSS tooling: A chronicle of suffering

This document records the accumulated frustrations from attempting to implement a simple feature: custom `@mixin` and `@apply` CSS syntax in a monorepo.

## The original ask

Support this CSS syntax:

```css
@mixin --flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}

.component {
  @apply --flex-center;
}
```

This is not exotic. SCSS has had this for over a decade. PostCSS plugins exist. Tailwind popularized `@apply`. This should be trivial.

It was not trivial.

---

## LightningCSS

### The promise

"Lightning fast CSS transformation! Written in Rust! Handles everything!"

### The reality

**Issue 1: `customAtRules` is broken with `var()` functions**

LightningCSS has a `customAtRules` option that supposedly lets you define custom at-rules. The documentation shows beautiful examples.

What the documentation does not mention: if your CSS contains `var()` anywhere, the parser chokes. [GitHub issue #1081](https://github.com/parcel-bundler/lightningcss/issues/1081) has been open. The workaround? Don't use CSS custom properties with custom at-rules. In 2026. When CSS custom properties are foundational to any modern design system.

**Issue 2: No node_modules resolution**

LightningCSS's `bundle()` function handles `@import`. Great! Except it only does relative path resolution. It does not look in `node_modules`. It does not understand package.json exports. It does not care about your monorepo.

```css
@import '@monochromatic-dev/style-monochromatic/index.css';
```

This import, which works everywhere else in the JavaScript ecosystem, becomes:

```
Resolved: @monochromatic-dev/style-monochromatic/index.css 
  -> /src/styles/@monochromatic-dev/style-monochromatic/index.css
```

Yes. It literally concatenates the package name as a path.

The solution? Write a custom resolver. Using what? oxc-resolver, of course. Which leads us to...

---

## oxc-resolver

### The promise

"Production-ready module resolver! Used by Rolldown! Fast!"

### The reality

The package exists. `pnpm list` shows it installed. `pnpm why oxc-resolver` confirms it's a dependency.

```
@monochromatic-dev/build-css@0.0.1
dependencies:
  oxc-resolver 11.16.4
```

And yet:

```
Error: Cannot find package 'oxc-resolver'
```

This has happened across multiple sessions. The package is in the lockfile. The package is in `pnpm list`. The package is NOT in `node_modules`. 

Why? Because pnpm with `hoist: false` and `nodeLinker: isolated` and `enableGlobalVirtualStore: true` apparently decides that some packages just don't deserve symlinks.

I have:
- Deleted `node_modules`
- Run `pnpm install`
- Run `pnpm install --force`
- Checked that the package exists in the global store
- Verified the dependency is correctly specified

Nothing helps. The symlink simply does not get created.

---

## pnpm

### The promise

"Fast, disk space efficient package manager! Strict dependency resolution!"

### The reality

The configuration matrix is a minefield:

- `hoist: false` - Don't hoist dependencies (good for strictness)
- `nodeLinker: isolated` - Use isolated node_modules (good for correctness)  
- `enableGlobalVirtualStore: true` - Use global store (good for disk space)
- `hoistWorkspacePackages: false` - Don't hoist workspace packages

Combine all of these and you get a package manager that:

1. Correctly resolves dependencies (according to `pnpm list`)
2. Fails to create the symlinks needed to actually use them
3. Provides no error messages about why
4. Works fine for 90% of packages, fails mysteriously for others

The debugging experience:

```
$ pnpm list --filter @monochromatic-dev/build-css
dependencies:
  oxc-resolver 11.16.4  ← Looks installed!

$ ls packages/build/css/node_modules/
lightningcss/
postcss/
                        ← Where is oxc-resolver???
```

---

## Bun (as a runtime)

### The promise

"Drop-in Node.js replacement! Just works!"

### The reality

Bun does not understand pnpm's symlink structure with isolated node_modules.

```
bun packages/build/css/src/index.ts
Error: Cannot find package 'oxc-resolver'
```

Node.js with `--experimental-transform-types`:

```
Error: Cannot find package 'oxc-resolver'
```

At least they're consistent in their failure.

---

## PostCSS (within Vite)

### The promise

"The industry standard CSS processor! Plugin ecosystem!"

### The reality

PostCSS works fine. In isolation. The moment you put it in Vite's CSS pipeline with Astro, chaos ensues.

**Attempt 1: PostCSS plugin in vite config**

Created a PostCSS plugin that handles `@mixin` and `@apply`. Tested it standalone - works perfectly.

Put it in Vite's `css.postcss.plugins` - works for most files.

Except Astro generates some CSS files through a separate SSR/client build pipeline that completely bypasses the PostCSS configuration. The result: 90% of your CSS is transformed, 10% still has raw `@apply` rules in production.

**Attempt 2: Preload mixins globally**

Added a mechanism to preload all mixin definitions before PostCSS runs. Still doesn't help because Astro's internal CSS generation doesn't go through your configured pipeline.

**Attempt 3: postcss-import plugin**

The official `postcss-import` plugin exists. It doesn't understand monorepo package imports. Back to square one.

---

## Vite

### The promise

"Next generation frontend tooling!"

### The reality

Vite's CSS pipeline is a black box with multiple entry points:

1. CSS imported from JS/TS → goes through your pipeline
2. CSS in `<style>` tags in Astro/Vue/Svelte → maybe goes through your pipeline
3. CSS generated by framework SSR → who knows

The `css.transformer` option lets you choose between:
- `postcss` (default) - uses PostCSS
- `lightningcss` - uses LightningCSS

You cannot use both. You cannot say "use LightningCSS for minification but PostCSS for transforms". It's one or the other.

The `transform` hook exists for custom transforms, but by the time CSS reaches it, Astro has already processed and potentially bundled things in ways that break your assumptions.

---

## Astro

### The promise

"The web framework for content-driven websites!"

### The reality

Astro's CSS handling is aggressive:

1. It extracts `<style>` blocks from components
2. It scopes them (unless you use `is:global`)
3. It bundles them into separate chunks
4. It may or may not run them through your configured CSS pipeline
5. The exact behavior depends on whether it's SSR, SSG, or hybrid mode

The result: you configure PostCSS in Vite, test it, it works, you build, and one random component's CSS still has unprocessed `@apply` rules.

Debugging this requires understanding:
- Vite's CSS pipeline
- Astro's build system
- How Astro's CSS extraction interacts with Vite
- Which files go through which pipeline
- The phase of the moon

---

## The cascade of failures

Here's what happens when you try to implement `@mixin/@apply`:

1. **Try LightningCSS `customAtRules`** → Fails because of `var()` bug
2. **Try PostCSS plugin in Vite** → Partially works, some files bypass it
3. **Try standalone CSS pre-build** → Need to resolve imports
4. **Try LightningCSS `bundle()` for imports** → No node_modules resolution
5. **Add oxc-resolver for resolution** → Package doesn't get linked by pnpm
6. **Try running with Bun** → Bun doesn't understand pnpm's node_modules
7. **Try running with Node** → Same error
8. **Consider crying** → Ongoing

---

## What should work

In a sane world:

```ts
import { bundle } from 'lightningcss';
import { processMixins } from './mixin-processor';

const { code } = bundle({ filename: 'main.css' });
const result = processMixins(code);
```

That's it. Two steps:
1. Bundle CSS (resolve imports)
2. Process mixins

Instead we have a Rube Goldberg machine of:
- Custom resolvers that wrap other resolvers
- Build scripts that run before other build scripts
- Package manager configurations that fight against their own features
- Framework CSS pipelines that have undocumented escape hatches

---

## Potential escapes

### Option A: Bun as package manager

Bun has its own package manager. It might not have pnpm's symlink issues. Worth trying.

### Option B: Different static site generator

NueJS claims to be simpler. Maybe its CSS handling is more predictable.

### Option C: Give up on `@mixin/@apply`

Just write the expanded CSS everywhere. Repeat yourself. Abandon DRY. Embrace copy-paste.

### Option D: SCSS

SCSS has worked for a decade. The tooling is mature. The ecosystem understands it. But it feels like admitting defeat to a problem that shouldn't exist.

### Option E: Wait for native CSS mixins

The W3C CSS Working Group has a [CSS Functions and Mixins Module](https://drafts.csswg.org/css-mixins-1/) in development.

Current status (January 2026):
- `@function` (single value returns): Supported in browsers
- `@mixin` / `@apply` (style blocks): **Not supported in any browser**
- Spec status: First Public Working Draft (May 2025)
- Expected timeline: "further refinement in the coming years"

Translation: Check back in 2028-2030. Maybe.

---

## Lessons

1. **Every abstraction has leaky edges** - LightningCSS is fast until you need custom at-rules with CSS variables
2. **Package managers are not interchangeable** - pnpm's strictness creates real-world problems that npm/yarn don't have
3. **Frameworks own their pipelines** - Astro's CSS handling is Astro's business, not yours
4. **"Just works" never does** - Every tool that promises simplicity hides complexity
5. **The JavaScript ecosystem is held together by duct tape** - Native ESM, TypeScript, bundlers, package managers, frameworks - they all make assumptions that conflict with each other

---

## Current state

As of 2026-02-09:
- CSS build script exists at `packages/build/css/`
- It uses LightningCSS for bundling + oxc-resolver for import resolution + PostCSS for mixin processing
- The build pipeline works: bundling, mixin collection, nested mixin expansion, and `@apply` inlining all pass integration tests
- oxc-resolver is functioning correctly after the migration from pnpm to Bun's package manager

### Import resolution testing

The integration tests now exercise two distinct CSS import resolution strategies:

1. **`exports` field resolution** (`test-css-importing` + `test-css-imported`)
   - Imports like `@import '@monochromatic-dev/test-css-imported/index.css'`
   - Resolved via the `exports` mappings in the imported package's `package.json`
   - This is the modern, encapsulated approach where the package controls its public surface

2. **Direct file path resolution** (`test-css-importing-filepath` + `test-css-imported-no-exports`)
   - Imports like `@import '@monochromatic-dev/test-css-imported-no-exports/src/index.css'`
   - Resolved by reaching directly into the package's file tree
   - Requires the imported package to **not** have an `exports` field, because `exports` blocks deep imports by design (Node.js resolution semantics, enforced by oxc-resolver)

The key discovery: when a package has an `exports` field, oxc-resolver correctly refuses to resolve paths not listed in the exports map.
A package specifier like `pkg/src/index.css` fails with `"./src/index.css" is not exported` when the package only exports `./index.css`.
This is correct behavior, but it means testing both strategies requires two separate imported fixture packages -- one with `exports` and one without.
