/**
 * Sidecar entry for the bundled stylistic oxlint plugin.
 *
 * Re-exports the plugin's TypeScript source via its `/ts` subpath so `tsdown`
 * inlines it (and its workspace deps) into `dist/final/node/plugin-stylistic.mjs`,
 * which `index.node.ts` references by relative `file://` URL.
 */

export { default, } from '@monochromatic-dev/oxlint-plugin-stylistic/ts';
