export function typeOf(
  obj: any,
):
  | 'null'
  | 'undefined'
  | 'NaN'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'symbol'
  | 'string'
  | 'array'
  | 'date'
  | 'set'
  | 'map'
  | 'object'
{
  switch (true) {
    case obj === null: {
      return 'null';
    }

    case obj === undefined: {
      return 'undefined';
    }

    case Number.isNaN(obj): {
      return 'NaN';
    }

    case typeof obj === 'number': {
      return 'number';
    }

    case typeof obj === 'boolean': {
      return 'boolean';
    }

    case typeof obj === 'bigint': {
      return 'bigint';
    }

    case typeof obj === 'symbol': {
      return 'symbol';
    }

    case typeof obj === 'string': {
      return 'string';
    }

    case Array.isArray(obj): {
      return 'array';
    }

    case obj instanceof Date: {
      return 'date';
    }

    case obj instanceof Set: {
      return 'set';
    }

    case obj instanceof Map: {
      return 'map';
    }

    case String(obj).startsWith('[object Object]'): {
      return 'object';
    }

    default: {
      throw new TypeError(`Unrecognized obj ${obj} ${JSON.stringify(obj)} ${typeof obj}`);
    }
  }
}
