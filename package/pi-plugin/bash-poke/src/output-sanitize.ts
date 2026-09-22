/**
 Output sanitization owned by this package.

 @module
 */

import {
  C0_END_CODE,
  C0_START_CODE,
  C1_END_CODE,
  C1_START_CODE,
  CARRIAGE_RETURN_CODE,
  DELETE_CODE,
  LINE_FEED_CODE,
  SURROGATE_END_CODE,
  SURROGATE_START_CODE,
  TAB_CODE,
} from './constants.ts';

//region Types

/**
 One inclusive code-point range dropped as an invisible formatting character.
 */
type FormatCharacterRange = {
  /**
   First code point in the range.
   */
  readonly start: number;

  /**
   Last code point in the range.
   */
  readonly end: number;
};

//endregion Types

//region Range table

/**
 Inclusive code-point ranges dropped as Unicode format characters.
 
 Format characters steer rendering and text direction without showing anything,
 so captured command output must not be able to smuggle them into the
 transcript. The table covers the blocks that appear in real terminal output;
 it is deliberately narrower than the whole Cf category, because exhaustive
 coverage would need a generated Unicode table this package does not carry.
 */
const FORMAT_CHARACTER_RANGES: readonly FormatCharacterRange[] = [
  {
    start: 0x00_AD,
    end: 0x00_AD,
  },
  {
    start: 0x06_00,
    end: 0x06_05,
  },
  {
    start: 0x06_1C,
    end: 0x06_1C,
  },
  {
    start: 0x06_DD,
    end: 0x06_DD,
  },
  {
    start: 0x07_0F,
    end: 0x07_0F,
  },
  {
    start: 0x08_E2,
    end: 0x08_E2,
  },
  {
    start: 0x18_0E,
    end: 0x18_0E,
  },
  {
    start: 0x20_0B,
    end: 0x20_0F,
  },
  {
    start: 0x20_2A,
    end: 0x20_2E,
  },
  {
    start: 0x20_60,
    end: 0x20_64,
  },
  {
    start: 0x20_66,
    end: 0x20_6F,
  },
  {
    start: 0xFE_FF,
    end: 0xFE_FF,
  },
  {
    start: 0xFF_F9,
    end: 0xFF_FB,
  },
];

//endregion Range table

//region Predicates

/**
 Reports whether a code point is whitespace worth preserving.
 
 @param code - Unicode code point
 
 @returns whether layout meaning depends on it
 
 @example
 ```ts
 isKeptWhitespace({ code: LINE_FEED_CODE, },);
 ```
 */
function isKeptWhitespace({ code, }: { readonly code: number; }, ): boolean {
  return (code === TAB_CODE)
    || (code === LINE_FEED_CODE)
    || (code === CARRIAGE_RETURN_CODE);
}

/**
 Reports whether a code point is a control character terminals would act on.
 
 @param code - Unicode code point
 
 @returns whether the character must be dropped
 
 @example
 ```ts
 isControlCode({ code: DELETE_CODE, },);
 ```
 */
function isControlCode({ code, }: { readonly code: number; }, ): boolean {
  return ((code >= C0_START_CODE) && (code <= C0_END_CODE))
    || (code === DELETE_CODE)
    || ((code >= C1_START_CODE) && (code <= C1_END_CODE));
}

/**
 Reports whether a code point is an unpaired surrogate.
 
 String iteration walks whole code points, so a paired surrogate arrives as one
 astral code point and only an unpaired half lands in this range.
 
 @param code - Unicode code point
 
 @returns whether the character renders as nothing
 
 @example
 ```ts
 isSurrogateCode({ code: SURROGATE_START_CODE, },);
 ```
 */
function isSurrogateCode({ code, }: { readonly code: number; }, ): boolean {
  return (code >= SURROGATE_START_CODE) && (code <= SURROGATE_END_CODE);
}

/**
 Reports whether a code point is an invisible formatting character.
 
 @param code - Unicode code point
 
 @returns whether the character can steer rendering without showing
 
 @example
 ```ts
 isFormatCharacter({ code: 0x202E, },);
 ```
 */
function isFormatCharacter({ code, }: { readonly code: number; }, ): boolean {
  return FORMAT_CHARACTER_RANGES.some(function containsCode(
    range: FormatCharacterRange,
  ): boolean {
    return (code >= range.start) && (code <= range.end);
  }, );
}

/**
 Reports whether one code point survives sanitization.
 
 @param code - Unicode code point
 
 @returns whether the character is kept
 
 @example
 ```ts
 isKeptCode({ code: TAB_CODE, },);
 ```
 */
function isKeptCode({ code, }: { readonly code: number; }, ): boolean {
  if (isControlCode({ code, }, ) && (!isKeptWhitespace({ code, }, )))
    return false;
  if (isSurrogateCode({ code, }, ))
    return false;
  return !isFormatCharacter({ code, }, );
}

//endregion Predicates

//region Sanitization

/**
 Strips characters that would corrupt rendering or hide captured content.
 
 Pi sanitizes chunks before its own component renders them, and this package
 renders through a widget and a message instead, so the same protection is ours
 to apply. One pass over the input's code points keeps cost proportional to
 output size, and the range check walks a fixed table, so unbounded output
 stays linear.
 
 @param text - raw captured output
 
 @returns text safe to render and to place inside a fence
 
 @example
 ```ts
 sanitizeOutput({ text: 'ok\u0007', },);
 ```
 */
function sanitizeOutput({ text, }: { readonly text: string; }, ): string {
  /**
   Kept characters, joined once so the pass never rebuilds an accumulator.
   */
  const kept: string[] = [];

  for (const character of text) {
    /**
     Code point of this iteration's character, absent only for an empty string
     which iteration never yields.
     */
    const code = character.codePointAt(0, );
    if (code === undefined)
      continue;
    if (isKeptCode({ code, }, ))
      kept.push(character, );
  }

  return kept.join('', );
}

//endregion Sanitization

export {
  FORMAT_CHARACTER_RANGES,
  isControlCode,
  isFormatCharacter,
  isKeptCode,
  isKeptWhitespace,
  isSurrogateCode,
  sanitizeOutput,
};

export type { FormatCharacterRange, };
