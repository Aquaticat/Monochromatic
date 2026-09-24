/**
 Value sampler for declared types: a fast-check arbitrary per type tree that
 draws only values assignable to the emitted type, each paired with its
 TypeScript source.

 The source is type-directed: Sets and Maps get explicit type arguments from
 the union member the value was actually drawn from, so an input never
 depends on how TypeScript infers a collection's element type under a union
 context (that inference produced false failures). Union members are chosen
 per draw, optional properties are sometimes omitted (never set to
 `undefined`, since the repo compiles with `exactOptionalPropertyTypes`),
 index signatures contribute zero to two extra keys of their key kind, and
 wrappers adjust optionality the way `Partial` and `Required` do.

 Symbol keys use {@link RUNTIME_SYMBOLS}, whose names match the `unique
 symbol` constants the generated file declares.

 @module
 */

import {
  array,
  boolean,
  constant,
  constantFrom,
  oneof,
  tuple,
  uniqueArray,
  type Arbitrary,
} from 'fast-check';

import {
  emitType,
  LEAF_INTEGER,
  SYMBOL_NAMES,
  type ObjectNode,
  type PropNode,
  type TypeNode,
} from './declared-type-ast.ts';

/**
 A drawn value and TypeScript source that evaluates to an equal value.
 */
export type Sampled = {
  readonly value: unknown;
  readonly source: string
};

/**
 Runtime symbols keyed by the constant names the generated file declares.
 */
export const RUNTIME_SYMBOLS: Readonly<Record<string, symbol>> = Object.fromEntries(SYMBOL_NAMES.map(function toSymbol(name,) {
  return [
    name,
    Symbol(name,),
  ];
},),);

/**
 Most elements per sampled array, Set, or Map.
 */
const MAX_ELEMENTS = 3;

/**
 Most extra keys an index signature contributes.
 */
const MAX_INDEX_KEYS = 2;

/**
 One drawn object entry: runtime key, key source, and sampled value.
 */
type Entry = {
  readonly key: PropertyKey;
  readonly keySource: string;
  readonly sampled: Sampled
};

/**
 Scalar sample whose source is its JSON form.

 @param value - Scalar value.

 @returns Sampled scalar.

 @example
 ```ts
 scalar(1); // { value: 1, source: '1' }
 ```
 */
function scalar(value: unknown,): Sampled {
  return {
    source: value === undefined ? 'undefined' : JSON.stringify(value,),
    value,
  };
}

/**
 Entry for a declared property or an index-signature key.

 @param key - String key or symbol constant name.
 
 @param symbolKey - Whether `key` names a symbol constant.
 
 @param sampled - Sampled value.

 @returns Entry with runtime key and source key.

 @example
 ```ts
 entryOf({ key: 'a', symbolKey: false, sampled, });
 ```
 */
function entryOf({
  key,
  symbolKey,
  sampled,
}: {
  readonly key: string;
  readonly symbolKey: boolean;
  readonly sampled: Sampled
},): Entry {
  if (!symbolKey)
    return {
      key,
      keySource: JSON.stringify(key,),
      sampled,
    };
  /**
   Runtime symbol for the constant name.
   */
  const symbol = RUNTIME_SYMBOLS[key];
  if (symbol === undefined)
    throw new Error(`no runtime symbol for ${key}`,);
  return {
    key: symbol,
    keySource: `[${key}]`,
    sampled,
  };
}

/**
 Assemble drawn entries into an object and its literal source.

 @param entries - Present entries in order.

 @returns Sampled object.

 @example
 ```ts
 objectOf([entry,]);
 ```
 */
function objectOf(entries: readonly Entry[],): Sampled {
  return {
    source: `{ ${entries.map(function property(entry,) {
      return `${entry.keySource}: ${entry.sampled
        .source}`;
    },)
      .join(', ',)} }`,
    value: Object.defineProperties(
      {},
      Object.fromEntries(entries.map(function toDescriptor(entry,) {
      return [
        entry.key,
        {
          configurable: true,
          enumerable: true,
          value: entry.sampled
            .value,
          writable: true,
        },
      ];
    },),),
    ),
  };
}

/**
 Extra keys an index signature may contribute, never colliding with declared props.

 @param keyKind - Signature key kind.

 @returns Key names; `SYM_INDEX` names a symbol constant.

 @example
 ```ts
 indexKeys('template'); // ['k1', 'kz']
 ```
 */
function indexKeys(keyKind: 'number' | 'string' | 'symbol' | 'template',): readonly string[] {
  return {
    number: [
      '0',
      '1',
    ],
    string: [
      'x',
      'y',
    ],
    symbol: ['SYM_INDEX',],
    template: [
      'k1',
      'kz',
    ],
  }[keyKind];
}

/**
 Entries of one object type, honoring wrappers and index signatures.

 @param node - Object type.

 @returns Arbitrary of present entries.

 @example
 ```ts
 const entries = sampleEntries(node);
 ```
 */
