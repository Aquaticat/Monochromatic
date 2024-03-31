const filterPromise = (values, fn) =>
  Promise.all(values.map(fn)).then((booleans) => values.filter((_, i) => booleans[i]));
export default filterPromise;
