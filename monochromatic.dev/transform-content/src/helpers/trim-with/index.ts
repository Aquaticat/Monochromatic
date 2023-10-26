const trimStartWith = (inputString: string, trimWhat: string): string =>
  inputString.startsWith(trimWhat)
    ? trimStartWith(inputString.slice(trimWhat.length), trimWhat)
    : inputString;
const trimEndWith = (inputString: string, trimWhat: string): string =>
  inputString.endsWith(trimWhat)
    ? trimEndWith(inputString.slice(0, -trimWhat.length), trimWhat)
    : inputString;

const trimWith = (inputString: string, trimWhat: string): string =>
  trimEndWith(trimStartWith(inputString, trimWhat), trimWhat);

export default trimWith;

export {
  trimStartWith,
  trimEndWith,
};
