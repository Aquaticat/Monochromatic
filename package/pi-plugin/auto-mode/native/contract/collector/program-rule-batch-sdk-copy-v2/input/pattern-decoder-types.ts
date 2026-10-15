/**
 Bounded syntax decoding borrows the original private pattern owner. @module
 */
import type { Node } from 'yuku-parser';

/**
 Decoded data retains literal identity and recursively owned child patterns.
 */
export type DecodedPattern = Readonly<
  {
    kind: 'literal';
    value: unknown
  }
  | { kind: 'result' }
  | {
    kind: 'array';
    items: readonly DecodedPattern[]
  }
  | {
    kind: 'object';
    entries: readonly Readonly<{ key: string; pattern: DecodedPattern }>[]
  }
>;

/**
 Parser input and borrowed callbacks preserve the original decoding boundary.
 */
export type PatternDecoderInput = Readonly<{
  node: Node | undefined;
  bindingName: string | undefined;
  depth: number;
  owned: (value: DecodedPattern) => DecodedPattern;
  ResultProgramProfileError: new (message: string) => Error;
}>;

/**
 Literal variants expose optional original metadata without extra property probes.
 */
export type PatternLiteral = Extract<Node, { type: 'Literal' }> & Readonly<{
  regex?: unknown;
  bigint?: unknown;
}>;
