/**
 * Stylesheet for the glass corridor demo page: full-viewport canvas, a
 * minimal HUD in the corners, and an error overlay for browsers that
 * cannot start the renderer.
 */

/**
 * Renders the complete CSS for the demo page.
 *
 * @returns CSS stylesheet string
 *
 * @example
 * ```ts
 * const css = renderStyles();
 * ```
 */
export function renderStyles(): string {
  return `
:root {
  color-scheme: dark;
}
* {
  box-sizing: border-box;
}
html,
body {
  height: 100%;
  margin: 0;
  overflow: hidden;
  background: #04070e;
  color: #e8f4fb;
  font: 500 14px/1.4 ui-sans-serif, system-ui, sans-serif;
}
#stage {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  touch-action: none;
  cursor: crosshair;
}
.hud {
  position: fixed;
  z-index: 2;
  pointer-events: none;
  text-shadow: 0 2px 14px #000;
}
#brand {
  top: 18px;
  left: 20px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
#brand b {
  display: block;
  font-size: 13px;
  color: #fff;
}
#brand span {
  display: block;
  margin-top: 4px;
  font-size: 10px;
  color: #8fb4c9;
}
#score {
  top: 18px;
  right: 22px;
  text-align: right;
}
#score-value {
  display: block;
  font-size: 44px;
  font-variant-numeric: tabular-nums;
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: #fff;
}
#score span {
  display: block;
  margin-top: 6px;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #8fb4c9;
}
#hint {
  left: 50%;
  bottom: 12%;
  transform: translateX(-50%);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  transition: opacity 0.5s;
}
#hint.hidden {
  opacity: 0;
}
#backend-box {
  left: 20px;
  bottom: 16px;
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #8fb4c9;
}
#backend {
  color: #8ee8c2;
}
#error {
  position: fixed;
  z-index: 8;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgba(2, 5, 11, 0.92);
}
#error[hidden] {
  display: none;
}
#error div {
  max-width: 480px;
  padding: 24px;
  border: 1px solid rgba(255, 180, 180, 0.4);
  border-radius: 14px;
  background: #0d1725;
  text-align: center;
}
#error h1 {
  margin: 0 0 8px;
  font-size: 20px;
}
#error p {
  margin: 0;
  color: #a9bfd0;
}
`;
}
