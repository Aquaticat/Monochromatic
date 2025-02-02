## Project Setup (Meta)

(Not necessary right now, no shell scripts are required right now) `find . -name '*.sh' -exec chmod +x {} \;`

Ensure your `$TERMINAL` environment variable points to a graphical terminal application.
// TODO: Add reason.

`yarn set version stable && yarn install && yarn dlx @yarnpkg/sdks vscode`

## Themes

Currently we have `themes/subtle`.

## ~~NueJS (Outdated - switched to Astro instead)~~

### NueJS doesn't allow specifying LightningCSS configuration yet.

Therefore, I had to manually modify the source code of the installed NueJS package.

```
bun i -g nuekit
```

then modify `~/.bun/install/global/node_modules/nuekit/src/builder.js`

so that around line 1 is changed to:

```js
import apply from '../../../../../lightningcss-plugins/apply/index.js';
import customUnits from '../../../../../lightningcss-plugins/custom-units/index.js';
import propertyLookup from '../../../../../lightningcss-plugins/property-lookup/index.js';
import size from '../../../../../lightningcss-plugins/size/index.js';
```

and around line 135 is changed to:

```js
  return mod.transform({
    code: Buffer.from(css),
    drafts: {customMedia: true},
    targets: {safari: (17 << 16) | (3 << 8), chrome: (122 << 16), firefox: (115 << 16) | (7 << 8), android: (122 << 16), ios_saf: (16<< 16) | (7 << 8)},
    cssModules: {pattern: '[local]'},
    include,
    minify,
    visitor: mod.composeVisitors([apply, customUnits, propertyLookup, size]),
  }).code?.toString()
```

from original line 135's:

```js
  return mod.transform({code:Buffer.from(css), include, minify}).code?.toString()
```

A backup of this modified file is at `bak/nuekit/src/builder.js`.

### NueJS fails to build with `@nue/glow.css` not found when `inline_css` is true.

Therefore, I had to reduce the number of CSS files from the beginning.

For example, merging two files into one by separating them with:

```css
/**************************************************/
```

### ~~NueJS serve fails to watch VMware shared folder. (outdated)~~

Probably because VMware shared folder doesn't work with `inotify`.

Therefore, I had to:

1. Install `chokidar-cli` and `http-server`

    ```sh
    bun i -g chokidar-cli

    bun i -D http-server
    # Because Nue's server keeps complaining Error in posts/*.md, on <html> component
    # Edit: Okay found it. Need to add content_collection to front matter, which isn't necessary in my opinion.
    # I'm keep using http-server to hopefully save me from some future headaches.
    ```

2.  Watch the project directory for any changes to trigger a build.
    Note the folder `.dist` needs to be excluded or else there'll be an infinite loop.

    Project directory: for example, switch to `themes/subtle` in your terminal first.

    ```sh
    bun run chokidar "**/*.*" -i ".dist/**/*.*" -c "bun run node_modules/nuekit/src/cli.js build" -p --initial
    ```

3.  Watch the build directory for any changes to trigger a server restart, in another terminal:

    ```sh
    bun run chokidar ".dist/dev/**/*.*" -i ".dist/dev/**/*.html" -c "lsof -t -i:8080 | xargs -r kill && bun run node_modules/http-server/bin/http-server .dist/dev -c-1" -p --initial
    ```

    `*.html` is ignored because chokidar frequently false reports it as changed just because Chromium reloaded the page.

4.  Setup auto-reload in browser.
    I wrote a Violentmonkey userscript to do this:

    ```js
    setTimeout(() => {
      if (!navigator.userActivation.hasBeenActive) {
        location.reload()
      }
    }, 5000)
    ```

    which means, if no user interaction is detected within the first 5 seconds of page load, the page will auto reload.

Update: I switched to Linux as my main dev system and above workaround is unnecessary now.

## Bun

### `bun i` `error: workspace dependency not found`

`rm bun.lockb && bun i`

See https://github.com/oven-sh/bun/issues/5413

### `bun i` only creates `node_modules` on root of workspace. (Updated)

See https://github.com/oven-sh/bun/issues/4628

Tried switching to other `bun i` backends, no luck.

#### Solution: Manually copy `node_modules` from root to each packages.

```sh
rsync -rRL --exclude='*/**/node_modules/*' node_modules/ configs/biome-config/
```

~~(Outdated) Um, just ignore those "File name too long" errors.
Adding the xtype filter to find causes all those files in links to be not found by find, because find doesn't resolve contents in directories that are links.~~

#### Update: used rsync instead.

**You can use this command:** `bun i && ./cpNM.sh`

TODO: I should write a better script for this.
Currently, the script needs to be manually updated each time I change a package's location.
Currently, the script copies everything w/o considering the actual dependencies of each package.

#### Update: turns out this is how workspace is supposed to work in bun?

See https://github.com/oven-sh/bun/issues/5688#issuecomment-1726826345

