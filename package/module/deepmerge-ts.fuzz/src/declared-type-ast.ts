/**
 Declared-type AST for type-level fuzzing, its TypeScript emitter, and a
 fast-check generator of type trees.

 The literal-inferred corpus (`./type-case-generate.ts`) never produces a
 declared union, optional key, readonly modifier, or index signature, yet
 every type-level defect found so far came from those. This AST describes
 such types so `./declared-type-sample.ts` can draw values that conform to
 them and `./declared-type-generate.ts` can emit `widen<T>(value)` inputs whose
 static types are the declared ones.

 Emitted types assume the file header declared by the generator: the symbol
 constants in {@link SYMBOL_NAMES}, the brand type `FuzzBrand`, and the
 generic alias `Box<T>`.

 @module
 */

import {
  array,
  boolean,
  constant,
  constantFrom,
  integer,
  letrec,
  oneof,
  record,
  uniqueArray,
  type Arbitrary,
} from 'fast-check';

//region AST

/**
 Scalar and leaf type kinds with no children.
 */
export type LeafNode = {
  readonly kind: 'boolean' | 'brand' | 'date' | 'null' | 'number' | 'regexp' | 'string' | 'undefined';
};

/**
 Literal type such as `1`, `'a'`, or `true`.
 */
export type LiteralNode = {
  readonly kind: 'literal';
  readonly value: boolean | number | string;
};

/**
 One declared property; `key` is a string key or a symbol constant name.
 */
export type PropNode = {
  readonly key: string;
  readonly symbolKey: boolean;
  readonly optional: boolean;
  readonly readonly: boolean;
  readonly type: TypeNode;
};

/**
 Index signature shape, or its absence.
 */
export type IndexNode =
  | { readonly keyKind: 'none'; }
  | { readonly keyKind: 'number' | 'string' | 'symbol' | 'template'; readonly value: TypeNode; };

/**
 Object type with an optional utility wrapper.
 */
export type ObjectNode = {
  readonly kind: 'object';
  readonly props: readonly PropNode[];
  readonly index: IndexNode;
  readonly wrapper: 'none' | 'partial' | 'readonly' | 'required';
};

/**
 Every declared type shape the fuzzer emits.
 */
export type TypeNode =
  | LeafNode
  | LiteralNode
  | ObjectNode
  | { readonly kind: 'array'; readonly element: TypeNode; readonly readonly: boolean; }
  | { readonly kind: 'box'; readonly inner: TypeNode; }
  | { readonly kind: 'intersection'; readonly left: ObjectNode; readonly right: ObjectNode; }
  | { readonly kind: 'map'; readonly keyKind: 'number' | 'string'; readonly value: TypeNode; readonly readonly: boolean; }
  | { readonly kind: 'record'; readonly keys: readonly string[]; readonly value: TypeNode; }
  | { readonly kind: 'set'; readonly element: TypeNode; readonly readonly: boolean; }
  | { readonly kind: 'tuple'; readonly elements: readonly TypeNode[]; readonly readonly: boolean; }
  | { readonly kind: 'union'; readonly members: readonly TypeNode[]; };

/**
 Symbol constants the generated file declares as `unique symbol`s.
 */
export const SYMBOL_NAMES: readonly string[] = ['SYM_A', 'SYM_B', 'SYM_INDEX',];

//endregion AST

//region Emitter

/**
 Emit one property's key and modifiers.

 @param prop - Declared property.
 @param wrapper - Enclosing utility wrapper, which overrides optionality.

 @returns Source such as `readonly "a"?: number`.

 @example
 ```ts
 emitProp({ prop, wrapper: 'none', });
 ```
 */
function emitProp({ prop, wrapper, }: { readonly prop: PropNode; readonly wrapper: ObjectNode['wrapper']; },): string {
  /**
   Key source: computed symbol constant or quoted string.
   */
  const key = prop.symbolKey ? `[${prop.key}]` : JSON.stringify(prop.key,);
  return `${prop.readonly ? 'readonly ' : ''}${key}${prop.optional && (wrapper !== 'required') ? '?' : ''}: ${emitType(prop.type,)}`;
}

/**
 Emit an index signature, widened so every same-kind property conforms.

 @param node - Object type holding the signature.

 @returns Signature source, or an empty string without one.

 @example
 ```ts
 emitIndex(node); // '[key: string]: number | string'
 ```
 */
