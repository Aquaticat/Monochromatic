import { typeOf } from './any.typeOf.ts';

const unsupported = Object.freeze(['null', 'undefined', 'NaN', 'bigint', 'symbol']);

const primitive = Object.freeze(['boolean', 'string', 'number', 'date']);

export function toExport(obj: any): string {
  const objType = typeOf(obj);
  if (unsupported.includes(objType)) {
    throw new TypeError(`Unsupported obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
  }
  if (primitive.includes(objType)) {
    switch (objType) {
      case 'boolean': {
        const boolObj = obj as boolean;
        return String(boolObj);
      }

      case 'number': {
        const numberObj = obj as number;
        return String(numberObj);
      }

      case 'string': {
        const stringObj = obj as string;
        return `${JSON.stringify(stringObj)}`;
      }

      case 'date': {
        const dateObj = obj as Date;
        return `new Date(${JSON.stringify(dateObj)})`;
      }

      default:
        throw new TypeError('Impossible!');
    }
  }

  switch (objType) {
    case 'set': {
      const setObj = obj as Set<any>;
      return `Object.freeze(new Set([${[...setObj].map(toExport).join(',')}]))`;
    }

    case 'map': {
      const mapObj = obj as Map<any, any>;
      return `Object.freeze(new Map([${
        [...mapObj].map(function eachMapEntry([k, v]) {
          return `[${toExport(k)},${toExport(v)}]`;
        })
      }]))`;
    }

    case 'array': {
      const arrayObj = obj as any[];
      return `Object.freeze([${
        arrayObj.map(function eachArrayItem(i: any) {
          return toExport(i);
        })
      }])`;
    }

    case 'object': {
      const objectObj = obj as Record<string, any>;
      return `Object.freeze(Object.fromEntries([${
        Object.entries(objectObj).map(
          function eachObjectEntry([k, v]) {
            return `[${toExport(k)},${toExport(v)}]`;
          },
        )
      }]))`;
    }

    default:
      throw new TypeError(`Unknown obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
  }
}
