import type {
  DigitString,
  FloatString,
  IntString,
  LangString,
  LongLangString,
  NegativeFloatString,
  NegativeIntString,
  NegativeNumberString,
  No0DigitString,
  NumberString,
  PositiveFloatString,
  PositiveIntString,
  PositiveNumberString,
  ShortLangString,
} from './string.type.ts';

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

export function isDigitString(value: any): value is DigitString {
  return ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(value);
}

export function isNo0DigitString(value: any): value is No0DigitString {
  return ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(value);
}

export function isDigitsString(value: any): value is string {
  return isString(value) && value.length > 0 && [...value].every(isDigitString);
}

export function isPositiveIntString(value: any): value is PositiveIntString {
  if (isDigitString(value)) {
    return true;
  }
  if (!isString(value)) {
    return false;
  }
  if (isDigitString(value)) {
    return true;
  }
  if (value.length <= 1) {
    return false;
  }
  if (!isNo0DigitString(value[0])) {
    return false;
  }
  return isDigitsString(value.slice(1));
}

export function isNegativeIntString(value: any): value is NegativeIntString {
  if (!isString(value)) {
    return false;
  }
  if (value.length <= 1) {
    return false;
  }
  if (value[0] !== '-') {
    return false;
  }
  return isPositiveIntString(value.slice(1));
}

export function isPositiveFloatString(value: any): value is PositiveFloatString {
  if (!isString(value)) {
    return false;
  }
  if (value.length <= 2) {
    return false;
  }
  const dotIndex = value.indexOf('.');
  if (dotIndex === -1) {
    return false;
  }
  const intPart = value.slice(0, dotIndex);
  if (!isPositiveIntString(intPart)) {
    return false;
  }
  const floatPart = value.slice(dotIndex + 1);
  if (
    [...floatPart].every(function is0(floatPartDigit) {
      return floatPartDigit === '0';
    })
  ) { return false; }
  return isDigitsString(floatPart);
}

export function isNegativeFloatString(value: any): value is NegativeFloatString {
  if (!isString(value)) {
    return false;
  }
  if (value.length <= 1) {
    return false;
  }
  if (value[0] !== '-') {
    return false;
  }
  return isPositiveFloatString(value.slice(1));
}

export function isIntString(value: any): value is IntString {
  return isPositiveIntString(value) || isNegativeIntString(value);
}

export function isFloatString(value: any): value is FloatString {
  return isPositiveFloatString(value) || isNegativeFloatString(value);
}

export function isPositiveNumberString(value: any): value is PositiveNumberString {
  return isPositiveIntString(value) || isPositiveFloatString(value);
}

export function isNegativeNumberString(value: any): value is NegativeNumberString {
  return isNegativeIntString(value) || isNegativeFloatString(value);
}

export function isNumberString(value: any): value is NumberString {
  return isPositiveNumberString(value) || isNegativeNumberString(value);
}
