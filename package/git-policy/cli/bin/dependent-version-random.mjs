/**
 Seeded choices for the dependent-version differential generator.
 */

/** Mulberry32 increment. */
const increment = 0x6D_2B_79_F5;

/** Divisor that maps a 32-bit value into [0, 1). */
const range = 4_294_967_296;

/** First shift of the Mulberry32 output mix. */
const firstShift = 15;

/** Second shift of the Mulberry32 output mix. */
const secondShift = 7;

/** Third shift of the Mulberry32 output mix. */
const thirdShift = 14;

/** Odd constant of the second mix step. */
const mixOdd = 61;

/**
 Mulberry32: a small seeded generator of numbers in [0, 1).

 @param {number} seed - 32-bit seed
 @returns {() => number} generator
 */
export function seeded(seed) {
  const state = { value: seed >>> 0 };
  return function next() {
    state.value = (state.value + increment) >>> 0;
    const first = Math.imul(
      state.value ^ (state.value >>> firstShift),
      1 | state.value,
    );
    const second = (first + Math.imul(
      first ^ (first >>> secondShift),
      mixOdd | first,
    )) ^ first;
    return ((second ^ (second >>> thirdShift)) >>> 0) / range;
  };
}

/**
 Choices drawn from one generator.

 @typedef {{
   below: (count: number) => number,
   pick: <T>(list: readonly T[]) => T,
   chance: (probability: number) => boolean,
   shuffled: <T>(list: readonly T[]) => T[],
 }} Tool
 */

/**
 Choices drawn from one generator: an index below a count, an element, an event, and a shuffle.

 @param {() => number} random - generator
 @returns {Tool} choices
 */
export function tools(random) {
  /**
   An index below a count.

   @param {number} count - exclusive bound
   @returns {number} index
   */
  function below(count) {
    return Math.floor(random() * count);
  }
  return {
    below,
    pick: function pick(list) {
      const chosen = list[below(list.length)];
      if (chosen === undefined)
        throw new RangeError('cannot pick from an empty list');
      return chosen;
    },
    chance: function chance(probability) {
      return random() < probability;
    },
    shuffled: function shuffled(list) {
      const copy = [...list];
      for (const index of copy.keys()) {
        const other = index + below(copy.length - index);
        const held = /** @type {typeof copy[number]} */ (copy[index]);
        copy[index] = /** @type {typeof copy[number]} */ (copy[other]);
        copy[other] = held;
      }
      return copy;
    },
  };
}
