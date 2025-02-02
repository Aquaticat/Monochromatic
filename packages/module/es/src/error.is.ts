/* @__NO_SIDE_EFFECTS__ */ export function isError(value: any): value is Error {
  // Contrary to expectations, all the subclasses of Error all also give [object Error]
  return Object.prototype.toString.call(value) === '[object Error]';
}
