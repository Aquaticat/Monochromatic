import type { $ as TypeOf, } from '../../../../t/index.ts';

/**
 * Primitive types that need no further decomposition in the enhanced typeof result.
 */
const noFurtherTypeOf = [
  'undefined',
  'symbol',
] as const;

/**
 * Enhanced typeof function that provides detailed type information as discriminated union.
 * Returns complex type information including sign information for numbers/bignums,
 * truthiness for booleans, async/generator flags for functions, and detailed
 * prototype information for objects.
 *
 * @param value - Value to determine detailed type for
 *
 * @returns Discriminated union with detailed type information
 *
 * @example
 * ```ts
 * $(42n); // ['bigint', { sign: 'positive' }]
 * $(true); // ['boolean', { true: true }]
 * $(() => {}); // ['function', { async: false, generator: false }]
 * $([1, 2, 3]); // ['object', { prototype: 'Array' }]
 * $(new Date()); // ['object', { prototype: 'Date' }]
 * ```
 */
export function $(value: unknown,): TypeOf {
  /**
   * Result of the built-in `typeof` operator; discriminates the branches below.
   */
  const typeOf = typeof value;

  if (noFurtherTypeOf.includes(typeOf,)) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- typeOf verified to be in noFurtherTypeOf tuple
    return typeOf as (typeof noFurtherTypeOf)[number];
  }

  if (typeOf === 'bigint') {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- typeof guard ensures value is bigint */
    /**
     * Narrowed bigint view of `value` after the typeof guard; needed because the assertion is unsafe to write inline twice.
     */
    const myValue = value as bigint;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    /**
     * Tristate sign discriminator (`0`, `'positive'`, `'negative'`) carried in the bigint variant of the result.
     */
    const sign = myValue === 0n ? 0 : (myValue > 0n ? 'positive' : 'negative');
    return [
      typeOf,
      { sign, },
    ];
  }

  if (typeOf === 'boolean') {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- typeof guard ensures value is boolean */
    /**
     * Narrowed boolean view of `value`; surfaced through the `true` discriminator in the result.
     */
    const myValue = value as boolean;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    return [
      typeOf,
      { true: myValue, },
    ];
  }

  if (typeOf === 'number') {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- typeof guard ensures value is number */
    /**
     * Narrowed number view of `value`; consulted for NaN, sign, and integer status.
     */
    const myValue = value as number;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    if (Number.isNaN(myValue,)) {
      return [
        typeOf,
        { NaN: true, },
      ];
    }

    /**
     * Tristate sign discriminator (`0`, `'positive'`, `'negative'`) carried in the non-NaN number variant.
     */
    const sign = myValue === 0 ? 0 : (myValue > 0 ? 'positive' : 'negative');
    /**
     * True when {@link myValue} has a fractional component; lets callers branch on integer vs float.
     */
    const float = !Number.isInteger(myValue,);
    return [
      typeOf,
      {
        NaN: [
          false,
          {
            sign,
            float,
          },
        ],
      },
    ];
  }

  if (typeOf === 'string') {
    /* oxlint-disable typescript/no-unsafe-type-assertion -- typeof guard ensures value is string */
    /**
     * Narrowed string view of `value`; inspected for emptiness and single-character classification.
     */
    const myValue = value as string;
    /* oxlint-enable typescript/no-unsafe-type-assertion */
    if (myValue.length
      === 0) {
      return [
        typeOf,
        { empty: true, },
      ];
    }

    return [
      typeOf,
      {
        empty: [
          false,
          {
            char: myValue
                .length
              !== 1
              ? false
              : [
                true,
                // oxlint-disable-next-line no-restricted-syntax/no-regex -- Unicode property class \p{Upper} is the standard way to test for uppercase letters; no string API exposes the Unicode upper-letter set, input is a single grapheme so matching is O(1).
                /\p{Upper}/v.test(myValue,)
                  ? 'uppercaseLetter'
                  // oxlint-disable-next-line no-restricted-syntax/no-regex -- Unicode property class \p{Lower} is the standard way to test for lowercase letters; no string API exposes the Unicode lower-letter set, input is a single grapheme so matching is O(1).
                  : (/\p{Lower}/v.test(myValue,)
                    ? 'lowercaseLetter'
                    : 'nonLetter'),
              ],
          },
        ],
      },
    ];
  }

  /**
   * `Object.prototype.toString` tag (e.g. `[object Array]`); the canonical way to distinguish built-in object subtypes.
   */
  const prototypeString = Object.prototype
    .toString
    .call(value,);

  if (typeOf === 'function') {
    if (prototypeString === '[object Function]') {
      return [
        typeOf,
        {
          async: false,
          generator: false,
        },
      ];
    }
    if (prototypeString === '[object AsyncFunction]') {
      return [
        typeOf,
        {
          async: true,
          generator: false,
        },
      ];
    }
    if (prototypeString === '[object GeneratorFunction]') {
      return [
        typeOf,
        {
          async: false,
          generator: true,
        },
      ];
    }
    if (prototypeString === '[object AsyncGeneratorFunction]') {
      return [
        typeOf,
        {
          async: true,
          generator: true,
        },
      ];
    }
  }

  if (typeOf === 'object') {
    if (value === null) {
      return [
        typeOf,
        { prototype: 'Null', },
      ];
    }

    // Handle special object types based on prototype string
    if (prototypeString === '[object Array]') {
      return [
        typeOf,
        { prototype: 'Array', },
      ];
    }
    if (prototypeString === '[object Date]') {
      return [
        typeOf,
        { prototype: 'Date', },
      ];
    }
    if (prototypeString === '[object Map]') {
      return [
        typeOf,
        { prototype: 'Map', },
      ];
    }
    if (prototypeString === '[object Set]') {
      return [
        typeOf,
        { prototype: 'Set', },
      ];
    }
    if (prototypeString === '[object Promise]') {
      return [
        typeOf,
        { prototype: 'Promise', },
      ];
    }
    if (prototypeString === '[object RegExp]') {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- prototype string check confirms RegExp */
      /**
       * Narrowed RegExp view of `value`; only the `global` flag is surfaced in the result.
       */
      const regexp = value as RegExp;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      return [
        typeOf,
        {
          prototype: [
            'RegExp',
            { global: regexp.global, },
          ],
        },
      ];
    }

    /* oxlint-disable typescript/no-unsafe-type-assertion -- typeof guard ensures value is object */
    /**
     * Narrowed object view of `value`; probed via well-known symbols to classify plain objects as iterable or async-iterable.
     */
    const myValue = value as object;
    /* oxlint-enable typescript/no-unsafe-type-assertion */

    // Default plain object
    return [
      typeOf,
      {
        prototype: [
          'Object',
          {
            iterable: (typeof (
                // @ts-expect-error; Might be Async Iterable
                myValue[Symbol.asyncIterator]
              )) === 'function'
              ? [
                true,
                { async: true, },
              ]
              : ((typeof (
                  // @ts-expect-error; Might be Iterable
                  myValue[Symbol.iterator]
                )) === 'function'
                ? [
                  true,
                  { async: false, },
                ]
                : false),
          },
        ],
      },
    ];
  }

  throw new TypeError(
    `This shouldn't happen. Unhandled value with typeof "${typeOf}" and prototype "${prototypeString}"`,
  );
}
