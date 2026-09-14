import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/** Mutable element imposed by foreign collection boundary. */
type Child = {
  value: string;
};

/** Readonly array wrapper preserving inherited default-library observer declarations. */
type WrappedReadonlyChildren = ReadonlyArray<Child> & {
  readonly wrapperTag: string;
};

/** Mutable explicit callback `this` state supplied independently. */
type ThisState = {
  label: string;
};

/**
 * Referenced observer reached only through foreign receiver.
 *
 * @param referencedChild - Element whose sole inbound is foreign.
 *
 * @returns whether value is present.
 */
function referencedForeignObserver(referencedChild: Child,): boolean {
  return referencedChild.value.length > 0;
}

/**
 * Reusable observer reached through foreign and ordinary receivers.
 *
 * @param child - Element whose inbounds disagree on ownership.
 *
 * @returns whether value is present.
 */
function reusedObserver(child: Child,): boolean {
  return child.value.length > 0;
}

/**
 * Reads observer element through array wrapper type.
 *
 * @param values - Foreign-owned wrapped readonly collection.
 *
 * @returns observed primitive values.
 */
export function inspectWrappedForeignObserver(
  values: ForeignBorrowed<WrappedReadonlyChildren>,
): readonly string[] {
  return values.map(function wrappedForeignObserver(wrappedChild,) {
    return wrappedChild.value;
  },);
}

/**
 * Exercises position-aware ownership for every supported array observer.
 *
 * @param values - Foreign-owned collection receiver.
 *
 * @param ordinaryValues - Ordinary receiver creating mixed observer inbound.
 */
export function inspectForeignObservers(
  values: ForeignBorrowed<readonly Child[]>,
  ordinaryValues: readonly Child[],
): void {
  void values.map(function mapObserver(mapChild, mapIndex, mapValues,) {
    return mapChild.value.length + mapIndex + mapValues.length;
  },);
  void values.map(function thisObserver(
    this: ThisState,
    thisChild,
    thisIndex,
    thisValues,
  ) {
    return this.label.length
      + thisChild.value.length
      + thisIndex
      + thisValues.length;
  }, { label: 'state', },);
  values.forEach(function forEachObserver(forEachChild, forEachIndex, forEachValues,) {
    void forEachChild.value;
    void forEachIndex;
    void forEachValues.length;
  },);
  void values.filter(function filterObserver(filterChild, filterIndex, filterValues,) {
    return filterChild.value.length + filterIndex + filterValues.length > 0;
  },);
  void values.find(function findObserver(findChild, findIndex, findValues,) {
    return findChild.value.length + findIndex + findValues.length > 0;
  },);
  void values.findLast(function findLastObserver(findLastChild, findLastIndex, findLastValues,) {
    return findLastChild.value.length + findLastIndex + findLastValues.length > 0;
  },);
  void values.every(function everyObserver(everyChild, everyIndex, everyValues,) {
    return everyChild.value.length + everyIndex + everyValues.length > 0;
  },);
  void values.some(function someObserver(someChild, someIndex, someValues,) {
    return someChild.value.length + someIndex + someValues.length > 0;
  },);
  void values.flatMap(function flatMapObserver(flatMapChild, flatMapIndex, flatMapValues,) {
    return [flatMapChild.value.length + flatMapIndex + flatMapValues.length,];
  },);
  void values.reduce(
    function seededReduceObserver(seededAccumulator, seededChild, seededIndex, seededValues,) {
      return {
        count: seededAccumulator.count
          + seededChild.value.length
          + seededIndex
          + seededValues.length,
      };
    },
    { count: 0, },
  );
  void values.reduceRight(
    function noSeedReduceObserver(noSeedAccumulator, noSeedChild, noSeedIndex, noSeedValues,) {
      return {
        value: noSeedAccumulator.value
          + noSeedChild.value
          + noSeedIndex
          + noSeedValues.length,
      };
    },
  );
  void values.some(referencedForeignObserver,);
  void values.some(reusedObserver,);
  void ordinaryValues.some(reusedObserver,);
}
