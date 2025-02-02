export default (str: string): string =>
  Math
    .abs(Number(
      Array
        .from(str, (char) => char.codePointAt(0) ?? 0)
        .reduce((accumulator, currentCharCode, currentCharPosition) =>
          BigInt.asIntN(
            16,
            accumulator + BigInt(currentCharCode * (currentCharPosition + 1)),
          ), 0n),
    ))
    .toString(36);
