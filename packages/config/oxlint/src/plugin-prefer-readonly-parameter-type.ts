/**
 * Sidecar entry for semantic readonly parameter plugin.
 *
 * Re-exports plugin TypeScript source through `/ts` so `tsdown` inlines it into
 * co-located built configuration sidecar.
 */

export { default, } from '@monochromatic-dev/config-oxlint-prefer-readonly-parameter-type/ts';
