/**
 * Empty stub replacing canvg in client bundles.
 *
 * jspdf declares canvg as an optional dependency and lazy-loads it
 * via `import('canvg')` inside `addSvgAsImage()`. The doodle-widget
 * never calls that method, but rolldown still resolves and bundles
 * the dynamic import target; pulling in canvg and its dependency
 * rgbcolor, which has a custom license.
 *
 * This stub satisfies the dynamic import so the module graph stays
 * valid while keeping canvg and rgbcolor out of the bundle entirely.
 */
export {};
