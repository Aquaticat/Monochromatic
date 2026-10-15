/**
 Original finite source-data patterns remain bounded and separately owned. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type {
  DecodedPattern,
  PatternDecoderInput,
  PatternLiteral
} from './pattern-decoder-types.ts';

/**
 Decoding diagnostics omit source text and argument data.
 */
const l = tagged({ tag: 'auto-mode-pattern-decoder' });

/**
 Original structural depth bound permits finite recursive inspection.
 */
const maxDepth = 8;
/**
 Original collection bound limits inspected argument members.
 */
const maxMembers = 64;

/**
 Narrow original literal metadata with only the original discriminant access.

 @param node - original optional parser node

 @returns whether original literal validation applies
 */
function isPatternLiteral(node?: Readonly<{ type: string }>): node is PatternLiteral {
  return node?.type === 'Literal';
}

/**
 Preserve original metadata truthiness without extra node reads.

 @param value - original optional metadata

 @returns whether original truthiness treats metadata as absent
 */
function isAbsent(value: unknown): boolean {
  /**
   Boolean conversion retains the original metadata truthiness.
   */
  const present = Boolean(value);
  return !present;
}

//region Decode bounded data and delegate every pattern to the original owner.
/**
 Decode finite literal data and exact earlier result references.

 @param node - parser-owned input retained by identity

 @param bindingName - optional earlier immutable result binding

 @param depth - original bounded structural recursion position

 @param owned - original private pattern ownership callback

 @param ResultProgramProfileError - original diagnostic constructor

 @returns original owner's return value with frozen collection envelopes

 @throws Error for unsupported syntax, bounds, keys, or borrowed owner failures

 @example readOwnedPattern({ node, bindingName, depth: 0, owned, ResultProgramProfileError });
 */
export function readOwnedPattern({
  node,
  bindingName,
  depth,
  owned,
  ResultProgramProfileError
}: PatternDecoderInput): DecodedPattern {
  /**
   Tracing observes entry without reading original payload fields.
   */
  const cl = tagged({
    tag: readOwnedPattern.name,
    l
  });
  cl.debug('decoding original argument pattern');
  if (!(depth <= maxDepth)) throw new ResultProgramProfileError('argument nesting exceeds profile');
  if ((node?.type === 'Identifier') && (bindingName !== undefined)
    && (node.name === bindingName)) return owned({ kind: 'result' });
  if (isPatternLiteral(node)) {
    /**
     Original literal value is read before metadata validation.
     */
    const { value } = node;
    if (!(isAbsent(node.regex) && isAbsent(node.bigint)
      && ((value === null) || ((typeof value) === 'string')
        || ((typeof value) === 'boolean')
        || (((typeof value) === 'number') && Number.isFinite(value)
          && (!Object.is(value, -0)))))) {
      throw new ResultProgramProfileError('non-JSON literal');
    }
    return owned({
      kind: 'literal',
      value
    });
  }
  if ((node?.type === 'UnaryExpression') && (node.operator === '-')
    && (node.argument
      ?.type
      === 'Literal')
    && ((typeof node.argument
      .value) === 'number')) {
    /**
     Negation repeats the original argument and numeric value reads.
     */
    const value = -node.argument
      .value;
    if (!(Number.isFinite(value) && (!Object.is(
      value,
      -0
    )))) throw new ResultProgramProfileError('non-JSON number');
    return owned({
      kind: 'literal',
      value
    });
  }
  if (node?.type === 'ArrayExpression') {
    if (!(node.elements
      .length
      <= maxMembers)) throw new ResultProgramProfileError('array size bound');
    /**
     Original array mapping retains child order and sparse synthetic elements.
     */
    const items = node.elements
      .map(function readArrayPattern(item) {
      if ((item === null) || (item.type === 'SpreadElement')) throw new ResultProgramProfileError('array hole or spread');
      return readOwnedPattern({
        node: item,
        bindingName,
        depth: depth + 1,
        owned,
        ResultProgramProfileError
      });
    });
    return owned({
      kind: 'array',
      items: Object.freeze(items)
    });
  }
  if (!((node?.type === 'ObjectExpression') && (node.properties
    .length
    <= maxMembers))) {
    throw new ResultProgramProfileError('literal object or earlier result reference required');
  }
  /**
   Previously accepted keys reject duplicates before shorthand and child decoding.
   */
  const keys = new Set<string>();
  /**
   Accepted entries retain original property order and child ownership.
   */
  const entries = [];
  for (const property of node.properties) {
    if ((property.type !== 'Property') || property.computed
      || property.method
      || (property.kind !== 'init')) {
      throw new ResultProgramProfileError('ordinary data property required');
    }
    /**
     Original key selection preserves repeated parser property reads.
     */
    const key = property.key
      .type
      === 'Identifier' ? property.key
        .name
      : (property.key
        .type
        === 'Literal') && ((typeof property.key
          .value) === 'string') ? property.key
          .value : undefined;
    if (!(((typeof key) === 'string') && (key !== '__proto__')
      && (!keys.has(key)))) {
      throw new ResultProgramProfileError('duplicate, prototype-setting or unsupported key');
    }
    keys.add(key);
    // Shorthand is allowed only for the exact earlier result binding.
    if (!((!property.shorthand) || ((bindingName !== undefined)
      && (property.value
        .type
        === 'Identifier')
      && (property.value
        .name
        === bindingName)))) {
      throw new ResultProgramProfileError('unbound shorthand');
    }
    entries.push(Object.freeze({
      key,
      pattern: readOwnedPattern({
        node: property.value,
        bindingName,
        depth: depth + 1,
        owned,
        ResultProgramProfileError
      })
    }));
  }
  return owned({
    kind: 'object',
    entries: Object.freeze(entries)
  });
}
//endregion
