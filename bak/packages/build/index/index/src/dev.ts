export default (() => {
  if (
    typeof import.meta === 'undefined'
    || typeof import.meta.env === 'undefined'
    || typeof import.meta.env.MODE === 'undefined'
  ) {
    if (
      typeof process === 'undefined'
      || typeof process.env === 'undefined'
      || typeof process.env.NODE_ENV === 'undefined'
    ) {
      return true;
    }
    return process.env.NODE_ENV === 'development';
  }
  return import.meta.env.MODE === 'development';
})() satisfies boolean as boolean;
