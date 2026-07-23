/**
 * CSS build tool: monorepo-aware `\@import` bundling plus `\@mixin`/`\@apply`
 * expansion over the byte-preserving css-edit CST.
 *
 * Two entry points:
 * - {@link buildCss}: file pipeline (read, inline imports, expand mixins, write).
 * - {@link expandCssMixins}: pure text pipeline for in-memory CSS
 *   (Shadow DOM styles in the browser); no filesystem, no process globals.
 *
 * @packageDocumentation
 */

export {
  buildCss,
  type CssBuildOptions,
} from './build.ts';
export {
  CircularCssMixinError,
  UnknownCssMixinError,
} from './errors.ts';
export { expandCssMixins, } from './expand.ts';
