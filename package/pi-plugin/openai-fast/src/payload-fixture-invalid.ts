/**
 Test-only invalid request records cover native JSON boundary representations. @module
 */

/**
 Invalid callback replacements include primitives, arrays, and foreign container prototypes.
 */
export const PAYLOAD_FIXTURE_INVALID_REPLACEMENTS: readonly {
  readonly name: string;
  readonly value: unknown;
}[] = [
  {
    name: 'null',
    value: null,
  },
  {
    name: 'array',
    value: [] as readonly unknown[],
  },
  {
    name: 'string',
    value: 'invalid payload',
  },
  {
    name: 'number',
    value: 7,
  },
  {
    name: 'boolean',
    value: false,
  },
  {
    name: 'function',
    value: function invalidFunctionPayload(): {
      readonly service_tier: 'default';
    } {
      return { service_tier: 'default', };
    },
  },
  {
    name: 'bigint',
    value: 1n,
  },
  {
    name: 'symbol',
    value: Symbol('caller returned invalid payload symbol'),
  },
  {
    name: 'date',
    value: new Date(0,),
  },
  {
    name: 'map',
    value: new Map<string, string>(),
  },
  {
    name: 'set',
    value: new Set<string>(),
  },
  {
    name: 'typed array',
    value: new Uint8Array(1,),
  },
] as const;
