# config-tsdown

Ready to publish.

Shared [tsdown](https://tsdown.dev/) build configurations for Monochromatic packages.

## Configurations

Three platform-specific presets are available:

- **Neutral** (default) -- browser-compatible builds targeting Firefox 140
- **Node** -- server-side builds with `platform: 'node'`
- **Client** -- browser bundles for `<script type="module">` tags, no `.d.ts` output

All presets bundle workspace dependencies (`@monochromatic-dev/*`) into the output
so built artifacts are self-contained outside the monorepo.

## File naming convention

Per-package configs are named `tsdown.<platform>.config.ts`, never bare `tsdown.config.ts`. The platform infix matches the `build:js:<platform>` mise task template at the monorepo root, which invokes `tsdown --config tsdown.<platform>.config.ts` directly: a bare-named config will not be picked up by any task.

- `tsdown.browser.config.ts` for the neutral preset (browser-compatible, targets Firefox 140)
- `tsdown.node.config.ts` for the Node preset
- `tsdown.client.config.ts` for the client preset

A package adds whichever subset of the three configs it actually builds, then mirrors them in its `mise.toml` by extending the matching `build:js:<platform>` templates. Packages that build for multiple platforms keep one config file per platform; there is no combined config.

## Usage

```ts
// tsdown.browser.config.ts -- neutral build
import base from '@monochromatic-dev/config-tsdown/.ts';
import { defineConfig, } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/index.ts',], },);
```

```ts
// tsdown.node.config.ts -- Node.js build
import base from '@monochromatic-dev/config-tsdown/.node.ts';
import { defineConfig, } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/index.ts',], },);
```

```ts
// tsdown.client.config.ts -- browser client bundle
import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { defineConfig, } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/client.ts',], },);
```

## Output directories

- Neutral: `dist/final/neutral/`
- Node: `dist/final/node/`
- Client: `dist/client/`
