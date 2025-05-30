export function isSingleQuotedString(
  input: string,
): boolean {
  return input.startsWith("'") && input.endsWith("'");
}

export function isDoubleQuotedString(
  input: string,
): boolean {
  return input.startsWith('"') && input.endsWith('"');
}

export function toSingleQuotedString(
  input: string,
): string {
  if (isSingleQuotedString(input)) {
    return input;
  }

  if (!isDoubleQuotedString(input)) {
    throw new Error(
      `Expected a string to be either already single or double quoted, but got: ${input}`,
    );
  }

  const doubleQuotedInputWoSideQuotes = input.slice(1, -1);
  const singleQuotedStringWoSideQuotes = doubleQuotedInputWoSideQuotes.replaceAll(
    String.raw`\"`,
    `'`,
  );
  return `'${singleQuotedStringWoSideQuotes}'`;
}

export function toDoubleQuotedString(
  input: string,
): string {
  if (isDoubleQuotedString(input)) {
    return input;
  }

  if (!isSingleQuotedString(input)) {
    throw new Error(
      `Expected a string to be either already single or double quoted, but got: ${input}`,
    );
  }

  const singleQuotedInputWoSideQuotes = input.slice(1, -1);
  const doubleQuotedStringWoSideQuotes = singleQuotedInputWoSideQuotes.replaceAll(
    String.raw`\'`,
    `"`,
  );
  return `"${doubleQuotedStringWoSideQuotes}"`;
}
