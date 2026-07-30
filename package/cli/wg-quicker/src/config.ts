/**
 * Public config parsing and loading surface.
 *
 * @module
 */

export { loadConfig, } from './config-load.ts';
export { parseConfigText, } from './config-parse.ts';
export type {
  AllowedFromFiles,
  WireguardConfig,
} from './config-types.ts';
