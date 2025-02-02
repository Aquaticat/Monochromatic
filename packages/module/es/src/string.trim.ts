export function trimEndWith(str: string, trimmer: string): string {
  const reversedTrimmer = trimmer.split('').toReversed().join('');
  let modifingString = str;
  while (modifingString.endsWith(trimmer)) {
    modifingString = modifingString
      .split('')
      .toReversed()
      .join('')
      .replace(reversedTrimmer, '')
      .split('')
      .toReversed()
      .join('');
  }
  return modifingString;
}

export function trimStartWith(str: string, trimmer: string): string {
  let modifingString = str;
  while (modifingString.startsWith(trimmer)) {
    modifingString = modifingString.replace(trimmer, '');
  }
  return modifingString;
}
