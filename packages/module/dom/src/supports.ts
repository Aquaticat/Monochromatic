/* By checking https://caniuse.com/?compare=chrome+127,safari+17.4,firefox+128,and_chr+127&compareCats=all
  and the features I'm currently using, we got a list of features we need to check supports for.

  This is not a general purpose supports library: features that we don't need to check supports for according to the above link will have their corresponding function commented and removed from the final bundle. */

// Firefox ESR doesn't
// WONTFIX: Use a normal searchbar in that situation and open a non-popover (maybe dialog) with JS
// UPDATE: As of August 2024, Firefox new ESR supports it. This function is retired, commented, and excluded from the final bundle.
// export const popover = (): boolean => HTMLElement.prototype.hasOwnProperty('popover');

// Firefox ESR doesn't
// DONE: Maybe just wait for Firefox to move to the next ESR.
//       Too much work reimplementing :has otherwise.
//       Or maybe we can find a good polyfill.
// UPDATE: As of August 2024, Firefox new ESR supports it. This function is retired, commented, and excluded from the final bundle.
// export const has = (): boolean => CSS.supports('selector(body:has(p))');

// Everything supports it?
// UPDATE: As of August 2024, Firefox new ESR supports it. This function is retired, commented, and excluded from the final bundle.
// export const logicalViewport = (): boolean => CSS.supports('inline-size', '1dvi');

// Firefox ESR doesn't
// WONTFIX: Just try not to use container queries. Many things I thought can only be implemented with container queries turned out can be elegantly implemented without them.
// UPDATE: As of August 2024, Firefox new ESR supports it. This function is retired, commented, and excluded from the final bundle.
// export const containerQuery = (): boolean => CSS.supports('inline-size', '1cqi');

// Firefox ESR doesn't
// WONTFIX: Maybe page it? But it's too much work so #priority:low
// UPDATE: As of August 2024, Firefox new ESR supports it. This function is retired, commented, and excluded from the final bundle.
/* export const contentVisibility = (): boolean =>
  CSS.supports('content-visibility', 'auto'); */

// Chrome doesn't
// DONE: added overflow-block supports check inside CSS and given the overflow-y fallback
export const logicalOverflow = (): boolean => CSS.supports('overflow-block', 'auto');

// Firefox ESR doesn't
// TODO: use font size in that case
// UPDATE: Turns out I'm actually not using this.
export const textSizeAdjust = (): boolean => CSS.supports('text-size-adjust', '50%');

// Safari on iOS 16 doesn't
// WONTFIX: write some JS for autofocus
// Dropping iOS 16.
// export const autoFocus = (): boolean => HTMLElement.prototype.hasOwnProperty('autofocus');

// Only test for the features I'm currently using and need solutions for.
export const testedFeatures: boolean[] = [];
export function supports(): boolean {
  return testedFeatures.every((v) => v === true);
}