function sampleEntries(node: ObjectNode,): Arbitrary<readonly Entry[]> {
  /**
   One arbitrary per declared property; omitted ones yield an empty list.
   */
  const props = node.props
    .map(function sampleProp(prop: PropNode,): Arbitrary<readonly Entry[]> {
    /**
     Whether this property may be omitted under the wrapper.
     */
    const omittable = (node.wrapper === 'partial') || (prop.optional && (node.wrapper !== 'required'));
    /**
     Present entry arbitrary.
     */
    const present = sampleValue(prop.type,)
      .map(function toEntry(sampled,): readonly Entry[] {
      return [entryOf({
        key: prop.key,
        sampled,
        symbolKey: prop.symbolKey,
      },),];
    },);
    return omittable ? oneof(
      constant<readonly Entry[]>([],),
      present,
    ) : present;
  },);
  /**
   Extra index-signature entries.
   */
  const extras: Arbitrary<readonly Entry[]> = node.index
    .keyKind
    === 'none'
    ? constant([],)
    : uniqueArray(
      tuple(
        constantFrom(...indexKeys(node.index
          .keyKind,),),
        sampleValue(node.index
          .value,),
      ),
      {
      maxLength: MAX_INDEX_KEYS,
      selector: function keyOf([key,],) {
        return key;
      },
    },
    )
      .map(function toEntries(pairs,) {
      return pairs.map(function toEntry([key, sampled,],) {
        return entryOf({
          key,
          sampled,
          symbolKey: key === 'SYM_INDEX',
        },);
      },);
    },);
  return tuple(
    tuple(...props,),
    extras,
  )
    .map(function flatten([declared, extra,],) {
    return [
      ...declared.flat(),
      ...extra,
    ];
  },);
}

/**
 Sampler producing values assignable to a declared type, with their source.

 @param node - Declared type.

 @returns Arbitrary of conforming samples.

 @example
 ```ts
 const samples = sampleValue({ kind: 'number', });
 ```
 */
export function sampleValue(node: TypeNode,): Arbitrary<Sampled> {
  if ((node.kind === 'number') || (node.kind === 'brand'))
    return LEAF_INTEGER.map(scalar,);
  if (node.kind === 'string')
    return constantFrom(
      'a',
      'b',
      'zz',
    )
      .map(scalar,);
  if (node.kind === 'boolean')
    return boolean()
      .map(scalar,);
  if ((node.kind === 'null') || (node.kind === 'undefined'))
    return constant(scalar(node.kind === 'null' ? null : undefined,),);
  if (node.kind === 'literal')
    return constant(scalar(node.value,),);
  if (node.kind === 'date') {
    return LEAF_INTEGER.map(function toDate(offset,): Sampled {
      return {
        source: `new Date(${String(Math.abs(offset,),)})`,
        value: new Date(Math.abs(offset,),),
      };
    },);
  }
  if (node.kind === 'regexp') {
    return constantFrom(
      'x',
      'y',
    )
      .map(function toRegExp(pattern,): Sampled {
      return {
        source: `new RegExp(${JSON.stringify(pattern,)}, "g")`,
        value: new RegExp(
          pattern,
          'g',
        ),
      };
    },);
  }
  if ((node.kind === 'array') || (node.kind === 'tuple')
    || (node.kind === 'set')) {
    /**
     Element samples: one per tuple slot, or up to a few for arrays and Sets.
     */
    const items = node.kind === 'tuple'
      ? tuple(...node.elements
        .map(sampleValue,),)
      : array(
        sampleValue(node.element,),
        { maxLength: MAX_ELEMENTS, },
      );
    return items.map(function toCollection(samples,): Sampled {
      /**
       Element sources joined for a literal.
       */
      const inner = samples.map(function sourceOf(sample,) {
        return sample.source;
      },)
        .join(', ',);
      /**
       Element values.
       */
      const values = samples.map(function valueOf(sample,) {
        return sample.value;
      },);
      if (node.kind === 'set')
        return {
          source: `new Set<${emitType(node.element,)}>([${inner}])`,
          value: new Set(values,),
        };
      return {
        source: `[${inner}]`,
        value: values,
      };
    },);
  }
  if (node.kind === 'map') {
    return uniqueArray(
      tuple(
        node.keyKind === 'string' ? constantFrom<number | string>(
          'k',
          'm',
        ) : constantFrom<number | string>(
          1,
          2,
        ),
        sampleValue(node.value,),
      ),
      {
      maxLength: MAX_ELEMENTS,
      selector: function keyOf([key,],) {
        return key;
      },
    },
    )
      .map(function toMap(entries,): Sampled {
      return {
        source: `new Map<${node.keyKind}, ${emitType(node.value,)}>([${entries.map(function entrySource([key, sampled,],) {
          return `[${JSON.stringify(key,)}, ${sampled.source}]`;
        },)
          .join(', ',)}])`,
        value: new Map(entries.map(function entryValue([key, sampled,],) {
          return [
            key,
            sampled.value,
          ];
        },),),
      };
    },);
  }
  if (node.kind === 'union')
    return oneof(...node.members
      .map(sampleValue,),);
  if (node.kind === 'record') {
    return tuple(...node.keys
      .map(function entry(key,) {
      return sampleValue(node.value,)
        .map(function toEntry(sampled,) {
        return entryOf({
          key,
          sampled,
          symbolKey: false,
        },);
      },);
    },),)
      .map(objectOf,);
  }
  if (node.kind === 'box') {
    return sampleValue(node.inner,)
      .map(function toBox(inner,) {
      return objectOf([
        entryOf({
          key: 'v',
          sampled: inner,
          symbolKey: false,
        },),
        entryOf({
          key: 'tag',
          sampled: scalar('s',),
          symbolKey: false,
        },),
      ],);
    },);
  }
  if (node.kind === 'intersection') {
    return tuple(
      sampleEntries(node.left,),
      sampleEntries(node.right,),
    )
      .map(function combine([left, right,],) {
      return objectOf([
        ...left,
        ...right,
      ],);
    },);
  }
  if (node.kind !== 'object')
    throw new Error(`sampleValue: unhandled kind ${node.kind}`,);
  return sampleEntries(node,)
    .map(objectOf,);
}