function emitIndex(node: ObjectNode,): string {
  /**
   Signature of this object.
   */
  const { index, } = node;
  if (index.keyKind === 'none')
    return '';
  /**
   Properties the signature constrains, whose types must fit its value type.
   */
  const covered = node.props.filter(function constrainedBy(prop,) {
    if (index.keyKind === 'symbol')
      return prop.symbolKey;
    if (index.keyKind === 'string')
      return !prop.symbolKey;
    return false;
  },);
  /**
   Value type union of the declared value and every constrained property.
   */
  const value = [index.value, ...covered.map(function propType(prop,) {
    return prop.type;
  },),].map(emitType,).join(' | ',);
  /**
   Key parameter source per signature kind.
   */
  const keyParameter = {
    number: 'key: number',
    string: 'key: string',
    symbol: 'key: symbol',
    template: 'key: `k${string}`',
  }[index.keyKind];
  return `[${keyParameter}]: ${value}`;
}

/**
 Emit TypeScript source for a declared type.

 @param node - Type to emit.

 @returns Type source, parenthesized where precedence requires.

 @example
 ```ts
 emitType({ kind: 'array', element: { kind: 'number', }, readonly: true, }); // 'readonly (number)[]'
 ```
 */
export function emitType(node: TypeNode,): string {
  if (node.kind === 'literal')
    return JSON.stringify(node.value,);
  if (node.kind === 'brand')
    return 'FuzzBrand';
  if (node.kind === 'date')
    return 'Date';
  if (node.kind === 'regexp')
    return 'RegExp';
  if ((node.kind === 'boolean') || (node.kind === 'null') || (node.kind === 'number') || (node.kind === 'string') || (node.kind === 'undefined'))
    return node.kind;
  if (node.kind === 'array')
    return `${node.readonly ? 'readonly ' : ''}(${emitType(node.element,)})[]`;
  if (node.kind === 'tuple')
    return `${node.readonly ? 'readonly ' : ''}[${node.elements.map(emitType,).join(', ',)}]`;
  if (node.kind === 'set')
    return `${node.readonly ? 'ReadonlySet' : 'Set'}<${emitType(node.element,)}>`;
  if (node.kind === 'map')
    return `${node.readonly ? 'ReadonlyMap' : 'Map'}<${node.keyKind}, ${emitType(node.value,)}>`;
  if (node.kind === 'union')
    return node.members.map(function member(child,) {
      return `(${emitType(child,)})`;
    },).join(' | ',);
  if (node.kind === 'intersection')
    return `(${emitType(node.left,)}) & (${emitType(node.right,)})`;
  if (node.kind === 'record')
    return `Record<${node.keys.map(function quote(key,) {
      return JSON.stringify(key,);
    },).join(' | ',)}, ${emitType(node.value,)}>`;
  if (node.kind === 'box')
    return `Box<${emitType(node.inner,)}>`;
  if (node.kind !== 'object')
    throw new Error(`emitType: unhandled kind ${node.kind}`,);
  /**
   Member list of the object literal type.
   */
  const members = [...node.props.map(function member(prop,) {
    return emitProp({ prop, wrapper: node.wrapper, },);
  },), emitIndex(node,),].filter(function present(member,) {
    return member !== '';
  },);
  /**
   Bare object literal type.
   */
  const body = `{ ${members.join('; ',)} }`;
  return {
    none: body,
    partial: `Partial<${body}>`,
    readonly: `Readonly<${body}>`,
    required: `Required<${body}>`,
  }[node.wrapper];
}

//endregion Emitter

//region Generator

/**
 Deepest nesting of generated type trees.
 */
const MAX_TYPE_DEPTH = 3;

/**
 Most properties, tuple elements, or union members per node.
 */
const MAX_CHILDREN = 3;

/**
 Leaf and literal type generator. Brands are emitted by {@link emitType} but
 never drawn: a literal can only be shown to be a branded value with a cast,
 which would defeat the check.
 */
const leafTypeArbitrary: Arbitrary<TypeNode> = oneof(
  constantFrom<TypeNode>(
    { kind: 'number', },
    { kind: 'string', },
    { kind: 'boolean', },
    { kind: 'null', },
    { kind: 'undefined', },
    { kind: 'date', },
    { kind: 'regexp', },
  ),
  constantFrom<boolean | number | string>(0, 1, 'a', 'b', true, false,).map(function toLiteral(value,): TypeNode {
    return { kind: 'literal', value, };
  },),
);

/**
 Recursive type-tree generators.

 @param unions - Whether union nodes are drawn; off to search for classes
   other than the pinned union ones.

 @returns Type and object generators over one recursion scope.

 @example
 ```ts
 const scope = typeScopeFor({ unions: false, });
 ```
 */
