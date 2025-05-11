export function trimEndWith(str: string, trimmer: string): string {
  if (trimmer === '') {
    throw new Error('trimmer cannot be empty');
  }
  if (!str.endsWith(trimmer)) {
    return str;
  }
  const reversedTrimmer = [...trimmer].toReversed().join('');
  let modifyingString = str;
  while (modifyingString.endsWith(trimmer)) {
    modifyingString = [
      ...[...modifyingString]
        .toReversed()
        .join('')
        .replace(reversedTrimmer, ''),
    ]
      .toReversed()
      .join('');
  }
  return modifyingString;
}

export function trimStartWith(str: string, trimmer: string): string {
  if (trimmer === '') {
    throw new Error('trimmer cannot be empty');
  }
  if (!str.startsWith(trimmer)) {
    return str;
  }
  let modifyingString = str;
  while (modifyingString.startsWith(trimmer)) {
    modifyingString = modifyingString.replace(trimmer, '');
  }
  return modifyingString;
}
