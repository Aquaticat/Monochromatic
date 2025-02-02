/* @__NO_SIDE_EFFECTS__ */ export function isString(value: any): value is string {
  return typeof value === 'string';
}

/* @__NO_SIDE_EFFECTS__ */ export function isRegexp(value: any): value is RegExp {
  return Object.prototype.toString.call(value) === '[object RegExp]';
}
