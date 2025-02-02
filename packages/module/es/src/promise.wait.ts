// eslint-disable avoid-new
export const wait = (timeInMs: number): Promise<undefined> =>
  new Promise((_resolve) => setTimeout(_resolve, timeInMs));
