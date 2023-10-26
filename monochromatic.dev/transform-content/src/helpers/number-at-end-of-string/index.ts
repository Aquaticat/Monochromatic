const DIGIT_STRINGS = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '0',
]);

const numberStringAtEndOfStringWhereThereIsANumber = (inputString: string, accumulatedNumberString = ''): string =>
  DIGIT_STRINGS.has(inputString.slice(-1))
    ? numberStringAtEndOfStringWhereThereIsANumber(
      inputString.slice(0, -1),
      `${inputString.slice(-1)}${accumulatedNumberString}`,
    )
    : accumulatedNumberString;

const numberAtEndOfString = (inputString: string): number =>
  DIGIT_STRINGS.has(inputString.slice(-1))
    ? parseInt(numberStringAtEndOfStringWhereThereIsANumber(inputString))
    : NaN;

export default numberAtEndOfString;
