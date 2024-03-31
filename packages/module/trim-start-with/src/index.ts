const trimStartWith = (str: string, trimmer: string) => {
  let modifingString = str;
  while (modifingString.startsWith(trimmer)) {
    modifingString = modifingString.replace(trimmer, '');
  }
  return modifingString;
};
export default trimStartWith;
