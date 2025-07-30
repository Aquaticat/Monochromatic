(function intsTo(num: number, minGap: number,): void {
  for (const fromInclusive of [-num, -1, 0, 1, num,]) {
    // type any union less than minGap on your own.
    for (let toInclusive = fromInclusive + minGap; toInclusive <= num; toInclusive++) {
      if (!([-num, -1, 0, 1, num,].includes(toInclusive,)))
        continue;
      console.log(
        `/* @__NO_SIDE_EFFECTS__ */ export type Ints${
          fromInclusive < 0 ? `Negative${-fromInclusive}` : fromInclusive
        }to${toInclusive < 0 ? `Negative${-toInclusive}` : toInclusive} = ${
          toInclusive === fromInclusive
            ? toInclusive
            : `(${
              [...new Array(toInclusive + 1 - fromInclusive,).keys(),]
                .map(current => current + fromInclusive)
                .join('|',)
            })`
        };`,
      );
    }
  }
})(
  // Max TypeScript can handle
  10,
  // Min gap
  9,
);

// Export to mark as module
export {};
