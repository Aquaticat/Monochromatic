# config-tsdown

Shared [tsdown](https://tsdown.dev/) build configurations for Monochromatic packages.

## Configurations

Three platform-specific presets are available:

- **Neutral** (default) -- browser-compatible builds targeting Firefox 140
- **Node** -- server-side builds with `platform: 'node'`
- **Client** -- browser bundles for `<script type="module">` tags, no `.d.ts` output

All presets bundle workspace dependencies (`@monochromatic-dev/*`) into the output
so built artifacts are self-contained outside the monorepo.

## Usage

```ts
// tsdown.config.ts -- neutral build
import base from '@monochromatic-dev/config-tsdown/.ts';
import { defineConfig } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/index.ts'] });
```

```ts
// tsdown.node.config.ts -- Node.js build
import base from '@monochromatic-dev/config-tsdown/.node.ts';
import { defineConfig } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/index.ts'] });
```

```ts
// tsdown.client.config.ts -- browser client bundle
import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { defineConfig } from 'tsdown';
export default defineConfig({ ...base, entry: ['./src/client.ts'] });
```

## Output directories

- Neutral: `dist/final/neutral/`
- Node: `dist/final/node/`
- Client: `dist/client/`
