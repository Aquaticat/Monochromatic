import { piped } from 'rambdax';

export const prefers: ReadonlyMap<string, ReadonlySet<string>> = piped(
  [
    piped(
      ['contrast', 'reduced-motion', 'reduced-data', 'reduced-transparency'],
      (val) =>
        val.map((directive): [string, ReadonlySet<string>] => [
          directive,
          piped(['toggle', 'true', 'false'], (val) => new Set(val)),
        ]),
    ),
    piped(
      ['color-scheme'],
      (val) =>
        val.map((directive): [string, ReadonlySet<string>] => [
          directive,
          piped(['toggle', 'light', 'dark'], (val) => new Set(val)),
        ]),
    ),
  ],
  (val) => val.flat(),
  (val) => new Map(val),
);

export default function onDomContentLoaded(): void {
  prefers.forEach((possibleVals, prefer) => {
    const preferVal = new URLSearchParams(location.search).get(prefer);

    if (preferVal) {
      if (possibleVals.has(preferVal)) {
        document.documentElement.setAttribute(`data-${prefer}`, preferVal);
      } else {
        throw new TypeError(
          `query param ${prefer}'s value must be one of ${
            JSON.stringify(possibleVals)
          }, got ${preferVal}`,
        );
      }
    }
  });
}
