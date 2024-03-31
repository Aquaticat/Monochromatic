const trimEndWith = (str: string, trimmer: string) => {
  const reversedTrimmer = trimmer.split('').toReversed().join();
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
};

export default trimEndWith;
