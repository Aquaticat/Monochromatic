import type {
  LangString,
  LongLangString,
  ShortLangString,
} from './string.type';

/* @__NO_SIDE_EFFECTS__ */ export function isString(value: any): value is string {
  return typeof value === 'string';
}

/* @__NO_SIDE_EFFECTS__ */ export function isObjectRegexp(value: any): value is RegExp {
  return Object.prototype.toString.call(value) === '[object RegExp]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isShortLangString(
  value: any,
): value is ShortLangString {
  return isString(value) && value.length === 2 && /^[a-z]+$/.test(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isLongLangString(
  value: any,
): value is LongLangString {
  return isString(value) && value.length === 5 && /^[a-z]{2}-[A-Z]{2}$/.test(value);
}

/* @__NO_SIDE_EFFECTS__ */ export function isLangString(value: any): value is LangString {
  return isShortLangString(value) || isLongLangString(value);
}
