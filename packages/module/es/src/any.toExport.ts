import { typeOf } from '@monochromatic-dev/module-es/ts';

const unsupported = Object.freeze(['null', 'undefined', 'NaN', 'bigint', 'symbol']);

const primitive = Object.freeze(['boolean', 'string', 'number', 'date']);

export function toExport(obj: any): string {
  const objType = typeOf(obj);
  if (unsupported.includes(objType))
    throw new TypeError(`Unsupported obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
  if (primitive.includes(objType)) {
    switch (objType) {
      case 'boolean': {
        return String(obj);
      }
      case 'number': {
        return String(obj);
      }
      case 'string': {
        return `${JSON.stringify(obj)}`;
      }
      case 'date': {
        return `new Date(${JSON.stringify(obj)})`;
      }
      default: {
        throw new TypeError('Impossible!');
      }
    }
  }

  switch (objType) {
    case 'set': {
      return `Object.freeze(new Set([${
        // @ts-expect-error TypeScript limitations
        Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
    }
    case 'map': {
      return `Object.freeze(new Map([${
        // @ts-expect-error TypeScript limitations
        Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
    }
    case 'array': {
      return `Object.freeze([${obj.map((i) => toExport(i))}])`;
    }
    case 'object': {
      return `Object.freeze(Object.fromEntries([${
        Object.entries(obj).map(
          ([k, v]) => `[${toExport(k)}, ${toExport(v)}]`,
        )
      }]))`;
    }
    default: {
      throw new TypeError(`Unknown obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
    }
  }
}
