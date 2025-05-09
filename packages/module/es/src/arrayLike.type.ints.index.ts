console.log((function negIntToInt(num: number): string {
  let result =
    '/* @__NO_SIDE_EFFECTS__ */ export type Ints<fromInclusive extends number, toInclusive extends number,> =\n';

  // Originally decided to support -100 to 100. But then dprint said call stack exhausted.
  for (let fromInclusive = -num; fromInclusive <= num; fromInclusive++) {
    result += `fromInclusive extends ${fromInclusive}\n?`;
    for (let toInclusive = fromInclusive; toInclusive <= num; toInclusive++) {
      result += `toInclusive extends ${toInclusive} ? ${
        toInclusive === fromInclusive
          ? toInclusive
          : `(${
            [...Array.from({ length: toInclusive + 1 - fromInclusive }).keys()]
              .map((current) => current + fromInclusive)
              .join('|')
          })`
      } :`;
    }
    result += 'number\n:';
  }
  result += 'number;';

  return result;
})(
  10,
));

console.log((function negIntToIntExclusive(num: number): string {
  let result =
    'export type IntsToExclusive<fromInclusive extends number, toExclusive extends number,> =\n';

  // Originally decided to support -100 to 100. But then dprint said call stack exhausted.
  for (let fromInclusive = -num; fromInclusive <= num; fromInclusive++) {
    result += `fromInclusive extends ${fromInclusive}\n?`;
    for (let toExclusive = fromInclusive; toExclusive <= num; toExclusive++) {
      result += `toExclusive extends ${toExclusive} ? ${
        toExclusive === fromInclusive
          ? toExclusive
          : `(${
            [...Array.from({ length: toExclusive - fromInclusive }).keys()]
              .map((current) => current + fromInclusive)
              .join('|')
          })`
      } :`;
    }
    result += 'number\n:';
  }
  result += 'number;';

  return result;
})(
  10,
));
