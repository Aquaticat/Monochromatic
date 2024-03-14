// By checking https://caniuse.com/?compare=chrome+122,safari+17.4,firefox+115,and_chr+122,ios_saf+16.6-16.7&compareCats=all
// and the features I'm currently using, we got a list of features we need to check supports for.

// Firefox ESR doesn't
// TODO: Use a normal searchbar in that situation and open a non-popover (maybe dialog) with JS
// biome-ignore lint/suspicious/noPrototypeBuiltins: Just checking for supports.
export const popover = () => HTMLElement.prototype.hasOwnProperty('popover');

// Firefox ESR doesn't
// TODO: Maybe just wait for Firefox to move to the next ESR.
//       Too much work reimplementing :has otherwise.
//       Or maybe we can find a good polyfill.
export const has = () => CSS.supports('selector(body:has(p))');

// Everything supports it?
export const logicalViewport = () => CSS.supports('inline-size', '1dvi');

// Firefox ESR doesn't
// TODOne?: Just try not to use container queries. Many things I thought can only be implemented with container queries turned out can be elegantly implemented without them.
export const containerQuery = () => CSS.supports('inline-size', '1cqi');

// Firefox ESR doesn't
// TODO: Maybe page it? But it's too much work so #priority:low
export const contentVisibility = () => CSS.supports('content-visibility', 'auto');

// Chrome doesn't
// TODOne: added overflow-block supports check inside CSS and given the overflow-y fallback
export const logicalOverflow = () => CSS.supports('overflow-block', 'auto');

// Firefox ESR doesn't
// TODO: use font size in that case
// UPDATE: Turns out I'm actually not using this.
export const textSizeAdjust = () => CSS.supports('text-size-adjust', '50%');

// Safari on iOS 16 doesn't
// TODO: write some JS for autofocus
// biome-ignore lint/suspicious/noPrototypeBuiltins: Just checking for supports.
export const autoFocus = () => HTMLElement.prototype.hasOwnProperty('autofocus');

// Only test for the features I'm currently using.
// And need solutions for.
export default () => [popover(), autoFocus()].every((v) => v === true);