function typeScopeFor({ unions, }: { readonly unions: boolean; },): { readonly type: Arbitrary<TypeNode>; readonly object: Arbitrary<ObjectNode>; } {
  return letrec<{ type: TypeNode; object: ObjectNode; }>(function build(tie,) {
  return {
    type: oneof(
      { maxDepth: MAX_TYPE_DEPTH, depthIdentifier: 'declared-type', },
      leafTypeArbitrary,
      tie('object',),
      record({ element: tie('type',), readonly: boolean(), },).map(function toArray({ element, readonly, },): TypeNode {
        return { kind: 'array', element, readonly, };
      },),
      record({ elements: array(tie('type',), { maxLength: MAX_CHILDREN, },), readonly: boolean(), },).map(function toTuple({ elements, readonly, },): TypeNode {
        return { kind: 'tuple', elements, readonly, };
      },),
      record({ element: tie('type',), readonly: boolean(), },).map(function toSet({ element, readonly, },): TypeNode {
        return { kind: 'set', element, readonly, };
      },),
      record({ keyKind: constantFrom<'number' | 'string'>('number', 'string',), value: tie('type',), readonly: boolean(), },).map(function toMap({ keyKind, value, readonly, },): TypeNode {
        return { kind: 'map', keyKind, value, readonly, };
      },),
      unions
        ? array(tie('type',), { minLength: 2, maxLength: MAX_CHILDREN, },).map(function toUnion(members,): TypeNode {
          return { kind: 'union', members, };
        },)
        : leafTypeArbitrary,
      record({ keys: uniqueArray(constantFrom('a', 'b', 'c',), { minLength: 1, maxLength: MAX_CHILDREN, },), value: tie('type',), },).map(function toRecord({ keys, value, },): TypeNode {
        return { kind: 'record', keys, value, };
      },),
      tie('type',).map(function toBox(inner,): TypeNode {
        return { kind: 'box', inner, };
      },),
      record({ left: tie('object',), right: tie('object',), },).map(function toIntersection({ left, right, },): TypeNode {
        return { kind: 'intersection', left: withKeys({ node: left, keys: ['a', 'b',], },), right: withKeys({ node: right, keys: ['c', 'd',], },), };
      },),
    ),
    object: record({
      props: uniqueArray(
        record({
          key: constantFrom('a', 'b', 'c', 'SYM_A', 'SYM_B',),
          optional: boolean(),
          readonly: boolean(),
          type: tie('type',),
        },),
        {
          maxLength: MAX_CHILDREN,
          selector: function keyOf(prop,) {
            return prop.key;
          },
        },
      ),
      index: oneof(
        { weight: 3, arbitrary: constant<IndexNode>({ keyKind: 'none', },), },
        { weight: 1, arbitrary: record({ keyKind: constantFrom<'number' | 'string' | 'symbol' | 'template'>('number', 'string', 'symbol', 'template',), value: tie('type',), },), },
      ),
      wrapper: constantFrom<ObjectNode['wrapper']>('none', 'none', 'partial', 'readonly', 'required',),
    },).map(function toObject({ props, index, wrapper, },): ObjectNode {
      return {
        kind: 'object',
        props: props.map(function toProp(prop,): PropNode {
          return { ...prop, symbolKey: prop.key.startsWith('SYM_',), };
        },),
        index,
        wrapper,
      };
    },),
  };
},);
}

/**
 Rename an object's string keys into a fixed pool, so intersection halves
 never share a key.

 @param node - Object to rename.
 @param keys - Pool for this half.

 @returns Object whose string keys come from `keys`, symbol keys dropped.

 @example
 ```ts
 withKeys({ node, keys: ['a', 'b',], });
 ```
 */
function withKeys({ node, keys, }: { readonly node: ObjectNode; readonly keys: readonly string[]; },): ObjectNode {
  /**
   String-keyed properties that fit the pool.
   */
  const props = node.props
    .filter(function stringKeyed(prop,) {
      return !prop.symbolKey;
    },)
    .slice(0, keys.length,)
    .map(function rename(prop, position,): PropNode {
      return { ...prop, key: keys[position] ?? prop.key, };
    },);
  return { ...node, index: { keyKind: 'none', }, props, };
}

/**
 Generators of declared type trees and object types, with and without unions.
 */
export const DECLARED_TYPE_SCOPES: Readonly<Record<'noUnions' | 'unions', { readonly type: Arbitrary<TypeNode>; readonly object: Arbitrary<ObjectNode>; }>> = {
  noUnions: typeScopeFor({ unions: false, },),
  unions: typeScopeFor({ unions: true, },),
};

/**
 Small integers for leaf values; exported so the sampler shares the range.
 */
export const LEAF_INTEGER: Arbitrary<number> = integer({ min: -2, max: 9, },);

//endregion Generator
