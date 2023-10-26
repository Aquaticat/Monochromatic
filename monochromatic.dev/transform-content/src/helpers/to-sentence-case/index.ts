const toSentenceCase = (inputString: string): string =>
  inputString.split('_')
    .reduce(
      (accumulator, stringFragment) => `${accumulator} ${stringFragment[0]?.toUpperCase()}${stringFragment.slice(1)}`,
      '',
    )
    .trim();

export default toSentenceCase;
