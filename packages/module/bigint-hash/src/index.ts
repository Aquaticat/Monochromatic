export default (str: string): string =>
  Math
    .abs(Number(
      Array
        .from(str, (char) => char.codePointAt(0) ?? 0)
        .reduce((accumulator, currentCharCode) => BigInt.asIntN(16, accumulator + BigInt(currentCharCode)), 0n),
    ))
    .toString(36);
