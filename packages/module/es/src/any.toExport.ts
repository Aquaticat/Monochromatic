// oxlint-disable-next-line no-unassigned-import -- For side effects.
import '@total-typescript/ts-reset/array-includes';
import { match } from 'ts-pattern';
import { typeOf } from './any.typeOf.ts';

const unsupported = Object.freeze(
  ['null', 'undefined', 'NaN', 'bigint', 'symbol'] as const,
);

const primitive = Object.freeze(['boolean', 'string', 'number', 'date'] as const);

export function toExport(obj: any): string {
  const objType = typeOf(obj);
  if (unsupported.includes(objType)) {
    throw new TypeError(`Unsupported obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
  }
  if (primitive.includes(objType)) {
    const primitiveObjType = objType as typeof primitive[number];
    return match(primitiveObjType)
      .with('boolean', function handler() {
        const boolObj = obj as boolean;
        return String(boolObj);
      })
      .with('number', function handler() {
        const numberObj = obj as number;
        return String(numberObj);
      })
      .with('string', function handler() {
        const stringObj = obj as string;
        return JSON.stringify(stringObj);
      })
      .with('date', function handler() {
        const dateObj = obj as Date;
        return `new Date(${JSON.stringify(dateObj)})`;
      })
      .exhaustive();
  }

  return match(objType)
    .with('set', function handler() {
      const setObj = obj as Set<any>;
      return `Object.freeze(new Set([${[...setObj].map(toExport).join(',')}]))`;
    })
    .with('map', function handler() {
      const mapObj = obj as Map<any, any>;
      return `Object.freeze(new Map([${
        [...mapObj]
          .map(function eachMapEntry([k, v]) {
            return `[${toExport(k)},${toExport(v)}]`;
          })
          .join(',')
      }]))`;
    })
    .with('array', function handler() {
      const arrayObj = obj as any[];
      return `Object.freeze([${
        arrayObj
          .map(function eachArrayItem(i: any) {
            return toExport(i);
          })
          .join(',')
      }])`;
    })
    .with('object', function handler() {
      const objectObj = obj as Record<string, any>;
      return `Object.freeze(Object.fromEntries([${
        Object
          .entries(objectObj)
          .map(
            function eachObjectEntry([k, v]) {
              return `[${toExport(k)},${toExport(v)}]`;
            },
          )
          .join(',')
      }]))`;
    })
    .otherwise(
      function thrower() {
        /* v8 ignore next -- @preserve */
        throw new TypeError(`Unknown obj ${obj} ${JSON.stringify(obj)} type ${objType}`);
      },
    );
}
