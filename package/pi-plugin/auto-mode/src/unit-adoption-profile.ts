/**
 Select bounded structural opportunities without inferring delegation or authority.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  UnitAdoptionBindingError,
  type UnitAdoptionPair,
  type UnitRuleProjection,
} from './unit-adoption-binding.ts';

/**
 Structural selection logs never serialize original source material.
 */
const l = tagged({ tag: 'auto-mode-unit-adoption-profile', },);

/**
 Existing source profile permits at most one structural pair for each of its 64 sources.
 */
const MAX_UNIT_ADOPTION_PAIRS = 64;

/**
 Select sources containing exactly a tagged adopter and a whole quoted target.
 All original candidates remain independently selected for clause interpretation.
 Equal text never merges distinct source occurrences or grants either unit authority.

 @param candidates - original instruction candidate handles

 @param readRule - fixed original projection reader

 @param member - original sole prepared member

 @returns owned structural opportunities retaining original handle identities

 @throws UnitAdoptionBindingError when opportunities exceed the unchanged 64-source profile

 @throws original projection-reader failure without replacing its value

 @example
 ```ts
 const pairs = selectUnitAdoptionPairs({ candidates, readRule, member });
 // A selected pair is not proof of incorporation meaning or source authority.
 ```
 */
export function selectUnitAdoptionPairs<const PreparedMember extends object | undefined>(
  {
    candidates,
    readRule,
    member,
  }: {
    readonly candidates: readonly object[];
    readonly readRule: (handle: object,) => UnitRuleProjection<unknown>;
    readonly member: PreparedMember;
  },
): readonly UnitAdoptionPair<PreparedMember>[] {
  /**
   Group only by original occurrence references, not hashes, paths or text.
   */
  const rl = tagged({
    tag: selectUnitAdoptionPairs.name,
    l,
  },);
  rl.debug('selecting original same-source structural opportunities',);
  /**
   Temporary grouping is local to this decision and does not register new sources.
   */
  const sources = new Map<unknown, {
    readonly candidate: object;
    readonly projection: UnitRuleProjection<unknown>
  }[]>();
  for (const candidate of candidates) {
    /**
     Projection stays with its original reader and source occurrence.
     */
    const projection = readRule(candidate,);
    /**
     Each source's original candidate multiplicity remains visible.
     */
    const units = sources.get(projection.sourceOccurrence,) ?? [];
    units.push({
      candidate,
      projection,
    },);
    sources.set(
      projection.sourceOccurrence,
      units,
    );
  }
  /**
   Only the supported two-unit profile contributes a structural pair.
   */
  const pairs: UnitAdoptionPair<PreparedMember>[] = [];
  for (const units of sources.values()) {
    if (units.length !== 2)
      continue;
    /**
     Tagged structure is not a claim that the adopter actually incorporates anything.
     */
    const adopter = units.find(function taggedAdopter(unit,) {
      return ((typeof unit.projection
        .code) === 'string') && (unit.projection
          .kind
          !== 'unclassified-source-span');
    },);
    /**
     Target remains a whole original blockquote, not a selected fragment.
     */
    const target = units.find(function quotedTarget(unit,) {
      return (unit.projection
        .kind
        === 'unclassified-source-span') && (unit.projection
          .nodeType
          === 'blockquote');
    },);
    if ((adopter === undefined) || (target === undefined))
      continue;
    pairs.push(Object.freeze({
      adopter: adopter.candidate,
      target: target.candidate,
      member,
    },),);
  }
  if (pairs.length > MAX_UNIT_ADOPTION_PAIRS)
    throw new UnitAdoptionBindingError('Unit adoption exceeds the original 64-source profile',);
  return Object.freeze(pairs,);
}
