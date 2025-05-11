// eslint-disable avoid-new
export const wait = (timeInMs: number): Promise<undefined> =>
  new Promise(function createTimeout(_resolve) {
    return setTimeout(_resolve, timeInMs);
  });