Still, some dependencies require themselves to be found in the package's node_modules folder.
For example, to extend a tsconfig.
Therefore, the above script isn't useless, just needs some more exclusions.

TODO: Add some more exclusions to the above script.

### Why are we not using some Bun specific features as of now?

Astro, for example, doesn't work well with Bun, which means some packages written using `Bun` apis cannot run when imported into Astro.

## Misc

### Explanation of the seemingly overly complex shebang line `#!/usr/bin/env sh`

On my system, `sh` is not found at `/bin/sh`.

For portability, https://stackoverflow.com/a/10383546

### VSCode error `Extension 'Biome' is configured as formater but it cannot format 'TypeScript' files`

Because when we copied `node_modules` from root to each packages, we didn't let it ignore biome.

And biome needs to find a biome.json, which we don't have when called from subpackages.

`cpNM.sh` Script now fixed.

You can also run `rm -rf */*/**/@biomejs/`.

## Useful snippets

### To convert a folder of `.md` to `.txt`

`find posts -iname "*.md" -type f -exec sh -c 'pandoc "${0}" -o "${0%.md}.txt"' {} \;`

Stolen from https://stackoverflow.com/a/26304106

### To remove markdown title from one such txt file

`rg -P -U --passthru -N '#(?:.|\n)+?(?=\n\n)' -r '' posts/why-this-theme.txt`

### To replace all newlines with spaces

`rg -U --passthru -N '\n' -r '' posts/why-this-theme.txt`

### esbuild

For `eventualConsumer`s:

`esbuild src/bin.ts --bundle --platform=node --charset=utf8 --format=esm --preserve-symlinks --target=node20 --drop:debugger --drop-labels=DEV,D --define:process.env.NODE_ENV=\\\"production\\\" --minify-whitespace --minify-syntax --keep-names --outdir=dist/final/ --metafile=dist/temp/esbuild/meta.json --log-limit=0 --sourcemap=external`

Otherwise:

`esbuild src/index.ts --bundle --platform=node --charset=utf8 --format=esm --packages=external --target=node20 --drop:debugger --drop-labels=DEV,D --keep-names --outdir=dist/final/ --metafile=dist/temp/esbuild/meta.json --preserve-symlinks --log-limit=0 --sourcemap`

### Generate a random string

`tr -dc A-Za-z0-9 </dev/urandom | head -c 9999; echo`

## Astro

### Why I'm opting out scoped CSS feature for most components

Because I don't want my code to be littered with `:where`

### Why I'm writing CSS separately from the components

Otherwise Astro may not actually include those CSS properly.

### Why I'm using a custom integration for building globs

`Astro.glob()` only supports plain strings. It doesn't even support template strings.
I had to use an integration to generate a JS file to generate `Astro.glob()`.

## MDX

## Playwright

### TODO: Add Playwright tests for themes/*

## Git

### Why is there only one .gitignore file in workspace

Git reads all .gitignore files and ignore all the entries specified, no matter where they are.
Only one .gitignore file makes it more manageable.

### Why are there so many "unknown changes"

Sometimes I forget to commit while I still remember what the changes were.
I agree, I should do better.

## Why are TypeScript dependencies specified on the workspace only?

Yarn pnp patched TypeScript doesn't work well with packages that depend on TypeScript in monorepo.

[Comment in VSCode repo](https://github.com/microsoft/vscode/issues/182468#issuecomment-1567886944)

## Why not pnpm

Too slow, no matter which mode it's in.

Yarn is slow on initial resolve, but subsequent changes are pretty fast.

## Why not Shiki for code highlighting in html

Gives invalid ast for some code.
I'm leaning that it's not escaping properly.
(Unconfirmed)

## Arch Linux

```ansi
pacman -Sy --noconfirm graphviz imagemagick patch plantuml librsvg unzip
```

## Build Caddy

```typescript
import { $ } from 'zx';

await $`go install github.com/caddyserver/xcaddy/cmd/xcaddy@latest`;

await $`xcaddy build ${[
    '--with', 'github.com/mholt/caddy-events-exec',
    '--with', 'github.com/mholt/caddy-webdav',
    '--with', 'github.com/mholt/caddy-l4',
    '--with', 'github.com/porech/caddy-maxmind-geolocation',
    '--with', 'github.com/mholt/caddy-ratelimit',
    '--with', 'github.com/caddyserver/cache-handler',
    '--with', 'github.com/caddyserver/jsonc-adapter',
    '--with', 'github.com/caddy-dns/porkbun',
    '--with', 'github.com/caddy-dns/njalla',
]}`
    .pipe(process.stdout);

await $`chmod +x ./caddy`;

await $`caddy --version`;
```

## Run oxlint

When in workspace:
`yarn run -T -B oxlint -c packages/config/oxlint/index.json --ignore-path packages/config/oxlint/.eslintignore`

When in package:
`yarn run -T -B oxlint -c ../../config/oxlint/index.json --ignore-path ../../config/oxlint/.eslintignore`
