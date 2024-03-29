# Roadmap

I planned to get the project in a reasonable state at the end of March.
However, that deadline won't be met.

## Potentially replace Bun with pnpm

Bun is written in Zig and pnpm is written in TypeScript.
Using Bun to execute TypeScript directly is nice, but unnecessary.
However, as of 2024MAR29, Bun is still incompatible with Astro, which results in having to install Node as well,
which invalidates the point of using an all-in-one package manager and runtime.

Also, see `## Bun` section in `readme.md` (will be migrated to another file).

## Replace [Effect](https://effect.website) with rambdax

Effect is just too large, also,
I still don't understand why I'd use its way to write code even after reading all its docs.

## Remove obsolete `vite-plugins`

I wrote the Vite plugin that allows vite to import TOML files,
but then I thought maybe just using the TOML library itself
and read the file at runtime makes the code less likely to break should I have to migrate it to use a different bundler.

## Put `consts.js` in a better place and give it types.

It's no good to put files that are not relevant to the user (in this case, the eventual author of the contents of the blog) in front of the user's face.

## Write `cpfd`

Copy Files From Dependencies

## Write `increase-version`

So every time I publish new changes it's guranteed to have a new version.

## Write `add-scripts`

Add new npm scripts to the target package every time a new package is created.

## Dim side"bar" (.Aside) when hovering over main

## Astro/CSS formatter

[dprint markup_fmt (Astro)](https://github.com/g-plane/markup_fmt)

[dprint malva (CSS)](https://github.com/g-plane/malva)

