import typeOf from '@monochromatic.dev/module-type-of';

const unsupported = Object.freeze(['null', 'undefined', 'NaN', 'bigint', 'symbol']);

const primitive = Object.freeze(['boolean', 'string', 'number', 'date']);

export default function toExport(obj: any): string {
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
    }
  }

  switch (objType) {
    case 'set': {
      // @ts-expect-error
      return `Object.freeze(new Set([${Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
    }
    case 'map': {
      // @ts-expect-error
      return `Object.freeze(new Map([${Array.from(obj).map(([k, v]) => `[${toExport(k)}, ${toExport(v)}]`)}]))`;
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
