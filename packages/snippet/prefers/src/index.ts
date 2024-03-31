const prefers: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  // @ts-ignore unresolvable "may have fewer than 2"
  [
    ['contrast', 'reduced-motion', 'reduced-data', 'reduced-transparency'].map((val) =>
      Object.freeze([val, Object.freeze(new Set(['toggle', 'true', 'false']))]),
    ),
    ['color-scheme'].map((val) => Object.freeze([val, Object.freeze(new Set(['toggle', 'light', 'dark']))])),
  ].flat(),
) as ReadonlyMap<string, ReadonlySet<string>>;

prefers.forEach((possibleVals, prefer) => {
  const preferVal = new URLSearchParams(location.search).get(prefer);

  if (preferVal) {
    if (possibleVals.has(preferVal)) {
      document.documentElement.setAttribute(`data-${prefer}`, preferVal);
    } else {
      throw TypeError(`query param ${prefer}'s value must be one of ${JSON.stringify(possibleVals)}, got ${preferVal}`);
    }
  }
});

